import { useState } from "react";
import { Check, Copy, KeyRound, LogOut, MessageCircle, ShieldAlert, ShieldOff } from "lucide-react";
import { Alert, Button, ConfirmDialog, Input } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useAdminGenerateRecoveryLink, useAdminResetMFA, useAdminRevokeSessions, useAdminUserContact } from "@/state";
import type { AdminUserRow } from "@/types";

export interface UserSuperadminSupportActionsProps {
  user: AdminUserRow;
  revealContact: boolean;
}

/** Ferramentas especiais de suporte do Superadmin (Reset 2FA, Sessões e Link de Recuperação). */
export function UserSuperadminSupportActions({ user, revealContact }: UserSuperadminSupportActionsProps) {
  const resetMfaMutation = useAdminResetMFA();
  const revokeSessionsMutation = useAdminRevokeSessions();
  const generateRecoveryMutation = useAdminGenerateRecoveryLink();
  const contactQuery = useAdminUserContact(user.id, revealContact);

  const [isResetMfaOpen, setIsResetMfaOpen] = useState(false);
  const [isRevokeSessionsOpen, setIsRevokeSessionsOpen] = useState(false);
  const [generatedRecoveryLink, setGeneratedRecoveryLink] = useState<string | null>(null);
  const [hasCopiedRecoveryLink, setHasCopiedRecoveryLink] = useState(false);
  const userDisplay = user.name || user.email;

  const handleGenerateRecoveryLink = async () => {
    if (!user.email) {
      pushToast({ title: "E-mail indisponível", description: "Este usuário não possui e-mail cadastrado para enviar recuperação.", variant: "destructive" });
      return;
    }
    try {
      await generateRecoveryMutation.mutateAsync({ userId: user.id, email: user.email });
      setGeneratedRecoveryLink(null);
      triggerSensory("success");
      pushToast({ title: "Recuperação enviada", description: "E-mail de recuperação despachado para o endereço verificado do usuário." });
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleCopyLink = async () => {
    if (!generatedRecoveryLink) return;
    await navigator.clipboard.writeText(generatedRecoveryLink);
    setHasCopiedRecoveryLink(true);
    pushToast({ title: "Link copiado!", description: "Link seguro de acesso copiado para a área de transferência." });
    setTimeout(() => setHasCopiedRecoveryLink(false), 3000);
  };

  const handleSendWhatsApp = () => {
    if (!generatedRecoveryLink) return;
    const cleanPhone = (contactQuery.data?.phone || "").replace(/\D/g, "");
    const text = encodeURIComponent(
      `Olá ${user.name || ""}! Segue o seu link seguro de acesso ao aplicativo Axir:\n${generatedRecoveryLink}\n\nAbra o link para acessar e redefinir sua senha.`,
    );
    window.open(cleanPhone ? `https://wa.me/55${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border/80 bg-surface text-xs shadow-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <ShieldAlert className="size-4 text-warning-strong" aria-hidden="true" />
          <span>Ações de Suporte do Superadmin</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Ferramentas de resolução rápida de chamados, suporte a 2FA (Incidente 4) e mitigação de segurança.
        </p>

        {generatedRecoveryLink && (
          <Alert variant="info" className="border-primary/30 bg-primary/5 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-primary-strong">Link de Acesso Direto Gerado:</span>
              <Button type="button" variant="ghost" size="xs" onClick={() => setGeneratedRecoveryLink(null)} className="h-6 px-2">Ocultar</Button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Input readOnly value={generatedRecoveryLink} aria-label="Link seguro de recuperação" className="text-base sm:text-sm font-mono h-9 bg-surface selection:bg-primary/20" />
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" variant="outline" size="sm" sensoryIntent="selection" className="shrink-0" onClick={handleCopyLink}>
                  {hasCopiedRecoveryLink ? <Check className="text-positive-strong" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  <span>{hasCopiedRecoveryLink ? "Copiado" : "Copiar"}</span>
                </Button>
                <Button type="button" variant="positive" size="sm" className="shrink-0" onClick={handleSendWhatsApp}>
                  <MessageCircle aria-hidden="true" />
                  <span>WhatsApp</span>
                </Button>
              </div>
            </div>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsResetMfaOpen(true)} disabled={resetMfaMutation.isPending} className="justify-start">
            <ShieldOff className="text-warning-strong" aria-hidden="true" />
            <span>Resetar 2FA</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsRevokeSessionsOpen(true)} disabled={revokeSessionsMutation.isPending} className="justify-start">
            <LogOut className="text-warning-strong" aria-hidden="true" />
            <span>Derrubar Sessões</span>
          </Button>
          <Button type="button" variant="outline" size="sm" sensoryIntent={false} onClick={handleGenerateRecoveryLink} disabled={generateRecoveryMutation.isPending} className="justify-start">
            <KeyRound className="text-primary-strong" aria-hidden="true" />
            <span>{generateRecoveryMutation.isPending ? "Gerando..." : "Link Recuperação"}</span>
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={isResetMfaOpen}
        onOpenChange={setIsResetMfaOpen}
        title="Resetar Autenticação em Duas Etapas (2FA)"
        description={`Deseja remover todos os fatores TOTP configurados para ${userDisplay}? O usuário poderá acessar a conta sem 2FA e reconfigurar um novo autenticador no perfil. Esta ação é auditada.`}
        confirmLabel={resetMfaMutation.isPending ? "Resetando..." : "Resetar 2FA"}
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={resetMfaMutation.isPending}
        elevated
        onConfirm={async () => {
          try {
            await resetMfaMutation.mutateAsync(user.id);
            pushToast({ title: "2FA Resetado com sucesso", description: `Fatores de segundo fator de ${userDisplay} foram removidos.` });
            setIsResetMfaOpen(false);
          } catch {
            triggerSensory("destructive");
          }
        }}
      />

      <ConfirmDialog
        open={isRevokeSessionsOpen}
        onOpenChange={setIsRevokeSessionsOpen}
        title="Encerrar Sessões Ativas (Derrubar Login)"
        description={`Tem certeza que deseja revogar todas as sessões ativas de ${userDisplay}? O usuário será desconectado imediatamente em todos os navegadores e dispositivos móveis (APK).`}
        confirmLabel={revokeSessionsMutation.isPending ? "Derrubando..." : "Encerrar Sessões"}
        cancelLabel="Cancelar"
        variant="destructive"
        confirmPending={revokeSessionsMutation.isPending}
        elevated
        onConfirm={async () => {
          try {
            await revokeSessionsMutation.mutateAsync(user.id);
            pushToast({ title: "Sessões revogadas", description: `Todos os acessos ativos de ${userDisplay} foram desconectados.` });
            setIsRevokeSessionsOpen(false);
          } catch {
            triggerSensory("destructive");
          }
        }}
      />
    </>
  );
}
