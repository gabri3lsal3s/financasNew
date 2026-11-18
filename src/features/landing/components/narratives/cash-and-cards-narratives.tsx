import { Calendar, CheckCircle2, CreditCard, Zap } from "lucide-react";
import { Badge, Card, MoneyText } from "@/components/ui";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";

const CARD_INSTALLMENTS = [
  { month: "Mês +1", cents: 184020 },
  { month: "Mês +2", cents: 112000 },
  { month: "Mês +3", cents: 64000 },
];

export function CashAndCardsNarratives() {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 xl:gap-20 items-center">
        <ScrollReveal delay={50} className="lg:col-span-6 space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
            <Zap className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Eixo 1 · Liquidez & Caixa Real</span>
          </div>

          <h3 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-snug">
            O fim da ilusão de saldo e da ansiedade de fim de mês
          </h3>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            Olhar o saldo do banco cria uma falsa sensação de dinheiro disponível — esquecendo que
            o aluguel vence amanhã e a fatura do cartão ainda não fechou.
          </p>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            O Axir calcula o seu <strong>Caixa Real Seguro (Safe-to-Spend)</strong>: desconta
            dívidas pendentes, faturas abertas e provisões, traduzindo seu dinheiro restante em um{" "}
            <strong>Ritmo Diário</strong> em R$/dia. Você sabe exatamente quanto pode gastar hoje
            sem estourar o orçamento do mês.
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

        <ScrollReveal delay={150} className="lg:col-span-6">
          <Card className="border-border/80 bg-surface shadow-xl p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border/60 pb-3 sm:pb-4">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                Demonstrativo de Caixa Real
              </span>
              <Badge variant="positive" size="xs" className="font-mono">
                Safe-to-Spend Ativo
              </Badge>
            </div>

            <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm font-mono">
              <div className="flex justify-between items-center gap-2 p-3 sm:p-3.5 rounded-xl bg-surface-raised/60 border border-border/60">
                <span className="text-muted-foreground font-sans">Saldo Bancário Bruto:</span>
                <MoneyText cents={890000} tone="default" className="font-bold text-foreground" />
              </div>
              <div className="flex justify-between items-center gap-2 p-3 sm:p-3.5 rounded-xl bg-surface-raised/60 border border-border/60 text-negative-strong dark:text-negative">
                <span className="font-sans">(-) Faturas Abertas de Cartão:</span>
                <MoneyText cents={-248000} tone="negative" className="font-bold" />
              </div>
              <div className="flex justify-between items-center gap-2 p-3 sm:p-3.5 rounded-xl bg-surface-raised/60 border border-border/60 text-warning-strong dark:text-warning">
                <span className="font-sans">(-) Dívidas & Contas a Pagar:</span>
                <MoneyText cents={-18000} tone="default" className="font-bold text-warning-strong dark:text-warning" />
              </div>
              <div className="flex justify-between items-center gap-2 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/30 text-sm sm:text-base">
                <span className="font-sans font-bold text-primary-strong">
                  Caixa Real Disponível:
                </span>
                <MoneyText cents={624000} tone="default" className="font-extrabold text-foreground" />
              </div>
            </div>

            <div className="pt-2 sm:pt-3 flex justify-between items-center gap-2 text-xs sm:text-sm text-muted-foreground border-t border-border/50">
              <span>Ritmo Sugerido:</span>
              <span className="font-mono font-bold text-primary-strong text-sm sm:text-lg whitespace-nowrap">
                <MoneyText cents={14800} tone="default" className="font-bold text-primary-strong" /> / dia
              </span>
            </div>
          </Card>
        </ScrollReveal>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 xl:gap-20 items-center">
        <ScrollReveal delay={150} className="lg:col-span-6 order-2 lg:order-1">
          <Card className="border-border/80 bg-surface shadow-xl p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border/60 pb-3 sm:pb-4">
              <div>
                <div className="text-xs sm:text-sm font-bold text-foreground">
                  Mastercard Black Prime
                </div>
                <div className="text-[11px] sm:text-xs text-muted-foreground">
                  Limite Total: <MoneyText cents={1500000} tone="default" className="font-medium" />
                </div>
              </div>
              <Badge variant="warning" size="xs" className="font-mono">
                Fecha em 6 dias
              </Badge>
            </div>

            <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-border/70 bg-surface-raised/60">
              <span className="text-xs text-muted-foreground block font-sans">
                Fatura Atual Fechando em:
              </span>
              <MoneyText
                cents={248050}
                tone="default"
                className="text-2xl sm:text-3xl font-bold text-foreground block mt-1"
              />
              <div className="mt-2.5 sm:mt-3.5 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-warning-strong" style={{ width: "16.5%" }} />
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 font-mono">
                {CARD_INSTALLMENTS.map((item) => (
                  <div
                    key={item.month}
                    className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-surface-raised/50 border border-border/60 flex sm:flex-col justify-between sm:justify-center items-center text-left sm:text-center"
                  >
                    <span className="text-xs text-muted-foreground font-sans">{item.month}</span>
                    <MoneyText
                      cents={item.cents}
                      tone="default"
                      className="font-bold text-foreground text-xs sm:text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </ScrollReveal>

        <ScrollReveal delay={50} className="lg:col-span-6 space-y-4 sm:space-y-6 order-1 lg:order-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-warning-strong dark:text-warning">
            <CreditCard className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Eixo 2 · Linha Temporal & Cartões</span>
          </div>

          <h3 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-snug">
            Nunca mais seja pego de surpresa por parcelas esquecidas
          </h3>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            Compras parceladas são o principal motivo de endividamento quando espalhadas em faturas
            futuras invisíveis.
          </p>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
            Com o <strong>Fechamento Determinístico de Competências</strong>, o Axir projeta o
            cronograma exato de parcelas em até 60x para os próximos 12 meses. Além disso, você{" "}
            <strong>importa e reconcilia faturas completas (PDF, OFX e CSV)</strong> com detecção
            automática de estornos e pagamentos.
          </p>

          <div className="space-y-2.5 pt-1 text-xs sm:text-sm lg:text-base text-muted-foreground">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Linha do tempo cronológica de 12 meses com limite comprometido</span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Importação e reconciliação automática de faturas completas (PDF, OFX, CSV)</span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3">
              <CheckCircle2 className="size-4 sm:size-5 text-positive-strong dark:text-positive shrink-0" aria-hidden="true" />
              <span>Parcelamentos em até 60x calculados em centavos exatos sem erros</span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
