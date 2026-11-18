import type { FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { Alert, Badge, Button, FormField, Input, PasswordInput } from "@/components/ui";

export interface SplitOnboardingFormProps {
  formId: string;
  mode: "register" | "login";
  onModeChange: (newMode: "register" | "login") => void;
  name: string;
  onNameChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  password: string;
  onPasswordChange: (val: string) => void;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function SplitOnboardingForm({
  formId,
  mode,
  onModeChange,
  name,
  onNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  isSubmitting,
  error,
  onSubmit,
}: SplitOnboardingFormProps) {
  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary-strong" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">
            {mode === "register" ? "Auto-cadastro em 1 minuto" : "Acesse sua conta"}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent="selection"
          onClick={() => onModeChange(mode === "register" ? "login" : "register")}
          className="h-auto p-0 text-xs text-primary-strong hover:underline font-medium hover:bg-transparent"
        >
          {mode === "register" ? "Já tenho conta" : "Criar nova conta"}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <form id={formId} onSubmit={onSubmit} className="space-y-3.5" noValidate>
        {mode === "register" && (
          <FormField label="Nome" optional htmlFor="onboarding-name">
            <Input
              id="onboarding-name"
              placeholder="Seu nome ou apelido"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={isSubmitting}
              className="text-base sm:text-sm"
            />
          </FormField>
        )}

        <FormField label="E-mail" required htmlFor="onboarding-email">
          <Input
            id="onboarding-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={isSubmitting}
            className="text-base sm:text-sm"
            required
          />
        </FormField>

        <FormField
          label="Senha"
          required
          htmlFor="onboarding-password"
          helperText={mode === "register" ? "Mínimo 8 caracteres." : undefined}
        >
          <PasswordInput
            id="onboarding-password"
            placeholder={mode === "register" ? "Crie uma senha de acesso" : "Sua senha"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            disabled={isSubmitting}
            className="text-base sm:text-sm"
            required
          />
        </FormField>

        {mode === "register" && (
          <div className="flex items-center gap-2">
            <Badge variant="muted" size="xs">
              Plano Pro
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              30 dias de avaliação gratuita sem cartão.
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
