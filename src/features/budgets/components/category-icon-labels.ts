import type { IconPickerOption } from "@/components/ui";
import { CATEGORY_ICON_MAP } from "@/components/modules/category-icons";

/**
 * Rótulos canônicos em pt-BR com acentuação correta para exibição no IconPicker.
 * Os valores/slugs persistidos no banco (`categories.icon`) permanecem inalterados.
 */
export const CATEGORY_ICON_LABELS: Record<string, string> = {
  alimentacao: "Alimentação",
  mercado: "Mercado",
  transporte: "Transporte",
  moradia: "Moradia",
  lazer: "Lazer",
  saude: "Saúde",
  educacao: "Educação",
  salario: "Salário",
  investimentos: "Investimentos",
  assinaturas: "Assinaturas",
  vestuario: "Vestuário",
  compras: "Compras",
  pets: "Pets",
  telefone: "Telefone",
  energia: "Energia",
  agua: "Água",
  internet: "Internet",
  impostos: "Impostos",
  tributos: "Tributos",
  juros: "Juros",
  multas: "Multas",
  taxas: "Taxas",
  emprestimo: "Empréstimo",
  justica: "Justiça",
  cartao: "Cartão",
};

/** Opções de ícone (`lucide-react`, sem emojis) com labels pt-BR para o IconPicker. */
export const CATEGORY_ICON_OPTIONS: IconPickerOption[] = Object.entries(CATEGORY_ICON_MAP).map(
  ([slug, icon]) => ({
    value: slug,
    label: CATEGORY_ICON_LABELS[slug] ?? slug,
    icon,
  }),
);
