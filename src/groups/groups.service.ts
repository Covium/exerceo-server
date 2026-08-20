import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateGroupDto, InviteDto } from '@/groups/dto/group.dto';
import { RealtimeFanoutService } from '@/realtime/realtime.fanout';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fanout: RealtimeFanoutService,
  ) {}

  async create(userId: string, dto: CreateGroupDto) {
    const group = await this.prisma.group.create({
      data: {
        name: dto.name.trim(),
        members: {
          create: { userId, role: 'owner' },
        },
      },
    });
    await this.fanout.onGroupCreated(userId, group.id);
    return group;
  }

  list(userId: string) {
    return this.prisma.group.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, login: true, displayName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(userId: string, groupId: string, dto: InviteDto) {
    const membership = await this.requireMember(userId, groupId);
    if (!membership) {
      throw new ForbiddenException();
    }

    const target = await this.prisma.user.findUnique({
      where: { login: dto.login.trim() },
    });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    if (target.id === userId) {
      throw new BadRequestException('You are already in this group');
    }

    const alreadyMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: target.id } },
    });
    if (alreadyMember) {
      throw new ConflictException('User is already a member');
    }

    const existing = await this.prisma.groupInvitation.findFirst({
      where: { groupId, toUserId: target.id, status: 'pending' },
    });
    if (existing) {
      await this.fanout.onInvitationCreated(existing.id);
      return existing;
    }

    const invitation = await this.prisma.groupInvitation.create({
      data: {
        groupId,
        fromUserId: userId,
        toUserId: target.id,
        status: 'pending',
      },
    });
    await this.fanout.onInvitationCreated(invitation.id);
    return invitation;
  }

  async accept(userId: string, invitationId: string) {
    const invitation = await this.prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.toUserId !== userId) {
      throw new NotFoundException();
    }
    if (invitation.status !== 'pending') {
      throw new ConflictException('Invitation is no longer pending');
    }

    await this.prisma.$transaction([
      this.prisma.groupInvitation.update({
        where: { id: invitationId },
        data: { status: 'accepted' },
      }),
      this.prisma.groupMember.upsert({
        where: {
          groupId_userId: { groupId: invitation.groupId, userId },
        },
        create: { groupId: invitation.groupId, userId, role: 'member' },
        update: {},
      }),
    ]);

    await this.fanout.onInvitationAccepted(
      userId,
      invitationId,
      invitation.groupId,
    );
    return { accepted: true, groupId: invitation.groupId };
  }

  async decline(userId: string, invitationId: string) {
    const invitation = await this.prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.toUserId !== userId) {
      throw new NotFoundException();
    }
    if (invitation.status !== 'pending') {
      throw new ConflictException('Invitation is no longer pending');
    }
    await this.prisma.groupInvitation.update({
      where: { id: invitationId },
      data: { status: 'declined' },
    });
    await this.fanout.onInvitationRemoved(userId, invitationId);
    return { declined: true };
  }

  async leave(userId: string, groupId: string) {
    const membership = await this.requireMember(userId, groupId);
    if (!membership) {
      throw new NotFoundException();
    }

    await this.prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });

    const remaining = await this.prisma.groupMember.count({
      where: { groupId },
    });
    if (remaining === 0) {
      await this.prisma.group.delete({ where: { id: groupId } });
    }

    await this.fanout.onMemberLeft(userId, groupId);
    return { left: true };
  }

  private requireMember(userId: string, groupId: string) {
    return this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
  }
}
