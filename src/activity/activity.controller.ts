import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '@/common/decorators/current-user.decorator';
import { formatDateOnly } from '@/common/utils/dates';
import { ActivityService } from '@/activity/activity.service';
import { SyncActivityDto } from '@/activity/dto/sync-activity.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: RequestUser, @Query('today') today?: string) {
    const date = today ?? formatDateOnly(new Date());
    return this.activity.dashboard(user.id, date);
  }

  @Put('activity/sync')
  sync(@CurrentUser() user: RequestUser, @Body() dto: SyncActivityDto) {
    return this.activity.sync(user.id, dto);
  }
}
