import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SyncActivityDto, SyncDayDto } from '@/activity/dto/sync-activity.dto';
import {
  addDays,
  dailyStreak,
  endOfIsoWeek,
  formatDateOnly,
  parseDateOnly,
  startOfIsoWeek,
  weeklyStreak,
} from '@/common/utils/dates';

const recentMeasurementTake = 8;

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(userId: string, dto: SyncActivityDto) {
    for (const day of dto.days) {
      await this.syncDay(userId, day);
    }
    return { synced: dto.days.length };
  }

  async dashboard(userId: string, todayValue: string) {
    const today = parseDateOnly(todayValue);
    const weekStart = startOfIsoWeek(today);
    const weekEnd = endOfIsoWeek(today);
    const historyStart = addDays(weekStart, -7 * 80);

    const [user, days, recentMeasurements, memberships, invitations] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        this.prisma.dailyActivity.findMany({
          where: { userId, date: { gte: historyStart, lte: today } },
          orderBy: { date: 'asc' },
        }),
        this.prisma.measurement.findMany({
          where: { userId },
          orderBy: { timestamp: 'desc' },
          take: recentMeasurementTake,
        }),
        this.prisma.groupMember.findMany({
          where: { userId },
          include: {
            group: {
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        login: true,
                        displayName: true,
                        weeklyWorkoutGoal: true,
                      },
                    },
                  },
                },
              },
            },
          },
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

    const memberIds = [
      ...new Set(
        memberships.flatMap((membership) =>
          membership.group.members.map((member) => member.userId),
        ),
      ),
    ];
    const memberDays =
      memberIds.length === 0
        ? []
        : await this.prisma.dailyActivity.findMany({
            where: {
              userId: { in: memberIds },
              date: { gte: historyStart, lte: today },
            },
          });

    const groups = memberships.map((membership) => ({
      id: membership.group.id,
      name: membership.group.name,
      members: membership.group.members.map((member) => {
        const memberHistory = memberDays
          .filter((day) => day.userId === member.userId)
          .map((day) => ({ date: day.date, workedOut: day.workedOut }));
        const todayWorkedOut =
          memberHistory.find((day) => formatDateOnly(day.date) === todayValue)
            ?.workedOut ?? false;
        const weekQualifying = memberHistory.filter((day) => {
          const key = formatDateOnly(day.date);
          return (
            day.workedOut &&
            key >= formatDateOnly(weekStart) &&
            key <= formatDateOnly(weekEnd)
          );
        }).length;
        return {
          userId: member.user.id,
          login: member.user.login,
          displayName: member.user.displayName,
          todayWorkedOut,
          weekQualifying,
          weekTarget: member.user.weeklyWorkoutGoal,
          weeklyStreak: weeklyStreak(
            memberHistory,
            member.user.weeklyWorkoutGoal,
            today,
          ),
        };
      }),
    }));

    return {
      user: {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        language: user.language,
        weeklyWorkoutGoal: user.weeklyWorkoutGoal,
      },
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
      recentMeasurements: recentMeasurements.map((item) => ({
        id: item.id,
        type: item.type,
        value: Number(item.value),
        unit: item.unit,
        timestamp: item.timestamp.toISOString(),
        source: item.source,
        externalId: item.externalId,
      })),
      activityDays: days.map((day) => ({
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
