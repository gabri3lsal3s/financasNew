import { RECEIVE_TYPE_LABELS } from "@/lib/labels";

export type TripDeleteMode = "both" | "personal_only";

export const MODE_OPTIONS = [
  { value: "single", label: "Apenas esta parcela" },
  { value: "all", label: "Todas as parcelas" },
  { value: "subsequent", label: "Esta parcela e as seguintes" },
];

/** Modos de exclusão para recorrências (Fase 32) — ocorrências, não parcelas. */
export const RECURRENCE_MODE_OPTIONS = [
  { value: "single", label: "Apenas esta ocorrência" },
  { value: "all", label: "Todas as ocorrências" },
  { value: "subsequent", label: "Esta ocorrência e as seguintes" },
];

/** Escopo da edição em grupo (Fase 32) — rótulos genéricos (parcela/ocorrência). */
export const EDIT_SCOPE_OPTIONS = [
  { value: "single", label: "Apenas este lançamento" },
  { value: "all", label: "Todos do grupo" },
  { value: "subsequent", label: "Este e os seguintes" },
];

export const PAYMENT_OPTIONS = [
  { value: "pix", label: "Pix" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

export const RECEIVE_OPTIONS = Object.entries(RECEIVE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Chave de mês válida AAAA-MM (validação da competência editada manualmente). */
export const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
