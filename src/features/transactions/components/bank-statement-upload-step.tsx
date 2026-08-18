import { useState } from "react";
import { ClipboardPaste, FileSpreadsheet, Upload } from "lucide-react";
import { Button, Dropzone, Tabs, Textarea } from "@/components/ui";

interface BankStatementUploadStepProps {
  onFileSelect: (file: File) => void;
  onTextSubmit: (text: string) => void;
}

/**
 * Passo 1 do Diálogo de Importação de Extrato Bancário:
 * Permite selecionar um arquivo (.csv, .ofx, .txt) via Dropzone
 * ou colar diretamente texto em linguagem natural / extrato via Textarea.
 */
export function BankStatementUploadStep({ onFileSelect, onTextSubmit }: BankStatementUploadStepProps) {
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
            label: "Arquivo (OFX / CSV)",
            icon: <FileSpreadsheet className="size-4" aria-hidden />,
            content: (
              <div className="space-y-2 pt-2">
                <Dropzone
                  accept=".csv,.ofx,.txt"
                  maxSizeBytes={10 * 1024 * 1024}
                  onFiles={handleDrop}
                  hint="Formatos suportados: OFX bancário nativo (todos os bancos) e CSV (Nubank, Inter, Itaú, Bradesco, BB, Caixa, C6)"
                />
              </div>
            ),
          },
          {
            value: "paste",
            label: "Quick-Paste / Texto Livre",
            icon: <ClipboardPaste className="size-4" aria-hidden />,
            content: (
              <div className="space-y-3 pt-2">
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Cole aqui linhas copiadas do extrato ou escreva em linguagem natural...\nExemplos:\n15/08  Padaria Estrela  R$ 25,50\n16/08  Pix Recebido João  R$ 150,00\nOntem gastei 50 reais no mercado\n10 de maio Comprei tênis na Nike por 250,00 3x`}
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
