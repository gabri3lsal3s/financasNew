import { useState } from "react";
import type { FormEvent } from "react";
import { Check, Copy, ExternalLink, KeyRound, Shield, UserPlus } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { useAdminPlans, useAdminProvisionUser } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserCreateDialog({ open, onOpenChange }: UserCreateDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [planId, setPlanId] = useState("free");
  const [status, setStatus] = useState<"active" | "pending_approval">("active");

  // Estado de resultado pós-criação
  const [createdResult, setCreatedResult] = useState<{
    userId: string;
    email: string;
    actionLink: string | null;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const plansQuery = useAdminPlans();
  const plans = plansQuery.data ?? [];
  const provisionMutation = useAdminProvisionUser();

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setRole("user");
    setPlanId("free");
    setStatus("active");
    setCreatedResult(null);
    setHasCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || provisionMutation.isPending) return;

    try {
      triggerSensory("action");
      const result = await provisionMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        role,
        plan_id: planId,
        status,
      });

      triggerSensory("success");
      setCreatedResult(result);
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleCopyLink = async () => {
    if (!createdResult?.actionLink) return;
    try {
      await navigator.clipboard.writeText(createdResult.actionLink);
      triggerSensory("selection");
      setHasCopied(true);
      pushToast({
        title: "Link copiado com sucesso",
        description: "O link de ativação soberana foi copiado para sua área de transferência.",
        variant: "success",
      });
      setTimeout(() => setHasCopied(false), 3000);
    } catch {
      pushToast({
        title: "Falha ao copiar",
        description: "Não foi possível copiar o link automaticamente.",
        variant: "destructive",
      });
    }
  };

  const cleanPhoneDigits = phone.replace(/\D/g, "");
  const whatsappUrl = cleanPhoneDigits && createdResult?.actionLink
    ? `https://wa.me/55${cleanPhoneDigits}?text=${encodeURIComponent(
        `Olá ${name.split(" ")[0]}, sua conta no Áxis Finance foi criada pelo administrador. Acesse o link oficial para definir sua senha com segurança:\n\n${createdResult.actionLink}`,
      )}`
    : null;

  return (
    <Modal
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) handleClose();
        else onOpenChange(true);
      }}
      size="md"
      title={createdResult ? "Conta Provisionada com Sucesso" : "Adicionar Novo Usuário"}
      description={
        createdResult
          ? "O usuário foi criado no sistema. Envie o link de ativação para que ele crie sua própria senha."
          : "Cadastre um novo usuário na plataforma. O cadastro da senha é realizado pelo próprio usuário via link seguro."
      }
    >
      {createdResult ? (
        <div className="flex flex-col gap-5 py-2">
          <Alert variant="success">
            A conta para <strong>{createdResult.email}</strong> está pronta e vinculada com segurança no banco de dados.
          </Alert>

          <div className="rounded-xl border border-border/80 bg-surface-hover/30 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-primary-strong" aria-hidden="true" />
                <span>Link Soberano de Ativação / Definição de Senha</span>
              </span>
              <Badge variant="warning" size="xs">
                Uso Único
              </Badge>
            </div>

            {createdResult.actionLink ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdResult.actionLink}
                    className="font-mono text-xs select-all bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="shrink-0 gap-1.5 h-10 px-3"
                  >
                    {hasCopied ? (
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
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Envie este link diretamente para o cliente. Ao clicar, ele será recebido em tela segura para escolher sua própria senha com 100% de privacidade.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Um e-mail de ativação foi despachado para a caixa de entrada de {createdResult.email}.
              </p>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-surface px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition-colors mt-1"
              >
                <ExternalLink className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Despachar Link via WhatsApp do Cliente</span>
              </a>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="default" onClick={handleClose} className="w-full sm:w-auto">
              Concluir
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-user-name" className="text-xs font-semibold text-foreground">
                Nome Completo
              </label>
              <Input
                id="create-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Gabriel Sales"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-user-email" className="text-xs font-semibold text-foreground">
                E-mail Corporativo / Pessoal
              </label>
              <Input
                id="create-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@exemplo.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="create-user-phone" className="text-xs font-semibold text-foreground">
                  Telefone / WhatsApp
                </label>
                <span className="text-[11px] text-muted-foreground">(opcional)</span>
              </div>
              <Input
                id="create-user-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-user-role" className="text-xs font-semibold text-foreground">
                Nível de Acesso (Cargo)
              </label>
              <Select
                id="create-user-role"
                value={role}
                onValueChange={(val) => setRole(val as "user" | "admin")}
                options={[
                  { value: "user", label: "Usuário Padrão (Cliente)" },
                  { value: "admin", label: "Administrador de Plataforma" },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-user-plan" className="text-xs font-semibold text-foreground">
                Plano Inicial Concedido
              </label>
              <Select
                id="create-user-plan"
                value={planId}
                onValueChange={setPlanId}
                options={[
                  { value: "free", label: "Degustação / Free" },
                  ...plans.map((p) => ({
                    value: p.id,
                    label: `${p.name} (R$ ${(p.price_cents / 100).toFixed(2).replace(".", ",")})`,
                  })),
                  { value: "lifetime", label: "Plano Vitalício (Lifetime VIP)" },
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-user-status" className="text-xs font-semibold text-foreground">
                Status da Conta
              </label>
              <Select
                id="create-user-status"
                value={status}
                onValueChange={(val) => setStatus(val as "active" | "pending_approval")}
                options={[
                  { value: "active", label: "Ativo (Liberado de Imediato)" },
                  { value: "pending_approval", label: "Pendente de Aprovação" },
                ]}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface p-3.5 mt-1 flex items-start gap-2.5">
            <Shield className="size-4 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Privacidade por Padrão:</strong> Nenhuma senha é digitada pelo administrador. Ao submeter, será gerado um link criptografado exclusivo para que o cliente defina sua senha com total soberania.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={provisionMutation.isPending || !name.trim() || !email.trim()}
              className="gap-1.5"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              <span>{provisionMutation.isPending ? "Provisionando…" : "Cadastrar e Gerar Link"}</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
