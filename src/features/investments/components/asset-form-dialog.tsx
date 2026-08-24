import { useState } from "react";
import { ArrowDownLeft, Calculator, ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Alert, Badge, Button, Checkbox, ConfirmDialog, DatePicker, Input, Modal, MoneyInput, Select } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import {
  calculateWeightedAveragePrice,
  DEFAULT_SECTORS_BY_CLASS,
  inferSectorFromTicker,
  isCashAssetClass,
  isFixedIncomeClass,
  isTesouroAsset,
  sellAssetPosition,
} from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useAssetPrices,
  useCreatePortfolioAsset,
  useCreatePortfolioContribution,
  useDeletePortfolioAsset,
  usePortfolioAssets,
  useSetManualPrice,
  useUpdatePortfolioAsset,
} from "@/state";
import { todayISO } from "@/domain/debts";
import type { AssetCurrency, PortfolioAsset } from "@/types";
import { cn } from "@/lib/utils";

export interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ativo em edição — quando informado, o diálogo salva (update) em vez de criar. */
  asset?: PortfolioAsset | null;
  /** Classe inicial ao cadastrar um novo ativo (ex.: "Caixa"). */
  initialAssetClass?: string;
}

interface AssetFormContentProps {
  asset?: PortfolioAsset | null;
  initialAssetClass?: string;
  onClose: () => void;
}

const CURRENCY_OPTIONS: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (B3, renda fixa, cripto)" },
  { value: "USD", label: "USD (internacional)" },
];

const ASSET_CLASS_PRESETS = [
  "Ações",
  "FIIs",
  "ETFs",
  "BDRs",
  "Renda Fixa",
  "Cripto",
  "Caixa",
  "Internacional",
];

function AssetFormContent({ asset = null, initialAssetClass, onClose }: AssetFormContentProps) {
  const createAsset = useCreatePortfolioAsset();
  const updateAsset = useUpdatePortfolioAsset();
  const deleteAsset = useDeletePortfolioAsset();
  const createContribution = useCreatePortfolioContribution();
  const setManualPrice = useSetManualPrice();
  const allAssetsQuery = usePortfolioAssets();
  const pricesQuery = useAssetPrices();

  const isEdit = asset !== null;
  const hasExistingQuantity = isEdit && (asset?.quantity ?? 0) > 0;

  const [activeTab, setActiveTab] = useState<"edit" | "sell">("edit");

  const [ticker, setTicker] = useState(asset?.ticker ?? "");
  const [assetClass, setAssetClass] = useState(asset?.asset_class ?? initialAssetClass ?? "");
  const [sector, setSector] = useState(asset?.sector ?? inferSectorFromTicker(asset?.ticker ?? "", asset?.asset_class ?? initialAssetClass));
  const [currency, setCurrency] = useState<AssetCurrency>(asset?.currency ?? "BRL");

  const recommendedSectors = DEFAULT_SECTORS_BY_CLASS[assetClass] ?? [];

  const handleTickerChange = (val: string) => {
    setTicker(val);
    if (!asset?.sector) {
      const suggested = inferSectorFromTicker(val, assetClass);
      setSector(suggested);
    }
  };

  const handleClassChange = (newClass: string) => {
    setAssetClass(newClass);
    if (!asset?.sector) {
      const suggested = inferSectorFromTicker(ticker, newClass);
      setSector(suggested);
    }
  };

  const isCash = isCashAssetClass(assetClass) || ticker.trim().toUpperCase() === "CAIXA";
  const isTesouro = isTesouroAsset(ticker, assetClass);
  const isFixedIncome = isFixedIncomeClass(assetClass) || isTesouro;

  // Modo Tesouro: "total_value" (padrão RF) ou "unit_price" (cotas / PM)
  const initialTesouroMode = asset?.notes?.includes("[PRICING:UNIT]") ? "unit_price" : "total_value";
  const [tesouroMode, setTesouroMode] = useState<"total_value" | "unit_price">(initialTesouroMode);

  // Modo efetivo: se Renda Fixa (não-tesouro) ou (tesouro e modo total_value) -> total_value
  const isTotalValueMode = !isCash && isFixedIncome && (!isTesouro || tesouroMode === "total_value");

  // Preço inicial e atual para modo total_value (RF / Tesouro valor completo)
  const priceQuote = (pricesQuery.data ?? []).find(
    (p) => p.ticker.toUpperCase() === (asset?.ticker ?? ticker).trim().toUpperCase(),
  );
  const existingInitialPrice = asset
    ? asset.average_price > 1
      ? asset.average_price
      : asset.quantity > 0
        ? asset.quantity
        : asset.average_price
    : 0;
  const existingCurrentPrice = priceQuote?.manual_price ?? priceQuote?.price ?? existingInitialPrice;

  const [initialPriceCents, setInitialPriceCents] = useState(numberToCents(existingInitialPrice));
  const [currentPriceCents, setCurrentPriceCents] = useState(numberToCents(existingCurrentPrice));

  // Modo Cotas / Preço Médio (Ações, FIIs, etc. ou Tesouro cotas) e Caixa
  const [quantityStr, setQuantityStr] = useState(
    asset?.quantity !== undefined && asset.quantity > 0 ? String(asset.quantity) : "",
  );
  const [averagePriceCents, setAveragePriceCents] = useState(
    asset?.average_price !== undefined ? numberToCents(asset.average_price) : 0,
  );
  const [notes, setNotes] = useState(
    asset?.notes
      ? asset.notes.replace("[PRICING:UNIT]", "").replace("[PRICING:TOTAL]", "").trim()
      : "",
  );

  // Helper de novo lote de compras
  const [showLotCalculator, setShowLotCalculator] = useState(false);
  const [newLotQtyStr, setNewLotQtyStr] = useState("");
  const [newLotPriceCents, setNewLotPriceCents] = useState(0);
  const [recordLotAsContribution, setRecordLotAsContribution] = useState(false);
  const [pendingLotContribution, setPendingLotContribution] = useState<{ amount: number; date: string } | null>(null);

  // Estado da aba de Venda / Desinvestimento
  const [sellQtyStr, setSellQtyStr] = useState("");
  const [sellPriceCents, setSellPriceCents] = useState(asset?.average_price !== undefined ? numberToCents(asset.average_price) : 0);
  const [sellDate, setSellDate] = useState(() => todayISO());
  const [creditToCash, setCreditToCash] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending =
    createAsset.isPending ||
    updateAsset.isPending ||
    deleteAsset.isPending ||
    createContribution.isPending ||
    setManualPrice.isPending;

  const parseNumber = (raw: string): number => {
    const clean = raw.replace(/\s+/g, "").replace(",", ".");
    const val = Number(clean);
    return Number.isFinite(val) ? val : 0;
  };

  const parsedQuantity = isCash ? parseNumber(quantityStr) : parseNumber(quantityStr);
  const parsedAvgPrice = averagePriceCents / 100;

  // Cálculo da prévia do helper de lote
  const parsedNewLotQty = parseNumber(newLotQtyStr);
  const parsedNewLotPrice = newLotPriceCents / 100;
  const lotPreview = calculateWeightedAveragePrice(
    parsedQuantity,
    parsedAvgPrice,
    parsedNewLotQty,
    parsedNewLotPrice,
  );

  const handleApplyLot = () => {
    if (parsedNewLotQty <= 0 || parsedNewLotPrice <= 0) return;
    setQuantityStr(String(lotPreview.newQuantity));
    setAveragePriceCents(Math.round(lotPreview.newAveragePrice * 100));
    if (recordLotAsContribution) {
      setPendingLotContribution({
        amount: Math.round(parsedNewLotQty * parsedNewLotPrice * 100) / 100,
        date: todayISO(),
      });
    }
    setNewLotQtyStr("");
    setNewLotPriceCents(0);
    setShowLotCalculator(false);
    triggerSensory("selection");
  };

  // Cálculo de venda em tempo real
  const parsedSellQty = parseNumber(sellQtyStr);
  const parsedSellPrice = sellPriceCents / 100;
  const sellResult = sellAssetPosition({
    currentQuantity: asset?.quantity ?? 0,
    currentAveragePrice: asset?.average_price ?? 0,
    sellQuantity: parsedSellQty,
    sellPrice: parsedSellPrice,
    assetClass: asset?.asset_class,
  });

  const existingCashAsset = (allAssetsQuery.data ?? []).find(
    (a) => (isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA") && a.id !== asset?.id,
  );

  const normalizedTicker = ticker.trim() === "" && isCash ? "CAIXA" : ticker.trim().toUpperCase();
  const canSubmit = normalizedTicker.length > 0 && !pending;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);

    // Validação estrita de unicidade do Caixa: só é permitido 1 ativo de caixa na carteira
    if (!isEdit && (isCash || normalizedTicker === "CAIXA") && existingCashAsset) {
      setError("Já existe um ativo de Caixa cadastrado na carteira. Utilize o card de Saldo em Caixa no início da página para gerenciar o valor.");
      triggerSensory("error");
      return;
    }

    try {
      const effectiveClass = assetClass.trim() === "" ? (isCash ? "Caixa" : null) : assetClass.trim();
      let payloadQuantity = 0;
      let payloadAvgPrice = 0;
      let finalNotes = notes.trim() === "" ? null : notes.trim();

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

      const payload = {
        ticker: normalizedTicker,
        asset_class: effectiveClass,
        sector: sector.trim() === "" ? null : sector.trim(),
        currency,
        quantity: payloadQuantity,
        average_price: payloadAvgPrice,
        notes: finalNotes,
      };

      let savedAssetId = asset?.id;
      if (isEdit && asset) {
        await updateAsset.mutateAsync({ id: asset.id, patch: payload });
      } else {
        const created = await createAsset.mutateAsync(payload);
        savedAssetId = created.id;
      }

      // Se estiver em modo total_value, grava também o preço atual / saldo no cache/manual
      if (isTotalValueMode) {
        const priceToSave = currentPriceCents > 0 ? currentPriceCents / 100 : initialPriceCents / 100;
        if (priceToSave > 0) {
          await setManualPrice.mutateAsync({
            ticker: normalizedTicker,
            price: priceToSave,
          });
        }
      }

      if (pendingLotContribution && pendingLotContribution.amount > 0) {
        await createContribution.mutateAsync({
          asset_id: savedAssetId ?? null,
          date: pendingLotContribution.date,
          amount: pendingLotContribution.amount,
          notes: `Aporte · Compra de ${normalizedTicker}`,
        });
      }
      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleConfirmSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset || parsedSellQty <= 0 || parsedSellPrice <= 0) {
      setError("Informe a quantidade e o preço de venda.");
      return;
    }
    setError(null);
    try {
      // 1. Atualiza a posição do ativo com a quantidade remanescente e PM inalterado
      await updateAsset.mutateAsync({
        id: asset.id,
        patch: {
          quantity: sellResult.remainingQuantity,
          average_price: sellResult.remainingAveragePrice,
        },
      });

      // 2. Se optou por creditar em Caixa, localiza o ativo Caixa ou atualiza o saldo
      if (creditToCash && sellResult.grossAmount > 0) {
        const cashAsset = (allAssetsQuery.data ?? []).find((a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA");
        if (cashAsset) {
          const currentCashBalance = Number(cashAsset.quantity ?? 0);
          await updateAsset.mutateAsync({
            id: cashAsset.id,
            patch: {
              quantity: Math.round((currentCashBalance + sellResult.grossAmount) * 100) / 100,
              average_price: 1,
            },
          });
        }
      }

      triggerSensory("destructive");
      pushToast({
        title: "Venda registrada",
        description: `Venda de ${parsedSellQty} ${asset.ticker} por R$ ${sellResult.grossAmount.toFixed(2)} (Lucro: R$ ${sellResult.realizedPnl.toFixed(2)}).`,
      });

      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmDeleteAsset = async () => {
    if (!asset) return;
    setError(null);
    try {
      await deleteAsset.mutateAsync(asset.id);
      triggerSensory("destructive");
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      setConfirmDelete(false);
      setError(getErrorMessage(err));
    }
  };

  return (
    <>
      {hasExistingQuantity && (
        <div className="mt-3 flex items-center gap-1 rounded-xl border border-border/80 bg-surface-hover/30 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("edit");
              triggerSensory("selection");
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              activeTab === "edit"
                ? "bg-surface shadow-xs text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Editar Dados & Compras
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("sell");
              triggerSensory("selection");
            }}
            className={`flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              activeTab === "sell"
                ? "bg-surface shadow-xs text-negative-strong font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownLeft className="size-3.5" aria-hidden="true" />
            <span>Venda / Desinvestimento</span>
          </button>
        </div>
      )}

      {activeTab === "sell" ? (
        <form onSubmit={handleConfirmSell} className="mt-4 flex flex-col gap-4">
          <div className="rounded-xl border border-negative/20 bg-negative/5 p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Custódia Disponível para Venda / Resgate
              </span>
              <Badge variant="muted" className="text-xs">
                {asset?.quantity} {isTotalValueMode ? "posição" : "cotas"} @ {asset?.currency} {asset?.average_price?.toFixed(2)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {isTotalValueMode ? "Valor a Resgatar" : "Quantidade a Vender"}
                <Input
                  value={sellQtyStr}
                  onChange={(e) => setSellQtyStr(e.target.value)}
                  placeholder={isTotalValueMode ? "Ex: 1000,00" : "Ex: 50"}
                  inputMode="decimal"
                  aria-label={isTotalValueMode ? "Valor a resgatar" : "Quantidade a vender"}
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Preço Unitário de Venda ({asset?.currency})
                <MoneyInput
                  cents={sellPriceCents}
                  onCentsChange={setSellPriceCents}
                  aria-label="Preço de venda"
                />
              </label>
            </div>

            {/* Atalhos rápidos de quantidade */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Vender:</span>
              {[
                { label: "25%", pct: 0.25 },
                { label: "50%", pct: 0.5 },
                { label: "75%", pct: 0.75 },
                { label: "100% (Tudo)", pct: 1 },
              ].map((shortcut) => (
                <button
                  key={shortcut.label}
                  type="button"
                  onClick={() => {
                    const totalQty = asset?.quantity ?? 0;
                    const calculated = Math.round(totalQty * shortcut.pct * 10000) / 10000;
                    setSellQtyStr(String(calculated));
                  }}
                  className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors"
                >
                  {shortcut.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Data da Operação
                <DatePicker
                  value={sellDate}
                  onValueChange={(date: string) => setSellDate(date || todayISO())}
                  ariaLabel="Data da venda"
                />
              </label>

              <div className="flex flex-col justify-end pb-1">
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={creditToCash}
                    onCheckedChange={(checked) => setCreditToCash(Boolean(checked))}
                  />
                  <span>Creditar valor líquido no Caixa</span>
                </label>
              </div>
            </div>
          </div>

          {/* Prévia financeira e fiscal da venda */}
          {parsedSellQty > 0 && parsedSellPrice > 0 ? (
            <div className="rounded-xl border border-border/80 bg-surface/90 p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Valor bruto a receber:</span>
                <span className="font-bold text-foreground">
                  {asset?.currency} {sellResult.grossAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Lucro / Prejuízo Realizado:</span>
                <span
                  className={`font-semibold ${
                    sellResult.realizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong"
                  }`}
                >
                  {sellResult.realizedPnl >= 0 ? "+" : ""}{asset?.currency} {sellResult.realizedPnl.toFixed(2)} ({sellResult.realizedPnlPct >= 0 ? "+" : ""}{sellResult.realizedPnlPct.toFixed(2)}%)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                <span className="text-muted-foreground">Posição após a venda:</span>
                <span className="font-medium text-foreground">
                  {sellResult.remainingQuantity} {isTotalValueMode ? "posição" : "cotas"} (PM de {asset?.currency} {sellResult.remainingAveragePrice.toFixed(2)} inalterado)
                </span>
              </div>

              {/* Status Fiscal */}
              {sellResult.taxInfo.isStock ? (
                sellResult.taxInfo.isTaxExempt ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-positive-strong bg-positive/10 rounded-lg p-2">
                    <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Isenção de IR aplicável (vendas no mês abaixo de R$ 20.000,00).</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-attention-strong bg-attention/10 rounded-lg p-2">
                    <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Vendas no mês ultrapassam R$ 20.000. DARF estimado de 15%: R$ {sellResult.taxInfo.estimatedTaxPayable.toFixed(2)}.</span>
                  </div>
                )
              ) : sellResult.taxInfo.isFii ? (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-surface-hover/50 rounded-lg p-2">
                  <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>FIIs: Alíquota fixa de 20% sobre o ganho líquido. DARF estimado: R$ {sellResult.taxInfo.estimatedTaxPayable.toFixed(2)}.</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={parsedSellQty <= 0 || parsedSellPrice <= 0 || pending}
            >
              {pending ? "Processando…" : "Confirmar Venda / Resgate"}
            </Button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              void submit();
            }
          }}
          className="mt-4 flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              {isCash ? "Nome / Identificador do Caixa (opcional)" : "Ticker / Código do Ativo"}
              <Input
                value={ticker}
                onChange={(event) => handleTickerChange(event.target.value)}
                placeholder={isCash ? "CAIXA (padrão)" : "PETR4, MXRF11, CDB Banco Inter, Tesouro Selic…"}
                maxLength={40}
                aria-label={isCash ? "Nome do Caixa" : "Ticker do ativo"}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Classe
              <Input
                value={assetClass}
                onChange={(event) => setAssetClass(event.target.value)}
                placeholder="Ações, FIIs, Renda Fixa, Caixa…"
                maxLength={40}
                aria-label="Classe do ativo"
              />
            </label>
          </div>

          {/* Chips de classes comuns */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Sugestões:</span>
            {ASSET_CLASS_PRESETS.filter((preset) => !isCashAssetClass(preset) || !existingCashAsset).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleClassChange(preset)}
                className="rounded-md border border-border/70 bg-surface-hover/50 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>

          {!isCash && (
            <div className="flex flex-col gap-1.5">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Setor / Segmento / Indexador
                <Input
                  value={sector}
                  onChange={(event) => setSector(event.target.value)}
                  placeholder="Ex: Financeiro / Bancos, Imobiliário / Logística, Pós-fixado..."
                  maxLength={60}
                  aria-label="Setor do ativo"
                />
              </label>
              {recommendedSectors.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Setores recomendados:</span>
                  {recommendedSectors.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSector(s)}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                        sector === s
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "border border-border/70 bg-surface-hover/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Moeda de Negociação
              <Select
                value={currency}
                onValueChange={(value) => setCurrency(value as AssetCurrency)}
                options={CURRENCY_OPTIONS}
                ariaLabel="Moeda do ativo"
              />
            </label>
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
                  onClick={() => {
                    setTesouroMode("total_value");
                    triggerSensory("selection");
                  }}
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
                  onClick={() => {
                    setTesouroMode("unit_price");
                    triggerSensory("selection");
                  }}
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

          {/* Campos de Posição Consolidada */}
          {isCash ? (
            <div className="rounded-xl border border-border/80 bg-surface-hover/20 p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Saldo Disponível em Caixa</span>
                <Badge variant="muted" className="text-[11px]">1:1</Badge>
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Saldo Atual (R$)
                <Input
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
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Preço Inicial / Valor Aplicado ({currency})
                  <MoneyInput
                    cents={initialPriceCents}
                    onCentsChange={(cents) => {
                      setInitialPriceCents(cents);
                      if (currentPriceCents === 0 || currentPriceCents === initialPriceCents) {
                        setCurrentPriceCents(cents);
                      }
                    }}
                    aria-label="Preço inicial investido"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Preço Atual / Saldo Final ({currency})
                  <MoneyInput
                    cents={currentPriceCents}
                    onCentsChange={setCurrentPriceCents}
                    aria-label="Preço atual ou saldo"
                  />
                </label>
              </div>

              {initialPriceCents > 0 && currentPriceCents > 0 ? (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40 text-muted-foreground">
                  <span>Rendimento Estimado:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      currentPriceCents >= initialPriceCents ? "text-positive-strong" : "text-negative-strong",
                    )}
                  >
                    {currentPriceCents >= initialPriceCents ? "+" : ""}
                    {((currentPriceCents - initialPriceCents) / 100).toLocaleString("pt-BR", {
                      style: "currency",
                      currency,
                    })}
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
                {isEdit && (
                  <button
                    type="button"
                    onClick={() => setShowLotCalculator(!showLotCalculator)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                  >
                    <Calculator className="size-3.5" aria-hidden="true" />
                    <span>{showLotCalculator ? "Ocultar calculadora de lote" : "Adicionar novo lote de compra"}</span>
                    {showLotCalculator ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Quantidade Atual (Cotas / Unidades)
                  <Input
                    value={quantityStr}
                    onChange={(e) => setQuantityStr(e.target.value)}
                    placeholder="100"
                    inputMode="decimal"
                    aria-label="Quantidade de cotas"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Preço Médio por Cota ({currency})
                  <MoneyInput
                    cents={averagePriceCents}
                    onCentsChange={setAveragePriceCents}
                    aria-label="Preço médio por cota"
                  />
                </label>
              </div>

              {/* Helper / Calculadora de Novo Lote de Compras */}
              {showLotCalculator && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex flex-col gap-2.5 mt-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    <span>Calculadora de Novo Preço Médio Ponderado</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                      Novas Cotas Adquiridas
                      <Input
                        value={newLotQtyStr}
                        onChange={(e) => setNewLotQtyStr(e.target.value)}
                        placeholder="Ex: 50"
                        inputMode="decimal"
                        className="h-8 text-xs"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                      Preço Unitário Pago ({currency})
                      <MoneyInput
                        cents={newLotPriceCents}
                        onCentsChange={setNewLotPriceCents}
                        className="h-8 text-xs"
                      />
                    </label>
                  </div>

                  {parsedNewLotQty > 0 && parsedNewLotPrice > 0 ? (
                    <div className="flex flex-col gap-2 rounded-md bg-background/80 p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Resultado após lote:</span>
                          <span className="font-semibold text-foreground">
                            {lotPreview.newQuantity} cotas com Preço Médio de {currency} {lotPreview.newAveragePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </span>
                        </div>
                        <Button type="button" size="sm" onClick={handleApplyLot} className="h-7 text-xs">
                          Aplicar
                        </Button>
                      </div>
                      <label className="flex items-center gap-2 text-[11px] font-medium text-foreground cursor-pointer select-none pt-1 border-t border-border/40">
                        <Checkbox
                          checked={recordLotAsContribution}
                          onCheckedChange={(checked) => setRecordLotAsContribution(Boolean(checked))}
                        />
                        <span>Registrar compra como aporte financeiro do mês (R$ {(parsedNewLotQty * parsedNewLotPrice).toFixed(2)})</span>
                      </label>
                    </div>
                  ) : null}
                </div>
              )}

              {!isEdit && (
                <p className="text-[11px] text-muted-foreground">
                  Cadastrado como <span className="font-medium text-foreground">Posição Inicial pré-existente</span> (não altera o valor de aportes do mês corrente na Home).
                </p>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Notas / Observações (opcional)
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Corretora, estratégia, tese…"
              maxLength={100}
              aria-label="Notas do ativo"
            />
          </label>

          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={pending} className="text-negative-strong hover:text-negative-strong">
                Excluir ativo
              </Button>
            ) : (
              <span />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Adicionar à carteira"}
              </Button>
            </div>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Excluir ${asset?.ticker ?? "ativo"}?`}
        description="O ativo e suas metas de alocação serão removidos da carteira."
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={deleteAsset.isPending}
        onConfirm={() => void confirmDeleteAsset()}
      />
    </>
  );
}

/**
 * Cadastro e edição de ativo da carteira em 1 único passo (Posição Consolidada §F36).
 */
export function AssetFormDialog({ open, onOpenChange, asset = null, initialAssetClass }: AssetFormDialogProps) {
  const isEdit = asset !== null;
  const isCash = isEdit ? isCashAssetClass(asset?.asset_class ?? null) : isCashAssetClass(initialAssetClass ?? null);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEdit
          ? isCash
            ? `Editar ${asset?.ticker ?? "Caixa"}`
            : `Editar ${asset?.ticker}`
          : isCash
            ? "Cadastrar saldo em Caixa"
            : "Adicionar ativo à carteira"
      }
      description={
        isEdit
          ? isCash
            ? "Atualize o saldo disponível em caixa da sua carteira."
            : "Atualize o ticker, classe, quantidade de cotas ou preço médio da sua custódia."
          : isCash
            ? "Informe o valor disponível em caixa para oportunidades e novos aportes."
            : "Cadastre o ticker, classe e sua posição atual de custódia (quantidade e preço médio)."
      }
      showCalculator
    >
      {open ? (
        <AssetFormContent
          key={asset?.id ?? `new-asset-${initialAssetClass ?? "generic"}`}
          asset={asset}
          initialAssetClass={initialAssetClass}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
