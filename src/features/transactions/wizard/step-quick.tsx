/**
 * Modo de Lançamento Rápido em Tela Única (StepQuick) — Fase 3, Tarefa 3.1.
 *
 * Permite realizar lançamentos manuais em menos de 3 segundos com:
 * - Abas Tipo (Despesa / Renda)
 * - Valor em destaque (MoneyInput)
 * - Grade compacta de Categorias selecionáveis em 1 toque
 * - Seletor rápido de Forma de Pagamento (com dropdown de cartões quando Cartão de Crédito)
 * - Campo de Descrição com autocompletar inteligente via MerchantLearningEngine (aprendizado + catálogo de marcas)
 * - Botão "Mais opções" para transição suave para o modo guiado
 *
 * Zero emojis, zero controles nativos, 100% acessível e responsivo.
 */

import { useMemo, useState } from "react";
import { Check, CreditCard, Sparkles, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Input, MoneyInput, Select, Tabs } from "@/components/ui";
import { CategoryIcon } from "@/components/modules/category-icon";
import {
  CANONICAL_MERCHANT_CATALOG,
  matchCategoryBySlug,
  type CanonicalCategorySlug,
} from "@/domain/notifications";
import { useMerchantLearning } from "@/services/merchant-learning";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsCurrency } from "@/services/masks";
import { cn } from "@/lib/utils";
import type { Category, PaymentMethod, ReceiveType } from "@/types";
import type { EntryType, LaunchState } from "./wizard-state";

export interface StepQuickProps {
  state: LaunchState;
  onTypeChange: (type: EntryType) => void;
  onValueChange: (cents: number) => void;
  onCategoryChange: (categoryId: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCardChange: (cardId: string) => void;
  onInstallmentsChange?: (installments: number) => void;
  isCategoryUnconfirmed?: boolean;
  onReceiveTypeChange: (type: ReceiveType) => void;
  onDescriptionChange: (description: string) => void;
  onSwitchToGuided: () => void;
  categories: Category[] | undefined;
  categoriesLoading?: boolean;
  cards: { id: string; name: string }[] | undefined;
  cardsLoading?: boolean;
  onSubmit?: () => void;
}

const EXPENSE_PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit", label: "Débito" },
  { value: "cash", label: "Dinheiro" },
];

const INCOME_RECEIVE_TYPES: { value: ReceiveType; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "transfer", label: "Transferência" },
  { value: "cash", label: "Dinheiro" },
  { value: "other", label: "Outro" },
];

interface AutoCompleteSuggestion {
  friendlyName: string;
  categorySlug?: string;
  source: "learned" | "catalog";
}

export function StepQuick({
  state,
  onTypeChange,
  onValueChange,
  onCategoryChange,
  onPaymentMethodChange,
  onCardChange,
  onInstallmentsChange,
  isCategoryUnconfirmed = false,
  onReceiveTypeChange,
  onDescriptionChange,
  onSwitchToGuided,
  categories,
  categoriesLoading = false,
  cards,
  cardsLoading = false,
  onSubmit,
}: StepQuickProps) {
  const isExpense = state.type === "expense";
  const { memory } = useMerchantLearning();
  const [descriptionFocused, setDescriptionFocused] = useState(false);

  // Opções de parcelamento calculadas dinamicamente com base no valor atual
  const installmentOptions = useMemo(() => {
    const list = [];
    for (let i = 1; i <= 12; i++) {
      const label =
        i === 1
          ? `1x (à vista)${state.valueCents > 0 ? ` · ${formatCentsAsCurrency(state.valueCents)}` : ""}`
          : `${i}x${state.valueCents > 0 ? ` de ${formatCentsAsCurrency(Math.round(state.valueCents / i))}` : ""}`;
      list.push({ value: String(i), label });
    }
    return list;
  }, [state.valueCents]);

  // Sugestões de autocompletar inteligente pelo MerchantLearningEngine (aprendizado do usuário + catálogo canônico)
  const suggestions = useMemo<AutoCompleteSuggestion[]>(() => {
    const query = state.description.trim().toLowerCase();
    if (query.length < 2) return [];

    const results: AutoCompleteSuggestion[] = [];
    const seenNames = new Set<string>();

    // 1. Memória adaptativa aprendida do usuário (prioridade máxima)
    for (const record of Object.values(memory)) {
      const normFriendly = record.friendlyName.toLowerCase();
      const matchName = normFriendly.includes(query);
      const matchAlias = record.rawAliases.some((a) => a.toLowerCase().includes(query));

      if ((matchName || matchAlias) && !seenNames.has(record.friendlyName)) {
        seenNames.add(record.friendlyName);
        results.push({
          friendlyName: record.friendlyName,
          categorySlug: record.categorySlug,
          source: "learned",
        });
      }
      if (results.length >= 3) break;
    }

    // 2. Catálogo canônico de marcas brasileiras (fallback)
    if (results.length < 3) {
      for (const entry of CANONICAL_MERCHANT_CATALOG) {
        const normName = entry.friendlyName.toLowerCase();
        const matchName = normName.includes(query);
        const matchKw = entry.keywords.some((k) => k.toLowerCase().includes(query));

        if ((matchName || matchKw) && !seenNames.has(entry.friendlyName)) {
          seenNames.add(entry.friendlyName);
          results.push({
            friendlyName: entry.friendlyName,
            categorySlug: entry.categorySlug,
            source: "catalog",
          });
        }
        if (results.length >= 3) break;
      }
    }

    return results;
  }, [state.description, memory]);

  // Ao selecionar uma sugestão, preenche a descrição e auto-seleciona a categoria
  const handleApplySuggestion = (suggestion: AutoCompleteSuggestion) => {
    triggerSensory("action");
    onDescriptionChange(suggestion.friendlyName);

    if (suggestion.categorySlug && categories && categories.length > 0) {
      const matched = matchCategoryBySlug(
        categories,
        suggestion.categorySlug as CanonicalCategorySlug,
      );
      if (matched) {
        onCategoryChange(matched.id);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Abas Tipo (Despesa / Renda) — fullWidth={true} para <= 3 itens (Regra DRY #9) */}
      <Tabs
        value={state.type}
        fullWidth
        onValueChange={(val) => {
          onTypeChange(val as EntryType);
        }}
        items={[
          { value: "expense", label: "Despesa", content: null },
          { value: "income", label: "Renda", content: null },
        ]}
      />

      {/* 2. Campo de Valor em Destaque */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="quick-value-input" className="text-xs font-semibold text-foreground">
          Valor
        </label>
        <MoneyInput
          id="quick-value-input"
          cents={state.valueCents}
          onCentsChange={onValueChange}
          aria-label="Valor do lançamento"
          onKeyDown={(event) => {
            if (event.key === "Enter" && state.valueCents > 0) {
              event.preventDefault();
              onSubmit?.();
            }
          }}
        />
      </div>

      {/* 3. Campo de Descrição com Autocompletar Semântico */}
      <div className="flex flex-col gap-1.5 relative">
        <label htmlFor="quick-description-input" className="text-xs font-semibold text-foreground">
          Descrição / Estabelecimento
        </label>
        <Input
          id="quick-description-input"
          value={state.description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={isExpense ? "Ex: Padaria do Zé, Uber, Mercado..." : "Ex: Salário, Rendimentos, Pix..."}
          onFocus={() => setDescriptionFocused(true)}
          onBlur={() => {
            // Pequeno delay para permitir o clique no botão da sugestão
            setTimeout(() => setDescriptionFocused(false), 200);
          }}
        />

        {/* Pílulas de Sugestão Inteligente */}
        {descriptionFocused && suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground mr-1">
              <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />
              Sugestões:
            </span>
            {suggestions.map((s) => (
              <button
                key={s.friendlyName}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // Impede perda imediata de foco
                onClick={() => handleApplySuggestion(s)}
                className="flex items-center gap-1 rounded-md border border-border/80 bg-surface-raised px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-hover hover:border-border transition-colors cursor-pointer"
              >
                <span>{s.friendlyName}</span>
                {s.source === "learned" ? (
                  <Badge variant="muted" size="xs">
                    Memorizado
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Grade Compacta de Categorias em 1 Toque */}
      <div
        className={cn(
          "flex flex-col gap-1.5 rounded-xl transition-colors",
          isCategoryUnconfirmed && "p-2 border border-warning-border bg-warning/5 ring-1 ring-warning-border/40",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Categoria</span>
            {isCategoryUnconfirmed && (
              <Badge variant="warning" size="xs">
                Confirmar categoria
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">Toque para selecionar</span>
        </div>

        {categoriesLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="h-16 rounded-xl border border-border/80 bg-surface/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {(categories ?? []).slice(0, 8).map((cat) => {
              const isSelected = state.categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onCategoryChange(cat.id);
                  }}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-colors cursor-pointer select-none",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border/80 bg-surface hover:bg-surface-hover text-foreground",
                  )}
                >
                  <span className="flex size-7 items-center justify-center shrink-0">
                    <CategoryIcon icon={cat.icon} color={cat.color} className="size-4" />
                  </span>
                  <span className="text-[11px] font-medium leading-tight truncate max-w-full text-center">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Seletor Rápido de Forma de Pagamento */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">
          {isExpense ? "Forma de Pagamento" : "Forma de Recebimento"}
        </span>

        {isExpense ? (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {EXPENSE_PAYMENT_METHODS.map((method) => {
                const isSelected = state.paymentMethod === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => {
                      triggerSensory("selection");
                      onPaymentMethodChange(method.value);
                    }}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border py-2 px-3 text-xs font-medium transition-colors cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/80 bg-surface hover:bg-surface-hover text-foreground",
                    )}
                  >
                    {isSelected && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                    <span>{method.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Opções de Cartão e Parcelamento */}
            {(state.paymentMethod === "credit_card" || (state.installments ?? 1) > 1) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {state.paymentMethod === "credit_card" && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      Cartão de Crédito
                    </span>
                    <Select
                      ariaLabel="Selecione o cartão de crédito"
                      value={state.cardId ?? ""}
                      onValueChange={(val) => onCardChange(val)}
                      disabled={cardsLoading}
                      options={(cards ?? []).map((card) => ({
                        value: card.id,
                        label: card.name,
                      }))}
                      placeholder={cardsLoading ? "Carregando cartões..." : "Selecione o cartão"}
                    />
                  </div>
                )}

                {onInstallmentsChange && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      Parcelas
                    </span>
                    <Select
                      ariaLabel="Número de parcelas"
                      value={String(state.installments || 1)}
                      onValueChange={(val) => onInstallmentsChange(Number(val) || 1)}
                      options={installmentOptions}
                      placeholder="Selecione as parcelas"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {INCOME_RECEIVE_TYPES.map((type) => {
              const isSelected = state.receiveType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onReceiveTypeChange(type.value);
                  }}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border py-2 px-3 text-xs font-medium transition-colors cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/80 bg-surface hover:bg-surface-hover text-foreground",
                  )}
                >
                  {isSelected && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Botão de Alternância para o Modo Guiado */}
      <div className="pt-2 border-t border-border/80 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            triggerSensory("selection");
            onSwitchToGuided();
          }}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
        >
          <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Mais opções (parcelas, fixo, data retroativa)</span>
        </Button>
      </div>
    </div>
  );
}
