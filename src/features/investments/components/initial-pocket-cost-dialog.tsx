import { useState, useMemo } from "react";
import { Landmark, Sparkles } from "lucide-react";
import { Button, Input, Modal, MoneyInput } from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { numberToCents } from "@/domain/money";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  usePortfolioContributions,
  useUpsertMarcoZero,
} from "@/state";

export interface InitialPocketCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCostBRL?: number;
  onSuccess?: () => void;
}

/**
 * Diálogo para Registro e Recalibração do "Marco Zero do Bolso" (Custo Histórico Inicial).
 * Usa o RPC atômico `upsert_marco_zero` para garantir no servidor que existe no máximo
 * 1 Marco Zero por usuário, eliminando duplicatas e distorções na TIR (XIRR).
 */
interface InitialPocketCostFormProps {
  defaultCostBRL: number;
  initialAmountBRL?: number;
  initialDate?: string;
  initialNotes?: string;
  isRecalibration: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

function InitialPocketCostForm({
  defaultCostBRL,
  initialAmountBRL,
  initialDate,
  initialNotes,
  isRecalibration,
  onCancel,
  onSuccess,
}: InitialPocketCostFormProps) {
  const upsertMarcoZero = useUpsertMarcoZero();

  const [costCents, setCostCents] = useState<number>(() => {
    if (initialAmountBRL !== undefined && initialAmountBRL > 0) {
      return numberToCents(initialAmountBRL);
    }
    return defaultCostBRL > 0 ? numberToCents(defaultCostBRL) : 0;
  });

  const [date, setDate] = useState<string>(() => initialDate || "2023-10-17");
  const [notes, setNotes] = useState<string>(
    () => initialNotes || "Marco Zero do Bolso · Custo Histórico Inicial",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (costCents <= 0) {
      setError("Informe um valor maior que zero para o custo histórico do bolso.");
      return;
    }

    setError(null);
    try {
      // RPC atômico: remove TODOS os marcos zeros anteriores do usuário e insere o novo
      // em uma única transação no servidor. Garante unicidade independente de duplicatas.
      await upsertMarcoZero.mutateAsync({
        date,
        amount: costCents / 100,
        notes: notes.trim() || "Marco Zero do Bolso · Custo Histórico Inicial",
      });

      triggerSensory("success");
      pushToast({
        title: isRecalibration ? "Marco Zero recalibrado!" : "Marco Zero do Bolso registrado!",
        description:
          "A TIR da carteira agora reflete com precisão o retorno sobre o seu capital histórico desembolsado.",
      });

      onSuccess?.();
    } catch (err) {
      setError(getErrorMessage(err));
      triggerSensory("error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2 text-xs">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive text-xs font-medium">
          {error}
        </div>
      ) : null}

      {/* Card Didático */}
      <div className="rounded-xl border border-portfolio/30 bg-portfolio/5 p-3 flex items-start gap-2.5">
        <Sparkles className="size-4 text-portfolio shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Como o Marco Zero calibra sua TIR?</span>
          <p>
            1. <strong>Capital do Bolso:</strong> É a soma do dinheiro real que você transferiu da conta para a corretora (não altera o preço médio das suas ações de hoje nem apurações de IR).
          </p>
          <p>
            2. <strong>Data Base Histórica:</strong> A TIR pondera o retorno pelo tempo decorrido. Se você começou em 2023 ou antes, selecione a <strong>data em que iniciou seus investimentos</strong> para que a taxa anualizada (a.a.) calcule os anos reais da sua jornada, evitando taxas artificiais.
          </p>
        </div>
      </div>

      {/* Campo de Valor */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">
          Capital Total que Saiu do Bolso (R$) <span className="text-destructive">*</span>
        </label>
        <MoneyInput
          cents={costCents}
          onCentsChange={setCostCents}
          size="md"
          placeholder="R$ 0,00"
        />
        <span className="text-[11px] text-muted-foreground">
          Soma de todos os aportes líquidos que você transferiu da conta corrente para a corretora.
        </span>
      </div>

      {/* Campo de Data */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">
          Data em que Começou a Investir <span className="text-destructive">*</span>
        </label>
        <DatePicker
          value={date}
          onValueChange={(d) => {
            if (d) setDate(d);
          }}
          placeholder="Selecione quando começou a investir (ex: 2023)"
        />
        <span className="text-[11px] text-muted-foreground">
          Data do seu primeiro aporte ou início da jornada (datas de 2023, 2024 ou anteriores são aceitas).
        </span>
      </div>

      {/* Campo de Observação */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-foreground">
          Identificação / Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Marco Zero do Bolso · Custo Histórico Inicial"
        />
      </div>

      {/* Rodapé Canônico */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-border/60 mt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={upsertMarcoZero.isPending}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={upsertMarcoZero.isPending || costCents <= 0}
          className="w-full sm:w-auto gap-1.5"
        >
          <Landmark className="size-4" aria-hidden="true" />
          <span>
            {upsertMarcoZero.isPending
              ? "Salvando..."
              : isRecalibration
                ? "Salvar Recalibração"
                : "Salvar Marco Zero"}
          </span>
        </Button>
      </div>
    </form>
  );
}

export function InitialPocketCostDialog({
  open,
  onOpenChange,
  defaultCostBRL = 0,
  onSuccess,
}: InitialPocketCostDialogProps) {
  const contributionsQuery = usePortfolioContributions();

  // Localiza o Marco Zero mais recente entre eventuais duplicatas residuais.
  // Após o primeiro save via RPC upsert_marco_zero, nunca haverá mais de 1 registro.
  const existingMarcoZero = useMemo(() => {
    const list = contributionsQuery.data ?? [];
    const marcos = list.filter((c) => {
      const n = (c.notes ?? "").toLowerCase();
      return (
        n.includes("marco zero") ||
        n.includes("custo inicial") ||
        n.includes("histórico inicial")
      );
    });
    return marcos.length > 0
      ? marcos.reduce((latest, c) =>
          (c.created_at ?? "") > (latest.created_at ?? "") ? c : latest,
        )
      : undefined;
  }, [contributionsQuery.data]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={existingMarcoZero ? "Recalibrar Marco Zero do Bolso" : "Definir Marco Zero do Bolso"}
      description="Informe o valor total que saiu da sua conta bancária para os investimentos até o início do uso do app. Isso calibra sua TIR com seu gasto real."
      size="md"
    >
      {open ? (
        <InitialPocketCostForm
          key={`${existingMarcoZero?.id ?? "new"}-${existingMarcoZero?.amount ?? defaultCostBRL}`}
          defaultCostBRL={defaultCostBRL}
          initialAmountBRL={existingMarcoZero?.amount}
          initialDate={existingMarcoZero?.date}
          initialNotes={existingMarcoZero?.notes ?? undefined}
          isRecalibration={Boolean(existingMarcoZero)}
          onCancel={() => onOpenChange(false)}
          onSuccess={() => {
            onOpenChange(false);
            onSuccess?.();
          }}
        />
      ) : null}
    </Modal>
  );
}
