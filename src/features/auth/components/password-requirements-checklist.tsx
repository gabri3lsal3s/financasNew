import { Check, Circle, ShieldCheck } from "lucide-react";
import { checkPasswordRequirements } from "@/domain/validation";
import { cn } from "@/lib/utils";

export interface PasswordRequirementsChecklistProps {
  /** Senha digitada para validação em tempo real. */
  password: string;
  /** Modo de exibição: "basic" (mínimo 8 + maiúscula ou número) ou "full" (todos os 4 critérios). */
  mode?: "basic" | "full";
  className?: string;
}

/**
 * Checklist reutilizável de requisitos de segurança de senha com ícones Lucide padronizados.
 */
export function PasswordRequirementsChecklist({
  password,
  mode = "basic",
  className,
}: PasswordRequirementsChecklistProps) {
  const requirements = checkPasswordRequirements(password);

  const items =
    mode === "full"
      ? [
          { met: requirements.minLength, label: "Mínimo 8 caracteres" },
          { met: requirements.hasUppercase, label: "Letra maiúscula (A-Z)" },
          { met: requirements.hasNumber, label: "Número (0-9)" },
          { met: requirements.hasSpecialChar, label: "Símbolo especial (!@#$)" },
        ]
      : [
          { met: requirements.minLength, label: "Pelo menos 8 caracteres" },
          {
            met: requirements.hasUppercase || requirements.hasNumber,
            label: "Letras maiúsculas ou números",
          },
        ];

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-muted/40 p-3 space-y-1.5",
        className,
      )}
    >
      <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
        <span>Critérios de segurança:</span>
      </span>
      <ul
        className={cn(
          "text-[11px] text-muted-foreground",
          mode === "full" ? "grid grid-cols-1 sm:grid-cols-2 gap-1.5" : "space-y-1",
        )}
      >
        {items.map(({ met, label }) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-1.5",
              met ? "text-positive-strong font-medium" : "text-muted-foreground",
            )}
          >
            {met ? (
              <Check className="size-3.5 shrink-0 text-positive-strong" aria-hidden="true" />
            ) : (
              <Circle className="size-3 shrink-0 text-muted-foreground/70" aria-hidden="true" />
            )}
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
