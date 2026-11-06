import { describe, expect, it } from "vitest";
import {
  calculateStringSimilarity,
  clusterCategories,
  clusterFamilyExpenses,
  deriveCategoryClusterKey,
  HOUSEHOLD_CLUSTER_MAP,
  inferClusterForCategory,
  normalizeCategoryText,
  normalizeClusterPercentages,
  tokenizeCategoryName,
} from "./category-clustering";

describe("category-clustering — Motor Puro de Normalização e Agrupamento Familiar", () => {
  describe("1. Normalização e Tokenização", () => {
    it("normaliza strings com acentos, maiúsculas e caracteres especiais", () => {
      expect(normalizeCategoryText("  Alimentação & Bebidas! ")).toBe("alimentacao bebidas");
      expect(normalizeCategoryText("Supermercado - Pão de Açúcar (Loja #42)")).toBe(
        "supermercado pao de acucar loja 42",
      );
      expect(normalizeCategoryText("")).toBe("");
      expect(normalizeCategoryText("Farmácia / Remédios")).toBe("farmacia remedios");
    });

    it("tokeniza e filtra stop words e plurais em português", () => {
      const tokens = tokenizeCategoryName("Compras de Supermercados para a Casa");
      expect(tokens).toContain("compra");
      expect(tokens).toContain("supermercado");
      expect(tokens).toContain("casa");
      expect(tokens).not.toContain("de");
      expect(tokens).not.toContain("para");
      expect(tokens).not.toContain("a");
    });

    it("lematiza plurais em -coes", () => {
      const tokens = tokenizeCategoryName("Refeicoes fora de casa");
      expect(tokens).toContain("refeicao");
      expect(tokens).toContain("fora");
      expect(tokens).toContain("casa");
    });
  });

  describe("2. Similaridade Léxica (Sørensen-Dice)", () => {
    it("atribui similaridade 1.0 para strings idênticas (ignorando case e espaços)", () => {
      expect(calculateStringSimilarity("Supermercado", "supermercado")).toBe(1.0);
      expect(calculateStringSimilarity("Jardim da Casa", "jardim da casa")).toBe(1.0);
    });

    it("atribui alta similaridade para variações de plural ou sufixo", () => {
      const sim = calculateStringSimilarity("Supermercado", "Supermercados");
      expect(sim).toBeGreaterThanOrEqual(0.85);
    });

    it("atribui similaridade 0.0 para termos sem bigramas comuns", () => {
      expect(calculateStringSimilarity("Aluguel", "Farmacia")).toBe(0.0);
      expect(calculateStringSimilarity("", "Mercado")).toBe(0.0);
    });
  });

  describe("3. Inferência de Macro-Clusters da Casa", () => {
    it("identifica cluster alimentacao_mercado a partir de termos típicos", () => {
      expect(inferClusterForCategory({ name: "Supermercado Pão de Açúcar" }).id).toBe(
        "alimentacao_mercado",
      );
      expect(inferClusterForCategory({ name: "Hortifruti da Vila" }).id).toBe(
        "alimentacao_mercado",
      );
      expect(inferClusterForCategory({ name: "Feira de Domingo" }).id).toBe(
        "alimentacao_mercado",
      );
      expect(inferClusterForCategory({ name: "Açougue & Carnes" }).id).toBe(
        "alimentacao_mercado",
      );
      expect(inferClusterForCategory({ name: "Compras do Mês" }).id).toBe(
        "alimentacao_mercado",
      );
    });

    it("identifica cluster moradia para aluguel, condomínio, IPTU e reformas", () => {
      expect(inferClusterForCategory({ name: "Aluguel do Apartamento" }).id).toBe("moradia");
      expect(inferClusterForCategory({ name: "Condomínio Edifício Solar" }).id).toBe("moradia");
      expect(inferClusterForCategory({ name: "Parcela IPTU 2026" }).id).toBe("moradia");
      expect(inferClusterForCategory({ name: "Reforma do Banheiro" }).id).toBe("moradia");
      expect(inferClusterForCategory({ name: "Diarista Quinzenal" }).id).toBe("moradia");
    });

    it("identifica cluster utilidades para energia, água, gás e telecom", () => {
      expect(inferClusterForCategory({ name: "Conta de Luz Enel" }).id).toBe("utilidades");
      expect(inferClusterForCategory({ name: "Sabesp Água e Esgoto" }).id).toBe("utilidades");
      expect(inferClusterForCategory({ name: "Gás Ultragaz Botijão" }).id).toBe("utilidades");
      expect(inferClusterForCategory({ name: "Internet Fibra Vivo" }).id).toBe("utilidades");
      expect(inferClusterForCategory({ name: "Telefonia Celular Claro" }).id).toBe("utilidades");
    });

    it("identifica cluster transporte para combustível, mobilidade e despesas veiculares", () => {
      expect(inferClusterForCategory({ name: "Combustível Posto Ipiranga" }).id).toBe("transporte");
      expect(inferClusterForCategory({ name: "Uber para o Trabalho" }).id).toBe("transporte");
      expect(inferClusterForCategory({ name: "Pedágio Sem Parar" }).id).toBe("transporte");
      expect(inferClusterForCategory({ name: "IPVA e Seguro do Carro" }).id).toBe("transporte");
      expect(inferClusterForCategory({ name: "Mecânico e Revisão" }).id).toBe("transporte");
    });

    it("identifica cluster saude para farmácias, consultas e planos de saúde", () => {
      expect(inferClusterForCategory({ name: "Farmácia Droga Raia" }).id).toBe("saude");
      expect(inferClusterForCategory({ name: "Medicamentos de Uso Contínuo" }).id).toBe("saude");
      expect(inferClusterForCategory({ name: "Consulta Dentista" }).id).toBe("saude");
      expect(inferClusterForCategory({ name: "Plano de Saúde Unimed" }).id).toBe("saude");
      expect(inferClusterForCategory({ name: "Exames Laboratoriais" }).id).toBe("saude");
    });

    it("identifica cluster alimentacao_fora para restaurantes, bares e delivery", () => {
      expect(inferClusterForCategory({ name: "Restaurante Outback" }).id).toBe("alimentacao_fora");
      expect(inferClusterForCategory({ name: "iFood Pizza de Sexta" }).id).toBe("alimentacao_fora");
      expect(inferClusterForCategory({ name: "Almoço Executivo" }).id).toBe("alimentacao_fora");
      expect(inferClusterForCategory({ name: "Cafeteria Starbucks" }).id).toBe("alimentacao_fora");
    });

    it("identifica cluster educacao para escolas, creches e cursos", () => {
      expect(inferClusterForCategory({ name: "Mensalidade do Colégio" }).id).toBe("educacao");
      expect(inferClusterForCategory({ name: "Faculdade e Pós-Graduação" }).id).toBe("educacao");
      expect(inferClusterForCategory({ name: "Material Escolar Papelaria" }).id).toBe("educacao");
    });

    it("identifica cluster pets para veterinário, ração e pet shop", () => {
      expect(inferClusterForCategory({ name: "Ração Cachorro Cobasi" }).id).toBe("pets");
      expect(inferClusterForCategory({ name: "Veterinário Petz Vacina" }).id).toBe("pets");
      expect(inferClusterForCategory({ name: "Banho e Tosa Golden" }).id).toBe("pets");
    });

    it("identifica cluster lazer_viagem para viagens, hotéis e passeios", () => {
      expect(inferClusterForCategory({ name: "Passagens Aéreas Férias" }).id).toBe("lazer_viagem");
      expect(inferClusterForCategory({ name: "Hospedagem Airbnb" }).id).toBe("lazer_viagem");
      expect(inferClusterForCategory({ name: "Ingressos Cinema Cinemark" }).id).toBe("lazer_viagem");
    });

    it("identifica cluster assinaturas_servicos para streamings e assinaturas digitais", () => {
      expect(inferClusterForCategory({ name: "Netflix Mensalidade" }).id).toBe(
        "assinaturas_servicos",
      );
      expect(inferClusterForCategory({ name: "Spotify Premium Família" }).id).toBe(
        "assinaturas_servicos",
      );
      expect(inferClusterForCategory({ name: "ChatGPT Plus OpenAI" }).id).toBe(
        "assinaturas_servicos",
      );
    });

    it("identifica cluster cuidados_pessoais para barbearia, cosméticos e vestuário", () => {
      expect(inferClusterForCategory({ name: "Barbearia / Corte Cabelo" }).id).toBe(
        "cuidados_pessoais",
      );
      expect(inferClusterForCategory({ name: "Academia Smart Fit" }).id).toBe("cuidados_pessoais");
      expect(inferClusterForCategory({ name: "Cosméticos e Perfumaria" }).id).toBe(
        "cuidados_pessoais",
      );
    });

    it("utiliza o ícone como critério de desempate para categorias genéricas", () => {
      expect(inferClusterForCategory({ name: "Geral", icon: "home" }).id).toBe("moradia");
      expect(inferClusterForCategory({ name: "Outros", icon: "zap" }).id).toBe("utilidades");
      expect(inferClusterForCategory({ name: "Diversos", icon: "car" }).id).toBe("transporte");
      expect(inferClusterForCategory({ name: "Conta", icon: "heart-pulse" }).id).toBe("saude");
    });

    it("cai no cluster fallback 'outros' para itens sem correspondência", () => {
      const fallback = inferClusterForCategory({ name: "Despesa Inespecífica XYZ" });
      expect(fallback.id).toBe("outros");
      expect(deriveCategoryClusterKey("Despesa Inespecífica XYZ")).toBe("outros");
    });
  });

  describe("4. Agrupamento de Categorias de Usuários (`clusterCategories`)", () => {
    it("retorna lista vazia para coleção vazia", () => {
      expect(clusterCategories([])).toEqual([]);
    });

    it("agrupa categorias de diferentes membros em clusters unificados", () => {
      const userCategories = [
        { id: "c-1", name: "Supermercado", icon: "shopping-cart", color: "#10b981" },
        { id: "c-2", name: "Aluguel da Casa", icon: "home", color: "#3b82f6" },
        { id: "c-3", name: "Mercado Semanal", icon: "shopping-bag", color: "#10b981" },
        { id: "c-4", name: "Conta de Luz Enel", icon: "zap", color: "#eab308" },
        { id: "c-5", name: "Farmácia e Remédios", icon: "heart-pulse", color: "#ef4444" },
      ];

      const clusters = clusterCategories(userCategories);

      expect(clusters.length).toBe(4);

      const marketCluster = clusters.find((c) => c.clusterId === "alimentacao_mercado");
      expect(marketCluster).toBeDefined();
      expect(marketCluster?.categoryIds).toEqual(["c-1", "c-3"]);
      expect(marketCluster?.categories.length).toBe(2);

      const housingCluster = clusters.find((c) => c.clusterId === "moradia");
      expect(housingCluster?.categoryIds).toEqual(["c-2"]);

      const utilityCluster = clusters.find((c) => c.clusterId === "utilidades");
      expect(utilityCluster?.categoryIds).toEqual(["c-4"]);

      const healthCluster = clusters.find((c) => c.clusterId === "saude");
      expect(healthCluster?.categoryIds).toEqual(["c-5"]);
    });
  });

  describe("5. Agrupamento de Despesas Familiares (`clusterFamilyExpenses`)", () => {
    it("retorna lista vazia para coleção vazia", () => {
      expect(clusterFamilyExpenses([])).toEqual([]);
    });

    it("consolida despesas da casa com exatidão em centavos e cálculo de fatias por membro", () => {
      const expenses = [
        // Moradia: total 150.000 centavos (R$ 1.500,00) - pago por Você
        {
          amount_cents: 150000,
          category_name: "Aluguel Apartamento",
          category_icon: "home",
          user_id: "user-1",
          payer_name: "Gabriel",
          is_own: true,
        },
        // Supermercado: total 100.000 centavos (R$ 1.000,00)
        // Gabriel: 60.000 (60%) | Parceiro: 40.000 (40%)
        {
          amount_cents: 60000,
          category_name: "Supermercado Pão de Açúcar",
          category_icon: "shopping-cart",
          user_id: "user-1",
          payer_name: "Gabriel",
          is_own: true,
        },
        {
          amount_cents: 40000,
          category_name: "Mercado da Esquina",
          category_icon: "shopping-cart",
          user_id: "user-2",
          payer_name: "Mariana",
          is_own: false,
        },
        // Utilidades: total 50.000 centavos (R$ 500,00)
        // Mariana: 30.000 (60%) | Gabriel: 20.000 (40%)
        {
          amount_cents: 30000,
          category_name: "Internet Fibra Vivo",
          category_icon: "wifi",
          user_id: "user-2",
          payer_name: "Mariana",
          is_own: false,
        },
        {
          amount_cents: 20000,
          category_name: "Conta de Luz Enel",
          category_icon: "zap",
          user_id: "user-1",
          payer_name: "Gabriel",
          is_own: true,
        },
      ];

      const clusters = clusterFamilyExpenses(expenses);

      // Total da casa: 150.000 + 100.000 + 50.000 = 300.000 centavos (R$ 3.000,00)
      expect(clusters.length).toBe(3);

      // Invariante de ordenação decrescente por gasto
      expect(clusters[0]?.clusterId).toBe("moradia");
      expect(clusters[0]?.total_cents).toBe(150000);
      expect(clusters[0]?.percentage).toBe(50.0);

      expect(clusters[1]?.clusterId).toBe("alimentacao_mercado");
      expect(clusters[1]?.total_cents).toBe(100000);
      expect(clusters[1]?.percentage).toBe(33.3);

      expect(clusters[2]?.clusterId).toBe("utilidades");
      expect(clusters[2]?.total_cents).toBe(50000);
      expect(clusters[2]?.percentage).toBe(16.7);

      // Invariante Fundamental: soma dos centavos de todos os clusters é idêntica ao total de entrada
      const sumClusterCents = clusters.reduce((acc, c) => acc + c.total_cents, 0);
      expect(sumClusterCents).toBe(300000);

      // Invariante de soma de membros por cluster
      for (const cluster of clusters) {
        const sumMemberCents = cluster.member_contributions.reduce(
          (acc, m) => acc + m.spent_cents,
          0,
        );
        expect(sumMemberCents).toBe(cluster.total_cents);
      }

      // Detalhe de contribuição no cluster de alimentação
      const market = clusters[1];
      expect(market?.member_contributions.length).toBe(2);
      expect(market?.member_contributions[0]?.user_id).toBe("user-1");
      expect(market?.member_contributions[0]?.spent_cents).toBe(60000);
      expect(market?.member_contributions[0]?.percentage).toBe(60.0);
      expect(market?.member_contributions[1]?.user_id).toBe("user-2");
      expect(market?.member_contributions[1]?.spent_cents).toBe(40000);
      expect(market?.member_contributions[1]?.percentage).toBe(40.0);
      expect(market?.category_names).toEqual(["Mercado da Esquina", "Supermercado Pão de Açúcar"]);

      // Detalhe de contribuição no cluster de utilidades
      const utils = clusters[2];
      expect(utils?.member_contributions[0]?.user_id).toBe("user-2");
      expect(utils?.member_contributions[0]?.spent_cents).toBe(30000);
      expect(utils?.member_contributions[0]?.percentage).toBe(60.0);
      expect(utils?.member_contributions[1]?.user_id).toBe("user-1");
      expect(utils?.member_contributions[1]?.spent_cents).toBe(20000);
      expect(utils?.member_contributions[1]?.percentage).toBe(40.0);
    });

    it("assegura que a soma dos percentuais normalizados feche exatamente em 100,0% via Hamilton-Hare", () => {
      // 3 despesas com exatamente o mesmo valor geram dízima de 33,333...%
      const expenses = [
        { amount_cents: 10000, category_name: "Aluguel Casa" },
        { amount_cents: 10000, category_name: "Supermercado Dia" },
        { amount_cents: 10000, category_name: "Conta de Luz" },
      ];

      const clusters = clusterFamilyExpenses(expenses);
      const sumPercentages = clusters.reduce((acc, c) => acc + c.percentage, 0);

      // Normalizado para fechar estritamente em 100.0%
      expect(Number(sumPercentages.toFixed(1))).toBe(100.0);
    });

    it("permite invocar normalizeClusterPercentages diretamente para redistribuir fatias", () => {
      const rawGroups = [
        {
          clusterId: "moradia",
          label: "Moradia & Habitação",
          icon: "home",
          color: "#3b82f6",
          total_cents: 3333,
          percentage: 33.33,
          display_percentage: "33,3%",
          expenses_count: 1,
          expenses: [],
          category_names: ["Aluguel"],
          member_contributions: [],
        },
        {
          clusterId: "utilidades",
          label: "Contas & Utilidades",
          icon: "zap",
          color: "#eab308",
          total_cents: 3333,
          percentage: 33.33,
          display_percentage: "33,3%",
          expenses_count: 1,
          expenses: [],
          category_names: ["Luz"],
          member_contributions: [],
        },
        {
          clusterId: "transporte",
          label: "Transporte & Mobilidade",
          icon: "car",
          color: "#6366f1",
          total_cents: 3334,
          percentage: 33.34,
          display_percentage: "33,3%",
          expenses_count: 1,
          expenses: [],
          category_names: ["Gasolina"],
          member_contributions: [],
        },
      ];

      const normalized = normalizeClusterPercentages(rawGroups);
      expect(normalized.length).toBe(3);
      const totalPct = normalized.reduce((acc, g) => acc + g.percentage, 0);
      expect(totalPct).toBe(100.0);
    });

    it("lida defensivamente com despesas de valor zero sem produzir NaN", () => {
      const expenses = [
        { amount_cents: 0, category_name: "Aluguel Casa" },
        { amount_cents: 0, category_name: "Supermercado Dia" },
      ];

      const clusters = clusterFamilyExpenses(expenses);
      expect(clusters.length).toBe(2);
      expect(clusters[0]?.total_cents).toBe(0);
      expect(clusters[0]?.percentage).toBe(0);
      expect(clusters[0]?.display_percentage).toBe("0,0%");
    });
  });

  describe("6. Catálogo de Macro-Clusters e Conformidade de Design", () => {
    it("possui 12 macro-clusters canônicos com metadados completos", () => {
      expect(Object.keys(HOUSEHOLD_CLUSTER_MAP).length).toBe(12);
      for (const cluster of Object.values(HOUSEHOLD_CLUSTER_MAP)) {
        expect(cluster.id).toBeDefined();
        expect(cluster.label.length).toBeGreaterThan(0);
        expect(cluster.icon.length).toBeGreaterThan(0);
        expect(cluster.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(cluster.stems.length).toBeGreaterThan(0);
        expect(cluster.icons.length).toBeGreaterThan(0);
      }
    });
  });
});
