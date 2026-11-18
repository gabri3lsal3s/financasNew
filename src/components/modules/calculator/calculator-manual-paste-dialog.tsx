import { Button, FormField, Input, Modal, ModalFooter } from "@/components/ui";

export interface CalculatorManualPasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  onApply: () => void;
}

/** Fallback manual de colagem quando a permissão de área de transferência é bloqueada. */
export function CalculatorManualPasteDialog({
  open,
  onOpenChange,
  value,
  onValueChange,
  onApply,
}: CalculatorManualPasteDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      elevated
      title="Colar Valor Manualmente"
      description="Cole o valor ou texto financeiro no campo abaixo para inseri-lo na calculadora."
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onApply}
          >
            Aplicar Valor
          </Button>
        </ModalFooter>
      }
    >
      <div className="py-2">
        <FormField label="Valor ou texto financeiro" htmlFor="calculator-manual-paste-input">
          <Input
            id="calculator-manual-paste-input"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="Ex.: R$ 1.250,50 ou 1250.50"
            className="text-base sm:text-sm font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApply();
              }
            }}
          />
        </FormField>
      </div>
    </Modal>
  );
}
