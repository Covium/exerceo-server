import { Module } from '@nestjs/common';
import { GroupsController } from '@/groups/groups.controller';
import { GroupsService } from '@/groups/groups.service';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
