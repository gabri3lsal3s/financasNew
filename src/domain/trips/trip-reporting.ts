import { formatCentsAsBRL } from "@/services/masks/money";
import { getPublicAppUrl } from "@/services/app-url";
import type {
  SuggestedSettlement,
  TripSettlement,
  TripMember,
  TripExpense,
} from "@/types/trips";

export interface BuildWhatsAppMessageParams {
  tripTitle: string;
  suggestedSettlements: readonly SuggestedSettlement[];
  existingSettlements: TripSettlement[];
  members?: TripMember[];
  expenses?: TripExpense[];
  publicToken?: string;
  publicUrl?: string;
}

/**
 * Gera texto executivo de prestação de contas formatado para compartilhamento WhatsApp.
 * Em conformidade com o AGENTS.md §4.8, usa formatação ASCII limpa sem emojis decorativos.
 */
export function buildTripSettlementWhatsAppMessage({
  tripTitle,
  suggestedSettlements,
  existingSettlements,
  members,
  expenses,
  publicToken,
  publicUrl,
}: BuildWhatsAppMessageParams): string {
  const resolvedUrl = publicUrl || (publicToken ? getPublicAppUrl(`viagem/${publicToken}`) : undefined);
  let msg = `*Prestacao de Contas - Viagem: ${tripTitle}*\n\n`;

  if (expenses && expenses.length > 0) {
    const totalExpensesCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
    msg += `Total de Gastos Coletivos: ${formatCentsAsBRL(totalExpensesCents)} (${expenses.length} lancamentos)\n`;
  }

  if (members && members.length > 0) {
    msg += `Participantes: ${members.map((m) => m.name).join(", ")}\n`;
  }
  msg += `\n`;

  const confirmedSettlements = existingSettlements.filter((s) => s.status === "confirmed");
  if (confirmedSettlements.length > 0) {
    msg += `*Acertos Ja Realizados:*\n`;
    confirmedSettlements.forEach((s) => {
      const fromName = members?.find((m) => m.id === s.from_member_id)?.name ?? "Membro";
      const toName = members?.find((m) => m.id === s.to_member_id)?.name ?? "Membro";
      msg += `[OK] ${fromName} pagou ${formatCentsAsBRL(s.amount_cents)} para ${toName}\n`;
    });
    msg += `\n`;
  }

  if (suggestedSettlements.length > 0) {
    msg += `*Transferencias Pendentes:*\n`;
    suggestedSettlements.forEach((s) => {
      msg += `- ${s.fromMemberName} transfere ${formatCentsAsBRL(s.amountCents)} para ${s.toMemberName}`;
      if (s.toPixKey) {
        msg += ` (Chave Pix [${s.toPixKeyType ?? "Pix"}]: ${s.toPixKey})`;
      }
      msg += `\n`;
    });
  } else {
    msg += `Todas as contas estao perfeitamente equilibradas e quitadas!\n`;
  }

  if (resolvedUrl) {
    msg += `\nVer extrato e prestacao de contas completa: ${resolvedUrl}\n`;
  }

  return msg;
}
