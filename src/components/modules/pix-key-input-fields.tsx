import { AlertCircle, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge, Button, Input, Select, type SelectOption } from "@/components/ui";
import {
  formatPixKeyTypeLabel,
  stripInvisiblePixChars,
  validateAndClassifyPixKey,
  verifyPixConfiguration,
  type PixKeyType,
} from "@/domain/pix";
import { cn } from "@/lib/utils";

const ALL_PIX_TYPE_OPTIONS: SelectOption[] = [
  { value: "auto", label: "Detecção automática" },
  { value: "cpf", label: "CPF" },
  { value: "phone", label: "Celular (+55)" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave Aleatória (EVP)" },
  { value: "cnpj", label: "CNPJ" },
];

export interface PixKeyProfileSuggestions {
  cpf?: string | null;
  email?: string | null;
}

export interface PixKeyInputFieldsProps {
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  detectedType: PixKeyType | null;
  validationError?: string | null;
  isAmbiguousCpfOrPhone?: boolean;
  onQuickSelectKeyType?: (type: "phone" | "cpf") => void;
  allowCnpj?: boolean;
  allowAuto?: boolean;
  required?: boolean;
  pixKeyId?: string;
  keyTypeId?: string;
  pixKeyLabel?: string;
  pixKeyAriaLabel?: string;
  pixKeyPlaceholder?: string;
  pixKeyHelperText?: string;
  keyTypeLabel?: string;
  keyTypeAriaLabel?: string;
  keyTypeHelperText?: string;
  profileSuggestions?: PixKeyProfileSuggestions;
  showBankRegistrationNotice?: boolean;
  showVerificationBadge?: boolean;
  className?: string;
}

/**
 * Campos padronizados de entrada e classificação de Chave Pix com validação estrita,
 * desambiguação CPF vs Celular (+55), zero preenchimento silencioso de perfil e
 * aviso explícito sobre cadastro ativo no DICT/banco.
 */
export function PixKeyInputFields({
  pixKey,
  onPixKeyChange,
  selectedKeyType,
  onSelectedKeyTypeChange,
  detectedType,
  validationError,
  isAmbiguousCpfOrPhone = false,
  onQuickSelectKeyType,
  allowCnpj = true,
  allowAuto = true,
  required = false,
  pixKeyId,
  keyTypeId,
  pixKeyLabel = "Chave Pix",
  pixKeyAriaLabel,
  pixKeyPlaceholder = "CPF, celular, e-mail ou chave aleatória",
  pixKeyHelperText = "Receberá os pagamentos via QR Code e Copia e Cola",
  keyTypeLabel = "Tipo de Chave",
  keyTypeAriaLabel = "Tipo de chave Pix",
  keyTypeHelperText = "Ajuste caso o celular não tenha +55 ou use 11 dígitos",
  profileSuggestions,
  showBankRegistrationNotice = true,
  showVerificationBadge = false,
  className,
}: PixKeyInputFieldsProps) {
  const trimmedKey = stripInvisiblePixChars(pixKey).trim();
  const showValidationError = Boolean(validationError && trimmedKey.length > 0);

  const keyClassification = trimmedKey
    ? validateAndClassifyPixKey(
        trimmedKey,
        selectedKeyType === "auto" || selectedKeyType === "unknown"
          ? undefined
          : (selectedKeyType as PixKeyType),
      )
    : null;

  const showNormalizedPreview = Boolean(
    !showValidationError &&
      keyClassification?.isValid &&
      keyClassification.normalizedKey &&
      keyClassification.normalizedKey !== trimmedKey,
  );

  const compactDiagnosis =
    showVerificationBadge && trimmedKey.length > 0 && !showValidationError
      ? verifyPixConfiguration({
          pixKey: trimmedKey,
          keyType:
            selectedKeyType === "auto" || selectedKeyType === "unknown"
              ? undefined
              : (selectedKeyType as PixKeyType),
          allowCnpj,
        })
      : null;

  const badgeLabel = showValidationError
    ? "INVÁLIDA"
    : detectedType
      ? formatPixKeyTypeLabel(detectedType)
      : allowAuto
        ? "AUTO"
        : "PIX";

  const typeOptions = ALL_PIX_TYPE_OPTIONS.filter((opt) => {
    if (!allowAuto && opt.value === "auto") return false;
    if (!allowCnpj && opt.value === "cnpj") return false;
    return true;
  });

  const normalizedProfileEmail = profileSuggestions?.email?.trim().toLowerCase() ?? "";
  const matchesProfileEmail = Boolean(
    normalizedProfileEmail && trimmedKey.toLowerCase() === normalizedProfileEmail,
  );

  const validProfileCpf =
    !trimmedKey && profileSuggestions?.cpf
      ? validateAndClassifyPixKey(profileSuggestions.cpf, "cpf")
      : null;
  const validProfileEmail =
    !trimmedKey && profileSuggestions?.email
      ? validateAndClassifyPixKey(profileSuggestions.email, "email")
      : null;
  const hasSuggestionChips = Boolean(validProfileCpf?.isValid || validProfileEmail?.isValid);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={pixKeyId} className="text-xs font-semibold text-foreground">
              {pixKeyLabel}
            </label>
            <Badge size="xs" variant={showValidationError ? "warning" : "muted"}>
              {badgeLabel}
            </Badge>
          </div>
          <Input
            id={pixKeyId}
            value={pixKey}
            onChange={(e) => {
              const nextVal = e.target.value;
              onPixKeyChange(nextVal);
              if (nextVal === "" && allowAuto && selectedKeyType !== "auto") {
                onSelectedKeyTypeChange("auto");
              }
            }}
            placeholder={pixKeyPlaceholder}
            aria-label={pixKeyAriaLabel || pixKeyLabel}
            aria-invalid={showValidationError || undefined}
            maxLength={85}
            required={required}
            className="text-base sm:text-sm font-mono"
          />
          {showValidationError ? (
            <span className="flex items-start gap-1 text-[11px] font-medium text-critical">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{validationError}</span>
            </span>
          ) : (
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground block">{pixKeyHelperText}</span>
              {showNormalizedPreview && keyClassification?.normalizedKey ? (
                <span className="text-[11px] text-muted-foreground block">
                  No código Pix:{" "}
                  <code className="font-mono font-semibold text-foreground">
                    {keyClassification.normalizedKey}
                  </code>
                </span>
              ) : null}
              {compactDiagnosis?.isReady && compactDiagnosis.crc16 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-positive-strong">
                  <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Chave validada para Pix (CRC16 {compactDiagnosis.crc16})</span>
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor={keyTypeId} className="text-xs font-semibold text-foreground block">
            {keyTypeLabel}
          </label>
          <Select
            id={keyTypeId}
            value={selectedKeyType}
            onValueChange={onSelectedKeyTypeChange}
            options={typeOptions}
            ariaLabel={keyTypeAriaLabel}
          />
          <span className="text-[11px] text-muted-foreground block">{keyTypeHelperText}</span>
        </div>
      </div>

      {isAmbiguousCpfOrPhone && onQuickSelectKeyType ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs">
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

      {hasSuggestionChips ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/80 bg-surface-raised p-2 text-[11px] text-muted-foreground">
          <span>Preencher rapidamente (apenas se já estiver cadastrado no Pix):</span>
          {validProfileCpf?.isValid && validProfileCpf.normalizedKey ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                onPixKeyChange(validProfileCpf.normalizedKey!);
                onSelectedKeyTypeChange("cpf");
              }}
            >
              Usar meu CPF
            </Button>
          ) : null}
          {validProfileEmail?.isValid && validProfileEmail.normalizedKey ? (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                onPixKeyChange(validProfileEmail.normalizedKey!);
                onSelectedKeyTypeChange("email");
              }}
            >
              Usar meu e-mail
            </Button>
          ) : null}
        </div>
      ) : null}

      {matchesProfileEmail ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-[11px] leading-relaxed text-foreground">
          <TriangleAlert className="size-3.5 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>Atenção:</strong> este é o seu e-mail de login no Axir. Confirme se ele está
            realmente cadastrado como chave Pix no seu banco; se não estiver, informe a sua chave
            Pix ativa (CPF, celular, outro e-mail ou chave aleatória).
          </span>
        </div>
      ) : showBankRegistrationNotice ? (
        <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-surface-raised p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="size-3.5 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Informe apenas uma chave Pix já cadastrada e ativa no seu banco. Se a chave não existir
            no Pix (DICT), o QR Code e o Copia e Cola serão recusados como inválidos.
          </span>
        </div>
      ) : null}
    </div>
  );
}
