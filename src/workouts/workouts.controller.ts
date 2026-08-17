import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '@/common/decorators/current-user.decorator';
import { addDays, formatDateOnly, parseDateOnly } from '@/common/utils/dates';
import { CreateManualWorkoutDto } from '@/workouts/dto/create-manual-workout.dto';
import { WorkoutsService } from '@/workouts/workouts.service';

@Controller('workouts')
@UseGuards(JwtAuthGuard)
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Post('manual')
  markManual(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateManualWorkoutDto,
  ) {
    return this.workouts.markManual(user.id, dto);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const toDate = to ?? formatDateOnly(new Date());
    const fromDate =
      from ?? formatDateOnly(addDays(parseDateOnly(toDate), -42));
    return this.workouts.list(user.id, fromDate, toDate);
  }
}
