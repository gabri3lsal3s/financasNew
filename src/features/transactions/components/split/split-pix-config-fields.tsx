import { PixRecipientConfigFields, type PixKeyProfileSuggestions } from "@/components/modules";
import { Select } from "@/components/ui";
import type { SplitRemainderPolicy } from "@/domain/finance/split-math";
import type { PixKeyType } from "@/domain/pix";
import { REMAINDER_OPTIONS } from "./split-constants";

export interface SplitPixConfigFieldsProps {
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  detectedType: PixKeyType | null;
  merchantName: string;
  onMerchantNameChange: (val: string) => void;
  remainderPolicy?: SplitRemainderPolicy;
  onRemainderPolicyChange?: (val: SplitRemainderPolicy) => void;
  validationError?: string | null;
  isAmbiguousCpfOrPhone?: boolean;
  onQuickSelectKeyType?: (type: "phone" | "cpf") => void;
  profileSuggestions?: PixKeyProfileSuggestions;
  profileEmail?: string | null;
  previewAmountCents?: number;
  previewInfoAdicional?: string;
  showVerificationPanel?: boolean;
  allowTestCopy?: boolean;
  onTestCopyBrCode?: (brCode: string) => void;
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
  remainderPolicy = "host",
  onRemainderPolicyChange,
  validationError,
  isAmbiguousCpfOrPhone,
  onQuickSelectKeyType,
  profileSuggestions,
  profileEmail,
  previewAmountCents,
  previewInfoAdicional,
  showVerificationPanel = true,
  allowTestCopy = true,
  onTestCopyBrCode,
  hideRemainderPolicy = false,
}: SplitPixConfigFieldsProps) {
  return (
    <div data-tour="split-pix-config" className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
      <span className="text-xs font-semibold text-foreground block">Dados Pix para Recebimento</span>

      <PixRecipientConfigFields
        pixKey={pixKey}
        onPixKeyChange={onPixKeyChange}
        selectedKeyType={selectedKeyType}
        onSelectedKeyTypeChange={onSelectedKeyTypeChange}
        detectedType={detectedType}
        validationError={validationError}
        isAmbiguousCpfOrPhone={isAmbiguousCpfOrPhone}
        onQuickSelectKeyType={onQuickSelectKeyType}
        profileSuggestions={profileSuggestions}
        profileEmail={profileEmail}
        merchantName={merchantName}
        onMerchantNameChange={onMerchantNameChange}
        previewAmountCents={previewAmountCents}
        previewInfoAdicional={previewInfoAdicional}
        defaultMerchantName="Anfitriao"
        defaultMerchantCity="BRASILIA"
        showVerificationPanel={showVerificationPanel}
        allowTestCopy={allowTestCopy}
        onTestCopyBrCode={onTestCopyBrCode}
        pixKeyLabel="Chave Pix do Anfitrião"
        pixKeyAriaLabel="Chave Pix do anfitrião"
        keyTypeLabel="Tipo de Chave"
        keyTypeAriaLabel="Tipo de chave Pix"
        merchantNameLabel="Nome do Titular"
        merchantNameAriaLabel="Nome do titular da chave Pix"
        merchantNamePlaceholder="Nome completo ou comercial (opcional)"
      />

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
