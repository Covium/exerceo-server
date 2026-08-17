import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { EnterDto } from '@/auth/dto/enter.dto';

const PASSWORD_ROUNDS = 12;

export type PublicUser = {
  id: string;
  login: string;
  displayName: string;
  language: string;
  weeklyWorkoutGoal: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async enter(dto: EnterDto) {
    const login = dto.login.trim();
    const existing = await this.prisma.user.findUnique({ where: { login } });

    if (existing) {
      const matches = await bcrypt.compare(dto.password, existing.passwordHash);
      if (!matches) {
        throw new UnauthorizedException('Invalid login or password');
      }
      return this.issue(existing);
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          login,
          passwordHash: await bcrypt.hash(dto.password, PASSWORD_ROUNDS),
          displayName: dto.displayName?.trim() || login,
          language: dto.language ?? 'en',
        },
      });
      return this.issue(created);
    } catch {
      throw new ConflictException('Login is already taken');
    }
  }

  toPublic(user: {
    id: string;
    login: string;
    displayName: string;
    language: string;
    weeklyWorkoutGoal: number;
  }): PublicUser {
    return {
      id: user.id,
      login: user.login,
      displayName: user.displayName,
      language: user.language,
      weeklyWorkoutGoal: user.weeklyWorkoutGoal,
    };
  }

  private issue(user: {
    id: string;
    login: string;
    displayName: string;
    language: string;
    weeklyWorkoutGoal: number;
  }) {
    const accessToken = this.jwt.sign({ sub: user.id, login: user.login });
    return {
      accessToken,
      user: this.toPublic(user),
    };
  }
}
