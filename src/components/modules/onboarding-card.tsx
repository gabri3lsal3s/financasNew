import { Link } from "react-router";
import { Check, CreditCard, Receipt, Sparkles, Tag, TrendingUp } from "lucide-react";
import { Button, Progress } from "@/components/ui";
import { onboardingProgress, onboardingSteps } from "@/domain/onboarding";
import type { OnboardingCounts } from "@/domain/onboarding";
import { useLoadDemoData } from "@/state";
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
    description: "Acompanhe faturas, pagamentos e limites.",
    href: "/cartoes",
    icon: CreditCard,
  },
  "first-transaction": {
    label: "Registre o primeiro lançamento",
    description: "Despesas e rendas alimentam os relatórios e insights.",
    href: "/transacoes?novo=transacao",
    icon: Receipt,
  },
};

export interface OnboardingCardProps {
  counts: OnboardingCounts;
  className?: string;
  onDismiss?: () => void;
}

/** Checklist de configuração inicial (§5.7) — exibido na Visão Geral enquanto o setup está incompleto. */
export function OnboardingCard({ counts, className }: OnboardingCardProps) {
  const steps = onboardingSteps(counts);
  const progress = onboardingProgress(counts);
  const pending = steps.filter((step) => !step.done);
  const loadDemoMutation = useLoadDemoData();

  return (
    <section
      aria-label="Configuração inicial"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-base sm:text-lg font-bold text-foreground">
              Configure sua conta
            </h2>
            <span className="num text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-hover text-muted-foreground border border-border/60">
              {progress.done}/{progress.total}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Complete o setup inicial ou explore os recursos imediatamente com um clique.
          </p>
        </div>

        {progress.done < progress.total && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadDemoMutation.mutate()}
            disabled={loadDemoMutation.isPending}
            className="shrink-0 self-start sm:self-auto gap-1.5 border-primary/40 hover:bg-primary/10 text-xs font-medium cursor-pointer"
          >
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            <span>{loadDemoMutation.isPending ? "Carregando…" : "Explorar com dados de exemplo"}</span>
          </Button>
        )}
      </div>

      <Progress
        value={(progress.done / progress.total) * 100}
        tone="auto"
        aria-label={`Progresso da configuração: ${progress.done} de ${progress.total}`}
      />

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {steps.map((step) => {
          const meta = STEP_META[step.id];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                step.done
                  ? "border-border/60 bg-surface-hover/20 text-muted-foreground"
                  : "border-border/80 bg-surface shadow-2xs hover:border-border",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                  step.done
                    ? "border-positive/20 bg-positive/10 text-positive-strong"
                    : "border-border/80 bg-surface-hover text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-xs sm:text-sm font-semibold truncate",
                    step.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {meta.label}
                </p>
                {!step.done ? (
                  <p className="text-[11px] text-muted-foreground truncate">{meta.description}</p>
                ) : null}
              </div>
              {!step.done ? (
                <Link to={meta.href}>
                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs font-medium cursor-pointer">
                    Configurar
                  </Button>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Setup completo — parabéns! Esta seção será recolhida.</p>
      ) : null}
    </section>
  );
}
