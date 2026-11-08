import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  MoneyInput,
  Select,
  type SelectOption,
} from "@/components/ui";
import { useCreateFamily } from "@/state";
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

/**
 * Modal Canônico de Criação de Família.
 * Reutilizável entre a página principal (/familia) e as configurações (DRY).
 */
export function FamilyCreateModal({
  open,
  onOpenChange,
  onSuccess,
}: FamilyCreateModalProps) {
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
      pushToast({
        title: "Informe o nome da família",
        variant: "destructive",
      });
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
      title="Criar Orçamento Familiar"
      description="Configure o grupo compartilhado para centralizar despesas e metas da casa."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label htmlFor="create-family-name-modal" className="text-xs font-semibold text-foreground block">
            Nome da família ou casa
          </label>
          <Input
            id="create-family-name-modal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Família Silva ou Casa 104"
            maxLength={100}
            required
            className="h-10 text-base sm:text-sm rounded-xl"
          />
          <span className="text-[11px] text-muted-foreground block">
            Identificador compartilhado visível para todos os membros da família.
          </span>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="create-family-budget-modal" className="text-xs font-semibold text-foreground block">
            Teto mensal compartilhado <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <MoneyInput
            id="create-family-budget-modal"
            cents={budgetCents ?? 0}
            onCentsChange={(cents) => setBudgetCents(cents > 0 ? cents : null)}
            placeholder="Ex: R$ 5.000,00"
            className="h-10 text-sm rounded-xl"
          />
          <span className="text-[11px] text-muted-foreground block">
            Meta global de gastos do lar para acompanhamento consolidado.
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground block">
            Regra de divisão dos gastos da casa
          </label>
          <Select
            value={splitRule}
            onValueChange={(val) => setSplitRule(val as FamilySplitRule)}
            options={SPLIT_RULE_OPTIONS}
            aria-label="Regra de rateio familiar"
            className="h-10 text-sm rounded-xl"
          />
          <span className="text-[11px] text-muted-foreground block">
            {splitRule === "combined" &&
              "Orçamento e patrimônio 100% unificados. Sem comparações individuais ou acertos via Pix."}
            {splitRule === "equal" &&
              "Rateio meio a meio (50/50) com cálculo de equilíbrio e sugestão de acertos via Pix."}
            {splitRule === "proportional" &&
              "Rateio proporcional às rendas dos participantes, com percentuais customizáveis e acertos via Pix."}
          </span>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={createFamilyMutation.isPending}
            className="rounded-xl cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={createFamilyMutation.isPending || !name.trim()}
            className="rounded-xl cursor-pointer"
          >
            {createFamilyMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
                <span>Criando…</span>
              </>
            ) : (
              <span>Criar Família</span>
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
