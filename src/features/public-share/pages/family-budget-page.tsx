import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { BrandLogo } from "@/components/layout";
import { EmptyState, Skeleton, buttonVariants } from "@/components/ui";
import { MonthPicker } from "@/components/modules/month-picker";
import { useSharedFamilyBudget } from "@/state/queries/use-public-shares";
import { currentMonth, isValidMonth } from "@/lib/date";
import { cn } from "@/lib/utils";
import { sanitizeShareToken } from "@/domain/share/token";
import { PublicPwaShortcutCard, SharedLinkHeaderNav } from "../components";
import { FamilyBudgetHeroCard } from "../components/family-budget-hero-card";
import { FamilyBudgetKpisGrid } from "../components/family-budget-kpis-grid";
import { FamilyBudgetExpensesCard } from "../components/family-budget-expenses-card";

export function FamilyBudgetPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = sanitizeShareToken(rawToken);
  const [searchParams, setSearchParams] = useSearchParams();
  const paramMonth = searchParams.get("month");
  const initialMonth = paramMonth && isValidMonth(paramMonth) ? paramMonth : currentMonth();
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth);

  const { data: budgetData, isLoading, isError } = useSharedFamilyBudget(token, selectedMonth);

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

  if (isError || !budgetData || budgetData.is_revoked) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="flex justify-center">
            <BrandLogo />
          </div>
          <EmptyState
            icon={<ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />}
            title="Orçamento familiar não encontrado ou expirado"
            description="Este link de compartilhamento foi revogado pelo titular da conta ou já expirou. Peça ao responsável pelo orçamento que gere um novo link nas configurações."
            action={
              <Link
                to="/apresentacao"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "rounded-xl",
                )}
              >
                Conhecer o Axir
              </Link>
            }
          />
        </div>
      </main>
    );
  }

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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          <div className="md:col-span-7 md:col-start-1 md:row-start-1">
            <FamilyBudgetHeroCard budgetData={budgetData} />
          </div>

          <div className="md:col-span-5 md:col-start-8 md:row-start-1 md:row-span-3 md:sticky md:top-20 space-y-4">
            <FamilyBudgetKpisGrid budgetData={budgetData} />

            <div className="rounded-xl border border-border/80 bg-surface p-4 text-xs text-muted-foreground leading-relaxed hidden md:block">
              <p className="font-semibold text-foreground mb-1">Painel Seguro da Família</p>
              <p className="text-[11px]">
                Apenas as despesas marcadas pelo titular como familiares são compartilhadas aqui. Contas bancárias e transações individuais permanecem estritamente privadas.
              </p>
            </div>
          </div>

          <div className="md:col-span-7 md:col-start-1 md:row-start-2">
            <FamilyBudgetExpensesCard expenses={budgetData.expenses} />
          </div>

          <div className="md:col-span-7 md:col-start-1 md:row-start-3">
            <PublicPwaShortcutCard
              title="Fixar no Celular como Aplicativo"
              description="Adicione este painel à tela inicial do seu celular para consultar o orçamento da casa a qualquer momento com 1 toque."
            />
          </div>
        </div>
      </main>

      <footer className="max-w-2xl md:max-w-5xl mx-auto w-full pt-8 pb-4 text-center space-y-2 border-t border-border/80 mt-8 text-xs text-muted-foreground px-4">
        <p className="leading-relaxed">
          Este painel é de leitura segura. Contas bancárias, faturas e lançamentos individuais permanecem 100% confidenciais.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <span>Axir</span>
          <span aria-hidden="true">·</span>
          <Link
            to="/apresentacao"
            className="text-primary-strong hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>Conheça a plataforma</span>
            <ExternalLink className="size-2.5" aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
