import { formatCentsAsBRL } from "@/services/masks/money";
import { getPublicAppUrl } from "@/services/app-url";
import type { PublicTripLedgerData, SuggestedSettlement } from "@/types/trips";

export function buildTripWhatsAppShareUrl(
  trip: PublicTripLedgerData["trip"],
  totalExpensesCents: number,
  suggestedSettlements: readonly SuggestedSettlement[],
): string {
  let message = `*Resumo da Viagem: ${trip.title}*\n`;
  if (trip.destination) message += `Destino: ${trip.destination}\n`;
  message += `Total gasto pelo grupo: ${formatCentsAsBRL(totalExpensesCents)}\n\n`;

  if (suggestedSettlements.length > 0) {
    message += `*Acerto de Contas (Quem paga para quem):*\n`;
    suggestedSettlements.forEach((s) => {
      message += `- ${s.fromMemberName} transfere ${formatCentsAsBRL(s.amountCents)} para ${s.toMemberName}`;
      if (s.toPixKey) message += ` (Pix: ${s.toPixKey})`;
      message += `\n`;
    });
  } else {
    message += `Todas as despesas estão balanceadas!\n`;
  }

  message += `\nVer extrato completo: ${getPublicAppUrl(`viagem/${trip.public_token}`)}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}
