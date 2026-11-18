import type { InsightListItemBadge, InsightListItemData } from "@/components/modules/insight-list";
import {
  RECURRENCE_CADENCE_LABELS,
  SERVICE_SEGMENT_LABELS,
  type RecurrenceOccurrence,
} from "@/domain/insights";
import { RECURRENCE_LEVEL_LABELS } from "@/lib/labels";
import { formatCentsAsBRL } from "@/services/masks/money";

export function mapOccurrenceToInsightItem(o: RecurrenceOccurrence): InsightListItemData {
  const badges: InsightListItemBadge[] = [];

  if (o.cadence === "weekly") {
    badges.push({ label: "Semanal", tone: "default" });
  } else if (o.cadence === "bimonthly") {
    badges.push({ label: "Bimestral", tone: "default" });
  } else if (o.cadence === "quarterly") {
    badges.push({ label: "Trimestral", tone: "default" });
  } else if (o.cadence === "quadrimonthly") {
    badges.push({ label: "Quadrimestral", tone: "default" });
  } else if (o.cadence === "semiannual") {
    badges.push({ label: "Semestral", tone: "default" });
  } else if (o.cadence === "annual") {
    badges.push({ label: "Anual", tone: "default" });
  }

  if (o.cardName) {
    badges.push({ label: o.cardName, tone: "muted" });
  }

  if (o.segment && o.segment !== "other") {
    badges.push({ label: SERVICE_SEGMENT_LABELS[o.segment], tone: "default" });
  }

  if (o.tier === "can_cut") {
    badges.push({ label: "Pode cortar", tone: "positive" });
  } else if (o.tier === "discretionary") {
    badges.push({ label: "Discricionário", tone: "default" });
  } else if (o.tier === "essential") {
    badges.push({ label: "Essencial", tone: "default" });
  }

  if (o.missingThisMonth) {
    badges.push({ label: "Pendente no ciclo", tone: "warning" });
  } else if (o.daysUntilNextDue !== undefined) {
    if (o.daysUntilNextDue === 0) {
      badges.push({ label: "Vence hoje", tone: "warning" });
    } else if (o.daysUntilNextDue > 0 && o.daysUntilNextDue <= 7) {
      badges.push({ label: `Em ${o.daysUntilNextDue}d`, tone: "warning" });
    } else if (o.typicalDayOfMonth) {
      badges.push({ label: `Dia ~${o.typicalDayOfMonth}`, tone: "muted" });
    }
  }

  if (o.priceAdjustment) {
    badges.push({ label: `+${o.priceAdjustment.percentIncrease}% reajuste`, tone: "warning" });
  }

  if (o.duplicateChargesThisMonth && o.duplicateChargesThisMonth > 1) {
    badges.push({ label: `${o.duplicateChargesThisMonth}x no mês`, tone: "warning" });
  }

  const isMultiMonth = Boolean(o.intervalMonths && o.intervalMonths > 1);
  const cadenceLabel = o.cadence ? RECURRENCE_CADENCE_LABELS[o.cadence] : RECURRENCE_LEVEL_LABELS[o.level];

  const subtitle =
    o.cadence === "weekly"
      ? `Semanal (~4x/mês) · Custo consolidado de ${formatCentsAsBRL(o.monthlyConsolidatedCents ?? o.averageCents)}/mês`
      : isMultiMonth
        ? `${cadenceLabel} · ${formatCentsAsBRL(o.averageCents)} a cada ${o.intervalMonths}m · Amortizado ${formatCentsAsBRL(o.monthlyAmortizedCents ?? Math.round(o.averageCents / (o.intervalMonths || 1)))}/mês`
        : `${RECURRENCE_LEVEL_LABELS[o.level]} · ${o.months.length} mês(es)`;

  const amountCents =
    o.cadence === "weekly" && o.monthlyConsolidatedCents != null
      ? o.monthlyConsolidatedCents
      : (o.monthlyAmortizedCents ?? o.averageCents);

  return {
    key: o.key,
    title: o.name,
    subtitle,
    confidence: o.confidence,
    amountCents,
    badges,
  };
}
