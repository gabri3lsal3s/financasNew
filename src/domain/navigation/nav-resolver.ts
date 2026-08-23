export interface NavItemConfig {
  label: string;
  path: string;
  featureKey?: string;
  adminOnly?: boolean;
}

export interface BottomNavResolution<T extends NavItemConfig> {
  /** Itens principais promovidos aos slots da barra inferior (máximo 4) */
  primarySlots: T[];
  /** Itens secundários que devem ser acessados via menu "Mais" */
  moreMenuSlots: T[];
}

/**
 * Ordem canônica de prioridade para promoção de itens aos slots principais da BottomNav.
 */
export const BOTTOM_NAV_PRIORITY_ORDER = [
  "/",
  "/transacoes",
  "/cartoes",
  "/investments",
  "/dividas",
  "/orcamentos",
  "/relatorios",
  "/insights",
  "/lembretes",
] as const;

/**
 * Resolve a distribuição harmônica de slots da BottomNav mobile com base nos itens permitidos.
 */
export function resolveBottomNavSlots<T extends NavItemConfig>(
  allowedItems: readonly T[],
): BottomNavResolution<T> {
  // Itens de sistema que nunca devem ocupar os slots principais fixos da barra
  const isSystemItem = (item: T) =>
    item.path === "/configuracoes" || item.path === "/admin" || item.adminOnly;

  const contentItems = allowedItems.filter((i) => !isSystemItem(i));

  // Ordena os itens de conteúdo conforme a prioridade canônica
  const sorted = [...contentItems].sort((a, b) => {
    const idxA = BOTTOM_NAV_PRIORITY_ORDER.indexOf(a.path as (typeof BOTTOM_NAV_PRIORITY_ORDER)[number]);
    const idxB = BOTTOM_NAV_PRIORITY_ORDER.indexOf(b.path as (typeof BOTTOM_NAV_PRIORITY_ORDER)[number]);
    const orderA = idxA === -1 ? 999 : idxA;
    const orderB = idxB === -1 ? 999 : idxB;
    return orderA - orderB;
  });

  const primarySlots = sorted.slice(0, 4);
  const primaryPaths = new Set(primarySlots.map((p) => p.path));

  // Itens do menu Mais são todos os itens permitidos que não estão nos slots principais
  const moreMenuSlots = allowedItems.filter((item) => !primaryPaths.has(item.path));

  return {
    primarySlots,
    moreMenuSlots,
  };
}

/**
 * Determina a rota inicial padrão mais segura e relevante de acordo com as permissões ativas.
 */
export function resolveLandingPath(
  hasFeature: (featureKey: string) => boolean,
  isAdmin = false,
): string {
  const routesPreference: Array<{ path: string; featureKey?: string; adminOnly?: boolean }> = [
    { path: "/", featureKey: "overview" },
    { path: "/transacoes", featureKey: "transactions" },
    { path: "/cartoes", featureKey: "cards" },
    { path: "/investments", featureKey: "investments" },
    { path: "/dividas", featureKey: "debts" },
    { path: "/orcamentos", featureKey: "budgets" },
    { path: "/relatorios", featureKey: "reports" },
    { path: "/insights", featureKey: "insights" },
    { path: "/lembretes", featureKey: "reminders" },
    { path: "/admin", adminOnly: true },
    { path: "/configuracoes" },
  ];

  for (const route of routesPreference) {
    if (route.adminOnly && !isAdmin) continue;
    if (route.featureKey && !hasFeature(route.featureKey)) continue;
    return route.path;
  }

  return "/configuracoes";
}
