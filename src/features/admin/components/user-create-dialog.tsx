import { useState } from "react";
import type { FormEvent } from "react";
import { Check, Copy, ExternalLink, KeyRound, Shield, UserPlus } from "lucide-react";
import { Alert, Badge, Button, FormField, Input, Modal, ModalFooter, Select } from "@/components/ui";
import { formatCentsAsBRL } from "@/services/masks/money";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useAdminPlans, useAdminProvisionUser } from "@/state";

export interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_PLAN_OPTIONS = [
  { value: "trial", label: "Trial Pro (30 dias de Degustação)" },
  { value: "pro_monthly", label: "Plano Pro Mensal" },
  { value: "pro_annual", label: "Plano Pro Anual" },
  { value: "lifetime", label: "Plano Vitalício (Lifetime VIP)" },
];

/** Modal administrativo de provisionamento de usuário sem senha prévia (link soberano). */
export function UserCreateDialog({ open, onOpenChange }: UserCreateDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [planId, setPlanId] = useState("trial");
  const [status, setStatus] = useState<"active" | "pending_approval">("active");
  const [createdResult, setCreatedResult] = useState<{
    userId: string;
    email: string;
    actionLink: string | null;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const plansQuery = useAdminPlans();
  const plans = plansQuery.data ?? [];
  const provisionMutation = useAdminProvisionUser();

  const handleClose = () => {
    setName("");
    setEmail("");
    setPhone("");
    setRole("user");
    setPlanId("trial");
    setStatus("active");
    setCreatedResult(null);
    setHasCopied(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || provisionMutation.isPending) return;
    try {
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
      setHasCopied(true);
      pushToast({ title: "Link copiado com sucesso", description: "O link de ativação soberana foi copiado para sua área de transferência.", variant: "success" });
      setTimeout(() => setHasCopied(false), 3000);
    } catch {
      pushToast({ title: "Falha ao copiar", description: "Não foi possível copiar o link automaticamente.", variant: "destructive" });
    }
  };

  const cleanPhone = phone.replace(/\D/g, "");
  const whatsappUrl = cleanPhone && createdResult?.actionLink
    ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
        `Olá ${name.split(" ")[0]}, sua conta no Axir foi criada pelo administrador. Acesse o link oficial para definir sua senha com segurança:\n\n${createdResult.actionLink}`,
      )}`
    : null;
  const planOptions = plans.length > 0
    ? plans.map((p) => ({
        value: p.id,
        label: typeof p.price_cents === "number" ? `${p.name} (${formatCentsAsBRL(p.price_cents)})` : p.name,
      }))
    : DEFAULT_PLAN_OPTIONS;

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : onOpenChange(true))}
      size="md"
      title={createdResult ? "Conta Provisionada com Sucesso" : "Adicionar Novo Usuário"}
      description={
        createdResult
          ? "O usuário foi criado no sistema. Envie o link de ativação para que ele crie sua própria senha."
          : "Cadastre um novo usuário na plataforma. O cadastro da senha é realizado pelo próprio usuário via link seguro."
      }
      footer={
        createdResult ? (
          <ModalFooter borderless>
            <Button type="button" variant="default" onClick={handleClose}>Concluir</Button>
          </ModalFooter>
        ) : (
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" form="user-create-form" variant="default" sensoryIntent={false} disabled={provisionMutation.isPending || !name.trim() || !email.trim()}>
              <UserPlus aria-hidden="true" />
              <span>{provisionMutation.isPending ? "Provisionando…" : "Cadastrar e Gerar Link"}</span>
            </Button>
          </ModalFooter>
        )
      }
    >
      {createdResult ? (
        <div className="flex flex-col gap-5 py-2">
          <Alert variant="success">
            A conta para <strong>{createdResult.email}</strong> está pronta e vinculada com segurança no banco de dados.
          </Alert>
          <div className="rounded-xl border border-border/80 bg-surface p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-primary-strong" aria-hidden="true" />
                <span>Link Soberano de Ativação / Definição de Senha</span>
              </span>
              <Badge variant="warning" size="xs">Uso Único</Badge>
            </div>
            {createdResult.actionLink ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Input readOnly value={createdResult.actionLink} aria-label="Link soberano de ativação" className="font-mono text-base sm:text-sm select-all bg-background" />
                  <Button type="button" variant="outline" size="sm" sensoryIntent="selection" onClick={handleCopyLink} className="shrink-0">
                    {hasCopied ? <Check className="text-positive-strong" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    <span>{hasCopied ? "Copiado" : "Copiar"}</span>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Envie este link diretamente para o cliente. Ao clicar, ele será recebido em tela segura para escolher sua própria senha com 100% de privacidade.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Um e-mail de ativação foi despachado para a caixa de entrada de {createdResult.email}.</p>
            )}
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-surface px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1">
                <ExternalLink className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Despachar Link via WhatsApp do Cliente</span>
              </a>
            )}
          </div>
        </div>
      ) : (
        <form id="user-create-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Nome Completo" htmlFor="create-user-name">
              <Input id="create-user-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Gabriel Sales" required />
            </FormField>
            <FormField label="E-mail Corporativo / Pessoal" htmlFor="create-user-email">
              <Input id="create-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@exemplo.com" required />
            </FormField>
            <FormField label="Telefone / WhatsApp" optional htmlFor="create-user-phone">
              <Input id="create-user-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 98765-4321" />
            </FormField>
            <FormField label="Nível de Acesso (Cargo)" htmlFor="create-user-role">
              <Select id="create-user-role" value={role} onValueChange={(v) => setRole(v as "user" | "admin")} options={[{ value: "user", label: "Usuário Padrão (Cliente)" }, { value: "admin", label: "Administrador de Plataforma" }]} />
            </FormField>
            <FormField label="Plano Inicial Concedido" htmlFor="create-user-plan">
              <Select id="create-user-plan" value={planId} onValueChange={setPlanId} options={planOptions} />
            </FormField>
            <FormField label="Status da Conta" htmlFor="create-user-status">
              <Select id="create-user-status" value={status} onValueChange={(v) => setStatus(v as "active" | "pending_approval")} options={[{ value: "active", label: "Ativo (Liberado de Imediato)" }, { value: "pending_approval", label: "Pendente de Aprovação" }]} />
            </FormField>
          </div>
          <div className="rounded-xl border border-border/80 bg-surface p-3.5 mt-1 flex items-start gap-2.5">
            <Shield className="size-4 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Privacidade por Padrão:</strong> Nenhuma senha é digitada pelo administrador. Ao submeter, será gerado um link criptografado exclusivo para que o cliente defina sua senha com total soberania.
            </p>
          </div>
        </form>
      )}
    </Modal>
  );
}
