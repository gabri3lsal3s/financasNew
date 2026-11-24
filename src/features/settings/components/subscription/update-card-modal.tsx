import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { BillingContactFields } from "@/components/modules/subscription";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
} from "@/components/ui";
import {
  cleanCep,
  cleanPhoneBR,
  formatCardExpiry,
  formatCardNumber,
  formatCep,
  formatPhoneBR,
  isValidCep,
  isValidPhoneBR,
} from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { useBillingContact, useUpdateSubscriptionCardMutation } from "@/state";

const UPDATE_CARD_FORM_ID = "update-card-form";

export interface UpdateCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateCardModal({ open, onOpenChange }: UpdateCardModalProps) {
  const updateCardMutation = useUpdateSubscriptionCardMutation();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Alterar Cartão de Crédito"
      description="Informe os dados do novo cartão e endereço de cobrança para renovações futuras."
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
            variant="default"
            sensoryIntent={false}
            disabled={updateCardMutation.isPending}
            className="gap-2 shadow-xs"
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
      {/* Desmonta o formulário ao fechar para descartar PAN/CVV/validade imediatamente da memória (D-10) */}
      {open ? (
        <UpdateCardModalForm
          mutateAsync={updateCardMutation.mutateAsync}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}

interface UpdateCardModalFormProps {
  mutateAsync: ReturnType<typeof useUpdateSubscriptionCardMutation>["mutateAsync"];
  onClose: () => void;
}

function UpdateCardModalForm({ mutateAsync, onClose }: UpdateCardModalFormProps) {
  const billingContactQuery = useBillingContact(true);

  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const [postalCodeInput, setPostalCodeInput] = useState<string | null>(null);
  const [addressNumberInput, setAddressNumberInput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contact = billingContactQuery.data;
  const phone = phoneInput ?? (contact?.phone ? formatPhoneBR(contact.phone) : "");
  const postalCode = postalCodeInput ?? (contact?.postalCode ? formatCep(contact.postalCode) : "");
  const addressNumber = addressNumberInput ?? (contact?.addressNumber?.trim() || "");

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

    if (!isValidPhoneBR(phone)) {
      triggerSensory("error");
      setError("Informe um telefone válido com DDD.");
      return;
    }

    if (!isValidCep(postalCode)) {
      triggerSensory("error");
      setError("Informe um CEP válido (8 dígitos).");
      return;
    }

    if (!addressNumber.trim()) {
      triggerSensory("error");
      setError("Informe o número do endereço de cobrança (ou S/N).");
      return;
    }

    try {
      await mutateAsync({
        holderName: holderName.trim().toUpperCase(),
        number: rawNumber,
        expiryMonth: expMonth.padStart(2, "0"),
        expiryYear: expYear,
        ccv: cardCcv,
        phone: cleanPhoneBR(phone),
        postalCode: cleanCep(postalCode),
        addressNumber: addressNumber.trim(),
      });

      onClose();
    } catch (err: unknown) {
      // Limpa CVV imediatamente em erro de submissão (D-10)
      setCardCcv("");
      const msg = err instanceof Error ? err.message : "Falha ao atualizar cartão no Asaas.";
      setError(msg);
    }
  };

  return (
    <form
      id={UPDATE_CARD_FORM_ID}
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="space-y-4 pt-2"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
      </div>

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
            type="password"
            inputMode="numeric"
            placeholder="123"
            value={cardCcv}
            onChange={(e) => setCardCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
            maxLength={4}
            autoComplete="off"
            className="text-base sm:text-sm"
          />
        </FormField>
      </div>

      <BillingContactFields
        idPrefix="update-card"
        required
        phone={phone}
        postalCode={postalCode}
        addressNumber={addressNumber}
        onPhoneChange={(val) => setPhoneInput(formatPhoneBR(val))}
        onPostalCodeChange={(val) => setPostalCodeInput(formatCep(val))}
        onAddressNumberChange={setAddressNumberInput}
      />
    </form>
  );
}
