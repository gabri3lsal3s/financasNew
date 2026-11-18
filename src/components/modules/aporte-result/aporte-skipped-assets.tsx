import { Info } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { SkippedAssetDiagnostic } from "@/domain/portfolio";

const SKIPPED_REASON_LABEL: Record<
  SkippedAssetDiagnostic["reason"],
  { label: string; variant: "warning" | "muted" }
> = {
  no_price: { label: "Sem cotação", variant: "warning" },
  above_target: { label: "Na meta", variant: "muted" },
  no_target: { label: "Sem meta", variant: "muted" },
  price_exceeds_budget: { label: "Preço > Saldo", variant: "muted" },
  quarantine: { label: "Em quarentena", variant: "warning" },
  exit: { label: "Saída da carteira", variant: "warning" },
  neutral: { label: "Mantido (neutro)", variant: "muted" },
  insufficient_aporte: { label: "Aporte insuficiente", variant: "muted" },
};

export interface AporteSkippedAssetsProps {
  skippedAssets: SkippedAssetDiagnostic[];
}

export function AporteSkippedAssets({ skippedAssets }: AporteSkippedAssetsProps) {
  if (skippedAssets.length === 0) return null;

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="skipped-assets" className="border-border/80 bg-surface">
        <AccordionTrigger className="px-3.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-1.5">
            <Info className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Ativos não contemplados neste aporte ({skippedAssets.length})</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3.5 pb-3 pt-1">
          <div className="flex flex-wrap gap-2 border-t border-border/50 pt-2.5">
            {skippedAssets.map((asset) => {
              const config = SKIPPED_REASON_LABEL[asset.reason] ?? {
                label: asset.reason,
                variant: "muted" as const,
              };
              return (
                <div
                  key={asset.assetId}
                  className="flex items-center gap-1.5 rounded-lg bg-surface-raised px-2.5 py-1 text-xs"
                  title={asset.detail}
                >
                  <span className="font-mono font-medium text-foreground">{asset.ticker}</span>
                  <Badge variant={config.variant} size="xs">
                    {config.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
