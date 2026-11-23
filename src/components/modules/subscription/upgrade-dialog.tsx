import { useState } from "react";
import {
  BarChart3,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge, Button, Modal, ModalFooter } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useUserSubscription } from "@/state";
import type { SubscriptionPlan } from "@/types";

export interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contexto que acionou o paywall — personaliza o título. */
  context?: string;
  /** Descrição opcional contextual. */
  contextDescription?: string;
  /** Callback quando o usuário confirma o plano e quer prosseguir para checkout. */
  onProceedToCheckout: (plan: SubscriptionPlan) => void;
}

const BENEFITS = [
  {
    icon: Landmark,
    title: "Caixa Real & Saldo Livre Diário",
    description:
      "Saiba quanto pode gastar hoje já descontando faturas, contas do mês, reserva e alertas de vencimento.",
  },
  {
    icon: ReceiptText,
    title: "Captura Inteligente: OCR, Pix & Bancos",
    description:
      "Leitura de cupons NFC-e, boletos, comprovantes Pix com memória de categoria e notificações bancárias.",
  },
  {
    icon: CreditCard,
    title: "Multi-Cartões & Parcelas em até 60x",
    description:
      "Melhor dia de compra, fechamento automático, conciliação e projeção completa de faturas futuras.",
  },
  {
    icon: Calculator,
    title: "Contas a Pagar/Receber, Contratos & Dívidas",
    description:
      "Controle de recebíveis, financiamentos Price/SAC e planos de quitação Bola de Neve e Avalanche.",
  },
  {
    icon: Users,
    title: "Modo Família, Viagens & Racha Pix",
    description:
      "Orçamento proporcional do lar, grupos de viagem, vaquinhas e racha de parcelas via link público sem cadastro.",
  },
  {
    icon: TrendingUp,
    title: "Carteira Multi-Ativos & Aportes sem Vendas",
    description:
      "Ações, FIIs, Renda Fixa (CDI/IPCA+) e Exterior (PTAX) com proventos e rebalanceamento inteligente.",
  },
  {
    icon: BarChart3,
    title: "Preço Teto & Valuation Multimodelo",
    description:
      "Calcule preço teto e margem de segurança por Bazin, Graham, Gordon e P/VP com nota de tese.",
  },
  {
    icon: FileSpreadsheet,
    title: "7 Relatórios A4/PDF, Excel & Memória de Cálculo",
    description:
      "DRE Pessoal, Balanço 360°, Dossiê da Carteira e planilha de 5 abas (.xlsx) com todas as fórmulas abertas.",
  },
] as const;

/**
 * Diálogo de upgrade / paywall com valor integral das funcionalidades Pro.
 */
export function UpgradeDialog({
  open,
  onOpenChange,
  context,
  contextDescription,
  onProceedToCheckout,
}: UpgradeDialogProps) {
  const subscription = useUserSubscription();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("annual");

  const isAnnual = selectedPlan === "annual";
  const monthlyPrice = "R$\u00a019,99";
  const annualMonthlyPrice = "R$\u00a011,99";
  const annualTotalPrice = "R$\u00a0143,88";

  const isTrialActive =
    subscription?.isTrial &&
    subscription.trialDaysRemaining !== null &&
    subscription.trialDaysRemaining > 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={context ?? "Ativar Plano Pro"}
      description={
        contextDescription ??
        "Acesso completo e ilimitado a todas as ferramentas do Axir Pro."
      }
      size="xl"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Agora não
          </Button>
          <Button
            type="button"
            onClick={() => onProceedToCheckout(selectedPlan)}
            className="gap-2 font-semibold"
          >
            <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">Continuar</span>
            <span className="hidden sm:inline">Continuar para Pagamento Seguro</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="mt-4 flex items-center justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setSelectedPlan("monthly")}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
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
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
              isAnnual
                ? "bg-surface shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Anual
            <Badge variant="positive" size="xs">
              -40%
            </Badge>
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground whitespace-nowrap tabular-nums">
              {isAnnual ? annualMonthlyPrice : monthlyPrice}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">/mês</span>
          </div>
          {isAnnual && (
            <Badge variant="positive" size="xs" className="self-start sm:self-auto shrink-0">
              Apenas R$ 0,39 por dia
            </Badge>
          )}
        </div>

        {isAnnual ? (
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {annualTotalPrice} cobrados anualmente — você economiza{" "}
            <span className="font-semibold text-positive-strong">R$ 60,00</span> por ano.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Cobrança mensal recorrente. Cancelamento a qualquer momento sem fidelidade.
          </p>
        )}

        {isTrialActive && (
          <div className="mt-3 pt-2.5 border-t border-primary/20 flex items-start sm:items-center gap-2 text-xs text-primary-strong">
            <Sparkles className="size-4 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            <span className="leading-snug">
              <strong>R$ 0,00 cobrados hoje:</strong> seus {subscription.trialDaysRemaining} dias restantes de teste continuam válidos.
            </span>
          </div>
        )}
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {BENEFITS.map((benefit) => (
          <li
            key={benefit.title}
            className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface p-3 shadow-xs"
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

      <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-muted/40 p-3">
        <ShieldCheck className="size-4 shrink-0 text-positive-strong mt-0.5" aria-hidden="true" />
        <div className="min-w-0 text-xs text-muted-foreground space-y-0.5">
          <p className="font-semibold text-foreground">
            Garantia legal de 7 dias com estorno integral — Seus dados nunca são excluídos
          </p>
          <p className="text-[11px] leading-relaxed">
            Garantia incondicional (CDC Art. 49). Se optar por não continuar, seu histórico permanece acessível para consulta vitalícia. Cancelamento em 1 clique.
          </p>
        </div>
      </div>
    </Modal>
  );
}
