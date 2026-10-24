import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  ModalFooter,
} from "@/components/ui";
import { useSignOut } from "@/hooks/use-sign-out";
import { resetAppState } from "@/services/auth-cleanup";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import { deleteCurrentUserAccount } from "@/data/rpc";
import { cancelSubscription } from "@/data/repositories/billing";

export const CONFIRM_DELETE_WORD = "EXCLUIR";

export interface DeleteAccountCardProps {
  title?: string;
  description?: string;
  actionTitle?: string;
  actionDescription?: string;
}

export function DeleteAccountCard({
  title = "Zona de Perigo / Exclusão de Conta (LGPD)",
  description = "Direito ao Esquecimento garantido pelo Art. 18, VI da Lei Geral de Proteção de Dados (LGPD).",
  actionTitle = "Excluir conta e dados definitivamente",
  actionDescription = "Expurga todas as transações, cartões, dívidas, orçamentos, investimentos e remove permanentemente seu cadastro.",
}: DeleteAccountCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useSignOut();

  const [isOpen, setIsOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmationValid = confirmationInput.trim().toUpperCase() === CONFIRM_DELETE_WORD;

  const handleDeleteAccount = async () => {
    if (!isConfirmationValid || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      // 1. Cancelamento preventivo no gateway Asaas/Stripe
      try {
        await cancelSubscription();
      } catch {
        // Ignora caso não possua assinatura ativa ou gateway offline
      }

      // 2. Expurgo em cascata das tabelas e auth.users (LGPD Art. 18, VI)
      await deleteCurrentUserAccount();

      triggerSensory("destructive");
      pushToast({
        title: "Conta excluída",
        description: "Sua conta e todos os dados foram definitivamente expurgados conforme a LGPD.",
        variant: "default",
      });

      // 3. Limpeza profunda de cache e storage
      try {
        resetAppState(queryClient, null);
      } catch {
        // noop
      }

      if (typeof window !== "undefined") {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch {
          // noop
        }
      }

      // 4. Logout seguro e redirecionamento
      try {
        await signOut();
      } catch {
        // noop
      }

      navigate("/entrar", { replace: true });
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="border-critical/30 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-critical-strong">
            <AlertTriangle className="size-4 text-critical-strong" aria-hidden="true" />
            <span>{title}</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-critical/20 bg-critical/5">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                {actionTitle}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {actionDescription}
              </span>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmationInput("");
                setError(null);
                setIsOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold rounded-xl shrink-0 cursor-pointer"
            >
              <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
              <span>Excluir Minha Conta</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={isOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setIsOpen(open);
          if (!open) {
            setConfirmationInput("");
            setError(null);
          }
        }}
        title="Excluir Conta Definitivamente (LGPD)"
        description="Esta ação é irreversível e aciona o expurgo definitivo de todos os seus dados pessoais e financeiros (Art. 18, VI da LGPD)."
        size="sm"
      >
        <div className="space-y-4 pt-2">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="rounded-xl border border-critical/20 bg-critical/5 p-3.5 space-y-2">
            <span className="text-xs font-medium text-critical-strong flex items-center gap-1.5">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <span>Atenção: Ação Irreversível</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Em conformidade com a LGPD, todo o seu histórico financeiro, lançamentos,
              cartões, categorias, investimentos e preferências serão definitivamente
              destruídos. Qualquer assinatura ativa no gateway de pagamento será cancelada
              preventivamente.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="delete-account-unified-confirm"
              className="text-xs font-semibold text-foreground block"
            >
              Para confirmar a exclusão, digite a palavra{" "}
              <span className="font-mono text-critical-strong font-bold select-all">
                {CONFIRM_DELETE_WORD}
              </span>{" "}
              abaixo:
            </label>
            <Input
              id="delete-account-unified-confirm"
              type="text"
              value={confirmationInput}
              onChange={(e) => {
                setConfirmationInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder={CONFIRM_DELETE_WORD}
              disabled={isDeleting}
              autoComplete="off"
              className="h-10 text-sm rounded-xl font-mono"
            />
            <span className="text-[11px] text-muted-foreground block">
              O botão de exclusão só será ativado quando a palavra for digitada exatamente igual.
            </span>
          </div>

          <ModalFooter className="mt-4 pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isDeleting}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { void handleDeleteAccount(); }}
              disabled={!isConfirmationValid || isDeleting}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
                  <span>Confirmar Exclusão</span>
                </>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </>
  );
}
