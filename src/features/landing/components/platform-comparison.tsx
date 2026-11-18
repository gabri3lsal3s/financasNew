import { CheckCircle2, Layers, Monitor, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { ScrollReveal } from "./scroll-reveal";
import { PlatformComparisonTable } from "./platform-comparison-table";

export function PlatformComparison() {
  return (
    <section id="plataformas" className="py-14 md:py-28 border-t border-border/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
            <Layers className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>O Tripé de Plataformas</span>
          </div>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Uma assinatura. Três formas de controlar o seu dinheiro.
          </h2>
          <p className="mt-4 sm:mt-5 text-sm sm:text-lg text-muted-foreground leading-relaxed">
            Tenha a profundidade analítica de uma tela de computador e a conveniência da automação
            em tempo real no bolso. Sem planos fragmentados ou cobranças adicionais por dispositivo.
          </p>
        </ScrollReveal>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScrollReveal delay={50}>
            <Card className="h-full border-border/80 bg-surface shadow-xs p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Monitor className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <Badge variant="muted" size="xs">
                    Computador
                  </Badge>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Web Desktop</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Para análises aprofundadas, conciliação e decisões estratégicas de fim de mês.
                  </p>
                </div>
                <div className="pt-2 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Lançamento rápido em tela única e importação com OCR</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Telas amplas para visualização completa de faturas e relatórios</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Simulações interativas de projeção patrimonial e rebalanceamento</span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <Card className="h-full border-primary/50 bg-surface shadow-sm p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4 ring-1 ring-primary/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Smartphone className="size-5 text-primary-strong dark:text-primary shrink-0" aria-hidden="true" />
                  <Badge variant="default" size="xs" className="font-semibold">
                    Oficial Recomendado
                  </Badge>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Mobile PWA</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Instalação instantânea em 1 toque no iPhone, Android e computador sem ocupar
                    memória.
                  </p>
                </div>
                <div className="pt-2 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      Acesso a 100% dos motores de cálculo, orçamentos e rebalanceamento de aportes
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      Fixa direto na tela inicial sem downloads de arquivos pesados ou lojas
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      Captura rápida de Pix Copia e Cola, leitura de comprovantes com OCR e Escudo
                      de Privacidade
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <Card className="h-full border-border/80 bg-surface shadow-xs p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Zap className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <Badge variant="default" size="xs" className="font-semibold">
                    Nativo Pro
                  </Badge>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Android App Pro</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Experiência nativa em tela cheia com aceleração gráfica e biometria de hardware.
                  </p>
                </div>
                <div className="pt-2 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      Biometria física por impressão digital e Escudo de Privacidade anti-captura
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>Compartilhamento nativo de comprovantes de qualquer banco via Intent</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="size-4 text-positive-strong dark:text-positive shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>
                      Atalhos rápidos de launcher, Tile na barra de status e atualizações diretas
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>
        </div>

        <PlatformComparisonTable />

        <ScrollReveal delay={250} className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-positive-strong dark:text-positive" aria-hidden="true" />
            <span>
              Todos os planos incluem acesso simultâneo às 3 plataformas sem nenhum custo adicional.
            </span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
