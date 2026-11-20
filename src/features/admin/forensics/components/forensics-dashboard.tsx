/**
 * Dashboard do Laboratório Forense de Auditoria Quantitativa (forensics-dashboard.tsx).
 *
 * Interface Administrativa de Auditoria Sintética e Contínua.
 * Conforme AGENTS.md (Regras de Ouro DRY, sem emojis, tokens semânticos).
 */

import { useState } from "react";
import {
  Activity,
  FileCheck2,
  Layers,
  Microscope,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge, Button, Card, Tabs, type TabItem } from "@/components/ui";
import { runForensicAudit } from "../core/runner";
import type { ForensicAuditReport } from "../core/types";
import { ForensicsInvariantsList } from "./forensics-invariants-list";
import { ForensicsPersonaSelector } from "./forensics-persona-selector";
import { ForensicsSnapshotInspector } from "./forensics-snapshot-inspector";
import { ForensicsArtifactsPanel } from "./forensics-artifacts-panel";
import { ForensicsJourneysInspector } from "./forensics-journeys-inspector";
import { ForensicsKpiGrid } from "./forensics-kpi-grid";

export function ForensicsDashboard() {
  const [report, setReport] = useState<ForensicAuditReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const handleRunAudit = async (personaId?: string) => {
    setIsRunning(true);
    try {
      const res = await runForensicAudit({
        environment: "synthetic",
        personaIds: personaId ? [personaId] : undefined,
      });
      setReport(res);
    } finally {
      setIsRunning(false);
    }
  };

  const allResults = report ? report.personas.flatMap((p) => p.results) : [];

  const tabItems: TabItem[] = [
    {
      value: "overview",
      label: "Visão Geral & Scores",
      icon: <Activity className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-6 w-full pt-4">
          {report ? (
            <>
              <ForensicsKpiGrid report={report} />
              {/* Painel de Download de Artefatos */}
              <ForensicsArtifactsPanel report={report} />
            </>
          ) : (
            <Card className="border-border/80 bg-surface shadow-xs p-8 flex flex-col items-center justify-center text-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary-strong">
                <Sparkles className="size-7" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="text-base font-bold text-foreground">
                  Laboratório Forense Pronto para Disparo
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Execute a bateria de testes de invariantes para auditar a integridade matemática de
                  investimentos, proventos, cartões de crédito, modo viagem, insights e fluxo de caixa.
                </p>
              </div>
              <Button size="sm" onClick={() => handleRunAudit()} className="gap-2 cursor-pointer mt-2 text-xs">
                <Play className="size-4" aria-hidden="true" />
                <span>Disparar Auditoria Agora</span>
              </Button>
            </Card>
          )}
        </div>
      ),
    },
    {
      value: "invariants",
      label: "Invariantes Forenses",
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      badge: report ? (
        <Badge variant={report.totalFailed === 0 ? "positive" : "critical"} size="xs">
          {report.totalPassed}/{report.totalAssertions}
        </Badge>
      ) : undefined,
      content: (
        <div className="flex flex-col gap-6 w-full pt-4">
          {report ? (
            <ForensicsInvariantsList results={allResults} />
          ) : (
            <Card className="border-border/80 bg-surface shadow-xs p-6 text-center text-xs text-muted-foreground">
              Dispare a auditoria para inspecionar os resultados individuais de cada uma das 39 invariantes.
            </Card>
          )}
        </div>
      ),
    },
    {
      value: "journeys",
      label: "Ciclo de Vida & Transições",
      icon: <Layers className="size-4" aria-hidden="true" />,
      badge: report?.journeys ? (
        <Badge variant={report.journeys.every((j) => j.passed) ? "positive" : "critical"} size="xs">
          {report.journeys.filter((j) => j.passed).length}/{report.journeys.length}
        </Badge>
      ) : undefined,
      content: (
        <ForensicsJourneysInspector journeys={report?.journeys} />
      ),
    },
    {
      value: "personas",
      label: "Personas Teóricas",
      icon: <Users className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-6 w-full pt-4">
          <ForensicsPersonaSelector onRunPersona={(id) => handleRunAudit(id)} isRunning={isRunning} />

          {report && report.personas.length > 0 && (
            <Card className="border-border/80 bg-surface shadow-xs">
              <div className="p-4 border-b border-border/60 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <FileCheck2 className="size-4 text-primary" aria-hidden="true" />
                  <span>Última Execução por Persona</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {report.personas.length} personas processadas
                </span>
              </div>
              <div className="p-4 pt-0">
                <div className="flex flex-col divide-y divide-border/60">
                  {report.personas.map((p) => (
                    <div
                      key={p.personaId}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">{p.personaName}</span>
                        <span className="text-[11px] text-muted-foreground">{p.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {p.executionTimeMs}ms
                        </span>
                        <Badge variant={p.failedCount === 0 ? "positive" : "critical"} size="xs">
                          {p.failedCount === 0 ? "100% Aprovado" : `${p.failedCount} Falhas`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      ),
    },
    {
      value: "snapshot",
      label: "Snapshot Real",
      icon: <Microscope className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-6 w-full pt-4">
          <ForensicsSnapshotInspector />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Barra de Controle de Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-surface shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong">
            <Activity className="size-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                Motor Forense de Invariantes
              </span>
              <Badge variant={report ? "positive" : "muted"} size="xs">
                {report ? "Auditado (100%)" : "Pronto"}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Execução isomórfica em memória · Precisão estrita de centavo
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleRunAudit()}
            disabled={isRunning}
            className="gap-2 cursor-pointer text-xs"
          >
            {isRunning ? (
              <RotateCcw className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            <span>{isRunning ? "Auditando…" : "Disparar Auditoria"}</span>
          </Button>
        </div>
      </div>

      {/* Navegação por Abas com Conteúdo Integrado */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={tabItems}
        variant="pills"
        className="w-full"
      />
    </div>
  );
}
