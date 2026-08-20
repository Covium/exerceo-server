import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ActivityModule } from '@/activity/activity.module';
import { RealtimeFanoutService } from '@/realtime/realtime.fanout';
import { RealtimeGateway } from '@/realtime/realtime.gateway';
import { RealtimeService } from '@/realtime/realtime.service';

@Module({
  imports: [AuthModule, forwardRef(() => ActivityModule)],
  providers: [RealtimeGateway, RealtimeService, RealtimeFanoutService],
  exports: [RealtimeService, RealtimeFanoutService],
})
export class RealtimeModule {}
