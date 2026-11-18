import { Briefcase, Bell, CreditCard, Receipt, Tag, TrendingUp } from "lucide-react";
import type { OnboardingStepId } from "@/domain/onboarding";

export const ONBOARDING_STEP_META: Record<
  OnboardingStepId,
  { label: string; description: string; href?: string; icon: typeof Tag }
> = {
  "expense-category": {
    label: "Crie categorias de despesa",
    description: "Classifique seus gastos desde o início.",
    href: "/orcamentos?tab=categories&novo=categoria",
    icon: Tag,
  },
  "income-category": {
    label: "Crie categorias de renda",
    description: "Separe salário, freelas e outras entradas.",
    href: "/orcamentos?tab=categories&novo=categoria",
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
  "portfolio-asset": {
    label: "Cadastre seu primeiro ativo",
    description: "Ações, FIIs, renda fixa ou fundos na sua carteira.",
    href: "/investments?novo=ativo",
    icon: Briefcase,
  },
  "portfolio-transaction": {
    label: "Registre o primeiro aporte ou compra",
    description: "Alimente o motor de rebalanceamento patrimonial.",
    href: "/investments?novo=investimento",
    icon: TrendingUp,
  },
  "bank-notifications": {
    label: "Ativar Leitor Automático de Notificações",
    description: "Captura de compras de cartão e Pix em segundo plano.",
    icon: Bell,
  },
};
