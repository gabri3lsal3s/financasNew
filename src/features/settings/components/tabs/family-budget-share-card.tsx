import { useMemo, useState } from "react";
import {
  Users,
  Copy,
  Check,
  RotateCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Share2,
  Loader2,
  Info,
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
  Modal,
  ModalFooter,
  Switch,
} from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { useFamilyMode, useMyFamily } from "@/state";
import { useMyPublicShares } from "@/state/queries/use-public-shares";
import {
  useCreatePublicShare,
  useRevokePublicShare,
  useRegeneratePublicShare,
} from "@/state/mutations/use-public-share-mutations";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getPublicAppUrl } from "@/services/app-url";

export function FamilyBudgetShareCard() {
  const { isFamilyModeEnabled, toggleFamilyMode, isPending: isUpdatingFamilyMode } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();
  const { data: shares, isLoading } = useMyPublicShares("family_budget");
  const createShareMutation = useCreatePublicShare();
  const revokeShareMutation = useRevokePublicShare();
  const regenerateShareMutation = useRegeneratePublicShare();

  const hasGroupFamily = Boolean(myFamilyData?.family);
  const groupMonthlyBudgetCents = myFamilyData?.family?.monthly_budget
    ? Math.round(myFamilyData.family.monthly_budget * 100)
    : 0;

  const [copied, setCopied] = useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [ceilingCents, setCeilingCents] = useState<number | null>(null);

  const [nowMs] = useState(() => Date.now());

  const activeShare = useMemo(() => {
    return (shares ?? []).find(
      (s) => !s.is_revoked && (!s.expires_at || new Date(s.expires_at).getTime() > nowMs),
    );
  }, [shares, nowMs]);

  const shareUrl = activeShare ? getPublicAppUrl(`orcamento-familiar/${activeShare.token}`) : "";

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopied(true);
      triggerSensory("success");
      pushToast({
        title: "Link copiado para a área de transferência!",
        description: "Envie para o seu cônjuge ou familiares para leitura do orçamento.",
        variant: "default",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      pushToast({
        title: "Não foi possível copiar o link",
        variant: "destructive",
      });
    }
  };

  const handleConfirmRevoke = async () => {
    if (!activeShare) return;
    try {
      await revokeShareMutation.mutateAsync(activeShare.id);
      setIsRevokeModalOpen(false);
      triggerSensory("success");
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleConfirmRegenerate = async () => {
    if (!activeShare) return;
    try {
      let payload = activeShare.payload as Record<string, unknown> | undefined;
      // Se houver família ativa, removemos qualquer monthly_ceiling_cents manual do payload para que sincronize com a entidade families
      if (hasGroupFamily && payload && "monthly_ceiling_cents" in payload) {
        const nextPayload = { ...payload };
        delete nextPayload.monthly_ceiling_cents;
        payload = nextPayload;
      }
      await regenerateShareMutation.mutateAsync({
        oldId: activeShare.id,
        input: {
          kind: "family_budget",
          payload: payload ?? {},
        },
      });
      setIsRegenerateModalOpen(false);
      triggerSensory("success");
      pushToast({
        title: "Link público regenerado!",
        description: "O endereço anterior foi invalidado e o novo link está pronto para cópia.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {};
      // Se o usuário pertencer a um grupo familiar, o teto é centralmente governado
      // pela entidade families.monthly_budget, não enviamos monthly_ceiling_cents no payload.
      if (!hasGroupFamily && ceilingCents && ceilingCents > 0) {
        payload.monthly_ceiling_cents = ceilingCents;
      }
      await createShareMutation.mutateAsync({
        kind: "family_budget",
        payload,
      });
      setIsCreateModalOpen(false);
      setCeilingCents(null);
      triggerSensory("success");
    } catch {
      triggerSensory("destructive");
    }
  };

  return (
    <>
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <span className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Orçamento Familiar &amp; Link do Cônjuge</span>
            </span>
            {isFamilyModeEnabled ? (
              activeShare ? (
                <Badge variant="positive" size="xs">
                  Link Ativo
                </Badge>
              ) : (
                <Badge variant="muted" size="xs">
                  Sem Link Ativo
                </Badge>
              )
            ) : (
              <Badge variant="muted" size="xs">
                Modo Desativado
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Controle a visibilidade de transações familiares, abas de divisão de visão e o compartilhamento de leitura para o seu cônjuge ou membros da casa.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Switch Mestre: Habilitar Modo Familiar */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/20 gap-3">
            <div className="space-y-0.5">
              <label
                htmlFor="family-mode-toggle"
                className="text-xs font-semibold text-foreground cursor-pointer block"
              >
                Habilitar Modo Familiar
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isFamilyModeEnabled
                  ? "Ativo. Exibe filtros de visão (Todos, Pessoais, Familiar) e opções para marcar lançamentos como do lar."
                  : "Desativado por padrão. Deixa o aplicativo limpo para uso pessoal individual, sem perder nenhum dado já salvo."}
              </p>
            </div>
            <Switch
              id="family-mode-toggle"
              checked={isFamilyModeEnabled}
              disabled={isUpdatingFamilyMode}
              onCheckedChange={(checked) => {
                void toggleFamilyMode(checked);
              }}
              aria-label="Habilitar Modo Familiar"
            />
          </div>

          {!isFamilyModeEnabled ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-border/60 bg-surface text-muted-foreground">
              <Info className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed">
                Ao desativar o modo familiar, todas as transações continuam disponíveis de forma consolidada no extrato. Nenhum lançamento familiar anterior é excluído e você pode reativar a qualquer momento.
              </p>
            </div>
          ) : isLoading ? (
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 animate-pulse text-xs text-muted-foreground">
              Carregando preferências de compartilhamento...
            </div>
          ) : activeShare ? (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
                    <span>Link Exclusivo de Leitura</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.open(shareUrl, "_blank", "noopener,noreferrer");
                        }
                      }}
                      className="gap-1 border-border/80 bg-surface cursor-pointer"
                      title="Visualizar página pública"
                    >
                      <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span>Abrir</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleCopyLink}
                      className="gap-1 border-border/80 bg-surface cursor-pointer"
                      title="Copiar link"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3 text-positive-strong" aria-hidden="true" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3 text-muted-foreground" aria-hidden="true" />
                          <span>Copiar Link</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="h-9 text-xs rounded-lg bg-surface font-mono select-all text-muted-foreground"
                    aria-label="URL do orçamento familiar compartilhado"
                  />
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Apenas despesas marcadas como &ldquo;Familiar&rdquo; são exibidas. Suas contas bancárias, cartões de crédito e lançamentos particulares permanecem estritamente privados.
                </p>

                {hasGroupFamily && groupMonthlyBudgetCents > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                    <Users className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                    <span>Teto da casa vinculado:</span>
                    <MoneyText cents={groupMonthlyBudgetCents} className="font-semibold text-foreground" />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRegenerateModalOpen(true)}
                  className="gap-1.5 text-xs font-semibold rounded-xl border-border/80 bg-surface cursor-pointer"
                >
                  <RotateCw className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Regenerar Link</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRevokeModalOpen(true)}
                  className="gap-1.5 text-xs font-semibold rounded-xl text-critical-strong hover:bg-critical/10 hover:border-critical/30 border-border/80 bg-surface cursor-pointer"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span>Revogar Acesso</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground block">
                  Nenhum link familiar ativo
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Gere um link para que seu cônjuge acompanhe o orçamento do lar de forma transparente e prática.
                </span>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="gap-1.5 text-xs font-semibold rounded-xl shrink-0 cursor-pointer shadow-xs"
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                <span>Gerar Link Familiar</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Gerar Novo Link Familiar */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Gerar Link de Orçamento Familiar"
        description="Configure o link de leitura para compartilhar com seu cônjuge ou membros da casa."
        size="md"
      >
        <form onSubmit={handleCreateShare} className="space-y-4 pt-2">
          <div className="rounded-xl bg-muted/20 border border-border/80 p-3.5 space-y-1.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
              <span>Privacidade Garantida</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O cônjuge verá apenas o teto do mês, o total gasto com despesas marcadas como familiares e o saldo restante disponível. Contas bancárias e transações pessoais não são exibidas.
            </p>
          </div>

          {hasGroupFamily ? (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>Teto Vinculado ao Grupo Familiar</span>
              </span>
              {groupMonthlyBudgetCents > 0 ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O link herdará automaticamente o teto estabelecido para o seu lar (
                  <MoneyText cents={groupMonthlyBudgetCents} className="font-semibold text-foreground" />
                  ). Qualquer alteração no teto da família será refletida em tempo real neste link.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Sua família ainda não possui um teto cadastrado nos parâmetros. O link calculará o orçamento automaticamente a partir dos limites mensais de categorias do mês.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="family-ceiling-input" className="text-xs font-semibold text-foreground">
                Teto mensal personalizado <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <MoneyInput
                id="family-ceiling-input"
                cents={ceilingCents ?? 0}
                onCentsChange={(cents) => setCeilingCents(cents > 0 ? cents : null)}
                placeholder="Ex: R$ 5.000,00"
                className="h-10 text-sm rounded-xl"
              />
              <span className="text-[11px] text-muted-foreground block">
                Se deixar em branco, o teto será calculado automaticamente a partir dos seus orçamentos ativos do mês.
              </span>
            </div>
          )}

          <ModalFooter className="mt-4 pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={createShareMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createShareMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              {createShareMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Gerando…</span>
                </>
              ) : (
                <span>Gerar Link</span>
              )}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal: Confirmar Revogação */}
      <Modal
        open={isRevokeModalOpen}
        onOpenChange={setIsRevokeModalOpen}
        title="Revogar Link Familiar"
        description="Tem certeza de que deseja revogar o link do orçamento familiar?"
        size="sm"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ao revogar, quem possuir o link não conseguirá mais visualizar os dados do orçamento. Você poderá gerar um novo link a qualquer momento.
          </p>

          <ModalFooter className="pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRevokeModalOpen(false)}
              disabled={revokeShareMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={revokeShareMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              {revokeShareMutation.isPending ? (
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

      {/* Modal: Confirmar Regeneração */}
      <Modal
        open={isRegenerateModalOpen}
        onOpenChange={setIsRegenerateModalOpen}
        title="Regenerar Link Familiar"
        description="Deseja gerar um novo endereço para o orçamento familiar?"
        size="sm"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            O token atual será revogado imediatamente e um novo link exclusivo será criado. Você precisará enviar o novo link para quem já possuía o acesso.
          </p>

          <ModalFooter className="pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRegenerateModalOpen(false)}
              disabled={regenerateShareMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleConfirmRegenerate}
              disabled={regenerateShareMutation.isPending}
              className="rounded-xl cursor-pointer"
            >
              {regenerateShareMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                  <span>Regenerando…</span>
                </>
              ) : (
                <span>Regenerar Novo Link</span>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </>
  );
}
