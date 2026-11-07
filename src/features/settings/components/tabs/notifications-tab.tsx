import { RemindersCard, BankingAssistantCard } from "./notifications";
import { QuickShortcutsCard } from "./quick-shortcuts-card";

/**
 * Aba "Notificações & Automações" em Configurações.
 *
 * Centraliza os canais de notificação e automações passivas:
 * 1. Lembretes de Vencimento de Contas (faturas e dívidas) e Fechamento Diário
 * 2. Assistente Passivo de Compras & Notificações Bancárias (Android nativo / Vitrine Web)
 * 3. Entrada Rápida Universal (iOS Shortcuts & Webhook Seguro com token SHA-256)
 */
export function NotificationsTab() {
  return (
    <div className="space-y-6">
      <RemindersCard />
      <BankingAssistantCard />
      <QuickShortcutsCard />
    </div>
  );
}

