import { Bell, Briefcase, CreditCard, Landmark, Receipt, TrendingUp } from "lucide-react";
import type { OnboardingStepId } from "@/domain/onboarding";

export const ONBOARDING_STEP_META: Record<
  OnboardingStepId,
  { label: string; description: string; href?: string; icon: typeof Landmark }
> = {
  "cash-checkpoint": {
    label: "Informar saldo inicial",
    description: "Calibre o saldo do banco para calcular seu Caixa Real Seguro.",
    icon: Landmark,
  },
  "first-transaction": {
    label: "Registrar primeiro lançamento",
    description: "Anote uma despesa ou receita para ativar seu ritmo diário.",
    href: "/transacoes?novo=transacao",
    icon: Receipt,
  },
  card: {
    label: "Adicionar um cartão de crédito",
    description: "Acompanhe faturas futuras, limite livre e melhor dia de compra.",
    href: "/cartoes",
    icon: CreditCard,
  },
  "portfolio-asset": {
    label: "Cadastrar primeiro ativo na carteira",
    description: "Ações, FIIs, renda fixa ou ativos em dólar sob suas metas.",
    href: "/investments?novo=ativo",
    icon: Briefcase,
  },
  "portfolio-transaction": {
    label: "Registrar primeiro aporte ou compra",
    description: "Alimente o rebalanceamento e a memória de rentabilidade.",
    href: "/investments?novo=investimento",
    icon: TrendingUp,
  },
  "business-profile": {
    label: "Configurar perfil do negócio (MEI/PJ)",
    description: "Separe finanças pessoais e da empresa com DRE, DAS e Teto MEI.",
    href: "/negocio",
    icon: Briefcase,
  },
  "bank-notifications": {
    label: "Ativar leitor automático de notificações",
    description: "Captura prática de compras no cartão e Pix no celular.",
    icon: Bell,
  },
};
