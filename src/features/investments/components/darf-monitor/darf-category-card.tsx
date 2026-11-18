import { Badge, MoneyText, type BadgeProps } from "@/components/ui";

export interface DarfCategoryCardProps {
  title: string;
  badgeLabel: string;
  badgeVariant: BadgeProps["variant"];
  salesVolumeCents: number;
  grossProfitLabel?: string;
  grossProfitCents: number;
  taxDueCents?: number;
  taxDueFallbackText?: string;
}

/**
 * Cartão padronizado de apuração fiscal mensal por classe (Ações, FIIs, ETFs/BDRs, Exterior).
 */
export function DarfCategoryCard({
  title,
  badgeLabel,
  badgeVariant,
  salesVolumeCents,
  grossProfitLabel = "Lucro Bruto:",
  grossProfitCents,
  taxDueCents = 0,
  taxDueFallbackText,
}: DarfCategoryCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
        <strong className="text-xs font-semibold text-foreground">{title}</strong>
        <Badge variant={badgeVariant} size="xs" className="max-w-full truncate">
          {badgeLabel}
        </Badge>
      </div>

      <div className="flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span>Volume de Vendas:</span>
          <MoneyText cents={salesVolumeCents} tone="default" />
        </div>
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span>{grossProfitLabel}</span>
          <MoneyText cents={grossProfitCents} tone="auto" />
        </div>
        <div className="flex items-center justify-between gap-2 font-medium pt-1.5 border-t border-border/50">
          <span className="text-foreground">{taxDueFallbackText ? "DARF Mensal:" : "Imposto Devido:"}</span>
          {taxDueFallbackText ? (
            <span className="text-muted-foreground text-xs">{taxDueFallbackText}</span>
          ) : (
            <MoneyText cents={taxDueCents} tone={taxDueCents > 0 ? "negative" : "default"} />
          )}
        </div>
      </div>
    </div>
  );
}
