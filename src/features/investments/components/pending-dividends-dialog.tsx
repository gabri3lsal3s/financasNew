import { useMemo, useState } from "react";
import { EyeOff } from "lucide-react";
import { Badge, Button, Checkbox, EmptyState, Modal, ModalFooter, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { SuggestedDividendItem } from "@/domain/portfolio";
import { formatDateBR } from "@/lib/date";
import { formatAssetQuantity } from "@/services/formatting";
import { triggerSensory } from "@/services/sensory";
import { useApproveDividendsBatch, useDismissCorporateDividend } from "@/state/mutations/use-portfolio-mutations";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(availableDividends.map((d) => d.corporateDividendId)),
  );
  const approveMutation = useApproveDividendsBatch();
  const dismissMutation = useDismissCorporateDividend();

  const allAvailableSelected = useMemo(
    () => availableDividends.length > 0 && availableDividends.every((d) => selectedIds.has(d.corporateDividendId)),
    [availableDividends, selectedIds],
  );

  const selectedTotal = useMemo(
    () => availableDividends.filter((d) => selectedIds.has(d.corporateDividendId)).reduce((sum, d) => sum + d.totalAmount, 0),
    [availableDividends, selectedIds],
  );

  const handleToggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(availableDividends.map((d) => d.corporateDividendId)) : new Set());
  };

  const handleToggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

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
    await approveMutation.mutateAsync({ dividends: itemsToApprove, sync_cash: true });
    triggerSensory("success");
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Proventos Detectados na Corretora"
      description="Confira os proventos apurados na Data COM para os ativos sob sua custódia e confirme o crédito no Caixa."
      size="lg"
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            loading={approveMutation.isPending}
            disabled={selectedIds.size === 0 || approveMutation.isPending}
            sensoryIntent={false}
            onClick={() => void handleApproveSelected()}
          >
            {`Aprovar no Caixa (${selectedIds.size})`}
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/80">
            <div className="flex items-center gap-2">
              <Checkbox checked={allAvailableSelected} onCheckedChange={handleToggleAll} disabled={availableDividends.length === 0} aria-label="Selecionar todos os proventos disponíveis" />
              <span className="text-xs font-semibold text-foreground">Disponíveis para Crédito ({availableDividends.length})</span>
            </div>
            {selectedTotal > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{selectedIds.size} de {availableDividends.length} selecionados:</span>
                <MoneyText cents={numberToCents(selectedTotal)} tone="positive" className="text-xs font-semibold" />
              </div>
            ) : null}
          </div>

          {availableDividends.length === 0 ? (
            <EmptyState title="Nenhum provento pendente" description="Nenhum provento pendente para crédito no momento." headingLevel="h3" />
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface">
              {availableDividends.map((div) => (
                <div key={div.corporateDividendId} className="flex items-center justify-between py-2.5 px-3 gap-3 hover:bg-surface-hover/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={selectedIds.has(div.corporateDividendId)}
                      onCheckedChange={(checked) => handleToggleOne(div.corporateDividendId, checked)}
                      aria-label={`Selecionar provento de ${div.ticker}`}
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">{div.ticker}</span>
                        <Badge size="xs" variant="muted">{div.type}</Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {formatAssetQuantity(div.quantityOnComDate)} cotas em {formatDateBR(div.comDate)} · Pago em {formatDateBR(div.paymentDate)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <MoneyText cents={numberToCents(div.totalAmount)} tone="default" className="text-xs font-semibold text-right" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Ignorar este provento"
                      aria-label={`Ignorar provento de ${div.ticker}`}
                      onClick={() => void dismissMutation.mutateAsync({ corporateDividendId: div.corporateDividendId, reason: "manual_ignore" })}
                      disabled={dismissMutation.isPending}
                    >
                      <EyeOff className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {projectedDividends.length > 0 ? (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/80">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Proventos Previstos ({projectedDividends.length})</span>
              <span className="text-[11px] text-muted-foreground">Liquidação futura automática</span>
            </div>
            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-surface opacity-85">
              {projectedDividends.slice(0, 5).map((div) => (
                <div key={div.corporateDividendId} className="flex items-center justify-between py-2 px-3 text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground">{div.ticker}</span>
                    <Badge size="xs" variant="muted">{div.type}</Badge>
                    <span className="text-[11px] text-muted-foreground truncate">Previsto para {formatDateBR(div.paymentDate)}</span>
                  </div>
                  <MoneyText cents={numberToCents(div.totalAmount)} tone="default" className="font-medium text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
