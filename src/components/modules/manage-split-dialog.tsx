import { useMemo, useState } from "react";
import {
  CheckCircle2,
  DollarSign,
  Edit2,
  Lock,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { MoneyInput } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useDeleteDebt,
  useDeleteExpense,
  useDeletePublicShare,
  useExpense,
  useSettleIntegratedReceivable,
  useUpdateDebt,
  useUpdateExpense,
  useUpdatePublicShare,
} from "@/state";
import { formatCentsAsCurrency } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { Debt, PublicShare, SplitParticipantItem, SplitSharePayload } from "@/types";

export interface ManageSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share: PublicShare;
  linkedDebt?: Debt | null;
  onSuccess?: () => void;
}

export function ManageSplitDialog({
  open,
  onOpenChange,
  share,
  linkedDebt,
  onSuccess,
}: ManageSplitDialogProps) {
  const updateShareMutation = useUpdatePublicShare();
  const deleteShareMutation = useDeletePublicShare();
  const updateExpenseMutation = useUpdateExpense();
  const deleteExpenseMutation = useDeleteExpense();
  const updateDebtMutation = useUpdateDebt();
  const deleteDebtMutation = useDeleteDebt();
  const settleDebtMutation = useSettleIntegratedReceivable();

  const payload = (share.payload ?? {}) as unknown as SplitSharePayload;
  const { data: linkedExpense, isFetched: isExpenseFetched } = useExpense(payload.expense_id ?? null);
  const hasLinkedExpense = Boolean(payload.expense_id && (!isExpenseFetched || linkedExpense));

  // Estado dos participantes
  const [participants, setParticipants] = useState<SplitParticipantItem[]>(() => {
    const list = payload.participants ?? [];
    if (list.length > 0) {
      return list.map((p, i) => ({
        ...p,
        id: p.id || `p_${i + 1}`,
        is_settled: p.is_host ? true : Boolean(p.is_settled),
        settled_cents: p.is_host
          ? (p.settled_cents ?? p.share_cents)
          : (p.settled_cents ?? 0),
      }));
    }
    // Fallback caso não haja participantes gravados
    const count = payload.people_count || 2;
    const guestCents = payload.guest_share_cents || Math.round(payload.total_cents / count);
    const hostCents = payload.host_share_cents || guestCents;
    const res: SplitParticipantItem[] = [
      {
        id: "p_1",
        name: "Você (Anfitrião)",
        share_cents: hostCents,
        is_host: true,
        is_settled: true,
        settled_cents: hostCents,
      },
    ];
    for (let i = 1; i < count; i++) {
      res.push({
        id: `p_${i + 1}`,
        name: `Participante ${i + 1}`,
        share_cents: guestCents,
        is_host: false,
        is_settled: false,
        settled_cents: 0,
      });
    }
    return res;
  });

  // Estado de edição de valor personalizado por participante
  const [customInputParticipantId, setCustomInputParticipantId] = useState<string | null>(null);
  const [customInputCents, setCustomInputCents] = useState<number>(0);

  // Confirmações
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLinkedDebt, setDeleteLinkedDebt] = useState<boolean>(true);
  const [deleteOriginalExpense, setDeleteOriginalExpense] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleOpenDeleteConfirm = () => {
    setDeleteLinkedDebt(Boolean(linkedDebt));
    setDeleteOriginalExpense(false);
    setConfirmDeleteOpen(true);
  };

  // Modo de edição de dados básicos do racha
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editedTitle, setEditedTitle] = useState(payload.title || "");
  const [editedPixKey, setEditedPixKey] = useState(payload.pix_key || "");

  // Cálculos contábeis
  const totalCents = Number(payload.total_cents ?? 0);
  const friends = useMemo(() => participants.filter((p) => !p.is_host), [participants]);

  const totalSettledFromFriendsCents = useMemo(() => {
    return friends.reduce((acc, f) => {
      return acc + (f.is_settled ? Number(f.settled_cents ?? f.share_cents) : 0);
    }, 0);
  }, [friends]);

  const settledFriendsCount = useMemo(() => {
    return friends.filter((f) => f.is_settled).length;
  }, [friends]);

  // Custo líquido real suportado pelo anfitrião (Total Despesa - Reembolsos recebidos)
  const hostNetCostCents = Math.max(0, totalCents - totalSettledFromFriendsCents);
  const netReportWeight = totalCents > 0 ? hostNetCostCents / totalCents : 1;
  const isCompleted = Boolean(payload.is_completed);

  // Sincroniza participantes no Supabase
  const persistParticipants = async (
    updatedParticipants: SplitParticipantItem[],
    options?: { markCompleted?: boolean },
  ) => {
    const updatedSettledTotal = updatedParticipants
      .filter((p) => !p.is_host)
      .reduce((acc, f) => acc + (f.is_settled ? Number(f.settled_cents ?? f.share_cents) : 0), 0);

    const completed = options?.markCompleted ?? isCompleted;

    const newPayload: SplitSharePayload = {
      ...payload,
      title: editedTitle.trim() || payload.title,
      pix_key: editedPixKey.trim() || payload.pix_key,
      participants: updatedParticipants,
      total_settled_cents: updatedSettledTotal,
      is_completed: completed,
    };

    setParticipants(updatedParticipants);

    await updateShareMutation.mutateAsync({
      id: share.id,
      payload: newPayload as unknown as Record<string, unknown>,
    });

    // Se o racha for completado ou se houver despesa vinculada, sincroniza o peso contábil
    if (payload.expense_id && hasLinkedExpense) {
      try {
        const netCost = Math.max(0, totalCents - updatedSettledTotal);
        const weight = totalCents > 0 ? netCost / totalCents : 1;
        await updateExpenseMutation.mutateAsync({
          id: payload.expense_id,
          input: {
            report_weight: weight,
          },
        });
      } catch (err) {
        console.warn("Não foi possível atualizar o peso contábil da despesa vinculada:", err);
      }
    }

    if (linkedDebt && !linkedDebt.paid_at) {
      try {
        const totalFriendsExpectedCents = friends.reduce((acc, f) => acc + f.share_cents, 0);
        const remainingReceivableCents = Math.max(0, totalFriendsExpectedCents - updatedSettledTotal);

        if (completed || remainingReceivableCents === 0) {
          await settleDebtMutation.mutateAsync({
            debtId: linkedDebt.id,
            result: hostNetCostCents / 100,
          });
        } else {
          await updateDebtMutation.mutateAsync({
            id: linkedDebt.id,
            input: {
              amount: remainingReceivableCents / 100,
            },
          });
        }
      } catch (err) {
        console.warn("Não foi possível sincronizar a dívida vinculada:", err);
      }
    }
  };

  // 1. Dar baixa total na cota esperada do amigo
  const handleSettleFull = async (participantId: string) => {
    const updated = participants.map((p) => {
      if (p.id === participantId) {
        return {
          ...p,
          is_settled: true,
          settled_cents: p.share_cents,
          settled_at: new Date().toISOString(),
        };
      }
      return p;
    });

    try {
      await persistParticipants(updated);
      triggerSensory("action");
      pushToast({
        title: "Baixa registrada!",
        description: "Reembolso integral do participante registrado.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  // 2. Dar baixa com valor personalizado (calote parcial ou total de R$ 0,00)
  const handleOpenCustomSettle = (participant: SplitParticipantItem) => {
    setCustomInputParticipantId(participant.id || null);
    setCustomInputCents(participant.share_cents);
  };

  const handleConfirmCustomSettle = async () => {
    if (!customInputParticipantId) return;

    const updated = participants.map((p) => {
      if (p.id === customInputParticipantId) {
        return {
          ...p,
          is_settled: true,
          settled_cents: customInputCents,
          settled_at: new Date().toISOString(),
        };
      }
      return p;
    });

    try {
      await persistParticipants(updated);
      triggerSensory("action");
      setCustomInputParticipantId(null);
      pushToast({
        title: "Baixa registrada!",
        description:
          customInputCents === 0
            ? "Calote registrado (R$ 0,00). O valor restante foi mantido no seu custo."
            : "Valor personalizado recebido com sucesso.",
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  // 3. Desfazer baixa
  const handleUnsettle = async (participantId: string) => {
    const updated = participants.map((p) => {
      if (p.id === participantId) {
        return {
          ...p,
          is_settled: false,
          settled_cents: 0,
          settled_at: null,
        };
      }
      return p;
    });

    try {
      await persistParticipants(updated);
      triggerSensory("selection");
      pushToast({
        title: "Baixa desfeita",
        description: "O participante voltou ao status de pendente.",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  // 4. Finalizar o Racha
  const handleFinalizeSplit = async () => {
    try {
      await persistParticipants(participants, { markCompleted: true });
      triggerSensory("success");
      setConfirmFinalizeOpen(false);
      pushToast({
        title: "Racha finalizado com sucesso!",
        description: `Sua despesa foi ajustada para R$ ${(hostNetCostCents / 100).toFixed(2).replace(".", ",")} e a cobrança foi liquidada.`,
        variant: "success",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch {
      triggerSensory("destructive");
    }
  };

  // 5. Salvar edição de dados básicos
  const handleSaveInfo = async () => {
    try {
      await persistParticipants(participants);
      setIsEditingInfo(false);
      triggerSensory("success");
      pushToast({
        title: "Dados atualizados com sucesso!",
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
    }
  };

  // 6. Excluir o Racha Granularmente
  const handleDeleteSplit = async () => {
    setIsDeleting(true);
    try {
      if (deleteOriginalExpense && payload.expense_id && hasLinkedExpense) {
        try {
          await deleteExpenseMutation.mutateAsync({ expenseId: payload.expense_id, mode: "single" });
        } catch (err) {
          console.warn("Não foi possível excluir despesa vinculada (pode já ter sido excluída):", err);
        }
      } else if (!deleteOriginalExpense && payload.expense_id && hasLinkedExpense) {
        // Restaura a despesa original para 100% caso seja mantida
        try {
          await updateExpenseMutation.mutateAsync({
            id: payload.expense_id,
            input: {
              report_weight: 1,
            },
          });
        } catch (err) {
          console.warn("Não foi possível restaurar peso da despesa vinculada (pode já ter sido excluída):", err);
        }
      }

      if (deleteLinkedDebt && linkedDebt) {
        try {
          await deleteDebtMutation.mutateAsync(linkedDebt.id);
        } catch (err) {
          console.warn("Não foi possível excluir dívida vinculada (pode já ter sido excluída):", err);
        }
      }

      await deleteShareMutation.mutateAsync(share.id);

      triggerSensory("destructive");
      setConfirmDeleteOpen(false);
      pushToast({
        title: "Racha excluído com sucesso!",
        description: deleteOriginalExpense && hasLinkedExpense
          ? "O racha e a despesa vinculada foram removidos."
          : hasLinkedExpense
          ? "O racha foi removido e a despesa original foi restaurada para 100%."
          : "O racha foi removido.",
        variant: "default",
      });
      onSuccess?.();
      onOpenChange(false);
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao excluir racha",
        description: "Não foi possível concluir a exclusão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title={payload.title || "Gerenciar Racha de Despesa"}
        description="Acompanhe baixas por pessoa, registre calotes parciais ou finalize o racha."
      >
        <div className="space-y-4 py-1">
          {/* Métricas e Resumo Financeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-border/80 bg-surface/80 p-3 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">Total da Despesa</span>
              <div>
                <MoneyText cents={totalCents} tone="default" variant="value" className="text-base font-semibold" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Valor original do racha
              </p>
            </div>

            <div className="rounded-xl border border-portfolio/30 bg-portfolio/5 p-3 space-y-1">
              <span className="text-[11px] font-medium text-portfolio">Recebido dos Amigos</span>
              <div>
                <MoneyText
                  cents={totalSettledFromFriendsCents}
                  tone="portfolio"
                  className="text-base font-semibold"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {settledFriendsCount} de {friends.length} amigos baixados
              </p>
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
              <span className="text-[11px] font-medium text-primary">Sua Cota Líquida</span>
              <div>
                <MoneyText
                  cents={hostNetCostCents}
                  tone="default"
                  className="text-base font-semibold"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Peso no relatório: {Math.round(netReportWeight * 100)}%
              </p>
            </div>
          </div>

          {/* Edição de dados básicos (Toggle) */}
          {isEditingInfo ? (
            <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Editar Dados do Racha</span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setIsEditingInfo(false)}
                >
                  Cancelar
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Título do racha</label>
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="Ex.: Pizza com a galera"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Chave Pix</label>
                  <Input
                    value={editedPixKey}
                    onChange={(e) => setEditedPixKey(e.target.value)}
                    placeholder="Chave Pix para cobrança"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button type="button" size="xs" variant="default" onClick={handleSaveInfo}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>
                  {friends.length} participantes amigos · Status:{" "}
                  <strong className={isCompleted ? "text-positive-strong" : "text-warning-strong"}>
                    {isCompleted ? "Finalizado" : "Em Aberto"}
                  </strong>
                </span>
              </div>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setIsEditingInfo(true)}
                className="gap-1 h-6 px-2 text-[11px]"
              >
                <Edit2 className="size-3" aria-hidden="true" />
                <span>Editar dados</span>
              </Button>
            </div>
          )}

          {/* Lista de Participantes Amigos com Ação Individual */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground">
              Participantes e Quitações
            </span>

            <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-surface/50 overflow-hidden">
              {friends.map((friend) => {
                const isCustomInputOpen = customInputParticipantId === friend.id;

                return (
                  <div
                    key={friend.id}
                    className="p-3 hover:bg-surface-hover/50 transition-colors space-y-2.5"
                  >
                    {/* Linha principal: Informações à esquerda e botões de ação à direita */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {friend.name}
                            </span>
                            <Badge
                              size="xs"
                              variant={friend.is_settled ? "positive" : "warning"}
                            >
                              {friend.is_settled ? "Quitado" : "Pendente"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span>Cota esperada:</span>
                            <MoneyText cents={friend.share_cents} variant="value" />
                            {friend.is_settled && (
                              <>
                                <span>· Recebido:</span>
                                <MoneyText
                                  cents={friend.settled_cents ?? friend.share_cents}
                                  tone={
                                    (friend.settled_cents ?? friend.share_cents) < friend.share_cents
                                      ? "negative"
                                      : "positive"
                                  }
                                  className="font-semibold"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controles de Baixa */}
                      <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                        {!friend.is_settled ? (
                          <>
                            <Button
                              type="button"
                              size="xs"
                              variant="default"
                              onClick={() => handleSettleFull(friend.id!)}
                              className="gap-1 h-7 text-xs"
                            >
                              <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
                              <span>Recebi Tudo</span>
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant={isCustomInputOpen ? "secondary" : "outline"}
                              onClick={() => {
                                if (isCustomInputOpen) {
                                  setCustomInputParticipantId(null);
                                } else {
                                  handleOpenCustomSettle(friend);
                                }
                              }}
                              className="gap-1 h-7 text-xs"
                            >
                              <DollarSign className="size-3 text-muted-foreground" aria-hidden="true" />
                              <span>{isCustomInputOpen ? "Cancelar" : "Outro Valor"}</span>
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => handleUnsettle(friend.id!)}
                            className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <RotateCcw className="size-3" aria-hidden="true" />
                            <span>Desfazer</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Modo de Entrada de Valor Personalizado (Card Expandido Abaixo) */}
                    {isCustomInputOpen && (
                      <div className="w-full pt-3 mt-1 border-t border-border/70 rounded-lg bg-surface/80 p-3 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <label className="text-xs font-semibold text-foreground block">
                              Valor efetivamente recebido de {friend.name}
                            </label>
                            <span className="text-[11px] text-muted-foreground block">
                              Informe quanto a pessoa pagou (digite R$ 0,00 em caso de calote)
                            </span>
                          </div>
                          <div className="w-full sm:w-48 shrink-0">
                            <MoneyInput
                              cents={customInputCents}
                              onCentsChange={setCustomInputCents}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => setCustomInputParticipantId(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="default"
                            onClick={handleConfirmCustomSettle}
                          >
                            Confirmar Baixa
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explicação de Transparência Contábil */}
          <div className="rounded-xl border border-border/60 bg-surface/50 p-3 text-[11px] text-muted-foreground space-y-1">
            <p>
              Ao registrar baixas parciais ou calotes (R$ 0,00), a despesa correspondente passa a
              contar no extrato apenas pelo valor que não foi reembolsado.
            </p>
          </div>
        </div>

        <ModalFooter
          destructiveAction={
            <Button
              type="button"
              variant="ghost"
              onClick={handleOpenDeleteConfirm}
              className="gap-1.5 text-critical hover:bg-critical/10"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>Excluir Racha</span>
            </Button>
          }
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          {!isCompleted ? (
            <Button
              type="button"
              variant="default"
              onClick={() => setConfirmFinalizeOpen(true)}
              className="gap-1.5"
            >
              <Lock className="size-3.5 text-primary-foreground" aria-hidden="true" />
              <span>Finalizar Racha</span>
            </Button>
          ) : (
            <Badge variant="positive" className="px-2.5 py-1 text-xs justify-center w-full sm:w-auto">
              Racha Finalizado
            </Badge>
          )}
        </ModalFooter>
      </Modal>

      {/* Confirmação de Finalização */}
      <ConfirmDialog
        open={confirmFinalizeOpen}
        onOpenChange={setConfirmFinalizeOpen}
        title="Finalizar este racha de despesa?"
        description={`Você recebeu R$ ${(totalSettledFromFriendsCents / 100).toFixed(2).replace(".", ",")} dos amigos. Sua despesa final no extrato considerará R$ ${(hostNetCostCents / 100).toFixed(2).replace(".", ",")} e a cobrança vinculada será encerrada.`}
        confirmLabel="Finalizar e Quitar Cobrança"
        onConfirm={handleFinalizeSplit}
      />

      {/* Diálogo de Exclusão Granular do Racha */}
      <Modal
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        size="md"
        title="Excluir Racha de Despesa"
        description="Escolha quais registros vinculados a este racha você também deseja remover:"
      >
        <div className="space-y-4 py-2">
          <div className="space-y-3">
            {/* Opção 1: Racha Público (fixo e obrigatório) */}
            <div className="flex items-start gap-3 p-3 rounded-xl border border-border/70 bg-surface/80">
              <Checkbox
                checked={true}
                disabled={true}
                onCheckedChange={() => {}}
                aria-label="Link e dados do racha"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground block">
                  Link e dados do racha
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Cancela a página pública do Pix e o acompanhamento das cotas.
                </span>
              </div>
            </div>

            {/* Opção 2: Cobrança a Receber vinculada (se existir) */}
            {linkedDebt && (
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  deleteLinkedDebt
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/70 bg-surface/80"
                }`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button[role="checkbox"]')) return;
                  setDeleteLinkedDebt((prev) => !prev);
                }}
              >
                <Checkbox
                  checked={deleteLinkedDebt}
                  onCheckedChange={(checked) => setDeleteLinkedDebt(Boolean(checked))}
                  aria-label="Cobrança a receber vinculada"
                />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Conta a receber vinculada
                    </span>
                    <MoneyText cents={Math.round(linkedDebt.amount * 100)} variant="value" className="text-xs font-medium" />
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Remove a pendência de recebimento da sua lista de Dívidas.
                  </span>
                </div>
              </div>
            )}

            {/* Opção 3: Despesa original no extrato (se existir e estiver no banco) */}
            {payload.expense_id && hasLinkedExpense && (
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  deleteOriginalExpense
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border/70 bg-surface/80"
                }`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button[role="checkbox"]')) return;
                  setDeleteOriginalExpense((prev) => !prev);
                }}
              >
                <Checkbox
                  checked={deleteOriginalExpense}
                  onCheckedChange={(checked) => setDeleteOriginalExpense(Boolean(checked))}
                  aria-label="Despesa original no extrato"
                />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      Despesa original no extrato
                    </span>
                    <MoneyText cents={totalCents} variant="value" className="text-xs font-medium" />
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    {deleteOriginalExpense
                      ? "Apaga totalmente a despesa do seu extrato e recalcula o seu saldo."
                      : "Mantém a despesa no extrato e restaura o valor para 100% integral."}
                  </span>
                </div>
              </div>
            )}

            {/* Aviso quando a despesa vinculada já foi excluída isoladamente */}
            {payload.expense_id && isExpenseFetched && !linkedExpense && (
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground block mb-0.5">Despesa vinculada já excluída</span>
                A despesa original vinculada a este racha já foi removida do seu extrato. Apenas o link e os dados do racha serão excluídos.
              </div>
            )}
          </div>

          {!deleteOriginalExpense && payload.expense_id && hasLinkedExpense && (
            <div className="rounded-lg border border-border/70 bg-surface px-3 py-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Aviso contábil:</span> A despesa original permanecerá no seu extrato e terá seu rateio restaurado para 100% ({formatCentsAsCurrency(totalCents)}).
            </div>
          )}
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => setConfirmDeleteOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={() => void handleDeleteSplit()}
          >
            {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
