import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import {
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Receipt,
  Calendar,
  Lock,
  Layers,
  TrendingUp,
  CreditCard,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo } from "@/components/layout";
import { triggerSensory } from "@/services/sensory";
import type { SubscriptionPlan } from "@/types";

const PRO_BENEFITS = [
  {
    title: "Lançamentos e Histórico Ilimitados",
    description: "Preservação vitalícia de todas as suas receitas, despesas e patrimônio.",
    icon: Layers,
  },
  {
    title: "Multi-Cartões e Parcelamento até 60x",
    description: "Controle estrito de faturas futuras e competências sem surpresas.",
    icon: CreditCard,
  },
  {
    title: "Motor de Rebalanceamento Determinístico",
    description: "Cálculo matemático do aporte ideal sem fórmulas frágeis de planilha.",
    icon: TrendingUp,
  },
  {
    title: "Radar Fiscal IR e Dossiê Executivo",
    description: "Relatórios analíticos em Excel e visão consolidada de impostos.",
    icon: Receipt,
  },
] as const;

export function SubscriptionSuccessPage() {
  const [searchParams] = useSearchParams();
  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");

  const plan: SubscriptionPlan = planoParam === "pro-mensal" ? "monthly" : "annual";
  const isAnnual = plan === "annual";
  const isPix = metodoParam === "pix";

  const priceText = isAnnual ? "R$\u00a0178,80/ano" : "R$\u00a019,90/mês";
  const planTitle = isAnnual ? "Plano Pro Anual" : "Plano Pro Mensal";

  // Data estimada de próxima renovação (1 ano ou 1 mês a partir de hoje)
  const nextRenewalDate = new Date();
  if (isAnnual) {
    nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
  } else {
    nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
  }
  const formattedRenewal = nextRenewalDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  useEffect(() => {
    triggerSensory("success");
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Header Minimalista */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <BrandLogo isPro={true} markClassName="size-7" />
          <Link to="/configuracoes">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              Minha Conta
            </Button>
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center">
        {/* Card de Boas-Vindas */}
        <div className="w-full max-w-2xl text-center space-y-4">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-positive/10 border border-positive/30 text-positive-strong shadow-xs">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>Assinatura Ativa</span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Pagamento Confirmado!
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Sua conta foi promovida com sucesso ao <strong className="text-foreground">{planTitle}</strong>. Todos os recursos avançados de engenharia financeira já estão liberados.
            </p>
          </div>
        </div>

        {/* Resumo da Assinatura e Recibo */}
        <div className="mt-8 w-full max-w-2xl">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardContent className="p-5 sm:p-7 space-y-6">
              {/* Linha de Destaque da Fatura */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-border/80">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Plano Ativado
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg sm:text-xl font-bold text-foreground">
                      {planTitle}
                    </span>
                    <Badge variant="positive" size="xs">
                      {isAnnual ? "Economia de 25%" : "Mensal"}
                    </Badge>
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="text-xs text-muted-foreground block">Valor do Plano</span>
                  <span className="font-display text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                    {priceText}
                  </span>
                </div>
              </div>

              {/* Metadados do Recibo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    <span>Data de Ativação</span>
                  </div>
                  <span className="font-semibold text-foreground">{today}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {isPix ? <QrCode className="size-3.5" aria-hidden="true" /> : <CreditCard className="size-3.5" aria-hidden="true" />}
                    <span>Método</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {isPix ? "PIX Instantâneo" : "Cartão de Crédito"}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
                    <span>Próxima Renovação</span>
                  </div>
                  <span className="font-semibold text-foreground">{formattedRenewal}</span>
                </div>
              </div>

              {/* Benefícios Liberados */}
              <div className="pt-4 border-t border-border/80 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Recursos Exclusivos Disponíveis
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRO_BENEFITS.map((b) => (
                    <div
                      key={b.title}
                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3"
                    >
                      <b.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-foreground block">
                          {b.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-snug block">
                          {b.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações de Direcionamento */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <Link to="/" className="w-full">
            <Button
              className="w-full py-6 text-base font-semibold shadow-md gap-2 cursor-pointer"
              onClick={() => triggerSensory("action")}
            >
              <span>Acessar Painel Financeiro</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>

          <Link to="/configuracoes" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full sm:w-auto py-6 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Ver Assinatura
            </Button>
          </Link>
        </div>

        {/* Rodapé de Confiança */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          <span>Comprovante registrado e criptografado com segurança</span>
        </div>
      </main>
    </div>
  );
}
