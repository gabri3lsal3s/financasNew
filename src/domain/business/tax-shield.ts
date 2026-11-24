/**
 * Motor puro de Escudo Tributário Líquido (Fase 2B).
 *
 * Calcula a provisão recomendada de imposto para o negócio (DAS fixo no perfil MEI
 * ou percentual sobre faturamento bruto para Liberal / Microempresa) e abate apenas os
 * impostos fiscais efetivamente pagos (`isBusinessFiscalTaxExpense`), garantindo que
 * IOF de cartão jamais reduza a provisão devida ao Fisco.
 */

import { sumWeightedCents } from "@/domain/money";
import type { BusinessProfileKind } from "@/types";
import { isBusinessFiscalTaxExpense, type DreExpenseInput } from "./dre-calculator";

export const DEFAULT_MEI_MONTHLY_DAS_CENTS = 7_590; // R$ 75,90 (referência parametrizável)
export const DEFAULT_TAX_PROVISION_RATE_PCT = 6;

export interface TaxShieldExpenseInput extends DreExpenseInput {
  is_tax_deductible?: boolean | null;
}

export interface TaxShieldResult {
  estimatedTaxCents: number;
  paidFiscalTaxesCents: number;
  netProvisionRemainingCents: number;
  coveragePct: number;
  isFullyCovered: boolean;
  deductibleExpensesCents: number;
}

export function calculateTaxShield(params: {
  profileKind: BusinessProfileKind;
  grossRevenueCents: number;
  expenses: readonly TaxShieldExpenseInput[];
  monthlyDasCents?: number;
  taxProvisionRatePct?: number;
}): TaxShieldResult {
  const safeRevenue = Math.max(0, Math.round(params.grossRevenueCents));
  const monthlyDasCents = Math.max(0, Math.round(params.monthlyDasCents ?? DEFAULT_MEI_MONTHLY_DAS_CENTS));
  const ratePct = Math.max(0, params.taxProvisionRatePct ?? DEFAULT_TAX_PROVISION_RATE_PCT);

  const estimatedTaxCents =
    params.profileKind === "mei"
      ? monthlyDasCents
      : Math.round((safeRevenue * ratePct) / 100);

  const paidFiscalTaxesCents = sumWeightedCents(
    params.expenses
      .filter((e) => isBusinessFiscalTaxExpense(e))
      .map((e) => ({ value: e.value, report_weight: e.report_weight ?? 1 })),
  );

  const netProvisionRemainingCents = Math.max(0, estimatedTaxCents - paidFiscalTaxesCents);
  const coveragePct =
    estimatedTaxCents > 0
      ? Math.min(100, Number(((paidFiscalTaxesCents / estimatedTaxCents) * 100).toFixed(1)))
      : 100;

  const deductibleExpensesCents = sumWeightedCents(
    params.expenses
      .filter(
        (e) =>
          (e.scope ?? "personal") === "business" &&
          !e.is_internal_transfer &&
          Boolean(e.is_tax_deductible),
      )
      .map((e) => ({ value: e.value, report_weight: e.report_weight ?? 1 })),
  );

  return {
    estimatedTaxCents,
    paidFiscalTaxesCents,
    netProvisionRemainingCents,
    coveragePct,
    isFullyCovered: estimatedTaxCents > 0 ? netProvisionRemainingCents === 0 : true,
    deductibleExpensesCents,
  };
}

export interface TaxDeductibilityInference {
  isDeductible: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
}

const DEDUCTIBLE_KEYWORDS = [
  // Nuvem, SaaS e TI
  "aws",
  "amazon web services",
  "google cloud",
  "azure",
  "supabase",
  "vercel",
  "github",
  "figma",
  "canva",
  "adobe",
  "notion",
  "slack",
  "zoom",
  "chatgpt",
  "openai",
  "hospedagem",
  "dominio",
  "servidor",
  "software",
  "licenca",
  "saas",
  // Contabilidade, Jurídico e Serviços
  "contabilidade",
  "contador",
  "honorario",
  "honorarios",
  "assessoria",
  "consultoria",
  "certificado digital",
  "certisign",
  "serasa cert",
  "soluti",
  "correios",
  "motoboy",
  "frete",
  "taxa bancaria",
  "anuidade oab",
  "anuidade crm",
  "anuidade crc",
  "anuidade crea",
  "das mei",
  "alvara",
  // Escritório e Operação
  "escritorio",
  "papelaria",
  "toner",
  "cartucho",
  "suprimentos",
  "insumo",
  "insumos",
  "materia prima",
  "embalagem",
  // Sede Comercial
  "aluguel comercial",
  "coworking",
  "we work",
  "wework",
  "internet comercial",
  "energia comercial",
  // Educação Profissional
  "curso",
  "treinamento",
  "certificacao",
  "congresso",
  "seminario",
  "livro tecnico",
] as const;

const NON_DEDUCTIBLE_DOMESTIC_KEYWORDS = [
  "supermercado",
  "padaria",
  "sacolao",
  "acougue",
  "feira livre",
  "cinema",
  "cinemark",
  "netflix",
  "disney",
  "spotify",
  "hbo",
  "max",
  "parque",
  "brinquedo",
  "roupa",
  "calcado",
  "farmacia",
  "drogaria",
  "pet shop",
  "veterinario",
  "escola infantil",
] as const;

function normalizeSearchText(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heurística determinística pura para inferência de dedutibilidade fiscal (Livro-Caixa / Carnê-Leão / MEI).
 */
export function inferBusinessTaxDeductibility(input: {
  description?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
}): TaxDeductibilityInference {
  const normDesc = normalizeSearchText(input.description);
  const normCat = normalizeSearchText(input.categoryName);
  const normSlug = normalizeSearchText(input.categorySlug);
  const combined = `${normDesc} ${normCat} ${normSlug}`.trim();

  if (!combined) {
    return {
      isDeductible: false,
      confidence: "low",
      reason: "Sem informações textuais para inferir dedutibilidade fiscal.",
    };
  }

  // Se houver indício claro de despesa doméstica estrita, não é dedutível
  for (const nonDed of NON_DEDUCTIBLE_DOMESTIC_KEYWORDS) {
    if (combined.includes(nonDed)) {
      return {
        isDeductible: false,
        confidence: "high",
        reason: `Despesa com padrão doméstico ou de consumo pessoal (${nonDed}), não elegível a dedução fiscal.`,
      };
    }
  }

  // Verifica termos dedutíveis
  for (const ded of DEDUCTIBLE_KEYWORDS) {
    if (combined.includes(ded)) {
      return {
        isDeductible: true,
        confidence: "high",
        reason: `Despesa operacional necessária à atividade (${ded}), elegível para dedução fiscal / Livro-Caixa.`,
      };
    }
  }

  // Se a categoria corporativa contiver palavras de serviço, insumo ou operação
  if (
    normCat.includes("insumo") ||
    normCat.includes("operacao") ||
    normCat.includes("software") ||
    normCat.includes("imposto") ||
    normCat.includes("tributo")
  ) {
    return {
      isDeductible: true,
      confidence: "medium",
      reason: "Categoria identificada como operacional do negócio.",
    };
  }

  return {
    isDeductible: false,
    confidence: "low",
    reason: "Despesa corporativa padrão sem indício automático de dedutibilidade fiscal.",
  };
}
