import { QrCodeCanvas } from "@/components/ui/qr-code-canvas";
import { useState } from "react";
import { Check, Copy, QrCode, Share2, ShieldAlert, UserPlus, Users } from "lucide-react";
import { Badge, Button, Input, Modal, ModalFooter } from "@/components/ui";
import { getPublicShareUrl } from "@/services/app-url";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export interface InviteTripMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripTitle: string;
  destination?: string | null;
  publicToken: string;
  isCompleted?: boolean;
  onOpenAddDirectMember?: () => void;
}

export function InviteTripMemberDialog({
  open,
  onOpenChange,
  tripTitle,
  destination,
  publicToken,
  isCompleted = false,
  onOpenAddDirectMember,
}: InviteTripMemberDialogProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  const inviteUrl = getPublicShareUrl(`viagem/${publicToken}`);

  const handleCopyLink = async () => {
    if (isCompleted) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedLink(true);
        triggerSensory("selection");
        pushToast({
          title: "Link de convite copiado!",
          description: "Envie o link para seus amigos acessarem o grupo da viagem.",
        });
        setTimeout(() => setCopiedLink(false), 3000);
      }
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível copiar automaticamente",
        description: "Selecione o link e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleShareWhatsApp = () => {
    if (isCompleted) return;
    let message = `Olá! Estou te convidando para participar do grupo da nossa viagem "${tripTitle}"`;
    if (destination) {
      message += ` para ${destination}`;
    }
    message += ` no Axir.\n\nAcesse pelo link para acompanhar os gastos coletivos, registrar comprovantes e acertar contas:\n\n${inviteUrl}`;

    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const manualAction =
    onOpenAddDirectMember && !isCompleted ? (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onOpenChange(false);
          onOpenAddDirectMember();
        }}
        className="text-xs gap-1.5"
      >
        <UserPlus className="size-3.5" aria-hidden="true" />
        <span>Adicionar Manualmente</span>
      </Button>
    ) : undefined;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Convidar para a Viagem"
      description="Compartilhe o link de colaboração ou o QR Code para seus amigos participarem da viagem."
      footer={
        <ModalFooter borderless destructiveAction={manualAction}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        {isCompleted ? (
          <div className="p-4 rounded-xl border border-warning/30 bg-warning/10 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-warning-strong">
              <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
              <span>Link de compartilhamento encerrado</span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Esta viagem já foi finalizada e suas contas estão encerradas. Novos convites e lançamentos estão desativados.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Link oficial de convite</span>
                <Badge size="xs" variant="positive" className="gap-1 font-normal">
                  <Users className="size-3" aria-hidden="true" />
                  Acesso Direto
                </Badge>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  className="text-base sm:text-sm font-mono bg-surface select-all text-foreground"
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  sensoryIntent={false}
                  onClick={handleCopyLink}
                  className="px-3 gap-1.5 shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      <span>Copiar</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="gap-1.5 justify-center"
              >
                <Share2 className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>WhatsApp</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowQrCode((prev) => !prev)}
                className="gap-1.5 justify-center"
              >
                <QrCode className="size-3.5" aria-hidden="true" />
                <span>{showQrCode ? "Ocultar QR" : "Exibir QR Code"}</span>
              </Button>
            </div>

            {showQrCode && (
              <div className="p-4 rounded-xl border border-border/80 bg-background/50 flex flex-col items-center gap-2.5 text-center transition-all">
                <QrCodeCanvas
                  text={inviteUrl}
                  size={160}
                  label="QR Code de Convite da Viagem"
                />
                <p className="text-[11px] text-muted-foreground">
                  Aponte a câmera do celular para entrar no grupo da viagem
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-surface-raised border border-border/80 text-[11px] text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground block">Como funciona o convite?</span>
              <p>
                Quem receber o link pode visualizar as despesas, lançar novos gastos coletivos e vincular sua própria conta Axir para acompanhar a viagem em tempo real.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
