import { useState, useMemo, useEffect, useRef } from "react";
import { AlertCircle, Calendar, History, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Badge, Button, EmptyState, Input, Modal, MoneyInput } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  usePortfolioContributions,
  useCreateHistoricalContribution,
  useUpdatePortfolioContribution,
  useDeletePortfolioContribution,
} from "@/state";
import type { PortfolioContribution } from "@/types";

export interface InitialPocketCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCostBRL?: number;
  onSuccess?: () => void;
}

/**
 * Diálogo da "Linha do Tempo de Aportes Históricos do Bolso".
 * Permite ao investidor registrar, editar e excluir marcos de desembolso anteriores ao uso do app
 * (ex.: início da carteira, grandes aportes, aportes semestrais consolidados),
 * garantindo precisão temporal cirúrgica no cálculo da TIR (XIRR).
 */
export function InitialPocketCostDialog({
  open,
  onOpenChange,
  defaultCostBRL = 0,
  onSuccess,
}: InitialPocketCostDialogProps) {
  const contributionsQuery = usePortfolioContributions();
  const createHistorical = useCreateHistoricalContribution();
  const updateHistorical = useUpdatePortfolioContribution();
  const deleteContribution = useDeletePortfolioContribution();

  const formRef = useRef<HTMLFormElement>(null);

  // Sempre que o diálogo for aberto, revalida a lista mais recente do servidor
  useEffect(() => {
    if (open) {
      void contributionsQuery.refetch?.();
    }
  }, [open, contributionsQuery]);

  // Filtra todos os marcos históricos e aportes do bolso
  const historicalContributions = useMemo(() => {
    const list = contributionsQuery.data ?? [];
    return list
      .filter((c) => {
        // Se tiver asset_id preenchido (compra de ativo cotizado),
        // só exibe se for marcado explicitamente como marco
        if (c.asset_id) {
          const n = (c.notes ?? "").toLowerCase();
          return n.includes("marco") || n.includes("histórico");
        }
        // Qualquer aporte sem ativo vinculado (asset_id null, undefined ou "")
        // representa um aporte financeiro do bolso e compõe a Linha do Tempo!
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [contributionsQuery.data]);

  // Total acumulado de todos os marcos históricos em reais
  const totalHistoricalBRL = useMemo(() => {
    return historicalContributions.reduce((acc, c) => acc + Number(c.amount), 0);
  }, [historicalContributions]);

  // Estado de edição de um marco
  const [editingMarco, setEditingMarco] = useState<PortfolioContribution | null>(null);

  // Formulário para adicionar ou editar marco
  const [newAmountCents, setNewAmountCents] = useState<number>(() => {
    return historicalContributions.length === 0 && defaultCostBRL > 0
      ? numberToCents(defaultCostBRL)
      : 0;
  });
  const [newDate, setNewDate] = useState<string>("2024-02-26");
  const [newNotes, setNewNotes] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleStartEdit = (marco: PortfolioContribution) => {
    setEditingMarco(marco);
    setNewDate(marco.date);
    setNewAmountCents(numberToCents(Number(marco.amount)));
    setNewNotes(marco.notes ?? "");
    setFormError(null);
    triggerSensory("selection");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleCancelEdit = () => {
    setEditingMarco(null);
    setNewAmountCents(0);
    setNewDate("2024-02-26");
    setNewNotes("");
    setFormError(null);
    triggerSensory("selection");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAmountCents <= 0) {
      setFormError("Informe um valor maior que zero para o marco histórico.");
      return;
    }
    if (!newDate) {
      setFormError("Selecione a data do aporte histórico.");
      return;
    }

    setFormError(null);
    try {
      if (editingMarco) {
        // Atualiza marco existente
        await updateHistorical.mutateAsync({
          id: editingMarco.id,
          input: {
            date: newDate,
            amount: newAmountCents / 100,
            notes: newNotes.trim() || editingMarco.notes || "Marco Histórico do Bolso",
          },
        });
        setEditingMarco(null);
      } else {
        // Cria novo marco histórico
        const defaultLabel =
          historicalContributions.length === 0
            ? "Marco Histórico · Início da Carteira"
            : "Marco Histórico do Bolso";

        await createHistorical.mutateAsync({
          date: newDate,
          amount: newAmountCents / 100,
          notes: newNotes.trim() || defaultLabel,
        });
      }

      // Força recarregamento imediato
      await contributionsQuery.refetch?.();

      // Limpa os campos do formulário para o próximo aporte
      setNewAmountCents(0);
      setNewNotes("");
      triggerSensory("success");
      onSuccess?.();
    } catch (err) {
      setFormError(getErrorMessage(err));
      triggerSensory("error");
    }
  };

  const handleDeleteMarco = async (contribution: PortfolioContribution) => {
    setDeletingId(contribution.id);
    try {
      await deleteContribution.mutateAsync(contribution.id);
      await contributionsQuery.refetch?.();
      triggerSensory("destructive");
      pushToast({
        title: "Marco histórico removido",
        description: "A linha do tempo da TIR foi recalculada.",
        variant: "default",
      });
      if (editingMarco?.id === contribution.id) {
        handleCancelEdit();
      }
      onSuccess?.();
    } catch (err) {
      pushToast({
        title: "Erro ao excluir marco",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDatePT = (isoDate: string) => {
    const parts = isoDate.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
  };

  const isPending = createHistorical.isPending || updateHistorical.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Linha do Tempo de Aportes Históricos"
      description="Registre as saídas reais do seu bolso anteriores ao app. Você pode cadastrar múltiplos marcos (início, aportes em massa ou consolidados) para máxima precisão da TIR."
      size="lg"
    >
      <div className="flex flex-col gap-4 text-xs mt-1">
        {/* Card Resumo Consolidado */}
        <div className="rounded-xl border border-border/80 bg-surface/80 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-portfolio/10 text-portfolio">
              <History className="size-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-muted-foreground text-[11px] font-medium">
                Total do Bolso Registrado no Passado
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-foreground tracking-tight tabular-nums">
                <MoneyText cents={numberToCents(totalHistoricalBRL)} />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge variant="portfolio" size="sm">
              {historicalContributions.length === 1
                ? "1 marco histórico"
                : `${historicalContributions.length} marcos históricos`}
            </Badge>
          </div>
        </div>

        {/* Card de Alerta: Aporte do Mês vs Custo Acumulado */}
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2.5">
          <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Importante: Informe o Aporte do Mês (Delta), não o Saldo Acumulado</span>
            <p>
              Cada marco deve registrar <strong>apenas o dinheiro novo que saiu da sua conta naquele mês</strong>. Não cadastre o custo total acumulado da carteira mês a mês, caso contrário o sistema somará o mesmo patrimônio várias vezes (inflando os aportes e gerando uma TIR irreal).
            </p>
          </div>
        </div>

        {/* Card Didático */}
        <div className="rounded-xl border border-portfolio/20 bg-portfolio/5 p-3 flex items-start gap-2.5">
          <Sparkles className="size-4 text-portfolio shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Como múltiplos marcos refinam sua TIR?</span>
            <p>
              A TIR (XIRR) pondera cada real pelo tempo em que esteve investido. Se você começou com um valor menor e fez uma entrada pesada mais tarde (ex.: R$ 50 mil no fim de 2024), cadastrá-los em marcos separados com suas datas reais impede que a taxa anualizada seja diluída indevidamente.
            </p>
          </div>
        </div>

        {/* Formulário: Adicionar ou Editar Marco */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className={`rounded-xl border p-3.5 flex flex-col gap-3 transition-colors ${
            editingMarco
              ? "border-primary/50 bg-primary/5"
              : "border-border/80 bg-surface/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-xs">
                {editingMarco ? "Editar Marco Histórico" : "Adicionar Novo Marco de Aporte"}
              </span>
              {editingMarco ? (
                <Badge variant="default" size="xs">
                  Modo Edição
                </Badge>
              ) : null}
            </div>
            {formError ? <span className="text-destructive text-[11px]">{formError}</span> : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Campo Data */}
            <div className="sm:col-span-4 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-foreground">
                Data do Aporte <span className="text-destructive">*</span>
              </label>
              <DatePicker
                value={newDate}
                onValueChange={(d) => {
                  if (d) setNewDate(d);
                }}
                placeholder="Data do aporte"
              />
            </div>

            {/* Campo Valor */}
            <div className="sm:col-span-4 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-foreground">
                Valor Desembolsado <span className="text-destructive">*</span>
              </label>
              <MoneyInput
                cents={newAmountCents}
                onCentsChange={setNewAmountCents}
                size="md"
                placeholder="R$ 0,00"
              />
            </div>

            {/* Campo Descrição */}
            <div className="sm:col-span-4 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-foreground">
                Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Ex: Aporte em massa de 2024"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {editingMarco ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isPending}
                className="gap-1"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span>Cancelar</span>
              </Button>
            ) : null}

            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isPending || newAmountCents <= 0}
              className="gap-1.5 w-full sm:w-auto"
            >
              {editingMarco ? (
                <>
                  <Pencil className="size-3.5" aria-hidden="true" />
                  <span>{isPending ? "Salvando..." : "Salvar Alterações"}</span>
                </>
              ) : (
                <>
                  <Plus className="size-4" aria-hidden="true" />
                  <span>{isPending ? "Adicionando..." : "Adicionar Marco"}</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Lista de Marcos Cadastrados */}
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-foreground text-xs">
            Marcos Registrados ({historicalContributions.length})
          </span>

          {historicalContributions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <EmptyState
                title="Nenhum marco cadastrado"
                description="Cadastre o seu primeiro marco acima para que a TIR comece a calcular o retorno sobre o capital real do seu bolso."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
              {historicalContributions.map((marco) => (
                <div
                  key={marco.id}
                  className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2.5 transition-colors ${
                    editingMarco?.id === marco.id
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/70 bg-surface/70 hover:bg-surface-hover/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Calendar className="size-3.5" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-foreground text-xs">
                          {formatDatePT(marco.date)}
                        </span>
                        <Badge variant="muted" size="xs">
                          Histórico
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {marco.notes || "Marco Histórico do Bolso"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold text-xs text-foreground tabular-nums">
                      <MoneyText cents={numberToCents(Number(marco.amount))} />
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(marco)}
                      aria-label={`Editar marco de ${formatDatePT(marco.date)}`}
                      className="size-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMarco(marco)}
                      disabled={deletingId === marco.id}
                      aria-label={`Excluir marco de ${formatDatePT(marco.date)}`}
                      className="size-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé Canônico */}
        <div className="flex items-center justify-end pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Concluir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
