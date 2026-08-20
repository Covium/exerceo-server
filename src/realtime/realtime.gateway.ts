import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@/prisma/prisma.service';
import { DATE_ONLY } from '@/realtime/rooms';
import { RealtimeService } from '@/realtime/realtime.service';
import type { AuthedSocket } from '@/realtime/socket-types';

type JwtPayload = {
  sub?: unknown;
  login?: unknown;
};

function socketCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void {
  const allowed = process.env.CORS_ORIGIN;
  if (!allowed || allowed === '*') {
    callback(null, true);
    return;
  }
  const list = allowed
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  callback(null, !origin || list.includes(origin));
}

function handshakeToken(socket: Socket): string | null {
  const auth = socket.handshake.auth as { token?: unknown };
  return typeof auth.token === 'string' ? auth.token : null;
}

@WebSocketGateway({
  path: '/socket.io',
  transports: ['websocket'],
  cors: {
    origin: socketCorsOrigin,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
  }

  async handleConnection(socket: Socket): Promise<void> {
    const token = handshakeToken(socket);
    if (!token) {
      socket.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      socket.disconnect(true);
      return;
    }

    if (typeof payload.sub !== 'string' || typeof payload.login !== 'string') {
      socket.disconnect(true);
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, login: true },
    });
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const memberships = await this.prisma.groupMember.findMany({
      where: { userId: user.id },
      select: { groupId: true },
    });

    const authed = socket as AuthedSocket;
    authed.data.userId = user.id;
    authed.data.login = user.login;
    await this.realtime.bindSocket(
      authed,
      user.id,
      memberships.map((membership) => membership.groupId),
    );
    this.logger.debug(`connected ${user.login} (${socket.id})`);
  }

  @SubscribeMessage('hello')
  handleHello(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: unknown,
  ): void {
    if (!body || typeof body !== 'object' || !('today' in body)) {
      return;
    }
    const today = body.today;
    if (typeof today !== 'string' || !DATE_ONLY.test(today)) {
      return;
    }
    socket.data.today = today;
  }
}
