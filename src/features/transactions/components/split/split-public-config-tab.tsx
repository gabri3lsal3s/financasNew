import { QrCodeCanvas } from "@/components/ui/qr-code-canvas";
import { CalendarClock, Copy, ExternalLink, RefreshCw, Save, ShieldCheck } from "lucide-react";
import type { PixKeyProfileSuggestions } from "@/components/modules";
import { Alert, Badge, Button, FormField, Switch, Textarea } from "@/components/ui";
import { decodePixBrCode, formatPixKeyTypeLabel, type PixKeyType } from "@/domain/pix";
import { formatDateBR } from "@/lib/date";
import { formatCentsAsBRL } from "@/services/masks";
import { SplitPixConfigFields } from "./split-pix-config-fields";

export interface SplitPublicConfigTabProps {
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  detectedType: PixKeyType | null;
  pixValidationError: string | null;
  isAmbiguousCpfOrPhone: boolean;
  onQuickSelectKeyType: (type: "phone" | "cpf") => void;
  profileSuggestions?: PixKeyProfileSuggestions;
  hostName: string;
  onHostNameChange: (val: string) => void;
  customNote: string;
  onCustomNoteChange: (val: string) => void;
  showParticipantsList: boolean;
  onShowParticipantsListChange: (val: boolean) => void;
  publicPagePaused: boolean;
  onPublicPagePausedChange: (val: boolean) => void;
  previewBrCode: string;
  previewAmountCents: number;
  expiresAt: string | null;
  publicUrl: string;
  isValid: boolean;
  isSaving: boolean;
  onTestCopyBrCode: () => void;
  onCopyPublicLink: () => void;
  onExtendExpiration: () => void;
  onRegenerateLink: () => void;
  onSavePublicConfig: () => void;
}

/** Aba de configuração da chave Pix, QR Code ao vivo, recado e controle do link público. */
export function SplitPublicConfigTab({
  pixKey,
  onPixKeyChange,
  selectedKeyType,
  onSelectedKeyTypeChange,
  detectedType,
  pixValidationError,
  isAmbiguousCpfOrPhone,
  onQuickSelectKeyType,
  profileSuggestions,
  hostName,
  onHostNameChange,
  customNote,
  onCustomNoteChange,
  showParticipantsList,
  onShowParticipantsListChange,
  publicPagePaused,
  onPublicPagePausedChange,
  previewBrCode,
  previewAmountCents,
  expiresAt,
  publicUrl,
  isValid,
  isSaving,
  onTestCopyBrCode,
  onCopyPublicLink,
  onExtendExpiration,
  onRegenerateLink,
  onSavePublicConfig,
}: SplitPublicConfigTabProps) {
  const decodedPreview = previewBrCode ? decodePixBrCode(previewBrCode) : null;

  return (
    <div className="space-y-4">
      <SplitPixConfigFields
        pixKey={pixKey}
        onPixKeyChange={onPixKeyChange}
        selectedKeyType={selectedKeyType}
        onSelectedKeyTypeChange={onSelectedKeyTypeChange}
        detectedType={detectedType}
        validationError={pixValidationError}
        isAmbiguousCpfOrPhone={isAmbiguousCpfOrPhone}
        onQuickSelectKeyType={onQuickSelectKeyType}
        profileSuggestions={profileSuggestions}
        merchantName={hostName}
        onMerchantNameChange={onHostNameChange}
        showVerificationPanel={false}
        allowTestCopy={false}
        hideRemainderPolicy={true}
      />

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
        <FormField
          label="Recado para os convidados (opcional)"
          helperText={`${customNote.length}/200 caracteres · Exibido no topo da página pública de cobrança`}
        >
          <Textarea
            value={customNote}
            onChange={(e) => onCustomNoteChange(e.target.value)}
            placeholder="Ex.: Galera, pode mandar o Pix até sexta-feira. Obrigado!"
            maxLength={200}
            rows={2}
            aria-label="Recado para os convidados do racha"
          />
        </FormField>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            Prévia ao vivo do QR Code Pix
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {decodedPreview?.isValidCrc && decodedPreview.crc ? (
              <Badge variant="positive" size="xs">
                CRC16 {decodedPreview.crc}
              </Badge>
            ) : null}
            <Badge variant="portfolio" size="xs">
              Exemplo cota: {formatCentsAsBRL(previewAmountCents)}
            </Badge>
          </div>
        </div>

        {previewBrCode ? (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <QrCodeCanvas
              text={previewBrCode}
              size={192}
              label="Prévia do QR Code Pix"
              className="shrink-0"
            />
            <div className="flex flex-col gap-2.5 min-w-0 flex-1 w-full">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cada amigo verá o QR Code preenchido com o valor exato pendente da sua cota (ou parcela) e os dados do seu Pix acima.
              </p>
              {decodedPreview ? (
                <div className="rounded-lg border border-border/80 bg-surface-raised p-2.5 text-[11px] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Chave no BR Code ({formatPixKeyTypeLabel(detectedType)}):</span>
                    <span className="font-mono font-semibold text-foreground break-all text-right">
                      {decodedPreview.pixKey}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Recebedor EMV:</span>
                    <span className="text-foreground text-right">
                      {decodedPreview.merchantName}
                    </span>
                  </div>
                </div>
              ) : null}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Importante: alguns bancos (como Banco do Brasil) recusam o pagamento se você tentar testar o Copia e Cola na mesma conta recebedora ou se a chave não estiver cadastrada no Pix.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={onTestCopyBrCode} className="gap-1.5">
                  <Copy className="size-3.5" aria-hidden="true" />
                  <span>Testar Copia e Cola</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Alert variant="warning">
            <span>
              {pixValidationError ||
                "Informe uma chave Pix válida para gerar o QR Code e o Copia e Cola."}
            </span>
          </Alert>
        )}
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">Privacidade e Controle do Link</span>
        </div>

        <div className="space-y-2.5">
          <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
            <Switch
              id="manage-split-show-participants"
              checked={showParticipantsList}
              onCheckedChange={onShowParticipantsListChange}
              label="Exibir lista de participantes na página pública"
              description="Mostra na página compartilhada quem ainda está pendente ou já pagou"
            />
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
            <Switch
              id="manage-split-pause-link"
              checked={publicPagePaused}
              onCheckedChange={onPublicPagePausedChange}
              label="Pausar página pública temporariamente"
              description="Desativa o acesso público e impede avisos de pagamento sem excluir o racha"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-border/80 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Validade atual do link:{" "}
              <strong className="text-foreground">
                {expiresAt ? formatDateBR(expiresAt.slice(0, 10)) : "Sem expiração"}
              </strong>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="xs" variant="outline" disabled={isSaving} onClick={onExtendExpiration}>
              Estender +60 dias
            </Button>
            <Button type="button" size="xs" variant="outline" disabled={isSaving} onClick={onRegenerateLink} className="gap-1">
              <RefreshCw className="size-3" aria-hidden="true" />
              <span>Regenerar Link</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" size="xs" variant="outline" onClick={onCopyPublicLink} className="gap-1.5">
            <Copy className="size-3" aria-hidden="true" />
            <span>Copiar Link</span>
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.open(publicUrl, "_blank", "noopener,noreferrer");
              }
            }}
            className="gap-1.5"
          >
            <ExternalLink className="size-3" aria-hidden="true" />
            <span>Abrir Prévia Pública</span>
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="default"
          disabled={!isValid || isSaving}
          onClick={onSavePublicConfig}
          className="gap-1.5"
        >
          <Save className="size-3.5" aria-hidden="true" />
          <span>{isSaving ? "Salvando..." : "Salvar Configurações"}</span>
        </Button>
      </div>
    </div>
  );
}
