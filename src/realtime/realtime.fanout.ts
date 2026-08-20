import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ActivityService } from '@/activity/activity.service';
import { RealtimeService } from '@/realtime/realtime.service';
import type { PendingInvitation } from '@/realtime/events';

@Injectable()
export class RealtimeFanoutService {
  private readonly logger = new Logger(RealtimeFanoutService.name);

  constructor(
    private readonly realtime: RealtimeService,
    @Inject(forwardRef(() => ActivityService))
    private readonly activity: ActivityService,
    private readonly prisma: PrismaService,
  ) {}

  async onActivityChanged(userId: string, date: string): Promise<void> {
    await this.safe('onActivityChanged', async () => {
      const groups = await this.activity.groupsForUser(userId, date);
      for (const group of groups) {
        const member = group.members.find((row) => row.userId === userId);
        if (!member) {
          continue;
        }
        this.realtime.emitToGroup(group.id, {
          type: 'group.member',
          asOfDate: date,
          groupId: group.id,
          groupStreak: group.groupStreak,
          member,
        });
      }
      const self = await this.activity.selfDay(userId, date);
      this.realtime.emitToUser(userId, {
        type: 'self.day',
        asOfDate: date,
        ...self,
      });
    });
  }

  async onInvitationCreated(invitationId: string): Promise<void> {
    await this.safe('onInvitationCreated', async () => {
      const invitation = await this.loadPendingInvitation(invitationId);
      if (!invitation) {
        return;
      }
      this.realtime.emitToUser(invitation.toUserId, {
        type: 'invitation.created',
        invitation: invitation.payload,
      });
    });
  }

  async onInvitationRemoved(
    userId: string,
    invitationId: string,
  ): Promise<void> {
    await this.safe('onInvitationRemoved', async () => {
      this.realtime.emitToUser(userId, {
        type: 'invitation.removed',
        invitationId,
      });
    });
  }

  async onGroupCreated(userId: string, groupId: string): Promise<void> {
    await this.safe('onGroupCreated', async () => {
      const asOfDate = await this.realtime.todayForUser(userId);
      await this.realtime.joinUserToGroup(userId, groupId);
      const group = await this.activity.groupById(groupId, asOfDate);
      if (!group) {
        return;
      }
      this.realtime.emitToUser(userId, {
        type: 'group.snapshot',
        asOfDate,
        group,
      });
    });
  }

  async onInvitationAccepted(
    userId: string,
    invitationId: string,
    groupId: string,
  ): Promise<void> {
    await this.safe('onInvitationAccepted', async () => {
      const asOfDate = await this.realtime.todayForUser(userId);
      await this.realtime.joinUserToGroup(userId, groupId);
      this.realtime.emitToUser(userId, {
        type: 'invitation.removed',
        invitationId,
      });
      const group = await this.activity.groupById(groupId, asOfDate);
      if (!group) {
        return;
      }
      this.realtime.emitToGroup(groupId, {
        type: 'group.snapshot',
        asOfDate,
        group,
      });
    });
  }

  async onMemberLeft(userId: string, groupId: string): Promise<void> {
    await this.safe('onMemberLeft', async () => {
      const asOfDate = await this.realtime.todayForUser(userId);
      await this.realtime.leaveUserFromGroup(userId, groupId);
      this.realtime.emitToUser(userId, {
        type: 'group.removed',
        groupId,
      });
      const group = await this.activity.groupById(groupId, asOfDate);
      this.realtime.emitToGroup(groupId, {
        type: 'member.left',
        groupId,
        userId,
        asOfDate,
        group,
      });
    });
  }

  async onProfileChanged(userId: string): Promise<void> {
    await this.safe('onProfileChanged', async () => {
      const asOfDate = await this.realtime.todayForUser(userId);
      await this.onActivityChanged(userId, asOfDate);
    });
  }

  private async loadPendingInvitation(invitationId: string): Promise<{
    toUserId: string;
    payload: PendingInvitation;
  } | null> {
    const invitation = await this.prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: {
        group: { select: { id: true, name: true } },
        fromUser: { select: { id: true, login: true, displayName: true } },
      },
    });
    if (!invitation) {
      return null;
    }
    return {
      toUserId: invitation.toUserId,
      payload: {
        id: invitation.id,
        group: invitation.group,
        fromUser: invitation.fromUser,
        createdAt: invitation.createdAt.toISOString(),
      },
    };
  }

  private async safe(label: string, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (cause) {
      this.logger.error(
        `${label} failed`,
        cause instanceof Error ? cause.stack : String(cause),
      );
    }
  }
}
