import { describe, expect, it } from "vitest";
import {
  inferCategoryKeyword,
  matchCategoryBySlug,
  normalizeInferenceText,
} from "./category-inference";

describe("category-inference (Motor Puro de Auto-Categorização)", () => {
  describe("normalizeInferenceText", () => {
    it("remove acentos, pontuação, múltiplos espaços e converte para minúsculas", () => {
      expect(normalizeInferenceText("Pão de Açúcar - Loja #42!!")).toBe("pao de acucar loja 42");
      expect(normalizeInferenceText("  REFEIÇÃO & CAFÉ   ")).toBe("refeicao cafe");
      expect(normalizeInferenceText("")).toBe("");
    });
  });

  describe("inferCategoryKeyword", () => {
    it("infere categoria 'mercado' para supermercados e atacados", () => {
      expect(inferCategoryKeyword("Supermercado Carrefour")).toBe("mercado");
      expect(inferCategoryKeyword("Pão de Açúcar Loja Morumbi")).toBe("mercado");
      expect(inferCategoryKeyword("Assaí Atacadista")).toBe("mercado");
      expect(inferCategoryKeyword("Atacadão Distribuição")).toBe("mercado");
      expect(inferCategoryKeyword("Hortifruti da Villa")).toBe("mercado");
      expect(inferCategoryKeyword("Sacolão São Jorge")).toBe("mercado");
    });

    it("infere categoria 'alimentacao' para restaurantes, padarias e delivery", () => {
      expect(inferCategoryKeyword("Padaria Bella Vista")).toBe("alimentacao");
      expect(inferCategoryKeyword("iFood *Restaurante Fogão")).toBe("alimentacao");
      expect(inferCategoryKeyword("McDonald's Drive Thru")).toBe("alimentacao");
      expect(inferCategoryKeyword("Pizzaria Forno a Lenha")).toBe("alimentacao");
      expect(inferCategoryKeyword("Starbucks Coffee")).toBe("alimentacao");
      expect(inferCategoryKeyword("Churrascaria Fogo de Chão")).toBe("alimentacao");
      expect(inferCategoryKeyword("Cacau Show Chocolates")).toBe("alimentacao");
    });

    it("infere categoria 'transporte' para postos, corridas e pedágios", () => {
      expect(inferCategoryKeyword("Uber *Trip 98712")).toBe("transporte");
      expect(inferCategoryKeyword("99Pop Corrida Centro")).toBe("transporte");
      expect(inferCategoryKeyword("Posto Shell Jardim")).toBe("transporte");
      expect(inferCategoryKeyword("Auto Posto Ipiranga")).toBe("transporte");
      expect(inferCategoryKeyword("Sem Parar Pedágio")).toBe("transporte");
      expect(inferCategoryKeyword("Estapar Estacionamentos")).toBe("transporte");
    });

    it("infere categoria 'saude' para farmácias, drogarias e clínicas", () => {
      expect(inferCategoryKeyword("Drogasil Filial 123")).toBe("saude");
      expect(inferCategoryKeyword("Droga Raia Centro")).toBe("saude");
      expect(inferCategoryKeyword("Farmácia Pague Menos")).toBe("saude");
      expect(inferCategoryKeyword("Laboratório Fleury")).toBe("saude");
      expect(inferCategoryKeyword("Consulta Médica Unimed")).toBe("saude");
    });

    it("infere categoria 'assinaturas' para streamings e serviços digitais", () => {
      expect(inferCategoryKeyword("Netflix.com Assinatura")).toBe("assinaturas");
      expect(inferCategoryKeyword("Spotify Premium Mensal")).toBe("assinaturas");
      expect(inferCategoryKeyword("Amazon Prime Video")).toBe("assinaturas");
      expect(inferCategoryKeyword("ChatGPT Subscription OpenAI")).toBe("assinaturas");
      expect(inferCategoryKeyword("Globoplay Mensal")).toBe("assinaturas");
      expect(inferCategoryKeyword("YouTube Premium")).toBe("assinaturas");
    });

    it("infere categoria 'lazer' para cinemas, hotéis, viagens e ingressos", () => {
      expect(inferCategoryKeyword("Cinemark Shopping Iguatemi")).toBe("lazer");
      expect(inferCategoryKeyword("Kinoplex Cinemas")).toBe("lazer");
      expect(inferCategoryKeyword("Airbnb Hospedagem")).toBe("lazer");
      expect(inferCategoryKeyword("Ingresso.com Show")).toBe("lazer");
      expect(inferCategoryKeyword("Decolar Passagens")).toBe("lazer");
    });

    it("infere categoria 'compras' para e-commerce, lojas e vestuário", () => {
      expect(inferCategoryKeyword("Amazon Marketplace BR")).toBe("compras");
      expect(inferCategoryKeyword("Mercado Livre Compra")).toBe("compras");
      expect(inferCategoryKeyword("Shopee Pedido")).toBe("compras");
      expect(inferCategoryKeyword("Magazine Luiza Loja")).toBe("compras");
      expect(inferCategoryKeyword("Zara Brasil Roupas")).toBe("compras");
      expect(inferCategoryKeyword("Lojas Renner Centro")).toBe("compras");
    });

    it("infere categoria 'compras' para marketplaces com sufixos regionais e acrônimos (Fase 11 / Tarefa 11.3)", () => {
      expect(inferCategoryKeyword("AMAZON BR")).toBe("compras");
      expect(inferCategoryKeyword("AMZN BR")).toBe("compras");
      expect(inferCategoryKeyword("MERCADOLIVRE BR")).toBe("compras");
      expect(inferCategoryKeyword("Amazon")).toBe("compras");
      expect(inferCategoryKeyword("Shopee Brasil")).toBe("compras");
    });

    it("infere categoria 'salario' para folhas de pagamento e proventos de trabalho", () => {
      expect(inferCategoryKeyword("Folha de Pagamento Empresa XYZ")).toBe("salario");
      expect(inferCategoryKeyword("Crédito Salário Mensal")).toBe("salario");
      expect(inferCategoryKeyword("Adiantamento Salarial")).toBe("salario");
      expect(inferCategoryKeyword("Remuneração Mensal")).toBe("salario");
    });

    it("retorna undefined para estabelecimentos ou termos genéricos desconhecidos", () => {
      expect(inferCategoryKeyword("Empresa XPTO Soluções")).toBeUndefined();
      expect(inferCategoryKeyword("Transferência PIX Recebida")).toBeUndefined();
      expect(inferCategoryKeyword("")).toBeUndefined();
    });
  });

  describe("matchCategoryBySlug", () => {
    const mockCategories = [
      { id: "c1", name: "Alimentação Diária", icon: "alimentacao" },
      { id: "c2", name: "Supermercado do Mês", icon: "mercado" },
      { id: "c3", name: "Combustível e Uber", icon: "transporte" },
      { id: "c4", name: "Farmácia e Remédios", icon: "saude" },
      { id: "c5", name: "Diversão e Viagens", icon: "lazer" },
      { id: "c6", name: "Serviços Digitais", icon: "assinaturas" },
      { id: "c7", name: "Roupas e E-commerce", icon: "compras" },
      { id: "c8", name: "Salário Fixo", icon: "salario" },
    ];

    it("faz match prioritário pelo ícone canônico configurado", () => {
      expect(matchCategoryBySlug(mockCategories, "alimentacao")?.id).toBe("c1");
      expect(matchCategoryBySlug(mockCategories, "mercado")?.id).toBe("c2");
      expect(matchCategoryBySlug(mockCategories, "transporte")?.id).toBe("c3");
      expect(matchCategoryBySlug(mockCategories, "saude")?.id).toBe("c4");
    });

    it("faz match pelo nome semântico caso o ícone seja genérico ou nulo", () => {
      const customCategories = [
        { id: "c-custom-1", name: "Supermercado e Feira", icon: null },
        { id: "c-custom-2", name: "Assinaturas de TV", icon: "outro" },
      ];

      expect(matchCategoryBySlug(customCategories, "mercado")?.id).toBe("c-custom-1");
      expect(matchCategoryBySlug(customCategories, "assinaturas")?.id).toBe("c-custom-2");
    });

    it("retorna undefined quando não houver nenhuma categoria correspondente", () => {
      const emptyList: Array<{ id: string; name: string; icon?: string | null }> = [];
      expect(matchCategoryBySlug(emptyList, "mercado")).toBeUndefined();

      const unrelated = [{ id: "cx", name: "Projetos Pessoais", icon: "projetos" }];
      expect(matchCategoryBySlug(unrelated, "mercado")).toBeUndefined();
    });
  });
});
