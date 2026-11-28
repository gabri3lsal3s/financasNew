import { Eye, EyeOff, MessageCircle, Phone, Shield } from "lucide-react";
import { Button } from "@/components/ui";
import { formatDateBR } from "@/lib/date";
import { useAdminUserContact } from "@/state";
import type { AdminUserRow } from "@/types";

export interface UserPiiAuditVaultCardProps {
  user: AdminUserRow;
  revealContact: boolean;
  onRevealChange: (reveal: boolean) => void;
}

/**
 * Cartão de identificação básica com revelação auditada de telefone e CPF (LGPD).
 */
export function UserPiiAuditVaultCard({
  user,
  revealContact,
  onRevealChange,
}: UserPiiAuditVaultCardProps) {
  const contactQuery = useAdminUserContact(user.id, revealContact);
  const createdDate = user.created_at.slice(0, 10);

  return (
    <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-col gap-2 text-xs shadow-xs">
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Nome:</span>
        <span className="font-semibold text-foreground text-right">{user.name || "Não informado"}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">E-mail:</span>
        <span className="font-mono text-foreground text-right break-all">{user.email}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Cadastrado em:</span>
        <span className="text-foreground num">
          {createdDate.length === 10 ? formatDateBR(createdDate) : new Date(user.created_at).toLocaleDateString("pt-BR")}
        </span>
      </div>

      <div className="pt-2 border-t border-border/80 flex flex-col gap-2">
        {!revealContact ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRevealChange(true)}
            className="w-full justify-center min-h-8 h-auto py-1.5 border-dashed whitespace-normal text-center"
          >
            <Eye className="text-primary-strong shrink-0" aria-hidden="true" />
            <span>Revelar Contatos e CPF (Auditoria LGPD)</span>
          </Button>
        ) : contactQuery.isLoading ? (
          <div className="text-[11px] text-muted-foreground animate-pulse py-1">
            Consultando dados seguros no cofre e registrando auditoria…
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 bg-surface p-2.5 rounded-lg border border-border/80">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">Telefone/WhatsApp:</span>
              </div>
              {contactQuery.data?.phone ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground">{contactQuery.data.phone}</span>
                  <a
                    href={`https://wa.me/55${contactQuery.data.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-positive-strong hover:underline"
                  >
                    <MessageCircle className="size-3" aria-hidden="true" />
                    <span>Conversar</span>
                  </a>
                </div>
              ) : (
                <span className="text-muted-foreground italic">Não cadastrado</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Shield className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">CPF do Titular:</span>
              </div>
              <span className="font-mono text-foreground">
                {contactQuery.data?.cpf || contactQuery.data?.masked_cpf || "Não informado"}
              </span>
            </div>

            <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/80">
              <span className="text-positive-strong">Trilha de auditoria registrada</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onRevealChange(false)}
                className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
              >
                <EyeOff aria-hidden="true" />
                <span>Ocultar</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
