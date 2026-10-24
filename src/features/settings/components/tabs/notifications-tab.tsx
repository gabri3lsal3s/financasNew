import { RemindersCard, BankingAssistantCard } from "./notifications";

/**
 * Aba "Notificações & Automações" em Configurações.
 *
 * Centraliza os canais de notificação e automações passivas:
 * 1. Lembretes de Vencimento de Contas (faturas e dívidas) e Fechamento Diário
 * 2. Assistente Passivo de Compras & Notificações Bancárias (Android nativo / Vitrine Web)
 */
export function NotificationsTab() {
  return (
    <div className="space-y-6">
      <RemindersCard />
      <BankingAssistantCard />
    </div>
  );
}
