import { describe, expect, it } from "vitest";
import { resolveFabAction } from "./resolve-fab-action";

const allFeatures = () => true;

describe("resolveFabAction (M8 — FAB contextual)", () => {
  it("resolve 'Nova Viagem' na rota /viagens", () => {
    expect(resolveFabAction("/viagens", "", allFeatures)).toEqual({
      to: "/viagens?novo=viagem",
      label: "Nova Viagem",
    });
  });

  it("resolve 'Novo Gasto da Viagem' dentro de uma viagem específica (/viagens/:id)", () => {
    expect(resolveFabAction("/viagens/trip-42", "", allFeatures)).toEqual({
      to: "/viagens/trip-42?novo=gasto-viagem",
      label: "Novo Gasto da Viagem",
    });
  });

  it("resolve ação familiar em /familia e /modo-familia", () => {
    expect(resolveFabAction("/familia", "", allFeatures)).toEqual({
      to: "/familia?novo=despesa&familia=1",
      label: "Nova despesa familiar",
    });
    expect(resolveFabAction("/modo-familia", "", allFeatures)).toEqual({
      to: "/modo-familia?novo=despesa&familia=1",
      label: "Nova despesa familiar",
    });
  });

  it("resolve 'Nova Meta' em /orcamentos?tab=goals, /orcamentos?aba=metas e /metas", () => {
    expect(resolveFabAction("/orcamentos", "?tab=goals", allFeatures)).toEqual({
      to: "/orcamentos?tab=goals&novo=meta",
      label: "Nova Meta",
    });
    expect(resolveFabAction("/orcamentos", "?aba=metas", allFeatures)).toEqual({
      to: "/orcamentos?aba=metas&novo=meta",
      label: "Nova Meta",
    });
    expect(resolveFabAction("/metas", "", allFeatures)).toEqual({
      to: "/metas?novo=meta",
      label: "Nova Meta",
    });
  });

  it("mantém as ações contextuais existentes (/orcamentos, /dividas, /investments, /cartoes, /transacoes, /)", () => {
    expect(resolveFabAction("/orcamentos", "", allFeatures)).toEqual({
      to: "/orcamentos?novo=categoria",
      label: "Nova categoria",
    });
    expect(resolveFabAction("/dividas", "", allFeatures)).toEqual({
      to: "/dividas?novo=divida",
      label: "Nova dívida",
    });
    expect(resolveFabAction("/investments", "", allFeatures)).toEqual({
      to: "/investments?novo=investimento",
      label: "Novo investimento",
    });
    expect(resolveFabAction("/cartoes", "", allFeatures)).toEqual({
      to: "/cartoes?novo=transacao",
      label: "Nova transação",
    });
  });

  it("aplica fallback dinâmico em páginas neutras conforme módulos habilitados", () => {
    expect(resolveFabAction("/configuracoes", "", (k) => k === "investments")).toEqual({
      to: "/investments?novo=investimento",
      label: "Novo investimento",
    });
    expect(resolveFabAction("/configuracoes", "", (k) => k === "debts")).toEqual({
      to: "/dividas?novo=divida",
      label: "Nova dívida",
    });
    expect(resolveFabAction("/configuracoes", "", () => false)).toBeNull();
  });
});
