export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function groupRoom(groupId: string): string {
  return `group:${groupId}`;
}

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
