import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import {
  ShieldAlert,
  Wallet,
  TrendingDown,
  PiggyBank,
  Calendar,
  Receipt,
  Smartphone,
  Share,
  Download,
  ExternalLink,
} from "lucide-react";
import { BrandLogo } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  buttonVariants,
  MoneyText,
  Progress,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { MonthPicker } from "@/components/modules/month-picker";
import { useSharedFamilyBudget } from "@/state/queries/use-public-shares";
import { formatDateBR, currentMonth, isValidMonth } from "@/lib/date";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { IosPwaInstallDialog } from "@/components/modules/ios-pwa-install-dialog";
import { cn } from "@/lib/utils";
import { SharedLinkHeaderNav } from "../components";

export function FamilyBudgetPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramMonth = searchParams.get("month");
  const initialMonth = paramMonth && isValidMonth(paramMonth) ? paramMonth : currentMonth();
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);

  const { data: budgetData, isLoading, isError } = useSharedFamilyBudget(token, selectedMonth);
  const { canInstall, isIOS, isInstalled, install } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  const handleMonthChange = (nextMonth: string) => {
    setSelectedMonth(nextMonth);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextMonth === currentMonth()) {
          next.delete("month");
        } else {
          next.set("month", nextMonth);
        }
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (budgetData?.owner_name) {
      document.title = `Orçamento Familiar · ${budgetData.owner_name} — Axir`;
    } else {
      document.title = "Orçamento Familiar — Axir";
    }
  }, [budgetData?.owner_name]);

  const handlePwaAction = () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    void install();
  };

  // 1. Estado de Carregamento (Skeleton)
  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          <header className="flex items-center justify-between pb-4 border-b border-border/80">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </header>
          <div className="space-y-4">
            <Skeleton className="h-44 w-full rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  // 2. Estado de Erro ou Link Revogado/Inexistente
  if (isError || !budgetData || budgetData.is_revoked) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="flex justify-center">
            <BrandLogo />
          </div>
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6">
            <EmptyState
              icon={<ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />}
              title="Orçamento familiar não encontrado ou expirado"
              description="Este link de compartilhamento foi revogado pelo titular da conta ou já expirou. Peça ao responsável pelo orçamento que gere um novo link nas configurações."
              action={
                <Link
                  to="/apresentacao"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "rounded-xl cursor-pointer",
                  )}
                >
                  Conhecer o Axir
                </Link>
              }
            />
          </Card>
        </div>
      </main>
    );
  }

  // 3. Resolução de tons da barra de progresso e status
  const isOverCeiling = budgetData.remaining_cents < 0;
  const isNearCeiling = budgetData.spent_percentage >= 85 && !isOverCeiling;
  const hasCeiling = budgetData.monthly_ceiling_cents > 0;

  const progressTone = isOverCeiling ? "critical" : isNearCeiling ? "warning" : "positive";

  const statusBadge = isOverCeiling ? (
    <Badge variant="critical" size="xs">
      Teto Excedido ({budgetData.spent_percentage}%)
    </Badge>
  ) : isNearCeiling ? (
    <Badge variant="warning" size="xs">
      Atenção ({budgetData.spent_percentage}%)
    </Badge>
  ) : hasCeiling ? (
    <Badge variant="positive" size="xs">
      Dentro do Teto ({budgetData.spent_percentage}%)
    </Badge>
  ) : (
    <Badge variant="muted" size="xs">
      Sem Teto Definido
    </Badge>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <SharedLinkHeaderNav
        badgeLabel="Orçamento Familiar"
        targetPath={`orcamento-familiar/${token || ""}`}
        maxWidth="5xl"
      />

      <main className="flex-1 max-w-2xl md:max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6 space-y-6">
        <MonthPicker
          value={selectedMonth}
          onValueChange={handleMonthChange}
          className="w-full"
        />

        {/* Grade Responsiva: Fluxo linear no Mobile e 2 Colunas (7/5) no Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* 1. Hero Card: Consumo do Mês (Esquerda no desktop: 7 cols) */}
          <div className="md:col-span-7 md:col-start-1 md:row-start-1">
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                      {budgetData.owner_name
                        ? `Orçamento Familiar · ${budgetData.owner_name}`
                        : "Orçamento da Casa"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Acompanhamento transparente das contas e despesas compartilhadas do lar
                    </p>
                  </div>
                  <div>{statusBadge}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {/* Barra de Progresso Canônica */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Consumo do Mês</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {budgetData.spent_percentage}% consumido
                    </span>
                  </div>
                  <Progress
                    value={budgetData.spent_percentage}
                    tone={progressTone}
                    size="lg"
                    aria-label={`Consumo do orçamento: ${budgetData.spent_percentage}%`}
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                    <span>
                      {hasCeiling
                        ? `Teto: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(budgetData.monthly_ceiling_cents / 100)}`
                        : "Sem teto estipulado"}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <span>Saldo disponível:</span>
                      <MoneyText
                        cents={budgetData.remaining_cents}
                        variant="caption"
                        tone={budgetData.remaining_cents >= 0 ? "positive" : "negative"}
                      />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 2. KPIs do Lar: No desktop fica na Coluna Direita Sticky (5 cols) */}
          <div className="md:col-span-5 md:col-start-8 md:row-start-1 md:row-span-3 md:sticky md:top-20 space-y-4">
            <section aria-label="Indicadores do Orçamento Familiar">
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-3.5">
                {/* KPI 1: Teto do Mês */}
                <Card className="border-border/80 bg-surface shadow-xs">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Teto do Mês</span>
                      <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                      <MoneyText cents={budgetData.monthly_ceiling_cents} variant="hero" tone="default" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Limite mensal planejado</p>
                  </CardContent>
                </Card>

                {/* KPI 2: Total Gasto */}
                <Card className="border-border/80 bg-surface shadow-xs">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Total Gasto</span>
                      <TrendingDown className="size-4 text-negative-strong" aria-hidden="true" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                      <MoneyText cents={budgetData.total_spent_cents} variant="hero" tone="negative" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {budgetData.expenses.length === 1
                        ? "1 despesa familiar registrada"
                        : `${budgetData.expenses.length} despesas familiares`}
                    </p>
                  </CardContent>
                </Card>

                {/* KPI 3: Saldo Restante Disponível */}
                <Card className="border-border/80 bg-surface shadow-xs">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Saldo Restante</span>
                      <PiggyBank
                        className={cn(
                          "size-4",
                          budgetData.remaining_cents >= 0
                            ? "text-positive-strong"
                            : "text-critical-strong",
                        )}
                        aria-hidden="true"
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                      <MoneyText
                        cents={budgetData.remaining_cents}
                        variant="hero"
                        tone={budgetData.remaining_cents >= 0 ? "positive" : "negative"}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {budgetData.remaining_cents >= 0
                        ? "Disponível até o final do mês"
                        : "Excedente acima do planejado"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Card Informativo de Privacidade */}
            <div className="rounded-xl border border-border/80 bg-surface/60 p-4 text-xs text-muted-foreground leading-relaxed hidden md:block">
              <p className="font-semibold text-foreground mb-1">Painel Seguro da Família</p>
              <p className="text-[11px]">
                Apenas as despesas marcadas pelo titular como familiares são compartilhadas aqui. Contas bancárias e transações individuais permanecem estritamente privadas.
              </p>
            </div>
          </div>

          {/* 3. Lista de Despesas Familiares do Mês (Esquerda no desktop: 7 cols) */}
          <div className="md:col-span-7 md:col-start-1 md:row-start-2">
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="pb-3 border-b border-border/80">
                <CardTitle className="text-base flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2">
                    <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span>Despesas Familiares do Mês</span>
                  </span>
                  <Badge variant="muted" size="xs">
                    {budgetData.expenses.length === 1
                      ? "1 lançamento"
                      : `${budgetData.expenses.length} lançamentos`}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Apenas transações e compras assinaladas como despesa do lar
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                {budgetData.expenses.length === 0 ? (
                  <EmptyState
                    icon={<Receipt className="size-8 text-muted-foreground" aria-hidden="true" />}
                    title="Nenhuma despesa familiar registrada neste mês"
                    description="Conforme as compras e contas da casa forem adicionadas pelo titular, elas serão listadas aqui instantaneamente."
                  />
                ) : (
                  <ul className="divide-y divide-border/60" aria-label="Lista de despesas familiares">
                    {budgetData.expenses.map((expense) => (
                      <li
                        key={expense.id}
                        className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">
                            {expense.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            {expense.category_name && (
                              <>
                                <span className="truncate">{expense.category_name}</span>
                                <span>•</span>
                              </>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                              <span>{formatDateBR(expense.date)}</span>
                            </span>
                            {expense.payer_name && (
                              <>
                                <span>•</span>
                                <Badge variant="muted" size="xs">
                                  {expense.payer_name}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="tabular-nums font-semibold text-foreground shrink-0 text-sm">
                          <MoneyText cents={expense.amount_cents} variant="value" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 4. Atalho PWA / Fixar na Tela Inicial (Esquerda no desktop: 7 cols) */}
          {(canInstall || isIOS || !isInstalled) && (
            <div className="md:col-span-7 md:col-start-1 md:row-start-3">
              <section aria-label="Fixar atalho na tela inicial">
                <div className="rounded-2xl border border-border/80 bg-surface shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-foreground">
                      <Smartphone className="size-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-foreground block">
                        Fixar no Celular como Aplicativo
                      </span>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Adicione este painel à tela inicial do seu celular para consultar o orçamento da casa a qualquer momento com 1 toque.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePwaAction}
                    className="gap-2 shrink-0 border-border/80 bg-surface hover:bg-surface-hover cursor-pointer rounded-xl font-semibold text-xs"
                  >
                    {isIOS ? (
                      <>
                        <Share className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Como fixar no iPhone</span>
                      </>
                    ) : (
                      <>
                        <Download className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        <span>Adicionar à Tela Inicial</span>
                      </>
                    )}
                  </Button>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Modal de Instruções iOS Safari */}
        <IosPwaInstallDialog open={showIosGuide} onOpenChange={setShowIosGuide} />
      </main>

      {/* Rodapé Informativo de Privacidade e Branding */}
      <footer className="max-w-2xl md:max-w-5xl mx-auto w-full pt-8 pb-4 text-center space-y-2 border-t border-border/60 mt-8 text-xs text-muted-foreground px-4">
        <p className="leading-relaxed">
          Este painel é de leitura segura. Contas bancárias, faturas e lançamentos individuais permanecem 100% confidenciais.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <span>Axir</span>
          <span>&middot;</span>
          <Link
            to="/apresentacao"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>Conheça a plataforma</span>
            <ExternalLink className="size-2.5" aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
