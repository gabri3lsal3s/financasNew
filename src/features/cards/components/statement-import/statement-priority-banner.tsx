import { AlertCircle, Tag, WifiOff, X } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import type { DetectedStatementMetadata } from "@/domain/reconciliation";
import type { CreditCard } from "@/types";
import type {
  BillProtectionState,
  StatementAiStatusNotice,
} from "./statement-import-types";

export interface CategoryPropagationPromptState {
  merchantName: string;
  categoryId: string;
  categoryName: string;
  affectedIds: string[];
}

export interface StatementPriorityBannerProps {
  billProtection: BillProtectionState;
  error: string | null;
  hasUnconfirmedCardMismatch: boolean;
  detectedMeta: DetectedStatementMetadata | null;
  matchedCardForMismatch: CreditCard | null;
  onSwitchCard: (cardId: string) => void;
  onConfirmCardMismatch: () => void;
  aiStatusNotice: StatementAiStatusNotice | null;
  propagationPrompt: CategoryPropagationPromptState | null;
  onApplyPropagation: (prompt: CategoryPropagationPromptState) => void;
  onDismissPropagation: () => void;
}

/**
 * Slot único prioritário (máx. 1 faixa ativa por vez): Rolada/Erro -> Divergência Cartão ->
 * Fatura Quitada -> Cobertura/Cota/Offline -> Sugestão de propagação de categoria.
 */
export function StatementPriorityBanner({
  billProtection,
  error,
  hasUnconfirmedCardMismatch,
  detectedMeta,
  matchedCardForMismatch,
  onSwitchCard,
  onConfirmCardMismatch,
  aiStatusNotice,
  propagationPrompt,
  onApplyPropagation,
  onDismissPropagation,
}: StatementPriorityBannerProps) {
  if (billProtection.isRolledOver || error) {
    return (
      <Alert variant="error">
        <div className="flex items-start gap-2 text-xs">
          <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            {billProtection.isRolledOver
              ? "Esta fatura já foi rolada/refinanciada e está bloqueada para importação ou alterações."
              : error}
          </span>
        </div>
      </Alert>
    );
  }

  if (hasUnconfirmedCardMismatch && detectedMeta) {
    return (
      <Alert variant="warning">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-warning-strong" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">Divergência de cartão detectada</p>
              <p className="text-muted-foreground">{detectedMeta.cardMismatchWarning}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {matchedCardForMismatch ? (
              <Button
                type="button"
                size="xs"
                onClick={() => onSwitchCard(matchedCardForMismatch.id)}
              >
                Trocar para {matchedCardForMismatch.name}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="xs" onClick={onConfirmCardMismatch}>
              {matchedCardForMismatch ? "Continuar neste cartão" : "Confirmar este cartão"}
            </Button>
          </div>
        </div>
      </Alert>
    );
  }

  if (billProtection.isPaidBill) {
    return (
      <Alert variant="warning">
        <div className="flex items-start gap-2 text-xs">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-warning-strong" aria-hidden="true" />
          <span>
            Fatura já quitada: novas compras, parcelas futuras e estornos continuam permitidos, mas
            exclusões, ajustes e movimentações em itens quitados estão bloqueados.
          </span>
        </div>
      </Alert>
    );
  }

  if (aiStatusNotice) {
    return (
      <Alert variant="warning">
        <div className="flex items-start gap-2 text-xs">
          {aiStatusNotice.kind === "offline" ? (
            <WifiOff className="size-4 shrink-0 mt-0.5 text-warning-strong" aria-hidden="true" />
          ) : (
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-warning-strong" aria-hidden="true" />
          )}
          <span>{aiStatusNotice.message}</span>
        </div>
      </Alert>
    );
  }

  if (propagationPrompt) {
    return (
      <Alert variant="info">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Tag className="size-4 shrink-0 text-primary-strong" aria-hidden="true" />
            <span>
              Aplicar <strong>{propagationPrompt.categoryName}</strong> às outras{" "}
              {propagationPrompt.affectedIds.length} compras de{" "}
              <strong>{propagationPrompt.merchantName}</strong>?
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="xs"
              sensoryIntent={false}
              onClick={() => onApplyPropagation(propagationPrompt)}
            >
              Aplicar a todas ({propagationPrompt.affectedIds.length})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onDismissPropagation}
              aria-label="Fechar sugestão"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Alert>
    );
  }

  return null;
}
