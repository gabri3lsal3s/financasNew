/**
 * Modal de convite para a viagem (InviteTripMemberDialog).
 * Permite ao organizador copiar link, compartilhar no WhatsApp,
 * exibir QR Code ou cadastrar amigo manualmente (assim como no convite familiar).
 */

import { useState } from "react";
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  QrCodeCanvas,
  Badge,
} from "@/components/ui";
import {
  Copy,
  Check,
  Share2,
  QrCode,
  UserPlus,
  Users,
  ShieldAlert,
} from "lucide-react";
import { getPublicAppUrl } from "@/services/app-url";
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

  const inviteUrl = getPublicAppUrl(`viagem/${publicToken}`);

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
      pushToast({
        title: "Não foi possível copiar automaticamente",
        description: "Selecione o link e copie manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleShareWhatsApp = () => {
    if (isCompleted) return;
    let message = `Ola! Estou te convidando para participar do grupo da nossa viagem "${tripTitle}"`;
    if (destination) {
      message += ` para ${destination}`;
    }
    message += ` no Axis Finance.\n\nAcesse pelo link para acompanhar os gastos coletivos, registrar comprovantes e acertar contas:\n${inviteUrl}`;

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Convidar para a Viagem"
      description="Compartilhe o link de colaboração ou o QR Code para seus amigos participarem da viagem."
      footer={
        <ModalFooter>
          {onOpenAddDirectMember && !isCompleted && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onOpenAddDirectMember();
              }}
              className="mr-auto text-xs gap-1.5"
            >
              <UserPlus className="size-3.5" aria-hidden="true" />
              Adicionar Manualmente
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
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
              Esta viagem ja foi finalizada e suas contas estao encerradas. Novos convites e lancamentos estao desativados.
            </p>
          </div>
        ) : (
          <>
            {/* Bloco de Link de Convite */}
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
                  className="h-9 text-xs font-mono bg-surface rounded-lg select-all text-foreground"
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-9 px-3 gap-1.5 shrink-0 cursor-pointer"
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

            {/* Ações Rápidas de Compartilhamento */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="h-9 text-xs gap-1.5 justify-center cursor-pointer"
              >
                <Share2 className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>WhatsApp</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowQrCode((prev) => !prev)}
                className="h-9 text-xs gap-1.5 justify-center cursor-pointer"
              >
                <QrCode className="size-3.5" aria-hidden="true" />
                <span>{showQrCode ? "Ocultar QR" : "Exibir QR Code"}</span>
              </Button>
            </div>

            {/* Bloco de QR Code */}
            {showQrCode && (
              <div className="p-4 rounded-xl border border-border/80 bg-background/50 flex flex-col items-center gap-2.5 text-center transition-all">
                <QrCodeCanvas
                  text={inviteUrl}
                  size={160}
                  label="QR Code de Convite da Viagem"
                />
                <p className="text-[11px] text-muted-foreground">
                  Aponte a camera do celular para entrar no grupo da viagem
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-surface-raised border border-border/80 text-[11px] text-muted-foreground space-y-1">
              <span className="font-semibold text-foreground block">
                Como funciona o convite?
              </span>
              <p>
                Quem receber o link pode visualizar as despesas, lancar novos gastos coletivos e vincular sua propria conta Axis Finance para acompanhar a viagem em tempo real.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
