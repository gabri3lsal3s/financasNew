import { XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export interface CancellationCardProps {
  cancelAtPeriodEnd: boolean;
  isWithinGuarantee: boolean;
  guaranteeDaysRemaining: number;
  currentPeriodFormatted: string | null;
  isPending: boolean;
  onOpenCancelWizard: () => void;
}

export function CancellationCard({
  cancelAtPeriodEnd,
  isWithinGuarantee,
  guaranteeDaysRemaining,
  currentPeriodFormatted,
  isPending,
  onOpenCancelWizard,
}: CancellationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <XCircle className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Cancelamento</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cancelAtPeriodEnd ? (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="warning" size="xs">
                Cancelamento agendado
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sua assinatura não será renovada ao final do ciclo atual. Seu acesso Pro permanece ativo normalmente até o término do período pago ({currentPeriodFormatted || "fim do ciclo"}) e todos os seus dados ficam preservados.
            </p>
          </div>
        ) : isWithinGuarantee ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-positive/30 bg-positive/5 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="positive" size="xs">
                  Garantia incondicional ativa
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {guaranteeDaysRemaining}{" "}
                  {guaranteeDaysRemaining === 1 ? "dia restante" : "dias restantes"} para arrependimento
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você está no prazo legal de 7 dias (CDC). Ao cancelar agora, o valor pago será estornado integralmente pelo Asaas no seu cartão ou conta Pix e o acesso Pro será encerrado imediatamente.
              </p>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={onOpenCancelWizard}
              className="gap-2"
            >
              <XCircle className="size-4" aria-hidden="true" />
              <span>Cancelar Assinatura e Reembolsar</span>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ao cancelar, seu acesso Pro permanece ativo até{" "}
              {currentPeriodFormatted || "o fim do período já pago"}. Todos os seus dados e relatórios são preservados para sempre — você poderá reativar o Pro a qualquer momento em 1 clique.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={onOpenCancelWizard}
              className="gap-2"
            >
              <XCircle className="size-4" aria-hidden="true" />
              <span>Cancelar Renovação da Assinatura</span>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
