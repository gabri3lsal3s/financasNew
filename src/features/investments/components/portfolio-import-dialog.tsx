import { useState } from "react";
import { ArrowRight, Check, FileSpreadsheet, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropzone } from "@/components/ui/dropzone";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyText } from "@/components/ui/money-text";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { numberToCents } from "@/domain/money";
import {
  detectPortfolioColumns,
  parsePortfolioFromMapping,
  parsePortfolioInput,
  parseXlsxToCsv,
  type ParsedPortfolioImportRow,
  type PortfolioColumnMapping,
  type RawPortfolioRow,
} from "@/domain/portfolio";
import { pushToast } from "@/services/toast";
import {
  useCreatePortfolioAsset,
  useCreatePortfolioTransactionsBatch,
  usePortfolioAssets,
  useUpdatePortfolioAsset,
} from "@/state";
import type { PortfolioTransactionType } from "@/types";
import { PortfolioMappingStep } from "./portfolio-mapping-step";

export interface PortfolioImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPERATION_LABEL: Record<PortfolioTransactionType, { label: string; variant: "default" | "positive" | "negative" | "portfolio" | "muted" }> = {
  buy: { label: "Compra", variant: "positive" },
  sell: { label: "Venda", variant: "negative" },
  dividend: { label: "Dividendo", variant: "portfolio" },
  jcp: { label: "JCP", variant: "portfolio" },
  fii_yield: { label: "Rendimento", variant: "portfolio" },
  subscription: { label: "Subscrição", variant: "default" },
  split: { label: "Desdobramento", variant: "muted" },
  reverse_split: { label: "Grupamento", variant: "muted" },
};

const ASSET_CLASS_OPTIONS = [
  { value: "Ações", label: "Ações" },
  { value: "FIIs", label: "FIIs" },
  { value: "ETFs", label: "ETFs" },
  { value: "BDRs", label: "BDRs" },
  { value: "Renda Fixa", label: "Renda Fixa" },
  { value: "Cripto", label: "Cripto" },
  { value: "Internacional", label: "Internacional" },
  { value: "Outros", label: "Outros" },
];

const OPERATION_TYPE_OPTIONS = [
  { value: "buy", label: "Compra / Posição Inicial" },
  { value: "sell", label: "Venda" },
  { value: "dividend", label: "Dividendo" },
  { value: "fii_yield", label: "Rendimento de FII" },
  { value: "jcp", label: "JCP" },
  { value: "subscription", label: "Subscrição" },
  { value: "split", label: "Desdobramento" },
  { value: "reverse_split", label: "Grupamento" },
];

const QUICK_PASTE_EXAMPLES = [
  "15/08 comprei 100 PETR4 a 38,50",
  "10/08 compra de 50 cotas de MXRF11 por 10,25",
  "PETR4, VALE3, MXRF11, AAPL (cadastrar ativos)",
  "20/07 vendi 20 VALE3 a 62,00",
  "recebi 45,80 de dividendo de MXRF11 hoje",
  "12/06 comprei 5 AAPL a 220.50",
];

export function PortfolioImportDialog({ open, onOpenChange }: PortfolioImportDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [activeTab, setActiveTab] = useState("text");
  const [rawText, setRawText] = useState("");
  const [rawRows, setRawRows] = useState<RawPortfolioRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<PortfolioColumnMapping | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedPortfolioImportRow[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: existingAssets = [] } = usePortfolioAssets();
  const createAsset = useCreatePortfolioAsset();
  const updateAsset = useUpdatePortfolioAsset();
  const createTransactionsBatch = useCreatePortfolioTransactionsBatch();

  const existingTickerMap = new Map(existingAssets.map((a) => [a.ticker.trim().toUpperCase(), a]));

  const handleClose = () => {
    setStep(1);
    setRawText("");
    setRawRows([]);
    setColumnMapping(null);
    setParsedRows([]);
    setSelectedIndices(new Set());
    setEditingIndex(null);
    setIsProcessing(false);
    onOpenChange(false);
  };

  const handleProcessInput = (inputText: string) => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      pushToast({
        title: "Conteúdo vazio",
        description: "Cole o texto ou selecione um arquivo de planilha com suas operações.",
        variant: "destructive",
      });
      return;
    }

    // Se possui múltiplas linhas e delimitadores de planilha (; \t | ou , com colunas), abre o Mapeamento de Colunas
    if ((trimmed.includes(";") || trimmed.includes("\t") || trimmed.includes("|") || trimmed.includes(",")) && trimmed.split(/\r?\n/).length > 1) {
      const detection = detectPortfolioColumns(trimmed);
      if (detection.rows.length > 0 && detection.rows[0]?.cells && detection.rows[0].cells.length > 1) {
        setRawRows(detection.rows);
        setColumnMapping(detection.mapping);
        setStep(2);
        return;
      }
    }

    // Processamento natural direto
    const rows = parsePortfolioInput(trimmed);
    if (rows.length === 0) {
      pushToast({
        title: "Nenhuma operação identificada",
        description: "Verifique o formato do texto colado ou o arquivo CSV e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setParsedRows(rows);
    setSelectedIndices(new Set(rows.map((_, i) => i)));
    setStep(3);
  };

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const isXlsx =
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls") ||
        file.type.includes("spreadsheetml") ||
        file.type.includes("excel");

      let content = "";
      if (isXlsx) {
        const buffer = await file.arrayBuffer();
        content = await parseXlsxToCsv(buffer);
        if (!content) {
          pushToast({
            title: "Planilha vazia ou ilegível",
            description: "Não foi possível extrair dados da planilha Excel selecionada.",
            variant: "destructive",
          });
          return;
        }
      } else {
        content = await file.text();
      }

      setRawText(content);
      handleProcessInput(content);
    } catch {
      pushToast({
        title: "Falha ao ler arquivo",
        description: "Não foi possível processar o arquivo selecionado.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmMapping = (mapping: PortfolioColumnMapping) => {
    setColumnMapping(mapping);
    const rows = parsePortfolioFromMapping(rawRows, mapping);
    if (rows.length === 0) {
      pushToast({
        title: "Nenhum lançamento identificado com esse mapeamento",
        description: "Verifique as colunas selecionadas e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setParsedRows(rows);
    setSelectedIndices(new Set(rows.map((_, i) => i)));
    setStep(3);
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsedRows.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedRows.map((_, i) => i)));
    }
  };

  const toggleIndex = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const updateParsedRow = (index: number, updates: Partial<ParsedPortfolioImportRow>) => {
    setParsedRows((prev) => {
      const copy = [...prev];
      const target = copy[index];
      if (!target) return prev;
      const updated = { ...target, ...updates };

      // Se alterou quantidade ou preço, recalcula total
      if (updates.quantity !== undefined || updates.price !== undefined) {
        if (updated.quantity > 0 && updated.price > 0) {
          updated.total = Math.round(updated.quantity * updated.price * 100) / 100;
        }
      } else if (updates.total !== undefined) {
        // Se alterou total e tem quantidade, recalcula preço
        if (updated.quantity > 0 && updated.total > 0) {
          updated.price = Math.round((updated.total / updated.quantity) * 10000) / 10000;
        }
      }

      copy[index] = updated;
      return copy;
    });
  };

  const removeParsedRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const addNewRow = () => {
    const newRow: ParsedPortfolioImportRow = {
      date: new Date().toISOString().slice(0, 10),
      ticker: "NOVO3",
      type: "buy",
      quantity: 100,
      price: 10,
      total: 1000,
      assetClass: "Ações",
      currency: "BRL",
      rawText: "manual",
    };
    setParsedRows((prev) => [newRow, ...prev]);
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      next.add(0);
      for (const idx of prev) next.add(idx + 1);
      return next;
    });
    setEditingIndex(0);
  };

  const handleConfirmImport = async () => {
    const selectedRows = parsedRows.filter((_, i) => selectedIndices.has(i));
    if (selectedRows.length === 0) return;

    setIsProcessing(true);

    try {
      // 1. Identifica ativos únicos que precisam ser criados
      const uniqueTickers = new Map<string, { ticker: string; assetClass?: string | null; currency: "BRL" | "USD" }>();
      for (const row of selectedRows) {
        const key = row.ticker.trim().toUpperCase();
        if (!existingTickerMap.has(key) && !uniqueTickers.has(key)) {
          uniqueTickers.set(key, {
            ticker: key,
            assetClass: row.assetClass,
            currency: row.currency,
          });
        }
      }

      // 2. Cria os novos ativos já com quantidade e preço médio
      const assetMap = new Map(existingTickerMap);
      for (const item of uniqueTickers.values()) {
        const matchingRow = selectedRows.find((r) => r.ticker.trim().toUpperCase() === item.ticker);
        const created = await createAsset.mutateAsync({
          ticker: item.ticker,
          asset_class: item.assetClass ?? "Ações",
          currency: item.currency,
          quantity: matchingRow ? matchingRow.quantity : 0,
          average_price: matchingRow ? matchingRow.price : 0,
        });
        assetMap.set(item.ticker, created);
      }

      // 3. Para ativos que já existiam e foram reimportados com custódia/posição, atualiza a posição
      for (const row of selectedRows) {
        const key = row.ticker.trim().toUpperCase();
        if (existingTickerMap.has(key)) {
          const existing = existingTickerMap.get(key);
          if (existing && (row.quantity > 0 || row.price > 0)) {
            await updateAsset.mutateAsync({
              id: existing.id,
              patch: {
                quantity: row.quantity,
                average_price: row.price,
                asset_class: row.assetClass ?? existing.asset_class,
              },
            });
          }
        }
      }

      // 4. Monta o batch de transações (apenas se houver valor ou quantidade > 0)
      const txRowsToCreate = selectedRows
        .map((row) => {
          const asset = assetMap.get(row.ticker.trim().toUpperCase());
          if (!asset) return null;
          if (row.quantity <= 0 && row.price <= 0 && row.total <= 0) return null;

          return {
            asset_id: asset.id,
            type: row.type,
            date: row.date,
            quantity: row.quantity,
            price: row.price,
            total: row.total,
          };
        })
        .filter((tx): tx is NonNullable<typeof tx> => tx !== null);

      if (txRowsToCreate.length > 0) {
        await createTransactionsBatch.mutateAsync(txRowsToCreate);
      }

      pushToast({
        title: "Importação concluída com sucesso",
        description: `${selectedRows.length} ativos e posições atualizados na carteira.`,
        variant: "default",
      });

      handleClose();
    } catch {
      pushToast({
        title: "Erro ao importar carteira",
        description: "Ocorreu uma falha ao salvar as operações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const quickPasteTabs = [
    {
      value: "text",
      label: "Linguagem Natural / Texto",
      icon: <Sparkles className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-3 pt-2">
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Cole seus lançamentos ou lista de ativos aqui...\nExemplos:\n• ${QUICK_PASTE_EXAMPLES.slice(0, 3).join("\n• ")}`}
            className="min-h-[160px] font-mono text-xs"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Dica: Você pode colar linhas com texto natural, códigos puros ou tabelas copiadas do Excel.
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => handleProcessInput(rawText)}
              disabled={!rawText.trim()}
              className="gap-1.5"
            >
              Processar texto
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        </div>
      ),
    },
    {
      value: "file",
      label: "Planilha (Excel / CSV)",
      icon: <FileSpreadsheet className="size-4" aria-hidden="true" />,
      content: (
        <div className="flex flex-col gap-3 pt-2">
          <Dropzone
            onFiles={handleFileUpload}
            accept=".xlsx,.xls,.csv,.txt,.tsv"
            label="Arraste sua planilha (.xlsx, .csv) ou clique para selecionar"
            hint="Suporta arquivos Excel (.xlsx) e CSV da B3 (Área do Investidor / CEI), Kinvo, Gorila, XP, NuInvest, Inter, BTG, Clear, Rico e Toro."
          />
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Importar Carteira de Investimentos"
      description={
        step === 1
          ? "Cadastre ativos e operações via texto em linguagem natural ou relatórios de corretoras e B3."
          : step === 2
            ? "Verifique o tipo de planilha (Posição Atual ou Movimentações) e ajuste as colunas identificadas."
            : "Confira e edite os valores identificados antes de gravar na sua carteira."
      }
      size="xl"
    >
      {step === 1 && (
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={quickPasteTabs}
          variant="pills"
        />
      )}

      {step === 2 && columnMapping && (
        <PortfolioMappingStep
          rows={rawRows}
          initialMapping={columnMapping}
          onConfirmMapping={handleConfirmMapping}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="selectAllPortfolio"
                checked={selectedIndices.size === parsedRows.length && parsedRows.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="selectAllPortfolio" className="text-xs font-medium text-foreground cursor-pointer select-none">
                Selecionar todos ({selectedIndices.size} de {parsedRows.length})
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addNewRow} className="text-xs gap-1">
                <Plus aria-hidden="true" className="size-3" />
                Adicionar linha
              </Button>

              {rawRows.length > 0 && columnMapping && (
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(2)} className="text-xs gap-1">
                  <RotateCcw aria-hidden="true" className="size-3" />
                  Ajustar colunas
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-xl border border-border/80 bg-surface/40 divide-y divide-border/60 p-1">
            {parsedRows.map((row, idx) => {
              const isSelected = selectedIndices.has(idx);
              const isPositionMode = columnMapping?.mode === "positions";
              const isEditing = editingIndex === idx;
              const op = isPositionMode && row.type === "buy"
                ? { label: "Posição Inicial", variant: "portfolio" as const }
                : OPERATION_LABEL[row.type];
              const isNewAsset = !existingTickerMap.has(row.ticker.trim().toUpperCase());

              if (isEditing) {
                return (
                  <div
                    key={`edit-${row.ticker}-${idx}`}
                    className="p-3.5 bg-surface/90 rounded-xl border border-primary/40 space-y-3 shadow-xs my-1"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Pencil className="size-3.5 text-primary" aria-hidden="true" />
                        Editando ativo #{idx + 1} ({row.ticker})
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingIndex(null)}
                        className="h-6 px-2 text-xs"
                      >
                        <Check className="size-3.5 mr-1 text-positive" aria-hidden="true" />
                        Concluir edição
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Código / Ticker</label>
                        <Input
                          value={row.ticker}
                          onChange={(e) => updateParsedRow(idx, { ticker: e.target.value.toUpperCase().trim() })}
                          className="h-8 text-xs font-mono uppercase"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Data</label>
                        <Input
                          type="date"
                          value={row.date}
                          onChange={(e) => updateParsedRow(idx, { date: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Tipo de Operação</label>
                        <Select
                          value={row.type}
                          onValueChange={(val) => updateParsedRow(idx, { type: val as PortfolioTransactionType })}
                          options={OPERATION_TYPE_OPTIONS}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Classe do Ativo</label>
                        <Select
                          value={row.assetClass ?? "Ações"}
                          onValueChange={(val) => updateParsedRow(idx, { assetClass: val })}
                          options={ASSET_CLASS_OPTIONS}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Quantidade / Cotas</label>
                        <Input
                          type="number"
                          step="any"
                          value={row.quantity || ""}
                          onChange={(e) => updateParsedRow(idx, { quantity: Number.parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">
                          {isPositionMode ? "Preço Médio (R$)" : "Preço Unitário (R$)"}
                        </label>
                        <Input
                          type="number"
                          step="any"
                          value={row.price || ""}
                          onChange={(e) => updateParsedRow(idx, { price: Number.parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-foreground">Valor Total (R$)</label>
                        <Input
                          type="number"
                          step="any"
                          value={row.total || ""}
                          onChange={(e) => updateParsedRow(idx, { total: Number.parseFloat(e.target.value) || 0 })}
                          className="h-8 text-xs font-mono font-semibold text-primary"
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`${row.ticker}-${row.date}-${idx}`}
                  className={`flex items-center justify-between p-3 transition-colors ${
                    isSelected ? "bg-primary/5" : "opacity-60 hover:bg-muted/10"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleIndex(idx)}
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-foreground font-mono">{row.ticker}</span>
                        <Badge variant={op.variant} className="text-[10px]">
                          {op.label}
                        </Badge>
                        {isNewAsset && (
                          <Badge variant="portfolio" className="text-[10px]">
                            Novo ativo
                          </Badge>
                        )}
                        {row.assetClass && (
                          <Badge variant="muted" className="text-[10px]">
                            {row.assetClass}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {isPositionMode ? "Custódia" : row.date} {row.quantity > 0 ? `· ${row.quantity} cotas` : ""}
                        {row.price > 0 ? ` @ ${row.currency === "USD" ? "$" : "R$"}${row.price.toFixed(2)} (${isPositionMode ? "médio" : "un"})` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      {row.total > 0 ? (
                        <MoneyText
                          cents={numberToCents(row.total)}
                          currency={row.currency}
                          className="text-xs font-semibold"
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-medium">Cadastro</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingIndex(idx)}
                        className="size-7 p-0 text-muted-foreground hover:text-foreground"
                        title="Editar valores desta linha"
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParsedRow(idx)}
                        className="size-7 p-0 text-muted-foreground hover:text-destructive"
                        title="Remover linha"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (rawRows.length > 0 ? setStep(2) : setStep(1))}
              className="gap-1.5"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Voltar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmImport}
              disabled={selectedIndices.size === 0 || isProcessing}
              className="gap-1.5"
            >
              <Check aria-hidden="true" className="size-3.5" />
              {isProcessing ? "Importando..." : `Confirmar importação (${selectedIndices.size})`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
