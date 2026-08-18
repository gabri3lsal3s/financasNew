import { useState } from "react";
import { ClipboardPaste, FileSpreadsheet, Upload } from "lucide-react";
import { Button, Dropzone, Tabs, Textarea } from "@/components/ui";

interface StatementUploadStepProps {
  onFileSelect: (file: File) => void;
  onTextSubmit: (text: string) => void;
}

/**
 * Passo 1 do Diálogo de Importação de Fatura:
 * Permite selecionar um arquivo (.csv, .ofx, .txt) via Dropzone
 * ou colar diretamente o texto do extrato/fatura via Textarea.
 */
export function StatementUploadStep({ onFileSelect, onTextSubmit }: StatementUploadStepProps) {
  const [tab, setTab] = useState<string>("file");
  const [pastedText, setPastedText] = useState("");

  const handleDrop = (files: File[]) => {
    const file = files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handlePasteSubmit = () => {
    if (pastedText.trim()) {
      onTextSubmit(pastedText);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: "file",
            label: "Arquivo (CSV / OFX)",
            icon: <FileSpreadsheet className="size-4" aria-hidden />,
            content: (
              <div className="space-y-2 pt-2">
                <Dropzone
                  accept=".csv,.ofx,.txt"
                  maxSizeBytes={10 * 1024 * 1024}
                  onFiles={handleDrop}
                  hint="Formatos suportados: CSV (Nubank, Inter, C6, Itaú, Bradesco) e OFX bancário nativo"
                />
              </div>
            ),
          },
          {
            value: "paste",
            label: "Colar Extrato",
            icon: <ClipboardPaste className="size-4" aria-hidden />,
            content: (
              <div className="space-y-3 pt-2">
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Cole aqui as linhas copiadas da fatura do seu banco...\nExemplo:\n15/08/2026  Padaria Estrela  R$ 25,00\n16/08/2026  Supermercado Dia  R$ 140,50`}
                  rows={7}
                  className="font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={!pastedText.trim()}
                    onClick={handlePasteSubmit}
                    className="gap-1.5"
                  >
                    <Upload className="size-4" aria-hidden />
                    Processar Texto
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
