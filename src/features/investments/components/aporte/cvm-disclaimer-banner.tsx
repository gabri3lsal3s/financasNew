import { ShieldCheck } from "lucide-react";

/**
 * Alerta Permanente de Conformidade Regulatória CVM (Resoluções CVM 19 e 20).
 */
export function CvmDisclaimerBanner() {
  return (
    <aside
      aria-label="Isenção regulatória CVM"
      className="flex items-start gap-3 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs text-xs text-muted-foreground"
    >
      <ShieldCheck className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
      <div className="space-y-1 leading-relaxed">
        <p className="font-semibold text-foreground text-xs">
          Isenção Regulatória CVM (Resoluções CVM nº 19/2021 e nº 20/2021)
        </p>
        <p className="text-[11px] leading-relaxed">
          Esta ferramenta opera como mero instrumento tecnológico de consolidação matemática e orçamentária.
          Todas as sugestões de rebalanceamento e alocação são derivadas puramente de formulações algorítmicas
          parametrizadas pelas metas e percentuais definidos discricionariamente por você, não configurando
          análise de valores mobiliários, consultoria financeira ou recomendação de compra e venda de ativos.
          A decisão de alocação e a transmissão de ordens cabem exclusivamente ao titular perante sua respectiva corretora.
        </p>
      </div>
    </aside>
  );
}
