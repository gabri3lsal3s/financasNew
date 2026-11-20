/**
 * Grade de KPIs e Cobertura por Módulo de Negócio do Laboratório Forense.
 * Co-localizado e extraído de forensics-dashboard.tsx para cumprir a Dimensão 14 (< 250 linhas).
 */

import { Check, CheckCircle2, Clock, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { ForensicAuditReport } from "../core/types";

export interface ForensicsKpiGridProps {
  report: ForensicAuditReport;
}

export function ForensicsKpiGrid({ report }: ForensicsKpiGridProps) {
  const moduleEntries = Object.values(report.moduleScores);

  return (
    <div className="flex flex-col gap-6 w-full">
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
    </div>
  );
}
