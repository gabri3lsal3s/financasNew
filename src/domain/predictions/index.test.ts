import { describe, expect, it } from "vitest";
import {
  buildDescriptionSuggestions,
  buildHabitualEntries,
  dayOfMonth,
  dayOfMonthDistance,
  dayOfWeek,
  hourDistance,
  hourOfDay,
  isWeekend,
  jaccardTokens,
  medianOf,
  modeOf,
  monthWindowFactor,
  normalizeText,
  recencyFactor,
  timeOfDayFactor,
  tokenize,
  weekdayFactor,
  type PredictionEntry,
} from "./index";

const TODAY = "2026-08-15";

const history: PredictionEntry[] = [
  {
    id: "1",
    kind: "expense",
    description: "Supermercado Pão de Açúcar",
    categoryId: "c-mercado",
    categoryName: "Mercado",
    paymentMethod: "credit_card",
    cardId: "card-nubank",
    receiveType: null,
    value: 320,
    date: "2026-08-10",
  },
  {
    id: "2",
    kind: "expense",
    description: "Mercado Extra",
    categoryId: "c-mercado",
    categoryName: "Mercado",
    paymentMethod: "credit_card",
    cardId: "card-nubank",
    receiveType: null,
    value: 150,
    date: "2026-07-12",
  },
  {
    id: "3",
    kind: "expense",
    description: "Uber para o trabalho",
    categoryId: "c-transporte",
    categoryName: "Transporte",
    paymentMethod: "pix",
    cardId: null,
    receiveType: null,
    value: 24,
    date: "2026-08-14",
  },
  {
    id: "4",
    kind: "income",
    description: "Salário",
    categoryId: "c-salario",
    categoryName: "Salário",
    paymentMethod: null,
    cardId: null,
    receiveType: "pix",
    value: 5000,
    date: "2026-08-05",
  },
  {
    id: "5",
    kind: "income",
    description: "Freela site",
    categoryId: "c-freela",
    categoryName: "Freelance",
    paymentMethod: null,
    cardId: null,
    receiveType: "transfer",
    value: 1200,
    date: "2026-08-01",
  },
  {
    id: "6",
    kind: "expense",
    description: "Padaria da esquina",
    categoryId: "c-alimentacao",
    categoryName: "Alimentação",
    paymentMethod: "cash",
    cardId: null,
    receiveType: null,
    value: 18,
    date: "2026-08-15",
  },
];

describe("predictions — motor preditivo de entrada (F21 + hotfix)", () => {
  it("normalizeText remove acentos e minúsculas", () => {
    expect(normalizeText("  Supermercado Pão de Açúcar ")).toBe("supermercado pao de acucar");
  });

  it("tokenize ignora pontuação e tokens de 1 char", () => {
    expect(tokenize("Mercado Extra 24h")).toEqual(["mercado", "extra", "24h"]);
    expect(tokenize("a e o")).toEqual([]);
  });

  it("jaccardTokens calcula a similaridade corretamente", () => {
    expect(jaccardTokens(["mercado"], ["mercado"])).toBe(1);
    expect(jaccardTokens(["mercado", "pao"], ["mercado"])).toBe(0.5);
    expect(jaccardTokens(["mercado"], ["uber"])).toBe(0);
    expect(jaccardTokens([], ["mercado"])).toBe(0);
  });

  it("recencyFactor pondera datas recentes (1 hoje, ~0 além da janela)", () => {
    expect(recencyFactor("2026-08-15", TODAY)).toBe(1);
    expect(recencyFactor("2026-08-01", TODAY)).toBeCloseTo(1 - 14 / 90);
    expect(recencyFactor("2026-01-01", TODAY)).toBe(0);
    expect(recencyFactor("2026-09-01", TODAY)).toBe(1); // futura
  });

  it("dayOfMonth extrai o dia da data ISO", () => {
    expect(dayOfMonth("2026-08-15")).toBe(15);
    expect(dayOfMonth("2026-08-01")).toBe(1);
    expect(dayOfMonth("2026-08-31")).toBe(31);
  });

  it("dayOfMonthDistance é circular (fim ↔ início do mês distam pouco)", () => {
    expect(dayOfMonthDistance(15, 15)).toBe(0);
    expect(dayOfMonthDistance(10, 15)).toBe(5);
    expect(dayOfMonthDistance(1, 30)).toBe(1); // circular: fim do mês = início do próximo
    expect(dayOfMonthDistance(1, 16)).toBe(15); // máximo = meio do mês
  });

  it("monthWindowFactor dá peso máximo a ±5 dias e peso alto até ±10 (hotfix)", () => {
    expect(monthWindowFactor(15, 15)).toBe(1); // mesmo dia
    expect(monthWindowFactor(10, 15)).toBe(1); // a 5 dias
    expect(monthWindowFactor(6, 15)).toBe(0.85); // a 9 dias (faixa ±5–±10)
    expect(monthWindowFactor(1, 15)).toBe(0.4); // fora da janela
  });

  it("dayOfWeek e isWeekend identificam dias úteis e fins de semana", () => {
    // 2026-08-15 é Sábado (dayOfWeek = 6, isWeekend = true)
    expect(dayOfWeek("2026-08-15")).toBe(6);
    expect(isWeekend("2026-08-15")).toBe(true);

    // 2026-08-17 é Segunda-feira (dayOfWeek = 1, isWeekend = false)
    expect(dayOfWeek("2026-08-17")).toBe(1);
    expect(isWeekend("2026-08-17")).toBe(false);

    // Afinidade semanal:
    // Hábito de dia útil (seg-sex) em referência de dia útil -> 1.0
    expect(weekdayFactor(["2026-08-17", "2026-08-18"], "2026-08-19")).toBe(1);
    // Hábito de dia útil em referência de fim de semana -> 0.85
    expect(weekdayFactor(["2026-08-17", "2026-08-18"], "2026-08-15")).toBe(0.85);
  });

  it("hourOfDay, hourDistance e timeOfDayFactor calculam afinidade horária e reforço semântico", () => {
    expect(hourOfDay("2026-08-15T14:30:00")).toBe(14);
    expect(hourOfDay(undefined)).toBeNull();
    expect(hourOfDay("invalido")).toBeNull();

    expect(hourDistance(12, 13)).toBe(1);
    expect(hourDistance(23, 1)).toBe(2); // circular: 23h e 01h distam 2 horas
    expect(hourDistance(12, 0)).toBe(12);

    expect(medianOf([10, 20, 30])).toBe(20);
    expect(modeOf(["a", "a", "b"])).toBe("a");

    // Horário local próximo (12h vs 13h) -> 1.0 (usa timestamp local sem fuso Z)
    expect(timeOfDayFactor(["2026-08-15T12:30:00"], 13, "Gasto avulso")).toBe(1);
    // Horário distante (12h vs 22h) sem semântica -> 0.65
    expect(timeOfDayFactor(["2026-08-15T12:30:00"], 22, "Gasto avulso")).toBe(0.65);
    // Reforço semântico: "Almoço" às 12h ganha 1.0 mesmo se o timestamp histórico foi à noite (perfil em lote)
    expect(timeOfDayFactor(["2026-08-15T22:00:00"], 12, "Almoço Restaurante")).toBe(1);
    // Sem timestamps ou sem hora atual -> 1.0 (neutro)
    expect(timeOfDayFactor([], 12, "Gasto")).toBe(1);
    expect(timeOfDayFactor(["2026-08-15T12:00:00"], undefined, "Gasto")).toBe(1);
  });

  it("buildHabitualEntries prioriza almoço no horário do almoço e jantar à noite", () => {
    const lunch: PredictionEntry = {
      id: "l1",
      kind: "expense",
      description: "Almoço no Quilo",
      categoryId: "c-alim",
      categoryName: "Alimentação",
      paymentMethod: "pix",
      cardId: null,
      receiveType: null,
      value: 32,
      date: "2026-08-14",
      createdAt: "2026-08-14T12:30:00",
    };
    const dinner: PredictionEntry = {
      id: "d1",
      kind: "expense",
      description: "Ifood Pizza",
      categoryId: "c-alim",
      categoryName: "Alimentação",
      paymentMethod: "pix",
      cardId: null,
      receiveType: null,
      value: 75,
      date: "2026-08-14",
      createdAt: "2026-08-14T20:45:00",
    };

    const sameFreqHistory = [
      lunch,
      { ...lunch, id: "l2", date: "2026-08-13" },
      dinner,
      { ...dinner, id: "d2", date: "2026-08-13" },
    ];

    // Às 12h (meio-dia): Almoço lidera
    const habitsLunchTime = buildHabitualEntries(sameFreqHistory, "expense", {
      referenceDay: 14,
      currentHour: 12,
    });
    expect(habitsLunchTime[0]?.description).toBe("Almoço no Quilo");

    // Às 21h (noite): Ifood Pizza lidera
    const habitsDinnerTime = buildHabitualEntries(sameFreqHistory, "expense", {
      referenceDay: 14,
      currentHour: 21,
    });
    expect(habitsDinnerTime[0]?.description).toBe("Ifood Pizza");
  });

  it("buildHabitualEntries prioriza hábitos de fim de semana no sábado/domingo", () => {
    const weekdayExpense: PredictionEntry = {
      id: "w1",
      kind: "expense",
      description: "Estacionamento Trabalho",
      categoryId: "c-transp",
      categoryName: "Transporte",
      paymentMethod: "pix",
      cardId: null,
      receiveType: null,
      value: 20,
      date: "2026-08-10", // Segunda-feira
    };
    const weekendExpense: PredictionEntry = {
      id: "we1",
      kind: "expense",
      description: "Barzinho com Amigos",
      categoryId: "c-lazer",
      categoryName: "Lazer",
      paymentMethod: "credit_card",
      cardId: "card-1",
      receiveType: null,
      value: 90,
      date: "2026-08-09", // Domingo
    };

    const mixedHistory = [
      weekdayExpense,
      { ...weekdayExpense, id: "w2", date: "2026-08-11" }, // Terça
      weekendExpense,
      { ...weekendExpense, id: "we2", date: "2026-08-08" }, // Sábado
    ];

    // No Sábado (2026-08-15): Barzinho com Amigos lidera por afinidade de fim de semana
    const saturdayHabits = buildHabitualEntries(mixedHistory, "expense", {
      referenceDate: "2026-08-15",
    });
    expect(saturdayHabits[0]?.description).toBe("Barzinho com Amigos");

    // Na Quarta-feira (2026-08-12): Estacionamento Trabalho lidera por afinidade de dia útil
    const wednesdayHabits = buildHabitualEntries(mixedHistory, "expense", {
      referenceDate: "2026-08-12",
    });
    expect(wednesdayHabits[0]?.description).toBe("Estacionamento Trabalho");
  });

  it("buildHabitualEntries suprime conta periódica mensal (1x/mês) se já lançada no targetMonth", () => {
    const historyWithAluguel: PredictionEntry[] = [
      // Aluguel ocorreu 1x em Junho, 1x em Julho e já foi pago em Agosto (dia 05)
      {
        id: "a1",
        kind: "expense",
        description: "Aluguel",
        categoryId: "c-moradia",
        categoryName: "Moradia",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 2000,
        date: "2026-06-05",
      },
      {
        id: "a2",
        kind: "expense",
        description: "Aluguel",
        categoryId: "c-moradia",
        categoryName: "Moradia",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 2000,
        date: "2026-07-05",
      },
      {
        id: "a3",
        kind: "expense",
        description: "Aluguel",
        categoryId: "c-moradia",
        categoryName: "Moradia",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 2000,
        date: "2026-08-05",
      },
      // Almoço ocorre frequentemente
      {
        id: "alm1",
        kind: "expense",
        description: "Almoço",
        categoryId: "c-alim",
        categoryName: "Alimentação",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 30,
        date: "2026-08-10",
      },
      {
        id: "alm2",
        kind: "expense",
        description: "Almoço",
        categoryId: "c-alim",
        categoryName: "Alimentação",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 30,
        date: "2026-08-11",
      },
    ];

    // Para Agosto (onde o aluguel já foi pago), o Aluguel é suprimido dos atalhos
    const habitsAugust = buildHabitualEntries(historyWithAluguel, "expense", {
      targetMonth: "2026-08",
      referenceDay: 5,
    });
    expect(habitsAugust.some((h) => h.description === "Aluguel")).toBe(false);
    expect(habitsAugust.some((h) => h.description === "Almoço")).toBe(true);

    // Para Setembro (onde o aluguel ainda NÃO foi pago), o Aluguel volta a ser sugerido
    const habitsSeptember = buildHabitualEntries(historyWithAluguel, "expense", {
      targetMonth: "2026-09",
      referenceDay: 5,
    });
    expect(habitsSeptember.some((h) => h.description === "Aluguel")).toBe(true);
  });

  it("buildHabitualEntries consolida hábitos de diferentes pagamentos e adota o método predominante", () => {
    const restaurantHistory: PredictionEntry[] = [
      // 3 vezes no cartão Nubank e 1 vez no Pix
      {
        id: "r1",
        kind: "expense",
        description: "Restaurante Sabor",
        categoryId: "c-alim",
        categoryName: "Alimentação",
        paymentMethod: "credit_card",
        cardId: "card-nubank",
        receiveType: null,
        value: 35,
        date: "2026-08-01",
      },
      {
        id: "r2",
        kind: "expense",
        description: "Restaurante Sabor",
        categoryId: "c-alim",
        categoryName: "Alimentação",
        paymentMethod: "credit_card",
        cardId: "card-nubank",
        receiveType: null,
        value: 35,
        date: "2026-08-02",
      },
      {
        id: "r3",
        kind: "expense",
        description: "Restaurante Sabor",
        categoryId: "c-alim",
        categoryName: "Alimentação",
        paymentMethod: "credit_card",
        cardId: "card-nubank",
        receiveType: null,
        value: 35,
        date: "2026-08-03",
      },
      {
        id: "r4",
        kind: "expense",
        description: "Restaurante Sabor",
        categoryId: "c-alim",
        categoryName: "Alimentação",
        paymentMethod: "pix",
        cardId: null,
        receiveType: null,
        value: 120, // valor atípico
        date: "2026-08-04",
      },
    ];

    const habits = buildHabitualEntries(restaurantHistory, "expense");
    expect(habits).toHaveLength(1); // consolida em 1 único hábito com frequency = 4
    expect(habits[0]?.frequency).toBe(4);
    expect(habits[0]?.paymentMethod).toBe("credit_card");
    expect(habits[0]?.cardId).toBe("card-nubank");
    // Valor é a mediana (R$ 35), não o valor atípico de R$ 120
    expect(habits[0]?.value).toBe(35);
  });

  it("buildHabitualEntries limita estritamente a 3 itens (hotfix)", () => {
    const many = [history[0]!, history[1]!, history[2]!, history[5]!];
    const habits = buildHabitualEntries(many, "expense");
    expect(habits).toHaveLength(3);
    // Limite explícito menor também respeitado.
    expect(buildHabitualEntries(many, "expense", { limit: 2 })).toHaveLength(2);
  });

  it("buildHabitualEntries ranqueia pela janela de dias do mês × frequência × recência (hotfix)", () => {
    // Próximo do dia de referência (dia 14, a ±1 do dia 15) com 1 ocorrência.
    const near: PredictionEntry = { ...history[2]!, id: "n1", date: "2026-08-14" }; // Uber
    // Longe do dia de referência (dia 1) com 2 ocorrências.
    const far: PredictionEntry = { ...history[5]!, id: "f1", date: "2026-08-01" }; // Padaria
    const repeated: PredictionEntry[] = [near, far, { ...far, id: "f2", date: "2026-07-01" }];
    const habits = buildHabitualEntries(repeated, "expense", { referenceDay: 15, todayISO: TODAY });
    // Sem a janela temporal, "Padaria" (2×) venceria por frequência bruta; com a
    // janela ±5–±10, "Uber" (dia 14) lidera apesar da menor frequência.
    expect(habits[0]?.description).toBe("Uber para o trabalho");
    expect(habits[0]?.frequency).toBe(1);
  });

  it("buildHabitualEntries sem opções mantém o ranking por frequência (mais recente desempata)", () => {
    const near: PredictionEntry = { ...history[2]!, id: "n1", date: "2026-08-14" };
    const far: PredictionEntry = { ...history[5]!, id: "f1", date: "2026-08-01" };
    const repeated: PredictionEntry[] = [near, far, { ...far, id: "f2", date: "2026-07-01" }];
    const habits = buildHabitualEntries(repeated, "expense");
    expect(habits[0]?.description).toBe("Padaria da esquina");
    expect(habits[0]?.frequency).toBe(2);
  });

  it("buildHabitualEntries ignora lançamentos sem descrição", () => {
    const noDescription: PredictionEntry[] = [
      { ...history[0]!, id: "n1", description: "" },
      { ...history[0]!, id: "n2", description: "  " },
    ];
    expect(buildHabitualEntries(noDescription, "expense")).toEqual([]);
  });

  it("buildDescriptionSuggestions sugere descrições reais (top 3) e separa por tipo", () => {
    const expenseSuggestions = buildDescriptionSuggestions(history, "expense", { todayISO: TODAY });
    expect(expenseSuggestions.length).toBeLessThanOrEqual(3);
    expect(expenseSuggestions.every((s) => s.frequency >= 1)).toBe(true);
    // Descrições reais do histórico — nunca o nome genérico da categoria.
    const descriptions = expenseSuggestions.map((s) => s.description);
    expect(descriptions).toContain("Supermercado Pão de Açúcar");
    expect(descriptions).not.toContain("Salário"); // renda não entra em despesa
  });

  it("buildDescriptionSuggestions elimina rótulos que são apenas o nome da categoria selecionada", () => {
    const redundant: PredictionEntry[] = [
      { ...history[0]!, id: "r1", description: "Alimentação", categoryId: "c-alim", categoryName: "Alimentação" },
      { ...history[0]!, id: "r2", description: "Almoço Restaurante X", categoryId: "c-alim", categoryName: "Alimentação" },
    ];
    const suggestions = buildDescriptionSuggestions(redundant, "expense", { categoryName: "Alimentação" });
    expect(suggestions.map((s) => s.description)).toEqual(["Almoço Restaurante X"]);
  });

  it("buildDescriptionSuggestions filtra pela query digitada (substring e tokens)", () => {
    // "mercado" casa por substring com "Supermercado Pão de Açúcar"
    const bySubstring = buildDescriptionSuggestions(history, "expense", { query: "mercado" });
    expect(bySubstring.some((s) => s.description.includes("mercado") || s.description.includes("Mercado"))).toBe(true);
    // "uber" casa por token com "Uber para o trabalho"
    const byToken = buildDescriptionSuggestions(history, "expense", { query: "uber" });
    expect(byToken.some((s) => /uber/i.test(s.description))).toBe(true);
    // Query sem casamento → vazio
    expect(buildDescriptionSuggestions(history, "expense", { query: "zzzqqq" })).toEqual([]);
  });
});
