import {
  Car,
  CreditCard,
  Droplets,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Home,
  PawPrint,
  Receipt,
  Repeat,
  Shirt,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Mapa de ícones de categoria (nome salvo no schema `categories.icon`).
 * Adicionar nomes aqui em vez de duplicar ícones soltos nas telas (DRY).
 * Arquivo separado do componente (regra react-refresh: apenas componentes).
 */
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  alimentacao: Utensils,
  mercado: ShoppingCart,
  transporte: Car,
  moradia: Home,
  lazer: Gamepad2,
  saude: HeartPulse,
  educacao: GraduationCap,
  salario: Wallet,
  investimentos: TrendingUp,
  assinaturas: Repeat,
  vestuario: Shirt,
  pets: PawPrint,
  telefone: Smartphone,
  energia: Zap,
  agua: Droplets,
  internet: Wifi,
  impostos: Receipt,
  cartao: CreditCard,
};

/** Opções para os formulários de seleção de ícone (mesmo map, sem duplicação). */
export const CATEGORY_ICON_OPTIONS = Object.keys(CATEGORY_ICON_MAP).sort();

export type { LucideIcon };
