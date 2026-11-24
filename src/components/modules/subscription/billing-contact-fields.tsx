import { FormField, Input } from "@/components/ui";

export interface BillingContactFieldsProps {
  idPrefix: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  onPhoneChange: (val: string) => void;
  onPostalCodeChange: (val: string) => void;
  onAddressNumberChange: (val: string) => void;
  required?: boolean;
}

/**
 * Campos obrigatórios de contato e endereço de cobrança para aprovação
 * antifraude de cartão de crédito em Produção no Asaas (B-01 / D-19).
 */
export function BillingContactFields({
  idPrefix,
  phone,
  postalCode,
  addressNumber,
  onPhoneChange,
  onPostalCodeChange,
  onAddressNumberChange,
  required = false,
}: BillingContactFieldsProps) {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField
          label="Telefone (com DDD)"
          htmlFor={`${idPrefix}-phone`}
          required={required}
        >
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            inputMode="tel"
            placeholder="(11) 98765-4321"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            maxLength={15}
            autoComplete="tel"
            className="text-base sm:text-sm"
          />
        </FormField>

        <FormField label="CEP" htmlFor={`${idPrefix}-cep`} required={required}>
          <Input
            id={`${idPrefix}-cep`}
            inputMode="numeric"
            placeholder="00000-000"
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            maxLength={9}
            autoComplete="postal-code"
            className="text-base sm:text-sm"
          />
        </FormField>
      </div>

      <FormField
        label="Número do Endereço"
        htmlFor={`${idPrefix}-address-number`}
        helperText="Ex.: 1000 ou S/N (exigido pelo antifraude do cartão)"
        required={required}
      >
        <Input
          id={`${idPrefix}-address-number`}
          placeholder="1000"
          value={addressNumber}
          onChange={(e) => onAddressNumberChange(e.target.value)}
          maxLength={20}
          autoComplete="address-line2"
          className="text-base sm:text-sm"
        />
      </FormField>
    </div>
  );
}
