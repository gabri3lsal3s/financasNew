import {
  CreditCard,
  PieChart,
  Zap,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";

export function ProductNarratives() {
  return (
    <section id="recursos" className="py-14 md:py-32 border-t border-border/60 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 space-y-16 md:space-y-36">
        {/* Cabeçalho da Seção de Recursos */}
        <ScrollReveal className="text-center max-w-4xl mx-auto">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary block">
            Engenharia Financeira com Clareza Absoluta
          </span>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Projetado para transformar o modo como você cuida do seu patrimônio
          </h2>
          <p className="mt-4 sm:mt-5 text-sm sm:text-lg lg:text-xl text-muted-foreground leading-relaxed">
            Sem fórmulas frágeis de planilhas e sem relatórios opacos. Uma experiência construída para dar a você controle em tempo real, previsibilidade de meses futuros e disciplina de investimentos.
          </p>
        </ScrollReveal>

        {/* História 1: Caixa Real & Daily Budget */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 xl:gap-20 items-center">
          {/* Texto Explicativo (Esquerda) */}
          <ScrollReveal delay={50} className="lg:col-span-6 space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary">
              <Zap className="size-3.5 sm:size-4" aria-hidden="true" />
              <span>Controle do Dinheiro Livre</span>
            </div>

            <h3 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-snug">
              O fim da ilusão de saldo e da ansiedade de fim de mês
            </h3>

            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
              Olhar o saldo do banco cria uma falsa sensação de dinheiro disponível — esquecendo que o aluguel vence amanhã e a fatura do cartão ainda não fechou.
            </p>

            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
              O Guia Financeiro calcula o seu <strong>Caixa Real Seguro (Safe-to-Spend)</strong>: desconta dívidas pendentes, faturas abertas e provisões, traduzindo seu dinheiro restante em um <strong>Ritmo Diário (Daily Budget)</strong> em R$/dia. Você sabe exatamente quanto pode gastar hoje sem estourar o orçamento do mês.
            </p>

            <div className="space-y-2.5 pt-1 text-xs sm:text-sm lg:text-base text-muted-foreground">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Zero surpresas com contas esquecidas</span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Termômetro de orçamentos por categoria</span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Detector nativo de assinaturas e gastos ocultos</span>
              </div>
            </div>
          </ScrollReveal>

          {/* Visual Demonstrativo (Direita) */}
          <ScrollReveal delay={150} className="lg:col-span-6">
            <Card className="border-border/80 bg-surface/90 shadow-xl p-4.5 sm:p-8 md:p-10 space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl">
              <div className="flex justify-between items-center border-b border-border/50 pb-3 sm:pb-4">
                <span className="text-xs sm:text-sm font-bold text-foreground">Demonstrativo de Caixa Real</span>
                <Badge variant="positive" size="xs" className="font-mono">
                  Safe-to-Spend Ativo
                </Badge>
              </div>

              <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-mono">
                <div className="flex justify-between p-3 sm:p-3.5 rounded-xl bg-background/50 border border-border/50">
                  <span className="text-muted-foreground">Saldo Bancário Bruto:</span>
                  <span className="font-bold text-foreground">R$ 8.900,00</span>
                </div>
                <div className="flex justify-between p-3 sm:p-3.5 rounded-xl bg-background/50 border border-border/50 text-negative-strong dark:text-negative">
                  <span>(-) Faturas Abertas de Cartão:</span>
                  <span className="font-bold">-R$ 2.480,00</span>
                </div>
                <div className="flex justify-between p-3 sm:p-3.5 rounded-xl bg-background/50 border border-border/50 text-warning-strong dark:text-warning">
                  <span>(-) Dívidas & Contas a Pagar:</span>
                  <span className="font-bold">-R$ 180,00</span>
                </div>
                <div className="flex justify-between p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/30 text-sm sm:text-base">
                  <span className="font-sans font-bold text-primary-strong">Caixa Real Disponível:</span>
                  <span className="font-extrabold text-foreground">R$ 6.240,00</span>
                </div>
              </div>

              <div className="pt-2 sm:pt-3 flex justify-between items-center text-xs sm:text-sm text-muted-foreground border-t border-border/40">
                <span>Ritmo Sugerido:</span>
                <span className="font-mono font-bold text-primary-strong text-sm sm:text-lg">R$ 148,00 / dia</span>
              </div>
            </Card>
          </ScrollReveal>
        </div>

        {/* História 2: Cartões & Faturas Futuras */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 xl:gap-20 items-center">
          {/* Visual Demonstrativo (Esquerda no Desktop) */}
          <ScrollReveal delay={150} className="lg:col-span-6 order-2 lg:order-1">
            <Card className="border-border/80 bg-surface/90 shadow-xl p-4.5 sm:p-8 md:p-10 space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl">
              <div className="flex justify-between items-center border-b border-border/50 pb-3 sm:pb-4">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-foreground">Mastercard Black Prime</div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground">Limite Total: R$ 15.000,00</div>
                </div>
                <Badge variant="warning" size="xs" className="font-mono">
                  Fecha em 6 dias
                </Badge>
              </div>

              <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-border/60 bg-background/60">
                <span className="text-xs text-muted-foreground block font-sans">Fatura Atual Fechando em:</span>
                <span className="font-mono text-2xl sm:text-3xl font-bold text-foreground block mt-1">
                  R$ 2.480,50
                </span>
                <div className="mt-2.5 sm:mt-3.5 h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: "16.5%" }} />
                </div>
                <span className="text-xs text-muted-foreground mt-1.5 block">
                  16.5% do limite total comprometido
                </span>
              </div>

              <div className="space-y-2 sm:space-y-2.5 pt-1">
                <span className="text-xs sm:text-sm font-semibold text-foreground flex items-start gap-1.5 sm:gap-2">
                  <Calendar className="size-3.5 sm:size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Previsão de Parcelas para os Próximos Meses:</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2.5 font-mono">
                  <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-background/40 border border-border/50 flex sm:flex-col justify-between sm:justify-center items-center text-left sm:text-center">
                    <span className="text-xs text-muted-foreground font-sans">Mês +1</span>
                    <span className="font-bold text-foreground text-xs sm:text-sm tabular-nums whitespace-nowrap">R$ 1.840,20</span>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-background/40 border border-border/50 flex sm:flex-col justify-between sm:justify-center items-center text-left sm:text-center">
                    <span className="text-xs text-muted-foreground font-sans">Mês +2</span>
                    <span className="font-bold text-foreground text-xs sm:text-sm tabular-nums whitespace-nowrap">R$ 1.120,00</span>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-background/40 border border-border/50 flex sm:flex-col justify-between sm:justify-center items-center text-left sm:text-center">
                    <span className="text-xs text-muted-foreground font-sans">Mês +3</span>
                    <span className="font-bold text-foreground text-xs sm:text-sm tabular-nums whitespace-nowrap">R$ 640,00</span>
                  </div>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          {/* Texto Explicativo (Direita no Desktop) */}
          <ScrollReveal delay={50} className="lg:col-span-6 space-y-4 sm:space-y-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-warning-strong dark:text-warning">
              <CreditCard className="size-3.5 sm:size-4" aria-hidden="true" />
              <span>Gestão de Cartões & Parcelamentos</span>
            </div>

            <h3 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-snug">
              Nunca mais seja pego de surpresa por parcelas esquecidas
            </h3>

            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
              Compras parceladas são o principal motivo de endividamento quando espalhadas em faturas futuras invisíveis.
            </p>

            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
              Com o <strong>Fechamento Automático de Competências</strong>, o sistema calcula o cronograma exato de parcelas para os próximos 12 meses em centavos exatos. Você enxerga com antecedência o limite comprometido e o impacto real no seu orçamento antes de assumir novos compromissos.
            </p>

            <div className="space-y-2.5 pt-1 text-xs sm:text-sm lg:text-base text-muted-foreground">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Fechamento preciso de competência e vencimento</span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Divisão em centavos sem erros de arredondamento</span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Visão de limite futuro comprometido mês a mês</span>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* História 3: Investimentos, Aportes & Inteligência Fiscal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 xl:gap-20 items-center">
          {/* Texto Explicativo (Esquerda) */}
          <ScrollReveal delay={50} className="lg:col-span-6 space-y-4 sm:space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-portfolio/30 bg-portfolio/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-portfolio">
              <PieChart className="size-3.5 sm:size-4" aria-hidden="true" />
              <span>Rebalanceamento & Inteligência Fiscal</span>
            </div>

            <h3 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-snug">
              Alocação matemática de aportes e blindagem contra impostos
            </h3>

            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
              Investir com sucesso não é tentar adivinhar a próxima ação do momento, mas manter uma estratégia disciplinada sem girar patrimônio desnecessariamente.
            </p>

            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
              Nosso <strong>Motor de Rebalanceamento Determinístico</strong> calcula exatamente para onde direcionar cada real do seu aporte mensal para comprar na baixa e reequilibrar sua carteira. E o <strong>Radar Fiscal de Renda Fixa</strong> monitora a tabela regressiva de IR para alertar o momento exato em que a alíquota cai antes de você resgatar.
            </p>

            <div className="space-y-2.5 pt-1 text-xs sm:text-sm lg:text-base text-muted-foreground">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Rebalanceamento 100% via aportes (zero venda de ativos)</span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Radar de alíquota regressiva de IR de Renda Fixa</span>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
                <span>Exportação completa em Excel (.xlsx) com fórmulas em 1 clique</span>
              </div>
            </div>
          </ScrollReveal>

          {/* Visual Demonstrativo (Direita) */}
          <ScrollReveal delay={150} className="lg:col-span-6">
            <Card className="border-border/80 bg-surface/90 shadow-xl p-4.5 sm:p-8 md:p-10 space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl">
              <div className="flex justify-between items-center border-b border-border/50 pb-3 sm:pb-4">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-foreground">Sugestão de Aporte Inteligente</div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground">Aporte Mensal: R$ 2.000,00</div>
                </div>
                <Badge variant="portfolio" size="xs" className="font-mono">
                  Motor Algorítmico
                </Badge>
              </div>

              <div className="space-y-3 sm:space-y-4 pt-1 text-xs sm:text-sm font-mono">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span className="truncate mr-2">Renda Fixa IPCA+ (Defasada: 25% vs Meta 35%)</span>
                    <span className="font-bold text-portfolio shrink-0">Aportar R$ 1.400 (70%)</span>
                  </div>
                  <div className="h-2 sm:h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: "70%" }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span className="truncate mr-2">Fundos Imobiliários FIIs (Defasada: 22% vs Meta 25%)</span>
                    <span className="font-bold text-portfolio shrink-0">Aportar R$ 600 (30%)</span>
                  </div>
                  <div className="h-2 sm:h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: "30%" }} />
                  </div>
                </div>
              </div>

              {/* Box Radar Fiscal */}
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-warning/30 bg-warning/5 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2">
                <div>
                  <div className="font-bold text-foreground">Radar Fiscal (CDB 2024):</div>
                  <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Alíquota atual de 20.0% cai para 17.5%</div>
                </div>
                <Badge variant="warning" size="xs" className="font-mono shrink-0 self-start sm:self-auto">
                  Faltam 14 dias
                </Badge>
              </div>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

