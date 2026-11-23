import {
  BankingAssistantCard,
  DevicePushCard,
  DividendAutomationCard,
  EmailDigestPrefsCard,
  RemindersCard,
} from "./notifications";

/**
 * Aba "Notificações & Automações" em Configurações (§3.10).
 *
 * Estruturada em 5 blocos claros e sem duplicidade:
 * 1. Central de Notificações (No App) — antecedência e filtros por categoria
 * 2. Notificações no Dispositivo — push local, push remoto VAPID, fechamento diário, horário silencioso e teste
 * 3. Proventos Automatizados (Carteira) — modo de liquidação, Caixa e alertas
 * 4. Assistente Passivo de Compras & Bancos (Android Nativo / Vitrine Android Web)
 * 5. E-mails e Resumos — essenciais + Resumo Semanal de Domingo (opt-in, padrão desativado)
 */
export function NotificationsTab() {
  return (
    <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
      <RemindersCard />
      <DevicePushCard />
      <DividendAutomationCard />
      <BankingAssistantCard />
      <EmailDigestPrefsCard />
    </div>
  );
}
