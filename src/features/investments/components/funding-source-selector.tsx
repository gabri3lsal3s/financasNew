import { Landmark, Wallet } from "lucide-react";
import { Alert, ChoiceCard, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { formatCentsAsBRL } from "@/services/masks";
import { cn } from "@/lib/utils";
import type { FundingSource } from "./funding-source-utils";

export interface FundingSourceSelectorProps {
  value: FundingSource;
  onChange: (source: FundingSource) => void;
  cashBalanceBRL?: number;
  orderTotalBRL?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Seletor canônico e mutuamente exclusivo da origem dos recursos de um aporte ou compra.
 * Garante que dinheiro novo do bolso e saldo em caixa da corretora nunca sejam acionados juntos
 * ou duplicados em `portfolio_contributions`.
 */
export function FundingSourceSelector({
  value,
  onChange,
  cashBalanceBRL = 0,
  orderTotalBRL,
  label = "Origem dos recursos",
  disabled = false,
  className,
}: FundingSourceSelectorProps) {
  const safeCashBRL = Math.max(0, cashBalanceBRL);
  const cashCents = numberToCents(safeCashBRL);
  const isCashInsufficient =
    value === "cash" &&
    orderTotalBRL !== undefined &&
    orderTotalBRL > 0 &&
    safeCashBRL + 0.01 < orderTotalBRL;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <span className="text-xs font-semibold text-foreground">{label}</span>

      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
      >
        <ChoiceCard
          selected={value === "pocket"}
          disabled={disabled}
          onClick={() => onChange("pocket")}
          icon={<Wallet className="size-4" aria-hidden="true" />}
          title="Dinheiro Novo (Bolso)"
          badge="Padrão"
          badgeVariant={value === "pocket" ? "positive" : "default"}
          description="Registra o aporte do mês sem debitar o Caixa da corretora."
        />

        <ChoiceCard
          selected={value === "cash"}
          disabled={disabled}
          onClick={() => onChange("cash")}
          icon={<Landmark className="size-4" aria-hidden="true" />}
          title="Saldo da Corretora (Caixa)"
          description={
            <span className="flex flex-wrap items-center gap-1">
              <span>Disponível:</span>
              <MoneyText
                cents={cashCents}
                className="text-xs font-semibold text-foreground"
              />
            </span>
          }
        />
      </div>

      {isCashInsufficient && (
        <Alert variant="warning">
          O saldo disponível em Caixa ({formatCentsAsBRL(cashCents)}) é menor que o valor desta operação. O saldo em Caixa será zerado e o restante não será convertido automaticamente em aporte do bolso.
        </Alert>
      )}
    </div>
  );
}
