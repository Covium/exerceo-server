import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';
import { GroupsModule } from '@/groups/groups.module';
import { WorkoutsModule } from '@/workouts/workouts.module';
import { ActivityModule } from '@/activity/activity.module';
import { MeasurementsModule } from '@/measurements/measurements.module';
import { HealthController } from '@/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    WorkoutsModule,
    ActivityModule,
    MeasurementsModule,
  ],
})
export class AppModule {}
