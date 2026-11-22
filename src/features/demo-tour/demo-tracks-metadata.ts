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
    "Biometria física de hardware, escudo anti-captura de tela e atalhos rápidos no celular.",
  icon: Smartphone,
  iconColorClass: "text-primary-strong",
  isPrimary: true,
  badge: "Exclusivo APK",
  badgeVariant: "default",
};

export const PRIMARY_DEMO_TRACKS: readonly TrackOptionMeta[] = [
  {
    id: "finances",
    title: "Dia a dia, Cartões & Contas",
    description:
      "Saldo livre seguro, lançamento rápido, extrato unificado, faturas de cartão e tetos mensais.",
    icon: Wallet,
    iconColorClass: "text-positive-strong",
    isPrimary: true,
    badge: "5 passos · 1 min",
    badgeVariant: "default",
  },
  {
    id: "shared_finances",
    title: "Família, Viagens & Racha Pix",
    description:
      "Divisão de despesas e parcelas via Pix, Modo Viagem, Modo Família e vaquinhas coletivas.",
    icon: Users,
    iconColorClass: "text-primary-strong",
    isPrimary: true,
    badge: "4 passos",
    badgeVariant: "muted",
  },
  {
    id: "investments",
    title: "Investimentos, Preço Teto & Relatórios",
    description:
      "Carteira global, metas e governança, preço teto (Bazin, Graham, Gordon e FIIs), aportes e proventos.",
    icon: TrendingUp,
    iconColorClass: "text-portfolio",
    isPrimary: true,
    badge: "5 passos",
    badgeVariant: "muted",
  },
] as const;

export const DEMO_TRACK_CATEGORIES: readonly TourCategoryMeta[] = [
  {
    value: "finances",
    label: "Finanças",
    shortLabel: "Finanças",
    icon: Wallet,
    iconClass: "text-positive-strong",
    primaryTrack: PRIMARY_DEMO_TRACKS[0]!,
    microTracks: [
      {
        id: "finances_wizard",
        title: "Lançamento Rápido (+)",
        description: "Registro rápido de despesas, receitas, Pix e parcelamentos em até 60x.",
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
        description: "Contas a pagar, contas a receber e contratos Price/SAC com amortização.",
        icon: Coins,
        iconColorClass: "text-negative-strong",
      },
      {
        id: "finances_budgets",
        title: "Categorias e Tetos de Gastos",
        description: "Limites por categoria e alertas de ritmo para não estourar o mês.",
        icon: PieChart,
        iconColorClass: "text-negative-strong",
      },
      {
        id: "finances_insights",
        title: "Smart Advisor e Relatórios",
        description: "Alertas de economia, radar de assinaturas e fechamento mensal DRE.",
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
    primaryTrack: PRIMARY_DEMO_TRACKS[1]!,
    microTracks: [
      {
        id: "finances_split",
        title: "Racha de Despesas com Pix",
        description:
          "Divisão de contas e parcelas com amigos, cobrança por Pix e recibos via WhatsApp.",
        icon: Share2,
        iconColorClass: "text-positive-strong",
      },
      {
        id: "finances_family",
        title: "Modo Família Multi-Contas",
        description:
          "Orçamento para casais e famílias com cartões independentes e teto conjunto.",
        icon: Users,
        iconColorClass: "text-primary-strong",
      },
      {
        id: "finances_goals",
        title: "Metas Coletivas & Vaquinha Pix",
        description:
          "Vaquinha colaborativa com termômetro em tempo real, chave Pix e link público.",
        icon: Target,
        iconColorClass: "text-portfolio",
      },
      {
        id: "finances_trips",
        title: "Modo Viagem & Rateio em Grupo",
        description:
          "Viagens com múltiplos pagadores, compensação mínima e acerto via Pix.",
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
    primaryTrack: PRIMARY_DEMO_TRACKS[2]!,
    microTracks: [
      {
        id: "investments_assets",
        title: "Cadastro de Ativos / Nova Operação",
        description: "Cadastre ativos BRL/USD, registre operações e controle o saldo em caixa.",
        icon: Briefcase,
        iconColorClass: "text-portfolio",
      },
      {
        id: "investments_targets",
        title: "Metas por Classe e Ativo",
        description: "Percentuais ideais em árvore e governança para calibrar a carteira.",
        icon: Target,
        iconColorClass: "text-positive-strong",
      },
      {
        id: "investments_aporte",
        title: "Calculadora de Aporte Inteligente",
        description: "Indica onde alocar cada centavo sem vender posições e com justificativa.",
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
      title: "Personalização, Privacidade e Suporte",
      description:
        "Escudo de privacidade, temas, identidade visual, notificações e suporte direto.",
      icon: Settings,
      iconColorClass: "text-muted-foreground",
      isPrimary: true,
    },
    microTracks: [],
  },
];
