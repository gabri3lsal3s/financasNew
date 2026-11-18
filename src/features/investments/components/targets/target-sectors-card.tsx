import { PieChart } from "lucide-react";
import { Badge } from "@/components/ui";
import { inferSectorFromTicker } from "@/domain/portfolio";
import type { PortfolioPositionRow } from "@/state";
import { TargetDistributionCard, type TargetDistributionItem } from "./target-distribution-card";

export interface TargetSectorsCardProps {
  classes: string[];
  activeSectorClass: string;
  availableSectors: string[];
  storedSectorTargets: Map<string, number>;
  positionRows: PortfolioPositionRow[];
  sectorTargetOf: (sectorName: string) => number;
  sectorSum: { sum: number; error: string | null };
  savingSector: string | null;
  onSelectSectorClass: (cls: string) => void;
  onNormalizeSectors: () => void;
  onDistributeSectorsEqually: () => void;
  onResetSectorsZero: () => void;
  onSectorTargetChange: (sectorName: string, val: number) => void;
  onSaveSector: (sectorName: string) => void;
  onRemoveSector: (sectorName: string) => void;
  onSaveAllSectorsForClass: () => void;
  onOpenSectorDetail?: (sectorName: string, parentClass: string) => void;
}

export function TargetSectorsCard({
  classes,
  activeSectorClass,
  availableSectors,
  storedSectorTargets,
  positionRows,
  sectorTargetOf,
  sectorSum,
  savingSector,
  onSelectSectorClass,
  onNormalizeSectors,
  onDistributeSectorsEqually,
  onResetSectorsZero,
  onSectorTargetChange,
  onSaveSector,
  onRemoveSector,
  onSaveAllSectorsForClass,
  onOpenSectorDetail,
}: TargetSectorsCardProps) {
  if (classes.length === 0) return null;

  const totalBRL = positionRows.reduce((acc, r) => acc + r.valueBRL, 0);
  const classRows = positionRows.filter((r) => r.assetClass === activeSectorClass);
  const classTotalBRL = classRows.reduce((acc, r) => acc + r.valueBRL, 0);

  const items: TargetDistributionItem[] = availableSectors.map((sectorName) => {
    const members = classRows.filter(
      (r) => r.sector === sectorName || inferSectorFromTicker(r.ticker, activeSectorClass) === sectorName,
    );
    const sectorBRL = members.reduce((acc, r) => acc + r.valueBRL, 0);
    const pctInPortfolio = totalBRL > 0 ? (sectorBRL / totalBRL) * 100 : 0;

    return {
      name: sectorName,
      target: sectorTargetOf(sectorName),
      savedTarget: storedSectorTargets.get(sectorName) ?? 0,
      currentPct: classTotalBRL > 0 ? (sectorBRL / classTotalBRL) * 100 : 0,
      currentSuffix: "da classe",
      secondaryPctText: `${pctInPortfolio.toFixed(1)}% total`,
      membersCount: members.length,
      stepperAriaLabel: `Meta do setor ${sectorName} em % da classe`,
      detailAriaLabel: `Ver detalhes de ${sectorName}`,
      detailIcon: <PieChart className="size-3.5" aria-hidden="true" />,
      onOpenDetail: onOpenSectorDetail
        ? () => onOpenSectorDetail(sectorName, activeSectorClass)
        : undefined,
    };
  });

  return (
    <TargetDistributionCard
      ariaLabel="Metas por setor"
      title="Metas setoriais por classe"
      description={`Opcional: defina a proporção (% dentro de ${activeSectorClass}). Se não configurar setores nesta classe, o peso vai direto para as Notas dos ativos.`}
      headerRight={
        sectorSum.sum === 0 && availableSectors.length > 0 ? (
          <Badge variant="muted" size="xs">
            Opcional (direto para Notas)
          </Badge>
        ) : undefined
      }
      classSelector={{
        classes,
        activeClass: activeSectorClass,
        onSelectClass: onSelectSectorClass,
      }}
      emptyMessage={
        <>
          Nenhum ativo com setor cadastrado na classe{" "}
          <strong className="text-foreground">{activeSectorClass}</strong>. Cadastre ativos nesta
          classe para definir suas metas setoriais.
        </>
      }
      donutTitle={`Alocação Setorial (${activeSectorClass})`}
      items={items}
      sumState={sectorSum}
      savingItemKey={savingSector}
      normalizeLabel="Normalizar setores para 100%"
      resetLabel="Zerar setores"
      saveAllLabel={`Salvar setores de ${activeSectorClass}`}
      savingAllLabel="Salvando todos…"
      onNormalize={onNormalizeSectors}
      onDistributeEqually={onDistributeSectorsEqually}
      onResetZero={onResetSectorsZero}
      onTargetChange={onSectorTargetChange}
      onSaveItem={onSaveSector}
      onRemoveItem={onRemoveSector}
      onSaveAll={onSaveAllSectorsForClass}
    />
  );
}
