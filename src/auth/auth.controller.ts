import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from '@/auth/auth.service';
import { EnterDto } from '@/auth/dto/enter.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('enter')
  enter(@Body() dto: EnterDto) {
    return this.auth.enter(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() current: { id: string }) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: current.id },
    });
    return this.auth.toPublic(user);
  }
}
