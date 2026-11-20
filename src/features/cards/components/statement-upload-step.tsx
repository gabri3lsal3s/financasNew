import { Dropzone } from "@/components/ui";

export const STATEMENT_FILE_ACCEPT =
  ".pdf,.csv,.ofx,.txt,.tsv,application/pdf,text/csv,text/plain,text/comma-separated-values,text/tab-separated-values,application/csv,application/vnd.ms-excel,application/x-ofx,application/ofx,text/ofx,application/octet-stream,*/*";

export interface StatementUploadStepProps {
  onFileSelect: (file: File) => void;
}

/**
 * Passo 1 do Diálogo de Importação de Fatura:
 * Permite selecionar um arquivo (.csv, .ofx, .pdf) via Dropzone oficial.
 */
export function StatementUploadStep({ onFileSelect }: StatementUploadStepProps) {
  const handleDrop = (files: File[]) => {
    const file = files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <Dropzone
        accept={STATEMENT_FILE_ACCEPT}
        maxSizeBytes={10 * 1024 * 1024}
        onFiles={handleDrop}
        label="Selecione o arquivo da fatura (CSV, OFX ou PDF)"
        hint="Formatos suportados: CSV (Nubank, Inter, C6, Itaú, Bradesco), OFX e Fatura em PDF"
      />
    </div>
  );
}
