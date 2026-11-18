import type { EmergencySelectionMode } from "@/types";

export const EMERGENCY_SELECTION_MODES: Array<{
  value: EmergencySelectionMode;
  title: string;
  description: string;
}> = [
  {
    value: "selected_assets",
    title: "Ativos Selecionados a Dedo (Recomendado)",
    description: "Escolha exatamente quais ativos compõem sua reserva (ex: Tesouro Selic e CDBs 100% CDI).",
  },
  {
    value: "selected_classes",
    title: "Por Classes Inteiras",
    description: "Considere todos os ativos de determinadas classes (ex: todo o 'Tesouro Direto' ou 'Renda Fixa').",
  },
  {
    value: "entire_portfolio",
    title: "Toda a Carteira de Investimentos",
    description: "Considera o saldo total de todos os ativos investidos na custódia como reserva.",
  },
  {
    value: "auto_cash",
    title: "Apenas Caixa Automático (Legado)",
    description: "Considera somente ativos categorizados estritamente como 'Caixa' ou 'Reserva'.",
  },
];
