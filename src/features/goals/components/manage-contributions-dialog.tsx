import { useState } from "react";
import {
  Calendar,
  Check,
  Edit2,
  Plus,
  Receipt,
  Trash2,
  User,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  DatePicker,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
} from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { useUpdatePublicShare } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { GoalContribution, PublicShare } from "@/types";

export interface ManageContributionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  share: PublicShare;
}

export function ManageContributionsDialog({
  open,
  onOpenChange,
  share,
}: ManageContributionsDialogProps) {
  const updateShareMutation = useUpdatePublicShare();

  // Modo de Adição
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [newAmountCents, setNewAmountCents] = useState(0);
  const [newContributorName, setNewContributorName] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Modo de Edição de uma contribuição específica
  const [editingContribId, setEditingContribId] = useState<string | null>(null);
  const [editAmountCents, setEditAmountCents] = useState(0);
  const [editContributorName, setEditContributorName] = useState("");
  const [editDate, setEditDate] = useState("");

  // Confirmação de exclusão
  const [deletingContribId, setDeletingContribId] = useState<string | null>(null);

  const payload = share.payload ?? {};
  const title = (payload.title as string) || "Meta Coletiva";
  const contributions: GoalContribution[] = (payload.contributions as GoalContribution[] | undefined) ?? [];

  const handleStartEdit = (contrib: GoalContribution) => {
    triggerSensory("action");
    setEditingContribId(contrib.id);
    setEditAmountCents(contrib.amount_cents);
    setEditContributorName(contrib.contributor_name ?? "");
    setEditDate(contrib.date);
  };

  const handleCancelEdit = () => {
    setEditingContribId(null);
    setEditAmountCents(0);
    setEditContributorName("");
    setEditDate("");
  };

  const saveContributionsUpdate = async (
    newContribsList: GoalContribution[],
    successMessage: string,
  ) => {
    try {
      // Recalcular o valor total acumulado das contribuições
      const sumContribs = newContribsList.reduce((acc, c) => acc + c.amount_cents, 0);

      const updatedPayload = {
        ...payload,
        current_cents: sumContribs,
        contributions: newContribsList,
      };

      await updateShareMutation.mutateAsync({
        id: share.id,
        payload: updatedPayload,
      });

      triggerSensory("action");
      pushToast({
        title: "Atualizado com sucesso!",
        description: successMessage,
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível atualizar",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = async (contribId: string) => {
    if (editAmountCents <= 0) return;

    const updatedList = contributions.map((c) => {
      if (c.id !== contribId) return c;
      return {
        ...c,
        amount_cents: editAmountCents,
        contributor_name: editContributorName.trim() || undefined,
        date: editDate || c.date,
      };
    });

    await saveContributionsUpdate(updatedList, "Dados do depósito atualizados.");
    handleCancelEdit();
  };

  const handleDelete = async (contribId: string) => {
    const updatedList = contributions.filter((c) => c.id !== contribId);
    await saveContributionsUpdate(updatedList, "Depósito removido com sucesso.");
    setDeletingContribId(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAmountCents <= 0) return;

    const newContrib: GoalContribution = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `contrib-${Date.now()}`,
      amount_cents: newAmountCents,
      contributor_name: newContributorName.trim() || undefined,
      date: newDate || new Date().toISOString().slice(0, 10),
    };

    const updatedList = [...contributions, newContrib];
    await saveContributionsUpdate(updatedList, "Novo depósito adicionado.");

    setNewAmountCents(0);
    setNewContributorName("");
    setNewDate(new Date().toISOString().slice(0, 10));
    setIsAddingOpen(false);
  };

  const totalContributionsCents = contributions.reduce((acc, c) => acc + c.amount_cents, 0);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Gestão de Arrecadações & Participantes"
      description={`Gerencie os depósitos e doadores registrados na meta "${title}".`}
      size="lg"
    >
      <div className="flex flex-col gap-4 py-2">
        {/* Painel de Resumo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/80 bg-surface">
          <div className="flex items-center gap-2.5">
            <Users className="size-4.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Arrecadado pelos Participantes</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <MoneyText
                  cents={totalContributionsCents}
                  tone="positive"
                  className="text-base sm:text-lg font-bold"
                />
                <Badge variant="muted" size="xs">
                  {contributions.length} depósito{contributions.length === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              triggerSensory("action");
              setIsAddingOpen((prev) => !prev);
            }}
            className="gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>{isAddingOpen ? "Ocultar Formulário" : "Novo Depósito"}</span>
          </Button>
        </div>

        {/* Formulário Colapsável de Adição */}
        {isAddingOpen && (
          <form
            onSubmit={(e) => void handleAddSubmit(e)}
            className="flex flex-col gap-3 p-3.5 rounded-xl border border-primary/25 bg-primary/5 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span>Registrar Novo Depósito</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="new-contrib-amount" className="text-xs font-medium text-foreground">
                  Valor
                </label>
                <MoneyInput
                  id="new-contrib-amount"
                  cents={newAmountCents}
                  onCentsChange={setNewAmountCents}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="new-contrib-name" className="text-xs font-medium text-foreground">
                  Nome de quem pagou
                </label>
                <div className="relative">
                  <Input
                    id="new-contrib-name"
                    value={newContributorName}
                    onChange={(e) => setNewContributorName(e.target.value)}
                    placeholder="Ex: Lucas, Camila..."
                    className="pl-8"
                  />
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-foreground">
                  Data
                </label>
                <DatePicker
                  value={newDate}
                  onChange={(next) => setNewDate(next ?? new Date().toISOString().slice(0, 10))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={newAmountCents <= 0 || updateShareMutation.isPending}
                className="gap-1.5"
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>Adicionar à Meta</span>
              </Button>
            </div>
          </form>
        )}

        {/* Lista de Contribuições com Edição Inline */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Histórico de Recebimentos</span>
            <span>Ações de Edição e Exclusão</span>
          </div>

          {contributions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-dashed border-border/80 text-center gap-2">
              <Receipt className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs font-medium text-foreground">Nenhum depósito individual registrado ainda</p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                Registre os valores recebidos dos participantes via Pix ou dinheiro para acompanhar o progresso.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/80 bg-surface overflow-hidden">
              {contributions.map((c) => {
                const isEditingThis = editingContribId === c.id;

                if (isEditingThis) {
                  return (
                    <div key={c.id} className="p-3 bg-muted/20 flex flex-col gap-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Edit2 className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span>Editar Depósito</span>
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Valor</label>
                          <MoneyInput
                            cents={editAmountCents}
                            onCentsChange={setEditAmountCents}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Nome de quem pagou</label>
                          <Input
                            value={editContributorName}
                            onChange={(e) => setEditContributorName(e.target.value)}
                            placeholder="Nome ou Anônimo"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-medium text-muted-foreground">Data</label>
                          <DatePicker
                            value={editDate}
                            onChange={(next) => setEditDate(next ?? c.date)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={editAmountCents <= 0 || updateShareMutation.isPending}
                          onClick={() => void handleSaveEdit(c.id)}
                          className="gap-1.5"
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                          <span>Salvar Alterações</span>
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={c.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-surface-hover/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface border border-border/80 text-muted-foreground">
                        <User className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {c.contributor_name || "Participante Anônimo"}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="size-3 text-muted-foreground" aria-hidden="true" />
                          <span>{c.date}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <MoneyText
                        cents={c.amount_cents}
                        tone="positive"
                        className="text-xs sm:text-sm font-bold tabular-nums"
                      />

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7.5 text-muted-foreground hover:text-foreground"
                        onClick={() => handleStartEdit(c)}
                        title="Editar nome ou valor deste depósito"
                        aria-label={`Editar depósito de ${c.contributor_name || "anônimo"}`}
                      >
                        <Edit2 className="size-3.5" aria-hidden="true" />
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7.5 text-critical hover:text-critical"
                        onClick={() => setDeletingContribId(c.id)}
                        title="Excluir este depósito"
                        aria-label={`Excluir depósito de ${c.contributor_name || "anônimo"}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <ModalFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </ModalFooter>
      </div>

      {/* Confirmação de Exclusão */}
      <Modal
        open={deletingContribId !== null}
        onOpenChange={(next) => !next && setDeletingContribId(null)}
        title="Excluir Depósito da Meta?"
        description="Esta contribuição será removida e o valor arrecadado será recalculado automaticamente."
        size="sm"
      >
        <p className="text-xs text-muted-foreground py-2">
          O total acumulado no termômetro e na página pública será reduzido pelo valor deste depósito.
        </p>
        <ModalFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDeletingContribId(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => deletingContribId && void handleDelete(deletingContribId)}
            disabled={updateShareMutation.isPending}
          >
            {updateShareMutation.isPending ? "Excluindo…" : "Confirmar Exclusão"}
          </Button>
        </ModalFooter>
      </Modal>
    </Modal>
  );
}
