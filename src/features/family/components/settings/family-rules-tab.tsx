import type { FormEvent } from "react";
import { DollarSign } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  MoneyInput,
  MoneyText,
  Select,
  type SelectOption,
} from "@/components/ui";
import { FamilyBudgetShareCard } from "../budget-share";
import type { Family, FamilySplitRule } from "@/types";

const SPLIT_RULE_OPTIONS: SelectOption[] = [
  { value: "combined", label: "Finanças Conjuntas (Caixa Único)" },
  { value: "equal", label: "Divisão Igualitária (50% / 50%)" },
  { value: "proportional", label: "Divisão Proporcional à Renda" },
];

export interface FamilyRulesTabProps {
  isOwner: boolean;
  family?: Family;
  editName: string;
  onEditNameChange: (val: string) => void;
  editBudgetCents: number | null;
  onEditBudgetCentsChange: (val: number | null) => void;
  editSplitRule: FamilySplitRule;
  onEditSplitRuleChange: (val: FamilySplitRule) => void;
  isDirty: boolean;
  isPending: boolean;
  onSubmit: (e: FormEvent) => void;
}

export function FamilyRulesTab({
  isOwner,
  family,
  editName,
  onEditNameChange,
  editBudgetCents,
  onEditBudgetCentsChange,
  editSplitRule,
  onEditSplitRuleChange,
  isDirty,
  isPending,
  onSubmit,
}: FamilyRulesTabProps) {
  return (
    <div className="space-y-4 pt-2">
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex flex-row items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <DollarSign className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sm:hidden truncate">Orçamento Doméstico</span>
              <span className="hidden sm:inline truncate">Parâmetros do Orçamento Doméstico</span>
            </span>
            <Badge variant={isOwner ? "default" : "muted"} size="xs" className="shrink-0">
              {isOwner ? "Anfitrião / Titular" : "Participante (Leitura)"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <form onSubmit={onSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <FormField label="Nome da Família / Casa" required htmlFor="family-settings-name">
                  <Input
                    id="family-settings-name"
                    value={editName}
                    onChange={(e) => onEditNameChange(e.target.value)}
                    required
                    className="h-10 text-base sm:text-sm rounded-xl"
                  />
                </FormField>

                <FormField label="Teto Mensal Planejado (R$)" htmlFor="family-settings-budget">
                  <MoneyInput
                    id="family-settings-budget"
                    cents={editBudgetCents ?? 0}
                    onCentsChange={(cents) => onEditBudgetCentsChange(cents > 0 ? cents : null)}
                    placeholder="Ex: R$ 6.000,00"
                    className="h-10 text-base sm:text-sm rounded-xl"
                  />
                </FormField>
              </div>

              <FormField
                label="Regra de Divisão dos Gastos"
                htmlFor="family-settings-split-rule"
                helperText={
                  editSplitRule === "combined"
                    ? "Caixa Único: Orçamento e despesas consolidados sem cálculo de rateios ou dívidas individuais. (Salvo automaticamente ao escolher)"
                    : editSplitRule === "equal"
                      ? "Divisão 50/50: Metade das despesas para cada um, com liquidação de diferenças via Pix. (Salvo automaticamente ao escolher)"
                      : "Proporcional: Divisão calculada com base na renda declarada ou percentual de cada participante. (Salvo automaticamente ao escolher)"
                }
              >
                <Select
                  id="family-settings-split-rule"
                  value={editSplitRule}
                  onValueChange={(val) => onEditSplitRuleChange(val as FamilySplitRule)}
                  options={SPLIT_RULE_OPTIONS}
                  ariaLabel="Regra de rateio familiar"
                  className="h-10 text-base sm:text-sm rounded-xl"
                />
              </FormField>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  sensoryIntent={false}
                  disabled={!isDirty || isPending}
                  loading={isPending}
                  className="gap-2 rounded-xl"
                >
                  Salvar Parâmetros
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                <span className="text-[11px] text-muted-foreground block">Nome do Lar</span>
                <span className="text-sm font-semibold text-foreground block">{family?.name}</span>
              </div>
              <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                <span className="text-[11px] text-muted-foreground block">Teto Mensal</span>
                <MoneyText cents={family?.monthly_budget ?? 0} tone="default" className="font-semibold block" />
              </div>
              <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                <span className="text-[11px] text-muted-foreground block">Modelo de Rateio</span>
                <span className="text-sm font-semibold text-foreground block">
                  {family?.split_rule === "combined"
                    ? "Caixa Único"
                    : family?.split_rule === "equal"
                      ? "50% / 50%"
                      : "Proporcional"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && <FamilyBudgetShareCard />}
    </div>
  );
}
