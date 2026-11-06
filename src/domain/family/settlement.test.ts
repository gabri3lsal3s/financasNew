import { describe, it, expect } from "vitest";
import {
  formatCentsToBrl,
  calculateFairShareDifference,
  generateSettlementPixPayload,
  resolveSettlementTransfers,
  formatSettlementSummaryText,
  validateSettlementPlanInvariants,
  buildSettlementAuditSnapshot,
  calculateSettlementFromReconciliation,
  calculateHouseholdSettlement,
  type SettlementMemberBalance,
  type HouseholdSettlementPlan,
} from "./settlement";
import { reconcileHouseholdSpending } from "./reconciliation";
import { validatePixBrCode, decodePixBrCode } from "../pix";

describe("settlement — Motor Puro de Compensação Justa Familiar via Pix", () => {
  // =========================================================================
  // 1. Formatação Monetária Determinística (BRL)
  // =========================================================================
  describe("1. Formatação Monetária BRL (formatCentsToBrl)", () => {
    it("formata valores positivos em centavos inteiros", () => {
      expect(formatCentsToBrl(0)).toBe("R$ 0,00");
      expect(formatCentsToBrl(99)).toBe("R$ 0,99");
      expect(formatCentsToBrl(15000)).toBe("R$ 150,00");
      expect(formatCentsToBrl(125050)).toBe("R$ 1.250,50");
      expect(formatCentsToBrl(1000000)).toBe("R$ 10.000,00");
    });

    it("formata valores negativos com prefixo de menos", () => {
      expect(formatCentsToBrl(-5000)).toBe("-R$ 50,00");
      expect(formatCentsToBrl(-125000)).toBe("-R$ 1.250,00");
    });

    it("lida com valores não finitos ou fracionários com resiliência", () => {
      expect(formatCentsToBrl(Number.NaN)).toBe("R$ 0,00");
      expect(formatCentsToBrl(1500.6)).toBe("R$ 15,01");
    });
  });

  // =========================================================================
  // 2. Apuração da Diferença da Cota Justa (Fair Share Difference)
  // =========================================================================
  describe("2. Diferença da Cota Justa (calculateFairShareDifference)", () => {
    it("identifica membro credor que gastou mais do que sua cota justa", () => {
      // Gastou R$ 350,00 (35.000 cents), cota justa R$ 200,00 (20.000 cents)
      const diff = calculateFairShareDifference(35000, 20000);

      expect(diff.net_balance_cents).toBe(15000); // Saldo +R$ 150,00
      expect(diff.must_receive_cents).toBe(15000);
      expect(diff.must_pay_cents).toBe(0);
      expect(diff.is_creditor).toBe(true);
      expect(diff.is_debtor).toBe(false);
      expect(diff.is_balanced).toBe(false);
      expect(diff.display_net_balance).toBe("R$ 150,00");
    });

    it("identifica membro devedor que gastou menos do que sua cota justa", () => {
      // Gastou R$ 50,00 (5.000 cents), cota justa R$ 200,00 (20.000 cents)
      const diff = calculateFairShareDifference(5000, 20000);

      expect(diff.net_balance_cents).toBe(-15000); // Saldo -R$ 150,00
      expect(diff.must_pay_cents).toBe(15000);
      expect(diff.must_receive_cents).toBe(0);
      expect(diff.is_creditor).toBe(false);
      expect(diff.is_debtor).toBe(true);
      expect(diff.is_balanced).toBe(false);
      expect(diff.display_net_balance).toBe("-R$ 150,00");
    });

    it("identifica membro perfeitamente equilibrado que gastou sua cota exata", () => {
      const diff = calculateFairShareDifference(20000, 20000);

      expect(diff.net_balance_cents).toBe(0);
      expect(diff.must_pay_cents).toBe(0);
      expect(diff.must_receive_cents).toBe(0);
      expect(diff.is_creditor).toBe(false);
      expect(diff.is_debtor).toBe(false);
      expect(diff.is_balanced).toBe(true);
      expect(diff.display_net_balance).toBe("R$ 0,00");
    });
  });

  // =========================================================================
  // 3. Geração de Payload Pix EMVCo para Compensação Instantânea
  // =========================================================================
  describe("3. Geração de Payload Pix EMVCo (generateSettlementPixPayload)", () => {
    it("gera BR Code válido com chave de e-mail e valor exato em centavos", () => {
      const result = generateSettlementPixPayload({
        pixKey: "maria.silva@email.com",
        merchantName: "Maria Silva",
        merchantCity: "Sao Paulo",
        amountCents: 15000, // R$ 150,00
        txId: "FAM20261101",
        infoAdicional: "Acerto Familia 2026-11",
      });

      expect(result.has_pix).toBe(true);
      expect(result.pix_payload).toBeDefined();
      expect(typeof result.pix_payload).toBe("string");
      expect(result.pix_payload).toContain("000201"); // Indicador EMVCo
      expect(result.pix_payload).toContain("br.gov.bcb.pix"); // GUI BACEN
      expect(result.pix_key).toBe("maria.silva@email.com");

      // Validação estrita de integridade CRC16 BACEN
      expect(validatePixBrCode(result.pix_payload!)).toBe(true);
      const decoded = decodePixBrCode(result.pix_payload!);
      expect(decoded).not.toBeNull();
      expect(decoded?.amountCents).toBe(15000);
    });

    it("gera BR Code com chave CPF normalizando pontuação", () => {
      const result = generateSettlementPixPayload({
        pixKey: "123.456.789-00",
        merchantName: "Joao Souza",
        merchantCity: "Rio de Janeiro",
        amountCents: 8520, // R$ 85,20
      });

      expect(result.has_pix).toBe(true);
      expect(result.pix_key).toBe("12345678900");
      expect(result.pix_payload).toBeDefined();

      expect(validatePixBrCode(result.pix_payload!)).toBe(true);
      const decoded = decodePixBrCode(result.pix_payload!);
      expect(decoded?.amountCents).toBe(8520);
    });

    it("gera BR Code com chave de celular formatada para E.164 (+55)", () => {
      const result = generateSettlementPixPayload({
        pixKey: "(11) 98765-4321",
        merchantName: "Ana Clara",
        amountCents: 5000,
      });

      expect(result.has_pix).toBe(true);
      expect(result.pix_key).toBe("+5511987654321");
    });

    it("lida graciosamente com chave ausente ou vazia sem lançar exceção", () => {
      const resultEmpty = generateSettlementPixPayload({
        pixKey: "",
        merchantName: "Alguem",
        amountCents: 5000,
      });

      expect(resultEmpty.has_pix).toBe(false);
      expect(resultEmpty.pix_payload).toBeNull();

      const resultNull = generateSettlementPixPayload({
        pixKey: "   ",
        merchantName: "Alguem",
        amountCents: 5000,
      });

      expect(resultNull.has_pix).toBe(false);
      expect(resultNull.pix_payload).toBeNull();
    });

    it("sanitiza caracteres acentuados no nome e cidade do recebedor", () => {
      const result = generateSettlementPixPayload({
        pixKey: "teste@email.com",
        merchantName: "João Álvares de Nóbrega",
        merchantCity: "São Luís",
        amountCents: 10000,
      });

      expect(result.has_pix).toBe(true);
      expect(validatePixBrCode(result.pix_payload!)).toBe(true);
      const decoded = decodePixBrCode(result.pix_payload!);
      // NFD e remoção de acentos garantem ASCII seguro
      expect(decoded?.merchantName).toBe("Joao Alvares de Nobrega");
      expect(decoded?.merchantCity).toBe("SAO LUIS");
    });
  });

  // =========================================================================
  // 4. Algoritmo de Liquidação de Transferências Mínimas
  // =========================================================================
  describe("4. Algoritmo de Transferências Mínimas (resolveSettlementTransfers)", () => {
    it("resolve transferência direta única para casal (2 membros) 50/50", () => {
      const balances: SettlementMemberBalance[] = [
        {
          user_id: "user_a",
          display_name: "Gabriel",
          spent_cents: 60000, // R$ 600,00
          fair_share_cents: 40000, // Cota 50%: R$ 400,00
          net_balance_cents: 20000, // Credor: +R$ 200,00
          pix_key: "gabriel@pix.com",
          pix_key_type: "email",
        },
        {
          user_id: "user_b",
          display_name: "Mariana",
          spent_cents: 20000, // R$ 200,00
          fair_share_cents: 40000, // Cota 50%: R$ 400,00
          net_balance_cents: -20000, // Devedora: -R$ 200,00
          pix_key: "mariana@pix.com",
          pix_key_type: "email",
        },
      ];

      const transfers = resolveSettlementTransfers(balances, { month: "2026-11" });

      expect(transfers).toHaveLength(1);
      const t = transfers[0]!;
      expect(t.payer_id).toBe("user_b");
      expect(t.payer_name).toBe("Mariana");
      expect(t.receiver_id).toBe("user_a");
      expect(t.receiver_name).toBe("Gabriel");
      expect(t.amount_cents).toBe(20000);
      expect(t.amount).toBe(200.0);
      expect(t.display_amount).toBe("R$ 200,00");
      expect(t.has_pix).toBe(true);
      expect(t.pix_key).toBe("gabriel@pix.com");
      expect(t.pix_payload).toBeDefined();
    });

    it("retorna lista vazia se todos os membros estiverem equilibrados", () => {
      const balances: SettlementMemberBalance[] = [
        {
          user_id: "user_a",
          display_name: "Gabriel",
          spent_cents: 30000,
          fair_share_cents: 30000,
          net_balance_cents: 0,
        },
        {
          user_id: "user_b",
          display_name: "Mariana",
          spent_cents: 30000,
          fair_share_cents: 30000,
          net_balance_cents: 0,
        },
      ];

      const transfers = resolveSettlementTransfers(balances);
      expect(transfers).toHaveLength(0);
    });

    it("resolve transferências mínimas eficientes para famílias com 3 ou mais membros", () => {
      // 1 credor (+300) e 2 devedores (-200 e -100)
      const balances: SettlementMemberBalance[] = [
        {
          user_id: "u1",
          display_name: "Credor Maior",
          spent_cents: 50000,
          fair_share_cents: 20000,
          net_balance_cents: 30000, // +300
          pix_key: "credor@email.com",
        },
        {
          user_id: "u2",
          display_name: "Devedor 1",
          spent_cents: 0,
          fair_share_cents: 20000,
          net_balance_cents: -20000, // -200
        },
        {
          user_id: "u3",
          display_name: "Devedor 2",
          spent_cents: 10000,
          fair_share_cents: 20000,
          net_balance_cents: -10000, // -100
        },
      ];

      const transfers = resolveSettlementTransfers(balances, { month: "2026-11" });

      expect(transfers).toHaveLength(2);

      // Devedor 1 (maior dívida) paga 200 para o Credor
      expect(transfers[0]!.payer_id).toBe("u2");
      expect(transfers[0]!.receiver_id).toBe("u1");
      expect(transfers[0]!.amount_cents).toBe(20000);

      // Devedor 2 paga 100 para o Credor
      expect(transfers[1]!.payer_id).toBe("u3");
      expect(transfers[1]!.receiver_id).toBe("u1");
      expect(transfers[1]!.amount_cents).toBe(10000);

      // Total de transferências liquida perfeitamente os 300 centavos
      const totalTransferred = transfers.reduce((acc, t) => acc + t.amount_cents, 0);
      expect(totalTransferred).toBe(30000);
    });
  });

  // =========================================================================
  // 5. Orquestrador Completo de Compensação Familiar (calculateHouseholdSettlement)
  // =========================================================================
  describe("5. Orquestrador Completo (calculateHouseholdSettlement)", () => {
    it("calcula acerto com divisão equitativa 50/50 e gera payload Pix completo", () => {
      const plan = calculateHouseholdSettlement({
        monthly_ceiling_cents: 200000, // R$ 2.000,00
        members: [
          {
            user_id: "u_gabriel",
            display_name: "Gabriel Sales",
            pix_key: "gabriel@email.com",
            pix_key_type: "email",
            role: "owner",
          },
          {
            user_id: "u_mariana",
            display_name: "Mariana Costa",
            pix_key: "mariana@email.com",
            pix_key_type: "email",
            role: "member",
          },
        ],
        expenses: [
          { id: "e1", user_id: "u_gabriel", amount_cents: 18000, date: "2026-11-02" }, // R$ 180,00
          { id: "e2", user_id: "u_gabriel", amount_cents: 12000, date: "2026-11-03" }, // R$ 120,00 (Total Gabriel: 300,00)
          { id: "e3", user_id: "u_mariana", amount_cents: 10000, date: "2026-11-04" }, // R$ 100,00 (Total Mariana: 100,00)
        ],
        options: {
          month: "2026-11",
          splitRule: "equal",
        },
      });

      // Total gasto: R$ 400,00. Cota de cada um: R$ 200,00.
      expect(plan.total_spent_cents).toBe(40000);
      expect(plan.split_rule).toBe("equal");
      expect(plan.is_balanced).toBe(false);
      expect(plan.total_settlement_cents).toBe(10000); // R$ 100,00

      // Membros
      expect(plan.members).toHaveLength(2);
      const gabriel = plan.members.find((m) => m.user_id === "u_gabriel")!;
      const mariana = plan.members.find((m) => m.user_id === "u_mariana")!;

      expect(gabriel.spent_cents).toBe(30000);
      expect(gabriel.fair_share_cents).toBe(20000);
      expect(gabriel.net_balance_cents).toBe(10000);
      expect(gabriel.must_receive_cents).toBe(10000);
      expect(gabriel.is_creditor).toBe(true);

      expect(mariana.spent_cents).toBe(10000);
      expect(mariana.fair_share_cents).toBe(20000);
      expect(mariana.net_balance_cents).toBe(-10000);
      expect(mariana.must_pay_cents).toBe(10000);
      expect(mariana.is_debtor).toBe(true);

      // Transferência Mariana -> Gabriel
      expect(plan.transfers).toHaveLength(1);
      const transfer = plan.transfers[0]!;
      expect(transfer.payer_id).toBe("u_mariana");
      expect(transfer.receiver_id).toBe("u_gabriel");
      expect(transfer.amount_cents).toBe(10000);
      expect(transfer.display_amount).toBe("R$ 100,00");
      expect(transfer.has_pix).toBe(true);
      expect(transfer.pix_payload).toBeDefined();

      // Invariantes estritas
      const inv = validateSettlementPlanInvariants(plan);
      expect(inv.valid).toBe(true);
      expect(inv.errors).toHaveLength(0);
    });

    it("calcula acerto com divisão proporcional à renda (ex.: 70% / 30%)", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          {
            user_id: "u_socio_a",
            display_name: "Sócio A",
            income_cents: 700000, // R$ 7.000,00 (70%)
            pix_key: "socioa@email.com",
          },
          {
            user_id: "u_socio_b",
            display_name: "Sócio B",
            income_cents: 300000, // R$ 3.000,00 (30%)
            pix_key: "sociob@email.com",
          },
        ],
        expenses: [
          // Gastaram R$ 500,00 cada um (total R$ 1.000,00)
          { id: "e1", user_id: "u_socio_a", amount_cents: 50000, date: "2026-11-01" },
          { id: "e2", user_id: "u_socio_b", amount_cents: 50000, date: "2026-11-01" },
        ],
        options: {
          month: "2026-11",
          splitRule: "proportional",
        },
      });

      // Total gasto: 100.000. Cota A (70%): 70.000. Cota B (30%): 30.000.
      const socioA = plan.members.find((m) => m.user_id === "u_socio_a")!;
      const socioB = plan.members.find((m) => m.user_id === "u_socio_b")!;

      expect(socioA.fair_share_cents).toBe(70000);
      expect(socioA.net_balance_cents).toBe(-20000); // Gastou 500, devia 700 -> deve 200
      expect(socioA.must_pay_cents).toBe(20000);

      expect(socioB.fair_share_cents).toBe(30000);
      expect(socioB.net_balance_cents).toBe(20000); // Gastou 500, devia 300 -> recebe 200
      expect(socioB.must_receive_cents).toBe(20000);

      // Sócio A transfere R$ 200,00 para Sócio B
      expect(plan.transfers).toHaveLength(1);
      expect(plan.transfers[0]!.payer_id).toBe("u_socio_a");
      expect(plan.transfers[0]!.receiver_id).toBe("u_socio_b");
      expect(plan.transfers[0]!.amount_cents).toBe(20000);

      const inv = validateSettlementPlanInvariants(plan);
      expect(inv.valid).toBe(true);
    });

    it("preserva centavos ímpares centavo a centavo sem perda residual", () => {
      // Gasto ímpar: R$ 100,01 (10.001 cents) com 50/50
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: "P1", pix_key: "p1@email.com" },
          { user_id: "u2", display_name: "P2", pix_key: "p2@email.com" },
        ],
        expenses: [
          { id: "e1", user_id: "u1", amount_cents: 10001, date: "2026-11-01" },
        ],
        options: {
          month: "2026-11",
          splitRule: "equal",
        },
      });

      expect(plan.total_spent_cents).toBe(10001);
      const m1 = plan.members.find((m) => m.user_id === "u1")!;
      const m2 = plan.members.find((m) => m.user_id === "u2")!;

      // Algoritmo do Maior Resto (Hamilton-Hare) aloca 5001 e 5000 centavos
      expect(m1.fair_share_cents + m2.fair_share_cents).toBe(10001);
      expect(plan.transfers[0]!.amount_cents).toBe(m2.must_pay_cents);

      const inv = validateSettlementPlanInvariants(plan);
      expect(inv.valid).toBe(true);
    });

    it("sinaliza has_missing_pix_keys quando o recebedor não cadastrou chave", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u_sem_pix", display_name: "Sem Chave Pix", pix_key: null },
          { user_id: "u_com_pix", display_name: "Com Chave", pix_key: "com@pix.com" },
        ],
        expenses: [
          // O usuário sem pix é quem gastou mais (será credor)
          { id: "e1", user_id: "u_sem_pix", amount_cents: 20000, date: "2026-11-01" },
        ],
      });

      expect(plan.has_missing_pix_keys).toBe(true);
      expect(plan.transfers[0]!.has_pix).toBe(false);
      expect(plan.transfers[0]!.pix_payload).toBeNull();
      expect(plan.transfers[0]!.amount_cents).toBe(10000);
    });
  });

  // =========================================================================
  // 6. Integração com Reconciliação Existente (calculateSettlementFromReconciliation)
  // =========================================================================
  describe("6. Integração com Reconciliação (calculateSettlementFromReconciliation)", () => {
    it("constrói plano a partir de HouseholdReconciliationResult pré-calculado", () => {
      const reconciliation = reconcileHouseholdSpending({
        monthly_ceiling_cents: 500000,
        members: [
          { user_id: "m1", display_name: "Membro 1", pix_key: "m1@pix.com" },
          { user_id: "m2", display_name: "Membro 2", pix_key: "m2@pix.com" },
        ],
        expenses: [
          { id: "e1", user_id: "m1", amount_cents: 40000, date: "2026-11-05" },
        ],
      });

      const plan = calculateSettlementFromReconciliation(reconciliation);

      expect(plan.total_spent_cents).toBe(40000);
      expect(plan.transfers).toHaveLength(1);
      expect(plan.transfers[0]!.payer_id).toBe("m2");
      expect(plan.transfers[0]!.receiver_id).toBe("m1");
      expect(plan.transfers[0]!.amount_cents).toBe(20000);
    });
  });

  // =========================================================================
  // 7. Validação de Invariantes Contábeis (validateSettlementPlanInvariants)
  // =========================================================================
  describe("7. Invariantes Contábeis (validateSettlementPlanInvariants)", () => {
    it("detecta violação se o total de transferências divergir da soma das dívidas", () => {
      const plan: HouseholdSettlementPlan = {
        month: "2026-11",
        split_rule: "equal",
        total_spent_cents: 40000,
        total_settlement_cents: 10000,
        is_balanced: false,
        has_missing_pix_keys: false,
        members: [
          {
            user_id: "u1",
            display_name: "P1",
            role: "owner",
            spent_cents: 30000,
            fair_share_cents: 20000,
            net_balance_cents: 10000,
            display_net_balance: "R$ 100,00",
            must_pay_cents: 0,
            must_receive_cents: 10000,
            is_creditor: true,
            is_debtor: false,
            is_balanced: false,
            has_pix_key: true,
            pix_key: "p1@pix.com",
            pix_key_type: "email",
          },
          {
            user_id: "u2",
            display_name: "P2",
            role: "member",
            spent_cents: 10000,
            fair_share_cents: 20000,
            net_balance_cents: -10000,
            display_net_balance: "-R$ 100,00",
            must_pay_cents: 10000,
            must_receive_cents: 0,
            is_creditor: false,
            is_debtor: true,
            is_balanced: false,
            has_pix_key: true,
            pix_key: "p2@pix.com",
            pix_key_type: "email",
          },
        ],
        transfers: [
          // Transferência com valor divergente (corrompido para 5.000 em vez de 10.000)
          {
            id: "t1",
            payer_id: "u2",
            payer_name: "P2",
            receiver_id: "u1",
            receiver_name: "P1",
            amount_cents: 5000,
            amount: 50.0,
            display_amount: "R$ 50,00",
            pix_key: "p1@pix.com",
            pix_key_type: "email",
            has_pix: true,
            pix_payload: "payload",
            tx_id: "FAM1",
            description: "Desc",
          },
        ],
        summary_text: "Summary",
        settled_at: null,
      };

      const result = validateSettlementPlanInvariants(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("detecta violação se houver transferência para si mesmo", () => {
      const plan: HouseholdSettlementPlan = {
        month: "2026-11",
        split_rule: "equal",
        total_spent_cents: 20000,
        total_settlement_cents: 10000,
        is_balanced: false,
        has_missing_pix_keys: false,
        members: [
          {
            user_id: "u1",
            display_name: "P1",
            role: "owner",
            spent_cents: 20000,
            fair_share_cents: 10000,
            net_balance_cents: 10000,
            display_net_balance: "R$ 100,00",
            must_pay_cents: 10000,
            must_receive_cents: 10000,
            is_creditor: true,
            is_debtor: false,
            is_balanced: false,
            has_pix_key: true,
            pix_key: "p1@pix.com",
            pix_key_type: "email",
          },
        ],
        transfers: [
          {
            id: "t1",
            payer_id: "u1",
            payer_name: "P1",
            receiver_id: "u1", // Mesmo participante
            receiver_name: "P1",
            amount_cents: 10000,
            amount: 100.0,
            display_amount: "R$ 100,00",
            pix_key: "p1@pix.com",
            pix_key_type: "email",
            has_pix: true,
            pix_payload: "payload",
            tx_id: "FAM1",
            description: "Desc",
          },
        ],
        summary_text: "Summary",
        settled_at: null,
      };

      const result = validateSettlementPlanInvariants(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("mesmo pagador e recebedor"))).toBe(true);
    });
  });

  // =========================================================================
  // 8. Snapshot de Auditoria (buildSettlementAuditSnapshot)
  // =========================================================================
  describe("8. Snapshot de Auditoria (buildSettlementAuditSnapshot)", () => {
    it("monta snapshot JSON estruturado para persistência em family_settlements", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: "P1", pix_key: "p1@pix.com" },
          { user_id: "u2", display_name: "P2", pix_key: "p2@pix.com" },
        ],
        expenses: [
          { id: "e1", user_id: "u1", amount_cents: 10000, date: "2026-11-01" },
        ],
        options: { month: "2026-11" },
      });

      const snapshot = buildSettlementAuditSnapshot(plan, {
        created_by: "u1",
        notes: "Acerto mensal aprovado",
      });

      expect(snapshot.month).toBe("2026-11");
      expect(snapshot.split_rule).toBe("equal");
      expect(snapshot.total_spent_cents).toBe(10000);
      expect(snapshot.created_by).toBe("u1");
      expect(snapshot.notes).toBe("Acerto mensal aprovado");
      expect(Array.isArray(snapshot.members)).toBe(true);
      expect(Array.isArray(snapshot.transfers)).toBe(true);
    });
  });

  // =========================================================================
  // 9. Formatação do Resumo Executivo em Texto (formatSettlementSummaryText)
  // =========================================================================
  describe("9. Formatação do Sumário (formatSettlementSummaryText)", () => {
    it("gera texto amigável sem emojis e sem caracteres Unicode decorativos", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: "Lucas", pix_key: "lucas@pix.com" },
          { user_id: "u2", display_name: "Juliana", pix_key: "juliana@pix.com" },
        ],
        expenses: [
          { id: "e1", user_id: "u1", amount_cents: 80000, date: "2026-11-01" },
          { id: "e2", user_id: "u2", amount_cents: 20000, date: "2026-11-02" },
        ],
        options: { month: "2026-11" },
      });

      const text = formatSettlementSummaryText(plan);

      expect(text).toContain("ACERTO DE CONTAS FAMILIAR - 2026-11");
      expect(text).toContain("Regra de divisao: Divisao equitativa (50/50)");
      expect(text).toContain("Gastos totais da casa: R$ 1.000,00");
      expect(text).toContain("Volume de compensacao: R$ 300,00");
      expect(text).toContain("Juliana deve pagar R$ 300,00 para Lucas");
      expect(text).toContain("Chave Pix: lucas@pix.com");
      expect(text).toContain("Pix Copia e Cola:");

      // Regra SAGRADA: Zero emojis ou decorativos Unicode em strings
      const decorativeBmp = /[\u2190-\u21ff\u2300-\u23ff\u25a0-\u27bf\u2b00-\u2bff]/;
      const hasEmoji = /\p{Extended_Pictographic}/u;
      expect(decorativeBmp.test(text)).toBe(false);
      expect(hasEmoji.test(text)).toBe(false);
    });

    it("gera mensagem clara quando as contas já estão equilibradas", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: "Lucas" },
          { user_id: "u2", display_name: "Juliana" },
        ],
        expenses: [
          { id: "e1", user_id: "u1", amount_cents: 50000, date: "2026-11-01" },
          { id: "e2", user_id: "u2", amount_cents: 50000, date: "2026-11-01" },
        ],
      });

      const text = formatSettlementSummaryText(plan);
      expect(text).toContain("As contas da casa estao equilibradas. Nenhuma transferencia necessaria.");
    });
  });

  // =========================================================================
  // 10. Casos de Borda e Robustez Adicional
  // =========================================================================
  describe("10. Casos de Borda e Robustez Adicional", () => {
    it("respeita customizações de defaultCity e descriptionPrefix nas opções", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: "Ana", pix_key: "ana@email.com" },
          { user_id: "u2", display_name: "Beto", pix_key: "beto@email.com" },
        ],
        expenses: [
          { id: "e1", user_id: "u1", amount_cents: 10000, date: "2026-11-01" },
        ],
        options: {
          month: "2026-11",
          defaultCity: "CURITIBA",
          descriptionPrefix: "Rateio do Ap",
        },
      });

      expect(plan.transfers[0]!.description).toBe("Rateio do Ap - 2026-11");
      const decoded = decodePixBrCode(plan.transfers[0]!.pix_payload!);
      expect(decoded?.merchantCity).toBe("CURITIBA");
    });

    it("lida com lista de despesas vazia mantendo invariantes e status equilibrado", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: "Ana", pix_key: "ana@email.com" },
          { user_id: "u2", display_name: "Beto", pix_key: "beto@email.com" },
        ],
        expenses: [],
        options: { month: "2026-11" },
      });

      expect(plan.total_spent_cents).toBe(0);
      expect(plan.total_settlement_cents).toBe(0);
      expect(plan.is_balanced).toBe(true);
      expect(plan.transfers).toHaveLength(0);

      const inv = validateSettlementPlanInvariants(plan);
      expect(inv.valid).toBe(true);
    });

    it("computa competência através de referenceDate quando month não é informado", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: "Ana", pix_key: "ana@email.com" },
          { user_id: "u2", display_name: "Beto", pix_key: "beto@email.com" },
        ],
        expenses: [
          { id: "e1", user_id: "u1", amount_cents: 10000, date: "2026-08-15" },
        ],
        options: {
          referenceDate: new Date("2026-08-15T12:00:00Z"),
        },
      });

      expect(plan.month).toBe("2026-08");
    });

    it("lida com participante sem display_name usando fallback seguro", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: null, pix_key: "u1@pix.com" },
          { user_id: "u2", display_name: "Beto", pix_key: "beto@email.com" },
        ],
        expenses: [
          { id: "e1", user_id: "u1", amount_cents: 20000, date: "2026-11-01" },
        ],
      });

      expect(plan.transfers[0]!.receiver_name).toBe("Participante");
      const decoded = decodePixBrCode(plan.transfers[0]!.pix_payload!);
      expect(decoded?.merchantName).toBe("Participante");
    });

    it("trata incomes e preserva total_settlement_cents sob proporção de renda", () => {
      const plan = calculateHouseholdSettlement({
        members: [
          { user_id: "u1", display_name: "Carlos", pix_key: "carlos@pix.com" },
          { user_id: "u2", display_name: "Diana", pix_key: "diana@pix.com" },
        ],
        expenses: [
          { id: "e1", user_id: "u1", amount_cents: 30000, date: "2026-11-01" },
          { id: "e2", user_id: "u2", amount_cents: 10000, date: "2026-11-01" },
        ],
        incomes: [
          { user_id: "u1", amount_cents: 600000 }, // R$ 6.000 (60%)
          { user_id: "u2", amount_cents: 400000 }, // R$ 4.000 (40%)
        ],
        options: {
          splitRule: "proportional",
        },
      });

      // Total gasto: 40.000. Cota Carlos (60%): 24.000. Cota Diana (40%): 16.000.
      // Carlos pagou 30.000, devia 24.000 -> saldo +6.000 (credor).
      // Diana pagou 10.000, devia 16.000 -> saldo -6.000 (devedora).
      expect(plan.total_settlement_cents).toBe(6000);
      expect(plan.transfers[0]!.payer_id).toBe("u2");
      expect(plan.transfers[0]!.receiver_id).toBe("u1");
      expect(plan.transfers[0]!.amount_cents).toBe(6000);

      const inv = validateSettlementPlanInvariants(plan);
      expect(inv.valid).toBe(true);
    });
  });
});
