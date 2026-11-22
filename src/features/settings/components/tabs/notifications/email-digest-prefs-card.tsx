import { Mail, ShieldCheck } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Switch,
} from "@/components/ui";
import { useNotificationPreferencesForm } from "@/features/reminders";
import { cn } from "@/lib/utils";

export function EmailDigestPrefsCard() {
  const {
    weeklyDigestEnabled,
    isWeeklyDigestPending,
    remotePushEnabled,
    handleToggleWeeklyDigest,
  } = useNotificationPreferencesForm();

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="pb-3.5">
        <CardTitle className="text-base font-semibold flex items-center gap-2 min-w-0">
          <Mail
            className="size-4 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <span>E-mails e Resumos</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-border/80 bg-surface-raised/50">
          <div className="flex items-start gap-2.5 min-w-0">
            <ShieldCheck
              className="size-4 text-muted-foreground shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  E-mails essenciais de conta e assinatura
                </span>
                <Badge variant="muted" size="xs">
                  Sempre ativo
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Confirmações de pagamento, alertas de falha de cobrança, segurança da conta e avisos críticos de período de teste.
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors",
            weeklyDigestEnabled
              ? "border-primary/40 bg-primary/5"
              : "border-border/80 bg-surface",
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Resumo Semanal de Domingo
              </span>
              <Badge
                variant={weeklyDigestEnabled ? "default" : "muted"}
                size="xs"
              >
                {weeklyDigestEnabled ? "Ativado" : "Desativado"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Receba aos domingos um consolidado opcional por e-mail com os gastos da semana, maior categoria e contas em aberto.
              {remotePushEnabled
                ? " Quando os alertas em segundo plano estiverem ativos neste navegador, você também recebe um aviso rápido ao concluir o envio."
                : ""}
            </p>
          </div>
          <Switch
            checked={weeklyDigestEnabled}
            disabled={isWeeklyDigestPending}
            onCheckedChange={handleToggleWeeklyDigest}
            aria-label="Habilitar Resumo Semanal de Domingo"
          />
        </div>
      </CardContent>
    </Card>
  );
}
