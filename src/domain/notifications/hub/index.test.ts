import { describe, expect, it } from "vitest";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { ReminderItem } from "@/domain/reminders";
import type {
  Budget,
  CardPayment,
  Category,
  CreditCard,
  Expense,
  MyFamilyData,
  PublicShare,
  SupportTicket,
  UserBroadcastNotification,
  UserSubscription,
} from "@/types";
import type { Trip } from "@/types/trips";
import {
  buildNotificationCenter,
  DEFAULT_NOTIFICATION_CATEGORY_PREFERENCES,
  deduplicateNotifications,
  detectClosedCardBills,
  detectConsolidatedBudgetOverrun,
  detectTripAndFamilyPendingAlerts,
  extractPendingSplitSignals,
  invoiceClosingDate,
  resolveNotificationCategoryPreferences,
} from "./index";

describe("Notification Hub (buildNotificationCenter)", () => {
  const payableOverdue: ReminderItem = {
    key: "bill:c1:2026-08",
    kind: "bill",
    direction: "payable",
    title: "Fatura Nubank",
    subtitle: "Fatura 2026-08",
    dueDate: "2026-08-01",
    amountCents: 150000,
    status: "overdue",
    link: { path: "/cartoes", params: { card: "c1", month: "2026-08" } },
  };

  const payableDueSoon: ReminderItem = {
    key: "debt:d1",
    kind: "debt",
    direction: "payable",
    title: "Aluguel",
    subtitle: "A pagar",
    dueDate: "2026-08-10",
    amountCents: 250000,
    status: "due_soon",
    link: { path: "/dividas", params: { q: "d1" } },
  };

  const receivablePending: ReminderItem = {
    key: "debt:r1",
    kind: "debt",
    direction: "receivable",
    title: "Empréstimo João",
    subtitle: "A receber",
    dueDate: "2026-08-05",
    amountCents: 40000,
    status: "pending",
    link: { path: "/dividas", params: { q: "r1" } },
  };

  it("classifica pagáveis atrasados como P0_CRITICAL, em breve como P1_ACTION_NEEDED e recebíveis como P2_ADVISORY sem os_push", () => {
    const center = buildNotificationCenter({
      reminderItems: [receivablePending, payableDueSoon, payableOverdue],
    });

    expect(center.payableItems).toHaveLength(2);
    expect(center.receivableItems).toHaveLength(1);
    expect(center.criticalCount).toBe(1);
    expect(center.actionNeededCount).toBe(1);
    expect(center.urgentBellCount).toBe(2);
    expect(center.totalBellCount).toBe(3);
    expect(center.highestSeverity).toBe("P0_CRITICAL");

    const receivableNotif = center.notifications.find((n) => n.id === "debt:r1");
    expect(receivableNotif?.severity).toBe("P2_ADVISORY");
    expect(receivableNotif?.badgeVariant).toBe("portfolio");
    expect(receivableNotif?.channels).not.toContain("os_push");

    // Ordenado por severidade: P0 -> P1 -> P2
    expect(center.notifications.map((n) => n.id)).toEqual([
      "bill:c1:2026-08",
      "debt:d1",
      "debt:r1",
    ]);
  });

  it("deduplica insights do SmartAdvisor que referenciam a mesma fatura ou dívida já presente nos lembretes", () => {
    const duplicateBillAdvisor: SmartAdvisorInsight = {
      id: "bill_overdue:c1",
      themeKey: "bill_overdue:c1",
      priority: 1,
      category: "critical",
      title: "Fatura Nubank em atraso",
      description: "Evite juros rotativos.",
      iconName: "alert-triangle",
      metadata: { valueCents: 150000, cardId: "c1" },
    };

    const independentAdvisor: SmartAdvisorInsight = {
      id: "expected_income:salary",
      themeKey: "expected_income:salary",
      priority: 2,
      category: "income",
      title: "Salário previsto",
      description: "Receita recorrente esperada para hoje.",
      iconName: "arrow-down-left",
      metadata: { valueCents: 800000 },
      primaryAction: {
        label: "Confirmar",
        kind: "confirm_income",
      },
    };

    const center = buildNotificationCenter({
      reminderItems: [payableOverdue],
      advisorInsights: [duplicateBillAdvisor, independentAdvisor],
    });

    expect(center.advisorAlerts).toHaveLength(1);
    expect(center.advisorAlerts[0]?.id).toBe("expected_income:salary");
    expect(center.notifications.map((n) => n.id)).toEqual([
      "bill:c1:2026-08",
      "advisor:expected_income:salary",
    ]);
  });

  it("extrai sinalizações de pagamento Pix pendentes de rachas ativos como P1_ACTION_NEEDED", () => {
    const activeShare: PublicShare = {
      id: "share-1",
      user_id: "u1",
      token: "tok-123",
      kind: "split",
      is_revoked: false,
      expires_at: null,
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T12:00:00Z",
      payload: {
        title: "Churrasco Domingo",
        total_cents: 20000,
        date: "2026-08-01",
        people_count: 4,
        guest_share_cents: 5000,
        host_share_cents: 5000,
        participants: [],
        remainder_policy: "host",
        host_name: "Gabriel",
        host_city: "SP",
        pix_key: "123",
        pix_key_type: "cpf",
        pix_br_code: "000201",
        payment_signals: [
          {
            id: "sig-1",
            participant_name: "Carlos",
            amount_cents: 5000,
            created_at: "2026-08-01T14:00:00Z",
            status: "pending",
          },
          {
            id: "sig-2",
            participant_name: "Ana",
            amount_cents: 5000,
            created_at: "2026-08-01T11:00:00Z",
            status: "confirmed",
          },
        ],
      },
    };

    const groups = extractPendingSplitSignals([activeShare]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.totalCents).toBe(5000);
    expect(groups[0]?.signals).toHaveLength(1);

    const center = buildNotificationCenter({
      splitShares: [activeShare],
    });

    expect(center.pendingSplitSignals).toHaveLength(1);
    expect(center.actionNeededCount).toBe(1);
    expect(center.notifications[0]?.id).toBe("split_signal:share-1");
    expect(center.notifications[0]?.severity).toBe("P1_ACTION_NEEDED");
    expect(center.notifications[0]?.badgeLabel).toBe("Pix Sinalizado");
  });

  it("inclui assinatura past_due (P0), broadcasts não lidos/não expirados e tickets de suporte com resposta", () => {
    const subscription = {
      user_id: "u1",
      plan_code: "pro_monthly",
      status: "past_due",
    } as unknown as UserSubscription;

    const broadcasts: UserBroadcastNotification[] = [
      {
        id: "b-crit",
        title: "Manutenção emergencial",
        message: "Instabilidade no provedor",
        type: "critical",
        action_url: null,
        action_label: null,
        created_at: "2026-08-02T10:00:00Z",
        is_read: false,
      },
      {
        id: "b-expired",
        title: "Campanha antiga",
        message: "Já expirou",
        type: "promotion",
        action_url: null,
        action_label: null,
        created_at: "2026-01-01T10:00:00Z",
        is_read: false,
        expires_at: "2020-01-01T00:00:00Z",
      },
    ];

    const supportTickets: SupportTicket[] = [
      {
        id: "t-1",
        subject: "Dúvida sobre fatura",
        admin_reply: "Respondido!",
        user_read_at: null,
        updated_at: "2026-08-02T11:00:00Z",
      } as unknown as SupportTicket,
    ];

    const center = buildNotificationCenter({
      subscription,
      broadcasts,
      supportTickets,
    });

    expect(center.hasPastDueSubscription).toBe(true);
    expect(center.unreadBroadcasts).toHaveLength(1);
    expect(center.unreadSupportTickets).toHaveLength(1);
    expect(center.criticalCount).toBe(2); // subscription:past_due + b-crit
    expect(center.actionNeededCount).toBe(1); // t-1
    expect(center.totalBellCount).toBe(3);
  });

  it("deduplicateNotifications mantém o item de maior severidade quando entityRefs colidem", () => {
    const list = deduplicateNotifications([
      {
        id: "low",
        domain: "cashflow",
        severity: "P2_ADVISORY",
        title: "Aviso menor",
        body: "Detalhe",
        badgeLabel: "Aviso",
        badgeVariant: "default",
        tone: "info",
        iconName: "sparkles",
        targetRoute: "/cartoes",
        channels: ["bell"],
        entityRefs: ["card:c1"],
        state: "unread",
      },
      {
        id: "high",
        domain: "payable",
        severity: "P0_CRITICAL",
        title: "Fatura vencida",
        body: "Urgente",
        badgeLabel: "Vencido",
        badgeVariant: "critical",
        tone: "critical",
        iconName: "credit-card",
        targetRoute: "/cartoes",
        channels: ["bell"],
        entityRefs: ["card:c1"],
        state: "unread",
      },
    ]);

    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("high");
  });

  it("respeita filtros granulares por categoria e mantém fechamento de fatura opt-in por padrão", () => {
    expect(DEFAULT_NOTIFICATION_CATEGORY_PREFERENCES.billClosing).toBe(false);
    expect(resolveNotificationCategoryPreferences().billClosing).toBe(false);
    expect(resolveNotificationCategoryPreferences({ billClosing: true }).billClosing).toBe(true);

    const closedAlert = {
      key: "bill_closed:c2:2026-08",
      cardId: "c2",
      cardName: "Itaú",
      competenceMonth: "2026-08",
      closingDate: "2026-08-05",
      dueDate: "2026-08-15",
      balanceCents: 98000,
      targetRoute: "/cartoes?card=c2&month=2026-08",
    };

    const budgetAlert = {
      id: "budget:overrun:2026-08",
      month: "2026-08",
      exceededCount: 2,
      totalExcessCents: 35000,
      topCategories: [
        {
          categoryId: "cat-1",
          categoryName: "Alimentação",
          limitCents: 100000,
          spentCents: 125000,
          excessCents: 25000,
        },
      ],
      entityRefs: ["budget:overrun:2026-08"],
      targetRoute: "/orcamentos?tab=limits",
    };

    const tripAlert = {
      id: "trip:settlement:t1",
      kind: "trip_settlement" as const,
      title: "Acerto pendente: Campos",
      body: "Acerto pendente.",
      badgeLabel: "Viagem",
      targetRoute: "/viagens/t1",
      entityRefs: ["trip:t1"],
    };

    const defaultCenter = buildNotificationCenter({
      reminderItems: [payableOverdue, receivablePending],
      closedBillAlerts: [closedAlert],
      budgetOverrunAlert: budgetAlert,
      tripAndFamilyAlerts: [tripAlert],
    });

    // billClosing desabilitado por padrão -> fechado omitido
    expect(defaultCenter.closedBillAlerts).toHaveLength(0);
    expect(defaultCenter.budgetOverrunAlert).not.toBeNull();
    expect(defaultCenter.tripAndFamilyAlerts).toHaveLength(1);
    expect(defaultCenter.receivableItems).toHaveLength(1);

    // Habilitando billClosing e desabilitando receivables/budgets/family
    const filteredCenter = buildNotificationCenter({
      reminderItems: [payableOverdue, receivablePending],
      closedBillAlerts: [
        closedAlert,
        // Duplicado de bill:c1:2026-08 já presente em payableOverdue -> deve ser suprimido
        {
          ...closedAlert,
          key: "bill_closed:c1:2026-08",
          cardId: "c1",
          cardName: "Nubank",
        },
      ],
      budgetOverrunAlert: budgetAlert,
      tripAndFamilyAlerts: [tripAlert],
      categoryPreferences: {
        billClosing: true,
        receivablesAndSplits: false,
        budgetsAndPace: false,
        familyAndTrips: false,
      },
    });

    expect(filteredCenter.closedBillAlerts).toHaveLength(1);
    expect(filteredCenter.closedBillAlerts[0]?.cardId).toBe("c2");
    expect(filteredCenter.receivableItems).toHaveLength(0);
    expect(filteredCenter.budgetOverrunAlert).toBeNull();
    expect(filteredCenter.tripAndFamilyAlerts).toHaveLength(0);
    expect(filteredCenter.notifications.map((n) => n.id)).toEqual([
      "bill:c1:2026-08",
      "bill_closed:c2:2026-08",
    ]);
  });

  it("preserva múltiplas faturas em aberto do mesmo cartão e formata datas pt-BR", () => {
    const billJul: ReminderItem = {
      ...payableOverdue,
      key: "bill:c1:2026-07",
      title: "Fatura Nubank · Jul/2026",
      dueDate: "2026-07-01",
      status: "overdue",
      link: { path: "/cartoes", params: { card: "c1", month: "2026-07" } },
    };
    const billAug: ReminderItem = {
      ...payableOverdue,
      key: "bill:c1:2026-08",
      title: "Fatura Nubank · Ago/2026",
      dueDate: "2026-08-10",
      status: "due_soon",
      link: { path: "/cartoes", params: { card: "c1", month: "2026-08" } },
    };

    const center = buildNotificationCenter({
      reminderItems: [billJul, billAug],
      closedBillAlerts: [
        {
          key: "bill_closed:c2:2026-08",
          cardId: "c2",
          cardName: "Inter",
          competenceMonth: "2026-08",
          closingDate: "2026-08-05",
          dueDate: "2026-08-15",
          balanceCents: 98000,
          targetRoute: "/cartoes?card=c2&month=2026-08",
        },
      ],
      categoryPreferences: { billClosing: true },
    });

    expect(center.notifications.some((n) => n.id === "bill:c1:2026-07")).toBe(true);
    expect(center.notifications.some((n) => n.id === "bill:c1:2026-08")).toBe(true);
    expect(center.totalBellCount).toBe(3);

    const closed = center.notifications.find((n) => n.id === "bill_closed:c2:2026-08");
    expect(closed?.title).toContain("Ago/2026");
    expect(closed?.subtitle).toContain("15/08");
  });

  it("calibra due_today/dup/ceiling para P1, family:invite para P2, promotion para P3 e income_goal para warning", () => {
    const dueTodayBill: ReminderItem = {
      ...payableOverdue,
      status: "due_today",
    };

    const center = buildNotificationCenter({
      reminderItems: [dueTodayBill, receivablePending],
      advisorInsights: [
        {
          id: "dup:netflix",
          themeKey: "dup:netflix",
          priority: 1,
          category: "critical",
          title: "Cobrança duplicada",
          description: "2 cobranças no mês",
          iconName: "alert-triangle",
        },
        {
          id: "household:ceiling_exceeded",
          themeKey: "household:ceiling_exceeded",
          priority: 1,
          category: "critical",
          title: "Teto familiar excedido",
          description: "Excesso detectado",
          iconName: "alert-triangle",
        },
        {
          id: "income_goal:freela",
          themeKey: "income_goal:freela",
          priority: 2,
          category: "income",
          title: "Meta de receita abaixo do esperado",
          description: "Abaixo de 70%",
          iconName: "trending-up",
        },
      ],
      tripAndFamilyAlerts: [
        {
          id: "family:invite:inv-1",
          kind: "family_invite",
          title: "Convite familiar pendente",
          body: "Convite enviado.",
          badgeLabel: "Família",
          targetRoute: "/familia",
          entityRefs: ["family:invite:inv-1"],
        },
      ],
      broadcasts: [
        {
          id: "promo-1",
          title: "Novidade Pro",
          message: "Confira recursos novos",
          type: "promotion",
          action_url: null,
          created_at: "2026-08-02T10:00:00Z",
          is_read: false,
        },
      ],
    });

    expect(center.criticalCount).toBe(0);
    expect(center.notifications.find((n) => n.id === "bill:c1:2026-08")?.severity).toBe(
      "P1_ACTION_NEEDED",
    );
    expect(center.notifications.find((n) => n.id === "advisor:dup:netflix")?.severity).toBe(
      "P1_ACTION_NEEDED",
    );
    expect(
      center.notifications.find((n) => n.id === "advisor:household:ceiling_exceeded")?.severity,
    ).toBe("P1_ACTION_NEEDED");

    const incomeGoal = center.notifications.find((n) => n.id === "advisor:income_goal:freela");
    expect(incomeGoal?.badgeLabel).toBe("Meta de receita");
    expect(incomeGoal?.badgeVariant).toBe("warning");

    expect(center.notifications.find((n) => n.id === "family:invite:inv-1")?.severity).toBe(
      "P2_ADVISORY",
    );
    expect(center.notifications.find((n) => n.id === "broadcast:promo-1")?.severity).toBe(
      "P3_OPPORTUNITY",
    );
    expect(center.notifications.find((n) => n.id === "debt:r1")?.body).toContain("05/08");
  });

  it("ignora sinais de pagamento em rachas concluídos ou sinalizados pelo próprio host", () => {
    const shareCompleted = {
      id: "s-done",
      user_id: "u1",
      token: "tok-done",
      kind: "split",
      is_revoked: false,
      expires_at: null,
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T12:00:00Z",
      payload: {
        title: "Racha Concluído",
        total_cents: 10000,
        date: "2026-08-01",
        people_count: 2,
        guest_share_cents: 5000,
        host_share_cents: 5000,
        participants: [{ id: "p-host", name: "Host", is_host: true }],
        remainder_policy: "host",
        host_name: "Gabriel",
        host_city: "SP",
        pix_key: "123",
        pix_key_type: "cpf",
        pix_br_code: "000201",
        is_completed: true,
        payment_signals: [
          {
            id: "sig-1",
            participant_id: "p-host",
            participant_name: "Host",
            amount_cents: 5000,
            created_at: "2026-08-01T14:00:00Z",
            status: "pending",
          },
        ],
      },
    } as unknown as PublicShare;

    expect(extractPendingSplitSignals([shareCompleted])).toHaveLength(0);
  });
});

describe("Notification Hub — Detectores de Eventos (Fase 4.1)", () => {
  const cardSameMonth: CreditCard = {
    id: "card-1",
    user_id: "u1",
    name: "Nubank",
    brand: "mastercard",
    credit_limit: 5000,
    closing_day: 5,
    due_day: 15,
    color: "#8b5cf6",
    is_active: true,
  };

  const cardPrevMonthClose: CreditCard = {
    ...cardSameMonth,
    id: "card-2",
    name: "Inter",
    closing_day: 25,
    due_day: 5,
  };

  it("resolve invoiceClosingDate corretamente dentro do mesmo mês e na virada de mês com clamp", () => {
    expect(invoiceClosingDate("2026-08", 5, 15)).toBe("2026-08-05");
    expect(invoiceClosingDate("2026-08", 25, 5)).toBe("2026-07-25");
    expect(invoiceClosingDate("2026-03", 31, 5)).toBe("2026-02-28");
  });

  it("detectClosedCardBills sinaliza faturas fechadas nos últimos N dias com saldo aberto antes do vencimento", () => {
    const expenses: Expense[] = [
      {
        id: "e1",
        user_id: "u1",
        value: 450,
        date: "2026-08-01",
        category_id: "c1",
        payment_method: "credit_card",
        card_id: "card-1",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-08",
        report_weight: 1,
        base_amount: 450,
        description: "Supermercado",
        created_at: "2026-08-01T10:00:00Z",
      },
      {
        id: "e2",
        user_id: "u1",
        value: 200,
        date: "2026-07-20",
        category_id: "c1",
        payment_method: "credit_card",
        card_id: "card-2",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-08",
        report_weight: 1,
        base_amount: 200,
        description: "Farmácia",
        created_at: "2026-07-20T10:00:00Z",
      },
    ];
    const payments: CardPayment[] = [];

    const alertsDay6 = detectClosedCardBills({
      cards: [cardSameMonth, cardPrevMonthClose],
      cardExpenses: expenses,
      cardPayments: payments,
      today: "2026-08-06",
      lookbackDays: 3,
    });
    expect(alertsDay6).toHaveLength(1);
    expect(alertsDay6[0]).toMatchObject({
      key: "bill_closed:card-1:2026-08",
      cardName: "Nubank",
      balanceCents: 45000,
      dueDate: "2026-08-15",
    });

    // Quando já venceu (2026-08-15), não deve mais sinalizar "fechada"
    const alertsDueDay = detectClosedCardBills({
      cards: [cardSameMonth],
      cardExpenses: expenses,
      cardPayments: payments,
      today: "2026-08-15",
      lookbackDays: 15,
    });
    expect(alertsDueDay).toHaveLength(0);
  });

  it("detectConsolidatedBudgetOverrun agrupa múltiplos estouros (>100%) em 1 único alerta mensal", () => {
    const categories: Category[] = [
      {
        id: "cat-food",
        user_id: "u1",
        type: "expense",
        name: "Alimentação",
        icon: null,
        color: null,
        is_reserved: false,
        is_active: true,
      },
      {
        id: "cat-leisure",
        user_id: "u1",
        type: "expense",
        name: "Lazer",
        icon: null,
        color: null,
        is_reserved: false,
        is_active: true,
      },
      {
        id: "cat-health",
        user_id: "u1",
        type: "expense",
        name: "Saúde",
        icon: null,
        color: null,
        is_reserved: false,
        is_active: true,
      },
    ];

    const budgets: Budget[] = [
      { id: "b1", user_id: "u1", category_id: "cat-food", month: "2026-08", limit: 1000 },
      { id: "b2", user_id: "u1", category_id: "cat-leisure", month: "2026-08", limit: 500 },
      { id: "b3", user_id: "u1", category_id: "cat-health", month: "2026-08", limit: 400 },
    ];

    const expenses: Expense[] = [
      {
        id: "x1",
        user_id: "u1",
        value: 1200,
        date: "2026-08-05",
        category_id: "cat-food",
        payment_method: "pix",
        card_id: null,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: null,
        report_weight: 1,
        base_amount: 1200,
        description: null,
        created_at: "2026-08-05T10:00:00Z",
      },
      {
        id: "x2",
        user_id: "u1",
        value: 800,
        date: "2026-08-10",
        category_id: "cat-leisure",
        payment_method: "pix",
        card_id: null,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: null,
        report_weight: 1,
        base_amount: 800,
        description: null,
        created_at: "2026-08-10T10:00:00Z",
      },
      {
        id: "x3",
        user_id: "u1",
        value: 300,
        date: "2026-08-11",
        category_id: "cat-health",
        payment_method: "pix",
        card_id: null,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: null,
        report_weight: 1,
        base_amount: 300,
        description: null,
        created_at: "2026-08-11T10:00:00Z",
      },
    ];

    const overrun = detectConsolidatedBudgetOverrun({
      month: "2026-08",
      budgets,
      expenses,
      categories,
    });

    expect(overrun).not.toBeNull();
    expect(overrun?.id).toBe("budget:overrun:2026-08");
    expect(overrun?.exceededCount).toBe(2);
    expect(overrun?.totalExcessCents).toBe(50000); // R$ 200 + R$ 300
    expect(overrun?.topCategories[0]?.categoryName).toBe("Lazer"); // maior excesso primeiro
  });

  it("detectTripAndFamilyPendingAlerts identifica viagens encerradas/em acerto e convites pendentes válidos", () => {
    const trips: Trip[] = [
      {
        id: "trip-settling",
        host_user_id: "u1",
        title: "Gramado",
        destination: "RS",
        start_date: "2026-07-01",
        end_date: "2026-07-05",
        status: "settling",
        currency: "BRL",
        public_token: "t1",
        passcode_hash: null,
        cover_photo_url: null,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-06T00:00:00Z",
      },
      {
        id: "trip-done",
        host_user_id: "u1",
        title: "Rio",
        destination: "RJ",
        start_date: "2026-05-01",
        end_date: "2026-05-04",
        status: "completed",
        currency: "BRL",
        public_token: "t2",
        passcode_hash: null,
        cover_photo_url: null,
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-06T00:00:00Z",
      },
    ];

    const familyData = {
      invites: [
        {
          id: "inv-valid",
          status: "pending",
          invited_email: "maria@example.com",
          expires_at: "2026-09-01T00:00:00Z",
        },
        {
          id: "inv-expired",
          status: "pending",
          invited_email: "old@example.com",
          expires_at: "2026-07-01T00:00:00Z",
        },
      ],
    } as unknown as MyFamilyData;

    const alerts = detectTripAndFamilyPendingAlerts({
      trips,
      familyData,
      today: "2026-08-10",
      nowMs: new Date("2026-08-10T12:00:00Z").getTime(),
    });

    expect(alerts.map((a) => a.id)).toEqual([
      "trip:settlement:trip-settling",
      "family:invite:inv-valid",
    ]);
  });
});
