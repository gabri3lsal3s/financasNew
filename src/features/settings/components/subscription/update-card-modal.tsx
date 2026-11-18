import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
} from "@/components/ui";
import { formatCardExpiry, formatCardNumber } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { useUpdateSubscriptionCardMutation } from "@/state";

const UPDATE_CARD_FORM_ID = "update-card-form";

export interface UpdateCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateCardModal({ open, onOpenChange }: UpdateCardModalProps) {
  const updateCardMutation = useUpdateSubscriptionCardMutation();
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!holderName.trim()) {
      triggerSensory("error");
      setError("Informe o nome do titular.");
      return;
    }

    const rawNumber = cardNumber.replace(/\D/g, "");
    if (rawNumber.length < 13 || rawNumber.length > 19) {
      triggerSensory("error");
      setError("Número do cartão inválido.");
      return;
    }

    const [expMonth, expYear] = cardExpiry.split("/");
    const expMonthNum = parseInt(expMonth || "", 10);
    const expYearNum = parseInt(expYear?.length === 2 ? `20${expYear}` : (expYear || ""), 10);
    if (!expMonth || !expYear || expMonthNum < 1 || expMonthNum > 12 || Number.isNaN(expYearNum)) {
      triggerSensory("error");
      setError("Validade inválida (MM/AA).");
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (expYearNum < currentYear || (expYearNum === currentYear && expMonthNum < currentMonth)) {
      triggerSensory("error");
      setError("Cartão expirado. Informe uma validade futura.");
      return;
    }

    if (cardCcv.length < 3) {
      triggerSensory("error");
      setError("CVV inválido.");
      return;
    }

    try {
      await updateCardMutation.mutateAsync({
        holderName: holderName.trim().toUpperCase(),
        number: rawNumber,
        expiryMonth: expMonth.padStart(2, "0"),
        expiryYear: expYear,
        ccv: cardCcv,
      });

      onOpenChange(false);
      setHolderName("");
      setCardNumber("");
      setCardExpiry("");
      setCardCcv("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar cartão no Asaas.";
      setError(msg);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Alterar Cartão de Crédito"
      description="Informe os dados do novo cartão para cobranças futuras da sua assinatura Pro."
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateCardMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={UPDATE_CARD_FORM_ID}
            variant="solid"
            sensoryIntent={false}
            disabled={updateCardMutation.isPending}
            className="gap-2"
          >
            {updateCardMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                <span>Atualizando no Asaas...</span>
              </>
            ) : (
              <span>Salvar Novo Cartão</span>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <form id={UPDATE_CARD_FORM_ID} onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4 pt-2">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <FormField label="Nome no Cartão" htmlFor="update-card-holder" required>
          <Input
            id="update-card-holder"
            placeholder="Nome impresso no cartão"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            autoComplete="cc-name"
            className="text-base sm:text-sm"
          />
        </FormField>

        <FormField label="Número do Cartão" htmlFor="update-card-number" required>
          <Input
            id="update-card-number"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            autoComplete="cc-number"
            className="text-base sm:text-sm"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Validade" htmlFor="update-card-expiry" required>
            <Input
              id="update-card-expiry"
              inputMode="numeric"
              placeholder="MM/AA"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
              maxLength={5}
              autoComplete="cc-exp"
              className="text-base sm:text-sm"
            />
          </FormField>
          <FormField label="CVV" htmlFor="update-card-ccv" required>
            <Input
              id="update-card-ccv"
              inputMode="numeric"
              placeholder="123"
              value={cardCcv}
              onChange={(e) => setCardCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              autoComplete="cc-csc"
              className="text-base sm:text-sm"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
