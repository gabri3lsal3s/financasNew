import { ArrowDownRight, ArrowUpRight, History, Sparkles, Zap } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, MoneyText, Tabs } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { PocketContributionsLedgerTab } from "./pocket-cost/pocket-contributions-ledger-tab";
import { PocketQuickModeTab } from "./pocket-cost/pocket-quick-mode-tab";
import { PocketStatementImportTab } from "./pocket-cost/pocket-statement-import-tab";
import { usePocketCostImport } from "./pocket-cost/use-pocket-cost-import";

export interface InitialPocketCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCostBRL?: number;
  onSuccess?: () => void;
}

export function InitialPocketCostDialog({
  open,
  onOpenChange,
  defaultCostBRL = 0,
  onSuccess,
}: InitialPocketCostDialogProps) {
  const pocket = usePocketCostImport({ open, onOpenChange, defaultCostBRL, onSuccess });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Linha do Tempo de Aportes Históricos"
      description="Calibre com precisão as entradas e saídas do seu bolso anteriores ao app para cálculo exato da TIR (XIRR)."
      size="xl"
      showCalculator={pocket.activeTab !== "extrato"}
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Concluir
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 text-xs pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col justify-between gap-1 shadow-xs">
            <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-positive-strong" aria-hidden="true" />
              Total Aportado (+)
            </span>
            <MoneyText cents={numberToCents(pocket.summary.totalAportesBRL)} tone="default" className="text-base font-bold" />
          </div>

          <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-col justify-between gap-1 shadow-xs">
            <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
              <ArrowDownRight className="size-3.5 text-warning-strong" aria-hidden="true" />
              Total Resgatado (-)
            </span>
            <MoneyText cents={numberToCents(pocket.summary.totalResgatesBRL)} tone="default" className="text-base font-bold" />
          </div>

          <div className="rounded-xl border border-portfolio/30 bg-portfolio/5 p-3 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
                <History className="size-3.5 text-portfolio" aria-hidden="true" />
                Capital Líquido do Bolso
              </span>
              <Badge variant="portfolio" size="xs">
                {pocket.historicalContributions.length} marcos
              </Badge>
            </div>
            <MoneyText cents={numberToCents(pocket.summary.netPocketCapitalBRL)} tone="default" className="text-base font-bold" />
          </div>
        </div>

        <Tabs
          value={pocket.activeTab}
          onValueChange={pocket.setActiveTab}
          variant="pills"
          fullWidth={false}
          items={[
            {
              value: "manual",
              label: "Lançamento Individual",
              icon: <History className="size-3.5" aria-hidden="true" />,
            },
            {
              value: "extrato",
              label: "Assistente de Extrato",
              icon: <Sparkles className="size-3.5" aria-hidden="true" />,
            },
            {
              value: "rapido",
              label: "Modo Rápido",
              icon: <Zap className="size-3.5" aria-hidden="true" />,
            },
          ]}
        />

        {pocket.activeTab === "extrato" ? (
          <PocketStatementImportTab
            statementText={pocket.statementText}
            onStatementTextChange={pocket.setStatementText}
            parseResult={pocket.parseResult}
            replaceExisting={pocket.replaceExisting}
            onReplaceExistingChange={pocket.setReplaceExisting}
            isImporting={pocket.isImporting}
            onProcessStatement={pocket.handleProcessStatement}
            onConfirmImport={() => void pocket.handleConfirmImportStatement()}
          />
        ) : null}

        {pocket.activeTab === "manual" ? (
          <PocketContributionsLedgerTab
            formRef={pocket.formRef}
            historicalContributions={pocket.historicalContributions}
            snapshotsCount={pocket.snapshotsCount}
            snapshotsByMonth={pocket.snapshotsByMonth}
            netPocketCapitalBRL={pocket.summary.netPocketCapitalBRL}
            editingMarco={pocket.editingMarco}
            entryType={pocket.entryType}
            onEntryTypeChange={pocket.setEntryType}
            newDate={pocket.newDate}
            onDateChange={pocket.setNewDate}
            newAmountCents={pocket.newAmountCents}
            onAmountCentsChange={pocket.setNewAmountCents}
            newGrossBalanceCents={pocket.newGrossBalanceCents}
            onGrossBalanceCentsChange={pocket.setNewGrossBalanceCents}
            newRatePctText={pocket.newRatePctText}
            onRatePctTextChange={pocket.setNewRatePctText}
            newNotes={pocket.newNotes}
            onNotesChange={pocket.setNewNotes}
            formError={pocket.formError}
            deletingId={pocket.deletingId}
            isPending={pocket.isPendingManual}
            onSubmit={(e) => void pocket.handleSubmitManual(e)}
            onStartEdit={pocket.handleStartEdit}
            onCancelEdit={pocket.handleCancelEdit}
            onDelete={(marco) => void pocket.handleDeleteMarco(marco)}
          />
        ) : null}

        {pocket.activeTab === "rapido" ? (
          <PocketQuickModeTab
            quickDate={pocket.quickDate}
            onQuickDateChange={pocket.setQuickDate}
            quickAmountCents={pocket.quickAmountCents}
            onQuickAmountCentsChange={pocket.setQuickAmountCents}
            isSaving={pocket.isSavingQuick}
            onSaveQuick={() => void pocket.handleSaveQuick()}
          />
        ) : null}
      </div>
    </Modal>
  );
}
