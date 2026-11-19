/**
 * Inspetor Visual de Jornadas de Ciclo de Vida (forensics-journeys-inspector.tsx).
 *
 * Apresenta o diagnóstico passo a passo das 8 Golden User Journeys dos 8 pilares da aplicação.
 * Conforme AGENTS.md (Regras DRY, sem emojis, tipografia tabular, tokens do DESIGN_SYSTEM).
 */

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Compass,
  Layers,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { JourneyExecutionResult } from "../core/journeys/types";

export interface ForensicsJourneysInspectorProps {
  journeys?: readonly JourneyExecutionResult[];
}

export function ForensicsJourneysInspector({ journeys = [] }: ForensicsJourneysInspectorProps) {
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(
    journeys[0]?.journeyId ?? "",
  );

  if (journeys.length === 0) {
    return (
      <Card className="border-border/80 bg-surface shadow-xs p-8 text-center flex flex-col items-center justify-center gap-3">
        <Compass className="size-8 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">
          Nenhuma jornada sintética executada
        </span>
        <span className="text-xs text-muted-foreground max-w-md">
          Dispare a auditoria completa pelo botão de controle acima para inspecionar os passos de transição de estado dos 8 pilares.
        </span>
      </Card>
    );
  }

  const selectedJourney =
    journeys.find((j) => j.journeyId === selectedJourneyId) ?? journeys[0];

  return (
    <div className="flex flex-col gap-6 w-full pt-4">
      {/* Grade de Seletor das 8 Jornadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {journeys.map((j) => {
          const isSelected = j.journeyId === selectedJourney?.journeyId;
          const passedCount = j.steps.filter((s) => s.passed).length;
          const totalCount = j.steps.length;

          return (
            <button
              key={j.journeyId}
              type="button"
              onClick={() => setSelectedJourneyId(j.journeyId)}
              className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col gap-2 cursor-pointer ${
                isSelected
                  ? "border-primary/50 bg-primary/5 shadow-xs"
                  : "border-border/80 bg-surface hover:bg-surface-hover shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="muted" size="xs">
                  {j.pillar}
                </Badge>
                <div className="flex items-center gap-1">
                  {j.passed ? (
                    <CheckCircle2 className="size-3.5 text-positive-strong" aria-hidden="true" />
                  ) : (
                    <XCircle className="size-3.5 text-critical-strong" aria-hidden="true" />
                  )}
                  <span className="text-[11px] font-semibold text-foreground tabular-nums">
                    {passedCount}/{totalCount}
                  </span>
                </div>
              </div>

              <span className="text-xs font-bold text-foreground line-clamp-1">
                {j.name}
              </span>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-1">
                <span className="font-mono">{j.journeyId}</span>
                <span className="tabular-nums">{j.totalDurationMs}ms</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detalhamento Passo a Passo da Jornada Selecionada */}
      {selectedJourney && (
        <Card className="border-border/80 bg-surface shadow-xs p-5 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {selectedJourney.name}
                </span>
                <Badge variant={selectedJourney.passed ? "positive" : "critical"} size="xs">
                  {selectedJourney.passed ? "100% Integra" : "Divergência"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono">ID: {selectedJourney.journeyId}</span>
                <span>Pilar: {selectedJourney.pillar}</span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden="true" />
                  <span className="tabular-nums">{selectedJourney.totalDurationMs}ms</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="muted" size="sm" className="gap-1.5 font-medium">
                <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Zero Escrita no Supabase</span>
              </Badge>
            </div>
          </div>

          {/* Lista de Passos Sequenciais */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Transições de Estado Auditadas ({selectedJourney.steps.length} passos)</span>
            </span>

            <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden">
              {selectedJourney.steps.map((step) => (
                <div
                  key={step.stepNumber}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 bg-surface"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-surface-hover border border-border/80 text-xs font-bold text-muted-foreground tabular-nums mt-0.5">
                      {step.stepNumber}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {step.name}
                        </span>
                        <Badge
                          variant={step.passed ? "positive" : "critical"}
                          size="xs"
                        >
                          {step.passed ? "OK" : "FALHA"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {step.details}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 self-end sm:self-start text-[11px] text-muted-foreground shrink-0 tabular-nums">
                    <Clock className="size-3" aria-hidden="true" />
                    <span>{step.durationMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
