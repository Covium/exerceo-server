import { Module, forwardRef } from '@nestjs/common';
import { ActivityController } from '@/activity/activity.controller';
import { ActivityService } from '@/activity/activity.service';
import { RealtimeModule } from '@/realtime/realtime.module';

@Module({
  imports: [forwardRef(() => RealtimeModule)],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
