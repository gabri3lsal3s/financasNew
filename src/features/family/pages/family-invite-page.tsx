import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import {
  Users,
  UserPlus,
  ShieldCheck,
  PiggyBank,
  ArrowLeftRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Lock,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  buttonVariants,
  Input,
  Select,
  type SelectOption,
  Skeleton,
  EmptyState,
  Modal,
  ModalFooter,
} from "@/components/ui";
import { SharedLinkHeaderNav } from "@/features/public-share/components";
import { useAuth } from "@/hooks/use-auth";
import { useFamilyInvite, useMyFamily, useAcceptFamilyInvite, useLeaveFamily } from "@/state/queries/use-family";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { FamilyPixKeyType } from "@/types";

const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone Celular" },
  { value: "random", label: "Chave Aleatória" },
];

export function FamilyInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { data: myFamilyData } = useMyFamily();
  const { data: invite, isLoading: inviteLoading, isError: inviteError } = useFamilyInvite(token);
  const acceptInviteMutation = useAcceptFamilyInvite();
  const leaveFamilyMutation = useLeaveFamily();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  const handleConfirmSwitchFamily = async () => {
    if (!myFamilyData?.family) return;
    try {
      const isOwner = myFamilyData.currentMember?.role === "owner";
      await leaveFamilyMutation.mutateAsync({
        familyId: myFamilyData.family.id,
        disband: isOwner,
      });
      setIsSwitchModalOpen(false);
    } catch {
      // Tratado na mutation
    }
  };

  const defaultDisplayName = String(session?.user?.user_metadata?.name ?? "");
  const [customDisplayName, setCustomDisplayName] = useState<string | null>(null);
  const displayName = customDisplayName ?? defaultDisplayName;
  const setDisplayName = (val: string) => setCustomDisplayName(val);

  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<FamilyPixKeyType>("cpf");
  const [copiedLink, setCopiedLink] = useState(false);
  const [now] = useState(() => Date.now());

  // Atualização dinâmica do título da janela
  useEffect(() => {
    if (invite?.family_name) {
      document.title = `Convite Familiar · ${invite.family_name} — Áxis Finance`;
    } else {
      document.title = "Convite Familiar — Áxis Finance";
    }
  }, [invite?.family_name]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      triggerSensory("selection");
      pushToast({
        title: "Link de convite copiado!",
        description: "Envie este link para seu parceiro vincular a conta.",
        variant: "default",
      });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      pushToast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link automaticamente.",
        variant: "destructive",
      });
    }
  };

  const handleAcceptInvite = async () => {
    if (!token) return;
    try {
      await acceptInviteMutation.mutateAsync({
        token,
        displayName: displayName.trim() || null,
        pixKey: pixKey.trim() || null,
        pixKeyType: pixKey.trim() ? pixKeyType : null,
      });
      navigate("/familia", { replace: true });
    } catch {
      // O tratamento de erro sensorial e toast é gerenciado pela mutação useAcceptFamilyInvite
    }
  };

  // 1. Estado de Carregamento (Skeleton estruturado)
  if (inviteLoading || (authLoading && !invite)) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <header className="flex items-center justify-between pb-3 border-b border-border/80">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </header>
          <Card className="border-border/80 bg-surface shadow-xs p-6 space-y-6 rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="size-14 rounded-2xl" />
              <Skeleton className="h-7 w-48 rounded-lg" />
              <Skeleton className="h-4 w-72 rounded-md" />
            </div>
            <div className="space-y-3 pt-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
          </Card>
        </div>
        <footer className="text-center text-xs text-muted-foreground pt-6">
          <Skeleton className="h-4 w-48 mx-auto" />
        </footer>
      </main>
    );
  }

  // 2. Estado de Erro ou Convite Não Localizado
  if (inviteError || !invite) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <SharedLinkHeaderNav
            badgeLabel="Convite Familiar"
            targetPath={`convite-familiar/${token ?? ""}`}
          />
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6 sm:p-8 rounded-2xl">
            <EmptyState
              icon={<ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />}
              title="Convite não encontrado ou inválido"
              description="O link acessado não corresponde a nenhum convite ativo no momento. Peça ao titular que gere um novo convite nas configurações da família."
              action={
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => navigate(session?.user ? "/" : "/apresentacao")}
                  className="rounded-xl cursor-pointer"
                >
                  {session?.user ? "Ir para o Painel" : "Conhecer o Áxis Finance"}
                </Button>
              }
            />
          </Card>
        </div>
      </main>
    );
  }

  // 3. Convite Revogado pelo Titular
  if (invite.status === "revoked") {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <SharedLinkHeaderNav
            badgeLabel="Convite Familiar"
            targetPath={`convite-familiar/${token ?? ""}`}
          />
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6 sm:p-8 rounded-2xl">
            <EmptyState
              icon={<ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />}
              title="Este convite foi cancelado"
              description="O titular da família revogou este convite antes de ser aceito. Solicite que seja enviado um novo link atualizado."
              action={
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => navigate(session?.user ? "/" : "/apresentacao")}
                  className="rounded-xl cursor-pointer"
                >
                  {session?.user ? "Ir para o Painel" : "Ir para a Página Inicial"}
                </Button>
              }
            />
          </Card>
        </div>
      </main>
    );
  }

  // 4. Convite Expirado (Prazo de 7 dias)
  const isExpired =
    invite.status === "expired" || new Date(invite.expires_at).getTime() <= now;

  if (isExpired && invite.status !== "accepted") {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <SharedLinkHeaderNav
            badgeLabel="Convite Familiar"
            targetPath={`convite-familiar/${token ?? ""}`}
          />
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6 sm:p-8 rounded-2xl">
            <EmptyState
              icon={<Clock className="size-10 text-muted-foreground" aria-hidden="true" />}
              title="Este convite expirou"
              description="Por motivos de segurança, os convites familiares têm validade de 7 dias e este prazo já terminou. Solicite um novo link ao titular."
              action={
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => navigate(session?.user ? "/" : "/apresentacao")}
                  className="rounded-xl cursor-pointer"
                >
                  {session?.user ? "Ir para o Painel" : "Ir para a Página Inicial"}
                </Button>
              }
            />
          </Card>
        </div>
      </main>
    );
  }

  // 5. Convite Já Utilizado Anteriormente
  if (invite.status === "accepted") {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <SharedLinkHeaderNav
            badgeLabel="Convite Familiar"
            targetPath={`convite-familiar/${token ?? ""}`}
          />
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6 sm:p-8 rounded-2xl">
            <EmptyState
              icon={<CheckCircle2 className="size-10 text-positive-strong" aria-hidden="true" />}
              title="Este convite já foi aceito"
              description="Este link de convite já foi utilizado para vincular uma conta ao orçamento familiar."
              action={
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => navigate(session?.user ? "/familia" : "/entrar")}
                  className="rounded-xl cursor-pointer"
                >
                  {session?.user ? "Acessar Orçamento Familiar" : "Entrar com Minha Conta"}
                </Button>
              }
            />
          </Card>
        </div>
      </main>
    );
  }

  // 6. Usuário Autenticado é o Criador do Convite
  if (session?.user && invite.invited_by === session.user.id) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <SharedLinkHeaderNav
            badgeLabel="Convite Familiar"
            targetPath={`convite-familiar/${token ?? ""}`}
          />
          <Card className="border-border/80 bg-surface shadow-xs p-6 sm:p-8 rounded-2xl text-center space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl border bg-primary/10 border-primary/20 text-primary-strong">
                <Users className="size-7" aria-hidden="true" />
              </div>
              <Badge variant="muted" size="xs">
                Seu Convite
              </Badge>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Você é o criador deste convite
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Envie o link abaixo para seu parceiro(a) aceitar e começar a compartilhar o
                orçamento da família{" "}
                <strong className="text-foreground">{invite.family_name || "sua família"}</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 max-w-md mx-auto w-full">
              <Input
                value={window.location.href}
                readOnly
                className="text-xs font-mono text-muted-foreground select-all bg-surface-hover/50"
                aria-label="Link de convite para cópia"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2 shrink-0 w-full sm:w-auto h-10"
              >
                {copiedLink ? (
                  <>
                    <Check className="size-4 text-positive-strong" aria-hidden="true" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span>Copiar Link</span>
                  </>
                )}
              </Button>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => navigate("/familia")}
                className="rounded-xl cursor-pointer"
              >
                Ir para o Orçamento Familiar
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // 7. Usuário Já Pertence à Mesma Família
  if (myFamilyData?.family && myFamilyData.family.id === invite.family_id) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <SharedLinkHeaderNav
            badgeLabel="Convite Familiar"
            targetPath={`convite-familiar/${token ?? ""}`}
          />
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6 sm:p-8 rounded-2xl">
            <EmptyState
              icon={<CheckCircle2 className="size-10 text-positive-strong" aria-hidden="true" />}
              title="Você já faz parte desta família"
              description={`Sua conta já está vinculada ao orçamento familiar de ${invite.family_name || "sua família"}.`}
              action={
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/familia")}
                  className="rounded-xl cursor-pointer"
                >
                  Acessar Orçamento Familiar
                </Button>
              }
            />
          </Card>
        </div>
      </main>
    );
  }

  // 8. Usuário Já Pertence a OUTRA Família Ativa (Princípio de Participante Único)
  if (myFamilyData?.family && myFamilyData.family.id !== invite.family_id) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <SharedLinkHeaderNav
            badgeLabel="Convite Familiar"
            targetPath={`convite-familiar/${token ?? ""}`}
          />
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6 sm:p-8 rounded-2xl">
            <EmptyState
              icon={<AlertTriangle className="size-10 text-warning-strong" aria-hidden="true" />}
              title="Você já pertence a outra família ativa"
              description={`Para entrar na família ${invite.family_name || "convidada"}, é necessário desvincular sua conta da família atual (${myFamilyData.family.name}). Seus lançamentos pessoais, contas bancárias e cartões continuarão 100% seguros e intactos.`}
              action={
                <div className="flex flex-col sm:flex-row gap-2.5 justify-center w-full">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => setIsSwitchModalOpen(true)}
                    className="rounded-xl cursor-pointer"
                  >
                    Sair de {myFamilyData.family.name} e Entrar Nesta
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/familia")}
                    className="rounded-xl cursor-pointer"
                  >
                    Permanecer na Minha Família
                  </Button>
                </div>
              }
            />
          </Card>
        </div>

        {/* Modal: Confirmar Troca de Família */}
        <Modal
          open={isSwitchModalOpen}
          onOpenChange={setIsSwitchModalOpen}
          title="Confirmar Troca de Família"
          description={`Deseja se desvincular de "${myFamilyData.family.name}" para ingressar em "${invite.family_name || "nova família"}"?`}
          size="sm"
        >
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Suas despesas, receitas e contas bancárias continuarão totalmente intactas na sua conta. Apenas a visualização e divisão com a família anterior serão desfeitas.
            </p>

            <ModalFooter className="pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSwitchModalOpen(false)}
                disabled={leaveFamilyMutation.isPending}
                className="rounded-xl cursor-pointer"
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmSwitchFamily}
                disabled={leaveFamilyMutation.isPending}
                className="rounded-xl cursor-pointer"
              >
                {leaveFamilyMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                    <span>Desvinculando…</span>
                  </>
                ) : (
                  <span>Confirmar e Entrar</span>
                )}
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      </main>
    );
  }

  // 9. Visitante NÃO Autenticado (Recepção com Redirecionamento Pós-Login)
  if (!session?.user) {
    const returnPath = `/convite-familiar/${token}`;
    const loginUrl = `/entrar?redirect=${encodeURIComponent(returnPath)}`;
    const registerUrl = `/cadastro?redirect=${encodeURIComponent(returnPath)}`;

    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto w-full space-y-6">
          <SharedLinkHeaderNav badgeLabel="Convite Familiar" targetPath={`convite-familiar/${token}`} />

          <Card className="border-border/80 bg-surface shadow-xs p-6 sm:p-8 rounded-2xl space-y-6">
            <div className="text-center space-y-3">
              <div className="inline-flex size-14 items-center justify-center rounded-2xl border bg-primary/10 border-primary/20 text-primary-strong mx-auto">
                <Users className="size-7" aria-hidden="true" />
              </div>
              <div>
                <Badge variant="default" size="xs">
                  Modo Família Colaborativo
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {invite.inviter_name || "Seu parceiro(a)"} convidou você!
              </h1>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Faça parte da família{" "}
                <strong className="text-foreground">{invite.family_name || "Áxis Finance"}</strong>{" "}
                para planejar as despesas da casa com equilíbrio e transparência.
              </p>
            </div>

            {/* Pilares Blindados de Engenharia & Zero Data Bleed */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-surface-hover/30">
                <ShieldCheck
                  className="size-5 text-positive-strong shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-foreground block">
                    Privacidade Sagrada (Zero Data Bleed)
                  </span>
                  <p className="text-muted-foreground">
                    Suas contas bancárias, cartões e despesas particulares continuam 100% privados.
                    Apenas os lançamentos marcados como familiares são somados na casa.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-surface-hover/30">
                <PiggyBank
                  className="size-5 text-primary-strong shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-foreground block">
                    Orçamento e Tetos Compartilhados
                  </span>
                  <p className="text-muted-foreground">
                    Acompanhem juntos os limites de gastos da casa por categoria em tempo real, sem
                    necessidade de planilhas manuais.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/60 bg-surface-hover/30">
                <ArrowLeftRight
                  className="size-5 text-portfolio shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-foreground block">
                    Compensação Justa via Pix em 1 Toque
                  </span>
                  <p className="text-muted-foreground">
                    O app calcula quem gastou mais, quanto deve ser compensado e gera a Chave Pix com o
                    valor exato para liquidação instantânea.
                  </p>
                </div>
              </div>
            </div>

            {/* Ações de Onboarding com Redirecionamento Inteligente */}
            <div className="flex flex-col gap-3 pt-2">
              <Link
                to={registerUrl}
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "w-full rounded-xl cursor-pointer gap-2 font-medium",
                )}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                <span>Criar Conta Gratuita e Aceitar</span>
              </Link>
              <Link
                to={loginUrl}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full rounded-xl cursor-pointer gap-2 text-xs",
                )}
              >
                <span>Já tenho uma conta — Fazer Login</span>
              </Link>
            </div>
          </Card>
        </div>

        <footer className="text-center text-xs text-muted-foreground pt-6">
          <span>Áxis Finance · Gestão Financeira Inteligente e Colaborativa</span>
        </footer>
      </main>
    );
  }

  // 10. Visitante Autenticado e Elegível para Aceitar o Convite
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <div className="max-w-xl mx-auto w-full space-y-6">
        <SharedLinkHeaderNav badgeLabel="Convite Familiar" targetPath={`convite-familiar/${token}`} />

        <Card className="border-border/80 bg-surface shadow-xs p-6 sm:p-8 rounded-2xl space-y-6">
          <CardHeader className="p-0 text-center space-y-2">
            <div className="inline-flex size-14 items-center justify-center rounded-2xl border bg-primary/10 border-primary/20 text-primary-strong mx-auto">
              <UserPlus className="size-7" aria-hidden="true" />
            </div>
            <div>
              <Badge variant="default" size="xs">
                Modo Família Colaborativo
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {invite.inviter_name || "Seu parceiro(a)"} convidou você!
            </CardTitle>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Você foi convidado para integrar o orçamento familiar da família{" "}
              <strong className="text-foreground">{invite.family_name || "Áxis Finance"}</strong>.
            </p>
          </CardHeader>

          {/* Banner de Garantia de Privacidade */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-positive/20 bg-positive/5 text-xs text-positive-strong">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Privacidade 100% Preservada:</strong> Suas contas bancárias e extrato pessoal
              continuam restritos apenas a você.
            </span>
          </div>

          {/* Formulário de Aceitação */}
          <CardContent className="p-0 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="family-display-name" className="text-xs font-semibold text-foreground">
                Seu Nome de Exibição na Família <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Input
                id="family-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Mariana ou Mari"
                maxLength={50}
                className="h-10 text-sm"
              />
              <span className="text-[11px] text-muted-foreground block">
                Nome exibido no extrato familiar consolidado da casa.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5 sm:col-span-1">
                <label htmlFor="family-pix-key" className="text-xs font-semibold text-foreground">
                  Chave Pix <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input
                  id="family-pix-key"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Ex: seu-pix@email.com"
                  maxLength={80}
                  className="h-10 text-sm font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <label id="family-pix-type-label" className="text-xs font-semibold text-foreground">
                  Tipo da Chave Pix <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Select
                  value={pixKeyType}
                  onValueChange={(val) => setPixKeyType(val as FamilyPixKeyType)}
                  options={PIX_KEY_OPTIONS}
                  ariaLabel="Tipo de Chave Pix"
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground block">
              Sua chave Pix permite que seu parceiro realize o acerto do mês diretamente pelo app com 1 toque.
            </span>
          </CardContent>

          {/* Botão de Aceitação em 1 Clique */}
          <div className="p-0 pt-2 flex flex-col gap-2">
            <Button
              type="button"
              variant="default"
              size="lg"
              onClick={handleAcceptInvite}
              disabled={acceptInviteMutation.isPending}
              className="w-full rounded-xl cursor-pointer gap-2 font-medium"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              <span>
                {acceptInviteMutation.isPending
                  ? "Entrando na família…"
                  : "Aceitar Convite e Entrar na Família"}
              </span>
            </Button>
          </div>
        </Card>
      </div>

      <footer className="text-center text-xs text-muted-foreground pt-6">
        <span>Áxis Finance · Gestão Financeira Inteligente e Colaborativa</span>
      </footer>
    </main>
  );
}
