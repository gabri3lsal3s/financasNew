import { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
  ReceiptText,
  Users,
  Calculator,
  Landmark,
} from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    icon: ReceiptText,
    title: "Leitor OCR de Cupons & Notas Fiscais",
    description: "Extração item a item de cupons NFC-e/SAT, boletos e comprovantes Pix sem digitação manual.",
  },
  {
    icon: CreditCard,
    title: "Multi-Cartões & Parcelas em até 60x",
    description: "Controle do melhor dia de compra, fechamento e projeção detalhada de faturas futuras.",
  },
  {
    icon: Landmark,
    title: "Previsibilidade & Safe-to-Spend Diário",
    description: "Termômetro em tempo real do quanto pode gastar com segurança e Radar de Vencimentos.",
  },
  {
    icon: Users,
    title: "Espaço Família & Viagens",
    description: "Orçamentos colaborativos em casal com privacidade e racha de contas Pix via link público.",
  },
  {
    icon: Calculator,
    title: "Radar de Dívidas & Simuladores",
    description: "Estratégias Bola de Neve e Avalanche com cálculo de amortização e economia de juros.",
  },
  {
    icon: TrendingUp,
    title: "Rebalanceamento de Carteira",
    description: "Aportes matemáticos calculados diretamente para o déficit da meta sem gerar DARF.",
  },
  {
    icon: BarChart3,
    title: "Radar Fiscal IR & DARF",
    description: "Apuração automática de ganhos líquidos e emissão das guias de recolhimento de investimentos.",
  },
  {
    icon: FileSpreadsheet,
    title: "Dossiê Executivo Contábil (.xlsx)",
    description: "Exportação completa em planilha auditada de 5 abas pronta para o seu contador.",
  },
] as const;

/**
 * Diálogo de upgrade / paywall com valor integral das novas funcionalidades.
 *
 * Exibido quando:
 * - O usuário clica no badge/pílula de status no Header ou na Sidebar.
 * - O banner do carrossel da Home ou aba de configurações aciona o upgrade.
 * - O hook useMutationGuard intercepta uma escrita em modo somente-leitura.
 *
 * Regras: zero emojis, zero controles nativos, moeda com `whitespace-nowrap` (AGENTS.md).
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
        "Acesso completo e ilimitado a todas as ferramentas do Áxis Pro."
      }
      size="xl"
    >
      {/* Alternador de periodicidade */}
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

      {/* Card de preço e economia */}
      <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground whitespace-nowrap tabular-nums">
              {isAnnual ? annualMonthlyPrice : monthlyPrice}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">/mês</span>
          </div>
          {isAnnual && (
            <Badge variant="positive" size="xs">
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

      {/* Lista de benefícios atualizada com as novas funcionalidades */}
      <ul className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {BENEFITS.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <li
              key={benefit.title}
              className="flex items-start gap-3 rounded-lg border border-border/80 bg-surface p-3"
            >
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-positive-strong"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>{benefit.title}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                  {benefit.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Garantia e Confiança */}
      <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-muted/40 p-3">
        <ShieldCheck className="size-4 shrink-0 text-positive-strong mt-0.5" aria-hidden="true" />
        <div className="min-w-0 text-xs text-muted-foreground space-y-0.5">
          <p className="font-semibold text-foreground">
            Garantia Incondicional de 30 dias • Seus dados nunca são excluídos
          </p>
          <p className="text-[11px] leading-relaxed">
            Se optar por não continuar, seu histórico permanece acessível para consulta vitalícia. Cancelamento em 1 clique.
          </p>
        </div>
      </div>

      {/* Rodapé de ações */}
      <ModalFooter>
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
      </ModalFooter>
    </Modal>
  );
}

