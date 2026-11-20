import { Link } from "react-router";
import { Mail, User } from "lucide-react";
import { Badge, Button, FormField, Input, PasswordInput } from "@/components/ui";

export interface CheckoutInlineAuthStepProps {
  sessionEmail?: string;
  authMode: "register" | "login";
  authName: string;
  authEmail: string;
  authPassword: string;
  onToggleAuthMode: () => void;
  onNameChange: (val: string) => void;
  onEmailChange: (val: string) => void;
  onPasswordChange: (val: string) => void;
}

export function CheckoutInlineAuthStep({
  sessionEmail,
  authMode,
  authName,
  authEmail,
  authPassword,
  onToggleAuthMode,
  onNameChange,
  onEmailChange,
  onPasswordChange,
}: CheckoutInlineAuthStepProps) {
  if (sessionEmail) {
    return (
      <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-surface-raised/60 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <Mail className="size-4 text-primary shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <span className="text-muted-foreground block text-[11px]">Conectado como</span>
            <span className="font-semibold text-foreground truncate block">{sessionEmail}</span>
          </div>
        </div>
        <Badge variant="muted" size="xs" className="shrink-0">
          Autenticado
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 p-4 rounded-xl bg-surface-raised/60">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            {authMode === "register" ? "Criar Sua Conta" : "Entrar na Conta"}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent="selection"
          onClick={onToggleAuthMode}
          className="text-primary-strong hover:text-primary px-2"
        >
          {authMode === "register" ? "Já tem conta? Entrar" : "Criar nova conta"}
        </Button>
      </div>

      {authMode === "register" ? (
        <FormField label="Nome Completo" htmlFor="checkout-auth-name">
          <Input
            id="checkout-auth-name"
            placeholder="Seu nome"
            value={authName}
            onChange={(e) => onNameChange(e.target.value)}
            autoComplete="name"
            className="text-base sm:text-sm"
          />
        </FormField>
      ) : null}

      <FormField label="E-mail" htmlFor="checkout-auth-email">
        <Input
          id="checkout-auth-email"
          type="email"
          placeholder="seu.email@exemplo.com"
          value={authEmail}
          onChange={(e) => onEmailChange(e.target.value)}
          autoComplete="email"
          className="text-base sm:text-sm"
        />
      </FormField>

      <FormField label="Senha" htmlFor="checkout-auth-password">
        <PasswordInput
          id="checkout-auth-password"
          placeholder="Mínimo de 8 caracteres"
          value={authPassword}
          onChange={(e) => onPasswordChange(e.target.value)}
          autoComplete={authMode === "register" ? "new-password" : "current-password"}
          className="text-base sm:text-sm"
        />
      </FormField>

      {authMode === "register" ? (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Ao criar sua conta, você concorda com os{" "}
          <Link
            to="/termos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-strong font-medium hover:text-primary hover:underline transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link
            to="/privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-strong font-medium hover:text-primary hover:underline transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Política de Privacidade
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
