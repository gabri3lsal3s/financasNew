import { Monitor, Smartphone, Zap, CheckCircle2, ShieldCheck, Layers } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { ScrollReveal } from "./scroll-reveal";

interface PlatformFeature {
  name: string;
  web: boolean | string;
  pwa: boolean | string;
  androidPro: boolean | string;
}

const features: PlatformFeature[] = [
  {
    name: "Lançamento e consulta de receitas e despesas",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Caixa Real Seguro (Safe-to-Spend) e Daily Budget",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Rebalanceamento determinístico de aportes",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Simulador de Independência Financeira (FIRE)",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Instalação instantânea na tela inicial sem lojas",
    web: false,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Compatível com iPhone (iOS Safari)",
    web: true,
    pwa: true,
    androidPro: "Via PWA",
  },
  {
    name: "Biometria física nativa e Privacy Shield",
    web: false,
    pwa: "PIN local",
    androidPro: true,
  },
  {
    name: "Assistente Bancário Inteligente (captura de Pix e cartões)",
    web: false,
    pwa: false,
    androidPro: true,
  },
  {
    name: "Atalhos rápidos na barra de status e launcher",
    web: false,
    pwa: false,
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
                    <span>Telas amplas para visualização completa de faturas e relatórios</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Simulações interativas de independência financeira (FIRE)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Exportação de auditorias completas em planilhas Excel</span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          {/* Card 2: PWA Mobile */}
          <ScrollReveal delay={100}>
            <Card className="h-full border-border/80 bg-surface/90 shadow-xs p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-background border border-border/60 text-muted-foreground">
                    <Smartphone className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="muted" size="xs">
                    iPhone & Android
                  </Badge>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Mobile PWA</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Acesso instantâneo e leve sem consumir armazenamento no seu celular.
                  </p>
                </div>
                <div className="pt-2 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Fixa na tela inicial em 1 clique sem precisar baixar megabytes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Compatibilidade perfeita com iPhone (Safari) e navegadores móveis</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Carregamento instantâneo do App Shell mesmo com conexão instável</span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          {/* Card 3: Android App Pro */}
          <ScrollReveal delay={150}>
            <Card className="h-full border-primary/40 bg-gradient-to-b from-primary/10 via-surface to-surface shadow-sm p-5 sm:p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Zap className="size-5" aria-hidden="true" />
                  </div>
                  <Badge variant="positive" size="xs" className="font-semibold">
                    Superpoderes
                  </Badge>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Android App Pro</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    A experiência definitiva com detecção automática de compras bancárias.
                  </p>
                </div>
                <div className="pt-2 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Assistente Bancário Inteligente: captura Pix e cartões em tempo real</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Aprovação de despesas em 1 toque sem precisar digitar valores</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-positive shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Biometria física, atalhos rápidos e atualizações in-app automáticas</span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>
        </div>

        {/* Tabela de Recursos Detalhada */}
        <ScrollReveal delay={200} className="mt-12">
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-surface">
            <table className="w-full text-left text-xs sm:text-sm">
              <caption className="sr-only">Matriz comparativa de funcionalidades por plataforma</caption>
              <thead className="border-b border-border/60 bg-background/50 font-semibold text-foreground">
                <tr>
                  <th scope="col" className="p-3.5 sm:p-4">Funcionalidade</th>
                  <th scope="col" className="p-3.5 sm:p-4 text-center">Web Desktop</th>
                  <th scope="col" className="p-3.5 sm:p-4 text-center">Mobile PWA</th>
                  <th scope="col" className="p-3.5 sm:p-4 text-center bg-primary/5">Android App Pro</th>
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
                          <span className="text-muted-foreground/40">-</span>
                        )
                      ) : (
                        <span className="font-semibold text-foreground">{f.web}</span>
                      )}
                    </td>
                    <td className="p-3.5 sm:p-4 text-center">
                      {typeof f.pwa === "boolean" ? (
                        f.pwa ? (
                          <CheckCircle2 className="size-4 text-positive mx-auto" aria-hidden="true" />
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )
                      ) : (
                        <span className="font-semibold text-foreground">{f.pwa}</span>
                      )}
                    </td>
                    <td className="p-3.5 sm:p-4 text-center bg-primary/5">
                      {typeof f.androidPro === "boolean" ? (
                        f.androidPro ? (
                          <CheckCircle2 className="size-4 text-positive-strong mx-auto" aria-hidden="true" />
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )
                      ) : (
                        <span className="font-semibold text-primary">{f.androidPro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
