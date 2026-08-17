import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMeasurementDto } from '@/measurements/dto/create-measurement.dto';
import { parseDateOnly } from '@/common/utils/dates';

@Injectable()
export class MeasurementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMeasurementDto) {
    const source = dto.source ?? 'manual';
    const externalId = dto.externalId ?? `manual:${randomUUID()}`;
    const timestamp = new Date(dto.timestamp);
    const measurement = await this.prisma.measurement.upsert({
      where: {
        userId_source_externalId: {
          userId,
          source,
          externalId,
        },
      },
      create: {
        userId,
        type: dto.type,
        value: dto.value,
        unit: dto.unit,
        timestamp,
        source,
        externalId,
      },
      update: {
        type: dto.type,
        value: dto.value,
        unit: dto.unit,
        timestamp,
      },
    });

    if (dto.type === 'weight' || dto.type === 'body_fat') {
      const date = parseDateOnly(timestamp.toISOString().slice(0, 10));
      await this.prisma.dailyActivity.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
          date,
          weight: dto.type === 'weight' ? dto.value : undefined,
          bodyFat: dto.type === 'body_fat' ? dto.value : undefined,
        },
        update: {
          weight: dto.type === 'weight' ? dto.value : undefined,
          bodyFat: dto.type === 'body_fat' ? dto.value : undefined,
        },
      });
    }

    return this.toPublic(measurement);
  }

  async list(userId: string, type?: string, from?: string, to?: string) {
    const items = await this.prisma.measurement.findMany({
      where: {
        userId,
        type: type || undefined,
        timestamp: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { timestamp: 'asc' },
    });
    return items.map((item) => this.toPublic(item));
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.measurement.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException();
    }
    await this.prisma.measurement.delete({ where: { id } });
    return { id };
  }

  private toPublic(item: {
    id: string;
    type: string;
    value: { toNumber(): number } | number;
    unit: string;
    timestamp: Date;
    source: string;
    externalId: string;
  }) {
    return {
      id: item.id,
      type: item.type,
      value:
        typeof item.value === 'number' ? item.value : item.value.toNumber(),
      unit: item.unit,
      timestamp: item.timestamp.toISOString(),
      source: item.source,
      externalId: item.externalId,
    };
  }
}
