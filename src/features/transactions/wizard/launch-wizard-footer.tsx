import { Button, ModalFooter, ResponsiveLabel } from "@/components/ui";
import { canProceed, WIZARD_STEPS } from "./wizard-state";
import type { LaunchState, WizardMode } from "./wizard-types";

export interface LaunchWizardFooterProps {
  mode: WizardMode;
  state: LaunchState;
  pending: boolean;
  canSubmitQuick: boolean;
  onRequestClose: () => void;
  onGoToStep: (step: number) => void;
  onSubmit: () => void;
}

export function LaunchWizardFooter({
  mode,
  state,
  pending,
  canSubmitQuick,
  onRequestClose,
  onGoToStep,
  onSubmit,
}: LaunchWizardFooterProps) {
  const isLastStep = state.step === WIZARD_STEPS.length;

  if (mode === "quick") {
    return (
      <ModalFooter borderless>
        <Button type="button" variant="outline" disabled={pending} onClick={onRequestClose}>
          Cancelar
        </Button>
        <Button type="button" sensoryIntent={false} disabled={!canSubmitQuick || pending} onClick={onSubmit}>
          {pending ? "Salvando…" : <ResponsiveLabel short="Salvar" full="Salvar Transação" />}
        </Button>
      </ModalFooter>
    );
  }

  return (
    <ModalFooter borderless>
      <Button
        type="button"
        variant="outline"
        sensoryIntent="selection"
        disabled={state.step === 1 || pending}
        onClick={() => onGoToStep(state.step - 1)}
      >
        Voltar
      </Button>
      {isLastStep ? (
        <Button type="button" sensoryIntent={false} disabled={!canProceed(state) || pending} onClick={onSubmit}>
          {pending ? "Confirmando…" : <ResponsiveLabel short="Confirmar" full="Confirmar lançamento" />}
        </Button>
      ) : (
        <Button
          type="button"
          sensoryIntent="selection"
          disabled={!canProceed(state)}
          onClick={() => onGoToStep(state.step + 1)}
        >
          Continuar
        </Button>
      )}
    </ModalFooter>
  );
}
