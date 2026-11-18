import type { FormEvent } from "react";
import { KeyRound, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  PercentInput,
  Select,
  type SelectOption,
} from "@/components/ui";
import type { FamilyIncomeRatioSuggestionItem, FamilyPixKeyType, FamilySplitRule } from "@/types";

const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone / Celular" },
  { value: "random", label: "Chave Aleatória" },
];

export interface FamilyMemberProfileTabProps {
  memberDisplayName: string;
  onMemberDisplayNameChange: (val: string) => void;
  memberPixKeyType: FamilyPixKeyType;
  onMemberPixKeyTypeChange: (val: FamilyPixKeyType) => void;
  memberPixKey: string;
  onMemberPixKeyChange: (val: string) => void;
  memberSplitRatioPercent: number;
  onMemberSplitRatioPercentChange: (val: number) => void;
  splitRule?: FamilySplitRule;
  myIncomeSuggestion?: FamilyIncomeRatioSuggestionItem;
  isDirty: boolean;
  isPending: boolean;
  onSubmit: (e: FormEvent) => void;
}

export function FamilyMemberProfileTab({
  memberDisplayName,
  onMemberDisplayNameChange,
  memberPixKeyType,
  onMemberPixKeyTypeChange,
  memberPixKey,
  onMemberPixKeyChange,
  memberSplitRatioPercent,
  onMemberSplitRatioPercentChange,
  splitRule,
  myIncomeSuggestion,
  isDirty,
  isPending,
  onSubmit,
}: FamilyMemberProfileTabProps) {
  return (
    <div className="space-y-4 pt-2">
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Meus Dados na Família</span>
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Configuração pessoal de cada membro
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <FormField label="Meu nome de exibição no grupo" htmlFor="member-display-name">
                <Input
                  id="member-display-name"
                  value={memberDisplayName}
                  onChange={(e) => onMemberDisplayNameChange(e.target.value)}
                  placeholder="Ex: Amor, Pai, Gabriel"
                  className="h-10 text-base sm:text-sm rounded-xl"
                />
              </FormField>

              <FormField label="Tipo de Chave Pix" htmlFor="member-pix-type">
                <Select
                  id="member-pix-type"
                  value={memberPixKeyType}
                  onValueChange={(val) => onMemberPixKeyTypeChange(val as FamilyPixKeyType)}
                  options={PIX_KEY_OPTIONS}
                  ariaLabel="Tipo de Chave Pix"
                  className="h-10 text-base sm:text-sm rounded-xl"
                />
              </FormField>
            </div>

            <FormField
              label="Sua Chave Pix para recebimento de rateios"
              htmlFor="member-pix-key"
              helperText="Utilizada quando o outro membro fizer o acerto mensal de despesas via Pix."
            >
              <Input
                id="member-pix-key"
                value={memberPixKey}
                onChange={(e) => onMemberPixKeyChange(e.target.value)}
                placeholder="Informe a chave Pix (CPF, e-mail ou telefone)"
                className="h-10 text-base sm:text-sm rounded-xl"
              />
            </FormField>

            {splitRule === "proportional" && (
              <div className="space-y-2 pt-2 border-t border-border/80">
                <div className="flex items-center justify-between">
                  <label htmlFor="member-split-ratio" className="text-xs font-semibold text-foreground">
                    Minha cota de participação na casa
                  </label>
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    {memberSplitRatioPercent}%
                  </span>
                </div>
                <PercentInput
                  id="member-split-ratio"
                  value={memberSplitRatioPercent}
                  onValueChange={onMemberSplitRatioPercentChange}
                  className="h-10 text-base sm:text-sm rounded-xl"
                />
                {myIncomeSuggestion ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio text-xs">
                    <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Sugestão baseada na renda dos últimos meses:{" "}
                      <strong>{Math.round(myIncomeSuggestion.suggested_percentage)}%</strong>
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                sensoryIntent={false}
                disabled={!isDirty || isPending}
                loading={isPending}
                className="gap-2 rounded-xl"
              >
                Salvar Meus Dados
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
