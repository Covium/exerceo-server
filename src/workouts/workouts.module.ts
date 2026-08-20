import { Module } from '@nestjs/common';
import { RealtimeModule } from '@/realtime/realtime.module';
import { WorkoutsController } from '@/workouts/workouts.controller';
import { WorkoutsService } from '@/workouts/workouts.service';

@Module({
  imports: [RealtimeModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
