import { MousePointerClick, RotateCcw, Scale, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui";

const TERMS_HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: "30 Dias de Teste",
    description:
      "Acesso Pro completo sem pedir cartão de crédito. Seus dados nunca são sequestrados.",
  },
  {
    icon: RotateCcw,
    title: "Arrependimento em 7 Dias",
    description:
      "Estorno integral e imediato nos termos do Art. 49 do CDC, com solicitação simplificada.",
  },
  {
    icon: MousePointerClick,
    title: "Cancelamento em 1 Clique",
    description:
      "Sem carência, sem contratos de fidelidade e sem burocracia na aba de Assinatura.",
  },
  {
    icon: Scale,
    title: "Isenção CVM 19 e 20",
    description:
      "Cálculos de rebalanceamento puramente matemáticos baseados nas metas do titular.",
  },
];

export function TermsHighlightsGrid() {
  return (
    <section aria-labelledby="secao-destaques-contratuais" className="not-prose">
      <h2 id="secao-destaques-contratuais" className="sr-only">
        Destaques e Garantias Contratuais
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TERMS_HIGHLIGHTS.map((item) => (
          <Card key={item.title} className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <item.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>{item.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
