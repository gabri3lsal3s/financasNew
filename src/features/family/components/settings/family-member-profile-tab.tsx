import type { FormEvent } from "react";
import { KeyRound, Sparkles } from "lucide-react";
import { PixKeyInputFields } from "@/components/modules";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  PercentInput,
} from "@/components/ui";
import type { PixKeyType } from "@/domain/pix";
import type { FamilyIncomeRatioSuggestionItem, FamilySplitRule } from "@/types";

export interface FamilyMemberProfileTabProps {
  memberDisplayName: string;
  onMemberDisplayNameChange: (val: string) => void;
  memberPixKeyType: string;
  onMemberPixKeyTypeChange: (val: string) => void;
  memberPixKey: string;
  onMemberPixKeyChange: (val: string) => void;
  detectedPixType?: PixKeyType | null;
  pixValidationError?: string | null;
  isAmbiguousCpfOrPhone?: boolean;
  hasInvalidPixKey?: boolean;
  onQuickSelectKeyType?: (type: "phone" | "cpf") => void;
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
  detectedPixType = null,
  pixValidationError = null,
  isAmbiguousCpfOrPhone = false,
  hasInvalidPixKey = false,
  onQuickSelectKeyType,
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
            <FormField label="Meu nome de exibição no grupo" htmlFor="member-display-name">
              <Input
                id="member-display-name"
                value={memberDisplayName}
                onChange={(e) => onMemberDisplayNameChange(e.target.value)}
                placeholder="Ex: Amor, Pai, Gabriel"
                className="h-10 text-base sm:text-sm rounded-xl"
              />
            </FormField>

            <PixKeyInputFields
              pixKey={memberPixKey}
              onPixKeyChange={onMemberPixKeyChange}
              selectedKeyType={memberPixKeyType}
              onSelectedKeyTypeChange={onMemberPixKeyTypeChange}
              detectedType={detectedPixType}
              validationError={pixValidationError}
              isAmbiguousCpfOrPhone={isAmbiguousCpfOrPhone}
              onQuickSelectKeyType={onQuickSelectKeyType}
              allowCnpj={false}
              pixKeyId="member-pix-key"
              keyTypeId="member-pix-type"
              pixKeyLabel="Sua Chave Pix para recebimento de rateios"
              pixKeyAriaLabel="Sua Chave Pix para recebimento de rateios"
              pixKeyPlaceholder="Informe a chave Pix (CPF, celular, e-mail ou aleatória)"
              pixKeyHelperText="Utilizada quando o outro membro fizer o acerto mensal de despesas via Pix."
              keyTypeLabel="Tipo de Chave Pix"
              keyTypeAriaLabel="Tipo de Chave Pix"
              showBankRegistrationNotice={true}
              showVerificationBadge={true}
            />

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
                disabled={!isDirty || hasInvalidPixKey || isPending}
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
