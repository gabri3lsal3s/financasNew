import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedBankTransaction } from "@/domain/notifications";
import { setActiveUserId } from "@/services/user-storage";
import {
  addPendingSuggestion,
  clearPendingSuggestions,
  clearRecentReceipts,
  dismissPendingSuggestion,
  getPendingSuggestions,
  getRecentReceipts,
  isPushDuplicateOfReceipt,
  RECEIPT_DEDUPLICATION_WINDOW_MS,
  registerReceiptDeduplication,
  subscribePendingSuggestions,
} from "./suggestions-store";

describe("suggestions-store (Fila de Sugestões Nativas)", () => {
  const sample1: ParsedBankTransaction = {
    id: "sug_1",
    bankName: "Nubank",
    nature: "expense",
    type: "expense",
    amountCents: 4500,
    description: "Almoço",
    date: "2026-10-15",
    paymentMethod: "credit_card",
    rawText: "Compra de R$ 45,00 no Nubank",
    timestamp: Date.now(),
  };

  const sample2: ParsedBankTransaction = {
    id: "sug_2",
    bankName: "Inter",
    nature: "income",
    type: "income",
    amountCents: 15000,
    description: "Pix de Fulano",
    date: "2026-10-15",
    paymentMethod: "pix",
    rawText: "Você recebeu um Pix de R$ 150,00",
    timestamp: Date.now(),
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

  it("ignora duplicatas pela chave composta (bank + amount + date + merchant)", () => {
    addPendingSuggestion(sample1);
    expect(getPendingSuggestions().length).toBe(1);

    // Mesmos dados principais com ID e rawText diferentes
    const duplicateEvent: ParsedBankTransaction = {
      id: "sug_completely_different_id_999",
      bankName: "Nubank",
      nature: "expense",
      type: "expense",
      amountCents: 4500,
      description: "Almoço",
      date: "2026-10-15",
      paymentMethod: "credit_card",
      rawText: "Texto ligeiramente diferente da mesma compra",
      timestamp: Date.now(),
    };

    addPendingSuggestion(duplicateEvent);
    expect(getPendingSuggestions().length).toBe(1);
    expect(getPendingSuggestions()[0]!.id).toBe("sug_1");
  });

  it("expira automaticamente sugestões com mais de 7 dias", () => {
    const now = Date.now();
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;

    const expiredSample: ParsedBankTransaction = {
      id: "sug_expired",
      bankName: "Nubank",
      nature: "expense",
      type: "expense",
      amountCents: 990,
      description: "Café Antigo",
      date: "2026-10-01",
      timestamp: eightDaysAgo,
      rawText: "Compra antiga de R$ 9,90",
    };

    const recentSample: ParsedBankTransaction = {
      id: "sug_recent",
      bankName: "Nubank",
      nature: "expense",
      type: "expense",
      amountCents: 1500,
      description: "Lanche Recente",
      date: "2026-10-16",
      timestamp: now,
      rawText: "Compra recente de R$ 15,00",
    };

    addPendingSuggestion(expiredSample);
    // Como a sugestão é antiga, não deve nem entrar na fila
    expect(getPendingSuggestions()).toEqual([]);

    addPendingSuggestion(recentSample);
    expect(getPendingSuggestions()).toEqual([recentSample]);
  });

  it("rejeita sugestões com banco genérico Banco ou banco ausente", () => {
    const invalidBankSample: ParsedBankTransaction = {
      id: "sug_invalid_bank",
      bankName: "Banco",
      nature: "expense",
      type: "expense",
      amountCents: 5580,
      description: "calçados Tobias BLTDA",
      date: "2026-10-16",
      rawText: "5580 calçados Tobias BLTDA",
      timestamp: Date.now(),
    };

    addPendingSuggestion(invalidBankSample);
    expect(getPendingSuggestions()).toEqual([]);
  });

  describe("Motor de Fusão Temporal e Deduplicação Inteligente (§2.4)", () => {
    it.each([
      { label: "500ms", intervalMs: 500 },
      { label: "2 segundos", intervalMs: 2000 },
      { label: "1 minuto", intervalMs: 60 * 1000 },
      { label: "4 minutos", intervalMs: 4 * 60 * 1000 },
    ])(
      "faz o merge atribuindo ao banco oficial e mantendo bandeira quando Google Pay chega antes do Nubank ($label)",
      ({ intervalMs }) => {
        const baseTimestamp = Date.now();

        const googlePaySuggestion: ParsedBankTransaction = {
          id: `sug_gpay_${intervalMs}`,
          bankName: "Carteira Google",
          nature: "expense",
          type: "expense",
          amountCents: 8500,
          description: "Padaria Estrela",
          merchant: "Padaria Estrela",
          cardBrand: "Mastercard",
          cardLastDigits: "1234",
          issuerBank: "Nubank",
          date: "2026-10-20",
          paymentMethod: "credit_card",
          rawText: "Compra de R$ 85,00 em Padaria Estrela com Cartão Nubank final 1234",
          timestamp: baseTimestamp,
        };

        const nubankSuggestion: ParsedBankTransaction = {
          id: `sug_nubank_${intervalMs}`,
          bankName: "Nubank",
          nature: "expense",
          type: "expense",
          amountCents: 8500,
          description: "Compra aprovada em Padaria Estrela",
          merchant: "Padaria Estrela",
          date: "2026-10-20",
          paymentMethod: "credit_card",
          rawText: "Compra de R$ 85,00 aprovada em Padaria Estrela",
          timestamp: baseTimestamp + intervalMs,
        };

        addPendingSuggestion(googlePaySuggestion);
        expect(getPendingSuggestions()).toHaveLength(1);
        expect(getPendingSuggestions()[0]?.bankName).toBe("Carteira Google");

        addPendingSuggestion(nubankSuggestion);
        const suggestions = getPendingSuggestions();

        expect(suggestions).toHaveLength(1);
        const merged = suggestions[0]!;
        expect(merged.bankName).toBe("Nubank");
        expect(merged.amountCents).toBe(8500);
        expect(merged.cardBrand).toBe("Mastercard");
        expect(merged.cardLastDigits).toBe("1234");
        expect(merged.merchant).toBe("Padaria Estrela");
      },
    );

    it("rejeita notificação subsequente de carteira quando banco oficial chega primeiro", () => {
      const baseTimestamp = Date.now();

      const nubankSuggestion: ParsedBankTransaction = {
        id: "sug_nubank_first",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 12000,
        description: "Mercado Livre",
        merchant: "Mercado Livre",
        date: "2026-10-20",
        paymentMethod: "credit_card",
        rawText: "Compra de R$ 120,00 aprovada no Mercado Livre",
        timestamp: baseTimestamp,
      };

      const googlePaySuggestion: ParsedBankTransaction = {
        id: "sug_gpay_second",
        bankName: "Carteira Google",
        nature: "expense",
        type: "expense",
        amountCents: 12000,
        description: "Mercado Livre",
        merchant: "Mercado Livre",
        cardBrand: "Mastercard",
        cardLastDigits: "9999",
        date: "2026-10-20",
        paymentMethod: "credit_card",
        rawText: "Compra aprovada de R$ 120,00 em Mercado Livre com Mastercard final 9999",
        timestamp: baseTimestamp + 2 * 60 * 1000,
      };

      addPendingSuggestion(nubankSuggestion);
      expect(getPendingSuggestions()).toHaveLength(1);

      addPendingSuggestion(googlePaySuggestion);
      const suggestions = getPendingSuggestions();

      // Carteira rejeitada como duplicata, enriquecendo metadados de cartão
      expect(suggestions).toHaveLength(1);
      const active = suggestions[0]!;
      expect(active.bankName).toBe("Nubank");
      expect(active.cardBrand).toBe("Mastercard");
      expect(active.cardLastDigits).toBe("9999");
    });

    it("não faz merge e mantém ambas quando a diferença temporal ultrapassa 5 minutos", () => {
      const baseTimestamp = Date.now();

      const googlePaySuggestion: ParsedBankTransaction = {
        id: "sug_gpay_old",
        bankName: "Carteira Google",
        nature: "expense",
        type: "expense",
        amountCents: 5000,
        description: "Padaria Estrela",
        merchant: "Padaria Estrela",
        date: "2026-10-20",
        paymentMethod: "credit_card",
        rawText: "Compra de R$ 50,00 em Padaria Estrela",
        timestamp: baseTimestamp,
      };

      const nubankSuggestion: ParsedBankTransaction = {
        id: "sug_nubank_late",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 5000,
        description: "Padaria Estrela",
        merchant: "Padaria Estrela",
        date: "2026-10-20",
        paymentMethod: "credit_card",
        rawText: "Compra de R$ 50,00 aprovada em Padaria Estrela",
        timestamp: baseTimestamp + 6 * 60 * 1000, // 6 minutos depois (> 5 min)
      };

      addPendingSuggestion(googlePaySuggestion);
      addPendingSuggestion(nubankSuggestion);

      expect(getPendingSuggestions()).toHaveLength(2);
    });

    it("processa fusão com Samsung Pay e Itaú mantendo bandeira Visa", () => {
      const baseTimestamp = Date.now();

      const samsungPaySuggestion: ParsedBankTransaction = {
        id: "sug_spay_1",
        bankName: "Samsung Pay",
        nature: "expense",
        type: "expense",
        amountCents: 3250,
        description: "Starbucks",
        merchant: "Starbucks",
        cardBrand: "Visa",
        cardLastDigits: "4321",
        date: "2026-10-20",
        paymentMethod: "credit_card",
        rawText: "Pagamento aprovado: R$ 32,50 em Starbucks com Visa final 4321",
        timestamp: baseTimestamp,
      };

      const itauSuggestion: ParsedBankTransaction = {
        id: "sug_itau_1",
        bankName: "Itaú",
        nature: "expense",
        type: "expense",
        amountCents: 3250,
        description: "Compra aprovada no seu Itaú",
        merchant: "Starbucks",
        date: "2026-10-20",
        paymentMethod: "credit_card",
        rawText: "Itaú: Compra de R$ 32,50 aprovada em Starbucks",
        timestamp: baseTimestamp + 30 * 1000,
      };

      addPendingSuggestion(samsungPaySuggestion);
      addPendingSuggestion(itauSuggestion);

      const suggestions = getPendingSuggestions();
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]?.bankName).toBe("Itaú");
      expect(suggestions[0]?.cardBrand).toBe("Visa");
      expect(suggestions[0]?.cardLastDigits).toBe("4321");
    });

    it("mantém transações separadas se valores forem diferentes mesmo dentro de 5 minutos", () => {
      const baseTimestamp = Date.now();

      const gpay: ParsedBankTransaction = {
        id: "sug_gpay_diff_amount",
        bankName: "Carteira Google",
        nature: "expense",
        type: "expense",
        amountCents: 4500,
        description: "Padaria",
        merchant: "Padaria",
        date: "2026-10-20",
        rawText: "Compra de R$ 45,00",
        timestamp: baseTimestamp,
      };

      const nubank: ParsedBankTransaction = {
        id: "sug_nubank_diff_amount",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 5500,
        description: "Padaria",
        merchant: "Padaria",
        date: "2026-10-20",
        rawText: "Compra de R$ 55,00",
        timestamp: baseTimestamp + 60 * 1000,
      };

      addPendingSuggestion(gpay);
      addPendingSuggestion(nubank);
      expect(getPendingSuggestions()).toHaveLength(2);
    });

    it("mantém transações separadas se estabelecimentos forem incompatíveis", () => {
      const baseTimestamp = Date.now();

      const gpay: ParsedBankTransaction = {
        id: "sug_gpay_shell",
        bankName: "Carteira Google",
        nature: "expense",
        type: "expense",
        amountCents: 5000,
        description: "Posto Shell",
        merchant: "Posto Shell",
        date: "2026-10-20",
        rawText: "Compra de R$ 50,00 no Posto Shell",
        timestamp: baseTimestamp,
      };

      const nubank: ParsedBankTransaction = {
        id: "sug_nubank_drogaria",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 5000,
        description: "Drogaria Sao Paulo",
        merchant: "Drogaria Sao Paulo",
        date: "2026-10-20",
        rawText: "Compra de R$ 50,00 na Drogaria Sao Paulo",
        timestamp: baseTimestamp + 30 * 1000,
      };

      addPendingSuggestion(gpay);
      addPendingSuggestion(nubank);
      expect(getPendingSuggestions()).toHaveLength(2);
    });

    it("rejeita notificações duplicadas consecutivas do mesmo banco dentro da janela de 5 min", () => {
      const baseTimestamp = Date.now();

      const nubank1: ParsedBankTransaction = {
        id: "sug_nubank_dup_1",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 7500,
        description: "Restaurante Sabor",
        merchant: "Restaurante Sabor",
        date: "2026-10-20",
        rawText: "Compra de R$ 75,00 aprovada no Restaurante Sabor",
        timestamp: baseTimestamp,
      };

      const nubank2: ParsedBankTransaction = {
        id: "sug_nubank_dup_2",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 7500,
        description: "Restaurante Sabor",
        merchant: "Restaurante Sabor",
        date: "2026-10-20",
        rawText: "Transação de R$ 75,00 confirmada no Restaurante Sabor",
        timestamp: baseTimestamp + 45 * 1000,
      };

      addPendingSuggestion(nubank1);
      addPendingSuggestion(nubank2);
      expect(getPendingSuggestions()).toHaveLength(1);
    });

    it("estresse contra race conditions de notificações concorrentes", async () => {
      const baseTimestamp = Date.now();
      const concurrentOperations: Promise<void>[] = [];

      // 10 transações distintas
      for (let i = 0; i < 10; i++) {
        const item: ParsedBankTransaction = {
          id: `sug_distinct_${i}`,
          bankName: "Banco Inter",
          nature: "expense",
          type: "expense",
          amountCents: 1000 + i * 100,
          description: `Loja ${i}`,
          merchant: `Loja ${i}`,
          date: "2026-10-20",
          rawText: `Compra de R$ ${10 + i},00 na Loja ${i}`,
          timestamp: baseTimestamp + i * 10,
        };
        concurrentOperations.push(
          Promise.resolve().then(() => {
            addPendingSuggestion(item);
          }),
        );
      }

      // 5 pares concorrentes de Carteira + Banco com ordens cruzadas
      for (let i = 0; i < 5; i++) {
        const walletItem: ParsedBankTransaction = {
          id: `sug_pair_wallet_${i}`,
          bankName: "Carteira Google",
          nature: "expense",
          type: "expense",
          amountCents: 3000 + i * 500,
          description: `Mercado Concorrente ${i}`,
          merchant: `Mercado Concorrente ${i}`,
          cardBrand: "Mastercard",
          cardLastDigits: `000${i}`,
          date: "2026-10-20",
          rawText: `Compra de R$ ${30 + i * 5},00 em Mercado Concorrente ${i} com Mastercard final 000${i}`,
          timestamp: baseTimestamp + i * 100,
        };

        const bankItem: ParsedBankTransaction = {
          id: `sug_pair_bank_${i}`,
          bankName: "Nubank",
          nature: "expense",
          type: "expense",
          amountCents: 3000 + i * 500,
          description: `Mercado Concorrente ${i}`,
          merchant: `Mercado Concorrente ${i}`,
          date: "2026-10-20",
          rawText: `Compra aprovada no Nubank de R$ ${30 + i * 5},00 em Mercado Concorrente ${i}`,
          timestamp: baseTimestamp + i * 100 + 500,
        };

        // Alterna ordem de chegada nas promises para testar race conditions
        if (i % 2 === 0) {
          concurrentOperations.push(Promise.resolve().then(() => addPendingSuggestion(walletItem)));
          concurrentOperations.push(Promise.resolve().then(() => addPendingSuggestion(bankItem)));
        } else {
          concurrentOperations.push(Promise.resolve().then(() => addPendingSuggestion(bankItem)));
          concurrentOperations.push(Promise.resolve().then(() => addPendingSuggestion(walletItem)));
        }
      }

      // Duplicatas idênticas exatas disparadas em massa
      for (let i = 0; i < 15; i++) {
        concurrentOperations.push(
          Promise.resolve().then(() => {
            addPendingSuggestion(sample1);
          }),
        );
      }

      await Promise.all(concurrentOperations);

      const results = getPendingSuggestions();

      // Total esperado: 10 distintas + 5 pares (fundidos) + 1 (sample1) = 16
      expect(results.length).toBe(16);
      expect(results.length).toBeLessThanOrEqual(20);

      // Verifica que todos os 5 pares concorrentes foram atribuídos ao Nubank mantendo a bandeira Mastercard
      for (let i = 0; i < 5; i++) {
        const matched = results.find((r) => r.merchant === `Mercado Concorrente ${i}`);
        expect(matched).toBeDefined();
        expect(matched?.bankName).toBe("Nubank");
        expect(matched?.cardBrand).toBe("Mastercard");
        expect(matched?.cardLastDigits).toBe(`000${i}`);
      }
    });
  });

  describe("Deduplicação Cruzada (Comprovante vs Notificação Push)", () => {
    const baseTime = Date.now();

    it("exporta a constante canônica de janela temporal de 10 minutos", () => {
      expect(RECEIPT_DEDUPLICATION_WINDOW_MS).toBe(10 * 60 * 1000);
    });

    it("descarta silenciosamente notificação push que colide com comprovante compartilhado 45s antes (mesmo valor e estabelecimento)", () => {
      const receipt: ParsedBankTransaction = {
        id: "pix_1729524000_abc1",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 4500,
        description: "Pagamento Pix para Padaria Estrela",
        merchant: "Padaria Estrela",
        date: "2026-10-21",
        paymentMethod: "pix",
        taxId: "12.345.678/0001-90",
        rawText: "Comprovante de Transferência Pix - Nubank. Valor: R$ 45,00. Favorecido: Padaria Estrela",
        timestamp: baseTime,
        source: "receipt",
      };

      const push45sLater: ParsedBankTransaction = {
        id: "push_nubank_123",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 4500,
        description: "Transferência Pix realizada",
        merchant: "Padaria Estrela",
        date: "2026-10-21",
        paymentMethod: "pix",
        rawText: "Você realizou uma transferência Pix de R$ 45,00 para Padaria Estrela",
        timestamp: baseTime + 45 * 1000,
        source: "notification",
      };

      // 1. Usuário compartilha comprovante via intent de compartilhamento
      addPendingSuggestion(receipt);
      expect(getPendingSuggestions().length).toBe(1);
      expect(getPendingSuggestions()[0]!.id).toBe(receipt.id);

      // 2. 45 segundos depois, o SO dispara a notificação push bancária atrasada
      addPendingSuggestion(push45sLater);

      // 3. A notificação push deve ser descartada silenciosamente sem gerar card duplicado
      const current = getPendingSuggestions();
      expect(current.length).toBe(1);
      expect(current[0]!.id).toBe(receipt.id);
      expect(current[0]!.source).toBe("receipt");
      expect(current[0]!.taxId).toBe("12.345.678/0001-90");
    });

    it("descarta notificação push com variação comercial do estabelecimento dentro da janela de 10 minutos (ex.: 'Padaria Estrela Ltda' vs 'Padaria Estrela')", () => {
      const receipt: ParsedBankTransaction = {
        id: "pix_1729524000_abc2",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 8500,
        description: "Transferência para Padaria Estrela Ltda",
        merchant: "Padaria Estrela Ltda",
        date: "2026-10-21",
        paymentMethod: "pix",
        rawText: "Comprovante Pix: R$ 85,00 para Padaria Estrela Ltda",
        timestamp: baseTime,
        source: "receipt",
      };

      const push3MinLater: ParsedBankTransaction = {
        id: "push_nubank_456",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 8500,
        description: "Compra aprovada no Nubank",
        merchant: "Padaria Estrela",
        date: "2026-10-21",
        rawText: "Compra de R$ 85,00 em Padaria Estrela",
        timestamp: baseTime + 3 * 60 * 1000, // 3 minutos depois
        source: "notification",
      };

      addPendingSuggestion(receipt);
      addPendingSuggestion(push3MinLater);

      expect(getPendingSuggestions().length).toBe(1);
      expect(getPendingSuggestions()[0]!.id).toBe(receipt.id);
    });

    it("permite notificação push se ultrapassar a janela de 10 minutos (ex.: 11 minutos após)", () => {
      const receipt: ParsedBankTransaction = {
        id: "pix_1729524000_abc3",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 4500,
        description: "Pagamento Pix",
        merchant: "Padaria Estrela",
        date: "2026-10-21",
        paymentMethod: "pix",
        rawText: "Comprovante de R$ 45,00 para Padaria Estrela",
        timestamp: baseTime,
        source: "receipt",
      };

      const push11MinLater: ParsedBankTransaction = {
        id: "push_nubank_789",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 4500,
        description: "Pix enviado",
        merchant: "Padaria Estrela",
        date: "2026-10-21",
        paymentMethod: "pix",
        rawText: "Você enviou um Pix de R$ 45,00 para Padaria Estrela",
        timestamp: baseTime + 11 * 60 * 1000, // 11 minutos depois (> 10 min)
        source: "notification",
      };

      addPendingSuggestion(receipt);
      addPendingSuggestion(push11MinLater);

      expect(getPendingSuggestions().length).toBe(2);
    });

    it("permite notificação push com valor diferente no mesmo estabelecimento", () => {
      const receipt: ParsedBankTransaction = {
        id: "pix_1729524000_abc4",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 4500,
        description: "Pagamento Pix",
        merchant: "Padaria Estrela",
        date: "2026-10-21",
        timestamp: baseTime,
        source: "receipt",
        rawText: "Comprovante de R$ 45,00",
      };

      const pushDifferentAmount: ParsedBankTransaction = {
        id: "push_nubank_diff_amt",
        bankName: "Nubank",
        nature: "expense",
        type: "expense",
        amountCents: 6000, // R$ 60,00 vs R$ 45,00
        description: "Pix enviado",
        merchant: "Padaria Estrela",
        date: "2026-10-21",
        timestamp: baseTime + 45 * 1000,
        source: "notification",
        rawText: "Você enviou R$ 60,00 para Padaria Estrela",
      };

      addPendingSuggestion(receipt);
      addPendingSuggestion(pushDifferentAmount);

      expect(getPendingSuggestions().length).toBe(2);
    });

    it("substitui notificação push prévia se comprovante compartilhado mais rico chegar 45s depois", () => {
      const pushEarly: ParsedBankTransaction = {
        id: "push_inter_early",
        bankName: "Inter",
        nature: "expense",
        type: "expense",
        amountCents: 12000,
        description: "Compra aprovada",
        merchant: "Supermercado Alfa",
        date: "2026-10-21",
        timestamp: baseTime,
        source: "notification",
        rawText: "Compra de R$ 120,00 aprovada no Inter em Supermercado Alfa",
      };

      const richerReceipt: ParsedBankTransaction = {
        id: "pix_inter_richer",
        bankName: "Inter",
        nature: "expense",
        type: "expense",
        amountCents: 12000,
        description: "Pagamento Pix para Supermercado Alfa Ltda",
        merchant: "Supermercado Alfa Ltda",
        taxId: "98.765.432/0001-11",
        txId: "E00416968202610211234567890",
        date: "2026-10-21",
        paymentMethod: "pix",
        timestamp: baseTime + 45 * 1000,
        source: "receipt",
        rawText: "Comprovante de Transferência Pix - Inter. Valor: R$ 120,00. CNPJ: 98.765.432/0001-11",
      };

      addPendingSuggestion(pushEarly);
      expect(getPendingSuggestions().length).toBe(1);
      expect(getPendingSuggestions()[0]!.id).toBe("push_inter_early");

      // Comprovante compartilhado 45s depois atualiza e enriquece o card
      addPendingSuggestion(richerReceipt);
      expect(getPendingSuggestions().length).toBe(1);
      expect(getPendingSuggestions()[0]!.id).toBe("pix_inter_richer");
      expect(getPendingSuggestions()[0]!.taxId).toBe("98.765.432/0001-11");
      expect(getPendingSuggestions()[0]!.txId).toBe("E00416968202610211234567890");
      expect(getPendingSuggestions()[0]!.source).toBe("receipt");
    });

    it("isPushDuplicateOfReceipt e clearRecentReceipts operam conforme especificado", () => {
      clearRecentReceipts();
      expect(getRecentReceipts()).toEqual([]);

      const receiptTx: ParsedBankTransaction = {
        id: "pix_test_rec",
        bankName: "Itaú",
        nature: "expense",
        type: "expense",
        amountCents: 7500,
        description: "Posto Ipiranga",
        merchant: "Posto Ipiranga",
        date: "2026-10-21",
        timestamp: baseTime,
        source: "receipt",
        rawText: "Comprovante Posto Ipiranga R$ 75,00",
      };

      registerReceiptDeduplication(receiptTx);
      expect(getRecentReceipts().length).toBe(1);

      const matchingPush: ParsedBankTransaction = {
        id: "push_test",
        bankName: "Itaú",
        nature: "expense",
        type: "expense",
        amountCents: 7500,
        description: "Compra aprovada",
        merchant: "Posto Ipiranga",
        date: "2026-10-21",
        timestamp: baseTime + 60 * 1000,
        source: "notification",
        rawText: "Compra de R$ 75,00 no Posto Ipiranga",
      };

      expect(isPushDuplicateOfReceipt(matchingPush, baseTime + 60 * 1000)).toBe(true);

      clearRecentReceipts();
      expect(getRecentReceipts()).toEqual([]);
    });
  });
});
