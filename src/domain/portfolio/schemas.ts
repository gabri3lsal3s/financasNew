import { z } from "zod";
import { cleanTextSchema, MAX_MONEY_AMOUNT, sanitizeString } from "@/domain/validation";

/**
 * Regex para validação de tickers de ativos:
 * • B3: 4 letras + dígitos (ex.: PETR4, VALE3, MXRF11, BOVA11, AAPL34)
 * • Cripto: BTC, ETH, SOL, USDT, USDC, etc.
 * • Renda Fixa / Caixa / Tesouro: TESOURO SELIC 2029, CDB INTER 110% CDI, LCI, LCA, IPCA+, CAIXA
 * • Internacional / EUA: 1 a 6 letras (ex.: AAPL, MSFT, IVV, VOO, BRK.B, BF.B)
 */
const TICKER_REGEX = /^[A-Z0-9.\-+=/%\s]{1,60}$/;

/** Schema para sanitização e validação de ticker de ativo. */
export const assetTickerSchema = z
  .string()
  .transform((val) => sanitizeString(val).toUpperCase())
  .pipe(
    z
      .string()
      .min(1, "Informe o código ou nome do ativo")
      .max(60, "O código do ativo deve ter no máximo 60 caracteres")
      .regex(TICKER_REGEX, "Formato de código inválido (use letras maiúsculas, números, espaços ou caracteres permitidos)"),
  );

const assetClassSchema = cleanTextSchema(50, { min: 1, requiredMessage: "Selecione ou informe a classe do ativo" });

const assetSectorSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (!val) return null;
    const clean = sanitizeString(val);
    return clean.length > 0 ? clean.slice(0, 100) : null;
  });

const notesSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (!val) return null;
    const clean = sanitizeString(val);
    return clean.length > 0 ? clean.slice(0, 500) : null;
  });

const assetCurrencySchema = z.enum(["BRL", "USD"] as const, {
  message: "Moeda inválida (escolha BRL ou USD)",
});

const fixedIncomeRateTypeSchema = z.enum(["cdi", "selic", "pre", "ipca"] as const, {
  message: "Indexador inválido (escolha CDI, Selic, Pré ou IPCA)",
});

/** Schema para validação de metadados de títulos de Renda Fixa parametrizada (Fase 63/72). */
export const fixedIncomeMetadataSchema = z.object({
  rate_type: fixedIncomeRateTypeSchema,
  rate_value: z
    .number({ message: "Informe uma taxa válida" })
    .min(0, "A taxa não pode ser negativa"),
  base_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data-base inválida (use o formato AAAA-MM-DD)"),
  base_value: z
    .number({ message: "Informe um saldo base válido" })
    .min(0, "O saldo base não pode ser negativo")
    .nullable()
    .optional(),
  initial_investment_value: z
    .number({ message: "Informe um valor aplicado inicial válido" })
    .min(0, "O valor aplicado inicial não pode ser negativo")
    .nullable()
    .optional(),
  initial_investment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de aplicação original inválida (use o formato AAAA-MM-DD)")
    .nullable()
    .optional(),
  maturity_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de vencimento inválida (use o formato AAAA-MM-DD)")
    .nullable()
    .optional(),
  is_tax_exempt: z.boolean().default(false),
  manual_tax_rate_pct: z
    .number()
    .min(0, "A alíquota de IR não pode ser negativa")
    .max(22.5, "A alíquota máxima de IR é 22.5%")
    .nullable()
    .optional(),
});

export type FixedIncomeMetadataInput = z.infer<typeof fixedIncomeMetadataSchema>;

/** Schema para criação de um Novo Ativo via Wizard. */
export const newAssetSchema = z.object({
  ticker: assetTickerSchema,
  asset_class: assetClassSchema,
  sector: assetSectorSchema,
  currency: assetCurrencySchema.default("BRL"),
  quantity: z
    .number({ message: "Informe uma quantidade válida" })
    .min(0, "A quantidade não pode ser negativa"),
  average_price: z
    .number({ message: "Informe um preço médio válido" })
    .min(0, "O preço médio não pode ser negativo")
    .max(MAX_MONEY_AMOUNT, "O preço médio não pode ultrapassar o limite monetário permitido"),
  target_percentage: z
    .number({ message: "Informe um percentual válido" })
    .min(0, "A meta não pode ser inferior a 0%")
    .max(100, "A meta não pode ultrapassar 100%")
    .nullable()
    .optional(),
  /** Proventos históricos acumulados anteriores ao extrato periódico. Alimenta YoC e Bola de Neve. */
  accumulated_dividends: z
    .number({ message: "Informe um valor válido para proventos acumulados" })
    .min(0, "O valor de proventos acumulados não pode ser negativo")
    .max(MAX_MONEY_AMOUNT, "O valor de proventos acumulados ultrapassa o limite monetário permitido")
    .default(0),
  /** Dividendo mensal estimado por cota para alimentar a Bola de Neve (Cenário B). */
  estimated_monthly_dividend_per_share: z
    .number({ message: "Informe um valor válido para o dividendo estimado por cota" })
    .min(0, "O dividendo estimado por cota não pode ser negativo")
    .max(MAX_MONEY_AMOUNT, "O dividendo estimado por cota ultrapassa o limite monetário permitido")
    .default(0),
  /** Metadados opcionais de títulos de renda fixa privada / parametrizada (Fase 63/72). */
  fixed_income_metadata: fixedIncomeMetadataSchema.nullable().optional(),
  notes: notesSchema,
});

export type NewAssetInput = z.infer<typeof newAssetSchema>;

/** Tipos suportados na Ordem / Movimentação Rápida. */
const quickTransactionTypeSchema = z.enum([
  "buy",
  "sell",
  "dividend",
  "jcp",
  "fii_yield",
  "subscription",
  "split",
  "reverse_split",
] as const);

/** Schema para validação de Ordens Rápidas (Quick Transaction Sheet). */
export const quickTransactionSchema = z
  .object({
    asset_id: z.string().min(1, "Selecione o ativo"),
    type: quickTransactionTypeSchema,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use o formato AAAA-MM-DD)"),
    quantity: z
      .number({ message: "Informe uma quantidade válida" })
      .min(0, "A quantidade não pode ser negativa"),
    price: z
      .number({ message: "Informe um preço válido" })
      .min(0, "O preço não pode ser negativo")
      .max(MAX_MONEY_AMOUNT, "O preço ultrapassa o limite monetário permitido"),
    total: z
      .number({ message: "Informe o valor total" })
      .min(0, "O total não pode ser negativo")
      .max(MAX_MONEY_AMOUNT, "O total ultrapassa o limite monetário permitido"),
    /** Opcional: registrar saída/entrada no Caixa da carteira (ativo 1:1). */
    syncCash: z.boolean().default(false),
    /** Opcional: registrar como aporte financeiro em portfolio_contributions (para compras). */
    recordContribution: z.boolean().default(true),
    notes: notesSchema,
  })
  .refine(
    (data) => {
      // Se for compra ou venda de ativo com cotas, quantidade e preço não podem ser zero
      if (data.type === "buy" || data.type === "sell" || data.type === "subscription") {
        return (data.quantity > 0 && data.price > 0) || data.total > 0;
      }
      // Se for dividendo/jcp/fii_yield, total deve ser > 0
      if (data.type === "dividend" || data.type === "jcp" || data.type === "fii_yield") {
        return data.total > 0;
      }
      // Split / Reverse split
      if (data.type === "split" || data.type === "reverse_split") {
        return data.quantity > 1;
      }
      return true;
    },
    {
      message: "Valores incompatíveis com a operação selecionada",
      path: ["total"],
    },
  );

export type QuickTransactionInput = z.infer<typeof quickTransactionSchema>;

/** Schema para edição cadastral de Metadados do Ativo (AssetEditDialog). */
export const assetMetadataSchema = z.object({
  ticker: assetTickerSchema,
  asset_class: assetClassSchema,
  sector: assetSectorSchema,
  currency: assetCurrencySchema,
  quantity: z
    .number({ message: "Informe uma quantidade válida" })
    .min(0, "A quantidade não pode ser negativa")
    .optional(),
  average_price: z
    .number({ message: "Informe um preço médio válido" })
    .min(0, "O preço médio não pode ser negativo")
    .max(MAX_MONEY_AMOUNT, "O preço médio ultrapassa o limite monetário permitido")
    .optional(),
  /** Proventos históricos acumulados anteriores ao extrato periódico. Alimenta YoC e Bola de Neve. */
  accumulated_dividends: z
    .number({ message: "Informe um valor válido para proventos acumulados" })
    .min(0, "O valor de proventos acumulados não pode ser negativo")
    .max(MAX_MONEY_AMOUNT, "O valor de proventos acumulados ultrapassa o limite monetário permitido")
    .default(0),
  /** Dividendo mensal estimado por cota para alimentar a Bola de Neve (Cenário B). */
  estimated_monthly_dividend_per_share: z
    .number({ message: "Informe um valor válido para o dividendo estimado por cota" })
    .min(0, "O dividendo estimado por cota não pode ser negativo")
    .max(MAX_MONEY_AMOUNT, "O dividendo estimado por cota ultrapassa o limite monetário permitido")
    .default(0),
  /** Metadados opcionais de títulos de renda fixa privada / parametrizada (Fase 63/72). */
  fixed_income_metadata: fixedIncomeMetadataSchema.nullable().optional(),
  notes: notesSchema,
});

export type AssetMetadataInput = z.infer<typeof assetMetadataSchema>;
