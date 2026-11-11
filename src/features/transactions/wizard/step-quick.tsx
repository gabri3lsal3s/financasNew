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
import { Check, Clock, CreditCard, Sparkles, SlidersHorizontal, Users, ChevronLeft, ChevronRight, User, Plane, HandCoins } from "lucide-react";
import { Badge, Button, Input, MoneyInput, MoneyText, Select, Tabs } from "@/components/ui";
import { CategoryIcon } from "@/components/modules/category-icon";
import {
  CANONICAL_MERCHANT_CATALOG,
  matchCategoryBySlug,
  type CanonicalCategorySlug,
} from "@/domain/notifications";
import { calculateSplitSummary } from "@/domain/finance/split-math";
import { rankCategoriesByFrequency, type HabitualEntry, type PredictionEntry } from "@/domain/predictions";
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
  onFamilyChange?: (isFamily: boolean) => void;
  isFamilyModeEnabled?: boolean;
  onSplitToggle?: (enabled: boolean) => void;
  onSplitPeopleCountChange?: (count: number) => void;
  onSplitDebtModeChange?: (mode: "single_total" | "per_installment") => void;
  activeTrips?: { id: string; title: string; destination?: string | null }[];
  onTripChange?: (tripId: string | null) => void;
  /** Nome do membro pagador identificado na viagem para a conta autenticada */
  activeTripMemberName?: string;
  onSwitchToGuided: () => void;
  categories: Category[] | undefined;
  categoriesLoading?: boolean;
  predictionEntries?: readonly PredictionEntry[] | null;
  /** Lançamentos habituais derivados do histórico para atalhos em 1 toque (R31) */
  habits?: HabitualEntry[];
  /** Callback para preenchimento imediato ao tocar em um chip habitual */
  onApplyHabitual?: (habit: HabitualEntry) => void;
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
  onFamilyChange,
  isFamilyModeEnabled = false,
  onSplitToggle,
  onSplitPeopleCountChange,
  onSplitDebtModeChange,
  activeTrips,
  onTripChange,
  activeTripMemberName,
  onSwitchToGuided,
  categories,
  categoriesLoading = false,
  predictionEntries,
  habits,
  onApplyHabitual,
  cards,
  cardsLoading = false,
  onSubmit,
}: StepQuickProps) {
  const isExpense = state.type === "expense";
  const { memory } = useMerchantLearning();
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const PAGE_SIZE = 8;
  const [categoryPage, setCategoryPage] = useState(() => {
    if (!state.categoryId || !categories || categories.length === 0) return 1;
    const initialRanked = rankCategoriesByFrequency(categories, predictionEntries);
    const catIndex = initialRanked.findIndex((c) => c.id === state.categoryId);
    return catIndex !== -1 ? Math.floor(catIndex / PAGE_SIZE) + 1 : 1;
  });
  const [prevCategoryId, setPrevCategoryId] = useState(state.categoryId);

  // 1. Ordenação por frequência histórica real (§Plano 09 — Tarefas 7.1 e 7.2)
  const rankedCategories = useMemo(() => {
    return rankCategoriesByFrequency(categories ?? [], predictionEntries);
  }, [categories, predictionEntries]);

  const totalPages = Math.max(1, Math.ceil(rankedCategories.length / PAGE_SIZE));

  // 2. Auto-posicionamento na página da categoria inferida/selecionada (§Plano 09 — Tarefa 7.3)
  // Padrão React: ajustar state durante a renderização quando prop muda (sem efeito em cascata)
  if (state.categoryId !== prevCategoryId) {
    setPrevCategoryId(state.categoryId);
    if (state.categoryId && rankedCategories.length > 0) {
      const catIndex = rankedCategories.findIndex((c) => c.id === state.categoryId);
      if (catIndex !== -1) {
        setCategoryPage(Math.floor(catIndex / PAGE_SIZE) + 1);
      }
    }
  }

  // Garante que a página atual seja válida ao alterar tipo ou categorias
  const currentPage = Math.min(categoryPage, totalPages);
  const displayedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return rankedCategories.slice(startIndex, startIndex + PAGE_SIZE);
  }, [rankedCategories, currentPage]);

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

      {/* 1.1. Atalhos de 1 Toque para Lançamentos Habituais (Regra 31 do AGENTS.md) */}
      {habits && habits.length > 0 && (
        <div className="flex flex-col gap-1.5" data-testid="quick-habitual-entries">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Habituais sugeridos:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
            {habits.map((habit) => (
              <button
                key={`${habit.description}-${habit.categoryName}`}
                type="button"
                aria-label={`Usar habitual ${habit.description}: ${formatCentsAsCurrency(Math.round(habit.value * 100))}`}
                onClick={() => {
                  triggerSensory("action");
                  onApplyHabitual?.(habit);
                }}
                className="flex items-center gap-2 shrink-0 rounded-xl border border-border/80 bg-surface-raised px-3 py-1.5 text-xs text-foreground hover:border-border hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className="font-medium max-w-[120px] truncate">{habit.description}</span>
                <span className="text-muted-foreground">·</span>
                <MoneyText cents={Math.round(habit.value * 100)} tone="default" className="text-xs font-semibold tabular-nums" />
                <Badge variant="muted" size="xs">
                  {habit.categoryName}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

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
      <div className="flex flex-col gap-1.5">
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
            {displayedCategories.map((cat) => {
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
                    "relative flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-colors cursor-pointer select-none",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border/80 bg-surface hover:bg-surface-hover text-foreground",
                  )}
                >
                  {isFamilyModeEnabled && cat.is_family ? (
                    <span
                      className="absolute top-1.5 right-1.5 flex items-center justify-center text-muted-foreground"
                      title="Categoria Familiar Compartilhada"
                      aria-label="Categoria Familiar Compartilhada"
                    >
                      <Users className="size-2.5" aria-hidden="true" />
                    </span>
                  ) : null}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1 px-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              sensoryIntent="selection"
              disabled={currentPage <= 1}
              onClick={() => {
                setCategoryPage((p) => Math.max(1, p - 1));
              }}
              aria-label="Página anterior de categorias"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Anterior</span>
            </Button>
            <div className="flex items-center gap-1.5" aria-current="page">
              {Array.from({ length: totalPages }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    currentPage === i + 1 ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                />
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">
                {currentPage} de {totalPages}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              sensoryIntent="selection"
              disabled={currentPage >= totalPages}
              onClick={() => {
                setCategoryPage((p) => Math.min(totalPages, p + 1));
              }}
              aria-label="Próxima página de categorias"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Próxima</span>
            </Button>
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

      {/* 6. Contexto Rápido: Pessoal, Família, Viagem e Racha */}
      {(isFamilyModeEnabled || (isExpense && ((activeTrips && activeTrips.length > 0) || onSplitToggle))) ? (
        (() => {
          type ContextMode = "personal" | "family" | "trip" | "split";
          const activeContext: ContextMode = state.splitEnabled
            ? "split"
            : state.tripId
              ? "trip"
              : state.isFamily
                ? "family"
                : "personal";

          const handleSelectContext = (context: ContextMode) => {
            triggerSensory("selection");

            if (context === "personal") {
              onFamilyChange?.(false);
              onTripChange?.(null);
              onSplitToggle?.(false);
            } else if (context === "family") {
              onFamilyChange?.(true);
              onTripChange?.(null);
              onSplitToggle?.(false);
            } else if (context === "trip") {
              onFamilyChange?.(false);
              onSplitToggle?.(false);
              if (!state.tripId && activeTrips && activeTrips.length > 0) {
                onTripChange?.(activeTrips[0]?.id ?? null);
              }
            } else if (context === "split") {
              onFamilyChange?.(false);
              onTripChange?.(null);
              onSplitToggle?.(true);
            }
          };

          return (
            <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Contexto</span>
                {activeContext === "personal" && (
                  <span className="text-[11px] text-muted-foreground">Individual</span>
                )}
              </div>

              {/* Pílulas de Contexto Rápido */}
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Contexto do lançamento">
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeContext === "personal"}
                  onClick={() => handleSelectContext("personal")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border py-1.5 px-2.5 text-xs font-medium transition-colors cursor-pointer",
                    activeContext === "personal"
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border/80 bg-surface-raised hover:bg-surface-hover text-foreground",
                  )}
                >
                  <User className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Pessoal</span>
                </button>

                {isFamilyModeEnabled && (
                  <button
                    type="button"
                    role="radio"
                    aria-label={isExpense ? "Despesa da Casa / Familiar" : "Receita da Casa / Familiar"}
                    aria-checked={activeContext === "family"}
                    onClick={() => handleSelectContext("family")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border py-1.5 px-2.5 text-xs font-medium transition-colors cursor-pointer",
                      activeContext === "family"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/80 bg-surface-raised hover:bg-surface-hover text-foreground",
                    )}
                  >
                    <Users className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Casa</span>
                  </button>
                )}

                {isExpense && activeTrips && activeTrips.length > 0 && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={activeContext === "trip"}
                    onClick={() => handleSelectContext("trip")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border py-1.5 px-2.5 text-xs font-medium transition-colors cursor-pointer",
                      activeContext === "trip"
                        ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold"
                        : "border-border/80 bg-surface-raised hover:bg-surface-hover text-foreground",
                    )}
                  >
                    <Plane className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Viagem</span>
                  </button>
                )}

                {isExpense && onSplitToggle && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={activeContext === "split"}
                    aria-label="Rachar com amigos"
                    onClick={() => handleSelectContext("split")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border py-1.5 px-2.5 text-xs font-medium transition-colors cursor-pointer",
                      activeContext === "split"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/80 bg-surface-raised hover:bg-surface-hover text-foreground",
                    )}
                  >
                    <HandCoins className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Rachar</span>
                  </button>
                )}
              </div>

              {/* Conteúdo Contextual Conforme Seleção */}
              {activeContext === "family" ? (
                <div className="pt-2 border-t border-border/60">
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Users className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                    <span>Visível no <strong>Painel Familiar compartilhado</strong>.</span>
                  </p>
                </div>
              ) : null}

              {isExpense && activeContext === "trip" && activeTrips && activeTrips.length > 0 ? (
                <div className="pt-2 border-t border-border/60 flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">Viagem Vinculada</span>
                  <Select
                    ariaLabel="Vincular à viagem"
                    value={state.tripId ?? activeTrips[0]?.id ?? ""}
                    onValueChange={(val) => onTripChange?.(val || null)}
                    options={activeTrips.map((t) => ({
                      value: t.id,
                      label: t.destination ? `${t.title} (${t.destination})` : t.title,
                    }))}
                  />
                  {activeTripMemberName ? (
                    <p className="text-[11px] text-muted-foreground">
                      Pagador: <strong className="text-foreground font-semibold">{activeTripMemberName}</strong> (Você)
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isExpense && activeContext === "split" ? (
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">Participantes:</span>
                    <div className="flex items-center gap-1">
                      {[2, 3, 4, 5].map((count) => {
                        const isSelected = state.splitPeopleCount === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => {
                              triggerSensory("selection");
                              onSplitPeopleCountChange?.(count);
                            }}
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                              isSelected
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border/80 bg-surface-raised hover:bg-surface-hover text-foreground",
                            )}
                          >
                            {count}p
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {state.valueCents > 0 ? (
                    (() => {
                      const splitMath = calculateSplitSummary(state.valueCents, state.splitPeopleCount, {
                        remainderPolicy: "host",
                      });
                      const hostShareFormatted = (splitMath.hostShareCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      });
                      const guestShareFormatted = (splitMath.guestShareCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      });
                      return (
                        <>
                          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-raised px-2.5 py-1.5 text-xs">
                            <span className="text-muted-foreground">
                              Sua parte: <strong className="text-foreground">{hostShareFormatted}</strong>
                            </span>
                            <span className="text-portfolio font-medium">
                              {splitMath.guestCount}x de {guestShareFormatted}
                            </span>
                          </div>

                          {state.installments > 1 ? (
                            <div className="pt-2 border-t border-border/60 space-y-1.5">
                              <span className="text-[11px] font-semibold text-foreground block">
                                Recebimento do rateio:
                              </span>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onSplitDebtModeChange?.("single_total")}
                                  className={cn(
                                    "rounded-md border p-1.5 text-left text-[11px] transition-colors cursor-pointer",
                                    state.splitDebtMode === "single_total"
                                      ? "border-primary bg-primary/10 text-primary font-semibold"
                                      : "border-border/80 bg-surface hover:bg-surface-hover text-foreground",
                                  )}
                                >
                                  À vista (1x total)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSplitDebtModeChange?.("per_installment")}
                                  className={cn(
                                    "rounded-md border p-1.5 text-left text-[11px] transition-colors cursor-pointer",
                                    state.splitDebtMode === "per_installment"
                                      ? "border-primary bg-primary/10 text-primary font-semibold"
                                      : "border-border/80 bg-surface hover:bg-surface-hover text-foreground",
                                  )}
                                >
                                  Mês a mês ({state.installments}x)
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      );
                    })()
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })()
      ) : null}

      {/* 7. Botão de Alternância para o Modo Guiado */}
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
