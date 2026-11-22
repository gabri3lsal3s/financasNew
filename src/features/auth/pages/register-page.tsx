import { useState } from "react";
import { Link, Navigate } from "react-router";
import { ArrowLeft, ArrowRight, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Input,
  Turnstile,
  buttonVariants,
} from "@/components/ui";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { cn } from "@/lib/utils";
import { AuthShell } from "../components/auth-shell";
import { RegisterConfirmationCard } from "../components/register-confirmation-card";
import { RegisterPasswordFields } from "../components/register-password-fields";
import { RegisterSideHero } from "../components/register-side-hero";
import { useRegisterForm } from "../hooks/use-register-form";

export function RegisterPage() {
  const r = useRegisterForm();
  const [showInviteField, setShowInviteField] = useState(() => Boolean(r.inviteCode));

  useDocumentMeta({
    title: "Criar Conta Grátis — Axir | 30 Dias Pro sem Cartão",
    description:
      "Crie sua conta gratuita no Axir com 30 dias de Acesso Pro Total sem cartão de crédito e sem senhas bancárias.",
    canonicalPath: "/cadastro",
  });

  if (r.redirectPath) {
    return <Navigate to={r.redirectPath} replace />;
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle={
        r.planoParam
          ? "Crie sua conta para concluir a assinatura do Plano Pro."
          : "Comece com 30 dias de acesso Pro gratuito sem cartão de crédito."
      }
      sideHero={<RegisterSideHero planoParam={r.planoParam} />}
    >
      <div className="flex flex-col gap-4">
        {r.isFromSimulator ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground flex items-center gap-2.5">
            <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">
              Sua simulação será automaticamente transportada e integrada à sua conta no primeiro acesso.
            </p>
          </div>
        ) : null}

        {r.configError ? <Alert variant="error">{r.configError}</Alert> : null}

        {r.error ? (
          <Alert variant="error">
            <p>{r.error}</p>
            {r.isAccountExistsError ? (
              <div className="mt-3 pt-2 border-t border-critical/20 flex flex-wrap gap-2.5">
                <Link
                  to={`/entrar${r.email ? `?email=${encodeURIComponent(r.email)}` : ""}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <span>Fazer login agora</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
                <Link
                  to={`/recuperar-senha${r.email ? `?email=${encodeURIComponent(r.email)}` : ""}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  <span>Recuperar minha senha</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </Alert>
        ) : null}

        {r.confirmationSent ? (
          <RegisterConfirmationCard email={r.email} loginUrl={r.loginUrl} />
        ) : (
          <>
            {!r.planoParam ? (
              <div className="flex lg:hidden rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 items-center gap-2.5 text-xs">
                <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
                <p className="text-foreground leading-snug">
                  <strong>30 dias de Acesso Pro grátis</strong> · sem cartão de crédito e cancelamento em 1 clique.
                </p>
              </div>
            ) : null}

            <form
              onSubmit={(e) => {
                void r.handleSubmit(e);
              }}
              className="flex flex-col gap-4"
              noValidate
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField label="Nome" htmlFor="register-name">
                  <Input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    value={r.name}
                    onChange={(event) => r.setName(event.target.value)}
                    placeholder="Seu nome"
                    className="text-base sm:text-sm"
                  />
                </FormField>

                <FormField label="E-mail" htmlFor="register-email">
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={r.email}
                    onChange={(event) => r.setEmail(event.target.value)}
                    placeholder="voce@exemplo.com"
                    className="text-base sm:text-sm"
                  />
                </FormField>
              </div>

              <RegisterPasswordFields
                password={r.password}
                confirmPassword={r.confirmPassword}
                metCount={r.metCount}
                onPasswordChange={r.setPassword}
                onConfirmPasswordChange={r.setConfirmPassword}
              />

              {showInviteField ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="register-invite"
                      className="text-xs font-semibold text-foreground"
                    >
                      Código de Convite{" "}
                      <span className="font-normal text-muted-foreground">(opcional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        r.setInviteCode("");
                        setShowInviteField(false);
                      }}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Ocultar
                    </button>
                  </div>
                  <Input
                    id="register-invite"
                    type="text"
                    value={r.inviteCode}
                    onChange={(event) => r.setInviteCode(event.target.value.toUpperCase())}
                    placeholder="Ex: AXIR-XXXX-XXXX"
                    className="text-base sm:text-sm font-mono uppercase"
                  />
                </div>
              ) : (
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={() => setShowInviteField(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary-strong transition-colors cursor-pointer"
                  >
                    <Ticket className="size-3.5" aria-hidden="true" />
                    <span>Tem um código de convite?</span>
                  </button>
                </div>
              )}

              <div className="flex items-start gap-2.5 pt-1">
                <Checkbox
                  id="register-terms"
                  checked={r.acceptedTerms}
                  onCheckedChange={r.setAcceptedTerms}
                  disabled={r.pending}
                  className="mt-0.5"
                  aria-label="Li e concordo com os Termos de Uso e a Política de Privacidade"
                />
                <label
                  htmlFor="register-terms"
                  className="cursor-pointer text-xs text-muted-foreground leading-relaxed select-none"
                >
                  Li e concordo com os{" "}
                  <Link
                    to="/termos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-strong font-medium hover:text-primary hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Termos de Uso
                  </Link>{" "}
                  e a{" "}
                  <Link
                    to="/privacidade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-strong font-medium hover:text-primary hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Política de Privacidade
                  </Link>
                  .
                </label>
              </div>

              <Turnstile className="my-0.5" onVerify={(tok) => r.setCaptchaToken(tok)} />

              <Button
                type="submit"
                variant="solid"
                sensoryIntent={false}
                disabled={r.pending || Boolean(r.configError) || !r.acceptedTerms}
              >
                {r.pending ? "Criando conta…" : "Criar conta"}
              </Button>
            </form>

            <div className="mt-2 pt-4 border-t border-border/80 flex flex-col items-center gap-2 text-xs sm:text-sm">
              <p className="text-muted-foreground">
                Já tem conta?{" "}
                <Link
                  to={r.bottomLoginUrl}
                  className="text-primary-strong font-semibold hover:text-primary hover:underline transition-colors"
                >
                  Entrar
                </Link>
              </p>
              <Link
                to="/apresentacao"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Conhecer o Axir e Planos</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
