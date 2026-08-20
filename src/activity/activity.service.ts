import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SyncActivityDto, SyncDayDto } from '@/activity/dto/sync-activity.dto';
import {
  addDays,
  dailyStreak,
  endOfIsoWeek,
  formatDateOnly,
  groupWeeklyStreak,
  parseDateOnly,
  startOfIsoWeek,
  weeklyStreak,
} from '@/common/utils/dates';
import type {
  GroupMemberStatus,
  GroupStatus,
  SelfDaySlice,
} from '@/realtime/events';
import { RealtimeFanoutService } from '@/realtime/realtime.fanout';

const recentMeasurementTake = 8;

const groupMemberUserSelect = {
  id: true,
  login: true,
  displayName: true,
  weeklyWorkoutGoal: true,
} as const;

type LoadedMember = {
  userId: string;
  joinedAt: Date;
  user: {
    id: string;
    login: string;
    displayName: string;
    weeklyWorkoutGoal: number;
  };
};

type LoadedGroup = {
  id: string;
  name: string;
  createdAt: Date;
  members: LoadedMember[];
};

type MemberDay = {
  userId: string;
  date: Date;
  workedOut: boolean;
};

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeFanoutService))
    private readonly fanout: RealtimeFanoutService,
  ) {}

  async sync(userId: string, dto: SyncActivityDto) {
    for (const day of dto.days) {
      await this.syncDay(userId, day);
    }
    if (dto.days.length > 0) {
      let asOfDate = dto.days[0]?.date ?? '';
      for (const day of dto.days) {
        if (day.date > asOfDate) {
          asOfDate = day.date;
        }
      }
      if (asOfDate) {
        await this.fanout.onActivityChanged(userId, asOfDate);
      }
    }
    return { synced: dto.days.length };
  }

  async groupsForUser(
    userId: string,
    todayValue: string,
  ): Promise<GroupStatus[]> {
    const today = parseDateOnly(todayValue);
    const weekStart = startOfIsoWeek(today);
    const weekEnd = endOfIsoWeek(today);
    const historyStart = addDays(weekStart, -7 * 80);

    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: { select: groupMemberUserSelect },
              },
            },
          },
        },
      },
    });

    const groups = memberships.map((membership) => membership.group);
    const memberDays = await this.loadMemberDays(groups, historyStart, today);
    return groups.map((group) =>
      this.mapGroup(group, memberDays, todayValue, today, weekStart, weekEnd),
    );
  }

  async groupById(
    groupId: string,
    todayValue: string,
  ): Promise<GroupStatus | null> {
    const today = parseDateOnly(todayValue);
    const weekStart = startOfIsoWeek(today);
    const weekEnd = endOfIsoWeek(today);
    const historyStart = addDays(weekStart, -7 * 80);

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: groupMemberUserSelect },
          },
        },
      },
    });
    if (!group) {
      return null;
    }

    const memberDays = await this.loadMemberDays([group], historyStart, today);
    return this.mapGroup(
      group,
      memberDays,
      todayValue,
      today,
      weekStart,
      weekEnd,
    );
  }

  async selfDay(userId: string, todayValue: string): Promise<SelfDaySlice> {
    const slice = await this.personalSlice(userId, todayValue);
    return {
      today: slice.today,
      week: slice.week,
      streak: slice.streak,
    };
  }

  async dashboard(userId: string, todayValue: string) {
    const [slice, groups, recentMeasurements, invitations] = await Promise.all([
      this.personalSlice(userId, todayValue),
      this.groupsForUser(userId, todayValue),
      this.prisma.measurement.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: recentMeasurementTake,
      }),
      this.prisma.groupInvitation.findMany({
        where: { toUserId: userId, status: 'pending' },
        include: {
          group: { select: { id: true, name: true } },
          fromUser: { select: { id: true, login: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      user: {
        id: slice.user.id,
        login: slice.user.login,
        displayName: slice.user.displayName,
        language: slice.user.language,
        weeklyWorkoutGoal: slice.user.weeklyWorkoutGoal,
      },
      today: slice.today,
      week: slice.week,
      streak: slice.streak,
      recentMeasurements: recentMeasurements.map((item) => ({
        id: item.id,
        type: item.type,
        value: Number(item.value),
        unit: item.unit,
        timestamp: item.timestamp.toISOString(),
        source: item.source,
        externalId: item.externalId,
      })),
      activityDays: slice.days.map((day) => ({
        date: formatDateOnly(day.date),
        workedOut: day.workedOut,
        workoutMinutes: day.workoutMinutes ?? 0,
        steps: day.steps ?? null,
        activeCalories: day.activeCalories ?? null,
        weight: day.weight ? Number(day.weight) : null,
        bodyFat: day.bodyFat ? Number(day.bodyFat) : null,
      })),
      groups,
      pendingInvitations: invitations.map((invite) => ({
        id: invite.id,
        group: invite.group,
        fromUser: invite.fromUser,
        createdAt: invite.createdAt.toISOString(),
      })),
    };
  }

  private async personalSlice(userId: string, todayValue: string) {
    const today = parseDateOnly(todayValue);
    const weekStart = startOfIsoWeek(today);
    const weekEnd = endOfIsoWeek(today);
    const historyStart = addDays(weekStart, -7 * 80);

    const [user, days] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.prisma.dailyActivity.findMany({
        where: { userId, date: { gte: historyStart, lte: today } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const qualifyingDays = days.map((day) => ({
      date: day.date,
      workedOut: day.workedOut,
    }));
    const todayRow = days.find(
      (day) => formatDateOnly(day.date) === todayValue,
    );
    const weekDays = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(weekStart, i);
      const key = formatDateOnly(date);
      const row = days.find((day) => formatDateOnly(day.date) === key);
      weekDays.push({
        date: key,
        workedOut: row?.workedOut ?? false,
      });
    }
    const qualifyingThisWeek = weekDays.filter((day) => day.workedOut).length;

    return {
      user,
      days,
      today: {
        date: todayValue,
        workedOut: todayRow?.workedOut ?? false,
        workoutMinutes: todayRow?.workoutMinutes ?? 0,
        steps: todayRow?.steps ?? null,
        activeCalories: todayRow?.activeCalories ?? null,
        weight: todayRow?.weight ? Number(todayRow.weight) : null,
        bodyFat: todayRow?.bodyFat ? Number(todayRow.bodyFat) : null,
      },
      week: {
        start: formatDateOnly(weekStart),
        end: formatDateOnly(weekEnd),
        qualifyingDays: qualifyingThisWeek,
        target: user.weeklyWorkoutGoal,
        days: weekDays,
      },
      streak: {
        weekly: weeklyStreak(qualifyingDays, user.weeklyWorkoutGoal, today),
        daily: dailyStreak(qualifyingDays, today),
      },
    };
  }

  private async loadMemberDays(
    groups: LoadedGroup[],
    historyStart: Date,
    today: Date,
  ): Promise<MemberDay[]> {
    const memberIds = [
      ...new Set(
        groups.flatMap((group) => group.members.map((member) => member.userId)),
      ),
    ];
    if (memberIds.length === 0) {
      return [];
    }
    return this.prisma.dailyActivity.findMany({
      where: {
        userId: { in: memberIds },
        date: { gte: historyStart, lte: today },
      },
      select: { userId: true, date: true, workedOut: true },
    });
  }

  private mapGroup(
    group: LoadedGroup,
    memberDays: MemberDay[],
    todayValue: string,
    today: Date,
    weekStart: Date,
    weekEnd: Date,
  ): GroupStatus {
    const weekStartKey = formatDateOnly(weekStart);
    const weekEndKey = formatDateOnly(weekEnd);
    const memberStates = group.members.map((member) => {
      const days = memberDays
        .filter((day) => day.userId === member.userId)
        .map((day) => ({ date: day.date, workedOut: day.workedOut }));
      const todayWorkedOut =
        days.find((day) => formatDateOnly(day.date) === todayValue)
          ?.workedOut ?? false;
      const weekQualifying = days.filter((day) => {
        const key = formatDateOnly(day.date);
        return day.workedOut && key >= weekStartKey && key <= weekEndKey;
      }).length;
      const status: GroupMemberStatus = {
        userId: member.user.id,
        login: member.user.login,
        displayName: member.user.displayName,
        todayWorkedOut,
        weekQualifying,
        weekTarget: member.user.weeklyWorkoutGoal,
        weeklyStreak: weeklyStreak(days, member.user.weeklyWorkoutGoal, today),
      };
      return {
        days,
        weeklyGoal: member.user.weeklyWorkoutGoal,
        joinedAt: member.joinedAt,
        status,
      };
    });
    const togetherSince = memberStates.reduce(
      (latest, member) => (member.joinedAt > latest ? member.joinedAt : latest),
      group.createdAt,
    );
    return {
      id: group.id,
      name: group.name,
      groupStreak: groupWeeklyStreak(
        memberStates.map((member) => ({
          days: member.days,
          weeklyGoal: member.weeklyGoal,
        })),
        today,
        togetherSince,
      ),
      members: memberStates.map((member) => member.status),
    };
  }

  private async syncDay(userId: string, day: SyncDayDto) {
    const date = parseDateOnly(day.date);

    await this.prisma.$transaction(async (tx) => {
      for (const session of day.sessions ?? []) {
        await tx.workout.upsert({
          where: {
            userId_source_externalId: {
              userId,
              source: 'health_connect',
              externalId: session.externalId,
            },
          },
          create: {
            userId,
            date,
            durationMinutes: session.durationMinutes,
            source: 'health_connect',
            externalId: session.externalId,
            qualifies: session.qualifies ?? true,
          },
          update: {
            date,
            durationMinutes: session.durationMinutes,
            qualifies: session.qualifies ?? true,
          },
        });
      }

      const qualifying = await tx.workout.findMany({
        where: { userId, date, qualifies: true },
        select: { durationMinutes: true, source: true },
      });
      const workoutMinutes =
        day.workoutMinutes ??
        qualifying.reduce(
          (sum, workout) => sum + (workout.durationMinutes ?? 0),
          0,
        );

      const existing = await tx.dailyActivity.findUnique({
        where: { userId_date: { userId, date } },
      });

      const data: Prisma.DailyActivityUncheckedCreateInput = {
        userId,
        date,
        workedOut: qualifying.length > 0 || (existing?.workedOut ?? false),
        workoutCount: qualifying.length,
        workoutMinutes,
        steps: day.steps ?? existing?.steps ?? null,
        activeCalories: day.activeCalories ?? existing?.activeCalories ?? null,
        weight:
          day.weight !== undefined
            ? day.weight
            : existing?.weight !== undefined
              ? existing.weight
              : null,
        bodyFat:
          day.bodyFat !== undefined
            ? day.bodyFat
            : existing?.bodyFat !== undefined
              ? existing.bodyFat
              : null,
        syncedAt: new Date(),
      };

      await tx.dailyActivity.upsert({
        where: { userId_date: { userId, date } },
        create: data,
        update: {
          workedOut: data.workedOut,
          workoutCount: data.workoutCount,
          workoutMinutes: data.workoutMinutes,
          steps: data.steps,
          activeCalories: data.activeCalories,
          weight: data.weight,
          bodyFat: data.bodyFat,
          syncedAt: data.syncedAt,
        },
      });
    });
  }
}
