/**
 * Drawer / Modal da Trilha de Decisão (Overflow Ledger) — §Fase 6 do Plano Mestre.
 *
 * Registra e detalha a memória de cálculo do motor hierárquico em camadas:
 * 1. Eventos de saturação de tetos e transbordamento (waterfilling);
 * 2. Ativos em salvaguarda prudencial (soft locks e travas de concentração);
 * 3. Destinação de resíduos orçamentários.
 *
 * Em conformidade estrita com as regras de governança de UI do AGENTS.md.
 */

import { ArrowRight, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MoneyText } from "@/components/ui/money-text";
import type {
  AporteOverflowEvent,
  PausedAssetDiagnostic,
} from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";

export interface AporteOverflowLedgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overflowEvents?: readonly AporteOverflowEvent[];
  pausedAssets?: readonly PausedAssetDiagnostic[];
  totalAllocatedBRL: number;
  leftoverBRL: number;
}

const OVERFLOW_LABELS: Record<AporteOverflowEvent["type"], { label: string; variant: "warning" | "muted" | "critical" }> = {
  sector_saturated: { label: "Teto Setorial", variant: "warning" },
  class_saturated: { label: "Teto de Classe", variant: "warning" },
  asset_ceiling: { label: "Teto Individual", variant: "critical" },
  macro_sector_ceiling: { label: "Teto Macro-Setor", variant: "warning" },
  issuer_ceiling: { label: "Teto Emissor FGC", variant: "critical" },
};

const PAUSED_REASON_LABELS: Record<PausedAssetDiagnostic["reason"], string> = {
  quality_lock: "Nota Baixa / Onboarding (≤ 5)",
  asset_ceiling: "Teto Individual (15%)",
  sector_ceiling: "Teto Setorial (35%)",
  macro_sector_ceiling: "Teto Macro-Setor (45%)",
  issuer_ceiling: "Teto Emissor RF (FGC / 30%)",
};

export function AporteOverflowLedgerDrawer({
  open,
  onOpenChange,
  overflowEvents = [],
  pausedAssets = [],
  totalAllocatedBRL,
  leftoverBRL,
}: AporteOverflowLedgerDrawerProps) {
  const hasOverflows = overflowEvents.length > 0;
  const hasPaused = pausedAssets.length > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Trilha de Decisão & Overflow Ledger"
      description="Auditoria transparente do motor de rebalanceamento hierárquico em camadas."
      footer={
        <div className="flex items-center justify-end w-full">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            Concluir Leitura
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-1">
        {/* Sumário de Auditoria */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface-raised p-3 shadow-xs min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              Total Alocado
            </span>
            <MoneyText cents={numberToCents(totalAllocatedBRL)} tone="portfolio" className="text-base font-bold" />
          </div>

          <div className="flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface-raised p-3 shadow-xs min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              Transbordamentos
            </span>
            <span className="text-base font-bold text-foreground font-mono tabular-nums">
              {overflowEvents.length} {overflowEvents.length === 1 ? "evento" : "eventos"}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 flex flex-col gap-0.5 rounded-xl border border-border/80 bg-surface-raised p-3 shadow-xs min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">
              Preservado em Caixa
            </span>
            <MoneyText
              cents={numberToCents(leftoverBRL)}
              tone={leftoverBRL > 0 ? "portfolio" : "default"}
              className="text-base font-bold"
            />
          </div>
        </div>

        {/* Seção 1: Eventos de Transbordamento (Waterfilling) */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">
                Eventos de Transbordamento ({overflowEvents.length})
              </h4>
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0 font-sans">
              Cascata em camadas
            </span>
          </div>

          {hasOverflows ? (
            <div className="flex flex-col gap-2.5">
              {overflowEvents.map((evt, idx) => {
                const conf = OVERFLOW_LABELS[evt.type] ?? { label: "Transbordamento", variant: "muted" };
                return (
                  <div
                    key={`${evt.sourceId}-${idx}`}
                    className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <Badge variant={conf.variant} size="xs" className="shrink-0 font-medium">
                          {conf.label}
                        </Badge>
                        <span className="font-semibold text-foreground truncate">{evt.sourceLabel}</span>
                        {evt.targetLabel ? (
                          <>
                            <ArrowRight className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                            <span className="font-medium text-portfolio-strong truncate">
                              {evt.targetLabel}
                            </span>
                          </>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 font-mono">
                        <span className="text-muted-foreground text-[11px]">Transbordou:</span>
                        <MoneyText cents={numberToCents(evt.amountBRL)} tone="portfolio" className="font-semibold" />
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {evt.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface-raised p-3.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground">Alocação Direta sem Transbordamento</span>
                <span>
                  Todas as compras sugeridas foram absorvidas diretamente pelos ativos e setores deficitários prioritários,
                  sem que nenhum limite máximo de concentração fosse violado.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Seção 2: Ativos com Salvaguarda Prudencial / Travados */}
        {hasPaused ? (
          <div className="flex flex-col gap-3 min-w-0 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldAlert className="size-4 text-warning-strong shrink-0" aria-hidden="true" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">
                  Ativos com Alocação Pausada ({pausedAssets.length})
                </h4>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                Proteção prudencial
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {pausedAssets.map((p) => (
                <div
                  key={p.assetId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface p-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-foreground truncate">{p.ticker}</span>
                    <Badge variant="muted" size="xs" className="shrink-0">
                      {PAUSED_REASON_LABELS[p.reason] ?? "Pausado"}
                    </Badge>
                    {p.score !== null && p.score !== undefined ? (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        Nota {p.score}/10
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[11px] text-muted-foreground truncate" title={p.detail}>
                    {p.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
