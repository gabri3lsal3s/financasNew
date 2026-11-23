import { PixRecipientConfigFields, type PixKeyProfileSuggestions } from "@/components/modules";
import type { PixKeyType } from "@/domain/pix";

export interface ShareGoalPixFieldsProps {
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  detectedType?: PixKeyType | null;
  validationError?: string | null;
  isAmbiguousCpfOrPhone?: boolean;
  onQuickSelectKeyType?: (type: "phone" | "cpf") => void;
  profileSuggestions?: PixKeyProfileSuggestions;
  merchantName: string;
  onMerchantNameChange: (val: string) => void;
  previewInfoAdicional?: string;
}

export function ShareGoalPixFields({
  pixKey,
  onPixKeyChange,
  selectedKeyType,
  onSelectedKeyTypeChange,
  detectedType = null,
  validationError = null,
  isAmbiguousCpfOrPhone = false,
  onQuickSelectKeyType,
  profileSuggestions,
  merchantName,
  onMerchantNameChange,
  previewInfoAdicional,
}: ShareGoalPixFieldsProps) {
  return (
    <div className="sm:col-span-2 pt-1 border-t border-border/80">
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
        merchantName={merchantName}
        onMerchantNameChange={onMerchantNameChange}
        previewInfoAdicional={previewInfoAdicional}
        defaultMerchantName="Organizador"
        defaultMerchantCity="BRASILIA"
        requirePixKey={true}
        showVerificationPanel={true}
        allowTestCopy={true}
        pixKeyId="goal-pix-key"
        pixKeyLabel="Chave Pix do Organizador"
        pixKeyAriaLabel="Chave Pix do Organizador"
        pixKeyHelperText="Obrigatória · Destino das contribuições dos participantes"
        keyTypeLabel="Tipo de Chave Pix"
        keyTypeAriaLabel="Tipo de Chave Pix"
        keyTypeHelperText="Formatação do identificador BACEN"
        merchantNameId="goal-merchant-name"
        merchantNameLabel="Nome do Titular / Organizador"
        merchantNameAriaLabel="Nome do Titular / Organizador"
        merchantNamePlaceholder="Ex.: Gabriel Sales (opcional)"
      />
    </div>
  );
}
