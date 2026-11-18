import { FileSpreadsheet, Sparkles } from "lucide-react";
import { Dropzone, Tabs, Textarea } from "@/components/ui";

const QUICK_PASTE_EXAMPLES = [
  "15/08 comprei 100 PETR4 a 38,50",
  "10/08 compra de 50 cotas de MXRF11 por 10,25",
  "PETR4, VALE3, MXRF11, AAPL (cadastrar ativos)",
];

export interface ImportUploadStepProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  rawText: string;
  onRawTextChange: (text: string) => void;
  onFileUpload: (files: File[]) => void;
}

export function ImportUploadStep({
  activeTab,
  onTabChange,
  rawText,
  onRawTextChange,
  onFileUpload,
}: ImportUploadStepProps) {
  const tabs = [
    {
      value: "text",
      label: "Linguagem Natural / Texto",
      icon: <Sparkles className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-3 pt-2">
          <Textarea
            value={rawText}
            onChange={(e) => onRawTextChange(e.target.value)}
            placeholder={`Cole seus lançamentos ou lista de ativos aqui...\nExemplos:\n- ${QUICK_PASTE_EXAMPLES.join("\n- ")}`}
            aria-label="Texto ou CSV de operações da carteira"
            className="min-h-[160px] font-mono text-base sm:text-sm"
          />
          <span className="text-[11px] text-muted-foreground">
            Dica: Você pode colar linhas com texto natural, códigos puros ou tabelas copiadas do Excel.
          </span>
        </div>
      ),
    },
    {
      value: "file",
      label: "Planilha (Excel / CSV)",
      icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-3 pt-2">
          <Dropzone
            onFiles={onFileUpload}
            accept=".xlsx,.xls,.csv,.txt,.tsv"
            label="Arraste sua planilha (.xlsx, .csv) ou clique para selecionar"
            hint="Suporta arquivos Excel (.xlsx) e CSV da B3 (Área do Investidor / CEI), Kinvo, Gorila, XP, NuInvest, Inter, BTG, Clear, Rico e Toro."
          />
        </div>
      ),
    },
  ];

  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      items={tabs}
      variant="pills"
      fullWidth={false}
    />
  );
}
