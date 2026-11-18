import {
  Briefcase,
  Calculator,
  Coins,
  CreditCard,
  Lightbulb,
  PieChart,
  Plane,
  PlusCircle,
  Settings,
  Share2,
  Smartphone,
  Target,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { TourTrackId } from "@/domain/demo-simulation";
import type { BadgeProps } from "@/components/ui";

export interface TrackOptionMeta {
  id: TourTrackId;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColorClass?: string;
  isPrimary?: boolean;
  badge?: string;
  badgeVariant?: BadgeProps["variant"];
}

export interface TourCategoryMeta {
  value: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  iconClass: string;
  primaryTrack: TrackOptionMeta;
  microHeaderBadge?: string;
  microTracks: readonly TrackOptionMeta[];
}

export const NATIVE_APK_TRACK: TrackOptionMeta = {
  id: "app_native_apk",
  title: "Bem-vindo ao App Nativo Android",
  description:
    "O Tripé de Plataformas, biometria física de hardware, escudo anti-print e atualizações diretas.",
  icon: Smartphone,
  iconColorClass: "text-primary-strong",
  isPrimary: true,
  badge: "Exclusivo APK",
  badgeVariant: "default",
};

export const DEMO_TRACK_CATEGORIES: readonly TourCategoryMeta[] = [
  {
    value: "finances",
    label: "Finanças",
    shortLabel: "Finanças",
    icon: Wallet,
    iconClass: "text-positive-strong",
    primaryTrack: {
      id: "finances",
      title: "Finanças Diárias & Cartões",
      description:
        "Jornada sequencial completa com saldo livre, wizard, lançamentos, cartões, parcelas, tetos e relatórios.",
      icon: Wallet,
      iconColorClass: "text-positive-strong",
      isPrimary: true,
    },
    microTracks: [
      {
        id: "finances_wizard",
        title: "Lançamentos",
        description: "Registro rápido de despesas, receitas, Pix e parcelamentos inteligentes.",
        icon: PlusCircle,
        iconColorClass: "text-primary-strong",
      },
      {
        id: "finances_cards",
        title: "Cartões, Faturas e Limites",
        description: "Faturas abertas, limite disponível, melhor dia de compra e parcelas futuras.",
        icon: CreditCard,
        iconColorClass: "text-warning-strong",
      },
      {
        id: "finances_debts",
        title: "Contas, Dívidas e Contratos",
        description: "Controle de contas a pagar, recebíveis e contratos de crédito Price/SAC.",
        icon: Coins,
        iconColorClass: "text-negative-strong",
      },
      {
        id: "finances_budgets",
        title: "Categorias e Tetos de Gastos",
        description: "Definição de tetos por categoria e alertas automáticos de ritmo de consumo.",
        icon: PieChart,
        iconColorClass: "text-negative-strong",
      },
      {
        id: "finances_insights",
        title: "Smart Advisor e Relatórios",
        description: "Recomendações automáticas de economia, radar de assinaturas e fechamento do mês.",
        icon: Lightbulb,
        iconColorClass: "text-primary-strong",
      },
    ],
  },
  {
    value: "shared",
    label: "Finanças Compartilhadas",
    shortLabel: "Compartilhadas",
    icon: Users,
    iconClass: "text-primary-strong",
    microHeaderBadge: "Finanças Compartilhadas",
    primaryTrack: {
      id: "shared_finances",
      title: "Finanças Compartilhadas & Modo Família",
      description:
        "Jornada completa de finanças colaborativas, divisão de despesas via Pix, termômetro de metas e orçamento familiar unificado.",
      icon: Users,
      iconColorClass: "text-primary-strong",
      isPrimary: true,
    },
    microTracks: [
      {
        id: "finances_split",
        title: "Racha de Despesas com Pix",
        description:
          "Divisão inteligente de contas e eventos com amigos, cobrança por Pix e recibos automáticos via WhatsApp.",
        icon: Share2,
        iconColorClass: "text-positive-strong",
      },
      {
        id: "finances_family",
        title: "Modo Família Multi-Contas",
        description:
          "Gestão orçamentária para casais e famílias com cartões independentes, teto conjunto e equilíbrio sem atrito.",
        icon: Users,
        iconColorClass: "text-primary-strong",
      },
      {
        id: "finances_goals",
        title: "Metas Coletivas & Vaquinha Pix",
        description:
          "Vaquinha colaborativa com termômetro em tempo real, chave Pix para arrecadação e prestação de contas pública.",
        icon: Target,
        iconColorClass: "text-portfolio",
      },
      {
        id: "finances_trips",
        title: "Modo Viagem & Rateio em Grupo",
        description:
          "Controle compartilhado de viagens com amigos, múltiplos pagadores, compensação mínima de saldos e acerto via Pix sem atrito.",
        icon: Plane,
        iconColorClass: "text-warning-strong",
      },
    ],
  },
  {
    value: "investments",
    label: "Investimentos",
    shortLabel: "Investimentos",
    icon: TrendingUp,
    iconClass: "text-portfolio",
    primaryTrack: {
      id: "investments",
      title: "Investimentos & Rebalanceamento",
      description:
        "Jornada patrimonial completa com visão geral, nova operação, metas de alocação, aportes e proventos.",
      icon: TrendingUp,
      iconColorClass: "text-portfolio",
      isPrimary: true,
    },
    microTracks: [
      {
        id: "investments_assets",
        title: "Cadastro de Ativos / Nova Operação",
        description: "Cadastre ativos, registre operações e controle saldo em caixa.",
        icon: Briefcase,
        iconColorClass: "text-portfolio",
      },
      {
        id: "investments_targets",
        title: "Metas por Classe e Setor",
        description: "Percentuais ideais por classe e setor para calibrar a exposição ao risco.",
        icon: Target,
        iconColorClass: "text-positive-strong",
      },
      {
        id: "investments_aporte",
        title: "Calculadora de Aporte Inteligente",
        description: "Motor matemático que calcula onde alocar cada centavo para rebalancear.",
        icon: Calculator,
        iconColorClass: "text-primary-strong",
      },
    ],
  },
  {
    value: "settings",
    label: "Ajustes & Suporte",
    shortLabel: "Ajustes",
    icon: Settings,
    iconClass: "text-muted-foreground",
    primaryTrack: {
      id: "settings_support",
      title: "Personalização, Modos Visuais e Suporte",
      description:
        "Atalhos de privacidade, modos de experiência, identidade visual, notificações e canal direto de atendimento.",
      icon: Settings,
      iconColorClass: "text-muted-foreground",
      isPrimary: true,
    },
    microTracks: [],
  },
];
