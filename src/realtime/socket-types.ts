import type { DefaultEventsMap, Socket } from 'socket.io';

export type SocketData = {
  userId: string;
  login: string;
  today?: string;
};

export type AuthedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
