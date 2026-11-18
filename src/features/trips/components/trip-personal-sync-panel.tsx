import { Plus, Wallet } from "lucide-react";
import { Button, Select, Switch, type SelectOption } from "@/components/ui";
import { resolveBillCompetence } from "@/domain/competence";
import { formatCentsAsBRL } from "@/services/masks/money";
import type { CreditCard } from "@/types";

export interface TripPersonalSyncPanelProps {
  syncWithPersonal: boolean;
  onSyncWithPersonalChange: (checked: boolean) => void;
  personalCategoryId: string;
  onPersonalCategoryIdChange: (id: string) => void;
  personalCategoryOptions: SelectOption[];
  onCreateCategoryClick: () => void;
  paymentMethod: "pix" | "cash" | "credit_card" | "debit";
  onPaymentMethodChange: (method: "pix" | "cash" | "credit_card" | "debit") => void;
  cardId: string;
  onCardIdChange: (cardId: string) => void;
  availableCards: readonly CreditCard[];
  selectedCard?: CreditCard;
  installmentsCount: number;
  onInstallmentsCountChange: (count: number) => void;
  amountCents: number;
  expenseDate: string;
}

export function TripPersonalSyncPanel({
  syncWithPersonal,
  onSyncWithPersonalChange,
  personalCategoryId,
  onPersonalCategoryIdChange,
  personalCategoryOptions,
  onCreateCategoryClick,
  paymentMethod,
  onPaymentMethodChange,
  cardId,
  onCardIdChange,
  availableCards,
  selectedCard,
  installmentsCount,
  onInstallmentsCountChange,
  amountCents,
  expenseDate,
}: TripPersonalSyncPanelProps) {
  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const count = i + 1;
    const partCents = amountCents > 0 ? Math.round(amountCents / count) : 0;
    const formatted = formatCentsAsBRL(partCents);
    return {
      value: String(count),
      label: count === 1 ? `1x à vista (${formatted})` : `${count}x de ${formatted}`,
    };
  });

  return (
    <div className="p-3.5 rounded-xl border border-border/80 bg-surface-raised space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-foreground block">
              Lançar no meu extrato bancário
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Registra o desembolso real na sua conta ou fatura do cartão
            </span>
          </div>
        </div>
        <Switch
          id="sync-personal-expense"
          checked={syncWithPersonal}
          onCheckedChange={onSyncWithPersonalChange}
          aria-label="Lançar no meu extrato bancário"
        />
      </div>

      {syncWithPersonal && (
        <div className="space-y-3 pt-2.5 border-t border-border/80">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-medium text-foreground">
                Categoria no seu extrato pessoal
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 sm:min-h-8 px-2 text-primary-strong hover:text-primary-strong gap-1 font-medium -my-1.5"
                onClick={onCreateCategoryClick}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Nova Categoria</span>
              </Button>
            </div>
            <Select
              value={personalCategoryId}
              onValueChange={onPersonalCategoryIdChange}
              options={personalCategoryOptions}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">
                Forma de Pagamento
              </label>
              <Select
                value={paymentMethod}
                onValueChange={(val) => onPaymentMethodChange(val as typeof paymentMethod)}
                options={[
                  { value: "pix", label: "Pix" },
                  { value: "credit_card", label: "Cartão de Crédito" },
                  { value: "debit", label: "Cartão de Débito" },
                  { value: "cash", label: "Dinheiro / Espécie" },
                ]}
              />
            </div>

            {paymentMethod === "credit_card" && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-foreground">
                    Cartão de Crédito
                  </label>
                  <Select
                    value={cardId}
                    onValueChange={onCardIdChange}
                    options={availableCards.map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.brand})`,
                    }))}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] font-medium text-foreground">
                    Quantidade de Parcelas
                  </label>
                  <Select
                    value={String(installmentsCount)}
                    onValueChange={(val) => onInstallmentsCountChange(Number(val))}
                    options={installmentOptions}
                  />
                  {selectedCard && (
                    <p className="text-[11px] text-muted-foreground pt-0.5">
                      Competência da fatura:{" "}
                      <strong className="text-foreground">
                        {resolveBillCompetence(
                          new Date(`${expenseDate}T12:00:00`),
                          selectedCard.closing_day,
                        )}
                      </strong>
                      {installmentsCount > 1
                        ? ` (repartido em ${installmentsCount} faturas mensais)`
                        : ""}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
