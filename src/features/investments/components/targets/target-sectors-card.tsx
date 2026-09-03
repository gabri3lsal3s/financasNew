import { useState } from "react";
import { Equal, PieChart, RotateCcw, Scale, Trash2 } from "lucide-react";
import { Badge, Button, NumberStepperInput } from "@/components/ui";
import { InteractiveTargetDonut, type TargetDonutItem } from "@/components/modules";
import { inferSectorFromTicker, parseTargetInput } from "@/domain/portfolio";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { PortfolioPositionRow } from "@/state";

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
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  if (classes.length === 0) return null;

  const totalBRL = positionRows.reduce((acc, r) => acc + r.valueBRL, 0);
  const classTotalBRL = positionRows
    .filter((r) => r.assetClass === activeSectorClass)
    .reduce((acc, r) => acc + r.valueBRL, 0);

  const sectorValueBRL = (sec: string) =>
    positionRows
      .filter(
        (r) =>
          r.assetClass === activeSectorClass &&
          (r.sector === sec || inferSectorFromTicker(r.ticker, activeSectorClass) === sec),
      )
      .reduce((acc, r) => acc + r.valueBRL, 0);

  const sectorCurrentPctInClass = (sec: string) =>
    classTotalBRL > 0 ? (sectorValueBRL(sec) / classTotalBRL) * 100 : 0;
  const sectorCurrentPctInPortfolio = (sec: string) =>
    totalBRL > 0 ? (sectorValueBRL(sec) / totalBRL) * 100 : 0;

  const donutItems: TargetDonutItem[] = availableSectors.map((sectorName) => ({
    key: sectorName,
    label: sectorName,
    targetPercent: sectorTargetOf(sectorName),
    currentPercent: sectorCurrentPctInClass(sectorName),
    countAssets: positionRows.filter(
      (r) =>
        r.assetClass === activeSectorClass &&
        (r.sector === sectorName || inferSectorFromTicker(r.ticker, activeSectorClass) === sectorName),
    ).length,
  }));

  return (
    <section
      aria-label="Metas por setor"
      className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
    >
      <div className="flex items-center justify-between min-w-0">
        <div>
          <h3 className="text-sm font-semibold text-foreground truncate">Metas setoriais por classe</h3>
          <p className="text-xs text-muted-foreground">
            Defina a proporção relativa (% da classe) de cada setor / segmento.
          </p>
        </div>
      </div>

      {/* Seletor de Classe Ativa para os Setores */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
        <span className="text-xs font-medium text-muted-foreground mr-1">Classe:</span>
        {classes.map((cls) => (
          <button
            key={cls}
            type="button"
            onClick={() => {
              onSelectSectorClass(cls);
              triggerSensory("selection");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              activeSectorClass === cls
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-surface-hover/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {cls}
          </button>
        ))}
      </div>

      {availableSectors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
          Nenhum ativo com setor cadastrado na classe <strong className="text-foreground">{activeSectorClass}</strong>. Cadastre ativos nesta classe para definir suas metas setoriais.
        </div>
      ) : (
        <>
          {/* Donut Interativo de Metas Setoriais */}
          <InteractiveTargetDonut
            title={`Alocação Setorial (${activeSectorClass})`}
            items={donutItems}
            selectedKey={selectedSector}
            onSelectKey={setSelectedSector}
            onChangeTarget={(sectorName, nextTarget) => onSectorTargetChange(sectorName, nextTarget)}
            totalCeiling={100}
            unitLabel="%"
            disabled={savingSector !== null}
          />

          {/* Validação de Erro dos Setores da Classe */}
          {sectorSum.error ? (
            <div className="rounded-xl border border-critical/40 bg-critical/10 p-3 text-xs text-critical font-medium">
              {sectorSum.error}
            </div>
          ) : null}

          {/* Ações Rápidas de Setores */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onNormalizeSectors}
              disabled={savingSector !== null}
              className="gap-1.5 text-xs"
            >
              <Scale className="size-3.5 shrink-0" aria-hidden="true" />
              Normalizar setores para 100%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDistributeSectorsEqually}
              disabled={savingSector !== null}
              className="gap-1.5 text-xs"
            >
              <Equal className="size-3.5 shrink-0" aria-hidden="true" />
              Distribuir igualmente (1/N)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetSectorsZero}
              disabled={savingSector !== null}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
              Zerar setores
            </Button>
          </div>

          {/* Lista de Setores */}
          <div className="flex flex-col gap-2 min-w-0">
            {availableSectors.map((sectorName) => {
              const target = sectorTargetOf(sectorName);
              const currentPctInClass = sectorCurrentPctInClass(sectorName);
              const currentPctInPortfolio = sectorCurrentPctInPortfolio(sectorName);
              const gap = target - currentPctInClass;
              const savedTarget = storedSectorTargets.get(sectorName) ?? 0;
              const isSelected = selectedSector === sectorName;
              const membersCount = positionRows.filter(
                (r) =>
                  r.assetClass === activeSectorClass &&
                  (r.sector === sectorName || inferSectorFromTicker(r.ticker, activeSectorClass) === sectorName),
              ).length;

              return (
                <div
                  key={sectorName}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between min-w-0 transition-all",
                    isSelected
                      ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                      : "border-border/60 bg-surface-hover/30 hover:border-border/80",
                  )}
                >
                  <div
                    className="flex min-w-0 flex-1 flex-col gap-1 cursor-pointer"
                    onClick={() => setSelectedSector(isSelected ? null : sectorName)}
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{sectorName}</p>
                      {onOpenSectorDetail && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSectorDetail(sectorName, activeSectorClass);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
                          title={`Ver detalhes de ${sectorName}`}
                          aria-label={`Ver detalhes de ${sectorName}`}
                        >
                          <PieChart className="size-3.5 text-muted-foreground hover:text-foreground" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-mono text-muted-foreground">
                        Atual: <strong className="text-foreground font-semibold">{currentPctInClass.toFixed(1)}%</strong> da classe
                        <span className="text-muted-foreground/70 font-normal"> ({currentPctInPortfolio.toFixed(1)}% total)</span>
                      </span>
                      <span className="text-muted-foreground/60">·</span>
                      <span className="font-mono text-muted-foreground">
                        Meta: <strong className="text-foreground font-semibold">{target.toFixed(1)}%</strong>
                      </span>
                      {target > 0 && (
                        <Badge
                          variant={gap > 0 ? "positive" : "muted"}
                          size="xs"
                          className="font-mono text-[10px]"
                        >
                          {gap > 0 ? `+${gap.toFixed(1)}% (Aporte)` : `${gap.toFixed(1)}% (Acima)`}
                        </Badge>
                      )}
                      <span className="text-muted-foreground/60">·</span>
                      <span className="text-muted-foreground">
                        {membersCount} ativo(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <div
                      className="flex flex-1 items-center gap-2 sm:w-52 sm:flex-none min-w-0"
                      onFocusCapture={() => setSelectedSector(sectorName)}
                    >
                      <NumberStepperInput
                        value={target}
                        min={0}
                        max={100}
                        step={0.5}
                        ariaLabel={`Meta do setor ${sectorName} em % da classe`}
                        onValueChange={(next) => onSectorTargetChange(sectorName, parseTargetInput(next))}
                        className="flex-1 min-w-0 [&_input]:text-right"
                      />
                      <span className="shrink-0 text-sm font-semibold text-muted-foreground select-none">%</span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={target > 0 ? "secondary" : "outline"}
                        disabled={savingSector === sectorName || savingSector === "all"}
                        onClick={() => onSaveSector(sectorName)}
                      >
                        {savingSector === sectorName ? "Salvando…" : "Salvar"}
                      </Button>
                      {savedTarget > 0 ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover meta do setor ${sectorName}`}
                          disabled={savingSector === sectorName || savingSector === "all"}
                          onClick={() => onRemoveSector(sectorName)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botão de Salvar Todos os Setores da Classe */}
          <div className="flex items-center justify-end pt-2">
            <Button
              type="button"
              onClick={onSaveAllSectorsForClass}
              disabled={savingSector !== null || sectorSum.error !== null}
            >
              {savingSector === "all" ? "Salvando todos…" : `Salvar setores de ${activeSectorClass}`}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
