import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateManualWorkoutDto } from '@/workouts/dto/create-manual-workout.dto';
import { parseDateOnly } from '@/common/utils/dates';
import { RealtimeFanoutService } from '@/realtime/realtime.fanout';

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fanout: RealtimeFanoutService,
  ) {}

  async markManual(userId: string, dto: CreateManualWorkoutDto) {
    const date = parseDateOnly(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    const externalId = `manual:${dto.date}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.workout.upsert({
        where: {
          userId_source_externalId: {
            userId,
            source: 'manual',
            externalId,
          },
        },
        create: {
          userId,
          date,
          durationMinutes: dto.durationMinutes,
          source: 'manual',
          externalId,
          qualifies: true,
        },
        update: {
          durationMinutes: dto.durationMinutes ?? undefined,
          qualifies: true,
        },
      });

      const qualifying = await tx.workout.findMany({
        where: { userId, date, qualifies: true },
        select: { durationMinutes: true },
      });

      const workoutMinutes = qualifying.reduce(
        (sum, workout) => sum + (workout.durationMinutes ?? 0),
        0,
      );

      await tx.dailyActivity.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
          date,
          workedOut: true,
          workoutCount: qualifying.length,
          workoutMinutes,
        },
        update: {
          workedOut: true,
          workoutCount: qualifying.length,
          workoutMinutes,
        },
      });
    });

    await this.fanout.onActivityChanged(userId, dto.date);
    return { date: dto.date, workedOut: true };
  }

  list(userId: string, from: string, to: string) {
    return this.prisma.workout.findMany({
      where: {
        userId,
        date: {
          gte: parseDateOnly(from),
          lte: parseDateOnly(to),
        },
      },
      orderBy: { date: 'desc' },
    });
  }
}
