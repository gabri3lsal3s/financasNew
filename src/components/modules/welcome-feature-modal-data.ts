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
    badge: "Captura Universal",
    title: "Comprovantes e Cupons Fiscais",
    headline: "Pix, cartões parcelados, boletos e notas fiscais",
    description:
      "Compartilhe ou anexe comprovantes Pix, cupons fiscais (NFC-e/SAT com múltiplos itens), boletos, carnês e comprovantes de maquininhas de cartão. O motor extrai totais, parcelamentos e dados do emissor automaticamente via OCR local.",
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
