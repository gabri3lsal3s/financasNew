import type { PublicTripExpense, PublicTripMember } from "@/types/trips";
import { TripMemberStatementModal } from "@/features/trips/components/trip-member-statement-modal";

export interface PublicTripMemberStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: PublicTripMember | null;
  members: readonly PublicTripMember[];
  expenses: readonly PublicTripExpense[];
}

export function PublicTripMemberStatementDialog({
  open,
  onOpenChange,
  member,
  members,
  expenses,
}: PublicTripMemberStatementDialogProps) {
  return (
    <TripMemberStatementModal
      open={open}
      onOpenChange={onOpenChange}
      member={member}
      members={members}
      expenses={expenses}
      size="xl"
      description="Discriminação detalhada de participações, cotas devidas e justificativas de despesas da viagem."
      owedLabel="Sua Cota"
      netLabel="Balanço Líquido"
      participationsTitle="Despesas com sua Participação"
      exclusionsSubtitle="Gastos isentos que não foram cobrados de você nesta viagem:"
    />
  );
}
