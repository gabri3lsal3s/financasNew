import { useState } from "react";
import type { FormEvent } from "react";
import { Copy, KeyRound, Plus, Sparkles } from "lucide-react";
import { Button, Checkbox, DatePicker, Input, Modal, Select } from "@/components/ui";
import { generateInviteCode } from "@/domain/admin";
import { useAdminCreateModularInvite } from "@/state";
import { pushToast } from "@/services/toast";
import type { ModuleAccessLevel, SubscriptionTier } from "@/types";

export interface CreateInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AVAILABLE_MODULES = [
  { key: "transactions", label: "Transações & Lançamentos", desc: "Receitas, despesas e extrato" },
  { key: "cards", label: "Cartões de Crédito", desc: "Faturas, limites e carteira 3D" },
  { key: "debts", label: "Dívidas & Empréstimos", desc: "Contas a pagar, receber e contratos" },
  { key: "budgets", label: "Orçamentos & Metas", desc: "Limites de gastos e metas de renda" },
  { key: "investments", label: "Investimentos & Carteira", desc: "Posição, proventos e rebalanceamento" },
  { key: "reports", label: "Relatórios Executivos", desc: "DRE, balanço patrimonial e fiscal" },
  { key: "insights", label: "Inteligência Financeira", desc: "Radar de insights e diagnósticos" },
  { key: "reminders", label: "Central de Lembretes", desc: "Avisos e pendências de vencimento" },
] as const;

export function CreateInviteDialog({ open, onOpenChange }: CreateInviteDialogProps) {
  const createInviteMutation = useAdminCreateModularInvite();
  const [code, setCode] = useState(() => generateInviteCode());
  const [targetTier, setTargetTier] = useState<SubscriptionTier>("trial");
  const [customTrialDays, setCustomTrialDays] = useState<number | "">("");
  const [maxUses, setMaxUses] = useState(1);
  const [targetEmail, setTargetEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [customizeModules, setCustomizeModules] = useState(false);
  const [moduleGrants, setModuleGrants] = useState<Record<string, ModuleAccessLevel>>({});

  const handleGenerateNew = () => {
    setCode(generateInviteCode());
  };

  const handleModuleGrantChange = (moduleKey: string, level: ModuleAccessLevel) => {
    setModuleGrants((prev) => ({
      ...prev,
      [moduleKey]: level,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      await createInviteMutation.mutateAsync({
        code: code.trim().toUpperCase(),
        targetTier,
        customTrialDays: targetTier === "trial" && typeof customTrialDays === "number" ? customTrialDays : null,
        moduleGrants: customizeModules && Object.keys(moduleGrants).length > 0 ? moduleGrants : undefined,
        maxUses: Number(maxUses) || 1,
        expiresAt: expiresAt ? `${expiresAt}T23:59:59Z` : null,
        targetEmail: targetEmail.trim() ? targetEmail.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
      });
      onOpenChange(false);
      setCode(generateInviteCode());
      setTargetTier("trial");
      setCustomTrialDays("");
      setTargetEmail("");
      setExpiresAt("");
      setNotes("");
      setCustomizeModules(false);
      setModuleGrants({});
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
      description="Crie um código de convite definindo o plano atribuído (Trial, Pro ou Vitalício) e controle modular de acesso."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto pr-1">
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

        {/* Plano / Tier Concedido pelo Convite */}
        <div className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-border/80 bg-surface/60">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            <label htmlFor="invite-tier" className="text-xs font-semibold text-foreground">
              Plano / Tier Atribuído ao Usuário
            </label>
          </div>
          <Select
            value={targetTier}
            onValueChange={(val) => setTargetTier(val as SubscriptionTier)}
            options={[
              { value: "trial", label: "Trial Pro (Período de Teste)" },
              { value: "lifetime", label: "Plano Vitalício VIP (Acesso Permanente)" },
              { value: "pro_annual", label: "Plano Pro Anual" },
              { value: "pro_monthly", label: "Plano Pro Mensal" },
            ]}
          />
          <span className="text-[11px] text-muted-foreground">
            Define o tier padrão que será ativado na conta do usuário ao resgatar o código.
          </span>
        </div>

        {/* Dias de Trial Customizados */}
        {targetTier === "trial" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="invite-trial-days" className="text-xs font-semibold text-foreground">
                Dias de Teste (Trial Estendido)
              </label>
              <span className="text-[10px] text-muted-foreground">Padrão: 30 dias</span>
            </div>
            <Input
              id="invite-trial-days"
              type="number"
              min={1}
              max={365}
              value={customTrialDays}
              onChange={(e) => setCustomTrialDays(e.target.value ? parseInt(e.target.value, 10) : "")}
              placeholder="30"
            />
          </div>
        )}

        {/* Configuração Modular de Acesso (Vitalício Restrito / Convite Customizado) */}
        <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border/80 bg-surface/40">
          <div className="flex items-center gap-2">
            <Checkbox
              id="customize-modules"
              checked={customizeModules}
              onCheckedChange={(checked) => setCustomizeModules(Boolean(checked))}
            />
            <label htmlFor="customize-modules" className="text-xs font-semibold text-foreground cursor-pointer select-none">
              Configurar Permissões Modulares Específicas
            </label>
          </div>
          <span className="text-[11px] text-muted-foreground pl-6">
            Permite conceder planos vitalícios ou convites com restrições por módulo (ex.: somente Investimentos ou Transações em modo leitura).
          </span>

          {customizeModules && (
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/60 pl-1">
              {AVAILABLE_MODULES.map((mod) => {
                const currentLevel = moduleGrants[mod.key] ?? "write";
                return (
                  <div
                    key={mod.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg border border-border/60 bg-surface text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground">{mod.label}</span>
                      <span className="text-[11px] text-muted-foreground">{mod.desc}</span>
                    </div>

                    <div className="w-full sm:w-48 shrink-0">
                      <Select
                        value={currentLevel}
                        onValueChange={(val) => handleModuleGrantChange(mod.key, val as ModuleAccessLevel)}
                        options={[
                          { value: "write", label: "Acesso Total (Escrita)" },
                          { value: "read", label: "Somente Leitura (Read-Only)" },
                          { value: "none", label: "Bloqueado (Sem Acesso)" },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Parâmetros Adicionais em Grid Responsivo (Mobile: 1 coluna, Desktop: 2 colunas) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
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
              Contas que podem resgatar este código (padrão: 1).
            </span>
          </div>

          {/* E-mail Alvo Restrito */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="invite-target-email" className="text-xs font-semibold text-foreground">
                Restringir a E-mail
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
            <span className="text-[11px] text-muted-foreground">
              Deixe vazio para permitir qualquer e-mail.
            </span>
          </div>

          {/* Data de Expiração */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="invite-expires" className="text-xs font-semibold text-foreground">
                Validade do Convite
              </label>
              <span className="text-[10px] text-muted-foreground">Opcional</span>
            </div>
            <DatePicker
              value={expiresAt}
              onValueChange={setExpiresAt}
              placeholder="Sem expiração (Permanente)"
            />
          </div>

          {/* Observações / Notas */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="invite-notes" className="text-xs font-semibold text-foreground">
                Observações Administrativas
              </label>
              <span className="text-[10px] text-muted-foreground">Opcional</span>
            </div>
            <Input
              id="invite-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Beta Tester / Parceria VIP"
            />
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-border mt-2">
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
