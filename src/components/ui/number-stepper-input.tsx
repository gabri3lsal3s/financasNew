import { NumberStepper } from "./number-stepper";

export interface NumberStepperInputProps {
  /** Valor atual — número ou string (vazio = sem valor, ex.: "Sem trava"). */
  value: number | string;
  onValueChange: (value: string) => void;
  min?: number;
  max?: number;
  /** Incremento dos botões (padrão 1; aceita decimais como 0.5). */
  step?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Wrapper de compatibilidade sobre `<NumberStepper editable />`.
 * Preserva o contrato `value: number | string` e `onValueChange: (value: string) => void`.
 */
export function NumberStepperInput({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  placeholder,
  ariaLabel,
  className,
  disabled,
}: NumberStepperInputProps) {
  const parsed = parseFloat(String(value).replace(",", "."));

  return (
    <NumberStepper
      editable
      value={Number.isFinite(parsed) ? parsed : 0}
      onValueChange={(next) => onValueChange(String(next))}
      rawValue={value}
      onRawValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      decreaseLabel={ariaLabel ? `Diminuir ${ariaLabel}` : "Diminuir"}
      increaseLabel={ariaLabel ? `Aumentar ${ariaLabel}` : "Aumentar"}
      className={className}
      disabled={disabled}
    />
  );
}
