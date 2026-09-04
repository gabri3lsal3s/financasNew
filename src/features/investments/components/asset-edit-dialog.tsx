import { useState } from "react";
import { ChevronUp } from "lucide-react";
import { numberToCents, parseDecimalNumber } from "@/domain/money";
import { Alert, Badge, Button, Checkbox, Input, Modal, MoneyInput, MoneyText, NumericInput, Select } from "@/components/ui";
import { isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { assetMetadataSchema } from "@/domain/portfolio/schemas";
import { DEFAULT_SECTORS_BY_CLASS, inferSectorFromTicker } from "@/domain/portfolio/tickers-catalog";
import { todayISO } from "@/domain/debts";
import { getErrorMessage } from "@/services/errors";
import { useAssetPrices, useSetManualPrice, useUpdatePortfolioAsset } from "@/state";
import type { AssetCurrency, FixedIncomeMetadata, FixedIncomeRateType, PortfolioAsset } from "@/types";
import { cn } from "@/lib/utils";
import { FixedIncomeFormFields } from "./fixed-income-form-fields";

export interface AssetEditDialogProps {
  asset: PortfolioAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ASSET_CLASSES = [
  { value: "Ações", label: "Ações" },
  { value: "FIIs", label: "FIIs / Imobiliário" },
  { value: "ETFs", label: "ETFs / Índices" },
  { value: "BDRs", label: "BDRs" },
  { value: "Renda Fixa", label: "Renda Fixa" },
  { value: "Cripto", label: "Criptomoedas" },
  { value: "Caixa", label: "Caixa / Reserva" },
  { value: "Internacional", label: "Internacional (EUA)" },
];

const CURRENCIES: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (Reais)" },
  { value: "USD", label: "USD (Dólares)" },
];

/** Classes para as quais a Moeda faz sentido (BDRs e Internacional negociam em USD). */
const CLASSES_WITH_CURRENCY = new Set(["BDRs", "Internacional"]);

/** Classes sem bloco de Proventos (Cripto não distribui proventos no escopo do app). */
const CLASSES_WITHOUT_DIVIDENDS = new Set(["Cripto", "Caixa"]);

interface AssetEditFormContentProps {
  asset: PortfolioAsset;
  onClose: () => void;
}

function AssetEditFormContent({ asset, onClose }: AssetEditFormContentProps) {
  const updateAsset = useUpdatePortfolioAsset();
  const pricesQuery = useAssetPrices();
  const setManualPrice = useSetManualPrice();

  const [ticker, setTicker] = useState(asset.ticker);
  const [assetClass, setAssetClass] = useState(asset.asset_class ?? "Ações");
  const [sector, setSector] = useState(asset.sector ?? inferSectorFromTicker(asset.ticker, asset.asset_class));
  const [currency, setCurrency] = useState<AssetCurrency>(asset.currency ?? "BRL");
  const [notes, setNotes] = useState(
    asset.notes
      ? asset.notes.replace(/\[PRICING:(UNIT|TOTAL)\]/g, "").trim()
      : "",
  );
  const [accumulatedDividendsCents, setAccumulatedDividendsCents] = useState(
    numberToCents(asset.accumulated_dividends ?? 0),
  );
  const [estimatedDividendPerShareCents, setEstimatedDividendPerShareCents] = useState(
    numberToCents(asset.estimated_monthly_dividend_per_share ?? 0),
  );

  // Parâmetros de Renda Fixa (Fase 63/72)
  const [fixedIncomeRateType, setFixedIncomeRateType] = useState<FixedIncomeRateType>(
    asset.fixed_income_metadata?.rate_type ?? "cdi",
  );
  const [fixedIncomeRateValue, setFixedIncomeRateValue] = useState<number>(
    asset.fixed_income_metadata?.rate_value ?? 0,
  );
  const [fixedIncomeBaseDate, setFixedIncomeBaseDate] = useState<string>(
    asset.fixed_income_metadata?.base_date ?? todayISO(),
  );
  const [fixedIncomeInitialInvestmentDate, setFixedIncomeInitialInvestmentDate] = useState<string>(
    asset.fixed_income_metadata?.initial_investment_date ?? "",
  );
  const [fixedIncomeMaturityDate, setFixedIncomeMaturityDate] = useState<string>(
    asset.fixed_income_metadata?.maturity_date ?? "",
  );
  const [fixedIncomeIsTaxExempt, setFixedIncomeIsTaxExempt] = useState<boolean>(
    Boolean(asset.fixed_income_metadata?.is_tax_exempt),
  );
  const [fixedIncomeManualTaxRatePct, setFixedIncomeManualTaxRatePct] = useState<number | null>(
    asset.fixed_income_metadata?.manual_tax_rate_pct ?? null,
  );

  const [error, setError] = useState<string | null>(null);

  // ─── Derivados de tipo de ativo ──────────────────────────────────────────
  const isCash = isCashAssetClass(assetClass) || ticker.trim().toUpperCase() === "CAIXA";
  const isTesouro = isTesouroAsset(ticker, assetClass);
  const isFixedIncome = isFixedIncomeClass(assetClass) || isTesouro;
  const isCrypto = assetClass === "Cripto";

  /** Moeda só é editável para BDRs e Internacional */
  const needsCurrencyField = CLASSES_WITH_CURRENCY.has(assetClass);

  /** Setor em Renda Fixa vira chips apenas (sem input livre) */
  const isSectorChipsOnly = isFixedIncome && !isCash;
  const sectorLabel = isFixedIncome ? "Indexador / Segmento" : "Setor / Segmento / Indexador";

  const recommendedSectors = DEFAULT_SECTORS_BY_CLASS[assetClass] ?? [];

  // Modo efetivo de valor total (Renda Fixa e Tesouro Direto)
  const isTotalValueMode = !isCash && isFixedIncome;
  const isClosed = !isCash && (asset.quantity <= 0);

  // ─── Preços para modo total_value ─────────────────────────────────────────
  const priceQuote = (pricesQuery.data ?? []).find(
    (p) => p.ticker.toUpperCase() === (asset.ticker ?? ticker).trim().toUpperCase(),
  );
  const existingInitialPrice = asset
    ? asset.fixed_income_metadata?.initial_investment_value !== undefined &&
      asset.fixed_income_metadata?.initial_investment_value !== null &&
      asset.fixed_income_metadata.initial_investment_value > 0
      ? asset.fixed_income_metadata.initial_investment_value
      : asset.average_price > 0
        ? asset.average_price
        : asset.quantity > 0
          ? asset.quantity
          : 0
    : 0;
  const existingCurrentPrice = isClosed
    ? 0
    : asset.fixed_income_metadata?.base_value !== undefined &&
      asset.fixed_income_metadata?.base_value !== null &&
      asset.fixed_income_metadata.base_value > 0
      ? asset.fixed_income_metadata.base_value
      : priceQuote?.manual_price ?? priceQuote?.price ?? existingInitialPrice;

  const [initialPriceCents, setInitialPriceCents] = useState(numberToCents(existingInitialPrice));
  const [currentPriceCents, setCurrentPriceCents] = useState(numberToCents(existingCurrentPrice));

  // ─── Modo Cotas / PM ──────────────────────────────────────────────────────
  const [quantityStr, setQuantityStr] = useState(
    asset.quantity !== undefined && asset.quantity > 0
      ? String(asset.quantity)
      : isCash
        ? String(asset.quantity ?? 0)
        : "",
  );
  const [averagePriceCents, setAveragePriceCents] = useState(
    asset.average_price !== undefined ? numberToCents(asset.average_price) : 0,
  );

  // ─── Proventos ────────────────────────────────────────────────────────────
  /** Ativo já tem proventos salvos → expandir automaticamente */
  const hasStoredDividends =
    (asset.accumulated_dividends ?? 0) > 0 ||
    (asset.estimated_monthly_dividend_per_share ?? 0) > 0;

  /**
   * Para RF/Tesouro: toggle "Distribui juros/cupons" controla a visibilidade.
   * Para Ações/FIIs etc.: link colapsável.
   * Cripto e Caixa: sem bloco de proventos.
   */
  const [distributesInterest, setDistributesInterest] = useState(
    isFixedIncome ? hasStoredDividends : false,
  );
  const [showDividendPanel, setShowDividendPanel] = useState(hasStoredDividends);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleClassChange = (newClass: string) => {
    setAssetClass(newClass);
    const suggested = inferSectorFromTicker(ticker, newClass);
    setSector(suggested);
    // Resetar moeda para BRL quando a classe não precisa de moeda
    if (!CLASSES_WITH_CURRENCY.has(newClass)) {
      setCurrency("BRL");
    }
    const upper = ticker.toUpperCase();
    if (upper.includes("LCI") || upper.includes("LCA") || upper.includes("CRI") || upper.includes("CRA")) {
      setFixedIncomeIsTaxExempt(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedQuantity = parseDecimalNumber(quantityStr);
    const parsedAvgPrice = averagePriceCents / 100;

    let payloadQuantity: number;
    let payloadAvgPrice: number;
    const finalNotes = notes.trim() || null;

    if (isCash) {
      payloadQuantity = parsedQuantity;
      payloadAvgPrice = 1;
    } else if (isClosed) {
      payloadQuantity = 0;
      payloadAvgPrice = 0;
    } else if (isTotalValueMode) {
      payloadQuantity = 1;
      payloadAvgPrice = initialPriceCents / 100;
    } else {
      payloadQuantity = Math.max(0, parsedQuantity);
      payloadAvgPrice = Math.max(0, parsedAvgPrice);
    }

    let fiMetadata: FixedIncomeMetadata | null = null;
    if (isFixedIncome && !isCash) {
      const existingFi = asset.fixed_income_metadata;
      const currentBalance = currentPriceCents > 0 ? currentPriceCents / 100 : initialPriceCents / 100;
      fiMetadata = {
        rate_type: fixedIncomeRateType,
        rate_value: fixedIncomeRateValue,
        base_date: fixedIncomeBaseDate || existingFi?.base_date || todayISO(),
        base_value: isClosed ? 0 : isTotalValueMode && currentBalance > 0 ? currentBalance : (existingFi?.base_value ?? null),
        initial_investment_value: initialPriceCents > 0 ? initialPriceCents / 100 : (existingFi?.initial_investment_value ?? null),
        initial_investment_date: fixedIncomeInitialInvestmentDate ? fixedIncomeInitialInvestmentDate.slice(0, 10) : (existingFi?.initial_investment_date ?? null),
        maturity_date: fixedIncomeMaturityDate ? fixedIncomeMaturityDate.slice(0, 10) : null,
        is_tax_exempt: fixedIncomeIsTaxExempt,
        manual_tax_rate_pct: fixedIncomeIsTaxExempt ? null : fixedIncomeManualTaxRatePct,
      };
    }

    // Se Proventos estão ocultos/desmarcados, zerar os valores no payload
    const shouldSaveDividends = !CLASSES_WITHOUT_DIVIDENDS.has(assetClass) &&
      (isFixedIncome ? distributesInterest : showDividendPanel);

    const validation = assetMetadataSchema.safeParse({
      ticker,
      asset_class: assetClass,
      sector: sector.trim() || null,
      currency,
      quantity: payloadQuantity,
      average_price: payloadAvgPrice,
      accumulated_dividends: shouldSaveDividends ? accumulatedDividendsCents / 100 : 0,
      estimated_monthly_dividend_per_share: shouldSaveDividends ? estimatedDividendPerShareCents / 100 : 0,
      fixed_income_metadata: fiMetadata,
      notes: finalNotes,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    try {
      await updateAsset.mutateAsync({
        id: asset.id,
        patch: {
          ticker: validation.data.ticker,
          asset_class: validation.data.asset_class,
          sector: validation.data.sector,
          currency: validation.data.currency,
          quantity: validation.data.quantity,
          average_price: validation.data.average_price,
          accumulated_dividends: validation.data.accumulated_dividends,
          estimated_monthly_dividend_per_share: validation.data.estimated_monthly_dividend_per_share,
          fixed_income_metadata: validation.data.fixed_income_metadata,
          notes: validation.data.notes,
        },
      });

      // Se estiver em modo total_value, grava também o preço atual / saldo no cache/manual
      if (isTotalValueMode) {
        const priceToSave = currentPriceCents > 0 ? currentPriceCents / 100 : initialPriceCents / 100;
        if (priceToSave > 0) {
          await setManualPrice.mutateAsync({
            ticker: validation.data.ticker,
            price: priceToSave,
          });
        }
      }

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Ticker */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-asset-ticker" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Código do Ativo (Ticker)
        </label>
        <Input
          id="edit-asset-ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase().trim())}
          placeholder="Ex: WEGE3"
          className="font-mono uppercase font-bold"
        />
      </div>

      {/* Classe + Moeda (Moeda só para BDRs / Internacional) */}
      <div className={cn("grid grid-cols-1 gap-4", needsCurrencyField ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Classe de Ativo
          </span>
          <Select
            value={assetClass}
            onValueChange={handleClassChange}
            options={ASSET_CLASSES}
          />
        </div>

        {needsCurrencyField && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Moeda
            </span>
            <Select
              value={currency}
              onValueChange={(val) => setCurrency(val as AssetCurrency)}
              options={CURRENCIES}
            />
          </div>
        )}
      </div>

      {/* Setor — oculto para Caixa; chips apenas para RF/Tesouro */}
      {!isCash && (
        <div className="flex flex-col gap-1.5">
          {!isSectorChipsOnly && (
            <label htmlFor="edit-asset-sector" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {sectorLabel}
            </label>
          )}
          {isSectorChipsOnly ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {sectorLabel}
              </span>
              <p className="text-[11px] text-muted-foreground">Selecione o tipo de rendimento:</p>
            </div>
          ) : (
            <Input
              id="edit-asset-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Ex: Financeiro / Bancos, Logística, Pós-fixado..."
            />
          )}
          {recommendedSectors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {recommendedSectors.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSector(s)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    sector === s
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-surface-hover/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Campos de Posição de Custódia */}
      {isCash ? (
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Saldo Disponível em Caixa</span>
            <Badge variant="muted" className="text-[11px]">1:1</Badge>
          </div>
          <label htmlFor="edit-asset-cash" className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Saldo Atual (R$)
            <NumericInput
              id="edit-asset-cash"
              value={quantityStr}
              onValueChange={setQuantityStr}
              placeholder="10000,00"
              aria-label="Saldo em caixa"
              showCalculatorAction
            />
          </label>
        </div>
      ) : isTotalValueMode ? (
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {isClosed
                ? "Posição Encerrada (Histórico de Renda Fixa)"
                : isTesouro
                  ? "Posição de Custódia (Tesouro Direto)"
                  : "Posição de Custódia (Renda Fixa)"}
            </span>
            <Badge variant={isClosed ? "muted" : "default"} className="text-[11px]">
              {isClosed ? "Liquidada" : "Valor Completo"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-asset-initial-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isClosed ? "Custo Histórico Original / Total Aplicado" : "Preço Inicial / Valor Aplicado"} ({currency})
              </label>
              <MoneyInput
                id="edit-asset-initial-price"
                cents={initialPriceCents}
                currency={currency}
                onCentsChange={(cents) => {
                  setInitialPriceCents(cents);
                  if (currentPriceCents === 0 && !isClosed) {
                    setCurrentPriceCents(cents);
                  }
                }}
                aria-label="Preço inicial investido"
              />
              {isClosed && (
                <span className="text-[10px] text-muted-foreground">
                  Valor originalmente investido (utilizado para calcular o resultado final realizado).
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-asset-current-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isClosed ? "Custódia Atual (Posição Liquidada)" : "Preço Atual / Saldo Final"} ({currency})
              </label>
              <MoneyInput
                id="edit-asset-current-price"
                cents={isClosed ? 0 : currentPriceCents}
                currency={currency}
                onCentsChange={isClosed ? () => {} : setCurrentPriceCents}
                disabled={isClosed}
                aria-label="Preço atual ou saldo"
              />
              {isClosed && (
                <span className="text-[10px] text-muted-foreground">
                  Título 100% resgatado (saldo em custódia zerado).
                </span>
              )}
            </div>
          </div>

          {!isClosed && initialPriceCents > 0 && currentPriceCents > 0 ? (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40 text-muted-foreground">
              <span>Rendimento Estimado:</span>
              <span
                className={cn(
                  "font-semibold flex items-center gap-1",
                  currentPriceCents >= initialPriceCents ? "text-positive-strong" : "text-negative-strong",
                )}
              >
                {currentPriceCents >= initialPriceCents ? "+" : ""}
                <MoneyText cents={currentPriceCents - initialPriceCents} currency={currency} />
                {" "}
                ({((currentPriceCents - initialPriceCents) / initialPriceCents * 100).toFixed(2)}%)
              </span>
            </div>
          ) : null}

          <p className="text-[11px] text-muted-foreground">
            Ativo de Renda Fixa precificado por valor investido e saldo atual (sem quantidade de cotas).
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Posição Atual de Custódia</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-asset-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantidade Atual (Cotas / Unidades)
              </label>
              <NumericInput
                id="edit-asset-qty"
                value={quantityStr}
                onValueChange={setQuantityStr}
                placeholder="100"
                aria-label="Quantidade de cotas"
                showCalculatorAction
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-asset-avgprice" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço Médio por Cota ({currency})
              </label>
              <MoneyInput
                id="edit-asset-avgprice"
                cents={averagePriceCents}
                currency={currency}
                onCentsChange={setAveragePriceCents}
                aria-label="Preço médio por cota"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bloco de Parâmetros de Renda Fixa e Tesouro Direto (Fase 63/72) */}
      {isFixedIncome && !isCash && (
        <FixedIncomeFormFields
          values={{
            rateType: fixedIncomeRateType,
            rateValue: fixedIncomeRateValue,
            baseDate: fixedIncomeBaseDate,
            initialInvestmentDate: fixedIncomeInitialInvestmentDate || null,
            maturityDate: fixedIncomeMaturityDate || null,
            isTaxExempt: fixedIncomeIsTaxExempt,
            manualTaxRatePct: fixedIncomeManualTaxRatePct,
          }}
          onChange={(patch) => {
            if (patch.rateType !== undefined) setFixedIncomeRateType(patch.rateType);
            if (patch.rateValue !== undefined)
              setFixedIncomeRateValue(
                typeof patch.rateValue === "number" ? patch.rateValue : parseDecimalNumber(patch.rateValue),
              );
            if (patch.baseDate !== undefined) setFixedIncomeBaseDate(patch.baseDate);
            if (patch.initialInvestmentDate !== undefined)
              setFixedIncomeInitialInvestmentDate(patch.initialInvestmentDate ?? "");
            if (patch.maturityDate !== undefined) setFixedIncomeMaturityDate(patch.maturityDate ?? "");
            if (patch.isTaxExempt !== undefined) setFixedIncomeIsTaxExempt(patch.isTaxExempt);
            if (patch.manualTaxRatePct !== undefined) setFixedIncomeManualTaxRatePct(patch.manualTaxRatePct);
          }}
          idPrefix="edit-fi"
          isTesouro={isTesouro}
        />
      )}

      {/* Anotações */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-asset-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Anotações / Descrição
        </label>
        <Input
          id="edit-asset-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Tese, setor, corretora..."
        />
      </div>

      {/* ─── Proventos ──────────────────────────────────────────────────────── */}

      {/* RF / Tesouro: toggle "Distribui juros/cupons" controla o painel */}
      {isFixedIncome && !isCash && (
        <div className="flex flex-col gap-2">
          <Checkbox
            id="edit-fi-distributes-interest"
            checked={distributesInterest}
            onCheckedChange={(v) => {
              const checked = Boolean(v);
              setDistributesInterest(checked);
              setShowDividendPanel(checked);
              if (!checked) {
                setAccumulatedDividendsCents(0);
                setEstimatedDividendPerShareCents(0);
              }
            }}
            label="Distribui juros / cupons periodicamente (NTN-B, CRI, CRA, debentures)"
          />
          {distributesInterest && (
            <p className="pl-6 text-[11px] text-muted-foreground">
              Informe os proventos anteriores ao cadastro para alimentar o Yield on Cost e a Bola de Neve.
            </p>
          )}
        </div>
      )}

      {/* Ações / FIIs / ETFs / BDRs / Internacional: link colapsável */}
      {!isFixedIncome && !isCash && !isCrypto && !showDividendPanel && (
        <button
          type="button"
          onClick={() => setShowDividendPanel(true)}
          className="self-start text-xs text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
        >
          + Adicionar proventos anteriores ao cadastro (opcional)
        </button>
      )}

      {/* Bloco de Proventos — visível quando showDividendPanel = true */}
      {showDividendPanel && !CLASSES_WITHOUT_DIVIDENDS.has(assetClass) && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">Proventos Anteriores ao Cadastro</span>
              <span className="text-[11px] text-muted-foreground">
                Alimentam o Yield on Cost e a Bola de Neve sem distorcer o extrato mensal.
              </span>
            </div>
            {/* Para Ações/FIIs: botão para recolher o painel */}
            {!isFixedIncome && (
              <button
                type="button"
                onClick={() => setShowDividendPanel(false)}
                className="shrink-0 ml-2"
                aria-label="Recolher proventos"
              >
                <ChevronUp className="size-4 text-muted-foreground hover:text-foreground" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-accumulated-dividends"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Total Acumulado Recebido ({currency})
              </label>
              <MoneyInput
                id="edit-accumulated-dividends"
                cents={accumulatedDividendsCents}
                currency={currency}
                onCentsChange={setAccumulatedDividendsCents}
                placeholder={currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Total de proventos acumulados anteriores ao cadastro"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-estimated-div-per-share"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Estimativa Mensal / Cota ({currency})
              </label>
              <MoneyInput
                id="edit-estimated-div-per-share"
                cents={estimatedDividendPerShareCents}
                currency={currency}
                onCentsChange={setEstimatedDividendPerShareCents}
                placeholder={currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Dividendo mensal estimado por cota para calculo da Bola de Neve"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/80">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateAsset.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={updateAsset.isPending}
        >
          {updateAsset.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  );
}

export function AssetEditDialog({
  asset,
  open,
  onOpenChange,
}: AssetEditDialogProps) {
  if (!asset) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Ativo"
      description={`Atualize as informações cadastrais de ${asset.ticker}`}
      size="xl"
      showCalculator
    >
      <AssetEditFormContent
        key={asset.id}
        asset={asset}
        onClose={() => onOpenChange(false)}
      />
    </Modal>
  );
}
