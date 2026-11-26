import { QrCodeCanvas } from "@/components/ui/qr-code-canvas";
import type { FormEvent } from "react";
import { Copy, LogOut, QrCode, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import type { FamilyInvite, FamilyMember, FamilyMemberWithProfile } from "@/types";
import { FamilyPendingInvitesList } from "./family-pending-invites-list";

export interface FamilyMembersInvitesTabProps {
  isOwner: boolean;
  members: FamilyMemberWithProfile[];
  currentUserId?: string;
  pendingInvites: FamilyInvite[];
  inviteEmail: string;
  onInviteEmailChange: (val: string) => void;
  generatedInviteUrl: string | null;
  showQrCode: boolean;
  onToggleQrCode: () => void;
  copiedToken: string | null;
  invitePending: boolean;
  revokePending: boolean;
  onSendInvite: (e: FormEvent) => void;
  onCopyLink: (url: string, token: string) => void;
  onRequestRemoveMember: (member: FamilyMember) => void;
  onRequestRevokeInvite: (invite: FamilyInvite) => void;
  onRequestDeleteFamily: () => void;
  onRequestLeaveFamily: () => void;
}

export function FamilyMembersInvitesTab({
  isOwner,
  members,
  currentUserId,
  pendingInvites,
  inviteEmail,
  onInviteEmailChange,
  generatedInviteUrl,
  showQrCode,
  onToggleQrCode,
  copiedToken,
  invitePending,
  revokePending,
  onSendInvite,
  onCopyLink,
  onRequestRemoveMember,
  onRequestRevokeInvite,
  onRequestDeleteFamily,
  onRequestLeaveFamily,
}: FamilyMembersInvitesTabProps) {
  return (
    <div className="space-y-4 pt-2">
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span>Participantes da Casa</span>
            <Badge variant="muted" size="xs">{members.length} de 6 membros</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {members.map((m) => {
            const isMemberOwner = m.role === "owner";
            const isSelf = m.user_id === currentUserId;
            return (
              <div
                key={m.id || m.user_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/80 bg-muted/20"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {m.display_name || m.profile_name || "Membro"}
                    </span>
                    {isSelf && <Badge variant="default" size="xs">Você</Badge>}
                    <Badge variant={isMemberOwner ? "warning" : "muted"} size="xs">
                      {isMemberOwner ? "Titular" : "Participante"}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {m.pix_key ? `Pix: ${m.pix_key}` : "Chave Pix não informada"}
                  </span>
                </div>

                {isOwner && !isMemberOwner && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRequestRemoveMember(m)}
                    className="gap-1 text-critical-strong hover:bg-critical/10 rounded-lg shrink-0 self-end sm:self-center"
                  >
                    <UserMinus className="size-3.5" aria-hidden="true" />
                    <span>Remover</span>
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {isOwner && members.length < 6 && (
        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Convidar Familiar ou Parceiro</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <form onSubmit={onSendInvite} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => onInviteEmailChange(e.target.value)}
                placeholder="E-mail do participante"
                aria-label="E-mail do participante"
                required
                className="h-10 text-base sm:text-sm rounded-xl flex-1"
              />
              <Button
                type="submit"
                sensoryIntent={false}
                disabled={invitePending || !inviteEmail.trim()}
                loading={invitePending}
                className="gap-1.5 rounded-xl shrink-0"
              >
                <UserPlus className="size-3.5" aria-hidden="true" />
                <span>Gerar Convite</span>
              </Button>
            </form>

            {generatedInviteUrl && (
              <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
                <span className="text-xs font-semibold text-foreground block">Link de convite gerado:</span>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generatedInviteUrl}
                    aria-label="Link de convite gerado"
                    className="h-10 text-base sm:text-sm font-mono bg-surface rounded-lg select-all"
                  />
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    sensoryIntent={false}
                    onClick={() => onCopyLink(generatedInviteUrl, "direct")}
                    className="gap-1.5 px-3 rounded-lg shrink-0"
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    <span>Copiar</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={onToggleQrCode}
                    className="size-10 rounded-lg shrink-0"
                    title="Exibir QR Code"
                    aria-label="Exibir QR Code do convite"
                  >
                    <QrCode className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                {showQrCode && (
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <QrCodeCanvas text={generatedInviteUrl} size={144} label="QR Code do convite familiar" className="size-36 rounded-xl" />
                    <span className="text-[11px] text-muted-foreground">Aponte a câmera do celular para aceitar o convite</span>
                  </div>
                )}
              </div>
            )}

            <FamilyPendingInvitesList
              invites={pendingInvites}
              copiedToken={copiedToken}
              revokePending={revokePending}
              onCopyLink={onCopyLink}
              onRequestRevokeInvite={onRequestRevokeInvite}
            />
          </CardContent>
        </Card>
      )}

      <div className="pt-3 border-t border-border/80 flex justify-end">
        {isOwner ? (
          <Button type="button" variant="destructive" size="sm" onClick={onRequestDeleteFamily} className="gap-1.5 rounded-xl">
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>Excluir Unidade Familiar</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRequestLeaveFamily}
            className="gap-1.5 text-critical-strong hover:bg-critical/10 border-critical/30 rounded-xl"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span>Sair da Família</span>
          </Button>
        )}
      </div>
    </div>
  );
}
