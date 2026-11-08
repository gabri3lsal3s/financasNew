import { Modal, ModalFooter, Button } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { RemindersPreferencesForm } from "./reminders-preferences-form";

export interface RemindersSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal de Ajustes Rápidos de Lembretes & Notificações.
 * Permite configurar antecedência e lembretes in-loco na tela de Lembretes.
 */
export function RemindersSettingsModal({
  open,
  onOpenChange,
}: RemindersSettingsModalProps) {
  const handleClose = () => {
    triggerSensory("action");
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Configurações de Lembretes"
      description="Personalize a antecedência das contas e os alertas do dispositivo."
      size="md"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleClose}
            className="w-full sm:w-auto font-medium"
          >
            Concluir
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4 pt-1">
        <RemindersPreferencesForm isInsideModal />
      </div>
    </Modal>
  );
}
