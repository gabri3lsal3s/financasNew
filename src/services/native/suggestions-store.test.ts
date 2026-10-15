import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedBankTransaction } from "@/domain/notifications";
import { setActiveUserId } from "@/services/user-storage";
import {
  addPendingSuggestion,
  clearPendingSuggestions,
  dismissPendingSuggestion,
  getPendingSuggestions,
  subscribePendingSuggestions,
} from "./suggestions-store";

describe("suggestions-store (Fila de Sugestões Nativas)", () => {
  const sample1: ParsedBankTransaction = {
    id: "sug_1",
    bankName: "Nubank",
    type: "expense",
    amountCents: 4500,
    description: "Almoço",
    date: "2026-10-15",
    paymentMethod: "credit_card",
    rawText: "Compra de R$ 45,00 no Nubank",
  };

  const sample2: ParsedBankTransaction = {
    id: "sug_2",
    bankName: "Inter",
    type: "income",
    amountCents: 15000,
    description: "Pix de Fulano",
    date: "2026-10-15",
    paymentMethod: "pix",
    rawText: "Você recebeu um Pix de R$ 150,00",
  };

  beforeEach(() => {
    setActiveUserId("test-user-1");
    clearPendingSuggestions();
  });

  afterEach(() => {
    clearPendingSuggestions();
  });

  it("adiciona e lista sugestões pendentes", () => {
    expect(getPendingSuggestions()).toEqual([]);
    addPendingSuggestion(sample1);
    expect(getPendingSuggestions()).toEqual([sample1]);
    addPendingSuggestion(sample2);
    expect(getPendingSuggestions()).toEqual([sample2, sample1]);
  });

  it("ignora duplicatas pelo id ou pelo rawText", () => {
    addPendingSuggestion(sample1);
    addPendingSuggestion(sample1);
    expect(getPendingSuggestions().length).toBe(1);

    const duplicateRaw: ParsedBankTransaction = {
      ...sample2,
      id: "sug_different",
      rawText: sample1.rawText,
    };
    addPendingSuggestion(duplicateRaw);
    expect(getPendingSuggestions().length).toBe(1);
  });

  it("descarta uma sugestão específica", () => {
    addPendingSuggestion(sample1);
    addPendingSuggestion(sample2);
    expect(getPendingSuggestions().length).toBe(2);

    dismissPendingSuggestion("sug_1");
    expect(getPendingSuggestions()).toEqual([sample2]);
  });

  it("limpa todas as sugestões", () => {
    addPendingSuggestion(sample1);
    addPendingSuggestion(sample2);
    clearPendingSuggestions();
    expect(getPendingSuggestions()).toEqual([]);
  });

  it("notifica inscritos quando há mudanças", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePendingSuggestions(listener);

    addPendingSuggestion(sample1);
    expect(listener).toHaveBeenCalledTimes(1);

    dismissPendingSuggestion("sug_1");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    addPendingSuggestion(sample2);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("isola sugestões por usuário ativo", () => {
    addPendingSuggestion(sample1);
    expect(getPendingSuggestions()).toHaveLength(1);

    setActiveUserId("test-user-2");
    expect(getPendingSuggestions()).toHaveLength(0);

    addPendingSuggestion(sample2);
    expect(getPendingSuggestions()).toHaveLength(1);
    expect(getPendingSuggestions()[0]!.id).toBe("sug_2");

    setActiveUserId("test-user-1");
    expect(getPendingSuggestions()).toHaveLength(1);
    expect(getPendingSuggestions()[0]!.id).toBe("sug_1");
  });
});
