import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge, Button, Modal, ModalFooter } from "@/components/ui";
import { useUpdatePortfolioAsset } from "@/state";
import { pushToast } from "@/services/toast";
import type { AssetAllocationStatus, PortfolioAsset } from "@/types";
import { AssetGovernanceForm } from "./shared-forms";

export interface AssetScoreEvaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PortfolioAsset | null;
  queueProgress?: { current: number; total: number };
  onSavedAndNext?: () => void;
}

export function AssetScoreEvaluationDialog({
  open,
  onOpenChange,
  asset,
  queueProgress,
  onSavedAndNext,
}: AssetScoreEvaluationDialogProps) {
  if (!asset) return null;

  return (
    <AssetScoreEvaluationDialogContent
      key={`${asset.id}-${open ? "open" : "closed"}`}
      open={open}
      onOpenChange={onOpenChange}
      asset={asset}
      queueProgress={queueProgress}
      onSavedAndNext={onSavedAndNext}
    />
  );
}

function AssetScoreEvaluationDialogContent({
  open,
  onOpenChange,
  asset,
  queueProgress,
  onSavedAndNext,
}: AssetScoreEvaluationDialogProps & { asset: PortfolioAsset }) {
  const updateMutation = useUpdatePortfolioAsset();

  const [score, setScore] = useState<number | null>(() => asset.score ?? null);
  const [allocationStatus, setAllocationStatus] = useState<AssetAllocationStatus>(
    () => asset.allocation_status ?? "active",
  );
  const [reviewFrequencyMonths, setReviewFrequencyMonths] = useState<number>(
    () => asset.review_frequency_months ?? 6,
  );
  const [thesisSummary, setThesisSummary] = useState<string>(() => asset.thesis_summary ?? "");
  const [criteria, setCriteria] = useState<Record<string, number>>(
    () => (asset.score_criteria as Record<string, number> | null) ?? {},
  );

  const handleToggleCriterion = (key: string) => {
    setCriteria((prev) => {
      const next = { ...prev };
      if (next[key] === 1) {
        delete next[key];
      } else {
        next[key] = 1;
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: asset.id,
        patch: {
          score,
          allocation_status: allocationStatus,
          review_frequency_months: reviewFrequencyMonths,
          thesis_summary: thesisSummary.trim() || null,
          score_criteria: Object.keys(criteria).length > 0 ? criteria : null,
          last_reviewed_at: score !== null ? new Date().toISOString() : (asset.last_reviewed_at ?? null),
        },
      });

      pushToast({
        title: "Governança atualizada",
        description: `Tese e nota de ${asset.ticker} salvas com sucesso.`,
        variant: "success",
      });
      if (onSavedAndNext) {
        onSavedAndNext();
      } else {
        onOpenChange(false);
      }
    } catch {
      // O hook já dispara toast de erro
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Avaliação de Tese: ${asset.ticker}`}
      description="Defina a nota de convicção, o status de governança e os critérios estratégicos para o motor de rebalanceamento."
      headerActions={
        queueProgress && queueProgress.total > 1 ? (
          <Badge size="xs" variant="muted">
            {queueProgress.current} de {queueProgress.total}
          </Badge>
        ) : undefined
      }
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Cancelar
          </Button>
          {onSavedAndNext ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSavedAndNext}
              disabled={updateMutation.isPending}
            >
              Pular
            </Button>
          ) : null}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="font-semibold"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                Salvando...
              </>
            ) : onSavedAndNext ? (
              "Salvar e Próximo"
            ) : (
              "Salvar Avaliação"
            )}
          </Button>
        </ModalFooter>
      }
    >
      <div className="py-1">
        <AssetGovernanceForm
          idPrefix="eval-gov"
          interactionMode="dialog"
          assetClass={asset.asset_class}
          score={score}
          onScoreChange={setScore}
          allocationStatus={allocationStatus}
          onAllocationStatusChange={setAllocationStatus}
          scoreCriteria={criteria}
          onToggleCriterion={handleToggleCriterion}
          thesisSummary={thesisSummary}
          onThesisSummaryChange={setThesisSummary}
          reviewFrequencyMonths={reviewFrequencyMonths}
          onReviewFrequencyMonthsChange={setReviewFrequencyMonths}
          lastReviewedAt={asset.last_reviewed_at}
          showLastReviewed
        />
      </div>
    </Modal>
  );
}
