import { useState, useEffect, useCallback } from "react";
import type { FormEvent } from "react";
import {
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  Smartphone,
  KeyRound,
  Trash2,
  RefreshCw,
  Lock,
} from "lucide-react";
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  Badge,
  Alert,
} from "@/components/ui";
import {
  enrollMfaTotp,
  listVerifiedMfaFactors,
  unenrollMfaFactor,
  verifyMfaEnrollment,
  verifyMfaTotpCode,
  verifyCurrentPassword,
} from "@/hooks/use-auth";
import { renderQrCodeSvg } from "@/domain/pix/qr-code";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";

export interface MfaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MfaFactor {
  id: string;
  status: "verified" | "unverified";
  friendly_name?: string;
  factor_type: string;
}

export function MfaModal({ open, onOpenChange }: MfaModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [activeFactor, setActiveFactor] = useState<MfaFactor | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    secret: string;
    qrSvg: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Estados de confirmação de segurança (Desativação e Reconfiguração)
  const [confirmAction, setConfirmAction] = useState<"none" | "deactivate" | "reconfigure">("none");
  const [authMethod, setAuthMethod] = useState<"totp" | "password">("totp");
  const [authInputValue, setAuthInputValue] = useState("");
  const [isVerifyingSecurity, setIsVerifyingSecurity] = useState(false);

  const refreshFactors = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const verified = await listVerifiedMfaFactors();
      setActiveFactor(verified ? {
        id: verified.id,
        status: verified.status as "verified" | "unverified",
        friendly_name: verified.friendly_name,
        factor_type: verified.factor_type,
      } : null);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    async function loadFactors() {
      try {
        const verified = await listVerifiedMfaFactors();
        if (!isCancelled) {
          setActiveFactor(verified ? {
            id: verified.id,
            status: verified.status as "verified" | "unverified",
            friendly_name: verified.friendly_name,
            factor_type: verified.factor_type,
          } : null);
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMessage(getErrorMessage(err));
          setIsLoading(false);
        }
      }
    }

    void loadFactors();

    return () => {
      isCancelled = true;
    };
  }, [open]);

  const handleModalOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setIsEnrolling(false);
      setEnrollData(null);
      setVerificationCode("");
      setErrorMessage(null);
      setConfirmAction("none");
      setAuthInputValue("");
      setIsVerifyingSecurity(false);
    }
  };

  const handleStartEnrollment = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await enrollMfaTotp("Axir");
      const qrSvg = renderQrCodeSvg(data.totpUri, {
        ecc: "M",
        border: 2,
        blackColor: "#09090b",
        whiteColor: "#ffffff",
      });

      setEnrollData({
        factorId: data.factorId,
        secret: data.secret,
        qrSvg,
      });
      setIsEnrolling(true);
      triggerSensory("action");
    } catch (err) {
      triggerSensory("destructive");
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEnrollment = async (e: FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;
    const cleanCode = verificationCode.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setErrorMessage("O código de verificação deve conter exatamente 6 dígitos.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      await verifyMfaEnrollment(enrollData.factorId, cleanCode);

      triggerSensory("success");
      pushToast({
        title: "2FA Ativado com Sucesso",
        description: "Sua conta agora está protegida por aplicativo autenticador.",
        variant: "success",
      });
      await refreshFactors();
      setIsEnrolling(false);
      setEnrollData(null);
    } catch (err) {
      triggerSensory("destructive");
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleExecuteConfirmedAction = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeFactor || isVerifyingSecurity) return;
    setIsVerifyingSecurity(true);
    setErrorMessage(null);

    try {
      if (authMethod === "totp") {
        const cleanCode = authInputValue.trim();
        if (cleanCode.length !== 6) {
          setErrorMessage("Informe o código de 6 dígitos gerado pelo aplicativo autenticador.");
          setIsVerifyingSecurity(false);
          return;
        }

        const isValidMfa = await verifyMfaTotpCode(activeFactor.id, cleanCode);
        if (!isValidMfa) {
          setErrorMessage("Código de autenticação incorreto ou expirado. Tente novamente.");
          setIsVerifyingSecurity(false);
          return;
        }
      } else {
        if (!authInputValue) {
          setErrorMessage("Informe sua senha de acesso para autorizar.");
          setIsVerifyingSecurity(false);
          return;
        }

        const isValidPassword = await verifyCurrentPassword(authInputValue);
        if (!isValidPassword) {
          setErrorMessage("Senha incorreta. Não foi possível autorizar a operação.");
          setIsVerifyingSecurity(false);
          return;
        }
      }

      await unenrollMfaFactor(activeFactor.id);

      if (confirmAction === "deactivate") {
        triggerSensory("selection");
        pushToast({
          title: "2FA Desativado",
          description: "A verificação em duas etapas foi desativada com sucesso.",
          variant: "success",
        });
        setActiveFactor(null);
        setConfirmAction("none");
        setAuthInputValue("");
      } else if (confirmAction === "reconfigure") {
        triggerSensory("action");
        setActiveFactor(null);
        setConfirmAction("none");
        setAuthInputValue("");
        await handleStartEnrollment();
      }
    } catch (err) {
      triggerSensory("destructive");
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsVerifyingSecurity(false);
    }
  };

  const handleCopySecret = async () => {
    if (!enrollData?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopiedSecret(true);
      triggerSensory("action");
      setTimeout(() => setCopiedSecret(false), 2500);
    } catch {
      // Ignora falha de clipboard
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleModalOpenChange}
      size="md"
      title="Autenticação em Duas Etapas (2FA)"
      description="Proteja seu acesso financeiro com código de validação gerado pelo seu smartphone."
    >
      <div className="space-y-4 pt-1">
        {errorMessage && (
          <Alert variant="error">
            <span className="text-xs">{errorMessage}</span>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Carregando status de segurança...</span>
          </div>
        ) : activeFactor ? (
          confirmAction !== "none" ? (
            /* Confirmação de Segurança para Desativar ou Reconfigurar */
            <form onSubmit={handleExecuteConfirmedAction} className="space-y-4">
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3.5 space-y-1">
                <span className="text-xs font-semibold text-warning-strong flex items-center gap-1.5">
                  <Lock className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {confirmAction === "deactivate"
                      ? "Confirmar Desativação do 2FA"
                      : "Confirmar Reconfiguração do 2FA"}
                  </span>
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {confirmAction === "deactivate"
                    ? "Para sua segurança, valide sua identidade com o código de 6 dígitos gerado no app ou sua senha atual para desativar o 2FA."
                    : "Para gerar um novo QR Code e vincular outro aplicativo autenticador, confirme sua identidade."}
                </p>
              </div>

              {/* Seletor de método de validação */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={authMethod === "totp" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setAuthMethod("totp");
                    setAuthInputValue("");
                    setErrorMessage(null);
                  }}
                >
                  <Smartphone className="size-3.5 mr-1" aria-hidden="true" />
                  Código do App
                </Button>
                <Button
                  type="button"
                  variant={authMethod === "password" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setAuthMethod("password");
                    setAuthInputValue("");
                    setErrorMessage(null);
                  }}
                >
                  <KeyRound className="size-3.5 mr-1" aria-hidden="true" />
                  Senha de Acesso
                </Button>
              </div>

              {authMethod === "totp" ? (
                <div className="space-y-1.5">
                  <label htmlFor="mfa-security-code" className="text-xs font-semibold text-foreground block">
                    Código de 6 dígitos do aplicativo
                  </label>
                  <Input
                    id="mfa-security-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={authInputValue}
                    onChange={(e) => {
                      setAuthInputValue(e.target.value.replace(/\D/g, "").slice(0, 6));
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isVerifyingSecurity}
                    className="text-center font-mono tracking-widest text-base sm:text-sm h-10"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Abra seu Google Authenticator, Authy ou 1Password e digite o código atual.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor="mfa-security-password" className="text-xs font-semibold text-foreground block">
                    Sua senha atual
                  </label>
                  <Input
                    id="mfa-security-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Digite sua senha de acesso"
                    value={authInputValue}
                    onChange={(e) => {
                      setAuthInputValue(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isVerifyingSecurity}
                    className="text-base sm:text-sm h-10"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Digite a senha que você usa para entrar na sua conta.
                  </span>
                </div>
              )}

              <ModalFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setConfirmAction("none");
                    setAuthInputValue("");
                    setErrorMessage(null);
                  }}
                  disabled={isVerifyingSecurity}
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  variant={confirmAction === "deactivate" ? "destructive" : "default"}
                  disabled={isVerifyingSecurity || !authInputValue.trim()}
                >
                  {isVerifyingSecurity ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" aria-hidden="true" />
                      Validando...
                    </>
                  ) : confirmAction === "deactivate" ? (
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
            </form>
          ) : (
            /* Estado Ativo: Opções de Reconfigurar e Desativar */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-surface/50">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-positive/20 bg-positive/10 text-positive-strong">
                    <Smartphone className="size-4.5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">App Autenticador</span>
                      <Badge variant="positive" size="xs">Ativo</Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Google Authenticator, Microsoft Authenticator, 1Password ou Authy
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Sua conta está configurada com proteção bancária de dois fatores. Ao fazer login, será solicitado um código temporário de 6 dígitos gerado pelo seu aplicativo autenticador.
              </p>

              <ModalFooter>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Fechar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmAction("reconfigure");
                    setAuthInputValue("");
                    setErrorMessage(null);
                  }}
                >
                  <RefreshCw className="size-4 mr-1.5" aria-hidden="true" />
                  Reconfigurar 2FA
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirmAction("deactivate");
                    setAuthInputValue("");
                    setErrorMessage(null);
                  }}
                >
                  <Trash2 className="size-4 mr-1.5" aria-hidden="true" />
                  Desativar 2FA
                </Button>
              </ModalFooter>
            </div>
          )
        ) : isEnrolling && enrollData ? (
          /* Estado de Configuração: Exibir QR Code e Campo de Código */
          <form onSubmit={handleVerifyEnrollment} className="space-y-4">
            <div className="space-y-2 text-center">
              <span className="text-xs font-semibold text-foreground">
                1. Escaneie o QR Code no seu aplicativo autenticador:
              </span>
              <div className="flex justify-center p-3 bg-white rounded-xl border border-border/80 shadow-xs max-w-fit mx-auto">
                <div
                  className="size-44 [&_svg]:size-full"
                  dangerouslySetInnerHTML={{ __html: enrollData.qrSvg }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-muted-foreground block text-center">
                Ou insira a chave secreta manualmente se não puder ler o código:
              </span>
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-border/80 text-xs font-mono">
                <span className="truncate select-all text-muted-foreground">{enrollData.secret}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 shrink-0 text-xs"
                  onClick={handleCopySecret}
                >
                  {copiedSecret ? (
                    <>
                      <Check className="size-3.5 text-positive-strong mr-1" aria-hidden="true" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5 mr-1" aria-hidden="true" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label htmlFor="mfa-code-input" className="text-xs font-semibold text-foreground block">
                2. Digite o código de 6 dígitos gerado no app:
              </label>
              <Input
                id="mfa-code-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-widest font-mono text-base sm:text-sm"
              />
            </div>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEnrolling(false);
                  setEnrollData(null);
                }}
                disabled={isVerifying}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isVerifying || verificationCode.length !== 6}
              >
                {isVerifying ? (
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
          </form>
        ) : (
          /* Estado Não Configurado: Apresentação e Botão de Ativação */
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-surface/50">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary-strong">
                <Smartphone className="size-4.5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground block">
                  Camada extra contra invasões
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Mesmo que sua senha seja descoberta, ninguém poderá acessar seus dados financeiros sem o código de segurança gerado no seu celular.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground block">Aplicativos compatíveis:</span>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                <li>Google Authenticator (Android e iOS)</li>
                <li>Microsoft Authenticator</li>
                <li>1Password / Bitwarden</li>
                <li>Authy</li>
              </ul>
            </div>

            <ModalFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Agora não
              </Button>
              <Button
                variant="default"
                onClick={handleStartEnrollment}
              >
                <ShieldCheck className="size-4 mr-1.5" aria-hidden="true" />
                Configurar 2FA
              </Button>
            </ModalFooter>
          </div>
        )}
      </div>
    </Modal>
  );
}
