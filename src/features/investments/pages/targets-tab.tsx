import { Save } from "lucide-react";
import { Alert, Button, EmptyState, ErrorState, Tabs, TargetsSkeleton } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import {
  AllocationBreakdownDialog,
  AssetDetailSheet,
  AssetScoreEvaluationDialog,
} from "../components";
import { TargetAssetsCard } from "../components/targets/target-assets-card";
import { TargetClassesCard } from "../components/targets/target-classes-card";
import { TargetSectorsCard } from "../components/targets/target-sectors-card";
import { TargetsUnsavedBar } from "../components/targets/targets-unsaved-bar";
import { useTargetsDraftState } from "../components/targets/use-targets-draft-state";

/**
 * Governança hierárquica da carteira em 3 níveis (§3.11.1 · Plano 42):
 * 1. Classes: alocação macro (% do patrimônio investível, fora o Caixa);
 * 2. Setores: alocação meso opcional com escopo por classe (% dentro da classe);
 * 3. Ativos: Notas de Tese (0–10) + Status, com meta efetiva derivada automaticamente.
 * Normalização 100% automática e salvamento otimista contínuo (§AutoNormalize).
 */
export function TargetsTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const s = useTargetsDraftState();

  return (
    <div data-tour="investments-targets" className="flex flex-col gap-6">
      {s.loadError ? (
        <ErrorState
          message={getErrorMessage(s.loadError)}
          onRetry={() => {
            s.position.refetch();
            void s.classTargetsQuery.refetch();
            void s.sectorTargetsQuery.refetch();
          }}
        />
      ) : null}

      {s.error ? <Alert variant="error">{s.error}</Alert> : null}

      {s.hasDraftChanges ? <TargetsUnsavedBar onDiscard={s.handleDiscardDraft} /> : null}

      {s.loading ? (
        <TargetsSkeleton />
      ) : s.investableRows.length === 0 ? (
        <EmptyState
          icon={<Save className="size-6" aria-hidden="true" />}
          title={
            s.position.rows.length > 0
              ? "Apenas liquidez em Caixa no momento"
              : "Sem ativos para definir metas"
          }
          description={
            s.position.rows.length > 0
              ? "O Caixa fica fora das metas de alocação. Cadastre ativos investíveis (Ações, FIIs, Renda Fixa) para definir classes, setores e notas."
              : "Adicione ativos na carteira para configurar metas de classes, setores e notas."
          }
          tone="default"
          headingLevel="h2"
          action={
            onGoToPosition ? (
              <Button type="button" onClick={onGoToPosition}>
                Ir para Carteira
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="w-full">
          <Tabs
            value={s.subTab}
            onValueChange={(val: string) =>
              s.handleSubTabChange(val as "classes" | "sectors" | "assets")
            }
            variant="pills"
            items={[
              {
                value: "classes",
                label: "Classes",
                content: (
                  <TargetClassesCard
                    classes={s.classes}
                    classTargetOf={s.classTargetOf}
                    effectiveClassTargetOf={s.effectiveClassTargetOf}
                    storedClassTargets={s.storedClassTargets}
                    positionRows={s.investableRows}
                    classSum={s.classSum}
                    syncStatus={s.syncStatus}
                    onDistributeClassesEqually={s.handleDistributeClassesEqually}
                    onResetClassesZero={s.handleResetClassesZero}
                    onClassTargetChange={s.setClassTarget}
                    onOpenClassDetail={(cls) => s.setBreakdownGroup({ type: "class", name: cls })}
                  />
                ),
              },
              {
                value: "sectors",
                label: "Setores",
                content: (
                  <TargetSectorsCard
                    classes={s.classes}
                    activeSectorClass={s.activeSectorClass}
                    availableSectors={s.availableSectors}
                    storedSectorTargets={s.activeClassStoredSectors}
                    positionRows={s.investableRows}
                    sectorTargetOf={(sec) => s.sectorTargetOf(sec, s.activeSectorClass)}
                    effectiveSectorTargetOf={(sec) => s.effectiveSectorTargetOf(sec, s.activeSectorClass)}
                    sectorSum={s.sectorSum}
                    syncStatus={s.syncStatus}
                    onSelectSectorClass={s.setSelectedSectorClass}
                    onDistributeSectorsEqually={s.handleDistributeSectorsEqually}
                    onResetSectorsZero={s.handleResetSectorsZero}
                    onSectorTargetChange={s.setSectorTarget}
                    onOpenSectorDetail={(sec, parentCls) =>
                      s.setBreakdownGroup({ type: "sector", name: sec, parentClass: parentCls })
                    }
                  />
                ),
              },
              {
                value: "assets",
                label: "Ativos",
                content: (
                  <TargetAssetsCard
                    classes={s.classes}
                    assetClassFilter={s.assetClassFilter}
                    rows={s.assetScoreRows}
                    onAssetClassFilterChange={s.setAssetClassFilter}
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      <AllocationBreakdownDialog
        open={s.breakdownGroup !== null}
        onOpenChange={(open) => {
          if (!open) s.setBreakdownGroup(null);
        }}
        type={s.breakdownGroup?.type ?? "class"}
        groupName={s.breakdownGroup?.name ?? null}
        parentClassName={s.breakdownGroup?.parentClass}
        rows={s.investableRows}
        totalPortfolioBRL={s.investableTotalBRL}
        targetPercent={
          s.breakdownGroup?.type === "class"
            ? s.effectiveClassTargetOf(s.breakdownGroup.name)
            : s.breakdownGroup?.name
              ? s.effectiveSectorTargetOf(
                  s.breakdownGroup.name,
                  s.breakdownGroup.parentClass ?? s.activeSectorClass,
                )
              : null
        }
        onSelectAsset={(assetId) => s.setAssetDetailId(assetId)}
      />

      {s.detailAsset ? (
        <AssetDetailSheet
          open={s.assetDetailId !== null}
          onOpenChange={(open) => {
            if (!open) s.setAssetDetailId(null);
          }}
          asset={s.detailAsset}
        />
      ) : null}

      <AssetScoreEvaluationDialog
        open={s.evaluatingAsset !== null}
        onOpenChange={(open) => {
          if (!open) s.setEvaluatingAsset(null);
        }}
        asset={s.evaluatingAsset}
      />

      {s.upgradeModal}
    </div>
  );
}
