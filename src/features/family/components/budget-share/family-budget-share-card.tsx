import { Info, Share2, Users } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, Skeleton, Switch } from "@/components/ui";
import { FamilyBudgetShareActivePanel } from "./family-budget-share-active-panel";
import { FamilyBudgetShareCreateModal } from "./family-budget-share-create-modal";
import { useFamilyBudgetShare } from "./use-family-budget-share";

export function FamilyBudgetShareCard() {
  const s = useFamilyBudgetShare();

  return (
    <>
      <Card className="border-border/80 bg-surface shadow-xs rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base flex flex-row items-center justify-between gap-2.5">
            <span className="flex items-center gap-2 min-w-0">
              <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sm:hidden truncate">Modo Família</span>
              <span className="hidden sm:inline truncate">Modo Família &amp; Link do Cônjuge</span>
            </span>
            <Badge
              variant={s.isFamilyModeEnabled && s.activeShare ? "positive" : "muted"}
              size="xs"
              className="shrink-0"
            >
              {!s.isFamilyModeEnabled ? "Modo Desativado" : s.activeShare ? "Link Ativo" : "Sem Link Ativo"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Controle a visibilidade de transações familiares, abas de divisão de visão e o compartilhamento de leitura para o seu cônjuge ou membros da casa.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-raised gap-3">
            <div className="space-y-0.5">
              <label htmlFor="family-mode-toggle" className="text-xs font-semibold text-foreground cursor-pointer block">
                Habilitar Modo Família
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {s.isFamilyModeEnabled
                  ? "Ativo. Exibe filtros de visão (Todos, Pessoais, Familiar) e opções para marcar lançamentos como do lar."
                  : "Desativado por padrão. Deixa o aplicativo limpo para uso pessoal individual, sem perder nenhum dado já salvo."}
              </p>
            </div>
            <Switch
              id="family-mode-toggle"
              checked={s.isFamilyModeEnabled}
              disabled={s.isUpdatingFamilyMode}
              onCheckedChange={(checked) => {
                void s.toggleFamilyMode(checked);
              }}
              aria-label="Habilitar Modo Família"
            />
          </div>

          {!s.isFamilyModeEnabled ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-raised text-muted-foreground">
              <Info className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed">
                Ao desativar o Modo Família, todas as transações continuam disponíveis de forma consolidada no extrato. Nenhum lançamento familiar anterior é excluído e você pode reativar a qualquer momento.
              </p>
            </div>
          ) : s.isLoading ? (
            <Skeleton className="h-14 w-full rounded-xl" />
          ) : s.activeShare ? (
            <FamilyBudgetShareActivePanel
              shareUrl={s.shareUrl}
              copied={s.copied}
              hasGroupFamily={s.hasGroupFamily}
              groupMonthlyBudgetCents={s.groupMonthlyBudgetCents}
              onCopyLink={s.handleCopyLink}
              onRequestRegenerate={() => s.setIsRegenerateModalOpen(true)}
              onRequestRevoke={() => s.setIsRevokeModalOpen(true)}
            />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-surface-raised">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground block">Nenhum link familiar ativo</span>
                <span className="text-[11px] text-muted-foreground block">
                  Gere um link para que seu cônjuge acompanhe o orçamento do lar de forma transparente e prática.
                </span>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => s.setIsCreateModalOpen(true)}
                className="gap-1.5 shrink-0"
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                <span>Gerar Link Familiar</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <FamilyBudgetShareCreateModal
        open={s.isCreateModalOpen}
        onOpenChange={s.setIsCreateModalOpen}
        hasGroupFamily={s.hasGroupFamily}
        groupMonthlyBudgetCents={s.groupMonthlyBudgetCents}
        isPending={s.createPending}
        onCreateShare={s.handleCreateShare}
      />

      <ConfirmDialog
        open={s.isRevokeModalOpen}
        onOpenChange={s.setIsRevokeModalOpen}
        elevated
        title="Revogar Link Familiar"
        description="Tem certeza de que deseja revogar o link do orçamento familiar?"
        confirmLabel="Confirmar Revogação"
        cancelLabel="Voltar"
        variant="destructive"
        confirmPending={s.revokePending}
        onConfirm={() => void s.handleConfirmRevoke()}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Ao revogar, quem possuir o link não conseguirá mais visualizar os dados do orçamento. Você poderá gerar um novo link a qualquer momento.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={s.isRegenerateModalOpen}
        onOpenChange={s.setIsRegenerateModalOpen}
        elevated
        title="Regenerar Link Familiar"
        description="Deseja gerar um novo endereço para o orçamento familiar?"
        confirmLabel="Regenerar Novo Link"
        cancelLabel="Voltar"
        confirmPending={s.regeneratePending}
        onConfirm={() => void s.handleConfirmRegenerate()}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          O token atual será revogado imediatamente e um novo link exclusivo será criado. Você precisará enviar o novo link para quem já possuía o acesso.
        </p>
      </ConfirmDialog>
    </>
  );
}
