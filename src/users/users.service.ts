import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { AuthService } from '@/auth/auth.service';
import { RealtimeFanoutService } from '@/realtime/realtime.fanout';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly fanout: RealtimeFanoutService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException();
    }
    return this.auth.toPublic(user);
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName?.trim(),
        language: dto.language,
        weeklyWorkoutGoal: dto.weeklyWorkoutGoal,
      },
    });
    if (dto.displayName !== undefined || dto.weeklyWorkoutGoal !== undefined) {
      await this.fanout.onProfileChanged(userId);
    }
    return this.auth.toPublic(user);
  }

  async search(query: string, excludeUserId: string) {
    const login = query.trim();
    if (login.length < 2) {
      return [];
    }
    return this.prisma.user.findMany({
      where: {
        login: { contains: login, mode: 'insensitive' },
        id: { not: excludeUserId },
      },
      select: {
        id: true,
        login: true,
        displayName: true,
      },
      take: 8,
    });
  }
}
