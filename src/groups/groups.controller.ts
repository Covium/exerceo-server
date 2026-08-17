import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '@/common/decorators/current-user.decorator';
import { CreateGroupDto, InviteDto } from '@/groups/dto/group.dto';
import { GroupsService } from '@/groups/groups.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post('groups')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user.id, dto);
  }

  @Get('groups')
  list(@CurrentUser() user: RequestUser) {
    return this.groups.list(user.id);
  }

  @Post('groups/:id/invite')
  invite(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: InviteDto,
  ) {
    return this.groups.invite(user.id, id, dto);
  }

  @Post('invitations/:id/accept')
  accept(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.groups.accept(user.id, id);
  }

  @Post('invitations/:id/decline')
  decline(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.groups.decline(user.id, id);
  }

  @Delete('groups/:id/leave')
  leave(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.groups.leave(user.id, id);
  }
}
