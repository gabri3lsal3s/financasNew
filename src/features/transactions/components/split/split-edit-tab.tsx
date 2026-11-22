import { Plus, Save, Trash2, Users } from "lucide-react";
import { Alert, Badge, Button, DatePicker, FormField, Input, MoneyInput, Select } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { OverpaidParticipantNotice } from "@/domain/finance";
import type { SplitRemainderPolicy } from "@/domain/finance/split-math";
import { formatCentsAsBRL } from "@/services/masks";
import { REMAINDER_OPTIONS } from "./split-constants";

export interface EditableSplitParticipant {
  id: string;
  name: string;
  isHost: boolean;
  fixedCents: number;
  settledCents: number;
  sharePreviewCents: number;
}

export interface SplitEditTabProps {
  title: string;
  onTitleChange: (val: string) => void;
  totalCents: number;
  onTotalCentsChange: (cents: number) => void;
  date: string;
  onDateChange: (val: string) => void;
  dueDate: string;
  onDueDateChange: (val: string) => void;
  isMultiInstallmentGroup: boolean;
  installmentsCount: number;
  installmentsMode: "single_total" | "per_installment";
  onInstallmentsModeChange: (mode: "single_total" | "per_installment") => void;
  remainderPolicy: SplitRemainderPolicy;
  onRemainderPolicyChange: (policy: SplitRemainderPolicy) => void;
  splitMode: "equal" | "custom";
  onSplitModeChange: (mode: "equal" | "custom") => void;
  participants: EditableSplitParticipant[];
  onParticipantNameChange: (index: number, name: string) => void;
  onParticipantFixedCentsChange: (index: number, cents: number) => void;
  onAddParticipant: () => void;
  onRemoveParticipant: (index: number) => void;
  overpaidNotices: OverpaidParticipantNotice[];
  customSumCents: number;
  isValid: boolean;
  isSaving: boolean;
  onSave: () => void;
}

const INSTALLMENT_MODE_OPTIONS = [
  { value: "per_installment", label: "Parcela a parcela (mensal)" },
  { value: "single_total", label: "Cota total à vista" },
];

/** Aba de edição integral dos dados do racha, participantes e divisão de valores. */
export function SplitEditTab({
  title,
  onTitleChange,
  totalCents,
  onTotalCentsChange,
  date,
  onDateChange,
  dueDate,
  onDueDateChange,
  isMultiInstallmentGroup,
  installmentsCount,
  installmentsMode,
  onInstallmentsModeChange,
  remainderPolicy,
  onRemainderPolicyChange,
  splitMode,
  onSplitModeChange,
  participants,
  onParticipantNameChange,
  onParticipantFixedCentsChange,
  onAddParticipant,
  onRemoveParticipant,
  overpaidNotices,
  customSumCents,
  isValid,
  isSaving,
  onSave,
}: SplitEditTabProps) {
  const customDiffCents = totalCents - customSumCents;
  const guestCount = participants.filter((p) => !p.isHost).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
        <FormField label="Nome do racha / despesa" className="sm:col-span-2">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Ex.: Jantar, Viagem, Churrasco..."
            maxLength={80}
            aria-label="Nome do racha"
          />
        </FormField>

        <FormField
          label="Valor total da despesa"
          helperText={
            isMultiInstallmentGroup
              ? "Valor redistribuído proporcionalmente entre as parcelas vinculadas."
              : "Sincronizado automaticamente com a despesa no extrato."
          }
        >
          <MoneyInput
            cents={totalCents}
            onCentsChange={onTotalCentsChange}
            aria-label="Valor total do racha"
          />
        </FormField>

        <FormField
          label="Data da despesa"
          helperText={
            isMultiInstallmentGroup
              ? "Compras parceladas mantêm a data original das parcelas do cartão."
              : undefined
          }
        >
          <DatePicker
            value={date}
            onValueChange={onDateChange}
            disabled={isMultiInstallmentGroup}
            ariaLabel="Data da despesa do racha"
          />
        </FormField>

        <FormField
          label="Vencimento da cobrança"
          helperText="Usado como lembrete na aba Dívidas"
        >
          <DatePicker
            value={dueDate}
            onValueChange={onDueDateChange}
            ariaLabel="Data de vencimento do racha"
          />
        </FormField>

        <FormField label="Política de centavos">
          <Select
            value={remainderPolicy}
            onValueChange={(v) => onRemainderPolicyChange(v as SplitRemainderPolicy)}
            options={REMAINDER_OPTIONS}
            ariaLabel="Política de centavos do racha"
          />
        </FormField>

        {installmentsCount > 1 ? (
          <FormField
            label="Modo de cobrança parcelada"
            helperText={`Compra em ${installmentsCount}x: escolha se os amigos pagam todo mês ou tudo à vista.`}
            className="sm:col-span-2"
          >
            <Select
              value={installmentsMode}
              onValueChange={(v) => onInstallmentsModeChange(v as "single_total" | "per_installment")}
              options={INSTALLMENT_MODE_OPTIONS}
              ariaLabel="Modalidade de cobrança parcelada"
            />
          </FormField>
        ) : null}
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">
              Participantes ({participants.length})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              variant={splitMode === "equal" ? "default" : "outline"}
              onClick={() => onSplitModeChange("equal")}
            >
              Igualitário
            </Button>
            <Button
              type="button"
              size="xs"
              variant={splitMode === "custom" ? "default" : "outline"}
              onClick={() => onSplitModeChange("custom")}
            >
              Valores Personalizados
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {participants.map((p, index) => {
            const hasSettledMoney = p.settledCents > 0;
            const canRemove = !p.isHost && guestCount > 1 && !hasSettledMoney;

            return (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border/60 bg-background/50 p-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={p.name}
                    onChange={(e) => onParticipantNameChange(index, e.target.value)}
                    placeholder={p.isHost ? "Você (Anfitrião)" : `Convidado ${index}`}
                    aria-label={p.isHost ? "Nome do anfitrião" : `Nome do participante ${index + 1}`}
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  {splitMode === "custom" ? (
                    <div className="w-32 shrink-0">
                      <MoneyInput
                        cents={p.fixedCents}
                        onCentsChange={(cents) => onParticipantFixedCentsChange(index, cents)}
                        aria-label={`Valor da cota de ${p.name || `participante ${index + 1}`}`}
                      />
                    </div>
                  ) : (
                    <div className="text-right min-w-20">
                      <MoneyText cents={p.sharePreviewCents} variant="value" className="text-xs font-semibold" />
                    </div>
                  )}

                  {p.isHost ? (
                    <Badge size="xs" variant="muted" className="shrink-0">
                      Anfitrião
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      disabled={!canRemove}
                      onClick={() => onRemoveParticipant(index)}
                      title={
                        hasSettledMoney
                          ? "Desfaça a baixa recebida antes de remover este participante"
                          : guestCount <= 1
                            ? "O racha precisa de pelo menos 1 convidado"
                            : `Remover ${p.name}`
                      }
                      aria-label={`Remover participante ${p.name || index + 1}`}
                      className="text-muted-foreground hover:text-critical p-1 shrink-0"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {splitMode === "custom" ? (
          <div className="pt-1">
            {customDiffCents === 0 ? (
              <span className="text-[11px] font-medium text-positive-strong block">
                Soma das cotas fechada exatamente em {formatCentsAsBRL(totalCents)}.
              </span>
            ) : customDiffCents > 0 ? (
              <span className="text-[11px] font-medium text-warning-strong block">
                Faltam {formatCentsAsBRL(customDiffCents)} para fechar o valor total da despesa.
              </span>
            ) : (
              <span className="text-[11px] font-medium text-critical block">
                A soma das cotas excede o total em {formatCentsAsBRL(Math.abs(customDiffCents))}.
              </span>
            )}
          </div>
        ) : null}

        {participants.length < 50 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onAddParticipant}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span>Adicionar participante</span>
          </Button>
        ) : null}
      </div>

      {overpaidNotices.length > 0 ? (
        <Alert variant="warning">
          <span>
            Com os novos valores, {overpaidNotices.map((n) => `${n.name} (${formatCentsAsBRL(n.previousSettledCents)} pago > nova cota de ${formatCentsAsBRL(n.newShareCents)})`).join(", ")} ficará com o valor recebido ajustado ao novo teto da cota.
          </span>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="default"
          disabled={!isValid || isSaving}
          onClick={onSave}
          className="gap-1.5"
        >
          <Save className="size-3.5" aria-hidden="true" />
          <span>{isSaving ? "Salvando..." : "Salvar Alterações"}</span>
        </Button>
      </div>
    </div>
  );
}
