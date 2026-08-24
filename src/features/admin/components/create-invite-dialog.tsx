import { useState } from "react";
import type { FormEvent } from "react";
import { Copy, Plus, Sparkles } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { generateInviteCode } from "@/domain/admin";
import { useAdminCreateInvite } from "@/state";
import { pushToast } from "@/services/toast";

export interface CreateInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInviteDialog({ open, onOpenChange }: CreateInviteDialogProps) {
  const createInviteMutation = useAdminCreateInvite();
  const [code, setCode] = useState(() => generateInviteCode());
  const [maxUses, setMaxUses] = useState(1);
  const [targetEmail, setTargetEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const handleGenerateNew = () => {
    setCode(generateInviteCode());
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      await createInviteMutation.mutateAsync({
        code: code.trim().toUpperCase(),
        maxUses: Number(maxUses) || 1,
        expiresAt: expiresAt ? `${expiresAt}T23:59:59Z` : null,
        targetEmail: targetEmail.trim() ? targetEmail.trim() : null,
      });
      onOpenChange(false);
      setCode(generateInviteCode());
      setTargetEmail("");
      setExpiresAt("");
      setMaxUses(1);
    } catch {
      // Erro tratado no hook
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      pushToast({
        title: "Código copiado",
        description: "O código do convite foi copiado para a área de transferência.",
        variant: "info",
      });
    } catch {
      // no-op
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Gerar Novo Convite de Acesso"
      description="Crie um código promocional ou de pré-aprovação para liberar o onboarding."
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Código do Convite */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-code" className="text-xs font-semibold text-foreground">
            Código do Convite
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="invite-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              className="font-mono uppercase text-sm font-bold"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleGenerateNew}
              title="Gerar outro código aleatório"
            >
              <Sparkles className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyCode}
              title="Copiar código"
            >
              <Copy className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Limite de Usos */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-max-uses" className="text-xs font-semibold text-foreground">
            Limite Máximo de Usos
          </label>
          <Input
            id="invite-max-uses"
            type="number"
            min={1}
            max={1000}
            value={maxUses}
            onChange={(e) => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
            required
          />
          <span className="text-[11px] text-muted-foreground">
            Número de contas que podem ser ativadas com este código (padrão: 1).
          </span>
        </div>

        {/* E-mail Alvo Restrito */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="invite-target-email" className="text-xs font-semibold text-foreground">
              Restringir a E-mail Específico
            </label>
            <span className="text-[10px] text-muted-foreground">Opcional</span>
          </div>
          <Input
            id="invite-target-email"
            type="email"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="usuario@exemplo.com"
          />
        </div>

        {/* Data de Expiração */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="invite-expires" className="text-xs font-semibold text-foreground">
              Data Limite de Validade
            </label>
            <span className="text-[10px] text-muted-foreground">Opcional</span>
          </div>
          <DatePicker
            value={expiresAt}
            onValueChange={setExpiresAt}
            placeholder="Sem data de expiração (Permanente)"
          />
        </div>

        {/* Ações */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-border mt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto justify-center">
            Cancelar
          </Button>
          <Button type="submit" variant="default" disabled={createInviteMutation.isPending} className="gap-1.5 w-full sm:w-auto justify-center">
            <Plus className="size-4" aria-hidden="true" />
            {createInviteMutation.isPending ? "Criando…" : "Salvar Convite"}
          </Button>
        </div>

      </form>
    </Modal>
  );
}
