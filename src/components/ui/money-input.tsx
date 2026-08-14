import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useCurrencyInput } from "@/hooks/use-currency-input";
import { registerCalculatorTarget, unregisterCalculatorTarget } from "@/services/calculator-bridge";

/**
 * MoneyInput — entrada monetária progressiva (padrão Nubank).
 *
 * Controlado por CENTAVOS: `cents` entra, `onCentsChange` sai.
 * Todas as telas de valores (wizard, formulários, limites, metas) usam este
 * componente — nenhuma tela reimplementa a lógica (DRY).
 *
 * Ex.: cents=1500 -> exibe "R$ 15,00". Digitar "5" -> 155 -> "R$ 1,55".
 */
export interface MoneyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "inputMode" | "size"
  > {
  /** Valor controlado em centavos (inteiro ≥ 0). */
  cents?: number;
  /** Notifica o pai sempre que o valor muda (em centavos). */
  onCentsChange?: (cents: number) => void;
  /** Variante de tamanho. "lg" para o passo de valor do wizard (D10). */
  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<MoneyInputProps["size"]>, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
  lg: "h-16 px-4 text-3xl font-semibold text-center",
};

export function MoneyInput({
  cents = 0,
  onCentsChange,
  size = "md",
  className,
  disabled,
  ...rest
}: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currency = useCurrencyInput({ initialCents: cents });

  // Campo ativo da calculadora (F9): registrado no MOUNT — o FAB aparece assim
  // que o modal abre, sem depender de foco — e removido apenas no unmount
  // (modal fechado). O setter delega via ref (sempre o handler atual). O foco
  // re-registra o MESMO alvo estável (campo em uso, quando há vários campos).
  // NÃO desregistrar no blur: o painel da calculadora rouba o foco ao abrir e o
  // alvo precisa continuar ativo para "Usar valor" injetar.
  const calculatorTargetRef = useRef<((cents: number) => void) | null>(null);
  useEffect(() => {
    calculatorTargetRef.current = (cents: number) => {
      currency.setCents(cents);
      onCentsChange?.(cents);
    };
  });
  // Alvo com identidade estável: o cleanup do unmount consegue remover
  // exatamente o registro deste campo (mesmo após re-registros de foco).
  const calculatorTarget = useCallback(
    (cents: number) => calculatorTargetRef.current?.(cents),
    [],
  );
  useEffect(() => {
    registerCalculatorTarget(calculatorTarget);
    return () => unregisterCalculatorTarget(calculatorTarget);
  }, [calculatorTarget]);

  // Sincroniza APENAS quando o valor controlado muda de fato (ex.: reset do
  // formulário). Nunca sobrescreve o que o usuário digitou: um re-render do
  // pai com o mesmo `cents` não dispara o reset (guarda o último valor externo).
  const lastExternalCents = useRef(cents);
  useEffect(() => {
    if (lastExternalCents.current !== cents) {
      lastExternalCents.current = cents;
      currency.setCents(cents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);

  // Caret sempre no fim: a digitação "desliza" para a esquerda e o backspace
  // remove sempre o último dígito (impede inserção no meio do valor).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  });

  return (
    <input
      ref={inputRef}
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      className={cn(
        "w-full rounded-md border border-input bg-surface font-mono tabular-nums text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        "privacy-mask", // máscara global (globals.css): blur apenas com data-privacy=masked
        sizeClasses[size],
        className,
      )}
      value={currency.display}
      disabled={disabled}
      onChange={(event) => {
        const next = currency.handleChange(event);
        onCentsChange?.(next);
      }}
      onKeyDown={currency.handleKeyDown}
      onFocus={(event) => {
        // Campo em uso recebe o valor (re-registra o alvo estável).
        registerCalculatorTarget(calculatorTarget);
        rest.onFocus?.(event);
      }}
    />
  );
}
