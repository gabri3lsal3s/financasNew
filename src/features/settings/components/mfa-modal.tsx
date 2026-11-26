import { KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Alert, Button, ContentLoading, Modal, ModalFooter } from "@/components/ui";
import { MfaActiveStatusStep } from "./mfa-active-status-step";
import { MfaIntroStep } from "./mfa-intro-step";
import { MFA_SECURITY_GATE_FORM_ID, MfaPasswordGateStep } from "./mfa-password-gate-step";
import { MFA_VERIFY_FORM_ID, MfaQrEnrollStep } from "./mfa-qr-enroll-step";
import { useMfaEnrollmentFlow } from "./use-mfa-enrollment-flow";

export interface MfaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MfaModal({ open, onOpenChange }: MfaModalProps) {
  const flow = useMfaEnrollmentFlow(open, onOpenChange);

  const renderFooter = () => {
    if (flow.isLoading) return undefined;

    if (flow.activeFactor) {
      if (flow.confirmAction !== "none") {
        return (
          <ModalFooter borderless>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                flow.setConfirmAction("none");
                flow.setAuthInputValue("");
                flow.setErrorMessage(null);
              }}
              disabled={flow.isVerifyingSecurity}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              form={MFA_SECURITY_GATE_FORM_ID}
              variant={flow.confirmAction === "deactivate" ? "destructive" : "default"}
              sensoryIntent={false}
              disabled={flow.isVerifyingSecurity || !flow.authInputValue.trim()}
            >
              {flow.isVerifyingSecurity ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" aria-hidden="true" />
                  Validando...
                </>
              ) : flow.confirmAction === "deactivate" ? (
                <>
                  <Trash2 className="size-4 mr-1.5" aria-hidden="true" />
                  Confirmar Desativação
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-1.5" aria-hidden="true" />
                  Gerar Novo QR Code
                </>
              )}
            </Button>
          </ModalFooter>
        );
      }

      return (
        <ModalFooter
          borderless
          destructiveAction={
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                flow.setConfirmAction("deactivate");
                flow.setAuthInputValue("");
                flow.setErrorMessage(null);
              }}
            >
              <Trash2 className="size-4 mr-1.5" aria-hidden="true" />
              Desativar 2FA
            </Button>
          }
        >
          <Button type="button" variant="outline" onClick={() => flow.handleModalOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              flow.setConfirmAction("reconfigure");
              flow.setAuthInputValue("");
              flow.setErrorMessage(null);
            }}
          >
            <RefreshCw className="size-4 mr-1.5" aria-hidden="true" />
            Reconfigurar 2FA
          </Button>
        </ModalFooter>
      );
    }

    if (flow.isEnrolling && flow.enrollData) {
      return (
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={flow.cancelEnrollment}
            disabled={flow.isVerifying}
          >
            Voltar
          </Button>
          <Button
            type="submit"
            form={MFA_VERIFY_FORM_ID}
            variant="default"
            sensoryIntent={false}
            disabled={flow.isVerifying || flow.verificationCode.length !== 6}
          >
            {flow.isVerifying ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" aria-hidden="true" />
                Validando...
              </>
            ) : (
              <>
                <KeyRound className="size-4 mr-1.5" aria-hidden="true" />
                Ativar 2FA
              </>
            )}
          </Button>
        </ModalFooter>
      );
    }

    return (
      <ModalFooter borderless>
        <Button type="button" variant="outline" onClick={() => flow.handleModalOpenChange(false)}>
          Agora não
        </Button>
        <Button
          type="button"
          variant="default"
          sensoryIntent={false}
          disabled={flow.isEnrolling || flow.isLoading}
          onClick={flow.handleStartEnrollment}
        >
          <ShieldCheck className="size-4 mr-1.5" aria-hidden="true" />
          Configurar 2FA
        </Button>
      </ModalFooter>
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={flow.handleModalOpenChange}
      size="md"
      title="Autenticação em Duas Etapas (2FA)"
      description="Proteja seu acesso financeiro com código de validação gerado pelo seu smartphone."
      footer={renderFooter()}
    >
      <div className="space-y-4 pt-1">
        {flow.errorMessage ? (
          <Alert variant="error">
            <span className="text-xs">{flow.errorMessage}</span>
          </Alert>
        ) : null}

        {flow.isLoading ? (
          <ContentLoading />
        ) : flow.activeFactor ? (
          flow.confirmAction !== "none" ? (
            <MfaPasswordGateStep
              confirmAction={flow.confirmAction}
              authMethod={flow.authMethod}
              authInputValue={flow.authInputValue}
              isVerifyingSecurity={flow.isVerifyingSecurity}
              onSelectMethod={(method) => {
                flow.setAuthMethod(method);
                flow.setAuthInputValue("");
                flow.setErrorMessage(null);
              }}
              onAuthInputChange={(value) => {
                flow.setAuthInputValue(value);
                if (flow.errorMessage) flow.setErrorMessage(null);
              }}
              onSubmit={flow.handleExecuteConfirmedAction}
            />
          ) : (
            <MfaActiveStatusStep />
          )
        ) : flow.isEnrolling && flow.enrollData ? (
          <MfaQrEnrollStep
            enrollData={flow.enrollData}
            verificationCode={flow.verificationCode}
            copiedSecret={flow.copiedSecret}
            onVerificationCodeChange={flow.setVerificationCode}
            onCopySecret={flow.handleCopySecret}
            onSubmit={flow.handleVerifyEnrollment}
          />
        ) : (
          <MfaIntroStep />
        )}
      </div>
    </Modal>
  );
}
