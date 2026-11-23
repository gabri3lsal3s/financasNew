import { useState } from "react";
import { AlertCircle, Check, Copy, ShieldCheck } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import {
  DEFAULT_PIX_CITY,
  formatPixKeyTypeLabel,
  verifyPixConfiguration,
  type PixKeyType,
} from "@/domain/pix";
import { copyTextToClipboard } from "@/services/export-actions";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { PixKeyInputFields, type PixKeyProfileSuggestions } from "./pix-key-input-fields";

export interface PixRecipientConfigFieldsProps {
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  detectedType?: PixKeyType | null;
  validationError?: string | null;
  isAmbiguousCpfOrPhone?: boolean;
  onQuickSelectKeyType?: (type: "phone" | "cpf") => void;
  profileSuggestions?: PixKeyProfileSuggestions;
  profileEmail?: string | null;
  merchantName: string;
  onMerchantNameChange: (val: string) => void;
  previewAmountCents?: number;
  previewInfoAdicional?: string;
  defaultMerchantName?: string;
  defaultMerchantCity?: string;
  requirePixKey?: boolean;
  allowCnpj?: boolean;
  showVerificationPanel?: boolean;
  allowTestCopy?: boolean;
  onTestCopyBrCode?: (brCode: string) => void;
  pixKeyId?: string;
  keyTypeId?: string;
  merchantNameId?: string;
  pixKeyLabel?: string;
  pixKeyAriaLabel?: string;
  pixKeyPlaceholder?: string;
  pixKeyHelperText?: string;
  keyTypeLabel?: string;
  keyTypeAriaLabel?: string;
  keyTypeHelperText?: string;
  merchantNameLabel?: string;
  merchantNameAriaLabel?: string;
  merchantNamePlaceholder?: string;
}

/**
 * Configuração mínima e unificada de recebedor Pix (Racha & Metas Coletivas):
 * exige apenas a Chave Pix, mantém Nome do Titular opcional, preenche Cidade EMV
 * automaticamente nos bastidores ("BRASILIA") e exibe verificação EMV/CRC16 ao vivo.
 */
export function PixRecipientConfigFields({
  pixKey,
  onPixKeyChange,
  selectedKeyType,
  onSelectedKeyTypeChange,
  detectedType = null,
  validationError = null,
  isAmbiguousCpfOrPhone = false,
  onQuickSelectKeyType,
  profileSuggestions,
  profileEmail,
  merchantName,
  onMerchantNameChange,
  previewAmountCents,
  previewInfoAdicional,
  defaultMerchantName = "RECEBEDOR",
  defaultMerchantCity = DEFAULT_PIX_CITY,
  requirePixKey = true,
  allowCnpj = true,
  showVerificationPanel = true,
  allowTestCopy = true,
  onTestCopyBrCode,
  pixKeyId,
  keyTypeId,
  merchantNameId,
  pixKeyLabel = "Chave Pix",
  pixKeyAriaLabel,
  pixKeyPlaceholder = "CPF, celular, e-mail ou chave aleatória",
  pixKeyHelperText = "Obrigatória · Receberá os pagamentos via QR Code e Copia e Cola",
  keyTypeLabel = "Tipo de Chave",
  keyTypeAriaLabel = "Tipo de chave Pix",
  keyTypeHelperText = "Detecção automática com ajuste para celular/CPF",
  merchantNameLabel = "Nome do Titular",
  merchantNameAriaLabel = "Nome do titular da chave Pix",
  merchantNamePlaceholder = "Ex.: Gabriel Sales (opcional)",
}: PixRecipientConfigFieldsProps) {
  const [copiedTest, setCopiedTest] = useState(false);

  const effectiveProfileEmail = profileEmail ?? profileSuggestions?.email ?? null;
  const diagnosis = verifyPixConfiguration({
    pixKey,
    keyType:
      selectedKeyType === "auto" || selectedKeyType === "unknown"
        ? undefined
        : (selectedKeyType as PixKeyType),
    merchantName,
    merchantCity: defaultMerchantCity,
    amountCents: previewAmountCents,
    infoAdicional: previewInfoAdicional,
    profileEmail: effectiveProfileEmail,
    allowCnpj,
    defaultMerchantName,
    defaultMerchantCity,
  });

  const resolvedError = validationError ?? diagnosis.keyValidation.errorMessage;
  const resolvedDetectedType = detectedType ?? diagnosis.keyValidation.resolvedType;

  const handleTestCopy = async () => {
    if (!diagnosis.brCode) return;
    const cleanCode = diagnosis.brCode.trim();
    if (onTestCopyBrCode) {
      onTestCopyBrCode(cleanCode);
      return;
    }
    const ok = await copyTextToClipboard(cleanCode);
    if (ok) {
      setCopiedTest(true);
      triggerSensory("selection");
      pushToast({
        title: "Código Pix de teste copiado!",
        description: "Cole em Pix Copia e Cola de outra conta para validar o recebimento.",
        variant: "default",
      });
      setTimeout(() => setCopiedTest(false), 3000);
    } else {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível copiar o código automaticamente.",
        variant: "destructive",
      });
    }
  };

  const nameHelperText =
    (diagnosis.resolvedName.adjusted ||
      (merchantName.trim().length > 0 && diagnosis.resolvedName.usedFallback)) &&
    diagnosis.resolvedName.reason
      ? diagnosis.resolvedName.reason
      : "Opcional · O banco do pagador sempre confirma o nome real cadastrado na chave Pix.";

  return (
    <div className="space-y-3.5">
      <PixKeyInputFields
        pixKey={pixKey}
        onPixKeyChange={onPixKeyChange}
        selectedKeyType={selectedKeyType}
        onSelectedKeyTypeChange={onSelectedKeyTypeChange}
        detectedType={resolvedDetectedType}
        validationError={resolvedError}
        isAmbiguousCpfOrPhone={isAmbiguousCpfOrPhone || diagnosis.keyValidation.isAmbiguousCpfOrPhone}
        onQuickSelectKeyType={onQuickSelectKeyType}
        allowCnpj={allowCnpj}
        required={requirePixKey}
        pixKeyId={pixKeyId}
        keyTypeId={keyTypeId}
        pixKeyLabel={pixKeyLabel}
        pixKeyAriaLabel={pixKeyAriaLabel}
        pixKeyPlaceholder={pixKeyPlaceholder}
        pixKeyHelperText={pixKeyHelperText}
        keyTypeLabel={keyTypeLabel}
        keyTypeAriaLabel={keyTypeAriaLabel}
        keyTypeHelperText={keyTypeHelperText}
        profileSuggestions={profileSuggestions}
      />

      <div className="space-y-1">
        <label htmlFor={merchantNameId} className="text-xs font-semibold text-foreground block">
          {merchantNameLabel}{" "}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <Input
          id={merchantNameId}
          value={merchantName}
          onChange={(e) => onMerchantNameChange(e.target.value)}
          placeholder={merchantNamePlaceholder}
          maxLength={50}
          aria-label={merchantNameAriaLabel}
          className="text-base sm:text-sm"
        />
        <span className="text-[11px] text-muted-foreground block">{nameHelperText}</span>
      </div>

      {showVerificationPanel && diagnosis.status === "error" && diagnosis.blockingReason ? (
        <div
          role="alert"
          className="rounded-lg border border-critical/30 bg-critical/5 p-2.5 text-xs flex items-start gap-2 text-foreground"
        >
          <AlertCircle className="size-4 text-critical shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>Código Pix bloqueado — Motivo:</strong> {diagnosis.blockingReason}
          </span>
        </div>
      ) : null}

      {showVerificationPanel && diagnosis.isReady && diagnosis.brCode ? (
        <div
          className={
            diagnosis.status === "warning"
              ? "rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2 text-xs"
              : "rounded-lg border border-positive/25 bg-positive/5 p-3 space-y-2 text-xs"
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
              <span>Código Pix verificado (Padrão BACEN)</span>
            </span>
            {diagnosis.crc16 ? (
              <Badge size="xs" variant="positive">
                CRC16 {diagnosis.crc16}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-1 text-[11px] text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span>Chave ({formatPixKeyTypeLabel(diagnosis.keyValidation.resolvedType)}):</span>
              <code className="font-mono font-semibold text-foreground break-all text-right">
                {diagnosis.keyValidation.normalizedKey}
              </code>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Recebedor no código:</span>
              <span className="font-medium text-foreground text-right">
                {diagnosis.resolvedName.value}
              </span>
            </div>
          </div>

          {diagnosis.autoAdjustments.length > 0 ? (
            <ul className="space-y-0.5 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
              {diagnosis.autoAdjustments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          {allowTestCopy ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1.5 border-t border-border/60">
              <span className="text-[11px] text-muted-foreground leading-snug">
                Não teste colando na mesma conta que recebe o Pix (bancos como o BB bloqueiam autopagamento).
              </span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                sensoryIntent={false}
                onClick={() => void handleTestCopy()}
                className="gap-1.5 shrink-0 self-start sm:self-center"
              >
                {copiedTest ? (
                  <>
                    <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" aria-hidden="true" />
                    <span>Testar Copia e Cola</span>
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
