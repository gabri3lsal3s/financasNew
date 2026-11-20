import { ShieldCheck } from "lucide-react";

/**
 * Alerta Permanente de Conformidade Regulatória CVM (Resoluções CVM 19 e 20).
 * Renderizado como nota de rodapé discreta para desobstruir o fluxo do simulador.
 */
export function CvmDisclaimerBanner() {
  return (
    <footer
      aria-label="Isenção regulatória CVM"
      className="flex items-start gap-2 pt-3 border-t border-border/30 text-[11px] text-muted-foreground/70 leading-relaxed"
    >
      <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground/60 mt-0.5" aria-hidden="true" />
      <div className="space-y-0.5 min-w-0">
        <p className="font-medium text-foreground/70 text-[11px]">
          Isenção Regulatória CVM (Resoluções CVM nº 19/2021 e nº 20/2021)
        </p>
        <p className="leading-normal text-[10px] sm:text-[11px]">
          Esta ferramenta opera como mero instrumento tecnológico de consolidação matemática e orçamentária. Todas as sugestões de rebalanceamento são derivadas puramente das metas definidas por você, não configurando análise de valores mobiliários, consultoria financeira ou recomendação de compra e venda de ativos.
        </p>
      </div>
    </footer>
  );
}
