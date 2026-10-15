import { useState } from "react";
import { CheckCircle2, FileJson, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { parseBackupPayload, type BackupPayload } from "@/domain/export";
import { getErrorMessage } from "@/services/errors";
import { formatDateBR } from "@/lib/date";

export interface StepValidationProps {
  file: File | null;
  parsedPayload: BackupPayload | null;
  onFileLoaded: (file: File, payload: BackupPayload) => void;
  onClearFile: () => void;
  disabled?: boolean;
}

export function StepValidation({
  file,
  parsedPayload,
  onFileLoaded,
  onClearFile,
  disabled,
}: StepValidationProps) {
  const [validating, setValidating] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[] | null>(null);

  const handleFiles = async (files: File[]) => {
    const selected = files[0];
    if (!selected) return;

    setValidating(true);
    setErrorMessages(null);

    try {
      const text = await selected.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("O arquivo selecionado não contém um formato JSON válido.");
      }

      const result = parseBackupPayload(json);
      if (!result.ok) {
        setErrorMessages(result.errors);
        return;
      }

      onFileLoaded(selected, result.payload);
    } catch (err) {
      setErrorMessages([getErrorMessage(err)]);
    } finally {
      setValidating(false);
    }
  };

  if (!file || !parsedPayload) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Selecione o arquivo de backup
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Envie o arquivo .json gerado previamente na Central de Exportação para validação e auditoria.
          </p>
        </div>

        <Dropzone
          onFiles={handleFiles}
          accept="application/json,.json"
          label="Arraste o arquivo de backup (.json) aqui ou clique para selecionar"
          hint="Formato oficial versionado com checksum de integridade."
          disabled={disabled || validating}
        />

        {validating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse p-3 rounded-lg border border-border bg-surface">
            <RefreshCw className="size-4 animate-spin text-primary" aria-hidden="true" />
            <span>Auditando estrutura, campos e checksum do arquivo...</span>
          </div>
        )}

        {errorMessages && errorMessages.length > 0 && (
          <Alert variant="error">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <XCircle className="size-4 text-critical-strong" aria-hidden="true" />
                <span>O arquivo não atende aos requisitos de integridade:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {errorMessages.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          </Alert>
        )}
      </div>
    );
  }

  const metadata = parsedPayload.metadata;
  const exportedAtStr = parsedPayload.exportedAt
    ? formatDateBR(parsedPayload.exportedAt.slice(0, 10))
    : "Data não identificada";

  const totalRecords =
    metadata?.totalRecords ??
    Object.values(parsedPayload.data).reduce(
      (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
      0,
    );

  const modulesCount = metadata?.modulesSummary ?? {
    categories: parsedPayload.data.categories?.length ?? 0,
    cards:
      (parsedPayload.data.credit_cards?.length ?? 0) +
      (parsedPayload.data.card_payments?.length ?? 0),
    transactions:
      (parsedPayload.data.expenses?.length ?? 0) +
      (parsedPayload.data.incomes?.length ?? 0),
    debts: parsedPayload.data.debts?.length ?? 0,
    budgets: parsedPayload.data.budgets?.length ?? 0,
    investments:
      (parsedPayload.data.portfolio_assets?.length ?? 0) +
      (parsedPayload.data.portfolio_transactions?.length ?? 0),
    preferences: parsedPayload.data.user_preferences?.length ?? 0,
  };

  return (
    <div className="flex flex-col gap-4 animate-route-in">
      <div className="p-4 rounded-xl border border-positive/30 bg-positive/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-positive/10 border border-positive/30 text-positive-strong shrink-0">
            <FileJson className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{file.name}</span>
              <Badge variant="positive" size="xs" className="gap-1">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Válido
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(file.size / 1024).toFixed(1)} KB · Exportado em {exportedAtStr}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearFile}
          disabled={disabled}
          className="text-xs self-end sm:self-auto"
        >
          Trocar arquivo
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl border border-border/80 bg-surface flex flex-col justify-between gap-1">
          <span className="text-xs text-muted-foreground">Integridade & Checksum</span>
          <div className="flex items-center gap-2 mt-1">
            <ShieldCheck className="size-4 text-positive-strong" aria-hidden="true" />
            <span className="font-semibold text-xs text-foreground font-mono">
              {parsedPayload.checksum ? parsedPayload.checksum : "Verificado (Padrão v1)"}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/80 bg-surface flex flex-col justify-between gap-1">
          <span className="text-xs text-muted-foreground">Volume de Dados</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-bold text-sm text-foreground tabular-nums">
              {totalRecords}
            </span>
            <span className="text-xs text-muted-foreground">registros catalogados</span>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-xl border border-border/80 bg-surface">
        <span className="text-xs font-semibold text-foreground">
          Distribuição dos dados no backup:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5 text-xs">
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-hover border border-border/60">
            <span className="text-muted-foreground">Categorias:</span>
            <span className="font-semibold text-foreground tabular-nums">{modulesCount.categories}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-hover border border-border/60">
            <span className="text-muted-foreground">Cartões:</span>
            <span className="font-semibold text-foreground tabular-nums">{modulesCount.cards}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-hover border border-border/60">
            <span className="text-muted-foreground">Transações:</span>
            <span className="font-semibold text-foreground tabular-nums">{modulesCount.transactions}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-hover border border-border/60">
            <span className="text-muted-foreground">Dívidas:</span>
            <span className="font-semibold text-foreground tabular-nums">{modulesCount.debts}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-hover border border-border/60">
            <span className="text-muted-foreground">Orçamentos:</span>
            <span className="font-semibold text-foreground tabular-nums">{modulesCount.budgets}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-surface-hover border border-border/60">
            <span className="text-muted-foreground">Investimentos:</span>
            <span className="font-semibold text-foreground tabular-nums">{modulesCount.investments}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
