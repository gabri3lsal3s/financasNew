import { useState, useMemo, useEffect, useRef } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  History,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Badge, Button, EmptyState, Input, Modal, MoneyInput, Tabs, Textarea } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { MoneyText } from "@/components/ui/money-text";
import { isHistoricalWithdrawal, parseBrokerStatement, type StatementParseResult } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  usePortfolioContributions,
  useCreateHistoricalContribution,
  useUpdatePortfolioContribution,
  useDeletePortfolioContribution,
  useBatchCreateHistoricalContributions,
  useUpsertMarcoZero,
} from "@/state";
import type { PortfolioContribution } from "@/types";

export interface InitialPocketCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCostBRL?: number;
  onSuccess?: () => void;
}

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
  const batchCreateHistorical = useBatchCreateHistoricalContributions();
  const upsertMarcoZero = useUpsertMarcoZero();

  const formRef = useRef<HTMLFormElement>(null);

  // Aba ativa: "extrato" | "manual" | "rapido"
  const [activeTab, setActiveTab] = useState<string>("manual");

  // Revalida dados sempre que o diálogo for aberto
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
        if (c.asset_id) {
          const n = (c.notes ?? "").toLowerCase();
          return n.includes("marco") || n.includes("histórico");
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [contributionsQuery.data]);

  // Métricas do bolso calculadas separando Aportes de Resgates
  const { totalAportesBRL, totalResgatesBRL, netPocketCapitalBRL } = useMemo(() => {
    let aportes = 0;
    let resgates = 0;

    for (const c of historicalContributions) {
      const amount = Number(c.amount);
      if (isHistoricalWithdrawal(c)) {
        resgates += amount;
      } else {
        aportes += amount;
      }
    }

    return {
      totalAportesBRL: aportes,
      totalResgatesBRL: resgates,
      netPocketCapitalBRL: Math.round((aportes - resgates) * 100) / 100,
    };
  }, [historicalContributions]);

  // ---------------------------------------------------------------------------
  // Estado da Aba Manual (Lançamento Individual)
  // ---------------------------------------------------------------------------
  const [editingMarco, setEditingMarco] = useState<PortfolioContribution | null>(null);
  const [entryType, setEntryType] = useState<"aporte" | "resgate">("aporte");
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
    const isWithdrawal = isHistoricalWithdrawal(marco);
    setEntryType(isWithdrawal ? "resgate" : "aporte");
    setNewDate(marco.date);
    setNewAmountCents(numberToCents(Number(marco.amount)));

    // Limpa tags de sistema das notas para exibição limpa
    const cleanNotes = (marco.notes ?? "")
      .replace(/^\[Resgate\]\s*/i, "")
      .replace(/^\[Retirada\]\s*/i, "");
    setNewNotes(cleanNotes);
    setFormError(null);
    triggerSensory("selection");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleCancelEdit = () => {
    setEditingMarco(null);
    setEntryType("aporte");
    setNewAmountCents(0);
    setNewDate("2024-02-26");
    setNewNotes("");
    setFormError(null);
    triggerSensory("selection");
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newAmountCents <= 0) {
      setFormError("Informe um valor maior que zero.");
      return;
    }
    if (!newDate) {
      setFormError("Selecione a data do marco histórico.");
      return;
    }

    setFormError(null);
    try {
      const isWithdrawal = entryType === "resgate";
      const prefix = isWithdrawal ? "[Resgate] " : "";
      const defaultLabel = isWithdrawal
        ? "Retirada do Bolso"
        : historicalContributions.length === 0
          ? "Marco Histórico · Início da Carteira"
          : "Aporte Histórico do Bolso";

      const finalNotes = `${prefix}${newNotes.trim() || defaultLabel}`;

      if (editingMarco) {
        await updateHistorical.mutateAsync({
          id: editingMarco.id,
          input: {
            date: newDate,
            amount: newAmountCents / 100,
            notes: finalNotes,
          },
        });
        setEditingMarco(null);
      } else {
        await createHistorical.mutateAsync({
          date: newDate,
          amount: newAmountCents / 100,
          notes: finalNotes,
        });
      }

      await contributionsQuery.refetch?.();
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

  // ---------------------------------------------------------------------------
  // Estado da Aba Assistente de Extrato
  // ---------------------------------------------------------------------------
  const [statementText, setStatementText] = useState<string>("");
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const handleProcessStatement = () => {
    if (!statementText.trim()) {
      pushToast({
        title: "Texto vazio",
        description: "Cole o conteúdo do seu extrato antes de analisar.",
        variant: "warning",
      });
      return;
    }

    const result = parseBrokerStatement(statementText);
    setParseResult(result);
    triggerSensory("selection");

    if (result.actionableRows.length === 0) {
      pushToast({
        title: "Nenhum marco detectado",
        description: "Verifique se o texto contém colunas com Mês/Ano e Valor Aplicado.",
        variant: "warning",
      });
    } else {
      pushToast({
        title: "Extrato processado com sucesso!",
        description: `${result.actionableRows.length} movimentação(ões) identificada(s).`,
        variant: "success",
      });
    }
  };

  const handleConfirmImportStatement = async () => {
    if (!parseResult || parseResult.actionableRows.length === 0) return;

    setIsImporting(true);
    try {
      // 1. Se marcado para substituir, exclui os marcos históricos existentes
      if (replaceExisting && historicalContributions.length > 0) {
        for (const item of historicalContributions) {
          await deleteContribution.mutateAsync(item.id);
        }
      }

      // 2. Insere os novos marcos calculados em lote
      const payloads = parseResult.actionableRows.map((row) => ({
        asset_id: null,
        date: row.date,
        amount: Math.abs(row.delta),
        notes: row.suggestedNotes,
      }));

      await batchCreateHistorical.mutateAsync(payloads);
      await contributionsQuery.refetch?.();

      setStatementText("");
      setParseResult(null);
      setActiveTab("manual");
      triggerSensory("success");
      onSuccess?.();
    } catch (err) {
      pushToast({
        title: "Erro ao importar marcos",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("error");
    } finally {
      setIsImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Estado da Aba Modo Rápido (Consolidado)
  // ---------------------------------------------------------------------------
  const [quickDate, setQuickDate] = useState<string>("2024-02-26");
  const [quickAmountCents, setQuickAmountCents] = useState<number>(() => {
    return defaultCostBRL > 0 ? numberToCents(defaultCostBRL) : 0;
  });

  const handleSaveQuick = async () => {
    if (quickAmountCents <= 0) {
      pushToast({
        title: "Valor inválido",
        description: "Informe o capital total desembolsado do seu bolso.",
        variant: "warning",
      });
      return;
    }

    try {
      await upsertMarcoZero.mutateAsync({
        date: quickDate,
        amount: quickAmountCents / 100,
        notes: "Marco Histórico Consolidado",
      });
      await contributionsQuery.refetch?.();
      triggerSensory("success");
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      pushToast({
        title: "Erro ao salvar marco consolidado",
        description: getErrorMessage(err),
        variant: "destructive",
      });
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
      description="Calibre com precisão as entradas e saídas do seu bolso anteriores ao app para cálculo exato da TIR (XIRR)."
      size="xl"
    >
      <div className="flex flex-col gap-4 text-xs mt-1">
        {/* Painel de Métricas do Bolso */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-border/80 bg-surface/80 p-3 flex flex-col justify-between gap-1 shadow-xs">
            <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-positive" aria-hidden="true" />
              Total Aportado (+)
            </span>
            <span className="text-base font-bold font-mono text-foreground tracking-tight tabular-nums">
              <MoneyText cents={numberToCents(totalAportesBRL)} />
            </span>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface/80 p-3 flex flex-col justify-between gap-1 shadow-xs">
            <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
              <ArrowDownRight className="size-3.5 text-warning" aria-hidden="true" />
              Total Resgatado (-)
            </span>
            <span className="text-base font-bold font-mono text-foreground tracking-tight tabular-nums">
              <MoneyText cents={numberToCents(totalResgatesBRL)} />
            </span>
          </div>

          <div className="rounded-xl border border-portfolio/30 bg-portfolio/5 p-3 flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
                <History className="size-3.5 text-portfolio" aria-hidden="true" />
                Capital Líquido do Bolso
              </span>
              <Badge variant="portfolio" size="xs">
                {historicalContributions.length} marcos
              </Badge>
            </div>
            <span className="text-base font-bold font-mono text-foreground tracking-tight tabular-nums">
              <MoneyText cents={numberToCents(netPocketCapitalBRL)} />
            </span>
          </div>
        </div>

        {/* Abas de Navegação dos Modos */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          variant="pills"
          fullWidth
          items={[
            {
              value: "manual",
              label: "Lançamento Individual",
              icon: <History className="size-3.5" aria-hidden="true" />,
            },
            {
              value: "extrato",
              label: "Assistente de Extrato",
              icon: <Sparkles className="size-3.5" aria-hidden="true" />,
            },
            {
              value: "rapido",
              label: "Modo Rápido",
              icon: <Zap className="size-3.5" aria-hidden="true" />,
            },
          ]}
        />

        {/* =================================================================== */}
        {/* ABA 1: ASSISTENTE DE EXTRATO INTELIGENTE */}
        {/* =================================================================== */}
        {activeTab === "extrato" ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-portfolio/20 bg-portfolio/5 p-3 flex items-start gap-2.5">
              <Sparkles className="size-4 text-portfolio shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Cálculo Automático de Aportes e Resgates
                </span>
                <p>
                  Copie a tabela do extrato da sua corretora ou banco (com colunas como Mês, Ano, Valor Aplicado e Saldo) e cole abaixo. O assistente calculará automaticamente os deltas de cada mês, identificará aportes e resgates e descartará meses zerados.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Textarea
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                placeholder={`Cole o extrato aqui...\nExemplo:\nOut. 2023  6.187,37  6.147,97\nNov. 2023  8.678,16  8.745,74\nDez. 2023  13.527,62 14.221,47`}
                rows={5}
                className="font-mono text-xs"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Suporta formatos da XP, BTG, Itaú, Kinvo, Gorila e planilhas Excel.
                </span>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleProcessStatement}
                  className="gap-1.5"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>Processar Extrato</span>
                </Button>
              </div>
            </div>

            {/* Pré-visualização do Extrato Analisado */}
            {parseResult ? (
              <div className="rounded-xl border border-border/80 bg-surface/80 p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-xs">
                      Pré-visualização dos Marcos Detectados
                    </span>
                    <Badge variant="default" size="xs">
                      {parseResult.actionableRows.length} movimentações
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Capital Líquido: <MoneyText cents={numberToCents(parseResult.netCapital)} />
                  </span>
                </div>

                {/* Resumo do Parser */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-surface border border-border/60 flex flex-col">
                    <span className="text-muted-foreground">Meses Analisados</span>
                    <span className="font-semibold font-mono text-foreground">
                      {parseResult.rows.length}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-border/60 flex flex-col">
                    <span className="text-muted-foreground">Aportes Brutos</span>
                    <span className="font-semibold font-mono text-positive">
                      + <MoneyText cents={numberToCents(parseResult.totalAportes)} />
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-border/60 flex flex-col">
                    <span className="text-muted-foreground">Resgates Brutos</span>
                    <span className="font-semibold font-mono text-warning">
                      - <MoneyText cents={numberToCents(parseResult.totalResgates)} />
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface border border-border/60 flex flex-col">
                    <span className="text-muted-foreground">Meses sem aporte</span>
                    <span className="font-semibold font-mono text-muted-foreground">
                      {parseResult.rows.length - parseResult.actionableRows.length} (ignorados)
                    </span>
                  </div>
                </div>

                {/* Lista de Marcos Acionáveis */}
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                  {parseResult.actionableRows.map((row, idx) => (
                    <div
                      key={`${row.date}-${idx}`}
                      className="rounded-lg border border-border/60 bg-surface px-2.5 py-1.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground font-medium">
                          {formatDatePT(row.date)}
                        </span>
                        <Badge
                          variant={row.type === "resgate" ? "warning" : "muted"}
                          size="xs"
                        >
                          {row.type === "resgate" ? "Resgate" : "Aporte"}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                          {row.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums ${
                            row.type === "resgate" ? "text-warning" : "text-positive"
                          }`}
                        >
                          {row.type === "resgate" ? "- " : "+ "}
                          <MoneyText cents={numberToCents(Math.abs(row.delta))} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Opção de Substituição e Confirmação */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-border/60">
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary/20"
                    />
                    <span>Substituir marcos anteriores cadastrados (recomendado)</span>
                  </label>

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleConfirmImportStatement}
                    disabled={isImporting}
                    className="gap-1.5 w-full sm:w-auto"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    <span>
                      {isImporting
                        ? "Gravando..."
                        : `Gravar ${parseResult.actionableRows.length} Marcos`}
                    </span>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* =================================================================== */}
        {/* ABA 2: LANÇAMENTO INDIVIDUAL (MANUAL) */}
        {/* =================================================================== */}
        {activeTab === "manual" ? (
          <div className="flex flex-col gap-4">
            {/* Card Didático sobre Deltas */}
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2.5">
              <AlertCircle className="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex flex-col gap-0.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Informe apenas as movimentações do mês (Deltas)
                </span>
                <p>
                  Cadastre apenas o dinheiro que <strong>entrou (Aporte)</strong> ou <strong>saiu (Resgate)</strong> da sua conta. Se tiver o extrato bancário com o valor acumulado mês a mês, utilize a aba <strong>Assistente de Extrato</strong> para calcular tudo automaticamente.
                </p>
              </div>
            </div>

            {/* Formulário: Adicionar ou Editar Marco Individual */}
            <form
              ref={formRef}
              onSubmit={handleSubmitManual}
              className={`rounded-xl border p-3.5 flex flex-col gap-3 transition-colors ${
                editingMarco
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/80 bg-surface/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-xs">
                    {editingMarco ? "Editar Marco Histórico" : "Adicionar Novo Marco"}
                  </span>
                  {editingMarco ? (
                    <Badge variant="default" size="xs">
                      Modo Edição
                    </Badge>
                  ) : null}
                </div>
                {formError ? <span className="text-destructive text-[11px]">{formError}</span> : null}
              </div>

              {/* Seletor de Tipo: Aporte (+) vs Resgate (-) */}
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface border border-border/60 self-start">
                <Button
                  type="button"
                  variant={entryType === "aporte" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEntryType("aporte")}
                  className="gap-1.5 text-xs py-1 h-7"
                >
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  <span>Aporte (+)</span>
                </Button>
                <Button
                  type="button"
                  variant={entryType === "resgate" ? "warning" : "ghost"}
                  size="sm"
                  onClick={() => setEntryType("resgate")}
                  className="gap-1.5 text-xs py-1 h-7"
                >
                  <ArrowDownRight className="size-3.5" aria-hidden="true" />
                  <span>Resgate (-)</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Campo Data */}
                <div className="sm:col-span-4 flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-foreground">
                    Data da Movimentação <span className="text-destructive">*</span>
                  </label>
                  <DatePicker
                    value={newDate}
                    onValueChange={(d) => {
                      if (d) setNewDate(d);
                    }}
                    placeholder="Data"
                  />
                </div>

                {/* Campo Valor */}
                <div className="sm:col-span-4 flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-foreground">
                    {entryType === "resgate" ? "Valor Retirado" : "Valor Aportado"}{" "}
                    <span className="text-destructive">*</span>
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
                    placeholder={
                      entryType === "resgate"
                        ? "Ex: Resgate parcial de 2024"
                        : "Ex: Aporte inicial de 2024"
                    }
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
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">
                  Marcos Registrados ({historicalContributions.length})
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Líquido: <MoneyText cents={numberToCents(netPocketCapitalBRL)} />
                </span>
              </div>

              {historicalContributions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <EmptyState
                    title="Nenhum marco cadastrado"
                    description="Cadastre o seu primeiro marco acima ou importe pelo Assistente de Extrato para que a TIR calcule o retorno sobre o capital real."
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {historicalContributions.map((marco) => {
                    const isWithdrawal = isHistoricalWithdrawal(marco);
                    return (
                      <div
                        key={marco.id}
                        className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2.5 transition-colors ${
                          editingMarco?.id === marco.id
                            ? "border-primary/60 bg-primary/10"
                            : "border-border/70 bg-surface/70 hover:bg-surface-hover/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`flex size-7 shrink-0 items-center justify-center rounded-md ${
                              isWithdrawal
                                ? "bg-warning/10 text-warning"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Calendar className="size-3.5" aria-hidden="true" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-foreground text-xs">
                                {formatDatePT(marco.date)}
                              </span>
                              <Badge
                                variant={isWithdrawal ? "warning" : "muted"}
                                size="xs"
                              >
                                {isWithdrawal ? "Resgate" : "Aporte"}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {(marco.notes ?? "")
                                .replace(/^\[Resgate\]\s*/i, "")
                                .replace(/^\[Retirada\]\s*/i, "") || "Marco Histórico"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-mono font-semibold text-xs tabular-nums ${
                              isWithdrawal ? "text-warning" : "text-foreground"
                            }`}
                          >
                            {isWithdrawal ? "- " : "+ "}
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
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* =================================================================== */}
        {/* ABA 3: MODO RÁPIDO (MARCO ZERO CONSOLIDADO) */}
        {/* =================================================================== */}
        {activeTab === "rapido" ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border/80 bg-surface/80 p-3.5 flex flex-col gap-2">
              <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                <Zap className="size-4 text-warning" aria-hidden="true" />
                Marco Zero Consolidado em 1 Clique
              </span>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Se você não possui o histórico mês a mês ou prefere praticidade imediata, basta informar a <strong>data em que começou a investir</strong> nesta carteira e o <strong>total que saiu do seu bolso até hoje</strong>. O sistema registrará um marco único e calculará a TIR com base nesse horizonte.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-border/80 bg-surface">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Data de Início da Carteira
                </label>
                <DatePicker
                  value={quickDate}
                  onValueChange={(d) => {
                    if (d) setQuickDate(d);
                  }}
                  placeholder="Data de início"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Capital Total Desembolsado do Bolso
                </label>
                <MoneyInput
                  cents={quickAmountCents}
                  onCentsChange={setQuickAmountCents}
                  size="md"
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveQuick}
                disabled={upsertMarcoZero.isPending || quickAmountCents <= 0}
                className="gap-1.5"
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>
                  {upsertMarcoZero.isPending ? "Salvando..." : "Definir Marco Zero Consolidado"}
                </span>
              </Button>
            </div>
          </div>
        ) : null}

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
