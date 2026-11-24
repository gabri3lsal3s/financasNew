import { useId, useMemo, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  Select,
  Skeleton,
} from "@/components/ui";
import { toISODate } from "@/domain/money";
import { formatCentsAsCurrency } from "@/services/masks/money";
import { monthLabel } from "@/lib/date";
import { CHARGE_KIND_LABELS } from "@/lib/labels";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useCategories, useCreateExpense, useUpdateCustomSettings, useUserPreferences } from "@/state";
import type { ChargeKind } from "@/types";

export interface CardChargeDialogProps {
  cardId: string;
  competenceMonth: string; // YYYY-MM
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHARGE_KIND_OPTIONS: Array<{ value: ChargeKind; label: string }> = [
  { value: "interest", label: "Juros" },
  { value: "fine", label: "Multa" },
  { value: "tax", label: "IOF / Tributos" },
  { value: "bank_fee", label: "Tarifa / Anuidade" },
];

function CardChargeContent({
  cardId,
  competenceMonth,
  open,
  onOpenChange,
}: CardChargeDialogProps) {
  const formId = useId();
  const [chargeKind, setChargeKind] = useState<ChargeKind>("interest");
  const [cents, setCents] = useState(0);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [description, setDescription] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useCategories("expense");
  const { data: preferences } = useUserPreferences();
  const updateCustomSettings = useUpdateCustomSettings();
  const createExpense = useCreateExpense();
  const pending = createExpense.isPending;

  const categories = useMemo(() => expenseCategories.data ?? [], [expenseCategories.data]);

  const defaultCategoryId = useMemo(() => {
    if (categories.length === 0) return "";
    const prefId = preferences?.custom_settings?.preferredChargeCategoryId;
    if (prefId && categories.some((c) => c.id === prefId)) {
      return prefId;
    }
    const match = categories.find((c) =>
      /juros|tarifa|banc|cart|finan/i.test(c.name),
    );
    return match ? match.id : (categories[0]?.id ?? "");
  }, [categories, preferences?.custom_settings?.preferredChargeCategoryId]);

  const effectiveCategoryId = selectedCategoryId ?? defaultCategoryId;

  const handleSubmit = async () => {
    setError(null);
    if (cents <= 0) {
      triggerSensory("error");
      setError("Informe um valor maior que zero.");
      return;
    }
    if (!effectiveCategoryId) {
      triggerSensory("error");
      setError("Selecione uma categoria de despesa.");
      return;
    }

    try {
      await createExpense.mutateAsync({
        value: cents / 100,
        date,
        categoryId: effectiveCategoryId,
        paymentMethod: "credit_card",
        cardId,
        description: description.trim() || CHARGE_KIND_LABELS[chargeKind],
        installments: [
          {
            date,
            value: cents / 100,
            billCompetence: competenceMonth,
          },
        ],
        chargeKind,
      });

      void updateCustomSettings
        .mutateAsync({ preferredChargeCategoryId: effectiveCategoryId })
        .catch(() => {});

      triggerSensory("success");
      pushToast({
        title: "Encargo lançado com sucesso",
        description: `${CHARGE_KIND_LABELS[chargeKind]} de ${formatCentsAsCurrency(cents)} adicionado à fatura.`,
      });
      onOpenChange(false);
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Lançar encargo no cartão"
      description={`Fatura de ${monthLabel(competenceMonth)}`}
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={pending || cents <= 0 || !effectiveCategoryId}
          >
            {pending ? "Lançando…" : "Confirmar encargo"}
          </Button>
        </ModalFooter>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && cents > 0 && effectiveCategoryId) void handleSubmit();
        }}
        className="mt-2 flex flex-col gap-4"
      >
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="rounded-xl border border-border/80 bg-surface-raised p-3.5 flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center justify-between font-medium text-foreground">
            <span>Competência da fatura:</span>
            <span className="font-semibold text-foreground">{monthLabel(competenceMonth)}</span>
          </div>
          <p className="leading-relaxed">
            Encargos e tarifas entram no cálculo do Custo do Dinheiro e ajudam no Radar Anti-Juros.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Tipo de encargo" htmlFor="charge-kind">
            <Select
              id="charge-kind"
              value={chargeKind}
              onValueChange={(val) => setChargeKind(val as ChargeKind)}
              options={CHARGE_KIND_OPTIONS}
              ariaLabel="Tipo de encargo"
            />
          </FormField>

          <FormField label="Valor do encargo" htmlFor="charge-amount">
            <MoneyInput
              id="charge-amount"
              cents={cents}
              onCentsChange={setCents}
              aria-label="Valor do encargo"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Categoria" htmlFor="charge-category">
            {expenseCategories.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                id="charge-category"
                value={effectiveCategoryId}
                onValueChange={(val) => setSelectedCategoryId(val)}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Selecione categoria"
                ariaLabel="Categoria do encargo"
              />
            )}
          </FormField>

          <FormField label="Data do lançamento" htmlFor="charge-date">
            <DatePicker
              id="charge-date"
              value={date}
              onValueChange={setDate}
              ariaLabel="Data do encargo"
            />
          </FormField>
        </div>

        <FormField label="Descrição" htmlFor="charge-description" optional>
          <Input
            id="charge-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={CHARGE_KIND_LABELS[chargeKind]}
          />
        </FormField>
      </form>
    </Modal>
  );
}

export function CardChargeDialog(props: CardChargeDialogProps) {
  if (!props.open) return null;
  return <CardChargeContent key={`${props.cardId}:${props.competenceMonth}`} {...props} />;
}
