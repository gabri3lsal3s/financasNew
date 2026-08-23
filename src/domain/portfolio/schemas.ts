import { z } from "zod";

/**
 * Regex para validação de tickers de ativos:
 * • B3: 4 letras + dígitos (ex.: PETR4, VALE3, MXRF11, BOVA11, AAPL34)
 * • Cripto: BTC, ETH, SOL, USDT, USDC, etc.
 * • Renda Fixa / Caixa: prefixos como TESOURO, CDB, LCI, LCA, SELIC, CDI, CAIXA, RESERVA
 * • Internacional / EUA: 1 a 6 letras (ex.: AAPL, MSFT, IVV, VOO, BRK.B, BF.B)
 */
export const TICKER_REGEX = /^[A-Z0-9.\-=]{1,20}$/;

/** Schema para sanitização e validação de ticker de ativo. */
export const assetTickerSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .pipe(
    z
      .string()
      .min(1, "Informe o código ou nome do ativo")
      .max(20, "O código do ativo deve ter no máximo 20 caracteres")
      .regex(TICKER_REGEX, "Formato de código inválido (use apenas letras maiúsculas, números ou hífen/ponto)"),
  );

export const assetClassSchema = z
  .string()
  .trim()
  .min(1, "Selecione ou informe a classe do ativo")
  .max(50, "A classe deve ter no máximo 50 caracteres");

export const assetCurrencySchema = z.enum(["BRL", "USD"] as const, {
  message: "Moeda inválida (escolha BRL ou USD)",
});

/** Schema para criação de um Novo Ativo via Wizard. */
export const newAssetSchema = z.object({
  ticker: assetTickerSchema,
  asset_class: assetClassSchema,
  currency: assetCurrencySchema.default("BRL"),
  quantity: z
    .number({ message: "Informe uma quantidade válida" })
    .min(0, "A quantidade não pode ser negativa"),
  average_price: z
    .number({ message: "Informe um preço médio válido" })
    .min(0, "O preço médio não pode ser negativo"),
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
    .default(0),
  /** Dividendo mensal estimado por cota para alimentar a Bola de Neve (Cenário B). */
  estimated_monthly_dividend_per_share: z
    .number({ message: "Informe um valor válido para o dividendo estimado por cota" })
    .min(0, "O dividendo estimado por cota não pode ser negativo")
    .default(0),
  notes: z
    .string()
    .max(500, "As notas devem ter no máximo 500 caracteres")
    .nullable()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
});

export type NewAssetInput = z.infer<typeof newAssetSchema>;

/** Tipos suportados na Ordem / Movimentação Rápida. */
export const quickTransactionTypeSchema = z.enum([
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
      .min(0, "O preço não pode ser negativo"),
    total: z
      .number({ message: "Informe o valor total" })
      .min(0, "O total não pode ser negativo"),
    /** Opcional: registrar saída/entrada no Caixa da carteira (ativo 1:1). */
    syncCash: z.boolean().default(false),
    /** Opcional: registrar como aporte financeiro em portfolio_contributions (para compras). */
    recordContribution: z.boolean().default(true),
    notes: z
      .string()
      .max(500, "As notas devem ter no máximo 500 caracteres")
      .nullable()
      .optional()
      .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
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
  currency: assetCurrencySchema,
  /** Proventos históricos acumulados anteriores ao extrato periódico. Alimenta YoC e Bola de Neve. */
  accumulated_dividends: z
    .number({ message: "Informe um valor válido para proventos acumulados" })
    .min(0, "O valor de proventos acumulados não pode ser negativo")
    .default(0),
  /** Dividendo mensal estimado por cota para alimentar a Bola de Neve (Cenário B). */
  estimated_monthly_dividend_per_share: z
    .number({ message: "Informe um valor válido para o dividendo estimado por cota" })
    .min(0, "O dividendo estimado por cota não pode ser negativo")
    .default(0),
  notes: z
    .string()
    .max(500, "As notas devem ter no máximo 500 caracteres")
    .nullable()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
});

export type AssetMetadataInput = z.infer<typeof assetMetadataSchema>;
