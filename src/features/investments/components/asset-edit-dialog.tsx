import { useState } from "react";
import { formatDecimalNumber, numberToCents, parseDecimalNumber } from "@/domain/money";
import { Alert, Badge, Button, Input, Modal, MoneyInput, MoneyText, Select } from "@/components/ui";
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
      ? asset.notes.replace("[PRICING:UNIT]", "").replace("[PRICING:TOTAL]", "").trim()
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
  const [fixedIncomeRateValue, setFixedIncomeRateValue] = useState<string>(
    asset.fixed_income_metadata?.rate_value !== undefined ? formatDecimalNumber(asset.fixed_income_metadata.rate_value) : "",
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

  const [error, setError] = useState<string | null>(null);

  const isCash = isCashAssetClass(assetClass) || ticker.trim().toUpperCase() === "CAIXA";
  const isTesouro = isTesouroAsset(ticker, assetClass);
  const isFixedIncome = isFixedIncomeClass(assetClass) || isTesouro;
  const recommendedSectors = DEFAULT_SECTORS_BY_CLASS[assetClass] ?? [];

  // Modo Tesouro: "total_value" (padrão RF) ou "unit_price" (cotas / PM)
  const initialTesouroMode = asset.notes?.includes("[PRICING:UNIT]") ? "unit_price" : "total_value";
  const [tesouroMode, setTesouroMode] = useState<"total_value" | "unit_price">(initialTesouroMode);

  // Modo efetivo de valor total (RF e Tesouro valor completo)
  const isTotalValueMode = !isCash && isFixedIncome && (!isTesouro || tesouroMode === "total_value");

  // Preço inicial e atual para modo total_value (RF / Tesouro valor completo)
  const priceQuote = (pricesQuery.data ?? []).find(
    (p) => p.ticker.toUpperCase() === (asset.ticker ?? ticker).trim().toUpperCase(),
  );
  const existingInitialPrice = asset
    ? asset.average_price > 0
      ? asset.average_price
      : asset.quantity > 0
        ? asset.quantity
        : 0
    : 0;
  const existingCurrentPrice =
    asset.fixed_income_metadata?.base_value !== undefined &&
    asset.fixed_income_metadata?.base_value !== null &&
    asset.fixed_income_metadata.base_value > 0
      ? asset.fixed_income_metadata.base_value
      : priceQuote?.manual_price ?? priceQuote?.price ?? existingInitialPrice;

  const [initialPriceCents, setInitialPriceCents] = useState(numberToCents(existingInitialPrice));
  const [currentPriceCents, setCurrentPriceCents] = useState(numberToCents(existingCurrentPrice));

  // Modo Cotas / Preço Médio (Ações, FIIs, etc. ou Tesouro cotas) e Caixa
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

  const handleClassChange = (newClass: string) => {
    setAssetClass(newClass);
    const suggested = inferSectorFromTicker(ticker, newClass);
    setSector(suggested);
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
    let finalNotes = notes.trim() || null;

    if (isCash) {
      payloadQuantity = parsedQuantity;
      payloadAvgPrice = 1;
    } else if (isTotalValueMode) {
      payloadQuantity = 1;
      payloadAvgPrice = initialPriceCents / 100;
      if (isTesouro) {
        finalNotes = finalNotes ? `${finalNotes} [PRICING:TOTAL]` : "[PRICING:TOTAL]";
      }
    } else {
      payloadQuantity = Math.max(0, parsedQuantity);
      payloadAvgPrice = Math.max(0, parsedAvgPrice);
      if (isTesouro && tesouroMode === "unit_price") {
        finalNotes = finalNotes ? `${finalNotes} [PRICING:UNIT]` : "[PRICING:UNIT]";
      }
    }

    let fiMetadata: FixedIncomeMetadata | null = null;
    if (isFixedIncome && !isCash) {
      const rateVal = parseDecimalNumber(fixedIncomeRateValue);
      fiMetadata = {
        rate_type: fixedIncomeRateType,
        rate_value: rateVal,
        base_date: fixedIncomeBaseDate || todayISO(),
        base_value: isTotalValueMode && currentPriceCents > 0 ? currentPriceCents / 100 : null,
        initial_investment_date: fixedIncomeInitialInvestmentDate ? fixedIncomeInitialInvestmentDate.slice(0, 10) : null,
        maturity_date: fixedIncomeMaturityDate ? fixedIncomeMaturityDate.slice(0, 10) : null,
        is_tax_exempt: fixedIncomeIsTaxExempt,
      };
    }

    const validation = assetMetadataSchema.safeParse({
      ticker,
      asset_class: assetClass,
      sector: sector.trim() || null,
      currency,
      quantity: payloadQuantity,
      average_price: payloadAvgPrice,
      accumulated_dividends: accumulatedDividendsCents / 100,
      estimated_monthly_dividend_per_share: estimatedDividendPerShareCents / 100,
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-asset-sector" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Setor / Segmento / Indexador
        </label>
        <Input
          id="edit-asset-sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="Ex: Financeiro / Bancos, Logística, Pós-fixado..."
        />
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

      {/* Seletor de Modo de Precificação para Tesouro Direto */}
      {isTesouro ? (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Modo de Precificação do Tesouro</span>
            <span className="text-[11px] text-muted-foreground">Padrão: Valor Completo</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTesouroMode("total_value")}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left flex flex-col gap-0.5 cursor-pointer",
                tesouroMode === "total_value"
                  ? "border-primary bg-surface shadow-xs text-foreground font-semibold"
                  : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-xs font-semibold">Valor Completo (Padrão RF)</span>
              <span className="text-[10px] text-muted-foreground">Preço inicial e saldo atual (sem cotas)</span>
            </button>
            <button
              type="button"
              onClick={() => setTesouroMode("unit_price")}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left flex flex-col gap-0.5 cursor-pointer",
                tesouroMode === "unit_price"
                  ? "border-primary bg-surface shadow-xs text-foreground font-semibold"
                  : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-xs font-semibold">Preço Médio / Cotas</span>
              <span className="text-[10px] text-muted-foreground">Frações de títulos e preço unitário</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Campos de Posição de Custódia */}
      {isCash ? (
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Saldo Disponível em Caixa</span>
            <Badge variant="muted" className="text-[11px]">1:1</Badge>
          </div>
          <label htmlFor="edit-asset-cash" className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Saldo Atual (R$)
            <Input
              id="edit-asset-cash"
              value={quantityStr}
              onChange={(e) => setQuantityStr(e.target.value)}
              placeholder="10000,00"
              inputMode="decimal"
              aria-label="Saldo em caixa"
            />
          </label>
        </div>
      ) : isTotalValueMode ? (
        <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {isTesouro ? "Posição de Custódia (Tesouro Direto)" : "Posição de Custódia (Renda Fixa)"}
            </span>
            <Badge variant="muted" className="text-[11px]">Valor Completo</Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-asset-initial-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço Inicial / Valor Aplicado ({currency})
              </label>
              <MoneyInput
                id="edit-asset-initial-price"
                cents={initialPriceCents}
                onCentsChange={(cents) => {
                  setInitialPriceCents(cents);
                  if (currentPriceCents === 0) {
                    setCurrentPriceCents(cents);
                  }
                }}
                placeholder={currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Preço inicial investido"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-asset-current-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço Atual / Saldo Final ({currency})
              </label>
              <MoneyInput
                id="edit-asset-current-price"
                cents={currentPriceCents}
                onCentsChange={setCurrentPriceCents}
                placeholder={currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Preço atual ou saldo"
              />
            </div>
          </div>

          {initialPriceCents > 0 && currentPriceCents > 0 ? (
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
              <Input
                id="edit-asset-qty"
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                placeholder="100"
                inputMode="decimal"
                aria-label="Quantidade de cotas"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-asset-avgprice" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço Médio por Cota ({currency})
              </label>
              <MoneyInput
                id="edit-asset-avgprice"
                cents={averagePriceCents}
                onCentsChange={setAveragePriceCents}
                placeholder={currency === "USD" ? "$ 0.00" : "R$ 0,00"}
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
          }}
          onChange={(patch) => {
            if (patch.rateType !== undefined) setFixedIncomeRateType(patch.rateType);
            if (patch.rateValue !== undefined) setFixedIncomeRateValue(patch.rateValue);
            if (patch.baseDate !== undefined) setFixedIncomeBaseDate(patch.baseDate);
            if (patch.initialInvestmentDate !== undefined)
              setFixedIncomeInitialInvestmentDate(patch.initialInvestmentDate ?? "");
            if (patch.maturityDate !== undefined) setFixedIncomeMaturityDate(patch.maturityDate ?? "");
            if (patch.isTaxExempt !== undefined) setFixedIncomeIsTaxExempt(patch.isTaxExempt);
          }}
          idPrefix="edit-fi"
          isTesouro={isTesouro}
        />
      )}

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

      {/* Proventos Acumulados — oculto para ativos de caixa */}
      {!isCash && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface/50 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Proventos Anteriores ao Cadastro (Opcional)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Alimentam o Yield on Cost e a Bola de Neve sem distorcer o extrato mensal nem o calendario.
            </span>
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
                onCentsChange={setAccumulatedDividendsCents}
                placeholder="R$ 0,00"
                aria-label="Total de proventos acumulados anteriores ao cadastro"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-estimated-div-per-share"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Dividendo Estimado / Cota / Mes ({currency})
              </label>
              <MoneyInput
                id="edit-estimated-div-per-share"
                cents={estimatedDividendPerShareCents}
                onCentsChange={setEstimatedDividendPerShareCents}
                placeholder="R$ 0,00"
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
      size="lg"
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
