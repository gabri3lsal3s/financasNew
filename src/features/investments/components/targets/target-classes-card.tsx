import { Layers } from "lucide-react";
import type { PortfolioPositionRow } from "@/state";
import { TargetDistributionCard, type TargetDistributionItem } from "./target-distribution-card";

export interface TargetClassesCardProps {
  classes: string[];
  classTargetOf: (className: string) => number;
  storedClassTargets: Map<string, number>;
  positionRows: PortfolioPositionRow[];
  classSum: { sum: number; error: string | null };
  savingClass: string | null;
  onNormalizeClasses: () => void;
  onDistributeClassesEqually: () => void;
  onDistributeRemaining?: () => void;
  onResetClassesZero: () => void;
  onClassTargetChange: (className: string, val: number) => void;
  onSaveClass: (className: string) => void;
  onRemoveClass: (className: string) => void;
  onSaveAllClasses: () => void;
  onOpenClassDetail?: (className: string) => void;
}

export function TargetClassesCard({
  classes,
  classTargetOf,
  storedClassTargets,
  positionRows,
  classSum,
  savingClass,
  onNormalizeClasses,
  onDistributeClassesEqually,
  onDistributeRemaining,
  onResetClassesZero,
  onClassTargetChange,
  onSaveClass,
  onRemoveClass,
  onSaveAllClasses,
  onOpenClassDetail,
}: TargetClassesCardProps) {
  if (classes.length === 0) return null;

  const totalBRL = positionRows.reduce((acc, r) => acc + r.valueBRL, 0);

  const items: TargetDistributionItem[] = classes.map((className) => {
    const members = positionRows.filter((r) => r.assetClass === className);
    const classBRL = members.reduce((acc, r) => acc + r.valueBRL, 0);
    return {
      name: className,
      target: classTargetOf(className),
      savedTarget: storedClassTargets.get(className) ?? 0,
      currentPct: totalBRL > 0 ? (classBRL / totalBRL) * 100 : 0,
      membersCount: members.length,
      stepperAriaLabel: `Meta da classe ${className} em %`,
      detailAriaLabel: `Ver detalhes de ${className}`,
      detailIcon: <Layers className="size-3.5" aria-hidden="true" />,
      onOpenDetail: onOpenClassDetail ? () => onOpenClassDetail(className) : undefined,
    };
  });

  return (
    <TargetDistributionCard
      ariaLabel="Metas por classe"
      dataTour="targets-classes-card"
      title="Metas por classe de ativo"
      description="Defina a alocação macro ideal (% da carteira investível, fora o Caixa) entre as classes."
      headerRight={
        <span className="text-xs text-muted-foreground font-mono font-medium">
          {classes.length} {classes.length === 1 ? "classe" : "classes"}
        </span>
      }
      donutTitle="Alocação por Classe"
      items={items}
      sumState={classSum}
      showProgressBar
      progressLabel="Total alocado em classes:"
      savingItemKey={savingClass}
      normalizeLabel="Normalizar classes para 100%"
      resetLabel="Zerar classes"
      saveAllLabel="Salvar todas as classes"
      savingAllLabel="Salvando todas…"
      onDistributeRemaining={onDistributeRemaining}
      onNormalize={onNormalizeClasses}
      onDistributeEqually={onDistributeClassesEqually}
      onResetZero={onResetClassesZero}
      onTargetChange={onClassTargetChange}
      onSaveItem={onSaveClass}
      onRemoveItem={onRemoveClass}
      onSaveAll={onSaveAllClasses}
    />
  );
}
