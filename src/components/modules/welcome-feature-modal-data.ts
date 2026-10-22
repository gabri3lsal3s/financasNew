import { Bell, Share2, Sparkles } from "lucide-react";

export const WELCOME_MODAL_STORAGE_KEY = "financas:welcome_feature_modal_seen";

export interface FeatureSlide {
  id: string;
  badge: string;
  title: string;
  headline: string;
  description: string;
  icon: typeof Bell;
}

export const WELCOME_SLIDES: readonly FeatureSlide[] = [
  {
    id: "notifications",
    badge: "Captura Automática",
    title: "Notificações Automáticas",
    headline: "Zero digitação manual e 100% privado",
    description:
      "O app lê compras de cartões e Pix sem você precisar abrir o aplicativo. Tudo é processado localmente no seu dispositivo, sem nunca pedir senhas bancárias.",
    icon: Bell,
  },
  {
    id: "contingency",
    badge: "Contingência Inteligente",
    title: "Contingência de Comprovantes",
    headline: "O banco não enviou push? Sem problema",
    description:
      "Compartilhe PDFs, imagens ou textos de qualquer banco se o push falhar. O motor reconhece na hora os dados da transação com alta precisão.",
    icon: Share2,
  },
  {
    id: "semantic",
    badge: "Aprendizado Contínuo",
    title: "Mágica Semântica Local",
    headline: "Inteligência que respeita seus hábitos",
    description:
      "O motor aprende seus CNPJs e estabelecimentos favoritos para nunca mais te pedir para redigitar nem reclassificar gastos repetidos.",
    icon: Sparkles,
  },
] as const;
