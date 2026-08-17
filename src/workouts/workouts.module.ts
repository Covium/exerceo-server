import { Module } from '@nestjs/common';
import { WorkoutsController } from '@/workouts/workouts.controller';
import { WorkoutsService } from '@/workouts/workouts.service';

@Module({
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
