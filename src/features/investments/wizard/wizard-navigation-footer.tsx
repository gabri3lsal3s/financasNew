import { Button, ModalFooter } from "@/components/ui";

export interface WizardNavigationFooterProps {
  canGoBack: boolean;
  isLastStep: boolean;
  canAdvance: boolean;
  isPending: boolean;
  isSubmitting: boolean;
  continueLabel: string;
  onBack: () => void;
  onCancel: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function WizardNavigationFooter({
  canGoBack,
  isLastStep,
  canAdvance,
  isPending,
  isSubmitting,
  continueLabel,
  onBack,
  onCancel,
  onNext,
  onSubmit,
}: WizardNavigationFooterProps) {
  const primaryButton = isLastStep ? (
    <Button
      type="button"
      size="sm"
      onClick={onSubmit}
      disabled={!canAdvance || isPending || isSubmitting}
    >
      {isPending || isSubmitting ? "Gravando..." : "Confirmar Operação"}
    </Button>
  ) : (
    <Button
      type="button"
      size="sm"
      onClick={onNext}
      disabled={!canAdvance || isPending}
    >
      {continueLabel}
    </Button>
  );

  if (canGoBack) {
    return (
      <ModalFooter
        borderless
        destructiveAction={
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
        }
      >
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={isPending}>
          Voltar
        </Button>
        {primaryButton}
      </ModalFooter>
    );
  }

  return (
    <ModalFooter borderless>
      <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
        Cancelar
      </Button>
      {primaryButton}
    </ModalFooter>
  );
}
