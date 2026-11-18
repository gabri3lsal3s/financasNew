import { Input, Select, type SelectOption } from "@/components/ui";

const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "auto", label: "Detecção automática" },
  { value: "cpf", label: "CPF" },
  { value: "phone", label: "Celular (+55)" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave Aleatória (EVP)" },
  { value: "cnpj", label: "CNPJ" },
];

export interface ShareGoalPixFieldsProps {
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  merchantName: string;
  onMerchantNameChange: (val: string) => void;
  merchantCity: string;
  onMerchantCityChange: (val: string) => void;
}

export function ShareGoalPixFields({
  pixKey,
  onPixKeyChange,
  selectedKeyType,
  onSelectedKeyTypeChange,
  merchantName,
  onMerchantNameChange,
  merchantCity,
  onMerchantCityChange,
}: ShareGoalPixFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="goal-pix-key" className="text-xs font-semibold text-foreground">
          Chave Pix do Organizador
        </label>
        <Input
          id="goal-pix-key"
          value={pixKey}
          onChange={(e) => onPixKeyChange(e.target.value)}
          placeholder="CPF, celular, e-mail ou aleatória"
          className="text-base sm:text-sm"
          required
        />
        <p className="text-[11px] text-muted-foreground">
          Destino das contribuições dos participantes.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">Tipo de Chave Pix</label>
        <Select
          value={selectedKeyType}
          onValueChange={onSelectedKeyTypeChange}
          options={PIX_KEY_OPTIONS}
          ariaLabel="Tipo de Chave Pix"
        />
        <p className="text-[11px] text-muted-foreground">Formatação do identificador BACEN.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="goal-merchant-name" className="text-xs font-semibold text-foreground">
          Nome do Titular / Organizador
        </label>
        <Input
          id="goal-merchant-name"
          value={merchantName}
          onChange={(e) => onMerchantNameChange(e.target.value)}
          placeholder="Ex.: Gabriel Sales"
          className="text-base sm:text-sm"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="goal-merchant-city" className="text-xs font-semibold text-foreground">
          Cidade
        </label>
        <Input
          id="goal-merchant-city"
          value={merchantCity}
          onChange={(e) => onMerchantCityChange(e.target.value)}
          placeholder="Ex.: SAO PAULO"
          className="text-base sm:text-sm"
          required
        />
      </div>
    </>
  );
}
