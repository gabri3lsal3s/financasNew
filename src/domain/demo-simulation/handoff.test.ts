import { describe, expect, it } from "vitest";
import { getTourHandoffDestination } from "./handoff";

describe("getTourHandoffDestination", () => {
  it("direciona para /cartoes?novo=cartao quando o usuário estiver em cartões", () => {
    expect(getTourHandoffDestination("finances", "/cartoes")).toBe("/cartoes?novo=cartao");
    expect(getTourHandoffDestination("finances", "/cartoes?tab=fatura")).toBe("/cartoes?novo=cartao");
  });

  it("direciona para /investments?novo=investimento quando o usuário estiver em investimentos ou trilha investments", () => {
    expect(getTourHandoffDestination("investments", "/investimentos")).toBe("/investments?novo=investimento");
    expect(getTourHandoffDestination("investments", "/investments?tab=metas")).toBe("/investments?novo=investimento");
    expect(getTourHandoffDestination("investments", "/")).toBe("/investments?novo=investimento");
  });

  it("direciona para /transacoes?novo=despesa quando o usuário estiver na tela de transações", () => {
    expect(getTourHandoffDestination("finances", "/transacoes")).toBe("/transacoes?novo=despesa");
    expect(getTourHandoffDestination("finances", "/transacoes?tab=despesas")).toBe("/transacoes?novo=despesa");
  });

  it("direciona para /orcamentos quando o usuário estiver em orçamentos", () => {
    expect(getTourHandoffDestination("finances", "/orcamentos")).toBe("/orcamentos");
  });

  it("direciona para /?novo=despesa por padrão quando no Dashboard ou rota não mapeada de finanças", () => {
    expect(getTourHandoffDestination("finances", "/")).toBe("/?novo=despesa");
    expect(getTourHandoffDestination("finances", undefined)).toBe("/?novo=despesa");
    expect(getTourHandoffDestination(null, "/")).toBe("/?novo=despesa");
  });
});
