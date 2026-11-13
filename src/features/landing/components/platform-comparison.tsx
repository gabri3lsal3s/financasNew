import { Monitor, Smartphone, Zap, CheckCircle2, ShieldCheck, Layers } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { ScrollReveal } from "./scroll-reveal";

interface PlatformFeature {
  name: string;
  web: boolean | string;
  pwa: boolean | string;
  androidPro: boolean | string;
}

/**
 * Matriz enxuta: apenas os recursos que diferenciam as plataformas.
 * O restante do catálogo aparece resumido em uma linha após a tabela.
 */
const features: PlatformFeature[] = [
  {
    name: "Compartilhar comprovantes de qualquer banco direto no app",
    web: false,
    pwa: false,
    androidPro: true,
  },
  {
    name: "Captura de comprovantes com OCR no dispositivo",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Caixa Real Seguro e orçamento diário",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Rebalanceamento de aportes sem vender ativos",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Instalação na tela inicial sem loja de aplicativos",
    web: false,
    pwa: true,
    androidPro: "Nativo",
  },
  {
    name: "Biometria física (digital ou reconhecimento facial)",
    web: "PIN local",
    pwa: "PIN local",
    androidPro: true,
  },
];

export function PlatformComparison() {
  return (
    <section id="plataformas" className="py-14 md:py-28 border-t border-border/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Cabeçalho */}
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary">
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

        {/* Cards comparativos das 3 plataformas */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Web Desktop */}
          <ScrollReveal delay={50}>
            <Card className="h-full border-border/80 bg-surface/90 shadow-xs p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-background border border-border/60 text-muted-foreground">
                    <Monitor className="size-5" aria-hidden="true" />
                  </div>
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
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Lançamento rápido em tela única e importação com OCR</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Telas amplas para visualização completa de faturas e relatórios</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Simulações interativas de projeção patrimonial e rebalanceamento</span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          {/* Card 2: PWA Mobile (Versão Oficial Recomendada) */}
          <ScrollReveal delay={100}>
            <Card className="h-full border-primary/50 bg-gradient-to-b from-primary/10 via-surface to-surface shadow-sm p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4 ring-1 ring-primary/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Smartphone className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="default" size="xs" className="font-semibold">
                    Oficial Recomendado
                  </Badge>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Mobile PWA</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Instalação instantânea em 1 toque no iPhone, Android e computador sem ocupar memória.
                  </p>
                </div>
                <div className="pt-2 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Acesso a 100% dos motores de cálculo, orçamentos e rebalanceamento de aportes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Fixa direto na tela inicial sem downloads de arquivos pesados ou lojas</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Captura rápida de Pix Copia e Cola, leitura de comprovantes com OCR e Escudo de Privacidade</span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          {/* Card 3: Android App Pro Nativo */}
          <ScrollReveal delay={150}>
            <Card className="h-full border-border/80 bg-surface/90 shadow-xs p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-background border border-border/60 text-muted-foreground">
                    <Zap className="size-5" aria-hidden="true" />
                  </div>
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
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Biometria física por impressão digital e Escudo de Privacidade anti-captura</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Compartilhamento nativo de comprovantes de qualquer banco via Intent</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Atalhos rápidos de launcher, Tile na barra de status e atualizações diretas</span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>
        </div>

        {/* Tabela de Recursos Detalhada */}
        <ScrollReveal delay={200} className="mt-12">
          <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-2xl border border-border/80 bg-surface">
            <table className="w-full min-w-[560px] text-left text-xs sm:text-sm">
              <caption className="sr-only">Matriz comparativa de funcionalidades por plataforma</caption>
              <thead className="border-b border-border/60 bg-background/50 font-semibold text-foreground">
                <tr>
                  <th scope="col" className="p-3.5 sm:p-4">Funcionalidade</th>
                  <th scope="col" className="p-3.5 sm:p-4 text-center">Web Desktop</th>
                  <th scope="col" className="p-3.5 sm:p-4 text-center bg-primary/5">Mobile PWA (Oficial)</th>
                  <th scope="col" className="p-3.5 sm:p-4 text-center">Android App Pro Nativo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-muted-foreground">
                {features.map((f, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3.5 sm:p-4 font-medium text-foreground">{f.name}</td>
                    <td className="p-3.5 sm:p-4 text-center">
                      {typeof f.web === "boolean" ? (
                        f.web ? (
                          <CheckCircle2 className="size-4 text-positive mx-auto" aria-hidden="true" />
                        ) : (
                          <span className="text-muted-foreground font-medium" aria-label="Não disponível">—</span>
                        )
                      ) : (
                        <span className="font-semibold text-foreground">{f.web}</span>
                      )}
                    </td>
                    <td className="p-3.5 sm:p-4 text-center bg-primary/5">
                      {typeof f.pwa === "boolean" ? (
                        f.pwa ? (
                          <CheckCircle2 className="size-4 text-positive-strong mx-auto" aria-hidden="true" />
                        ) : (
                          <span className="text-muted-foreground font-medium" aria-label="Não disponível">—</span>
                        )
                      ) : (
                        <span className="font-semibold text-primary-strong dark:text-primary">{f.pwa}</span>
                      )}
                    </td>
                    <td className="p-3.5 sm:p-4 text-center">
                      {typeof f.androidPro === "boolean" ? (
                        f.androidPro ? (
                          <CheckCircle2 className="size-4 text-positive mx-auto" aria-hidden="true" />
                        ) : (
                          <span className="text-muted-foreground font-medium" aria-label="Não disponível">—</span>
                        )
                      ) : (
                        <span className="font-semibold text-foreground">{f.androidPro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground text-center">
            E mais: Radar Fiscal, Escudo de Privacidade, Facilitador de IRPF, simuladores
            públicos e atalhos de launcher.
          </p>
        </ScrollReveal>

        {/* Rodapé da Seção */}
        <ScrollReveal delay={250} className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-positive" aria-hidden="true" />
            <span>Todos os planos incluem acesso simultâneo às 3 plataformas sem nenhum custo adicional.</span>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
