import { useState } from "react";
import type { FormEvent } from "react";
import {
  Users,
  Settings,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Loader2,
  QrCode,
  LogOut,
  KeyRound,
  DollarSign,
  UserMinus,
  Sparkles,
} from "lucide-react";
import {
  Modal,
  ModalFooter,
  Button,
  Badge,
  Input,
  MoneyInput,
  PercentInput,
  Select,
  type SelectOption,
  MoneyText,
  Tabs,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  QrCodeCanvas,
} from "@/components/ui";
import {
  useMyFamily,
  useInviteFamilyMember,
  useRevokeFamilyInvite,
  useLeaveFamily,
  useDeleteFamily,
  useRemoveFamilyMember,
  useUpdateFamily,
  useUpdateFamilyMember,
  useFamilyIncomeRatioSuggestion,
} from "@/state";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getPublicAppUrl } from "@/services/app-url";
import { FamilyBudgetShareCard } from "@/features/settings/components/tabs/family-budget-share-card";
import type {
  FamilyPixKeyType,
  FamilySplitRule,
  FamilyMember,
} from "@/types";

const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone / Celular" },
  { value: "random", label: "Chave Aleatória" },
];

const SPLIT_RULE_OPTIONS: SelectOption[] = [
  { value: "combined", label: "Finanças Conjuntas (Caixa Único)" },
  { value: "equal", label: "Divisão Igualitária (50% / 50%)" },
  { value: "proportional", label: "Divisão Proporcional à Renda" },
];

export interface FamilySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}

export function FamilySettingsDialog({
  open,
  onOpenChange,
  initialTab = "general",
}: FamilySettingsDialogProps) {
  const { data: myFamilyData } = useMyFamily();

  const updateFamilyMutation = useUpdateFamily();
  const updateMemberMutation = useUpdateFamilyMember();
  const inviteMemberMutation = useInviteFamilyMember();
  const revokeInviteMutation = useRevokeFamilyInvite();
  const removeFamilyMemberMutation = useRemoveFamilyMember();
  const leaveFamilyMutation = useLeaveFamily();
  const deleteFamilyMutation = useDeleteFamily();

  const [activeTab, setActiveTab] = useState(initialTab);

  // Estados de Edição da Família (Titular)
  const [editName, setEditName] = useState("");
  const [editBudgetCents, setEditBudgetCents] = useState<number | null>(null);
  const [editSplitRule, setEditSplitRule] = useState<FamilySplitRule>("combined");
  const [isFamilyDirty, setIsFamilyDirty] = useState(false);

  // Estados de Edição do Meu Perfil na Família
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberPixKeyType, setMemberPixKeyType] = useState<FamilyPixKeyType>("cpf");
  const [memberPixKey, setMemberPixKey] = useState("");
  const [memberSplitRatioPercent, setMemberSplitRatioPercent] = useState<number>(50);
  const [isMemberDirty, setIsMemberDirty] = useState(false);

  // Estados de Convite
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Modais de Confirmação Secundários
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<FamilyMember | null>(null);

  const [nowMs] = useState(() => Date.now());

  const family = myFamilyData?.family;
  const currentMember = myFamilyData?.currentMember;
  const isOwner = currentMember?.role === "owner";
  const members = myFamilyData?.members ?? [];
  const invites = myFamilyData?.invites ?? [];

  const { data: incomeSuggestions } = useFamilyIncomeRatioSuggestion(
    family?.id,
    3,
    { enabled: Boolean(family) },
  );

  // Sincroniza estado inicial com initialTab ao abrir
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setActiveTab(initialTab);
    }
  }

  // Sincroniza formulários ao carregar dados quando não estão sujos
  const [syncedFamilyId, setSyncedFamilyId] = useState<string | null>(null);
  if (family && family.id !== syncedFamilyId && !isFamilyDirty) {
    setSyncedFamilyId(family.id);
    setEditName(family.name);
    setEditBudgetCents(family.monthly_budget ?? null);
    setEditSplitRule(family.split_rule);
  }

  const [syncedMemberId, setSyncedMemberId] = useState<string | null>(null);
  if (currentMember && currentMember.id !== syncedMemberId && !isMemberDirty) {
    setSyncedMemberId(currentMember.id);
    setMemberDisplayName(currentMember.display_name || "");
    setMemberPixKeyType(currentMember.pix_key_type || "cpf");
    setMemberPixKey(currentMember.pix_key || "");
    setMemberSplitRatioPercent(
      Math.round((currentMember.split_ratio ?? 0.5) * 100),
    );
  }

  const pendingInvites = invites.filter((inv) => {
    if (inv.status !== "pending") return false;
    if (!inv.expires_at) return true;
    return new Date(inv.expires_at).getTime() > nowMs;
  });

  const handleSaveFamilyParams = async (e: FormEvent) => {
    e.preventDefault();
    if (!family) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      pushToast({
        title: "Nome obrigatório",
        description: "O nome da casa não pode ficar vazio.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateFamilyMutation.mutateAsync({
        familyId: family.id,
        updates: {
          name: cleanName,
          monthly_budget: editBudgetCents && editBudgetCents > 0 ? editBudgetCents : null,
          split_rule: editSplitRule,
        },
      });
      setIsFamilyDirty(false);
      triggerSensory("success");
      pushToast({
        title: "Parâmetros da casa salvos",
        description: "As configurações foram atualizadas com sucesso.",
        variant: "success",
      });
    } catch {
      // Toast gerenciado pela mutation
    }
  };

  const handleSaveMemberPix = async (e: FormEvent) => {
    e.preventDefault();
    if (!family || !currentMember) return;

    try {
      await updateMemberMutation.mutateAsync({
        memberId: currentMember.id,
        updates: {
          display_name: memberDisplayName.trim() || undefined,
          pix_key: memberPixKey.trim() || null,
          pix_key_type: memberPixKey.trim() ? memberPixKeyType : null,
          split_ratio:
            editSplitRule === "proportional"
              ? Number((memberSplitRatioPercent / 100).toFixed(4))
              : undefined,
        },
      });
      setIsMemberDirty(false);
      triggerSensory("success");
      pushToast({
        title: "Dados atualizados",
        description: "Suas informações de Pix e contribuição foram salvas.",
        variant: "success",
      });
    } catch {
      // Toast gerenciado pela mutation
    }
  };

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!family) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) {
      pushToast({
        title: "Informe o e-mail",
        description: "Digite o endereço de e-mail do participante a ser convidado.",
        variant: "destructive",
      });
      return;
    }

    try {
      const invite = await inviteMemberMutation.mutateAsync({
        familyId: family.id,
        invitedEmail: cleanEmail,
      });

      const url = getPublicAppUrl(`convite-familiar/${invite.token}`);
      setGeneratedInviteUrl(url);
      setInviteEmail("");
      triggerSensory("success");
      pushToast({
        title: "Convite gerado com sucesso!",
        description: "Envie o link ou solicite a leitura do QR Code pelo seu parceiro.",
        variant: "success",
      });
    } catch {
      // Toast gerenciado pela mutation
    }
  };

  const handleCopyLink = async (url: string, token: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedToken(token);
      triggerSensory("success");
      pushToast({
        title: "Link de convite copiado!",
        description: "Pronto para enviar por WhatsApp ou mensagem.",
        variant: "default",
      });
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      pushToast({
        title: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !family) return;
    try {
      await removeFamilyMemberMutation.mutateAsync({
        familyId: family.id,
        targetUserId: memberToRemove.user_id,
      });
      setMemberToRemove(null);
      triggerSensory("destructive");
      pushToast({
        title: "Participante removido",
        description: "O membro foi desvinculado da casa com Zero Data Bleed.",
        variant: "default",
      });
    } catch {
      // Toast gerenciado pela mutation
    }
  };

  const handleConfirmLeaveFamily = async () => {
    try {
      await leaveFamilyMutation.mutateAsync(undefined);
      setIsLeaveModalOpen(false);
      onOpenChange(false);
      triggerSensory("action");
      pushToast({
        title: "Você saiu da família",
        description: "Sua conta foi desvinculada. Suas finanças particulares permanecem intactas.",
        variant: "default",
      });
    } catch {
      // Toast gerenciado pela mutation
    }
  };

  const handleConfirmDeleteFamily = async () => {
    if (!family) return;
    try {
      await deleteFamilyMutation.mutateAsync(family.id);
      setIsDeleteModalOpen(false);
      onOpenChange(false);
      triggerSensory("destructive");
      pushToast({
        title: "Família excluída",
        description: "A unidade familiar foi encerrada com sucesso.",
        variant: "default",
      });
    } catch {
      // Toast gerenciado pela mutation
    }
  };

  const tabItems = [
    {
      value: "general",
      label: isOwner ? "Regras da Casa" : "Visão das Regras",
      icon: <Settings className="size-4" />,
      content: (
        <div className="space-y-4 pt-2">
          {/* Card de Regras Globais */}
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>Parâmetros do Orçamento Doméstico</span>
                </span>
                <Badge variant={isOwner ? "default" : "muted"} size="xs">
                  {isOwner ? "Anfitrião / Titular" : "Participante (Leitura)"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isOwner ? (
                <form onSubmit={handleSaveFamilyParams} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="family-settings-name" className="text-xs font-semibold text-foreground">
                        Nome da Família / Casa
                      </label>
                      <Input
                        id="family-settings-name"
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          setIsFamilyDirty(true);
                        }}
                        required
                        className="h-10 text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="family-settings-budget" className="text-xs font-semibold text-foreground">
                        Teto Mensal Planejado (R$)
                      </label>
                      <MoneyInput
                        id="family-settings-budget"
                        cents={editBudgetCents ?? 0}
                        onCentsChange={(cents) => {
                          setEditBudgetCents(cents > 0 ? cents : null);
                          setIsFamilyDirty(true);
                        }}
                        placeholder="Ex: R$ 6.000,00"
                        className="h-10 text-sm rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Regra de Divisão dos Gastos
                    </label>
                    <Select
                      value={editSplitRule}
                      onValueChange={(val) => {
                        setEditSplitRule(val as FamilySplitRule);
                        setIsFamilyDirty(true);
                      }}
                      options={SPLIT_RULE_OPTIONS}
                      aria-label="Regra de rateio familiar"
                      className="h-10 text-sm rounded-xl"
                    />
                    <span className="text-[11px] text-muted-foreground block leading-relaxed">
                      {editSplitRule === "combined" &&
                        "Caixa Único: Orçamento e despesas consolidados sem cálculo de rateios ou dívidas individuais."}
                      {editSplitRule === "equal" &&
                        "Divisão 50/50: Metade das despesas para cada um, com liquidação de diferenças via Pix."}
                      {editSplitRule === "proportional" &&
                        "Proporcional: Divisão calculada com base na renda declarada ou percentual de cada participante."}
                    </span>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={!isFamilyDirty || updateFamilyMutation.isPending}
                      className="gap-2 rounded-xl cursor-pointer"
                    >
                      {updateFamilyMutation.isPending ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          <span>Salvando…</span>
                        </>
                      ) : (
                        <span>Salvar Parâmetros</span>
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Nome do Lar</span>
                    <span className="text-sm font-semibold text-foreground block">{family?.name}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Teto Mensal</span>
                    <MoneyText cents={family?.monthly_budget ?? 0} className="text-sm font-semibold text-foreground block" />
                  </div>
                  <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                    <span className="text-[11px] text-muted-foreground block">Modelo de Rateio</span>
                    <span className="text-sm font-semibold text-foreground block">
                      {family?.split_rule === "combined"
                        ? "Caixa Único"
                        : family?.split_rule === "equal"
                          ? "50% / 50%"
                          : "Proporcional"}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Link Público do Orçamento Familiar (apenas titular) */}
          {isOwner && <FamilyBudgetShareCard />}
        </div>
      ),
    },
    {
      value: "pix",
      label: "Meus Dados & Pix",
      icon: <KeyRound className="size-4" />,
      content: (
        <div className="space-y-4 pt-2">
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>Meus Dados na Família</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Configuração pessoal de cada membro
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveMemberPix} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="member-display-name" className="text-xs font-semibold text-foreground">
                      Meu nome de exibição no grupo
                    </label>
                    <Input
                      id="member-display-name"
                      value={memberDisplayName}
                      onChange={(e) => {
                        setMemberDisplayName(e.target.value);
                        setIsMemberDirty(true);
                      }}
                      placeholder="Ex: Amor, Pai, Gabriel"
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Tipo de Chave Pix
                    </label>
                    <Select
                      value={memberPixKeyType}
                      onValueChange={(val) => {
                        setMemberPixKeyType(val as FamilyPixKeyType);
                        setIsMemberDirty(true);
                      }}
                      options={PIX_KEY_OPTIONS}
                      aria-label="Tipo de Chave Pix"
                      className="h-10 text-sm rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="member-pix-key" className="text-xs font-semibold text-foreground">
                    Sua Chave Pix para recebimento de rateios
                  </label>
                  <Input
                    id="member-pix-key"
                    value={memberPixKey}
                    onChange={(e) => {
                      setMemberPixKey(e.target.value);
                      setIsMemberDirty(true);
                    }}
                    placeholder="Informe a chave Pix (CPF, e-mail ou telefone)"
                    className="h-10 text-sm rounded-xl"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    Utilizada quando o outro membro fizer o acerto mensal de despesas via Pix.
                  </span>
                </div>

                {family?.split_rule === "proportional" && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Minha cota de participação na casa
                      </label>
                      <span className="text-xs font-bold text-foreground">
                        {memberSplitRatioPercent}%
                      </span>
                    </div>
                    <PercentInput
                      value={memberSplitRatioPercent}
                      onValueChange={(val) => {
                        setMemberSplitRatioPercent(val);
                        setIsMemberDirty(true);
                      }}
                      className="h-10 text-sm rounded-xl"
                    />
                    {(() => {
                      const mySuggestion = incomeSuggestions?.find((s) => s.user_id === currentMember?.user_id);
                      if (!mySuggestion) return null;
                      return (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio text-xs">
                          <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            Sugestão baseada na renda dos últimos meses:{" "}
                            <strong>{Math.round(mySuggestion.suggested_percentage)}%</strong>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={!isMemberDirty || updateMemberMutation.isPending}
                    className="gap-2 rounded-xl cursor-pointer"
                  >
                    {updateMemberMutation.isPending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        <span>Salvando…</span>
                      </>
                    ) : (
                      <span>Salvar Meus Dados</span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "members",
      label: `Membros (${members.length})`,
      icon: <Users className="size-4" />,
      content: (
        <div className="space-y-4 pt-2">
          {/* Lista de Membros Ativos */}
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Participantes da Casa</span>
                <Badge variant="muted" size="xs">
                  {members.length} de 6 membros
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {members.map((m) => {
                const isMemberOwner = m.role === "owner";
                const isSelf = m.user_id === currentMember?.user_id;

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
                        {isSelf && (
                          <Badge variant="default" size="xs">
                            Você
                          </Badge>
                        )}
                        <Badge variant={isMemberOwner ? "warning" : "muted"} size="xs">
                          {isMemberOwner ? "Titular" : "Participante"}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {m.pix_key ? `Pix: ${m.pix_key}` : "Chave Pix não informada"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && !isMemberOwner && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setMemberToRemove(m)}
                          className="gap-1 text-critical-strong hover:bg-critical/10 rounded-lg cursor-pointer"
                        >
                          <UserMinus className="size-3.5" aria-hidden="true" />
                          <span>Remover</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Seção de Convidar Novo Membro (Exclusiva do Titular) */}
          {isOwner && members.length < 6 && (
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UserPlus className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span>Convidar Familiar ou Parceiro</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="E-mail do participante"
                    required
                    className="h-10 text-sm rounded-xl flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={inviteMemberMutation.isPending || !inviteEmail.trim()}
                    className="gap-1.5 rounded-xl shrink-0 cursor-pointer"
                  >
                    {inviteMemberMutation.isPending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        <span>Gerando…</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="size-3.5" aria-hidden="true" />
                        <span>Gerar Convite</span>
                      </>
                    )}
                  </Button>
                </form>

                {generatedInviteUrl && (
                  <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
                    <span className="text-xs font-semibold text-foreground block">
                      Link de convite gerado:
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={generatedInviteUrl}
                        className="h-9 text-xs font-mono bg-surface rounded-lg select-all"
                      />
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => handleCopyLink(generatedInviteUrl, "direct")}
                        className="gap-1.5 h-9 px-3 rounded-lg cursor-pointer shrink-0"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        <span>Copiar</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQrCode(!showQrCode)}
                        className="h-9 px-3 rounded-lg cursor-pointer shrink-0"
                        title="Exibir QR Code"
                      >
                        <QrCode className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>

                    {showQrCode && (
                      <div className="pt-2 flex flex-col items-center gap-2">
                        <QrCodeCanvas
                          text={generatedInviteUrl}
                          size={144}
                          label="QR Code do convite familiar"
                          className="size-36 rounded-xl"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          Aponte a câmera do celular para aceitar o convite
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Convites Pendentes */}
                {pendingInvites.length > 0 && (
                  <div className="pt-3 border-t border-border/60 space-y-2">
                    <span className="text-xs font-semibold text-foreground block">
                      Convites Pendentes ({pendingInvites.length})
                    </span>
                    <div className="space-y-2">
                      {pendingInvites.map((inv) => {
                        const url = getPublicAppUrl(`convite-familiar/${inv.token}`);

                        return (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/80 bg-muted/20 text-xs"
                          >
                            <span className="text-foreground truncate">{inv.invited_email ?? "Sem e-mail"}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => handleCopyLink(url, inv.token)}
                                className="gap-1 rounded-md cursor-pointer"
                              >
                                {copiedToken === inv.token ? (
                                  <Check className="size-3 text-positive-strong" aria-hidden="true" />
                                ) : (
                                  <Copy className="size-3" aria-hidden="true" />
                                )}
                                <span>Link</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => revokeInviteMutation.mutate(inv.id)}
                                disabled={revokeInviteMutation.isPending}
                                className="text-critical-strong hover:bg-critical/10 rounded-md cursor-pointer"
                                title="Revogar convite"
                              >
                                <Trash2 className="size-3" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Zona de Ações: Sair ou Excluir */}
          <div className="pt-3 border-t border-border/60 flex justify-end">
            {isOwner ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="gap-1.5 rounded-xl cursor-pointer"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span>Excluir Unidade Familiar</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLeaveModalOpen(true)}
                className="gap-1.5 text-critical-strong hover:bg-critical/10 border-critical/30 rounded-xl cursor-pointer"
              >
                <LogOut className="size-3.5" aria-hidden="true" />
                <span>Sair da Família</span>
              </Button>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Configurações da Família"
        description="Gestão de membros, parâmetros de rateio, chaves Pix e regras do lar."
        size="xl"
      >
        <div className="pt-1 pb-2">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            items={tabItems}
            variant="underline"
            className="w-full"
          />
        </div>
      </Modal>

      {/* Confirmação de Remoção de Membro */}
      <Modal
        open={Boolean(memberToRemove)}
        onOpenChange={(next) => {
          if (!next) setMemberToRemove(null);
        }}
        title="Remover Membro da Família"
        description={`Tem certeza de que deseja remover ${
          memberToRemove?.display_name || "este participante"
        } da unidade familiar?`}
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            O participante deixará de acessar o extrato consolidado do lar. Suas contas, despesas e dados pessoais permanecem 100% seguros e intactos (Zero Data Bleed).
          </p>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={removeFamilyMemberMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRemoveMember}
              disabled={removeFamilyMemberMutation.isPending}
              className="gap-1.5 rounded-xl cursor-pointer"
            >
              {removeFamilyMemberMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Removendo…</span>
                </>
              ) : (
                <span>Confirmar Remoção</span>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Confirmação de Saída da Família */}
      <Modal
        open={isLeaveModalOpen}
        onOpenChange={setIsLeaveModalOpen}
        title="Sair da Família"
        description="Deseja realmente desvincular sua conta desta unidade familiar?"
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Você deixará de visualizar os gastos consolidados do lar. Todas as suas contas bancárias, cartões e despesas particulares continuarão salvas na sua conta.
          </p>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLeaveModalOpen(false)}
              disabled={leaveFamilyMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmLeaveFamily}
              disabled={leaveFamilyMutation.isPending}
              className="gap-1.5 rounded-xl cursor-pointer"
            >
              {leaveFamilyMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Saindo…</span>
                </>
              ) : (
                <span>Confirmar Saída</span>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Confirmação de Exclusão da Família */}
      <Modal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Excluir Unidade Familiar"
        description="Esta ação é irreversível e desfaz o vínculo entre todos os participantes."
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            O grupo familiar será excluído permanentemente. Nenhum dado financeiro pessoal ou lançamento particular de qualquer membro será apagado.
          </p>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleteFamilyMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDeleteFamily}
              disabled={deleteFamilyMutation.isPending}
              className="gap-1.5 rounded-xl cursor-pointer"
            >
              {deleteFamilyMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Excluindo…</span>
                </>
              ) : (
                <span>Confirmar Exclusão</span>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </>
  );
}
