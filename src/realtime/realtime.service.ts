import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { formatDateOnly } from '@/common/utils/dates';
import { DATE_ONLY, groupRoom, userRoom } from '@/realtime/rooms';
import type { AuthedSocket } from '@/realtime/socket-types';
import type { RealtimeEvent } from '@/realtime/events';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attach(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: RealtimeEvent): void {
    this.server?.to(userRoom(userId)).emit('sync', event);
  }

  emitToGroup(groupId: string, event: RealtimeEvent): void {
    this.server?.to(groupRoom(groupId)).emit('sync', event);
  }

  async joinUserToGroup(userId: string, groupId: string): Promise<void> {
    if (!this.server) {
      return;
    }
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    await Promise.all(sockets.map((socket) => socket.join(groupRoom(groupId))));
  }

  async leaveUserFromGroup(userId: string, groupId: string): Promise<void> {
    if (!this.server) {
      return;
    }
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    await Promise.all(
      sockets.map((socket) => socket.leave(groupRoom(groupId))),
    );
  }

  async todayForUser(userId: string): Promise<string> {
    if (!this.server) {
      return formatDateOnly(new Date());
    }
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    for (const socket of sockets) {
      const today = socket.data.today;
      if (typeof today === 'string' && DATE_ONLY.test(today)) {
        return today;
      }
    }
    return formatDateOnly(new Date());
  }

  async bindSocket(
    socket: AuthedSocket,
    userId: string,
    groupIds: string[],
  ): Promise<void> {
    socket.data.userId = userId;
    await socket.join(userRoom(userId));
    await Promise.all(
      groupIds.map((groupId) => socket.join(groupRoom(groupId))),
    );
    this.logger.debug(`socket ${socket.id} joined ${groupIds.length} groups`);
  }
}
