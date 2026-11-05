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
} from "@/components/ui";
import { useMyPublicShares } from "@/state/queries/use-public-shares";
import {
  useCreatePublicShare,
  useRevokePublicShare,
  useRegeneratePublicShare,
} from "@/state/mutations/use-public-share-mutations";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export function FamilyBudgetShareCard() {
  const { data: shares, isLoading } = useMyPublicShares("family_budget");
  const createShareMutation = useCreatePublicShare();
  const revokeShareMutation = useRevokePublicShare();
  const regenerateShareMutation = useRegeneratePublicShare();

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

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = activeShare ? `${origin}/orcamento-familiar/${activeShare.token}` : "";

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
      await regenerateShareMutation.mutateAsync({
        oldId: activeShare.id,
        input: {
          kind: "family_budget",
          payload: activeShare.payload,
        },
      });
      setIsRegenerateModalOpen(false);
      triggerSensory("success");
    } catch {
      triggerSensory("destructive");
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {};
      if (ceilingCents && ceilingCents > 0) {
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
            {activeShare ? (
              <Badge variant="positive" size="xs">
                Link Ativo
              </Badge>
            ) : (
              <Badge variant="muted" size="xs">
                Sem Link Ativo
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Compartilhe um link seguro de leitura para o seu cônjuge ou membros da casa acompanharem o teto mensal, total gasto e despesas familiares em tempo real, sem expor contas ou cartões.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
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
