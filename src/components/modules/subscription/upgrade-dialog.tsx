import { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  Infinity as InfinityIcon,
  BarChart3,
  FileSpreadsheet,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";

export interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contexto que acionou o paywall — personaliza o título. */
  context?: string;
  /** Callback quando o usuário confirma o plano e quer prosseguir para checkout. */
  onProceedToCheckout: (plan: SubscriptionPlan) => void;
}

const BENEFITS = [
  {
    icon: InfinityIcon,
    title: "Lançamentos ilimitados",
    description: "Despesas, receitas e parcelamentos em até 60x.",
  },
  {
    icon: CreditCard,
    title: "Cartões sem limite",
    description: "Gerencie quantos cartões quiser com controle de fatura.",
  },
  {
    icon: TrendingUp,
    title: "Rebalanceamento de carteira",
    description: "Aportes direcionados ao deficit sem vender nem gerar DARF.",
  },
  {
    icon: BarChart3,
    title: "Radar Fiscal IR e DARF",
    description: "Apuração automática de ganhos e guias de recolhimento.",
  },
  {
    icon: FileSpreadsheet,
    title: "Dossiê Executivo (.xlsx)",
    description: "Exportação completa com 5 abas para o seu contador.",
  },
  {
    icon: Landmark,
    title: "Projeção FIRE e Simulador",
    description: "Calcule sua independência financeira com cenários reais.",
  },
] as const;

/**
 * Diálogo de upgrade / paywall.
 *
 * Exibido quando:
 * - O usuário tenta executar uma escrita em modo somente-leitura.
 * - O badge de status é clicado.
 * - A aba de assinatura direciona para upgrade.
 *
 * Regras: zero emojis, zero controles nativos, moeda com `whitespace-nowrap` (AGENTS.md §8, §7, §11).
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  context,
  onProceedToCheckout,
}: UpgradeDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("annual");

  const isAnnual = selectedPlan === "annual";

  const monthlyPrice = "R$\u00a019,90";
  const annualMonthlyPrice = "R$\u00a014,90";
  const annualTotalPrice = "R$\u00a0178,80";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={context ?? "Ativar Plano Pro"}
      description="Acesso completo e ilimitado ao Guia Financeiro."
      size="xl"
    >
      {/* Alternador de periodicidade */}
      <div className="mt-4 flex items-center justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setSelectedPlan("monthly")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
              !isAnnual
                ? "bg-surface shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setSelectedPlan("annual")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200",
              isAnnual
                ? "bg-surface shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Anual
            <Badge variant="positive" size="xs">
              -25%
            </Badge>
          </button>
        </div>
      </div>

      {/* Card de preço */}
      <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-end gap-2">
          {isAnnual ? (
            <>
              <span className="font-display text-4xl font-extrabold tracking-tight text-foreground whitespace-nowrap tabular-nums">
                {annualMonthlyPrice}
              </span>
              <span className="mb-1 text-sm text-muted-foreground">/mês</span>
            </>
          ) : (
            <>
              <span className="font-display text-4xl font-extrabold tracking-tight text-foreground whitespace-nowrap tabular-nums">
                {monthlyPrice}
              </span>
              <span className="mb-1 text-sm text-muted-foreground">/mês</span>
            </>
          )}
        </div>
        {isAnnual && (
          <p className="mt-1 text-xs text-muted-foreground">
            {annualTotalPrice} cobrados anualmente — você economiza{" "}
            <span className="font-semibold text-positive-strong">R$\u00a060,00</span> por ano.
          </p>
        )}
        {!isAnnual && (
          <p className="mt-1 text-xs text-muted-foreground">
            Cancelamento a qualquer momento. Sem fidelidade.
          </p>
        )}
      </div>

      {/* Lista de benefícios */}
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BENEFITS.map((benefit) => (
          <li
            key={benefit.title}
            className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface p-3"
          >
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-positive-strong"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{benefit.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                {benefit.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Garantia */}
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5">
        <ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-snug">
          Garantia incondicional de 30 dias. Cancelamento em 1 clique. Seus dados nunca são
          excluídos.
        </p>
      </div>

      {/* Rodapé de ações */}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Agora não
        </Button>
        <Button
          type="button"
          onClick={() => {
            onProceedToCheckout(selectedPlan);
          }}
          className="gap-2"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Continuar para Pagamento Seguro
        </Button>
      </div>
    </Modal>
  );
}
