import { Link } from "react-router";
import { Check, CreditCard, Receipt, Tag, TrendingUp } from "lucide-react";
import { Button, Progress } from "@/components/ui";
import { onboardingProgress, onboardingSteps } from "@/domain/onboarding";
import type { OnboardingCounts } from "@/domain/onboarding";
import { cn } from "@/lib/utils";

const STEP_META: Record<
  string,
  { label: string; description: string; href: string; icon: typeof Tag }
> = {
  "expense-category": {
    label: "Crie categorias de despesa",
    description: "Classifique seus gastos desde o início.",
    href: "/categorias?type=expense",
    icon: Tag,
  },
  "income-category": {
    label: "Crie categorias de renda",
    description: "Separe salário, freelas e outras entradas.",
    href: "/categorias?type=income",
    icon: TrendingUp,
  },
  card: {
    label: "Adicione um cartão de crédito",
    description: "Acompanhe faturas, pagamentos e estornos.",
    href: "/cartoes",
    icon: CreditCard,
  },
  "first-transaction": {
    label: "Registre o primeiro lançamento",
    description: "Despesas e rendas alimentam os relatórios e insights.",
    href: "/transacoes/novo",
    icon: Receipt,
  },
};

export interface OnboardingCardProps {
  counts: OnboardingCounts;
}

/** Checklist de configuração inicial (§5.7) — exibido na Visão Geral enquanto o setup está incompleto. */
export function OnboardingCard({ counts }: OnboardingCardProps) {
  const steps = onboardingSteps(counts);
  const progress = onboardingProgress(counts);
  const pending = steps.filter((step) => !step.done);

  return (
    <section
      aria-label="Configuração inicial"
      className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold">Configure sua conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete o setup para aproveitar relatórios, insights e orçamentos.
          </p>
        </div>
        <span className="num text-xs font-medium text-muted-foreground">
          {progress.done}/{progress.total}
        </span>
      </div>

      <Progress value={(progress.done / progress.total) * 100} tone="auto" aria-label={`Progresso da configuração: ${progress.done} de ${progress.total}`} />

      <ul className="flex flex-col gap-2">
        {steps.map((step) => {
          const meta = STEP_META[step.id];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-surface p-3",
                step.done ? "border-border" : "border-border",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center",
                  step.done ? "text-positive-strong" : "text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", step.done ? "text-muted-foreground" : "text-foreground")}>
                  {meta.label}
                </p>
                {!step.done ? <p className="text-xs text-muted-foreground">{meta.description}</p> : null}
              </div>
              {!step.done ? (
                <Link to={meta.href}>
                  <Button size="sm" variant="outline">
                    Configurar
                  </Button>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Setup completo — esta seção será ocultada automaticamente.</p>
      ) : null}
    </section>
  );
}
