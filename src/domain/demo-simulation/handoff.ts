import type { AnyTourTrackId } from "./types";

/**
 * Parâmetros de busca (query params) que disparam abertura de modais ou assistentes guiados.
 * Devem ser expurgados ao encerrar micro-tours para garantir navegação desobstruída e limpa.
 */
export const INVASIVE_QUERY_PARAMS = [
  "novo",
  "modo",
  "forma",
  "valor",
  "descricao",
  "data",
  "cartao",
  "parcelas",
  "categoria",
  "sug_id",
] as const;

/**
 * Remove parâmetros de busca invasivos que disparam modais ou assistentes de cadastro,
 * preservando parâmetros legítimos de visualização e abas (ex.: tab, month, card).
 */
export function cleanPathWithoutInvasiveParams(currentPath?: string): string {
  if (!currentPath || currentPath.trim() === "") {
    return "/";
  }

  const trimmed = currentPath.trim();

  try {
    const url = new URL(trimmed, "https://app.local");
    const params = new URLSearchParams(url.search);

    for (const key of INVASIVE_QUERY_PARAMS) {
      params.delete(key);
    }

    const search = params.toString();
    const pathname = url.pathname || "/";
    return search ? `${pathname}?${search}` : pathname;
  } catch {
    const [pathPart] = trimmed.split("?");
    return pathPart || "/";
  }
}

/**
 * Identifica se a trilha informada corresponde a um Tour Completo / Jornada Consolidada.
 */
export function isCompleteTourTrack(
  track: AnyTourTrackId | string | null | undefined,
): boolean {
  if (!track) return false;
  return (
    track === "finances" ||
    track === "investments" ||
    track === "settings" ||
    track === "settings_support" ||
    track === "shared_finances"
  );
}

/**
 * Determina o destino de navegação e hand-off contextual quando o usuário
 * conclui uma trilha do tour ou encerra a simulação para iniciar sua conta real.
 *
 * Governança Contextual (Fase 8 — Tarefa 8.9):
 * 1. Regra de Ouro: Modais de Ação Apenas nos Tours Completos (Zero Interrupção em Micro-Tours):
 *    - Tour Completo de Finanças Diárias ("finances"):
 *      Direciona para "/?novo=despesa", abrindo sobre o Dashboard o modal central
 *      LaunchWizard (inserção guiada do 1º lançamento de despesa/renda para iniciar a conta real).
 *    - Tour Completo de Finanças Compartilhadas ("shared_finances"):
 *      Direciona para "/familia", abrindo o painel compartilhado para iniciar a colaboração.
 *    - Tour Completo de Investimentos & Rebalanceamento ("investments"):
 *      Direciona para "/investments?novo=investimento", abrindo o modal de inserção de operação
 *      para cadastrar o primeiro ativo patrimonial.
 *    - Tour Completo de Configurações, Visual e Suporte ("settings" ou "settings_support"):
 *      Direciona para "/configuracoes?tab=suporte", abrindo o canal direto de atendimento e ajuda.
 *
 * 2. Micro-Tours Individuais e Saída Exploratória sem Trilha (track === null):
 *    - Nos micro-tours pontuais (finances_overview, finances_wizard, finances_cards, finances_budgets,
 *      finances_insights, finances_split, finances_family, finances_goals, investments_overview,
 *      investments_assets, investments_targets, investments_aporte, app_native_apk):
 *      O usuário buscou uma consulta didática pontual. Ao concluir ("Começar" ou [X]), encerra SEM nenhum
 *      modal, permanecendo estritamente na rota atual limpa (sem query params invasivos como ?novo=...).
 */
export function getTourHandoffDestination(
  track: AnyTourTrackId | string | null,
  currentPath?: string,
): string {
  // Trilha 1 Completa: Finanças Diárias & Cartões Consolidado
  if (track === "finances") {
    return "/?novo=despesa";
  }

  // Trilha 2 Completa: Finanças Compartilhadas & Modo Família
  if (track === "shared_finances") {
    return "/familia";
  }

  // Trilha 3 Completa: Investimentos & Rebalanceamento Consolidado
  if (track === "investments") {
    return "/investments?novo=investimento";
  }

  // Trilha 4 Completa: Configurações, Personalização & Suporte
  if (track === "settings" || track === "settings_support") {
    return "/configuracoes?tab=suporte";
  }

  // Micro-Tours individuais e encerramento sem trilha ativa:
  // Retorna estritamente a rota atual limpa sem query params invasivos de modais
  return cleanPathWithoutInvasiveParams(currentPath);
}

export interface BlockHandoffInfo {
  /** Rótulo da ação principal real no assistente/wizard */
  actionLabel: string;
  /** Destino da ação real */
  actionDestination: string;
  /** Identificador da próxima trilha/bloco temático */
  nextTrackId?: AnyTourTrackId;
  /** Rótulo da próxima trilha para avanço contínuo */
  nextTrackLabel?: string;
}

/**
 * Retorna as informações do Handoff de Ação Tripla ao concluir um dos 4 blocos canônicos (§Plano 11).
 */
export function getBlockHandoffInfo(
  track: AnyTourTrackId | string | null | undefined,
): BlockHandoffInfo | null {
  if (track === "finances") {
    return {
      actionLabel: "Lançar na Conta Real",
      actionDestination: "/?novo=despesa",
      nextTrackId: "shared_finances",
      nextTrackLabel: "Finanças Compartilhadas",
    };
  }

  if (track === "shared_finances") {
    return {
      actionLabel: "Abrir Painel Familiar",
      actionDestination: "/familia",
      nextTrackId: "investments",
      nextTrackLabel: "Investimentos & Carteira",
    };
  }

  if (track === "investments") {
    return {
      actionLabel: "Cadastrar Primeiro Ativo",
      actionDestination: "/investments?novo=investimento",
      nextTrackId: "settings_support",
      nextTrackLabel: "Personalização & Suporte",
    };
  }

  if (track === "settings" || track === "settings_support") {
    return {
      actionLabel: "Explorar Configurações",
      actionDestination: "/configuracoes",
      nextTrackId: undefined,
      nextTrackLabel: undefined,
    };
  }

  return null;
}

