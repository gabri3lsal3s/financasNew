import { Link } from "react-router";
import { Calendar, Check, Copy, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export interface AccountDetailsCardProps {
  userId?: string;
  copiedId: boolean;
  accountCreatedLabel: string;
  isPro: boolean;
  isTrial: boolean;
  trialDaysRemaining: number | null;
  onCopyAccountId: () => void;
}

export function AccountDetailsCard({
  userId,
  copiedId,
  accountCreatedLabel,
  isPro,
  isTrial,
  trialDaysRemaining,
  onCopyAccountId,
}: AccountDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Detalhes da Conta &amp; SaaS</span>
        </CardTitle>
        <CardDescription>
          Informações cadastrais, identificador exclusivo e status do plano ativo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-surface-raised/60 flex flex-col justify-between gap-2 min-w-0">
            <span className="text-xs text-muted-foreground">Identificador da Conta</span>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="font-mono text-xs text-foreground truncate select-all">
                {userId ? `${userId.slice(0, 8)}...${userId.slice(-4)}` : "—"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                sensoryIntent={false}
                onClick={onCopyAccountId}
                title="Copiar ID da conta"
                aria-label="Copiar ID da conta"
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                {copiedId ? (
                  <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-raised/60 flex flex-col justify-between gap-2 min-w-0">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Membro desde</span>
            </span>
            <span className="font-semibold text-xs text-foreground">
              {accountCreatedLabel}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-raised/60 flex flex-col justify-between gap-2 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-portfolio shrink-0" aria-hidden="true" />
                <span>Plano Ativo</span>
              </span>
              <Link
                to="/configuracoes?tab=subscription"
                className="text-[11px] text-primary-strong hover:underline font-medium inline-flex items-center gap-0.5"
              >
                <span>Gerenciar</span>
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {isPro ? (
                <Badge variant="default" size="xs">
                  Plano Pro Ativo
                </Badge>
              ) : isTrial ? (
                <Badge variant="warning" size="xs">
                  Trial Pro ({trialDaysRemaining ?? 0} dias)
                </Badge>
              ) : (
                <Badge variant="muted" size="xs">
                  Plano Básico
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
