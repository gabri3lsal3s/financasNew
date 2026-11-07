import { useMemo, useState } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyText } from "@/components/ui/money-text";
import {
  useApproveDividendsBatch,
  useDismissCorporateDividend,
} from "@/state/mutations/use-portfolio-mutations";
import type { SuggestedDividendItem } from "@/domain/portfolio";

export interface PendingDividendsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableDividends: SuggestedDividendItem[];
  projectedDividends: SuggestedDividendItem[];
}

export function PendingDividendsDialog({
  open,
  onOpenChange,
  availableDividends,
  projectedDividends,
}: PendingDividendsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(availableDividends.map((d) => d.corporateDividendId));
  });

  const approveMutation = useApproveDividendsBatch();
  const dismissMutation = useDismissCorporateDividend();

  // Se a lista mudar externamente e ainda não houver seleção personalizada, seleciona todos os disponíveis
  const allAvailableSelected = useMemo(() => {
    if (availableDividends.length === 0) return false;
    return availableDividends.every((d) => selectedIds.has(d.corporateDividendId));
  }, [availableDividends, selectedIds]);

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(availableDividends.map((d) => d.corporateDividendId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    return availableDividends
      .filter((d) => selectedIds.has(d.corporateDividendId))
      .reduce((sum, d) => sum + d.totalAmount, 0);
  }, [availableDividends, selectedIds]);

  const handleApproveSelected = async () => {
    const itemsToApprove = availableDividends
      .filter((d) => selectedIds.has(d.corporateDividendId))
      .map((d) => ({
        asset_id: d.assetId,
        ticker: d.ticker,
        date: d.paymentDate,
        amount: d.totalAmount,
        notes: `Provento automático (${d.type}) apurado na B3`,
        corporate_dividend_id: d.corporateDividendId,
      }));

    if (itemsToApprove.length === 0) return;

    await approveMutation.mutateAsync({
      dividends: itemsToApprove,
      sync_cash: true,
    });

    onOpenChange(false);
  };

  const handleDismiss = async (corporateDividendId: string) => {
    await dismissMutation.mutateAsync({
      corporateDividendId,
      reason: "manual_ignore",
    });
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Proventos Detectados na Corretora"
      description="Confira os proventos apurados na Data COM para os ativos sob sua custódia e confirme o crédito no Caixa."
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center w-full">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {selectedIds.size} de {availableDividends.length} selecionados
            {selectedTotal > 0 && (
              <>
                {" "}
                (Total: <MoneyText cents={Math.round(selectedTotal * 100)} className="font-semibold" />)
              </>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={selectedIds.size === 0 || approveMutation.isPending}
              onClick={handleApproveSelected}
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Creditando...
                </>
              ) : (
                `Aprovar no Caixa (${selectedIds.size})`
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {/* Seção 1: Proventos Disponíveis para Crédito Imediato */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allAvailableSelected}
                onCheckedChange={handleToggleAll}
                disabled={availableDividends.length === 0}
                aria-label="Selecionar todos os proventos disponíveis"
              />
              <span className="text-xs font-semibold text-foreground">
                Disponíveis para Crédito ({availableDividends.length})
              </span>
            </div>
            {selectedTotal > 0 && (
              <MoneyText
                cents={Math.round(selectedTotal * 100)}
                className="text-xs font-semibold text-positive-strong tabular-nums"
              />
            )}
          </div>

          {availableDividends.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Nenhum provento pendente para crédito no momento.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/40 max-h-[320px] overflow-y-auto pr-1">
              {availableDividends.map((div) => {
                const isSelected = selectedIds.has(div.corporateDividendId);
                return (
                  <div
                    key={div.corporateDividendId}
                    className="flex items-center justify-between py-2.5 gap-3 hover:bg-surface-hover/50 rounded-lg px-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleToggleOne(div.corporateDividendId, checked)
                        }
                        aria-label={`Selecionar provento de ${div.ticker}`}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">
                            {div.ticker}
                          </span>
                          <Badge size="xs" variant="muted">
                            {div.type}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {div.quantityOnComDate} cotas em {div.comDate} · Pago em {div.paymentDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <MoneyText
                        cents={Math.round(div.totalAmount * 100)}
                        className="text-xs font-semibold text-foreground tabular-nums text-right"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        title="Ignorar este provento"
                        aria-label={`Ignorar provento de ${div.ticker}`}
                        onClick={() => handleDismiss(div.corporateDividendId)}
                        disabled={dismissMutation.isPending}
                      >
                        <EyeOff className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Seção 2: Proventos Previstos (Liquidação Futura) */}
        {projectedDividends.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Proventos Previstos ({projectedDividends.length})
              </span>
              <span className="text-[11px] text-muted-foreground">
                Liquidação futura automática
              </span>
            </div>

            <div className="flex flex-col divide-y divide-border/40 opacity-80">
              {projectedDividends.slice(0, 5).map((div) => (
                <div
                  key={div.corporateDividendId}
                  className="flex items-center justify-between py-2 px-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{div.ticker}</span>
                    <Badge size="xs" variant="muted">
                      {div.type}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Previsto para {div.paymentDate}
                    </span>
                  </div>
                  <MoneyText
                    cents={Math.round(div.totalAmount * 100)}
                    className="font-medium text-muted-foreground tabular-nums"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
