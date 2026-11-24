import { useState } from "react";
import { ClipboardPaste, FileUp, Loader2, Lock } from "lucide-react";
import { Button, Dropzone, FormField, Input, Tabs, Textarea } from "@/components/ui";
import { readClipboardText } from "@/services/clipboard";

export const STATEMENT_FILE_ACCEPT =
  ".pdf,.csv,.ofx,.xlsx,.xls,.txt,.tsv,.html,.htm,.png,.jpg,.jpeg,.webp,.avif,application/pdf,text/csv,text/plain,text/html,text/comma-separated-values,text/tab-separated-values,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/x-ofx,application/ofx,text/ofx,image/png,image/jpeg,image/webp,image/avif,application/octet-stream,*/*";

type UploadInputMode = "file" | "paste";

export interface StatementUploadStepProps {
  onFileSelect: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  onTextSubmit?: (text: string) => void;
  isProcessing?: boolean;
  processingMessage?: string | null;
  pendingPasswordFile?: File | null;
  passwordError?: string | null;
  onPasswordSubmit?: (password: string) => void;
  onPasswordCancel?: () => void;
}

/**
 * Passo 1 do Diálogo de Importação de Fatura:
 * Permite enviar arquivos (.pdf, .csv, .ofx, .xlsx/.xls, prints da fatura)
 * ou colar texto/tabela copiada diretamente do Internet Banking, PDF ou planilha.
 */
export function StatementUploadStep({
  onFileSelect,
  onFilesSelect,
  onTextSubmit,
  isProcessing = false,
  processingMessage = null,
  pendingPasswordFile = null,
  passwordError = null,
  onPasswordSubmit,
  onPasswordCancel,
}: StatementUploadStepProps) {
  const [mode, setMode] = useState<UploadInputMode>("file");
  const [pastedText, setPastedText] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");

  const handleDrop = (files: File[]) => {
    if (isProcessing || files.length === 0) return;
    if (onFilesSelect) {
      onFilesSelect(files);
      return;
    }
    const first = files[0];
    if (first) onFileSelect(first);
  };

  const handlePasteFromClipboard = async () => {
    if (isProcessing) return;
    const res = await readClipboardText();
    if (res.status === "success" && res.text.trim()) {
      setPastedText(res.text);
    }
  };

  const handleSubmitText = () => {
    if (isProcessing || !onTextSubmit || !pastedText.trim()) return;
    onTextSubmit(pastedText);
  };

  const handleUnlockPdf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfPassword.trim() || !onPasswordSubmit) return;
    onPasswordSubmit(pdfPassword);
    setPdfPassword("");
  };

  const modeTabs = [
    {
      value: "file",
      label: "Enviar arquivo ou print",
      content: null,
    },
    {
      value: "paste",
      label: "Colar texto ou tabela",
      content: null,
    },
  ];

  return (
    <div className="space-y-3.5 pt-1">
      {pendingPasswordFile ? (
        <form
          onSubmit={handleUnlockPdf}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 space-y-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="pt-0.5 text-warning-strong shrink-0">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Fatura em PDF protegida por senha
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O arquivo <strong className="text-foreground">{pendingPasswordFile.name}</strong> está
                criptografado. Digite a senha para continuar a importação.
              </p>
            </div>
          </div>

          <FormField
            label="Senha do arquivo PDF"
            helperText="A senha não é armazenada e permanece apenas em memória durante a leitura."
            error={passwordError ?? undefined}
          >
            <Input
              type="password"
              autoFocus={false}
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              placeholder="Digite a senha do PDF"
              disabled={isProcessing}
              aria-label="Senha do arquivo PDF"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-1">
            {onPasswordCancel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => {
                  setPdfPassword("");
                  onPasswordCancel();
                }}
              >
                Cancelar
              </Button>
            ) : null}
            <Button
              type="submit"
              size="sm"
              disabled={isProcessing || !pdfPassword.trim()}
              className="gap-1.5"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Desbloqueando...</span>
                </>
              ) : (
                <span>Desbloquear e Continuar</span>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {onTextSubmit ? (
            <Tabs
              value={mode}
              onValueChange={(val) => setMode(val as UploadInputMode)}
              items={modeTabs}
              fullWidth
            />
          ) : null}

          {mode === "file" || !onTextSubmit ? (
            <Dropzone
              accept={STATEMENT_FILE_ACCEPT}
              multiple
              maxSizeBytes={15 * 1024 * 1024}
              onFiles={handleDrop}
              disabled={isProcessing}
              label="Selecione o arquivo da fatura (PDF, CSV, OFX, Excel ou print)"
              hint="Aceita PDF digital ou escaneado, CSV, OFX, Excel (.xlsx/.xls) e até 3 prints da fatura aberta"
            />
          ) : (
            <div className="space-y-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
              <FormField
                label="Conteúdo da fatura"
                helperText="Cole lançamentos copiados do Internet Banking, aplicativo do banco, planilha ou PDF."
              >
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  disabled={isProcessing}
                  rows={6}
                  placeholder={"Exemplos aceitos:\n15/08  Supermercado Dia  R$ 140,50\n16/08  Livraria 2/3  120,00"}
                  aria-label="Conteúdo colado da fatura"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => void handlePasteFromClipboard()}
                  className="gap-1.5"
                >
                  <ClipboardPaste className="size-4" aria-hidden="true" />
                  Colar área
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isProcessing || !pastedText.trim()}
                  onClick={handleSubmitText}
                  className="gap-1.5"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FileUp className="size-4" aria-hidden="true" />
                      Organizar fatura
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {isProcessing ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-xl border border-border/80 bg-surface px-3.5 py-2.5 text-xs text-muted-foreground"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>{processingMessage || "Pré-processando e organizando lançamentos da fatura..."}</span>
        </div>
      ) : null}
    </div>
  );
}
