import type { TripExpense, TripMember } from "@/types/trips";
import { TripMemberStatementModal } from "./trip-member-statement-modal";

export interface TripMemberStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TripMember | null;
  members: readonly TripMember[];
  expenses: readonly TripExpense[];
}

export function TripMemberStatementDialog({
  open,
  onOpenChange,
  member,
  members,
  expenses,
}: TripMemberStatementDialogProps) {
  return (
    <TripMemberStatementModal
      open={open}
      onOpenChange={onOpenChange}
      member={member}
      members={members}
      expenses={expenses}
      size="lg"
    />
  );
}
