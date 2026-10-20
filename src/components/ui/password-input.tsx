import { forwardRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Se deve exibir o botão para alternar a visibilidade da senha (default: true). */
  allowToggleVisibility?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      className,
      disabled,
      allowToggleVisibility = true,
      ...props
    },
    ref,
  ) {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type={showPassword ? "text" : "password"}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-surface px-4 py-2 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
            allowToggleVisibility && "pr-10",
            className,
          )}
          {...props}
        />
        {allowToggleVisibility && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              triggerSensory("selection");
              setShowPassword((prev) => !prev);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
            title={showPassword ? "Ocultar senha" : "Ver senha"}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
