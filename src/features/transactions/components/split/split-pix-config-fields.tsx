import { Badge, Button, Input, Select } from "@/components/ui";
import type { SplitRemainderPolicy } from "@/domain/finance/split-math";
import type { PixKeyType } from "@/domain/pix";
import { PIX_KEY_OPTIONS, REMAINDER_OPTIONS } from "./split-constants";

export interface SplitPixConfigFieldsProps {
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  detectedType: PixKeyType | null;
  merchantName: string;
  onMerchantNameChange: (val: string) => void;
  merchantCity: string;
  onMerchantCityChange: (val: string) => void;
  remainderPolicy?: SplitRemainderPolicy;
  onRemainderPolicyChange?: (val: SplitRemainderPolicy) => void;
  validationError?: string | null;
  isAmbiguousCpfOrPhone?: boolean;
  onQuickSelectKeyType?: (type: "phone" | "cpf") => void;
  hideRemainderPolicy?: boolean;
}

/** Configuração de chave Pix do anfitrião e política de distribuição de centavos. */
export function SplitPixConfigFields({
  pixKey,
  onPixKeyChange,
  selectedKeyType,
  onSelectedKeyTypeChange,
  detectedType,
  merchantName,
  onMerchantNameChange,
  merchantCity,
  onMerchantCityChange,
  remainderPolicy = "host",
  onRemainderPolicyChange,
  validationError,
  isAmbiguousCpfOrPhone,
  onQuickSelectKeyType,
  hideRemainderPolicy = false,
}: SplitPixConfigFieldsProps) {
  const showValidationError = Boolean(validationError && pixKey.trim().length > 0);
  const badgeLabel = showValidationError
    ? "INVÁLIDA"
    : detectedType
      ? detectedType.toUpperCase()
      : "AUTO";

  return (
    <div data-tour="split-pix-config" className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
      <span className="text-xs font-semibold text-foreground block">Dados Pix para Recebimento</span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-foreground">Chave Pix do Anfitrião</label>
            <Badge size="xs" variant={showValidationError ? "warning" : "muted"}>
              {badgeLabel}
            </Badge>
          </div>
          <Input
            value={pixKey}
            onChange={(e) => onPixKeyChange(e.target.value)}
            placeholder="CPF, celular, e-mail ou chave aleatória"
            aria-label="Chave Pix do anfitrião"
            aria-invalid={showValidationError || undefined}
          />
          {showValidationError ? (
            <span className="text-[11px] font-medium text-critical block">{validationError}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground block">
              Receberá os pagamentos via QR Code e Copia e Cola
            </span>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Tipo de Chave</label>
          <Select
            value={selectedKeyType}
            onValueChange={onSelectedKeyTypeChange}
            options={PIX_KEY_OPTIONS}
            ariaLabel="Tipo de chave Pix"
          />
          <span className="text-[11px] text-muted-foreground block">Ajuste caso o celular não tenha +55 ou use formato 11 dígitos</span>
        </div>

        {isAmbiguousCpfOrPhone && onQuickSelectKeyType ? (
          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs">
            <span className="text-foreground font-medium">
              Essa chave de 11 dígitos pode ser Celular (+55) ou CPF. Confirme o tipo correto:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="xs"
                variant={selectedKeyType === "phone" ? "default" : "outline"}
                onClick={() => onQuickSelectKeyType("phone")}
              >
                Celular (+55)
              </Button>
              <Button
                type="button"
                size="xs"
                variant={selectedKeyType === "cpf" ? "default" : "outline"}
                onClick={() => onQuickSelectKeyType("cpf")}
              >
                CPF
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Nome do Titular</label>
          <Input
            value={merchantName}
            onChange={(e) => onMerchantNameChange(e.target.value)}
            placeholder="Nome completo ou comercial"
            maxLength={25}
            aria-label="Nome do titular da chave Pix"
          />
          <span className="text-[11px] text-muted-foreground block">Nome cadastrado no banco (máximo 25 caracteres)</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Cidade do Titular</label>
          <Input
            value={merchantCity}
            onChange={(e) => onMerchantCityChange(e.target.value.toUpperCase())}
            placeholder="Sua cidade (ex.: Nossa Senhora da Glória)"
            maxLength={60}
            aria-label="Cidade do titular da chave Pix"
          />
          <span className="text-[11px] text-muted-foreground block">Salva automaticamente para os próximos rachas</span>
        </div>
      </div>

      {!hideRemainderPolicy && onRemainderPolicyChange ? (
        <div className="space-y-1 pt-1">
          <label className="text-xs font-semibold text-foreground">Política de Centavos</label>
          <Select
            value={remainderPolicy}
            onValueChange={(val) => onRemainderPolicyChange(val as SplitRemainderPolicy)}
            options={REMAINDER_OPTIONS}
            ariaLabel="Política de distribuição de centavos"
          />
          <span className="text-[11px] text-muted-foreground block">
            Define quem absorve frações não divisíveis de 1 centavo
          </span>
        </div>
      ) : null}
    </div>
  );
}
