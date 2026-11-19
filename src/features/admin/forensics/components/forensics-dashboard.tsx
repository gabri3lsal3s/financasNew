/**
 * Dashboard do Laboratório Forense de Auditoria Quantitativa (forensics-dashboard.tsx).
 *
 * Interface Administrativa de Auditoria Sintética e Contínua.
 * Conforme AGENTS.md (Regras de Ouro DRY, sem emojis, tokens semânticos).
 */

import { useState } from "react";
import {
  Activity,
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  Microscope,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Badge, Button, Card, Tabs, type TabItem } from "@/components/ui";
import { runForensicAudit } from "../core/runner";
import type { ForensicAuditReport } from "../core/types";
import { ForensicsInvariantsList } from "./forensics-invariants-list";
import { ForensicsPersonaSelector } from "./forensics-persona-selector";
import { ForensicsSnapshotInspector } from "./forensics-snapshot-inspector";
import { ForensicsArtifactsPanel } from "./forensics-artifacts-panel";

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

  const moduleEntries = report ? Object.values(report.moduleScores) : [];
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
              {/* KPIs de Alto Nível */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <Card className="border-border/80 bg-surface shadow-xs p-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Confiabilidade Geral</span>
                    <ShieldCheck className="size-4 text-positive-strong" aria-hidden="true" />
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {report.overallScore}%
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {report.totalPassed} de {report.totalAssertions} asserções íntegras
                  </span>
                </Card>

                <Card className="border-border/80 bg-surface shadow-xs p-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Asserções Aprovadas</span>
                    <CheckCircle2 className="size-4 text-positive-strong" aria-hidden="true" />
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-positive-strong tabular-nums">
                    {report.totalPassed}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Tolerância zero de desvio</span>
                </Card>

                <Card className="border-border/80 bg-surface shadow-xs p-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Divergências Críticas</span>
                    <ShieldAlert className="size-4 text-critical-strong" aria-hidden="true" />
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {report.totalFailed}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {report.totalFailed === 0
                      ? "Nenhuma quebra de invariante"
                      : "Requer atenção imediata"}
                  </span>
                </Card>

                <Card className="border-border/80 bg-surface shadow-xs p-4 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tempo de Execução</span>
                    <Clock className="size-4 text-primary-strong" aria-hidden="true" />
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {report.durationMs}ms
                  </span>
                  <span className="text-[11px] text-muted-foreground">Sintético em memória</span>
                </Card>
              </div>

              {/* Cobertura por Módulo de Negócio */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Cobertura por Módulo de Negócio
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {moduleEntries.length} módulos monitorados
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {moduleEntries.map((mod) => (
                    <div
                      key={mod.module}
                      className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground truncate" title={mod.label}>
                          {mod.label}
                        </span>
                        <Badge
                          variant={mod.failed === 0 ? "positive" : "critical"}
                          size="xs"
                          className="shrink-0"
                        >
                          {mod.score}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Asserções: {mod.total}</span>
                        <span className="text-positive-strong font-medium flex items-center gap-0.5">
                          <Check className="size-3" aria-hidden="true" />
                          {mod.passed}
                        </span>
                        {mod.failed > 0 && (
                          <span className="text-critical-strong font-medium flex items-center gap-0.5">
                            <X className="size-3" aria-hidden="true" />
                            {mod.failed}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
              Dispare a auditoria para inspecionar os resultados individuais de cada uma das 23 invariantes.
            </Card>
          )}
        </div>
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
