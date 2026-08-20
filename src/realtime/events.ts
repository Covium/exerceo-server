export type GroupMemberStatus = {
  userId: string;
  login: string;
  displayName: string;
  todayWorkedOut: boolean;
  weekQualifying: number;
  weekTarget: number;
  weeklyStreak: number;
};

export type GroupStatus = {
  id: string;
  name: string;
  groupStreak: number;
  members: GroupMemberStatus[];
};

export type PendingInvitation = {
  id: string;
  group: { id: string; name: string };
  fromUser: { id: string; login: string; displayName: string };
  createdAt: string;
};

export type SelfDaySlice = {
  today: {
    date: string;
    workedOut: boolean;
    workoutMinutes: number;
    steps: number | null;
    activeCalories: number | null;
    weight: number | null;
    bodyFat: number | null;
  };
  week: {
    start: string;
    end: string;
    qualifyingDays: number;
    target: number;
    days: { date: string; workedOut: boolean }[];
  };
  streak: {
    weekly: number;
    daily: number;
  };
};

export type RealtimeEvent =
  | {
      type: 'group.member';
      asOfDate: string;
      groupId: string;
      groupStreak: number;
      member: GroupMemberStatus;
    }
  | {
      type: 'group.snapshot';
      asOfDate: string;
      group: GroupStatus;
    }
  | {
      type: 'group.removed';
      groupId: string;
    }
  | {
      type: 'member.left';
      groupId: string;
      userId: string;
      asOfDate: string;
      group: GroupStatus | null;
    }
  | {
      type: 'invitation.created';
      invitation: PendingInvitation;
    }
  | {
      type: 'invitation.removed';
      invitationId: string;
    }
  | ({
      type: 'self.day';
      asOfDate: string;
    } & SelfDaySlice);
