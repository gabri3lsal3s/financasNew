import { ChevronLeft, ChevronRight, ChevronUp, Users } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { ManageSplitDialog } from "@/components/modules/manage-split-dialog";
import { SplitExpenseDialog } from "@/components/modules/split-expense-dialog";
import {
  ActiveSplitItemCard,
  ActiveSplitsCollapsedBar,
  useActiveSplits,
} from "./splits";

export interface ActiveSplitsCardProps {
  /** Mês em foco (YYYY-MM) para sincronizar visualização */
  month?: string;
}

export function ActiveSplitsCard({ month }: ActiveSplitsCardProps) {
  const {
    isLoading,
    activeSplits,
    visibleSplits,
    totalBlocks,
    safeBlock,
    allFinalized,
    isExpanded,
    copiedToken,
    managingItem,
    generatingShareFor,
    isSettlePending,
    setCurrentBlock,
    setUserExpanded,
    setManagingItem,
    setGeneratingShareFor,
    handleQuickSettle,
    handleCopyLink,
    handleShareWhatsApp,
  } = useActiveSplits(month);

  if (isLoading || activeSplits.length === 0) {
    return null;
  }

  if (allFinalized && !isExpanded) {
    return (
      <ActiveSplitsCollapsedBar
        totalCount={activeSplits.length}
        onExpand={() => setUserExpanded(true)}
      />
    );
  }

  return (
    <div
      data-tour="active-splits-card"
      className="flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs min-w-0"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <h2 className="text-xs font-semibold text-foreground whitespace-nowrap">
              {allFinalized ? "Rachas de Despesa" : "Rachas de Despesa Ativos"}
            </h2>
            <Badge variant={allFinalized ? "positive" : "muted"} size="xs">
              {allFinalized
                ? "Todos quitados"
                : `${activeSplits.length} ${activeSplits.length === 1 ? "ativo" : "ativos"}`}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {allFinalized && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={() => setUserExpanded(false)}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <span>Recolher</span>
              <ChevronUp className="size-3.5" aria-hidden="true" />
            </Button>
          )}

          {totalBlocks > 1 && (
            <div className="flex items-center rounded-lg border border-border/80 bg-surface-raised/60 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Bloco anterior de rachas"
                sensoryIntent="selection"
                disabled={safeBlock === 0}
                onClick={() => setCurrentBlock((prev) => Math.max(0, prev - 1))}
                className="w-8 px-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </Button>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums px-2 select-none whitespace-nowrap">
                {safeBlock + 1} de {totalBlocks}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Próximo bloco de rachas"
                sensoryIntent="selection"
                disabled={safeBlock >= totalBlocks - 1}
                onClick={() => setCurrentBlock((prev) => Math.min(totalBlocks - 1, prev + 1))}
                className="w-8 px-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 pt-0.5 items-stretch">
        {visibleSplits.map((item) => (
          <ActiveSplitItemCard
            key={item.share?.id ?? item.id}
            item={item}
            isCopied={item.share ? copiedToken === item.share.token : false}
            isSettlePending={isSettlePending}
            onQuickSettle={(target) => void handleQuickSettle(target)}
            onManage={setManagingItem}
            onGenerateShare={setGeneratingShareFor}
            onCopyLink={(share) => void handleCopyLink(share)}
            onShareWhatsApp={handleShareWhatsApp}
          />
        ))}
      </div>

      {generatingShareFor && (
        <SplitExpenseDialog
          open={Boolean(generatingShareFor)}
          fromWizard={false}
          onOpenChange={(open) => {
            if (!open) setGeneratingShareFor(null);
          }}
          expense={{
            id: generatingShareFor.linkedDebt?.expense_id ?? undefined,
            installment_group_id: generatingShareFor.linkedDebt?.installment_group_id ?? undefined,
            value: (generatingShareFor.totalCents || generatingShareFor.receivableExpectedCents) / 100,
            description: generatingShareFor.payload.title ?? null,
            date: generatingShareFor.date,
            payment_method: "pix",
            created_at: "",
          }}
          linkedDebtId={generatingShareFor.linkedDebt?.id ?? null}
          initialAmountCents={generatingShareFor.totalCents || generatingShareFor.receivableExpectedCents}
          initialDescription={generatingShareFor.payload.title || ""}
          initialDate={generatingShareFor.date}
          initialPeopleCount={generatingShareFor.peopleCount || 2}
        />
      )}

      {managingItem && (
        <ManageSplitDialog
          open={Boolean(managingItem)}
          onOpenChange={(open) => {
            if (!open) setManagingItem(null);
          }}
          share={managingItem.share}
          linkedDebt={managingItem.linkedDebt}
        />
      )}
    </div>
  );
}
