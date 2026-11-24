import {
  StatementLayoutBlueprintSchema,
  type StatementLayoutBlueprint,
} from "./types";

const BUILTIN_UPDATED_AT = "2026-01-01T00:00:00.000Z";

function createBuiltinPdfBlueprint(config: {
  issuerKey: string;
  issuerName: string;
  startMarkers: string[];
  pauseMarkers?: string[];
  boletoMarkers?: string[];
  totalLabels?: string[];
  ignoredTotalLabels?: string[];
  columnMode?: "auto" | "single" | "bimodal";
  strictStartZone?: boolean;
  dateFormatHint?: "auto" | "dd/mm" | "dd/mm/yyyy" | "dd_mmm" | "iso";
}): StatementLayoutBlueprint {
  return StatementLayoutBlueprintSchema.parse({
    version: 1,
    fingerprint: `pdf:${config.issuerKey}`,
    issuerKey: config.issuerKey,
    issuerName: config.issuerName,
    fileKind: "pdf_text",
    origin: "builtin",
    pdfRules: {
      startMarkers: config.startMarkers,
      pauseMarkers: config.pauseMarkers ?? [
        "opcoes de parcelamento",
        "parcelamentos para aliviar",
        "outras formas de pagar",
        "demonstrativo de encargos",
        "canais de atendimento",
        "taxas taxa ao mes",
      ],
      boletoMarkers: config.boletoMarkers ?? [
        "autenticacao mecanica",
        "recibo do pagador",
        "recibo do sacado",
        "ficha de compensacao",
      ],
      totalLabels: config.totalLabels ?? [
        "despesas e creditos do mes",
        "valor da fatura",
        "total da fatura",
      ],
      ignoredTotalLabels: config.ignoredTotalLabels ?? [
        "pagamento minimo",
        "limite disponivel",
        "parcelamento em ate",
      ],
      columnMode: config.columnMode ?? "auto",
      strictStartZone: config.strictStartZone ?? false,
      requireExplicitDatePerLine: true,
    },
    polarity: "positive_purchase",
    dateFormatHint: config.dateFormatHint ?? "auto",
    currencyStrategy: "brl_rightmost",
    stats: {
      uses: 0,
      exactChecksumHits: 0,
      consecutiveFailures: 0,
      updatedAt: BUILTIN_UPDATED_AT,
    },
  });
}

/**
 * Catálogo nativo (origin: "builtin") cobrindo os principais emissores brasileiros:
 * Nomad, XP, Rico, Clear, Nubank, Itaú, Bradesco, Santander, Inter, C6, BTG, BB e Caixa.
 */
export const BUILTIN_STATEMENT_BLUEPRINTS: readonly StatementLayoutBlueprint[] = [
  createBuiltinPdfBlueprint({
    issuerKey: "nomad",
    issuerName: "Nomad",
    startMarkers: [
      "extrato referente ao mes",
      "data descricao valor",
      "lancamentos",
    ],
    pauseMarkers: [
      "opcoes de parcelamento",
      "parcelamentos para aliviar",
      "taxas taxa ao mes",
      "canais de atendimento",
      "informacoes importantes",
    ],
    totalLabels: ["despesas e creditos do mes", "valor da fatura"],
    columnMode: "single",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "xp",
    issuerName: "XP",
    startMarkers: [
      "lancamentos compras e saques",
      "detalhamento da fatura",
      "data estabelecimento valor",
    ],
    totalLabels: ["total da fatura", "valor da fatura"],
    columnMode: "auto",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "rico",
    issuerName: "Rico",
    startMarkers: [
      "lancamentos compras e saques",
      "detalhamento da fatura",
      "data estabelecimento valor",
    ],
    totalLabels: ["total da fatura", "valor da fatura"],
    columnMode: "auto",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "clear",
    issuerName: "Clear",
    startMarkers: [
      "lancamentos compras e saques",
      "detalhamento da fatura",
      "data estabelecimento valor",
    ],
    totalLabels: ["total da fatura", "valor da fatura"],
    columnMode: "auto",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "nubank",
    issuerName: "Nubank",
    startMarkers: [
      "transacoes de",
      "movimentacoes",
      "detalhamento das despesas",
    ],
    totalLabels: ["total a pagar", "valor da fatura", "total da fatura"],
    columnMode: "single",
    dateFormatHint: "dd_mmm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "itau",
    issuerName: "Itaú",
    startMarkers: [
      "lancamentos compras e saques",
      "lancamentos produtos e servicos",
      "data estabelecimento valor em",
    ],
    totalLabels: ["total desta fatura", "valor total da fatura"],
    columnMode: "auto",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "bradesco",
    issuerName: "Bradesco",
    startMarkers: [
      "lancamentos",
      "historico de lancamentos",
      "data historico de operacoes",
    ],
    totalLabels: ["total da fatura", "valor total"],
    columnMode: "auto",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "santander",
    issuerName: "Santander",
    startMarkers: [
      "detalhamento da fatura",
      "despesas do cartao",
      "compras nacionais",
    ],
    totalLabels: ["total a pagar", "total da fatura"],
    columnMode: "auto",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "inter",
    issuerName: "Inter",
    startMarkers: [
      "despesas da fatura",
      "lancamentos do cartao",
      "data movimentacao valor",
    ],
    totalLabels: ["total da fatura", "valor da fatura"],
    columnMode: "single",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "c6",
    issuerName: "C6 Bank",
    startMarkers: [
      "lancamentos da fatura",
      "compras nacionais",
      "compras internacionais",
    ],
    totalLabels: ["valor da fatura", "total da fatura"],
    columnMode: "single",
    dateFormatHint: "dd_mmm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "btg",
    issuerName: "BTG Pactual",
    startMarkers: [
      "detalhamento da fatura",
      "lancamentos",
      "data descricao valor",
    ],
    totalLabels: ["total da fatura", "valor da fatura"],
    columnMode: "single",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "bb",
    issuerName: "Banco do Brasil",
    startMarkers: [
      "lancamentos",
      "compras parceladas",
      "data descricao pais valor",
    ],
    totalLabels: ["total da fatura", "valor total da fatura"],
    columnMode: "auto",
    dateFormatHint: "dd/mm",
  }),
  createBuiltinPdfBlueprint({
    issuerKey: "caixa",
    issuerName: "Caixa",
    startMarkers: [
      "lancamentos da fatura",
      "detalhamento dos lancamentos",
      "data descricao valor",
    ],
    totalLabels: ["total da fatura", "valor total da fatura"],
    columnMode: "auto",
    dateFormatHint: "dd/mm",
  }),
];
