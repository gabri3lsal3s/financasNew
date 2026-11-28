import { useState } from "react";
import type { FormEvent } from "react";
import { Copy, KeyRound, Plus, ShieldAlert, Sparkles } from "lucide-react";
import { Button, Checkbox, DatePicker, FormField, Input, Modal, ModalFooter, NumericInput, Select } from "@/components/ui";
import { CORE_MODULES, generateInviteCode } from "@/domain/admin";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useAdminCreateModularInvite } from "@/state";
import type { ModuleAccessLevel, SubscriptionTier } from "@/types";

export interface CreateInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INVITE_MODULES = CORE_MODULES;

/** Modal de criação de convites de acesso com tier e whitelisting modular opcional. */
export function CreateInviteDialog({ open, onOpenChange }: CreateInviteDialogProps) {
  const createInviteMutation = useAdminCreateModularInvite();
  const [code, setCode] = useState(() => generateInviteCode());
  const [targetTier, setTargetTier] = useState<SubscriptionTier>("trial");
  const [customTrialDays, setCustomTrialDays] = useState("");
  const [maxUses, setMaxUses] = useState("1");
  const [targetEmail, setTargetEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [customizeModules, setCustomizeModules] = useState(false);
  const [moduleGrants, setModuleGrants] = useState<Record<string, ModuleAccessLevel>>({});

  const resetFields = () => {
    setCode(generateInviteCode());
    setTargetTier("trial");
    setCustomTrialDays("");
    setTargetEmail("");
    setExpiresAt("");
    setNotes("");
    setCustomizeModules(false);
    setModuleGrants({});
    setMaxUses("1");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const parsedTrial = customTrialDays ? Math.min(365, Math.max(1, parseInt(customTrialDays, 10) || 0)) : null;
    const parsedUses = Math.min(1000, Math.max(1, parseInt(maxUses, 10) || 1));
    try {
      await createInviteMutation.mutateAsync({
        code: code.trim().toUpperCase(),
        targetTier,
        customTrialDays: targetTier === "trial" && parsedTrial ? parsedTrial : null,
        moduleGrants: customizeModules && Object.keys(moduleGrants).length > 0 ? moduleGrants : undefined,
        maxUses: parsedUses,
        expiresAt: expiresAt ? `${expiresAt}T23:59:59Z` : null,
        targetEmail: targetEmail.trim() || null,
        notes: notes.trim() || null,
      });
      triggerSensory("success");
      pushToast({ title: "Convite gerado", description: `Código ${code.trim().toUpperCase()} criado com sucesso.` });
      onOpenChange(false);
      resetFields();
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      pushToast({ title: "Código copiado", description: "O código do convite foi copiado para a área de transferência.", variant: "info" });
    } catch {
      // no-op
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Gerar Novo Convite de Acesso"
      description="Crie um código de convite definindo o plano atribuído (Trial, Pro ou Vitalício) e controle modular de acesso."
      size="lg"
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="create-invite-form" variant="default" sensoryIntent={false} disabled={createInviteMutation.isPending} className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            <span>{createInviteMutation.isPending ? "Criando…" : "Salvar Convite"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <form id="create-invite-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField label="Código do Convite" htmlFor="invite-code">
          <div className="flex items-center gap-2">
            <Input id="invite-code" type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required className="font-mono uppercase text-base sm:text-sm font-bold" />
            <Button type="button" variant="outline" size="icon" onClick={() => setCode(generateInviteCode())} aria-label="Gerar outro código aleatório" title="Gerar outro código aleatório">
              <Sparkles className="size-4" aria-hidden="true" />
            </Button>
            <Button type="button" variant="outline" size="icon" sensoryIntent="selection" onClick={handleCopyCode} aria-label="Copiar código" title="Copiar código">
              <Copy className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </FormField>

        <div className="p-3.5 rounded-xl border border-border/80 bg-surface">
          <FormField
            label={<span className="flex items-center gap-2"><KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />Plano / Tier Atribuído ao Usuário</span>}
            htmlFor="invite-tier"
            helperText="Define o tier padrão que será ativado na conta do usuário ao resgatar o código."
          >
            <Select
              id="invite-tier"
              value={targetTier}
              onValueChange={(v) => setTargetTier(v as SubscriptionTier)}
              options={[
                { value: "trial", label: "Trial Pro (Período de Teste)" },
                { value: "lifetime", label: "Plano Vitalício VIP (Acesso Permanente)" },
                { value: "pro_annual", label: "Plano Pro Anual" },
                { value: "pro_monthly", label: "Plano Pro Mensal" },
              ]}
            />
          </FormField>
        </div>

        {targetTier === "trial" && (
          <FormField label="Dias de Teste (Trial Estendido)" htmlFor="invite-trial-days" helperText="Padrão: 30 dias">
            <NumericInput id="invite-trial-days" inputMode="numeric" maxLength={3} value={customTrialDays} onValueChange={(v) => setCustomTrialDays(v.replace(/\D/g, ""))} placeholder="30" />
          </FormField>
        )}

        <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border/80 bg-surface">
          <div className="flex items-center gap-2">
            <Checkbox id="customize-modules" checked={customizeModules} onCheckedChange={(c) => setCustomizeModules(Boolean(c))} />
            <label htmlFor="customize-modules" className="text-xs font-semibold text-foreground cursor-pointer select-none">Configurar Permissões Modulares Específicas</label>
          </div>
          <span className="text-[11px] text-muted-foreground pl-6">Permite conceder planos vitalícios ou convites com restrições por módulo (ex.: somente Investimentos ou Transações em modo leitura).</span>

          {customizeModules && (
            <div className="flex flex-col gap-2.5 mt-2 pt-2 border-t border-border/80 pl-1">
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-warning/30 bg-warning/5 text-xs text-foreground">
                <ShieldAlert className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-warning-strong">Atenção: Modo Whitelist será Ativado no Resgate</span>
                  <span className="text-[11px] text-muted-foreground leading-relaxed">Personalizar permissões modulares neste convite aplicará a política restrita de Whitelist à conta que o resgatar: módulos omitidos ou marcados como Bloqueados permanecerão inacessíveis, independentemente do plano atribuído.</span>
                </div>
              </div>
              {INVITE_MODULES.map((mod) => (
                <div key={mod.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border/80 bg-surface text-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground">{mod.label}</span>
                    <span className="text-[11px] text-muted-foreground">{mod.desc}</span>
                  </div>
                  <div className="w-full sm:w-48 shrink-0">
                    <Select ariaLabel={`Permissão para ${mod.label}`} value={moduleGrants[mod.key] ?? "write"} onValueChange={(v) => setModuleGrants((prev) => ({ ...prev, [mod.key]: v as ModuleAccessLevel }))} options={[{ value: "write", label: "Acesso Total (Escrita)" }, { value: "read", label: "Somente Leitura (Read-Only)" }, { value: "none", label: "Bloqueado (Sem Acesso)" }]} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <FormField label="Limite Máximo de Usos" htmlFor="invite-max-uses" helperText="Contas que podem resgatar este código (padrão: 1).">
            <NumericInput id="invite-max-uses" inputMode="numeric" maxLength={4} value={maxUses} onValueChange={(v) => setMaxUses(v.replace(/\D/g, ""))} onBlur={() => { if (!maxUses || parseInt(maxUses, 10) < 1) setMaxUses("1"); }} placeholder="1" />
          </FormField>
          <FormField label="Restringir a E-mail" optional htmlFor="invite-target-email" helperText="Deixe vazio para permitir qualquer e-mail.">
            <Input id="invite-target-email" type="email" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} placeholder="usuario@exemplo.com" />
          </FormField>
          <FormField label="Validade do Convite" optional htmlFor="invite-expires">
            <DatePicker value={expiresAt} onValueChange={setExpiresAt} placeholder="Sem expiração (Permanente)" />
          </FormField>
          <FormField label="Observações Administrativas" optional htmlFor="invite-notes">
            <Input id="invite-notes" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Beta Tester / Parceria VIP" />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
