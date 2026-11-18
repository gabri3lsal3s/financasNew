import { CheckCircle2, PieChart, Users } from "lucide-react";
import { Badge, Card, MoneyText } from "@/components/ui";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";
import { SharedFinancesShowcase } from "../shared-finances-showcase";

export function PortfolioAndSharedNarratives() {
  return (
    <>
      <div
        id="investimentos"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 xl:gap-20 items-center scroll-mt-24"
      >
        <ScrollReveal delay={50} className="lg:col-span-6 space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-portfolio/30 bg-portfolio/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-portfolio">
            <PieChart className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Eixo 3 · Vetor Patrimonial & Aportes</span>
          </div>

          <h3 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-snug">
            Alocação matemática de aportes e blindagem contra impostos
          </h3>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            Investir com disciplina não é tentar acertar o topo ou fundo do mercado, mas alocar
            capital com consistência sem girar patrimônio desnecessariamente.
          </p>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            O rebalanceamento calcula o destino de cada real do novo aporte para calibrar as
            classes defasadas sem vender ativos. O <strong>Radar Fiscal</strong> acompanha a tabela
            regressiva de IR de Renda Fixa, e você exporta o{" "}
            <strong>Dossiê Executivo em planilha Excel (XML Spreadsheet, 5 abas)</strong> em 1
            clique.
          </p>

          <div className="space-y-2.5 pt-1 text-xs sm:text-sm lg:text-base text-muted-foreground">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Rebalanceamento 100% via novos aportes (zero venda de ativos e zero DARF)</span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Radar de alíquota regressiva de IR para resgates inteligentes de Renda Fixa</span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Dossiê Executivo em planilha Excel (5 abas) e Escudo de Privacidade em 1 clique</span>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={150} className="lg:col-span-6">
          <Card className="border-border/80 bg-surface shadow-xl p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border/60 pb-3 sm:pb-4">
              <div>
                <div className="text-xs sm:text-sm font-bold text-foreground">
                  Sugestão de Aporte Inteligente
                </div>
                <div className="text-[11px] sm:text-xs text-muted-foreground">
                  Aporte Mensal: <MoneyText cents={200000} tone="default" className="font-medium" />
                </div>
              </div>
              <Badge variant="portfolio" size="xs" className="font-mono">
                Aporte calculado
              </Badge>
            </div>

            <div className="space-y-3 sm:space-y-4 pt-1 text-xs sm:text-sm font-mono">
              <div className="space-y-1.5">
                <div className="flex flex-wrap justify-between gap-2 text-muted-foreground text-xs">
                  <span className="font-sans">Renda Fixa IPCA+ (Defasada: 25% vs Meta 35%)</span>
                  <span className="font-bold text-portfolio shrink-0">
                    Aportar <MoneyText cents={140000} hideCents tone="portfolio" /> (70%)
                  </span>
                </div>
                <div className="h-2 sm:h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-positive" style={{ width: "70%" }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap justify-between gap-2 text-muted-foreground text-xs">
                  <span className="font-sans">Fundos Imobiliários FIIs (Defasada: 22% vs Meta 25%)</span>
                  <span className="font-bold text-portfolio shrink-0">
                    Aportar <MoneyText cents={60000} hideCents tone="portfolio" /> (30%)
                  </span>
                </div>
                <div className="h-2 sm:h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-cat-5" style={{ width: "30%" }} />
                </div>
              </div>
            </div>

            <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-warning/30 bg-warning/10 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2">
              <div>
                <div className="font-bold text-foreground">Radar Fiscal (CDB 2024):</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                  Alíquota atual de 20.0% cai para 17.5%
                </div>
              </div>
              <Badge variant="warning" size="xs" className="font-mono shrink-0 self-start sm:self-auto">
                Faltam 14 dias
              </Badge>
            </div>
          </Card>
        </ScrollReveal>
      </div>

      <div
        id="financas-compartilhadas"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 xl:gap-20 items-center scroll-mt-24"
      >
        <ScrollReveal delay={150} className="lg:col-span-6 order-2 lg:order-1">
          <SharedFinancesShowcase />
        </ScrollReveal>

        <ScrollReveal delay={50} className="lg:col-span-6 space-y-4 sm:space-y-6 order-1 lg:order-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
            <Users className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Eixo 4 · Finanças Compartilhadas & Pix</span>
          </div>

          <h3 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-snug">
            Vida financeira compartilhada sem constrangimento e sem planilhas
          </h3>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            Cobrar amigos após um evento ou alinhar despesas domésticas em casal costuma gerar
            desconforto, mensagens perdidas e esquecimento de quem pagou o quê.
          </p>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            O Axir transforma finanças compartilhadas em um fluxo natural:{" "}
            <strong>Racha de Despesas com Pix Copia e Cola</strong> e lembretes automáticos no
            WhatsApp, <strong>Modo Família</strong> com divisão 50/50 sem invasão de privacidade, e
            o <strong>Modo Viagem</strong> com livro-razão público e liquidação mínima via Pix.
          </p>

          <div className="space-y-2.5 pt-1 text-xs sm:text-sm lg:text-base text-muted-foreground">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Racha com Pix Copia e Cola instantâneo e botão de WhatsApp</span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>
                Modo Viagem com link público e senha (amigos participam sem login e sem baixar app)
              </span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>
                Liquidação mínima inteligente para zerar saldos com o menor número de transferências
                Pix
              </span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Modo Família com divisão 50/50 e preservação estrita da privacidade individual</span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
