import { Module } from '@nestjs/common';
import { MeasurementsController } from '@/measurements/measurements.controller';
import { MeasurementsService } from '@/measurements/measurements.service';

@Module({
  controllers: [MeasurementsController],
  providers: [MeasurementsService],
})
export class MeasurementsModule {}
