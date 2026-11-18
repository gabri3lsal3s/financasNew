import { FormField, PasswordInput } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PasswordRequirementsChecklist } from "./password-requirements-checklist";

export interface RegisterPasswordFieldsProps {
  password: string;
  confirmPassword: string;
  metCount: number;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}

export function RegisterPasswordFields({
  password,
  confirmPassword,
  metCount,
  onPasswordChange,
  onConfirmPasswordChange,
}: RegisterPasswordFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="register-password" className="text-xs font-semibold text-foreground">
            Senha
          </label>
          {password.length > 0 ? (
            <span
              className={cn(
                "text-[11px] font-semibold",
                metCount <= 2
                  ? "text-critical-strong"
                  : metCount === 3
                    ? "text-warning-strong"
                    : "text-positive-strong",
              )}
            >
              {metCount <= 2 ? "Fraca" : metCount === 3 ? "Média" : "Forte"}
            </span>
          ) : null}
        </div>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="Mínimo de 8 caracteres"
          className="text-base sm:text-sm"
        />

        {password.length > 0 ? (
          <div className="mt-1 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  metCount >= 1
                    ? metCount <= 2
                      ? "bg-critical"
                      : metCount === 3
                        ? "bg-warning"
                        : "bg-positive"
                    : "bg-border",
                )}
              />
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  metCount >= 3 ? (metCount === 3 ? "bg-warning" : "bg-positive") : "bg-border",
                )}
              />
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  metCount >= 4 ? "bg-positive" : "bg-border",
                )}
              />
            </div>
            <PasswordRequirementsChecklist password={password} mode="full" />
          </div>
        ) : null}
      </div>

      <FormField label="Confirmar Senha" htmlFor="register-confirm-password">
        <PasswordInput
          id="register-confirm-password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          placeholder="Confirme sua senha"
          className="text-base sm:text-sm"
        />
      </FormField>
    </>
  );
}
