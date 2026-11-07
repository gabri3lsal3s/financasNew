import { useState } from "react";
import type { FormEvent } from "react";
import {
  Users,
  Plus,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  Loader2,
  Clock,
  QrCode,
  LogOut,
  Edit3,
  Sparkles,
  UserMinus,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  MoneyInput,
  PercentInput,
  Select,
  type SelectOption,
  Modal,
  ModalFooter,
  MoneyText,
  Skeleton,
  ErrorState,
} from "@/components/ui";
import {
  useMyFamily,
  useCreateFamily,
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
import { getErrorMessage } from "@/services/errors";
import { getPublicAppUrl } from "@/services/app-url";
import { FamilyBudgetShareCard } from "./family-budget-share-card";
import type {
  FamilyPixKeyType,
  FamilySplitRule,
  FamilyInvite,
  FamilyMember,
} from "@/types";

const FAMILY_PIX_KEY_LABELS: Record<FamilyPixKeyType, string> = {
  cpf: "CPF",
  email: "E-mail",
  phone: "Telefone / Celular",
  random: "Chave Aleatória",
};

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

function formatInviteExpiration(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "7 dias";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FamilyTab() {
  const { data: myFamilyData, isLoading, isError, error, refetch } = useMyFamily();

  const createFamilyMutation = useCreateFamily();
  const inviteMemberMutation = useInviteFamilyMember();
  const revokeInviteMutation = useRevokeFamilyInvite();
  const leaveFamilyMutation = useLeaveFamily();
  const deleteFamilyMutation = useDeleteFamily();
  const removeFamilyMemberMutation = useRemoveFamilyMember();
  const updateFamilyMutation = useUpdateFamily();
  const updateMemberMutation = useUpdateFamilyMember();

  const { data: incomeSuggestions } = useFamilyIncomeRatioSuggestion(
    myFamilyData?.family?.id,
    3,
    { enabled: Boolean(myFamilyData?.family) },
  );

  // Modais de Criação e Gestão
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBudgetCents, setCreateBudgetCents] = useState<number | null>(null);
  const [createSplitRule, setCreateSplitRule] = useState<FamilySplitRule>("combined");

  // Edição dos Parâmetros da Família
  const [isEditFamilyModalOpen, setIsEditFamilyModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBudgetCents, setEditBudgetCents] = useState<number | null>(null);
  const [editSplitRule, setEditSplitRule] = useState<FamilySplitRule>("combined");

  // Edição dos Dados Pix do Usuário Autenticado
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberPixKeyType, setMemberPixKeyType] = useState<FamilyPixKeyType>("cpf");
  const [memberPixKey, setMemberPixKey] = useState("");
  const [memberSplitRatioPercent, setMemberSplitRatioPercent] = useState<number>(50);

  // Convite para Familiar
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);

  // Confirmações
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [inviteToRevoke, setInviteToRevoke] = useState<FamilyInvite | null>(null);
  const [isLeaveFamilyModalOpen, setIsLeaveFamilyModalOpen] = useState(false);
  const [isDeleteFamilyModalOpen, setIsDeleteFamilyModalOpen] = useState(false);
  const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<FamilyMember | null>(null);

  // Feedback de Cópia
  const [copiedInviteToken, setCopiedInviteToken] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  const handleCopyInviteUrl = async (token: string) => {
    const url = getPublicAppUrl(`convite-familiar/${token}`);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedInviteToken(token);
      triggerSensory("success");
      pushToast({
        title: "Link de convite copiado!",
        description: "Envie para o seu parceiro(a) para vincular a conta em 1 clique.",
        variant: "default",
      });
      setTimeout(() => setCopiedInviteToken(null), 2500);
    } catch {
      pushToast({
        title: "Não foi possível copiar o link de convite",
        variant: "destructive",
      });
    }
  };

  const handleCopyPixKey = async (pixKey: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixKey);
      }
      setCopiedPix(pixKey);
      triggerSensory("success");
      pushToast({
        title: "Chave Pix copiada!",
        description: "Pronto para colar no aplicativo do seu banco.",
        variant: "default",
      });
      setTimeout(() => setCopiedPix(null), 2500);
    } catch {
      pushToast({
        title: "Não foi possível copiar a chave Pix",
        variant: "destructive",
      });
    }
  };

  const handleCreateFamily = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = createName.trim();
    if (!trimmed) {
      pushToast({
        title: "Informe o nome da família",
        variant: "destructive",
      });
      return;
    }

    try {
      await createFamilyMutation.mutateAsync({
        name: trimmed,
        monthlyBudget: createBudgetCents && createBudgetCents > 0 ? createBudgetCents : null,
        splitRule: createSplitRule,
      });
      setIsCreateModalOpen(false);
      setCreateName("");
      setCreateBudgetCents(null);
      setCreateSplitRule("equal");
    } catch {
      // toast de erro tratado na mutation
    }
  };

  const handleOpenEditFamily = () => {
    if (!myFamilyData?.family) return;
    setEditName(myFamilyData.family.name);
    setEditBudgetCents(myFamilyData.family.monthly_budget ?? null);
    setEditSplitRule(myFamilyData.family.split_rule);
    setIsEditFamilyModalOpen(true);
  };

  const handleSaveFamily = async (e: FormEvent) => {
    e.preventDefault();
    if (!myFamilyData?.family) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      pushToast({
        title: "O nome da família não pode ficar vazio",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateFamilyMutation.mutateAsync({
        familyId: myFamilyData.family.id,
        updates: {
          name: trimmed,
          monthly_budget: editBudgetCents && editBudgetCents > 0 ? editBudgetCents : null,
          split_rule: editSplitRule,
        },
      });
      setIsEditFamilyModalOpen(false);
    } catch {
      // toast tratado na mutation
    }
  };

  const handleOpenEditMember = () => {
    if (!myFamilyData?.currentMember) return;
    const cm = myFamilyData.currentMember;
    setMemberDisplayName(cm.display_name ?? "");
    setMemberPixKeyType(cm.pix_key_type ?? "cpf");
    setMemberPixKey(cm.pix_key ?? "");
    setMemberSplitRatioPercent(
      cm.split_ratio != null ? Math.round(cm.split_ratio * 100) : 50,
    );
    setIsEditMemberModalOpen(true);
  };

  const handleSaveMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!myFamilyData?.currentMember) return;
    const cm = myFamilyData.currentMember;

    try {
      await updateMemberMutation.mutateAsync({
        memberId: cm.id,
        updates: {
          display_name: memberDisplayName.trim() || null,
          pix_key: memberPixKey.trim() || null,
          pix_key_type: memberPixKey.trim() ? memberPixKeyType : null,
          split_ratio:
            myFamilyData.family.split_rule === "proportional"
              ? memberSplitRatioPercent / 100
              : null,
        },
      });
      setIsEditMemberModalOpen(false);
    } catch {
      // toast tratado na mutation
    }
  };

  const handleInvitePartner = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const result = await inviteMemberMutation.mutateAsync({
        invitedEmail: inviteEmail.trim() || null,
        role: "member",
      });
      const inviteUrl = getPublicAppUrl(`convite-familiar/${result.token}`);
      setGeneratedInviteUrl(inviteUrl);
      setInviteEmail("");
    } catch {
      // toast tratado na mutation
    }
  };

  const handleConfirmRevokeInvite = async () => {
    if (!inviteToRevoke) return;
    try {
      await revokeInviteMutation.mutateAsync(inviteToRevoke.id);
      setIsRevokeModalOpen(false);
      setInviteToRevoke(null);
    } catch {
      // toast tratado na mutation
    }
  };

  const handleConfirmLeaveFamily = async () => {
    try {
      await leaveFamilyMutation.mutateAsync(undefined);
      setIsLeaveFamilyModalOpen(false);
    } catch {
      // toast tratado na mutation
    }
  };

  const handleConfirmDeleteFamily = async () => {
    if (!myFamilyData?.family) return;
    try {
      await deleteFamilyMutation.mutateAsync(myFamilyData.family.id);
      setIsDeleteFamilyModalOpen(false);
    } catch {
      // toast tratado na mutation
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !myFamilyData?.family) return;
    try {
      await removeFamilyMemberMutation.mutateAsync({
        familyId: myFamilyData.family.id,
        targetUserId: memberToRemove.user_id,
      });
      setIsRemoveMemberModalOpen(false);
      setMemberToRemove(null);
    } catch {
      // toast tratado na mutation
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="family-tab-loading">
        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
            </div>
            <Skeleton className="h-4 w-72 rounded mt-1" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={getErrorMessage(error)}
        onRetry={() => void refetch()}
      />
    );
  }

  // Estado: Sem família ativa
  if (!myFamilyData) {
    return (
      <div className="space-y-6" data-testid="family-tab-empty">
        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader>
            <CardTitle className="text-base flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Orçamento Familiar &amp; Casal</span>
              </span>
              <Badge variant="muted" size="xs">
                Sem Família Ativa
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Planeje as finanças do lar em conjunto com seu parceiro(a). Cada conta mantém seus dados bancários e lançamentos particulares 100% protegidos, compartilhando apenas os gastos atribuídos ao lar.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground block">
                  Criar Unidade Familiar
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Defina o nome da casa, teto mensal planejado e convide seu parceiro para participar com conta própria.
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="gap-1.5 text-xs font-semibold rounded-xl shrink-0 cursor-pointer shadow-xs"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Criar Família</span>
              </Button>
            </div>

            <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border/80 bg-surface text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 mt-0.5 text-positive-strong" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed">
                <strong className="text-foreground font-semibold">Privacidade Absoluta (Zero Data Bleed):</strong> Suas contas bancárias, cartões de crédito e despesas particulares nunca são expostos entre as contas. Somente as despesas que você marcar como do lar são consolidadas no Orçamento Familiar.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Link público passivo de leitura (somente leitura sem login) */}
        <FamilyBudgetShareCard />

        {/* Modal: Criar Família */}
        <Modal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          title="Criar Orçamento Familiar"
          description="Configure o ecossistema doméstico para planejar as despesas a dois."
          size="md"
        >
          <form onSubmit={handleCreateFamily} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="create-family-name" className="text-xs font-semibold text-foreground">
                Nome da Família / Casa
              </label>
              <Input
                id="create-family-name"
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Ex: Família Silva ou Casa &amp; Casal"
                className="h-10 text-base sm:text-sm rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-family-budget" className="text-xs font-semibold text-foreground">
                Teto mensal compartilhado <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <MoneyInput
                id="create-family-budget"
                cents={createBudgetCents ?? 0}
                onCentsChange={(cents) => setCreateBudgetCents(cents > 0 ? cents : null)}
                placeholder="Ex: R$ 5.000,00"
                className="h-10 text-sm rounded-xl"
              />
              <span className="text-[11px] text-muted-foreground block">
                Meta global de gastos do lar para acompanhamento em conjunto.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Regra de divisão dos gastos do lar
              </label>
              <Select
                value={createSplitRule}
                onValueChange={(val) => setCreateSplitRule(val as FamilySplitRule)}
                options={SPLIT_RULE_OPTIONS}
                ariaLabel="Regra de divisão dos gastos"
              />
              <span className="text-[11px] text-muted-foreground block">
                Define a base de cálculo para o acerto mensal entre o casal via Pix.
              </span>
            </div>

            <ModalFooter className="mt-4 pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createFamilyMutation.isPending}
                className="rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createFamilyMutation.isPending || !createName.trim()}
                className="rounded-xl cursor-pointer"
              >
                {createFamilyMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                    <span>Criando…</span>
                  </>
                ) : (
                  <span>Criar Família</span>
                )}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      </div>
    );
  }

  // Estado: Com família ativa
  const { family, members, currentMember, invites } = myFamilyData;
  const isOwner = currentMember.role === "owner";

  const pendingInvites = invites.filter((inv) => {
    if (inv.status !== "pending") return false;
    if (!inv.expires_at) return true;
    return new Date(inv.expires_at).getTime() > nowMs;
  });

  return (
    <div className="space-y-6" data-testid="family-tab-content">
      {/* Card 1: Unidade Familiar & Teto Compartilhado */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>{family.name}</span>
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={isOwner ? "default" : "muted"} size="xs">
                {isOwner ? "Titular" : "Membro"}
              </Badge>
              <Badge variant="muted" size="xs">
                {family.split_rule === "equal" ? "Divisão 50/50" : "Proporcional"}
              </Badge>
              {isOwner && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleOpenEditFamily}
                  className="gap-1 border-border/80 bg-surface rounded-lg cursor-pointer ml-1"
                >
                  <Edit3 className="size-3 text-muted-foreground" aria-hidden="true" />
                  <span>Editar Parâmetros</span>
                </Button>
              )}
            </div>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Parâmetros globais do orçamento do lar compartilhados entre os parceiros.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Teto Mensal da Casa
              </span>
              {family.monthly_budget && family.monthly_budget > 0 ? (
                <MoneyText
                  cents={family.monthly_budget}
                  className="text-base font-semibold text-foreground tracking-tight whitespace-nowrap block"
                />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground block">
                  Não definido
                </span>
              )}
            </div>

            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Regra de Compensação
              </span>
              <span className="text-sm font-semibold text-foreground block truncate">
                {family.split_rule === "equal" ? "Divisão Igualitária (50/50)" : "Proporcional à Renda"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Participantes
              </span>
              <span className="text-sm font-semibold text-foreground block">
                {members.length} {members.length === 1 ? "membro ativo" : "membros ativos"}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-border/80 bg-surface text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 mt-0.5 text-positive-strong" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed">
              <strong className="text-foreground font-semibold">Isolamento Seguro:</strong> Marque lançamentos como &ldquo;Familiar&rdquo; para que eles apareçam no painel da casa em <span className="font-mono text-foreground font-medium">/familia</span>. Suas contas bancárias, cartões e despesas particulares permanecem estritamente privadas.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Membros da Casa & Meus Dados Pix */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Membros da Casa</span>
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="muted" size="xs">
                {members.length} de 6 membros
              </Badge>
              {isOwner && (
                <Button
                  type="button"
                  variant="default"
                  size="xs"
                  disabled={members.length >= 6}
                  onClick={() => {
                    setGeneratedInviteUrl(null);
                    setInviteEmail("");
                    setIsInviteModalOpen(true);
                  }}
                  className="gap-1 rounded-lg cursor-pointer shadow-xs ml-1"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  <span>{members.length >= 6 ? "Limite Atingido (6/6)" : "Convidar Membro"}</span>
                </Button>
              )}
            </div>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Membros com acesso à consolidação do lar e chaves Pix para acerto de contas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {members.map((member) => {
              const isMe = member.user_id === currentMember.user_id;
              const displayName =
                member.display_name ||
                member.profile_name ||
                member.profile_email ||
                "Participante";
              const roleLabel =
                member.role === "owner" ? "Titular" : member.role === "admin" ? "Admin" : "Membro";
              const pixLabel = member.pix_key_type
                ? FAMILY_PIX_KEY_LABELS[member.pix_key_type] ?? "Pix"
                : "Pix";

              return (
                <div
                  key={member.id}
                  className="p-3.5 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">
                        {displayName}
                      </span>
                      {isMe && (
                        <Badge variant="positive" size="xs">
                          Você
                        </Badge>
                      )}
                      <Badge
                        variant={member.role === "owner" ? "default" : "muted"}
                        size="xs"
                      >
                        {roleLabel}
                      </Badge>
                      {family.split_rule === "proportional" && (
                        <Badge variant="muted" size="xs">
                          Cota:{" "}
                          {member.split_ratio
                            ? `${Math.round(member.split_ratio * 100)}%`
                            : "50%"}
                        </Badge>
                      )}
                    </div>
                    {member.profile_email && (
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {member.profile_email}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                      <QrCode className="size-3 shrink-0" aria-hidden="true" />
                      {member.pix_key ? (
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{pixLabel}:</span>
                          <span className="font-mono">{member.pix_key}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => handleCopyPixKey(member.pix_key!)}
                            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Copiar Chave Pix"
                          >
                            {copiedPix === member.pix_key ? (
                              <Check className="size-3 text-positive-strong" aria-hidden="true" />
                            ) : (
                              <Copy className="size-3" aria-hidden="true" />
                            )}
                          </Button>
                        </span>
                      ) : (
                        <span className="italic">Chave Pix não cadastrada</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                    {isMe && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={handleOpenEditMember}
                        className="text-xs border-border/80 bg-surface rounded-lg cursor-pointer"
                      >
                        <Edit3 className="size-3 mr-1" aria-hidden="true" />
                        <span>Editar Meus Dados Pix</span>
                      </Button>
                    )}

                    {!isMe && isOwner && (
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setMemberToRemove(member);
                          setIsRemoveMemberModalOpen(true);
                        }}
                        className="text-xs border-border/80 bg-surface text-critical-strong hover:bg-critical/10 hover:border-critical/30 rounded-lg cursor-pointer"
                        aria-label={`Remover ${displayName} da família`}
                      >
                        <UserMinus className="size-3 mr-1" aria-hidden="true" />
                        <span>Remover</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seção de Convites Pendentes */}
          {pendingInvites.length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-warning-strong" aria-hidden="true" />
                <span>Convites Pendentes de Aceite</span>
              </span>
              {pendingInvites.map((invite) => {
                const inviteUrl = getPublicAppUrl(`convite-familiar/${invite.token}`);
                const isCopied = copiedInviteToken === invite.token;

                return (
                  <div
                    key={invite.id}
                    className="p-3.5 rounded-xl border border-warning/30 bg-warning/5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground">
                        {invite.invited_email ? `Convite para ${invite.invited_email}` : "Convite por link direto"}
                      </span>
                      <Badge variant="warning" size="xs">
                        Aguardando Parceiro
                      </Badge>
                    </div>

                    <div className="relative flex items-center gap-2">
                      <Input
                        type="text"
                        readOnly
                        value={inviteUrl}
                        className="h-8 text-xs font-mono select-all bg-surface border-border/80"
                        aria-label="Link de convite para parceiro"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => handleCopyInviteUrl(invite.token)}
                        className="h-8 gap-1 border-border/80 bg-surface shrink-0 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="size-3 text-positive-strong" aria-hidden="true" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3 text-muted-foreground" aria-hidden="true" />
                            <span>Copiar</span>
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>Expira em {formatInviteExpiration(invite.expires_at)}</span>
                      {isOwner && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setInviteToRevoke(invite);
                            setIsRevokeModalOpen(true);
                          }}
                          className="h-6 text-critical-strong hover:bg-critical/10 hover:text-critical-strong px-2 cursor-pointer"
                        >
                          <Trash2 className="size-3 mr-1" aria-hidden="true" />
                          <span>Revogar</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Banner calmo quando for o único membro e sem convites pendentes */}
          {pendingInvites.length === 0 && members.length === 1 && isOwner && (
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground block">
                  Nenhum parceiro vinculado ainda
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Gere um convite seguro de 7 dias para que seu parceiro participe do orçamento doméstico.
                </span>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  setGeneratedInviteUrl(null);
                  setInviteEmail("");
                  setIsInviteModalOpen(true);
                }}
                className="gap-1.5 text-xs font-semibold rounded-xl shrink-0 cursor-pointer shadow-xs"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Gerar Convite de Acesso</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 3: Link Público Passivo Opcional (Somente Leitura) */}
      <FamilyBudgetShareCard />

      {/* Card 4: Gestão da Unidade & Sair/Excluir Família */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {isOwner ? (
              <>
                <Trash2 className="size-4 text-critical" aria-hidden="true" />
                <span>Excluir Unidade Familiar</span>
              </>
            ) : (
              <>
                <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Sair da Família</span>
              </>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {isOwner
              ? "Como titular, você pode excluir a família a qualquer momento. A unidade será encerrada para todos os participantes. Suas contas bancárias, cartões, despesas e receitas particulares continuam 100% protegidos e intactos na sua conta pessoal."
              : "Ao sair da família, suas contas bancárias, cartões, despesas e receitas continuam 100% protegidos e privados na sua conta pessoal. Você apenas deixará de visualizar os gastos consolidados da casa."}
          </p>
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteFamilyModalOpen(true)}
              className="rounded-xl cursor-pointer"
            >
              <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
              <span>Excluir Família</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsLeaveFamilyModalOpen(true)}
              className="rounded-xl cursor-pointer"
            >
              <LogOut className="size-3.5 mr-1.5" aria-hidden="true" />
              <span>Sair da Família</span>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Modal: Editar Parâmetros da Família */}
      <Modal
        open={isEditFamilyModalOpen}
        onOpenChange={setIsEditFamilyModalOpen}
        title="Editar Parâmetros da Família"
        description="Atualize o nome, teto orçamentário ou regra de divisão da casa."
        size="md"
      >
        <form onSubmit={handleSaveFamily} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="edit-family-name" className="text-xs font-semibold text-foreground">
              Nome da Família / Casa
            </label>
            <Input
              id="edit-family-name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-10 text-sm rounded-xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-family-budget" className="text-xs font-semibold text-foreground">
              Teto mensal compartilhado <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <MoneyInput
              id="edit-family-budget"
              cents={editBudgetCents ?? 0}
              onCentsChange={(cents) => setEditBudgetCents(cents > 0 ? cents : null)}
              placeholder="Ex: R$ 5.000,00"
              className="h-10 text-sm rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Regra de divisão dos gastos do lar
            </label>
            <Select
              value={editSplitRule}
              onValueChange={(val) => setEditSplitRule(val as FamilySplitRule)}
              options={SPLIT_RULE_OPTIONS}
              ariaLabel="Regra de divisão dos gastos"
            />
          </div>

          <ModalFooter className="mt-4 pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditFamilyModalOpen(false)}
              disabled={updateFamilyMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateFamilyMutation.isPending || !editName.trim()}
              className="rounded-xl cursor-pointer"
            >
              {updateFamilyMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Salvando…</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal: Editar Meus Dados Pix */}
      <Modal
        open={isEditMemberModalOpen}
        onOpenChange={setIsEditMemberModalOpen}
        title="Meus Dados na Família"
        description="Configure seu nome de exibição e chave Pix para compensação rápida entre o casal."
        size="md"
      >
        <form onSubmit={handleSaveMember} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="member-display-name" className="text-xs font-semibold text-foreground">
              Nome de exibição <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Input
              id="member-display-name"
              type="text"
              value={memberDisplayName}
              onChange={(e) => setMemberDisplayName(e.target.value)}
              placeholder="Como seu parceiro te verá"
              className="h-10 text-sm rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground block">
              Tipo da Chave Pix
            </label>
            <Select
              value={memberPixKeyType}
              onValueChange={(val) => setMemberPixKeyType(val as FamilyPixKeyType)}
              options={PIX_KEY_OPTIONS}
              ariaLabel="Tipo da chave Pix"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="member-pix-key" className="text-xs font-semibold text-foreground">
              Chave Pix <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Input
              id="member-pix-key"
              type="text"
              value={memberPixKey}
              onChange={(e) => setMemberPixKey(e.target.value)}
              placeholder="Digite sua chave Pix"
              className="h-10 text-sm rounded-xl"
            />
            <span className="text-[11px] text-muted-foreground block">
              Utilizada para gerar o Pix Copia e Cola automático no acerto de contas mensal.
            </span>
          </div>

          {family.split_rule === "proportional" && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <label htmlFor="member-split-ratio" className="text-xs font-semibold text-foreground">
                  Cota proporcional de contribuição
                </label>
                <PercentInput
                  id="member-split-ratio"
                  value={memberSplitRatioPercent}
                  onValueChange={(val) => setMemberSplitRatioPercent(val)}
                  className="h-10 text-sm rounded-xl"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Percentual da despesa do lar atribuído à sua responsabilidade financeira.
                </span>
              </div>

              {/* Assistente Inteligente de Média de Receitas */}
              {incomeSuggestions && incomeSuggestions.length > 0 && (
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    <span>Sugestão Inteligente (média dos últimos 3 meses)</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    {incomeSuggestions.map((item) => (
                      <div key={item.user_id} className="flex justify-between items-center">
                        <span>{item.display_name}:</span>
                        <span className="font-medium text-foreground">
                          <MoneyText cents={item.average_monthly_income_cents} /> /mês ({item.suggested_percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const mySuggestion = incomeSuggestions.find((s) => s.user_id === currentMember?.user_id);
                    if (!mySuggestion) return null;
                    return (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMemberSplitRatioPercent(mySuggestion.suggested_percentage);
                          triggerSensory("toggle");
                        }}
                        className="w-full h-7 text-xs rounded-lg gap-1 border-primary/30 text-primary-strong hover:bg-primary/10 cursor-pointer"
                      >
                        <Sparkles className="size-3" aria-hidden="true" />
                        <span>Aplicar Sugestão ({mySuggestion.suggested_percentage}%)</span>
                      </Button>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          <ModalFooter className="mt-4 pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditMemberModalOpen(false)}
              disabled={updateMemberMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateMemberMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              {updateMemberMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Salvando…</span>
                </>
              ) : (
                <span>Salvar Dados</span>
              )}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal: Convidar Parceiro(a) */}
      <Modal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        title="Convidar Parceiro(a)"
        description="Gere um link seguro de 7 dias para que seu cônjuge vincule a conta dele."
        size="md"
      >
        <div className="space-y-4 pt-2">
          {generatedInviteUrl ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-positive/30 bg-positive/5 space-y-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                  <span>Link de convite gerado com sucesso!</span>
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Envie o link abaixo para seu parceiro(a). Ao abrir o link, ele poderá entrar ou criar sua conta e fazer parte da família em 1 toque.
                </p>
                <div className="relative flex items-center gap-2 pt-1">
                  <Input
                    type="text"
                    readOnly
                    value={generatedInviteUrl}
                    className="h-9 text-xs font-mono select-all bg-surface border-border/80"
                    aria-label="URL de convite gerada"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(generatedInviteUrl);
                        }
                        triggerSensory("success");
                        pushToast({
                          title: "Link copiado para a área de transferência!",
                          variant: "default",
                        });
                      } catch {
                        pushToast({
                          title: "Não foi possível copiar o link",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="gap-1 border-border/80 bg-surface shrink-0 cursor-pointer"
                  >
                    <Copy className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>Copiar</span>
                  </Button>
                </div>
              </div>

              <ModalFooter className="pt-3 border-t border-border/80">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    setIsInviteModalOpen(false);
                    setGeneratedInviteUrl(null);
                  }}
                  className="rounded-xl cursor-pointer"
                >
                  Concluir
                </Button>
              </ModalFooter>
            </div>
          ) : (
            <form onSubmit={handleInvitePartner} className="space-y-4">
              <div className="rounded-xl bg-muted/20 border border-border/80 p-3.5 space-y-1.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
                  <span>Acesso Seguro &amp; Restrito</span>
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O parceiro terá acesso apenas aos gastos marcados como &ldquo;Familiar&rdquo; e à compensação Pix do mês. Suas contas bancárias, cartões de crédito e despesas particulares continuam estritamente privados.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="invite-partner-email" className="text-xs font-semibold text-foreground">
                  E-mail do parceiro <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Input
                  id="invite-partner-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="parceiro@exemplo.com"
                  className="h-10 text-sm rounded-xl"
                />
                <span className="text-[11px] text-muted-foreground block">
                  Se informado, o convite será vinculado a este endereço. Se deixar em branco, qualquer parceiro com o link poderá aceitar.
                </span>
              </div>

              <ModalFooter className="mt-4 pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={inviteMemberMutation.isPending}
                  className="rounded-xl cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={inviteMemberMutation.isPending}
                  className="rounded-xl cursor-pointer"
                >
                  {inviteMemberMutation.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                      <span>Gerando Link…</span>
                    </>
                  ) : (
                    <span>Gerar Link de Convite</span>
                  )}
                </Button>
              </ModalFooter>
            </form>
          )}
        </div>
      </Modal>

      {/* Modal: Confirmar Revogação de Convite */}
      <Modal
        open={isRevokeModalOpen}
        onOpenChange={setIsRevokeModalOpen}
        title="Revogar Convite"
        description="Tem certeza de que deseja revogar este link de convite?"
        size="sm"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ao revogar, o link perderá a validade imediatamente e não poderá mais ser utilizado pelo parceiro.
          </p>

          <ModalFooter className="pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsRevokeModalOpen(false);
                setInviteToRevoke(null);
              }}
              disabled={revokeInviteMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRevokeInvite}
              disabled={revokeInviteMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              {revokeInviteMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Revogando…</span>
                </>
              ) : (
                <span>Confirmar Revogação</span>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Modal: Confirmar Saída da Família */}
      <Modal
        open={isLeaveFamilyModalOpen}
        onOpenChange={setIsLeaveFamilyModalOpen}
        title="Sair da Família"
        description="Tem certeza de que deseja deixar a unidade familiar?"
        size="sm"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Suas contas bancárias, cartões e despesas particulares continuarão completamente intactos na sua conta. Você apenas deixará de compartilhar a consolidação doméstica com este grupo.
          </p>

          <ModalFooter className="pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsLeaveFamilyModalOpen(false)}
              disabled={leaveFamilyMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmLeaveFamily}
              disabled={leaveFamilyMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              {leaveFamilyMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Saindo…</span>
                </>
              ) : (
                <span>Confirmar Saída</span>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Modal: Confirmar Exclusão da Família (Ação do Titular) */}
      <Modal
        open={isDeleteFamilyModalOpen}
        onOpenChange={setIsDeleteFamilyModalOpen}
        title="Excluir Família"
        description={`Tem certeza de que deseja excluir a família ${myFamilyData?.family?.name || ""}?`}
        size="sm"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            A unidade familiar será encerrada para todos os participantes. Seus lançamentos pessoais, contas bancárias e cartões permanecerão 100% seguros e intactos na sua conta. Apenas o vínculo e a visualização compartilhada serão desfeitos.
          </p>

          <ModalFooter className="pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteFamilyModalOpen(false)}
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
              className="rounded-xl cursor-pointer"
            >
              {deleteFamilyMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Excluindo…</span>
                </>
              ) : (
                <span>Confirmar Exclusão</span>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Modal: Confirmar Remoção de Membro (Ação Exclusiva do Titular) */}
      <Modal
        open={isRemoveMemberModalOpen}
        onOpenChange={(open) => {
          setIsRemoveMemberModalOpen(open);
          if (!open) setMemberToRemove(null);
        }}
        title="Remover Membro da Família"
        description={`Tem certeza de que deseja remover ${
          memberToRemove?.display_name ||
          (memberToRemove as (FamilyMember & { profile_name?: string | null; profile_email?: string | null }))?.profile_name ||
          (memberToRemove as (FamilyMember & { profile_name?: string | null; profile_email?: string | null }))?.profile_email ||
          "este participante"
        } da unidade familiar?`}
        size="sm"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            O participante deixará de ter acesso aos gastos e consolidações do lar. Todas as contas bancárias, cartões, despesas e receitas particulares dele continuarão 100% protegidas e intactas na conta pessoal dele (Zero Data Bleed).
          </p>

          <ModalFooter className="pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsRemoveMemberModalOpen(false);
                setMemberToRemove(null);
              }}
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
              className="rounded-xl cursor-pointer"
            >
              {removeFamilyMemberMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Removendo…</span>
                </>
              ) : (
                <>
                  <UserMinus className="size-3.5 mr-1.5" aria-hidden="true" />
                  <span>Confirmar Remoção</span>
                </>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
