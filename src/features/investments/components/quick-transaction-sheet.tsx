import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, GitFork, Info, Receipt } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Modal,
  MoneyInput,
  Select,
} from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import { calculateWeightedAveragePrice } from "@/domain/portfolio/summary";
import { sellAssetPosition } from "@/domain/portfolio/operations";
import {
  getAssetPricingMode,
  isCashAssetClass,
  isFixedIncomeClass,
  isTesouroAsset,
} from "@/domain/portfolio/valuation";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { usePortfolioAssets, useRecordOrder } from "@/state";
import type { PortfolioAsset, PortfolioTransactionType } from "@/types";

export interface QuickTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: PortfolioAsset | null;
  initialType?: PortfolioTransactionType;
  onClose?: () => void;
  onSuccess?: () => void;
}

const parseNumber = (raw: string): number => {
  if (!raw || typeof raw !== "string") return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (trimmed.includes(",") && trimmed.includes(".")) {
    const clean = trimmed.replace(/\./g, "").replace(",", ".");
    const val = Number(clean);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }
  const clean = trimmed.replace(",", ".");
  const val = Number(clean);
  return Number.isFinite(val) && val >= 0 ? val : 0;
};

export function QuickTransactionSheet({
  open,
  onOpenChange,
  asset = null,
  initialType = "buy",
  onClose,
  onSuccess,
}: QuickTransactionSheetProps) {
  const assetsQuery = usePortfolioAssets();
  const recordOrder = useRecordOrder();

  const allAssets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const cashAsset = useMemo(
    () => allAssets.find((a) => isCashAssetClass(a.asset_class)) ?? null,
    [allAssets],
  );

  const [selectedAssetId, setSelectedAssetId] = useState<string>(() => asset?.id ?? (allAssets[0]?.id ?? ""));
  const [type, setType] = useState<PortfolioTransactionType>(initialType);
  const [date, setDate] = useState(() => todayISO());
  const [quantityStr, setQuantityStr] = useState("");
  const [priceCents, setPriceCents] = useState(0);
  const [totalCents, setTotalCents] = useState(0);
  const [syncCash, setSyncCash] = useState(true);
  const [recordContribution, setRecordContribution] = useState(false);
  const [splitFactor, setSplitFactor] = useState(2);
  const [error, setError] = useState<string | null>(null);

  // Ativo Alvo
  const targetAsset = useMemo(() => {
    if (asset) return asset;
    return allAssets.find((a) => a.id === selectedAssetId) ?? null;
  }, [asset, selectedAssetId, allAssets]);

  const isCash = isCashAssetClass(targetAsset?.asset_class ?? null);
  const isTesouro = targetAsset ? isTesouroAsset(targetAsset.ticker, targetAsset.asset_class) : false;
  const isFixedIncome = targetAsset ? (isFixedIncomeClass(targetAsset.asset_class) || isTesouro) : false;
  const pricingMode = targetAsset ? getAssetPricingMode(targetAsset) : "unit_price";
  const isTotalValue =
    !isCash &&
    !!targetAsset &&
    (pricingMode === "total_value" || (isFixedIncome && !isTesouro));

  const parsedQty = parseNumber(quantityStr);

  // Prévia de Recálculo de PM na Compra
  const buyPreview = useMemo(() => {
    if (!targetAsset || isCash || isTotalValue || parsedQty <= 0 || priceCents <= 0) return null;
    const unitPrice = priceCents / 100;
    return calculateWeightedAveragePrice(
      targetAsset.quantity,
      targetAsset.average_price,
      parsedQty,
      unitPrice,
    );
  }, [targetAsset, isCash, isTotalValue, parsedQty, priceCents]);

  // Prévia de Venda
  const sellPreview = useMemo(() => {
    if (!targetAsset || isCash || isTotalValue || parsedQty <= 0 || priceCents <= 0) return null;
    const unitPrice = priceCents / 100;
    return sellAssetPosition({
      currentQuantity: targetAsset.quantity,
      currentAveragePrice: targetAsset.average_price,
      sellQuantity: parsedQty,
      sellPrice: unitPrice,
      assetClass: targetAsset.asset_class,
    });
  }, [targetAsset, isCash, isTotalValue, parsedQty, priceCents]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setError(null);
      onClose?.();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAsset) return;
    setError(null);

    const price = priceCents / 100;
    const total = isCash
      ? totalCents / 100
      : isTotalValue
        ? (totalCents || priceCents) / 100
        : type === "dividend" || type === "jcp" || type === "fii_yield"
          ? totalCents / 100
          : Math.round(parsedQty * price * 100) / 100;

    if (isTotalValue) {
      if (type === "buy" && total <= 0) {
        setError("Informe o valor do aporte.");
        return;
      }
      if (type === "sell") {
        if (total <= 0) {
          setError("Informe o valor do resgate.");
          return;
        }
        if (total > targetAsset.average_price) {
          setError(`Valor excede o saldo aplicado atual (R$ ${targetAsset.average_price.toFixed(2)}).`);
          return;
        }
      }
    } else if (type === "buy" || type === "sell") {
      if (!isCash && parsedQty <= 0) {
        setError("Informe uma quantidade válida de cotas.");
        return;
      }
      if (!isCash && price <= 0) {
        setError("Informe o preço unitário da ordem.");
        return;
      }
      if (isCash && total <= 0) {
        setError("Informe o valor da movimentação em caixa.");
        return;
      }
      if (type === "sell" && !isCash && parsedQty > targetAsset.quantity) {
        setError(`Quantidade excede a custódia atual (${targetAsset.quantity} cotas).`);
        return;
      }
    }

    if ((type === "dividend" || type === "jcp" || type === "fii_yield") && total <= 0) {
      setError("Informe o valor total do provento recebido.");
      return;
    }

    if ((type === "split" || type === "reverse_split") && splitFactor <= 1) {
      setError("O fator deve ser maior que 1.");
      return;
    }

    try {
      await recordOrder.mutateAsync({
        asset: targetAsset,
        type,
        date,
        quantity: isTotalValue ? 1 : type === "split" || type === "reverse_split" ? splitFactor : parsedQty,
        price: isTotalValue ? total : price,
        total,
        syncCash,
        cashAsset,
        recordContribution,
      });

      handleOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const assetOptions = allAssets.map((a) => ({
    value: a.id,
    label: `${a.ticker} (${a.asset_class ?? "Ativo"})`,
  }));

  const operations = [
    {
      id: "buy",
      label: isTotalValue ? "Aporte / Aplicação" : "Compra / Aporte",
      icon: ArrowUpRight,
      activeClass: "border-primary bg-primary/10 text-primary-strong shadow-xs font-bold",
    },
    {
      id: "sell",
      label: isTotalValue ? "Resgate" : "Venda / Resgate",
      icon: ArrowDownLeft,
      activeClass: "border-negative/60 bg-negative/10 text-negative-strong shadow-xs font-bold",
    },
    {
      id: "dividend",
      label: isTotalValue ? "Rendimento / Cupom" : "Provento",
      icon: Receipt,
      activeClass: "border-positive/60 bg-positive/10 text-positive-strong shadow-xs font-bold",
    },
    {
      id: "split",
      label: "Split / Desdobro",
      icon: GitFork,
      activeClass: "border-warning/60 bg-warning/10 text-warning-strong shadow-xs font-bold",
    },
  ];

  const availableOperations = isTotalValue ? operations.filter((op) => op.id !== "split") : operations;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={
        targetAsset
          ? `Movimentar ${targetAsset.ticker}`
          : "Lançamento Rápido em Investimentos"
      }
      description="Registre compras, vendas, proventos ou eventos corporativos com atualização em tempo real da carteira."
      size="md"
      showCalculator
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Seleção do Ativo (quando não pré-fornecido) */}
        {!asset && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Selecione o Ativo
            </span>
            <Select
              value={selectedAssetId}
              onValueChange={setSelectedAssetId}
              options={assetOptions}
              placeholder="Escolha um ativo da carteira"
            />
          </div>
        )}

        {/* Seletor de Operação */}
        <div className={cn("grid gap-2", availableOperations.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="tablist" aria-label="Tipo de Operação">
          {availableOperations.map((op) => {
            const Icon = op.icon;
            const isSelected = type === op.id;
            return (
              <button
                key={op.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setType(op.id as PortfolioTransactionType)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                  isSelected
                    ? op.activeClass
                    : "border-border/80 bg-surface/60 text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{op.label}</span>
              </button>
            );
          })}
        </div>

        {/* 1. MODO COMPRA / APORTE */}
        {(type === "buy" || type === "subscription") && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {isTotalValue ? (
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label htmlFor="quick-rf-aporte-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Valor do Aporte / Aplicação ({targetAsset?.currency ?? "BRL"})
                  </label>
                  <MoneyInput
                    id="quick-rf-aporte-amount"
                    cents={totalCents || priceCents}
                    onCentsChange={(cents) => {
                      setTotalCents(cents);
                      setPriceCents(cents);
                    }}
                    placeholder="R$ 0,00"
                    aria-label="Valor do aporte em renda fixa"
                  />
                </div>
              ) : !isCash ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-buy-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Quantidade
                    </label>
                    <Input
                      id="quick-buy-qty"
                      type="text"
                      inputMode="decimal"
                      value={quantityStr}
                      onChange={(e) => setQuantityStr(e.target.value)}
                      placeholder="Ex: 10"
                      className="font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-buy-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Preço Unitário
                    </label>
                    <MoneyInput
                      id="quick-buy-price"
                      cents={priceCents}
                      onCentsChange={setPriceCents}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label htmlFor="quick-cash-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Valor do Depósito em Caixa
                  </label>
                  <MoneyInput
                    id="quick-cash-amount"
                    cents={totalCents}
                    onCentsChange={setTotalCents}
                    placeholder="R$ 0,00"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data da Operação
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            {/* Prévia de Novo Saldo para RF */}
            {isTotalValue && (totalCents > 0 || priceCents > 0) && (
              <div className="flex items-center justify-between rounded-xl bg-surface-hover/60 p-3 text-xs">
                <span className="text-muted-foreground">Saldo aplicado resultante:</span>
                <span className="font-mono font-bold text-primary text-sm">
                  <MoneyText cents={numberToCents((targetAsset?.average_price ?? 0) + (totalCents || priceCents) / 100)} />
                </span>
              </div>
            )}

            {/* Prévia de Novo PM */}
            {!isTotalValue && buyPreview && parsedQty > 0 && priceCents > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-surface-hover/60 p-3 text-xs">
                <span className="text-muted-foreground">Novo Preço Médio Resultante:</span>
                <span className="font-mono font-bold text-primary text-sm">
                  <MoneyText cents={numberToCents(buyPreview.newAveragePrice)} />
                </span>
              </div>
            )}

            {/* Sincronização com Caixa & Aporte do Mês */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface/40 p-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={syncCash} onCheckedChange={(c) => setSyncCash(!!c)} />
                <span>Debitar do saldo de Caixa da carteira</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={recordContribution} onCheckedChange={(c) => setRecordContribution(!!c)} />
                <span>Contabilizar como Aporte Financeiro no mês</span>
              </label>
            </div>
          </div>
        )}

        {/* 2. MODO VENDA / DESINVESTIMENTO */}
        {type === "sell" && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {isTotalValue ? (
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label htmlFor="quick-rf-sell-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Valor a Resgatar ({targetAsset?.currency ?? "BRL"})
                  </label>
                  <MoneyInput
                    id="quick-rf-sell-amount"
                    cents={totalCents || priceCents}
                    onCentsChange={(cents) => {
                      setTotalCents(cents);
                      setPriceCents(cents);
                    }}
                    placeholder="R$ 0,00"
                    aria-label="Valor a resgatar em renda fixa"
                  />
                  {/* Atalhos rápidos de percentual do saldo aplicado */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground">Resgatar:</span>
                    {[
                      { label: "25%", pct: 0.25 },
                      { label: "50%", pct: 0.5 },
                      { label: "75%", pct: 0.75 },
                      { label: "100% (Total)", pct: 1 },
                    ].map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => {
                          const balance = targetAsset?.average_price ?? 0;
                          const cents = Math.round(balance * s.pct * 100);
                          setTotalCents(cents);
                          setPriceCents(cents);
                        }}
                        className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-sell-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Quantidade a Vender
                    </label>
                    <Input
                      id="quick-sell-qty"
                      type="text"
                      inputMode="decimal"
                      value={quantityStr}
                      onChange={(e) => setQuantityStr(e.target.value)}
                      placeholder={`Máx: ${targetAsset?.quantity ?? 0}`}
                      className="font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="quick-sell-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Preço de Venda
                    </label>
                    <MoneyInput
                      id="quick-sell-price"
                      cents={priceCents}
                      onCentsChange={setPriceCents}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data {isTotalValue ? "do Resgate" : "da Venda"}
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            {/* Prévia de Novo Saldo para RF */}
            {isTotalValue && (totalCents > 0 || priceCents > 0) && (
              <div className="flex items-center justify-between rounded-xl bg-surface-hover/60 p-3 text-xs">
                <span className="text-muted-foreground">Saldo restante após resgate:</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  <MoneyText
                    cents={Math.max(
                      0,
                      numberToCents((targetAsset?.average_price ?? 0) - (totalCents || priceCents) / 100),
                    )}
                  />
                </span>
              </div>
            )}

            {/* Prévia de Lucro/Prejuízo Realizado */}
            {!isTotalValue && sellPreview && parsedQty > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Resultado Realizado:</span>
                  <span className={`font-mono font-bold text-sm ${sellPreview.realizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong"}`}>
                    {sellPreview.realizedPnl >= 0 ? "+" : ""}
                    <MoneyText cents={numberToCents(sellPreview.realizedPnl)} /> ({sellPreview.realizedPnlPct >= 0 ? "+" : ""}{sellPreview.realizedPnlPct.toFixed(1)}%)
                  </span>
                </div>

                {targetAsset?.asset_class === "Ações" && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                    <Info className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                    <span>Isenção de IRPF se o total de vendas de ações no mês for até R$ 20.000,00.</span>
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-xs rounded-xl border border-border/60 bg-surface/40 p-3">
              <Checkbox checked={syncCash} onCheckedChange={(c) => setSyncCash(!!c)} />
              <span>Creditar o valor da venda diretamente no Caixa da carteira</span>
            </label>
          </div>
        )}

        {/* 3. MODO PROVENTO (DIVIDENDO / JCP / RENDIMENTO) */}
        {(type === "dividend" || type === "jcp" || type === "fii_yield") && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label htmlFor="quick-div-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor Total Recebido (Líquido)
                </label>
                <MoneyInput
                  id="quick-div-amount"
                  cents={totalCents}
                  onCentsChange={setTotalCents}
                  placeholder="R$ 0,00"

                />
              </div>

              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data do Pagamento
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs rounded-xl border border-border/60 bg-surface/40 p-3">
              <Checkbox checked={syncCash} onCheckedChange={(c) => setSyncCash(!!c)} />
              <span>Creditar o rendimento diretamente no Caixa da carteira</span>
            </label>
          </div>
        )}

        {/* 4. MODO SPLIT / DESDOBRAMENTO */}
        {(type === "split" || type === "reverse_split") && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quick-split-factor" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {type === "split" ? "Fator (1 para N)" : "Fator (N para 1)"}
                </label>
                <Input
                  id="quick-split-factor"
                  type="number"
                  min="2"
                  step="1"
                  value={splitFactor}
                  onChange={(e) => setSplitFactor(Number(e.target.value) || 2)}
                  className="font-mono"

                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data do Evento
                </label>
                <DatePicker value={date} onValueChange={setDate} />
              </div>
            </div>

            {targetAsset && (
              <div className="flex flex-col gap-1 rounded-xl bg-surface-hover/60 p-3 text-xs">
                <span className="text-muted-foreground">Posição Resultante:</span>
                <span className="font-mono font-bold text-foreground">
                  {type === "split"
                    ? `${targetAsset.quantity * splitFactor} cotas a `
                    : `${Math.floor(targetAsset.quantity / splitFactor)} cotas a `}
                  <MoneyText
                    cents={numberToCents(
                      type === "split"
                        ? targetAsset.average_price / splitFactor
                        : targetAsset.average_price * splitFactor,
                    )}
                  />
                </span>
                <span className="text-[10px] text-muted-foreground">
                  O custo total da posição é rigorosamente preservado.
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/80">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={recordOrder.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={recordOrder.isPending}
          >
            {recordOrder.isPending ? "Processando..." : "Confirmar Operação"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
