import { Dropzone } from "@/components/ui";

export interface ImportUploadStepProps {
  onFileUpload: (files: File[]) => void;
}

/**
 * Passo 1 do Diálogo de Importação de Carteira:
 * Permite selecionar a planilha oficial da B3 (Área do Investidor) ou corretoras (.xlsx, .csv).
 */
export function ImportUploadStep({ onFileUpload }: ImportUploadStepProps) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      <Dropzone
        onFiles={onFileUpload}
        accept=".xlsx,.xls,.csv,.tsv"
        label="Selecione sua planilha de custódia ou movimentações (.xlsx, .csv)"
        hint="Suporta arquivos Excel (.xlsx) e CSV da B3 (Área do Investidor / CEI), Kinvo, Gorila, XP, NuInvest, Inter, BTG, Clear, Rico e Toro."
      />
    </div>
  );
}
