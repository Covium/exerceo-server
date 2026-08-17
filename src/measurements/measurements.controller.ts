import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '@/common/decorators/current-user.decorator';
import { CreateMeasurementDto } from '@/measurements/dto/create-measurement.dto';
import { MeasurementsService } from '@/measurements/measurements.service';

@Controller('measurements')
@UseGuards(JwtAuthGuard)
export class MeasurementsController {
  constructor(private readonly measurements: MeasurementsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateMeasurementDto) {
    return this.measurements.create(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.measurements.list(user.id, type, from, to);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.measurements.remove(user.id, id);
  }
}
