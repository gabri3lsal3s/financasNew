import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { ImportPreviewTableStep } from "./import-dialog/import-preview-table-step";
import { ImportUploadStep } from "./import-dialog/import-upload-step";
import { usePortfolioCsvImport } from "./import-dialog/use-portfolio-csv-import";
import { PortfolioMappingStep } from "./portfolio-mapping-step";

export interface PortfolioImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PortfolioImportDialog({ open, onOpenChange }: PortfolioImportDialogProps) {
  const {
    step,
    setStep,
    activeTab,
    setActiveTab,
    rawText,
    setRawText,
    rawRows,
    columnMapping,
    parsedRows,
    selectedIndices,
    editingIndex,
    setEditingIndex,
    isProcessing,
    existingTickerMap,
    handleClose,
    handleProcessInput,
    handleFileUpload,
    handleConfirmMapping,
    toggleSelectAll,
    toggleIndex,
    updateParsedRow,
    removeParsedRow,
    addNewRow,
    handleConfirmImport,
  } = usePortfolioCsvImport(onOpenChange);

  const description =
    step === 1
      ? "Cadastre ativos e operações via texto em linguagem natural ou relatórios de corretoras e B3."
      : step === 2
        ? "Verifique o tipo de planilha (Posição Atual ou Movimentações) e ajuste as colunas identificadas."
        : "Confira e edite os valores identificados antes de gravar na sua carteira.";

  const footer =
    step === 1 ? (
      <ModalFooter borderless>
        <Button type="button" variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
        {activeTab === "text" ? (
          <Button
            type="button"
            onClick={() => handleProcessInput(rawText)}
            disabled={!rawText.trim()}
            className="gap-1.5"
          >
            Processar texto
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
      </ModalFooter>
    ) : step === 3 ? (
      <ModalFooter borderless className="sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setStep(rawRows.length > 0 ? 2 : 1)}
          className="gap-1.5"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Voltar
        </Button>
        <Button
          type="button"
          size="sm"
          loading={isProcessing}
          onClick={() => void handleConfirmImport()}
          disabled={selectedIndices.size === 0 || isProcessing}
          sensoryIntent={false}
          className="gap-1.5"
        >
          <Check aria-hidden="true" className="size-3.5" />
          {`Confirmar importação (${selectedIndices.size})`}
        </Button>
      </ModalFooter>
    ) : undefined;

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Importar Carteira de Investimentos"
      description={description}
      size="2xl"
      showCalculator={step === 3 && editingIndex !== null}
      footer={footer}
    >
      {step === 1 ? (
        <ImportUploadStep
          activeTab={activeTab}
          onTabChange={setActiveTab}
          rawText={rawText}
          onRawTextChange={setRawText}
          onFileUpload={handleFileUpload}
        />
      ) : null}

      {step === 2 && columnMapping ? (
        <PortfolioMappingStep
          rows={rawRows}
          initialMapping={columnMapping}
          onConfirmMapping={handleConfirmMapping}
          onBack={() => setStep(1)}
        />
      ) : null}

      {step === 3 ? (
        <ImportPreviewTableStep
          parsedRows={parsedRows}
          selectedIndices={selectedIndices}
          editingIndex={editingIndex}
          isPositionMode={columnMapping?.mode === "positions"}
          hasMappingBack={rawRows.length > 0 && Boolean(columnMapping)}
          existingTickerMap={existingTickerMap}
          onToggleSelectAll={toggleSelectAll}
          onToggleIndex={toggleIndex}
          onStartEdit={setEditingIndex}
          onDoneEdit={() => setEditingIndex(null)}
          onUpdateRow={updateParsedRow}
          onRemoveRow={removeParsedRow}
          onAddNewRow={addNewRow}
          onAdjustColumns={() => setStep(2)}
        />
      ) : null}
    </Modal>
  );
}
