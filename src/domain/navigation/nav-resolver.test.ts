import { describe, expect, it } from "vitest";
import {
  resolveBottomNavSlots,
  resolveLandingPath,
  type NavItemConfig,
} from "./nav-resolver";

describe("navigation domain resolver", () => {
  const allItems: NavItemConfig[] = [
    { label: "Início", path: "/", featureKey: "overview" },
    { label: "Transações", path: "/transacoes", featureKey: "transactions" },
    { label: "Cartões", path: "/cartoes", featureKey: "cards" },
    { label: "Investimentos", path: "/investments", featureKey: "investments" },
    { label: "Dívidas", path: "/dividas", featureKey: "debts" },
    { label: "Relatórios", path: "/relatorios", featureKey: "reports" },
    { label: "Configurações", path: "/configuracoes" },
    { label: "Administração", path: "/admin", adminOnly: true },
  ];

  it("deve promover os primeiros 3 itens prioritários e os demais para o menu Mais no perfil completo (>4 itens)", () => {
    const { primarySlots, moreMenuSlots } = resolveBottomNavSlots(allItems);

    expect(primarySlots).toHaveLength(3);
    expect(primarySlots.map((i) => i.path)).toEqual([
      "/",
      "/transacoes",
      "/cartoes",
    ]);

    expect(moreMenuSlots.map((i) => i.path)).toEqual([
      "/investments",
      "/dividas",
      "/relatorios",
      "/configuracoes",
      "/admin",
    ]);
  });

  it("deve promover todos os itens diretamente para a barra sem botão Mais quando houver <= 4 itens", () => {
    const onlyWealthItems: NavItemConfig[] = [
      { label: "Investimentos", path: "/investments", featureKey: "investments" },
      { label: "Relatórios", path: "/relatorios", featureKey: "reports" },
      { label: "Dívidas", path: "/dividas", featureKey: "debts" },
      { label: "Configurações", path: "/configuracoes" },
    ];

    const { primarySlots, moreMenuSlots } = resolveBottomNavSlots(onlyWealthItems);

    expect(primarySlots).toHaveLength(4);
    expect(primarySlots.map((i) => i.path)).toEqual([
      "/investments",
      "/dividas",
      "/relatorios",
      "/configuracoes",
    ]);

    expect(moreMenuSlots).toHaveLength(0);
  });


  it("deve resolver a rota inicial landing correta para cada perfil de permissões", () => {
    // 1. Perfil completo com overview
    expect(resolveLandingPath(() => true)).toBe("/");

    // 2. Sem overview, com transações
    expect(
      resolveLandingPath((key) => key !== "overview"),
    ).toBe("/transacoes");

    // 3. Modo consultoria pura (apenas investments e reports)
    expect(
      resolveLandingPath((key) => key === "investments" || key === "reports"),
    ).toBe("/investments");

    // 4. Sem nenhuma feature de finanças -> fallback para configurações
    expect(resolveLandingPath(() => false)).toBe("/configuracoes");
  });
});
