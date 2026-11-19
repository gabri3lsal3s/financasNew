/**
 * Persona Módulos Avançados — Pix EMV, Reserva D+0/D+1, Quitação de Dívidas e Backup
 *
 * Módulos: Fluxo de Caixa, Dívidas/Empréstimos, Investimentos.
 * Valida a conformidade do padrão BACEN EMV TLV e CRC-16 CCITT (0x1021),
 * categorização de liquidez D+0 vs D+30 na reserva de emergência,
 * simulação Bola de Neve vs Avalanche e integridade de payload de backup.
 */

import type { TheoreticalPersona, AdvancedModulesState } from "./types";
import { generatePixBrCode } from "@/domain/pix/pix-br-code";

export const personaAdvancedModules: TheoreticalPersona<AdvancedModulesState> = {
  id: "persona-advanced-modules",
  name: "Módulos Avançados & Auxiliares",
  description:
    "Testa Pix EMV com CRC-16 BACEN, runway D+0/D+1, comparador Bola de Neve vs Avalanche e hash de integridade SHA-256.",
  targetModules: ["auxiliary", "debts", "portfolio", "projection"],
  instantiate: (): AdvancedModulesState => {
    // Gerar código Pix determinístico
    const pixData = generatePixBrCode({
      pixKey: "suporte@axir.app",
      keyType: "email",
      merchantName: "Axir Tecnologia",
      merchantCity: "Sao Paulo",
      amountCents: 15_000, // R$ 150,00
      txId: "AXIR20261118",
    });

    const crc = pixData.slice(-4);

    return {
      pixBrCode: {
        rawPayload: pixData,
        expectedCrc: crc,
        amountCents: 15_000,
        pixKey: "suporte@axir.app",
        merchantName: "Axir Tecnologia",
        merchantCity: "Sao Paulo",
      },
      emergencyRunway: {
        liquidAssetsCents: 3_000_000, // R$ 30.000,00 em contas e Selic D+0
        lockedAssetsCents: 5_000_000, // R$ 50.000,00 em ativos D+30
        monthlyBurnCents: 500_000, // R$ 5.000,00 custo de vida mensal
        expectedMonthsCovered: 6.0, // 30.000 / 5.000 = 6 meses de cobertura
      },
      debtPayoffComparison: [
        {
          id: "debt-small",
          name: "Cheque Especial",
          balanceCents: 200_000, // R$ 2.000,00 (menor saldo)
          monthlyRatePercent: 8.0,
          minPaymentCents: 20_000,
        },
        {
          id: "debt-card",
          name: "Cartão Rotativo",
          balanceCents: 800_000, // R$ 8.000,00 (maior taxa)
          monthlyRatePercent: 12.0,
          minPaymentCents: 80_000,
        },
        {
          id: "debt-payroll",
          name: "Consignado Caixa",
          balanceCents: 1_500_000, // R$ 15.000,00 (maior saldo, menor taxa)
          monthlyRatePercent: 1.8,
          minPaymentCents: 60_000,
        },
      ],
      backupIntegrity: {
        contentJson: JSON.stringify({
          app: "axir",
          version: "3.12.0",
          timestampIso: "2026-11-18T21:00:00Z",
          user: "user-deterministic-test",
          recordsCount: 42,
        }),
        // Hash de integridade de referência
        expectedSha256Hex: "78f7aa945b0fead520ec70ca5ff0eb3cb377319323ff1eb4ec3bc7c653457a3e",
      },
      statefulUrlPayload: {
        uncompressedState: {
          tab: "investments",
          filterClass: "internacional",
          dateRange: "2026-11",
          activeSort: "value_desc",
        },
      },
    };
  },
};
