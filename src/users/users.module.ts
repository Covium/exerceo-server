import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { RealtimeModule } from '@/realtime/realtime.module';
import { UsersController } from '@/users/users.controller';
import { UsersService } from '@/users/users.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
