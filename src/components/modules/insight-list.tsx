import type { CalibrationDecision, FeedbackDecision } from "@/domain/insights";
import {
  InsightListRow,
  type InsightListItemBadge,
  type InsightListItemData,
} from "./insight-list/InsightListRow";

export type { InsightListItemBadge, InsightListItemData };

export interface InsightListProps {
  items: readonly InsightListItemData[];
  /** Estado de feedback por chave (ignore/confirm ou motivos qualificados). */
  feedback?: Record<string, FeedbackDecision>;
  onIgnore?: (key: string) => void;
  /** Callback para calibração ou descarte com micro-feedback qualificado (§F23). */
  onIgnoreWithReason?: (key: string, reason: CalibrationDecision) => void;
  onConfirm?: (key: string) => void;
  onRestore?: (key: string) => void;
  /** Callback ao clicar na linha da ocorrência (drill-down e auditoria). */
  onItemClick?: (key: string) => void;
  /** Callback para conversão da ocorrência em recorrência formal (Fase 32). */
  onConvert?: (key: string) => void;
  emptyLabel?: string;
  /** Formatação do valor (default BRL). */
  formatAmount?: (cents: number) => string;
}

/**
 * Lista de descobertas do motor de insights (§3.7.2/.3) — assinaturas e
 * recorrências com confiança e ações de aprendizado unificadas
 * (ignorar/confirmar/restaurar) + suporte a drill-down em modal de auditoria.
 */
export function InsightList({
  items,
  feedback = {},
  onIgnore,
  onIgnoreWithReason,
  onConfirm,
  onRestore,
  onItemClick,
  onConvert,
  emptyLabel = "Nenhuma ocorrência encontrada.",
  formatAmount,
}: InsightListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/80 bg-surface p-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <InsightListRow
          key={item.key}
          item={item}
          state={feedback[item.key]}
          onIgnore={onIgnore}
          onIgnoreWithReason={onIgnoreWithReason}
          onConfirm={onConfirm}
          onRestore={onRestore}
          onItemClick={onItemClick}
          onConvert={onConvert}
          formatAmount={formatAmount}
        />
      ))}
    </ul>
  );
}
