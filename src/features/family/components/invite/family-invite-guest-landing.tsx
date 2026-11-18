import { Link } from "react-router";
import { ArrowLeftRight, PiggyBank, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge, Card, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { FamilyInviteShell } from "./family-invite-shell";

export interface FamilyInviteGuestLandingProps {
  token: string;
  inviterName?: string | null;
  familyName?: string | null;
}

export function FamilyInviteGuestLanding({
  token,
  inviterName,
  familyName,
}: FamilyInviteGuestLandingProps) {
  const returnPath = `/convite-familiar/${token}`;
  const loginUrl = `/entrar?redirect=${encodeURIComponent(returnPath)}`;
  const registerUrl = `/cadastro?redirect=${encodeURIComponent(returnPath)}`;

  return (
    <FamilyInviteShell token={token} showFooter>
      <Card className="border-border/80 bg-surface shadow-xs p-5 sm:p-8 rounded-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl border bg-primary/10 border-primary/20 text-primary-strong mx-auto">
            <Users className="size-7" aria-hidden="true" />
          </div>
          <div>
            <Badge variant="default" size="xs">
              Modo Família Colaborativo
            </Badge>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {inviterName || "Seu parceiro(a)"} convidou você!
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Faça parte da família{" "}
            <strong className="text-foreground">{familyName || "Axir"}</strong> para
            planejar as despesas da casa com equilíbrio e transparência.
          </p>
        </div>

        {/* Pilares Blindados (M2: contraste suave via bg-surface-raised sem borda dupla interna) */}
        <div className="space-y-3 pt-1">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-raised">
            <ShieldCheck
              className="size-5 text-positive-strong shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-foreground block">
                Privacidade Sagrada (Zero Data Bleed)
              </span>
              <p className="text-muted-foreground">
                Suas contas bancárias, cartões e despesas particulares continuam 100% privados.
                Apenas os lançamentos marcados como familiares são somados na casa.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-raised">
            <PiggyBank
              className="size-5 text-primary-strong shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-foreground block">
                Orçamento e Tetos Compartilhados
              </span>
              <p className="text-muted-foreground">
                Acompanhem juntos os limites de gastos da casa por categoria em tempo real, sem
                necessidade de planilhas manuais.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-raised">
            <ArrowLeftRight
              className="size-5 text-portfolio shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-foreground block">
                Compensação Justa via Pix em 1 Toque
              </span>
              <p className="text-muted-foreground">
                O app calcula quem gastou mais, quanto deve ser compensado e gera a Chave Pix com o
                valor exato para liquidação instantânea.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <Link
            to={registerUrl}
            onClick={() => triggerSensory("selection")}
            className={cn(
              buttonVariants({ variant: "solid", size: "lg" }),
              "w-full gap-2",
            )}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            <span>Criar Conta Gratuita e Aceitar</span>
          </Link>
          <Link
            to={loginUrl}
            onClick={() => triggerSensory("selection")}
            className={cn(
              buttonVariants({ variant: "outline", size: "default" }),
              "w-full gap-2",
            )}
          >
            <span>Já tenho uma conta — Fazer Login</span>
          </Link>
        </div>
      </Card>
    </FamilyInviteShell>
  );
}
