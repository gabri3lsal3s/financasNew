import { ShieldCheck } from "lucide-react";

/**
 * Alerta Permanente de Conformidade Regulatória CVM (Resoluções CVM 19 e 20).
 * Renderizado como nota de rodapé discreta para desobstruir o fluxo do simulador.
 */
export function CvmDisclaimerBanner() {
  return (
    <footer
      aria-label="Isenção regulatória CVM"
      className="flex items-start gap-2 pt-4 border-t border-border/40 text-[11px] text-muted-foreground/80 leading-relaxed"
    >
      <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-semibold text-foreground/80 text-xs">
          Isenção Regulatória CVM (Resoluções CVM nº 19/2021 e nº 20/2021)
        </p>
        <p className="leading-relaxed">
          Esta ferramenta opera como mero instrumento tecnológico de consolidação matemática e orçamentária.
          Todas as sugestões de rebalanceamento são derivadas puramente de formulações algorítmicas
          parametrizadas pelas metas definidas por você, não configurando análise de valores mobiliários, consultoria financeira ou recomendação de compra e venda de ativos.
        </p>
      </div>
    </footer>
  );
}
