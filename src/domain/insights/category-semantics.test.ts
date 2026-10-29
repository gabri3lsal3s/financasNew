import { describe, expect, it } from "vitest";
import { findBestMatchingCategory, resolveCategorySemantics } from "./category-semantics";

describe("resolveCategorySemantics — inteligência para categorias padrão e customizadas", () => {
  describe("Essencialidade e não cortabilidade", () => {
    it("reconhece categorias padrão com ícones essenciais", () => {
      expect(resolveCategorySemantics({ name: "Moradia", icon: "moradia" })).toMatchObject({
        isEssential: true,
        tier: "essential",
        nature: "essential",
      });
      expect(resolveCategorySemantics({ name: "Saúde", icon: "saude" })).toMatchObject({
        isEssential: true,
        tier: "essential",
      });
      expect(resolveCategorySemantics({ name: "Educação", icon: "educacao" })).toMatchObject({
        isEssential: true,
        tier: "essential",
      });
    });

    it("reconhece categorias personalizadas por nome, mesmo com ícone nulo ou genérico", () => {
      // Plano de saúde / médico
      expect(resolveCategorySemantics({ name: "Unimed Familiar", icon: null })).toMatchObject({
        isEssential: true,
        tier: "essential",
        segment: "health",
      });
      expect(resolveCategorySemantics({ name: "Convênio Médico", icon: "cartao" })).toMatchObject({
        isEssential: true,
        tier: "essential",
        segment: "health",
      });

      // Moradia / Contas básicas
      expect(resolveCategorySemantics({ name: "Condomínio Edifício Solar", icon: null })).toMatchObject({
        isEssential: true,
        tier: "essential",
      });
      expect(resolveCategorySemantics({ name: "Conta de Luz Enel", icon: null })).toMatchObject({
        isEssential: true,
        tier: "essential",
      });
      expect(resolveCategorySemantics({ name: "Internet Fibra Óptica", icon: null })).toMatchObject({
        isEssential: true,
        tier: "essential",
        segment: "telecom",
      });

      // Educação
      expect(resolveCategorySemantics({ name: "Faculdade Direito", icon: null })).toMatchObject({
        isEssential: true,
        tier: "essential",
      });
      expect(resolveCategorySemantics({ name: "Colégio das Crianças", icon: "wallet" })).toMatchObject({
        isEssential: true,
        tier: "essential",
      });
    });

    it("reconhece categorias discricionárias / de estilo de vida", () => {
      expect(resolveCategorySemantics({ name: "Rolês e Festas", icon: null })).toMatchObject({
        isEssential: false,
        tier: "discretionary",
        nature: "discretionary",
      });
      expect(resolveCategorySemantics({ name: "Jogos e Games", icon: "lazer" })).toMatchObject({
        isEssential: false,
        tier: "discretionary",
        nature: "discretionary",
      });
      expect(resolveCategorySemantics({ name: "Roupas e Acessórios", icon: "compras" })).toMatchObject({
        isEssential: false,
        tier: "discretionary",
      });
    });
  });

  describe("Agregadoras (exclusão de similaridade espúria)", () => {
    it("identifica categorias agregadoras padrão por ícone", () => {
      expect(resolveCategorySemantics({ name: "Mercado", icon: "mercado" }).isAggregator).toBe(true);
      expect(resolveCategorySemantics({ name: "Transporte", icon: "transporte" }).isAggregator).toBe(true);
      expect(resolveCategorySemantics({ name: "Combustível", icon: "combustivel" }).isAggregator).toBe(true);
      expect(resolveCategorySemantics({ name: "Farmácia", icon: "farmacia" }).isAggregator).toBe(true);
    });

    it("identifica categorias agregadoras personalizadas pelo nome", () => {
      expect(resolveCategorySemantics({ name: "Supermercado Compre Bem", icon: null }).isAggregator).toBe(true);
      expect(resolveCategorySemantics({ name: "Hortifruti da Esquina", icon: "sacola" }).isAggregator).toBe(true);
      expect(resolveCategorySemantics({ name: "Posto de Gasolina Shell", icon: "carro" }).isAggregator).toBe(true);
      expect(resolveCategorySemantics({ name: "Abastecimento do Carro", icon: null }).isAggregator).toBe(true);
      expect(resolveCategorySemantics({ name: "Droga Raia Medicamentos", icon: null }).isAggregator).toBe(true);
    });

    it("não marca categorias unitárias ou específicas como agregadoras", () => {
      expect(resolveCategorySemantics({ name: "Aluguel", icon: "moradia" }).isAggregator).toBe(false);
      expect(resolveCategorySemantics({ name: "Netflix", icon: "assinaturas" }).isAggregator).toBe(false);
      expect(resolveCategorySemantics({ name: "Cinema", icon: "lazer" }).isAggregator).toBe(false);
    });
  });

  describe("Assinaturas e Serviços Recorrentes", () => {
    it("identifica assinaturas por ícone padrão", () => {
      expect(resolveCategorySemantics({ name: "Assinaturas", icon: "assinaturas" }).isSubscriptionCategory).toBe(true);
      expect(resolveCategorySemantics({ name: "Streams", icon: "streaming" }).isSubscriptionCategory).toBe(true);
    });

    it("identifica assinaturas por nomes personalizados", () => {
      expect(
        resolveCategorySemantics({ name: "Mensalidades e Serviços Digitais", icon: null }).isSubscriptionCategory,
      ).toBe(true);
      expect(resolveCategorySemantics({ name: "Clubes de Assinatura", icon: "cartao" }).isSubscriptionCategory).toBe(
        true,
      );
      expect(resolveCategorySemantics({ name: "Softwares e SaaS", icon: null }).isSubscriptionCategory).toBe(true);
    });
  });

  describe("Investimentos e Aportes", () => {
    it("identifica categorias de investimento por nome ou ícone", () => {
      expect(resolveCategorySemantics({ name: "Investimentos", icon: "investimentos" })).toMatchObject({
        nature: "investment",
      });
      expect(resolveCategorySemantics({ name: "Aportes Mensais em Ações", icon: null })).toMatchObject({
        nature: "investment",
      });
      expect(resolveCategorySemantics({ name: "Tesouro Selic", icon: "banco" })).toMatchObject({
        nature: "investment",
      });
    });
  });

  describe("findBestMatchingCategory", () => {
    const userCategories = [
      { id: "1", name: "Supermercado Semanal", icon: "sacola" },
      { id: "2", name: "Uber e Transporte", icon: "transporte" },
      { id: "3", name: "Convênio Unimed", icon: "saude" },
      { id: "4", name: "Serviços Digitais", icon: "assinaturas" },
      { id: "5", name: "Restaurante e Lanches", icon: null },
    ];

    it("encontra categoria por slug inferido via semântica", () => {
      const matchMercado = findBestMatchingCategory(userCategories, "mercado");
      expect(matchMercado?.id).toBe("1");

      const matchTransporte = findBestMatchingCategory(userCategories, "transporte");
      expect(matchTransporte?.id).toBe("2");

      const matchSaude = findBestMatchingCategory(userCategories, "saude");
      expect(matchSaude?.id).toBe("3");

      const matchAssinaturas = findBestMatchingCategory(userCategories, "assinaturas");
      expect(matchAssinaturas?.id).toBe("4");

      const matchAlimentacao = findBestMatchingCategory(userCategories, "alimentacao");
      expect(matchAlimentacao?.id).toBe("5");
    });

    it("retorna undefined quando não encontra correspondência", () => {
      expect(findBestMatchingCategory(userCategories, "pets")).toBeUndefined();
    });
  });

  describe("Auditoria das 11 Categorias Padrão Canônicas (Tarefa 4.2)", () => {
    it("resolve determinismo estrito para as categorias canônicas", () => {
      // 1. Alimentação
      expect(resolveCategorySemantics({ name: "Alimentação", icon: "alimentacao" })).toMatchObject({
        isEssential: true,
        isAggregator: true,
        canonicalSlug: "alimentacao",
      });

      // 2. Moradia
      expect(resolveCategorySemantics({ name: "Moradia", icon: "moradia" })).toMatchObject({
        isEssential: true,
        canonicalSlug: "moradia",
      });

      // 3. Transporte
      expect(resolveCategorySemantics({ name: "Transporte", icon: "transporte" })).toMatchObject({
        isEssential: true,
        isAggregator: true,
        canonicalSlug: "transporte",
      });

      // 4. Saúde
      expect(resolveCategorySemantics({ name: "Saúde", icon: "saude" })).toMatchObject({
        isEssential: true,
        tier: "essential",
        canonicalSlug: "saude",
      });

      // 5. Educação
      expect(resolveCategorySemantics({ name: "Educação", icon: "educacao" })).toMatchObject({
        isEssential: true,
        tier: "essential",
        canonicalSlug: "educacao",
      });

      // 6. Lazer
      expect(resolveCategorySemantics({ name: "Lazer", icon: "lazer" })).toMatchObject({
        isEssential: false,
        tier: "discretionary",
        canonicalSlug: "lazer",
      });

      // 7. Compras
      expect(resolveCategorySemantics({ name: "Compras", icon: "compras" })).toMatchObject({
        isEssential: false,
        tier: "discretionary",
        canonicalSlug: "compras",
      });

      // 8. Assinaturas
      expect(resolveCategorySemantics({ name: "Assinaturas", icon: "assinaturas" })).toMatchObject({
        isSubscriptionCategory: true,
        canonicalSlug: "assinaturas",
      });

      // 9. Salário
      expect(resolveCategorySemantics({ name: "Salário", icon: "salario" })).toMatchObject({
        canonicalSlug: "salario",
      });

      // 10. Investimentos
      expect(resolveCategorySemantics({ name: "Investimentos", icon: "investimentos" })).toMatchObject({
        nature: "investment",
        canonicalSlug: "investimentos",
      });

      // 11. Outras Rendas
      expect(resolveCategorySemantics({ name: "Outras Rendas", icon: "salario" })).toMatchObject({
        canonicalSlug: "salario",
      });
    });
  });
});
