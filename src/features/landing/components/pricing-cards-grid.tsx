import { Link } from "react-router";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Card, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./scroll-reveal";

const TRIAL_FEATURES = [
  "Acesso 100% liberado a todos os módulos do Plano Pro por 30 dias",
  "Caixa Real, Saldo Livre para gastar hoje e Cartões em até 60x",
  "Captura sem digitação (OCR de cupons/boletos, Pix e notificações)",
  "Contas a pagar/receber, Modo Família, Viagens e Racha Pix",
  "Carteira Multi-Ativos, Preço Teto & Valuation e 7 Relatórios A4/Excel",
];

const PRO_FEATURES = [
  { bold: "Lançamentos, cartões, ativos e histórico", rest: " 100% ilimitados" },
  { bold: "Caixa Real & Saldo Livre Diário", rest: " + Radar Preventivo de vencimentos" },
  { bold: "Captura sem digitação:", rest: " Leitor OCR (NFC-e/boletos), Pix e notificações" },
  { bold: "Cartões até 60x", rest: " + A Pagar, A Receber & Contratos Price/SAC" },
  { bold: "Modo Família, Viagens, Vaquinhas", rest: " & Racha Pix sem exigir cadastro" },
  { bold: "Carteira Multi-Ativos", rest: " (Ações, FIIs, RF CDI/IPCA+ e Exterior) & Proventos" },
  { bold: "Preço Teto & Valuation", rest: " (Bazin, Graham, Gordon, P/VP) & Aportes sem vender" },
  { bold: "7 Relatórios Executivos A4/PDF, Excel (.xlsx)", rest: " & Memória de Cálculo" },
];

export interface PricingCardsGridProps {
  isAnnual: boolean;
  trialUrl: string;
  proPlanUrl: string;
}

export function PricingCardsGrid({
  isAnnual,
  trialUrl,
  proPlanUrl,
}: PricingCardsGridProps) {
  return (
    <div className="mt-8 sm:mt-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
      <ScrollReveal delay={0} className="h-full">
        <Card className="flex flex-col justify-between border-border/80 bg-surface shadow-xs p-5 sm:p-8 rounded-2xl sm:rounded-3xl h-full">
          <div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Teste de 30 Dias
              </span>
              <Badge variant="default" size="xs" className="font-mono border border-primary/30">
                Sem Cartão
              </Badge>
            </div>

            <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold text-foreground">
                R$ 0
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">no período de teste</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Acesso irrestrito a todas as funcionalidades do Pro
            </p>
            <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
              Experimente do gasto do dia a dia aos seus investimentos com seus próprios dados, sem
              nenhuma funcionalidade bloqueada.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col gap-2.5 sm:gap-3.5 text-xs sm:text-sm text-muted-foreground">
              {TRIAL_FEATURES.map((feat) => (
                <div key={feat} className="flex items-center gap-2.5">
                  <Check
                    className="size-4 text-positive-strong dark:text-positive shrink-0"
                    aria-hidden="true"
                  />
                  <span>{feat}</span>
                </div>
              ))}
              <div className="flex items-center gap-2.5">
                <Check
                  className="size-4 text-positive-strong dark:text-positive shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <strong>Modo Somente-Leitura após o período:</strong> seus dados continuam seus
                  para consulta
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/80">
            <Link
              to={trialUrl}
              aria-label="Começar teste gratuito no plano Básico"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full justify-center font-semibold inline-flex items-center gap-2 rounded-xl",
              )}
            >
              Começar Teste Grátis
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck
                className="size-3.5 text-positive-strong dark:text-positive"
                aria-hidden="true"
              />
              <span>Não pedimos dados bancários</span>
            </div>
          </div>
        </Card>
      </ScrollReveal>

      <ScrollReveal delay={100} className="h-full">
        <Card className="flex flex-col justify-between border-primary/50 bg-surface shadow-xs p-5 sm:p-8 relative overflow-hidden ring-1 ring-primary/20 rounded-2xl sm:rounded-3xl h-full">
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
            <Badge variant="default" size="xs" className="font-bold tracking-wider uppercase">
              Mais Escolhido
            </Badge>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm font-bold text-primary-strong uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Plano Pro
              </span>
            </div>

            <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold text-foreground">
                {isAnnual ? "R$ 11,99" : "R$ 19,99"}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground">/ mês</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isAnnual
                ? "Cobrado anualmente (R$ 143,88/ano · apenas R$ 0,39/dia)"
                : "Cobrado mensalmente (sem fidelidade)"}
            </p>
            <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
              Gestão ativa contínua, lançamentos ilimitados e motor avançado de inteligência
              financeira.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col gap-2.5 sm:gap-3.5 text-xs sm:text-sm">
              {PRO_FEATURES.map((item, idx) => (
                <div
                  key={item.bold}
                  className={cn(
                    "flex items-center gap-2.5",
                    idx === 0 && "font-medium text-foreground",
                  )}
                >
                  <Check
                    className="size-4 text-positive-strong dark:text-positive shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{item.bold}</strong>
                    {item.rest}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-border/80">
            <Link
              to={proPlanUrl}
              aria-label="Assinar Plano Pro"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full justify-center shadow-md font-semibold inline-flex items-center gap-2 rounded-xl",
              )}
            >
              Assinar Plano Pro
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck
                className="size-3.5 text-positive-strong dark:text-positive"
                aria-hidden="true"
              />
              <span>7 dias de garantia legal · Cancele em 1 clique</span>
            </div>
          </div>
        </Card>
      </ScrollReveal>
    </div>
  );
}
