import { Edit2 } from "lucide-react";
import type { PixKeyProfileSuggestions } from "@/components/modules";
import { Button, DatePicker, Input, MoneyInput, Switch } from "@/components/ui";
import type { PixKeyType } from "@/domain/pix";
import { ShareGoalPixFields } from "./ShareGoalPixFields";

export interface ShareGoalFormProps {
  isEditingExisting: boolean;
  isShared: boolean;
  onSharedChange: (val: boolean) => void;
  title: string;
  onTitleChange: (val: string) => void;
  targetCents: number;
  onTargetCentsChange: (val: number) => void;
  initialCollectedCents: number;
  onInitialCollectedCentsChange: (val: number) => void;
  deadline: string;
  onDeadlineChange: (val: string) => void;
  pixKey: string;
  onPixKeyChange: (val: string) => void;
  selectedKeyType: string;
  onSelectedKeyTypeChange: (val: string) => void;
  detectedType?: PixKeyType | null;
  pixValidationError?: string | null;
  isAmbiguousCpfOrPhone?: boolean;
  onQuickSelectKeyType?: (type: "phone" | "cpf") => void;
  profileSuggestions?: PixKeyProfileSuggestions;
  merchantName: string;
  onMerchantNameChange: (val: string) => void;
  showContributionsPublicly: boolean;
  onShowContributionsPubliclyChange: (val: boolean) => void;
  onCancelEdit: () => void;
  onSubmit: () => void;
}

export function ShareGoalForm({
  isEditingExisting,
  isShared,
  onSharedChange,
  title,
  onTitleChange,
  targetCents,
  onTargetCentsChange,
  initialCollectedCents,
  onInitialCollectedCentsChange,
  deadline,
  onDeadlineChange,
  pixKey,
  onPixKeyChange,
  selectedKeyType,
  onSelectedKeyTypeChange,
  detectedType,
  pixValidationError,
  isAmbiguousCpfOrPhone,
  onQuickSelectKeyType,
  profileSuggestions,
  merchantName,
  onMerchantNameChange,
  showContributionsPublicly,
  onShowContributionsPubliclyChange,
  onCancelEdit,
  onSubmit,
}: ShareGoalFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4 py-2"
    >
      {isEditingExisting && (
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <p className="text-xs font-semibold text-primary-strong flex items-center gap-1.5">
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>Editando Parâmetros da Meta</span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit} className="text-xs text-muted-foreground">
            Cancelar Edição
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            Compartilhar com Link Público &amp; Chave Pix
          </p>
          <p className="text-[11px] text-muted-foreground">
            Ative para permitir acompanhamento público e doações via Pix. Desative para manter como meta privada pessoal.
          </p>
        </div>
        <Switch
          checked={isShared}
          onCheckedChange={onSharedChange}
          aria-label="Compartilhar com Link Público & Chave Pix"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-title" className="text-xs font-semibold text-foreground">
            Título da Meta
          </label>
          <Input
            id="goal-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Ex.: Viagem de Fim de Ano"
            className="text-base sm:text-sm"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Identificação exibida no aplicativo e na página pública.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-target-amount" className="text-xs font-semibold text-foreground">
            Valor Alvo (Total pretendido)
          </label>
          <MoneyInput
            id="goal-target-amount"
            cents={targetCents}
            onCentsChange={onTargetCentsChange}
            placeholder="Ex.: R$ 6.000,00"
            required
          />
          <p className="text-[11px] text-muted-foreground">Valor total a ser atingido.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-collected-amount" className="text-xs font-semibold text-foreground">
            Valor Já Arrecadado {isEditingExisting ? "(Atual)" : "(Inicial)"}
          </label>
          <MoneyInput
            id="goal-collected-amount"
            cents={initialCollectedCents}
            onCentsChange={onInitialCollectedCentsChange}
            placeholder="Ex.: R$ 0,00"
          />
          <p className="text-[11px] text-muted-foreground">
            Valor já computado no termômetro e no progresso.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-deadline" className="text-xs font-semibold text-foreground">
            Data Alvo <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <DatePicker
            id="goal-deadline"
            value={deadline}
            onValueChange={onDeadlineChange}
            placeholder="Selecione a data limite"
            ariaLabel="Data limite para a meta"
          />
          <p className="text-[11px] text-muted-foreground">Habilita contagem regressiva de dias.</p>
        </div>

        {isShared && (
          <ShareGoalPixFields
            pixKey={pixKey}
            onPixKeyChange={onPixKeyChange}
            selectedKeyType={selectedKeyType}
            onSelectedKeyTypeChange={onSelectedKeyTypeChange}
            detectedType={detectedType}
            validationError={pixValidationError}
            isAmbiguousCpfOrPhone={isAmbiguousCpfOrPhone}
            onQuickSelectKeyType={onQuickSelectKeyType}
            profileSuggestions={profileSuggestions}
            merchantName={merchantName}
            onMerchantNameChange={onMerchantNameChange}
            previewInfoAdicional={title}
          />
        )}
      </div>

      {isShared && (
        <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Exibir lista de doadores na página pública
            </p>
            <p className="text-[11px] text-muted-foreground">
              Permite que qualquer pessoa com o link veja os nomes e quantias arrecadadas. Se desativado, apenas você visualiza a lista no app.
            </p>
          </div>
          <Switch
            checked={showContributionsPublicly}
            onCheckedChange={onShowContributionsPubliclyChange}
            aria-label="Exibir lista de doadores na página pública"
          />
        </div>
      )}

      <div className="rounded-xl border border-border/80 bg-surface-raised p-3 text-xs text-muted-foreground">
        {isShared
          ? "O link gerado é público e somente de leitura. Nenhuma conta bancária, saldo pessoal ou transação privada é exposta aos participantes."
          : "Como meta privada, nenhuma informação é compartilhada publicamente ou exposta na internet."}
      </div>
    </form>
  );
}
