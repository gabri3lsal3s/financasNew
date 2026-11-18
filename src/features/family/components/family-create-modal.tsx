import { useId, useState } from "react";
import type { FormEvent } from "react";
import {
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  Select,
  type SelectOption,
} from "@/components/ui";
import { useCreateFamily } from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { FamilySplitRule } from "@/types";

const SPLIT_RULE_OPTIONS: SelectOption[] = [
  { value: "combined", label: "Finanças Conjuntas (Caixa Único)" },
  { value: "equal", label: "Divisão Igualitária (50% / 50%)" },
  { value: "proportional", label: "Divisão Proporcional à Renda" },
];

export interface FamilyCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (familyId: string) => void;
}

export function FamilyCreateModal({
  open,
  onOpenChange,
  onSuccess,
}: FamilyCreateModalProps) {
  const formId = useId();
  const [name, setName] = useState("");
  const [budgetCents, setBudgetCents] = useState<number | null>(null);
  const [splitRule, setSplitRule] = useState<FamilySplitRule>("combined");

  const createFamilyMutation = useCreateFamily();

  const handleReset = () => {
    setName("");
    setBudgetCents(null);
    setSplitRule("combined");
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      triggerSensory("error");
      pushToast({ title: "Informe o nome da família", variant: "destructive" });
      return;
    }

    try {
      const familyId = await createFamilyMutation.mutateAsync({
        name: cleanName,
        monthlyBudget: budgetCents && budgetCents > 0 ? budgetCents : null,
        splitRule,
      });
      handleClose();
      onSuccess?.(familyId);
    } catch {
      // Toast e feedback sensorial tratados na mutation
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(true);
      }}
      title="Criar Família"
      description="Configure o grupo compartilhado para centralizar despesas e metas da casa."
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={createFamilyMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="default"
            sensoryIntent={false}
            disabled={createFamilyMutation.isPending || !name.trim()}
            loading={createFamilyMutation.isPending}
          >
            Criar Família
          </Button>
        </ModalFooter>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4 pt-2">
        <FormField
          label="Nome da família ou casa"
          required
          htmlFor="create-family-name-modal"
          helperText="Identificador compartilhado visível para todos os membros da família."
        >
          <Input
            id="create-family-name-modal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Família Silva ou Casa 104"
            maxLength={100}
            required
            className="h-10 text-base sm:text-sm rounded-xl"
          />
        </FormField>

        <FormField
          label="Teto mensal compartilhado"
          optional
          htmlFor="create-family-budget-modal"
          helperText="Meta global de gastos do lar para acompanhamento consolidado."
        >
          <MoneyInput
            id="create-family-budget-modal"
            cents={budgetCents ?? 0}
            onCentsChange={(cents) => setBudgetCents(cents > 0 ? cents : null)}
            placeholder="Ex: R$ 5.000,00"
            className="h-10 text-base sm:text-sm rounded-xl"
          />
        </FormField>

        <FormField
          label="Regra de divisão dos gastos da casa"
          htmlFor="create-family-split-rule"
          helperText={
            splitRule === "combined"
              ? "Orçamento e patrimônio 100% unificados. Sem comparações individuais ou acertos via Pix."
              : splitRule === "equal"
                ? "Rateio meio a meio (50/50) com cálculo de equilíbrio e sugestão de acertos via Pix."
                : "Rateio proporcional às rendas dos participantes, com percentuais customizáveis e acertos via Pix."
          }
        >
          <Select
            id="create-family-split-rule"
            value={splitRule}
            onValueChange={(val) => setSplitRule(val as FamilySplitRule)}
            options={SPLIT_RULE_OPTIONS}
            ariaLabel="Regra de rateio familiar"
            className="h-10 text-base sm:text-sm rounded-xl"
          />
        </FormField>
      </form>
    </Modal>
  );
}
