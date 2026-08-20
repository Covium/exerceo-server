import { Module } from '@nestjs/common';
import { GroupsController } from '@/groups/groups.controller';
import { GroupsService } from '@/groups/groups.service';
import { RealtimeModule } from '@/realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
