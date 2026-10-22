import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, Check, ChevronDown, Paperclip, Receipt, Trash2, TrendingUp, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryIcon } from "@/components/modules/category-icon";
import { AttachReceiptDialog } from "./attach-receipt-dialog";
import { formatDateBR } from "@/lib/date";
import {
  addPendingSuggestion,
  clearPendingSuggestions,
  dismissPendingSuggestion,
  storeMerchantCategory,
  useMerchantCategoryMapping,
  usePendingSuggestions,
} from "@/services/native";
import {
  useActiveCreditCards,
  useCategories,
  useCreateExpense,
  useCreateIncome,
  useCreateIncomeInstallments,
  useDeleteExpense,
  useDeleteIncome,
} from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { formatCentsAsCurrency } from "@/services/masks";
import { getErrorMessage } from "@/services/errors";
import { autoLearnExpenseCategory } from "@/services/merchant-learning";
import { cn } from "@/lib/utils";
import {
  inferCategoryKeyword,
  lookupMerchantCategory,
  type MerchantCategoryMapping,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import { findBestMatchingCategory } from "@/domain/insights";
import { buildExpenseInstallments, buildIncomeInstallments } from "@/features/transactions/wizard/wizard-state";
import type { Category, ReceiveType } from "@/types";

export interface PendingSuggestionsCardProps {
  className?: string;
  onSuggestionHandled?: (id: string) => void;
}

function resolveCategoryForSuggestion(
  sug: ParsedBankTransaction,
  categories: Category[],
  selectedId?: string,
  merchantMemory?: MerchantCategoryMapping,
): Category | undefined {
  if (selectedId) {
    const found = categories.find((c) => c.id === selectedId);
    if (found) return found;
  }
  // 1. Memória adaptativa aprendida de estabelecimentos
  if (sug.merchant && merchantMemory) {
    const memorized = lookupMerchantCategory(sug.merchant, merchantMemory);
    if (memorized) {
      const found = categories.find(
        (c) =>
          c.id === memorized ||
          c.icon === memorized ||
          c.name.toLowerCase().includes(memorized.toLowerCase()),
      );
      if (found) return found;
    }
  }
  if (sug.categorySlug) {
    const match = findBestMatchingCategory(categories, sug.categorySlug);
    if (match) return match;
  }
  const inferredSlug = inferCategoryKeyword(sug.description || sug.merchant || "");
  if (inferredSlug) {
    const match = findBestMatchingCategory(categories, inferredSlug);
    if (match) return match;
  }
  return (
    categories.find(
      (c) =>
        c.name.toLowerCase().includes("outros") ||
        c.name.toLowerCase().includes("geral") ||
        c.name.toLowerCase().includes("diversos"),
    ) || categories[0]
  );
}

export function PendingSuggestionsCard({
  className,
  onSuggestionHandled,
}: PendingSuggestionsCardProps) {
  const navigate = useNavigate();
  const suggestions = usePendingSuggestions();

  const expenseCategoriesQuery = useCategories("expense");
  const incomeCategoriesQuery = useCategories("income");
  const cardsQuery = useActiveCreditCards();

  const createExpenseMutation = useCreateExpense();
  const deleteExpenseMutation = useDeleteExpense();
  const createIncomeMutation = useCreateIncome();
  const createIncomeInstallmentsMutation = useCreateIncomeInstallments();
  const deleteIncomeMutation = useDeleteIncome();

  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const merchantMemory = useMerchantCategoryMapping();

  if (suggestions.length === 0) {
    return null;
  }


  const handleReview = (sug: ParsedBankTransaction, categoryId?: string) => {
    onSuggestionHandled?.(sug.id);
    const inferredSlug = categoryId || sug.categorySlug || inferCategoryKeyword(sug.description);
    const params = new URLSearchParams({
      novo: sug.type,
      valor: String(sug.amountCents),
      descricao: sug.description,
      data: sug.date,
      forma: sug.paymentMethod || "pix",
      sug_id: sug.id,
    });
    if (inferredSlug) {
      params.set("categoria", inferredSlug);
    }
    if (sug.installments && sug.installments > 1) {
      params.set("parcelas", String(sug.installments));
    }
    navigate(`/?${params.toString()}`);
  };

  const handleInvestmentRouting = (sug: ParsedBankTransaction) => {
    triggerSensory("action");
    onSuggestionHandled?.(sug.id);
    dismissPendingSuggestion(sug.id);

    const isDividend = sug.investmentSubtype === "dividend";
    const params = new URLSearchParams();

    if (isDividend) {
      params.set("tab", "proventos");
      params.set("subtab", "calendario");
      params.set("novo", "provento");
    } else {
      params.set("tab", "aporte");
      params.set("novo", "investimento");
    }

    params.set("valor", String(sug.amountCents));
    if (sug.assetTicker) {
      params.set("ticker", sug.assetTicker);
    }
    if (sug.description) {
      params.set("descricao", sug.description);
    }
    params.set("data", sug.date);
    params.set("sug_id", sug.id);

    navigate(`/investimentos?${params.toString()}`);
  };

  const handleQuickSave = async (
    sug: ParsedBankTransaction,
    category?: Category,
  ) => {
    triggerSensory("success");

    onSuggestionHandled?.(sug.id);
    dismissPendingSuggestion(sug.id);

    const categoryId = category?.id ?? "";
    const categoryName = category?.name ?? (sug.type === "income" ? "Renda" : "Geral");

    try {
      let createdId = "";

      if (sug.type === "expense") {
        let cardId: string | null = null;
        let closingDay: number | null = null;

        if (sug.paymentMethod === "credit_card") {
          const cards = cardsQuery.data ?? [];
          const matchingCard =
            cards.find((card) =>
              card.name.toLowerCase().includes(sug.bankName.toLowerCase()),
            ) || cards[0];

          if (matchingCard) {
            cardId = matchingCard.id;
            closingDay = matchingCard.closing_day;
          }
        }

        const count = sug.installments && sug.installments > 1 ? sug.installments : 1;
        const installments = buildExpenseInstallments({
          totalCents: sug.amountCents,
          count,
          startDate: sug.date,
          closingDay,
        });

        createdId = await createExpenseMutation.mutateAsync({
          value: sug.amountCents / 100,
          date: sug.date,
          categoryId,
          paymentMethod: sug.paymentMethod || "other",
          cardId,
          description: sug.description || null,
          reportWeight: 1,
          installments,
        });
      } else {
        const receiveType: ReceiveType =
          sug.paymentMethod === "pix"
            ? "pix"
            : sug.paymentMethod === "transfer"
              ? "transfer"
              : "other";

        if (sug.installments && sug.installments > 1) {
          const installments = buildIncomeInstallments({
            totalCents: sug.amountCents,
            count: sug.installments,
            startDate: sug.date,
          });

          createdId = await createIncomeInstallmentsMutation.mutateAsync({
            value: sug.amountCents / 100,
            date: sug.date,
            categoryId,
            receiveType,
            description: sug.description || null,
            reportWeight: 1,
            installments,
          });
        } else {
          const row = await createIncomeMutation.mutateAsync({
            value: sug.amountCents / 100,
            date: sug.date,
            category_id: categoryId,
            receive_type: receiveType,
            description: sug.description || null,
            report_weight: 1,
            source_ref: null,
          });
          createdId = row.id;
        }
      }

      if (sug.merchant && categoryId) {
        storeMerchantCategory(sug.merchant, categoryId);
      }

      if (sug.type === "expense" && categoryId) {
        autoLearnExpenseCategory(
          sug.merchant || sug.description || "",
          categoryId,
          sug.taxId,
          sug.rawText || sug.description,
        );
      }

      const formattedAmount = formatCentsAsCurrency(sug.amountCents);
      const typeLabel = sug.type === "income" ? "Renda" : "Despesa";


      pushToast({
        title: `${typeLabel} de ${formattedAmount} salva em ${categoryName}`,
        variant: "success",
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            void handleUndo(createdId, sug.type, sug);
          },
        },
      });
    } catch (err) {
      addPendingSuggestion(sug);
      pushToast({
        title: "Não foi possível salvar",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleUndo = async (
    createdId: string,
    type: "expense" | "income",
    suggestion: ParsedBankTransaction,
  ) => {
    try {
      triggerSensory("toggle");
      if (type === "expense") {
        await deleteExpenseMutation.mutateAsync({ expenseId: createdId, mode: "single" });
      } else {
        await deleteIncomeMutation.mutateAsync(createdId);
      }
      addPendingSuggestion(suggestion);
      pushToast({
        title: "Lançamento desfeito",
        description: "A notificação retornou à fila de sugestões.",
        variant: "default",
      });
    } catch (err) {
      pushToast({
        title: "Não foi possível desfazer",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleDismiss = (id: string) => {
    onSuggestionHandled?.(id);
    dismissPendingSuggestion(id);
  };

  const handleDismissAll = () => {
    clearPendingSuggestions();
  };

  return (
    <div
      role="region"
      aria-label="Sugestões de transações detectadas"
      className={cn(
        "rounded-2xl border border-border/80 bg-surface shadow-xs p-4 sm:p-5 flex flex-col gap-3.5 transition-all animate-in fade-in slide-in-from-top-2 duration-200",
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Transações Detectadas
          </h2>
          <Badge variant="muted" size="xs">
            {suggestions.length === 1 ? "1 pendente" : `${suggestions.length} pendentes`}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setPasteOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground hover:bg-surface-hover cursor-pointer gap-1"
            aria-label="Anexar comprovante"
          >
            <Paperclip className="size-3.5" aria-hidden="true" />
            <span>Anexar comprovante</span>
          </Button>

          {suggestions.length >= 2 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleDismissAll}
              className="text-xs text-muted-foreground hover:text-negative-strong hover:bg-surface-hover self-start sm:self-auto cursor-pointer"
              aria-label="Descartar todas as sugestões"
            >
              <Trash2 className="size-3.5 mr-1" aria-hidden="true" />
              <span>Descartar todas</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 divide-y divide-border/40">
        {suggestions.map((sug) => {
          const availableCategories =
            sug.type === "income"
              ? incomeCategoriesQuery.data ?? []
              : expenseCategoriesQuery.data ?? [];

          const resolvedCategory = resolveCategoryForSuggestion(
            sug,
            availableCategories,
            selectedCategories[sug.id],
            merchantMemory,
          );

          return (
            <div
              key={sug.id}
              className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150 ease-out"
            >
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {sug.isRefund ? (
                    <Badge variant="warning" size="xs">
                      Estorno
                    </Badge>
                  ) : sug.nature === "investment" ? (
                    <Badge variant="portfolio" size="xs">
                      {sug.investmentSubtype === "dividend" ? "Provento" : "Investimento"}
                    </Badge>
                  ) : (
                    <Badge variant={sug.type === "income" ? "positive" : "muted"} size="xs">
                      {sug.type === "income" ? "Renda" : "Despesa"}
                    </Badge>
                  )}


                  <Badge variant="muted" size="xs">
                    {sug.bankName}
                  </Badge>

                  {sug.assetTicker && (
                    <Badge variant="muted" size="xs">
                      {sug.assetTicker}
                    </Badge>
                  )}

                  {/* Badge da categoria inferida com ícone semântico e troca rápida inline (§3.2) */}
                  <Popover
                    open={openPopoverId === sug.id}
                    onOpenChange={(open) => setOpenPopoverId(open ? sug.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-[11px] font-medium border border-border/80 bg-surface hover:bg-surface-hover text-foreground transition-colors cursor-pointer select-none"
                        aria-label={`Trocar categoria da sugestão ${sug.description}`}
                      >
                        <CategoryIcon
                          icon={resolvedCategory?.icon}
                          color={resolvedCategory?.color}
                          className="size-3"
                        />
                        <span>{resolvedCategory?.name || "Sem categoria"}</span>
                        <ChevronDown className="size-2.5 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-60 p-2">
                      <div className="text-xs font-semibold text-foreground px-2 py-1 border-b border-border/40">
                        Trocar categoria
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1">
                        {availableCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              triggerSensory("toggle");
                              setSelectedCategories((prev) => ({
                                ...prev,
                                [sug.id]: cat.id,
                              }));
                              setOpenPopoverId(null);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-surface-hover transition-colors text-left cursor-pointer",
                              resolvedCategory?.id === cat.id && "bg-primary/10 font-medium text-primary",
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <CategoryIcon icon={cat.icon} color={cat.color} className="size-3.5" />
                              <span>{cat.name}</span>
                            </span>
                            {resolvedCategory?.id === cat.id && (
                              <Check className="size-3.5 text-primary" aria-hidden="true" />
                            )}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {sug.paymentMethod && (
                    <span className="text-[11px] text-muted-foreground uppercase">
                      {sug.paymentMethod === "credit_card"
                        ? "Cartão"
                        : sug.paymentMethod === "debit"
                          ? "Débito"
                          : sug.paymentMethod === "pix"
                            ? "Pix"
                            : sug.paymentMethod === "transfer"
                              ? "TED/DOC"
                              : "Outro"}
                    </span>
                  )}

                  {sug.installments && sug.installments > 1 && (
                    <Badge variant="muted" size="xs">
                      {sug.currentInstallment
                        ? `${sug.currentInstallment}/${sug.installments}x`
                        : `${sug.installments}x`}
                    </Badge>
                  )}

                  <span className="text-[11px] text-muted-foreground">
                    {formatDateBR(sug.date)}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 justify-between sm:justify-start">
                  <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[260px] sm:max-w-[340px]">
                    {sug.description}
                  </span>
                  <MoneyText
                    cents={sug.amountCents}
                    tone={
                      sug.nature === "investment"
                        ? "portfolio"
                        : sug.type === "income"
                          ? "positive"
                          : "default"
                    }
                    variant="value"
                    className="shrink-0"
                  />
                </div>
              </div>

              {/* Ações adaptadas: Investimentos vs Transações convencionais (§3.2 & §3.3) */}
              {sug.nature === "investment" ? (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(sug.id)}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={`Descartar sugestão de ${sug.description}`}
                  >
                    <X className="size-3.5 sm:mr-1 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Descartar</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSave(sug, resolvedCategory)}
                    className="h-8 gap-1 text-xs font-medium cursor-pointer"
                    aria-label={`Salvar como despesa ou renda sugestão de ${sug.description}`}
                  >
                    <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                    <span>Salvar como Despesa/Renda</span>
                  </Button>

                  <Button
                    type="button"
                    variant="portfolio"
                    size="sm"
                    onClick={() => handleInvestmentRouting(sug)}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
                    aria-label={`Registrar aporte ou provento da sugestão ${sug.description}`}
                  >
                    <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Registrar Aporte / Provento</span>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(sug.id)}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={`Descartar sugestão de ${sug.description}`}
                  >
                    <X className="size-3.5 sm:mr-1 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Descartar</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleReview(sug, resolvedCategory?.id)}
                    className="h-8 gap-1 text-xs font-medium cursor-pointer"
                    aria-label={`Revisar sugestão de ${sug.description}`}
                  >
                    <span>Revisar</span>
                    <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                  </Button>

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => handleQuickSave(sug, resolvedCategory)}
                    className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
                    aria-label={`Salvar rápido sugestão de ${sug.description}`}
                  >
                    <Zap className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Salvar Rápido</span>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AttachReceiptDialog open={pasteOpen} onOpenChange={setPasteOpen} />
    </div>
  );
}
