import { describe, expect, it } from "vitest";
import { decodePixBrCode, validatePixBrCode } from "@/domain/pix";
import type { SplitSharePayload } from "@/types";
import {
  applySplitSettlementTransition,
  computeSplitExpenseWeights,
  recalculateSplitPayloadOnEdit,
  resolveSplitExpirationIso,
} from "./split-reconciliation";

function makeSinglePayload(overrides?: Partial<SplitSharePayload>): SplitSharePayload {
  return {
    title: "Jantar Italiano",
    total_cents: 20000,
    date: "2026-11-10",
    people_count: 2,
    guest_share_cents: 10000,
    host_share_cents: 10000,
    remainder_policy: "host",
    host_name: "Gabriel",
    host_city: "ARACAJU",
    pix_key: "gabriel@axir.com.br",
    pix_key_type: "email",
    pix_br_code: "BR_CODE",
    participants: [
      { id: "p_1", name: "Gabriel", share_cents: 10000, is_host: true, is_settled: true, settled_cents: 10000 },
      { id: "p_2", name: "Lucas", share_cents: 10000, is_host: false, is_settled: false, settled_cents: 0 },
    ],
    ...overrides,
  };
}

describe("split-reconciliation — Motor de Reconciliação e Edição de Rachas", () => {
  describe("computeSplitExpenseWeights", () => {
    it("calcula report_weight corretamente em despesa à vista (1x) sem participant_installments", () => {
      const weights = computeSplitExpenseWeights({
        expenses: [{ id: "e1", value: 200, report_weight: 1, installments_total: 1 }],
        participants: [
          { id: "p_1", name: "Gabriel", share_cents: 10000, is_host: true, is_settled: true, settled_cents: 10000 },
          { id: "p_2", name: "Lucas", share_cents: 10000, is_host: false, is_settled: true, settled_cents: 10000 },
        ],
        installments: [],
        totalCents: 20000,
      });

      expect(weights).toEqual([{ expenseId: "e1", targetWeight: 0.5, changed: true }]);
    });

    it("calcula report_weight proporcional em baixa parcial à vista", () => {
      const weights = computeSplitExpenseWeights({
        expenses: [{ id: "e1", value: 200, report_weight: 1, installments_total: 1 }],
        participants: [
          { id: "p_1", name: "Gabriel", share_cents: 10000, is_host: true, is_settled: true, settled_cents: 10000 },
          { id: "p_2", name: "Lucas", share_cents: 10000, is_host: false, is_settled: false, settled_cents: 4000 },
        ],
        totalCents: 20000,
      });

      // 20000 - 4000 = 16000 -> 16000 / 20000 = 0.8
      expect(weights[0]?.targetWeight).toBe(0.8);
    });

    it("calcula report_weight em compra parcelada no modo single_total", () => {
      const weights = computeSplitExpenseWeights({
        expenses: [
          { id: "e1", value: 100, installment_number: 1, installments_total: 3, report_weight: 1 },
          { id: "e2", value: 100, installment_number: 2, installments_total: 3, report_weight: 1 },
          { id: "e3", value: 100, installment_number: 3, installments_total: 3, report_weight: 1 },
        ],
        participants: [
          { id: "p_1", name: "Gabriel", share_cents: 15000, is_host: true, is_settled: true, settled_cents: 15000 },
          { id: "p_2", name: "Lucas", share_cents: 15000, is_host: false, is_settled: true, settled_cents: 15000 },
        ],
        installments: [],
        installmentsMode: "single_total",
        totalCents: 30000,
      });

      expect(weights).toEqual([
        { expenseId: "e1", targetWeight: 0.5, changed: true },
        { expenseId: "e2", targetWeight: 0.5, changed: true },
        { expenseId: "e3", targetWeight: 0.5, changed: true },
      ]);
    });

    it("calcula report_weight por parcela no modo per_installment", () => {
      const weights = computeSplitExpenseWeights({
        expenses: [
          { id: "e1", value: 100, installment_number: 1, installments_total: 2, report_weight: 1 },
          { id: "e2", value: 100, installment_number: 2, installments_total: 2, report_weight: 1 },
        ],
        participants: [
          { id: "p_1", name: "Gabriel", share_cents: 10000, is_host: true, is_settled: true, settled_cents: 10000 },
          { id: "p_2", name: "Lucas", share_cents: 10000, is_host: false, is_settled: false, settled_cents: 5000 },
        ],
        installments: [
          { id: "p_2_inst_1", participant_id: "p_2", installment_number: 1, total_installments: 2, amount_cents: 5000, due_date: "2026-11-10", is_settled: true },
          { id: "p_2_inst_2", participant_id: "p_2", installment_number: 2, total_installments: 2, amount_cents: 5000, due_date: "2026-12-10", is_settled: false },
        ],
        installmentsMode: "per_installment",
        totalCents: 20000,
      });

      expect(weights).toEqual([
        { expenseId: "e1", targetWeight: 0.5, changed: true },
        { expenseId: "e2", targetWeight: 1, changed: false },
      ]);
    });
  });

  describe("applySplitSettlementTransition", () => {
    it("retorna hostNetCostCents e remainingReceivableCents atualizados no mesmo ciclo (sem closure stale)", () => {
      const payload = makeSinglePayload();
      const res = applySplitSettlementTransition(payload, {
        type: "settle_full_participant",
        participantId: "p_2",
      });

      expect(res.totalSettledFromFriendsCents).toBe(10000);
      expect(res.hostNetCostCents).toBe(10000);
      expect(res.remainingReceivableCents).toBe(0);
      expect(res.isCompleted).toBe(true);
      expect(res.nextPayload.is_completed).toBe(true);
    });

    it("confirma sinal com múltiplas parcelas (installment_ids) e calcula saldo do anfitrião corretamente", () => {
      const payload = makeSinglePayload({
        total_cents: 30000,
        host_share_cents: 15000,
        guest_share_cents: 15000,
        participants: [
          { id: "p_1", name: "Gabriel", share_cents: 15000, is_host: true, is_settled: true, settled_cents: 15000 },
          { id: "p_2", name: "Lucas", share_cents: 15000, is_host: false, is_settled: false, settled_cents: 0, has_payment_signal: true },
        ],
        installments_count: 3,
        installments_mode: "per_installment",
        participant_installments: [
          { id: "p_2_inst_1", participant_id: "p_2", installment_number: 1, total_installments: 3, amount_cents: 5000, due_date: "2026-11-10", is_settled: false, signal_status: "pending_confirmation" },
          { id: "p_2_inst_2", participant_id: "p_2", installment_number: 2, total_installments: 3, amount_cents: 5000, due_date: "2026-12-10", is_settled: false, signal_status: "pending_confirmation" },
          { id: "p_2_inst_3", participant_id: "p_2", installment_number: 3, total_installments: 3, amount_cents: 5000, due_date: "2027-01-10", is_settled: false },
        ],
        payment_signals: [
          {
            id: "sig_1",
            participant_id: "p_2",
            participant_name: "Lucas",
            amount_cents: 10000,
            installment_ids: ["p_2_inst_1", "p_2_inst_2"],
            status: "pending",
            created_at: "2026-11-10T10:00:00Z",
          },
        ],
      });

      const res = applySplitSettlementTransition(payload, { type: "confirm_signal", signalId: "sig_1" });
      expect(res.totalSettledFromFriendsCents).toBe(10000);
      expect(res.hostNetCostCents).toBe(20000);
      expect(res.remainingReceivableCents).toBe(5000);
      expect(res.isCompleted).toBe(false);
      expect(res.nextPayload.payment_signals?.[0]?.status).toBe("confirmed");
      expect(res.nextPayload.participant_installments?.filter((i) => i.is_settled)).toHaveLength(2);
    });

    it("permite reabrir um racha concluído", () => {
      const settled = applySplitSettlementTransition(makeSinglePayload(), { type: "settle_all" });
      expect(settled.isCompleted).toBe(true);

      const reopened = applySplitSettlementTransition(settled.nextPayload, { type: "reopen" });
      expect(reopened.isCompleted).toBe(false);
      expect(reopened.totalSettledFromFriendsCents).toBe(0);
      expect(reopened.remainingReceivableCents).toBe(10000);
    });
  });

  describe("recalculateSplitPayloadOnEdit", () => {
    it("recalcula cotas, preserva pagamentos recebidos, regenera BR Code com novo Pix e detecta excedente", () => {
      const initial = makeSinglePayload({
        total_cents: 30000,
        people_count: 3,
        host_share_cents: 10000,
        guest_share_cents: 10000,
        participants: [
          { id: "p_1", name: "Gabriel", share_cents: 10000, is_host: true, is_settled: true, settled_cents: 10000 },
          { id: "p_2", name: "Lucas", share_cents: 10000, is_host: false, is_settled: true, settled_cents: 10000 },
          { id: "p_3", name: "Ana", share_cents: 10000, is_host: false, is_settled: false, settled_cents: 0 },
        ],
      });

      const res = recalculateSplitPayloadOnEdit(initial, {
        title: "Jantar Atualizado",
        totalCents: 24000,
        date: "2026-11-12",
        splitMode: "equal",
        remainderPolicy: "host",
        participants: [
          { id: "p_1", name: "Gabriel Sales", isHost: true },
          { id: "p_2", name: "Lucas Oliveira", isHost: false },
          { id: "p_3", name: "Ana Clara", isHost: false },
        ],
        pixKey: "79999887766",
        pixKeyType: "phone",
        hostName: "Gabriel Sales",
        hostCity: "Aracaju",
      });

      // Nova cota: 24000 / 3 = 8000; Lucas já havia pago 10000 -> excedente 2000
      expect(res.overpaidParticipants).toHaveLength(1);
      expect(res.overpaidParticipants[0]?.excessCents).toBe(2000);
      expect(res.totalSettledFromFriendsCents).toBe(8000);
      expect(res.remainingReceivableCents).toBe(8000);
      expect(res.hostNetCostCents).toBe(16000);

      // Pix BR Code regenerado com nova chave +55 e novo valor 8000 (R$ 80,00)
      expect(validatePixBrCode(res.nextPayload.pix_br_code)).toBe(true);
      const decoded = decodePixBrCode(res.nextPayload.pix_br_code);
      expect(decoded?.pixKey).toBe("+5579999887766");
      expect(decoded?.amountCents).toBe(8000);
      expect(decoded?.merchantName).toBe("Gabriel Sales");
    });

    it("suporta divisão customizada preservando invariante de centavos", () => {
      const res = recalculateSplitPayloadOnEdit(makeSinglePayload(), {
        title: "Churrasco",
        totalCents: 25000,
        date: "2026-11-15",
        splitMode: "custom",
        remainderPolicy: "host",
        participants: [
          { id: "p_1", name: "Gabriel", isHost: true, fixedCents: 5000 },
          { id: "p_2", name: "Lucas", isHost: false, fixedCents: 12000 },
          { id: "p_3", name: "Mariana", isHost: false, fixedCents: 8000 },
        ],
        pixKey: "gabriel@axir.com.br",
        pixKeyType: "email",
        hostName: "Gabriel",
        hostCity: "Aracaju",
      });

      const sumShares = res.nextPayload.participants.reduce((acc, p) => acc + p.share_cents, 0);
      expect(sumShares).toBe(25000);
      expect(res.nextPayload.participants[1]?.share_cents).toBe(12000);
      expect(res.nextPayload.participants[2]?.share_cents).toBe(8000);
    });

    it("escala cotas customizadas proporcionalmente quando total muda ou excede e remove sinais órfãos", () => {
      const initial = makeSinglePayload({
        total_cents: 20000,
        split_mode: "custom",
        participants: [
          { id: "p_1", name: "Gabriel", share_cents: 5000, is_host: true, is_settled: true, settled_cents: 5000 },
          { id: "p_2", name: "Lucas", share_cents: 10000, is_host: false, is_settled: false, settled_cents: 0, has_payment_signal: true },
          { id: "p_3", name: "Ana", share_cents: 5000, is_host: false, is_settled: false, settled_cents: 0, has_payment_signal: true },
        ],
        payment_signals: [
          { id: "sig_1", participant_id: "p_2", participant_name: "Lucas", amount_cents: 10000, status: "pending", created_at: "2026-11-10T10:00:00Z" },
          { id: "sig_2", participant_id: "p_3", participant_name: "Ana", amount_cents: 5000, status: "pending", created_at: "2026-11-10T10:05:00Z" },
        ],
      });

      const res = recalculateSplitPayloadOnEdit(initial, {
        title: "Churrasco Reduzido",
        totalCents: 10000,
        date: "2026-11-12",
        splitMode: "custom",
        remainderPolicy: "host",
        scaleCustomProportionally: true,
        participants: [
          { id: "p_1", name: "Gabriel", isHost: true, fixedCents: 5000 },
          { id: "p_2", name: "Lucas Silva", isHost: false, fixedCents: 10000 },
        ],
        pixKey: "gabriel@axir.com.br",
        pixKeyType: "email",
        hostName: "Gabriel",
        hostCity: "Aracaju",
      });

      const sumShares = res.nextPayload.participants.reduce((acc, p) => acc + p.share_cents, 0);
      expect(sumShares).toBe(10000);
      // Lucas foi mantido e escalado de 10000/15000 (~6666); Ana (p_3) foi removida e teve sinal descartado
      expect(res.nextPayload.participants.find((p) => p.id === "p_2")?.share_cents).toBe(6666);
      expect(res.nextPayload.payment_signals).toHaveLength(1);
      expect(res.nextPayload.payment_signals?.[0]?.participant_name).toBe("Lucas Silva");
    });
  });

  describe("resolveSplitExpirationIso", () => {
    it("estende validade automaticamente além da última parcela em rachas parcelados", () => {
      const now = new Date("2026-11-01T12:00:00Z").getTime();
      const exp12x = resolveSplitExpirationIso("2026-11-10", 12, 60, now);
      // 11 meses à frente (2027-10-10) + 60 dias ~ 2027-12-09
      expect(new Date(exp12x).getUTCFullYear()).toBe(2027);
      expect(new Date(exp12x).getUTCMonth()).toBeGreaterThanOrEqual(10);
    });
  });
});
