import { Database, Download, RefreshCcw, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dropzone } from "@/components/ui/dropzone";
import type { RestoreSummary } from "@/domain/export";

export type RestoreStep =
  | { step: "idle" }
  | { step: "validating" }
  | { step: "preview"; file: File; summary: RestoreSummary }
  | { step: "restoring"; file: File; summary: RestoreSummary }
  | { step: "done"; summary: RestoreSummary }
  | { step: "error"; message: string };

export interface JsonBackupCardProps {
  exportingJson: boolean;
  busy: boolean;
  jsonError: string | null;
  restore: RestoreStep;
  onExportJsonClick: () => void;
  onFiles: (files: File[]) => void;
  onResetRestore: () => void;
  onOpenRestoreWizard?: () => void;
}

/** Card de Backup JSON completo e restauração (Dropzone / Assistente). */
export function JsonBackupCard({
  exportingJson,
  busy,
  jsonError,
  restore,
  onExportJsonClick,
  onFiles,
  onResetRestore,
  onOpenRestoreWizard,
}: JsonBackupCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Backup &amp; Exportação</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-surface-raised gap-3">
          <div>
            <div className="font-semibold text-sm text-foreground">Exportar dados completos (JSON)</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Baixe uma cópia estruturada e versionada de todos os seus dados: transações, cartões, dívidas, orçamentos e carteira.
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={exportingJson}
            disabled={busy && !exportingJson}
            onClick={onExportJsonClick}
            className="gap-2 shrink-0"
          >
            <Download className="size-4" aria-hidden="true" />
            <span>Exportar JSON</span>
          </Button>
        </div>

        {jsonError && <Alert variant="error">{jsonError}</Alert>}

        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-surface-raised">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-sm text-foreground">Restaurar backup</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Substitui todos os dados atuais pelo conteúdo do arquivo ou utilize o assistente com desduplicação.
              </div>
            </div>
            {onOpenRestoreWizard && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenRestoreWizard}
                className="gap-1.5 text-xs font-medium shrink-0 self-end sm:self-auto"
              >
                <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Restaurar com Assistente</span>
              </Button>
            )}
          </div>

          {restore.step === "idle" || restore.step === "validating" ? (
            <Dropzone
              onFiles={onFiles}
              accept="application/json,.json"
              label="Arraste o arquivo .json aqui ou clique para selecionar"
              hint="Arquivo gerado em Exportar JSON (formato versionado)."
              disabled={busy}
            />
          ) : null}

          {restore.step === "validating" ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <RefreshCcw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Validando integridade do backup...
            </p>
          ) : null}

          {restore.step === "done" ? (
            <Alert variant="success">Backup restaurado com sucesso — os dados foram atualizados.</Alert>
          ) : null}

          {restore.step === "error" ? (
            <Alert variant="error">
              <div className="flex w-full items-start justify-between gap-3">
                <span className="whitespace-pre-line">{restore.message}</span>
                <Button type="button" size="sm" variant="outline" onClick={onResetRestore}>
                  Descartar
                </Button>
              </div>
            </Alert>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
