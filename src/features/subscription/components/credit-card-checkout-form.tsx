import { BillingContactFields } from "@/components/modules/subscription";
import { Badge, FormField, Input } from "@/components/ui";

export interface CreditCardCheckoutFormProps {
  holderName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCcv: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  detectedBrand: string | null;
  onHolderNameChange: (val: string) => void;
  onCardNumberChange: (val: string) => void;
  onCardExpiryChange: (val: string) => void;
  onCardCcvChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onPostalCodeChange: (val: string) => void;
  onAddressNumberChange: (val: string) => void;
}

export function CreditCardCheckoutForm({
  holderName,
  cardNumber,
  cardExpiry,
  cardCcv,
  phone,
  postalCode,
  addressNumber,
  detectedBrand,
  onHolderNameChange,
  onCardNumberChange,
  onCardExpiryChange,
  onCardCcvChange,
  onPhoneChange,
  onPostalCodeChange,
  onAddressNumberChange,
}: CreditCardCheckoutFormProps) {
  return (
    <div className="space-y-3.5 pt-1">
      <FormField label="Nome no Cartão" htmlFor="checkout-card-holder">
        <Input
          id="checkout-card-holder"
          placeholder="Nome como impresso no cartão"
          value={holderName}
          onChange={(e) => onHolderNameChange(e.target.value)}
          autoComplete="cc-name"
          className="text-base sm:text-sm"
        />
      </FormField>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="checkout-card-number"
            className="text-xs font-semibold text-foreground select-none"
          >
            Número do Cartão
          </label>
          {detectedBrand ? (
            <Badge variant="default" size="xs" className="font-semibold">
              {detectedBrand}
            </Badge>
          ) : null}
        </div>
        <Input
          id="checkout-card-number"
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
          value={cardNumber}
          onChange={(e) => onCardNumberChange(e.target.value)}
          autoComplete="cc-number"
          className="text-base sm:text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Validade" htmlFor="checkout-card-expiry">
          <Input
            id="checkout-card-expiry"
            inputMode="numeric"
            placeholder="MM/AA"
            value={cardExpiry}
            onChange={(e) => onCardExpiryChange(e.target.value)}
            maxLength={5}
            autoComplete="cc-exp"
            className="text-base sm:text-sm"
          />
        </FormField>

        <FormField label="CVV" htmlFor="checkout-card-ccv">
          <Input
            id="checkout-card-ccv"
            type="password"
            inputMode="numeric"
            placeholder="123"
            value={cardCcv}
            onChange={(e) => onCardCcvChange(e.target.value)}
            maxLength={4}
            autoComplete="off"
            className="text-base sm:text-sm"
          />
        </FormField>
      </div>

      <BillingContactFields
        idPrefix="checkout-card"
        phone={phone}
        postalCode={postalCode}
        addressNumber={addressNumber}
        onPhoneChange={onPhoneChange}
        onPostalCodeChange={onPostalCodeChange}
        onAddressNumberChange={onAddressNumberChange}
      />
    </div>
  );
}
