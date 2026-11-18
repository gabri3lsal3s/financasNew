import type { Debt, PublicShare, SplitParticipantItem, SplitSharePayload } from "@/types";

export interface ActiveSplitItem {
  id: string;
  share: PublicShare | null;
  payload: SplitSharePayload;
  linkedDebt: Debt | null;
  dueDate: string | null;
  createdAt: string;
  isSettled: boolean;
  isCompleted: boolean;
  totalCents: number;
  guestShareCents: number;
  hostShareCents: number;
  peopleCount: number;
  guestCount: number;
  receivableExpectedCents: number;
  settledFriendsCount: number;
  signaledFriends: SplitParticipantItem[];
  totalSettledFromFriendsCents: number;
  date: string;
  needsLinkGeneration: boolean;
}

export interface GeneratingShareTarget {
  id: string;
  totalCents: number;
  receivableExpectedCents: number;
  peopleCount: number;
  date: string;
  payload: SplitSharePayload;
  linkedDebt: Debt | null;
}

export interface ManagingSplitTarget {
  share: PublicShare;
  linkedDebt: Debt | null;
}
