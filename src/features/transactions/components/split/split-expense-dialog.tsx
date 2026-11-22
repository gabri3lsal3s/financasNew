import { ExternalLink, MessageCircle, Share2 } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import type { Expense } from "@/types";
import { SplitGeneratedLinkView } from "./split-generated-link-view";
import { SplitParticipantsEditor } from "./split-participants-editor";
import { SplitPixConfigFields } from "./split-pix-config-fields";
import { useSplitExpenseForm } from "./use-split-expense-form";

export interface SplitExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Despesa original opcional a ser dividida */
  expense?: Partial<Expense> | null;
  /** Se o diálogo foi acionado a partir do Wizard de lançamento */
  fromWizard?: boolean;
  /** Valor total alternativo em centavos (caso aberto sem objeto Expense) */
  initialAmountCents?: number;
  /** Descrição alternativa */
  initialDescription?: string;
  /** Data alternativa da despesa (ISO YYYY-MM-DD) */
  initialDate?: string;
  /** Quantidade inicial de participantes (ex.: definido na criação da despesa) */
  initialPeopleCount?: number;
  /** Quantidade de parcelas da despesa */
  initialInstallmentsCount?: number;
  /** Modalidade de cobrança parcelada ("per_installment" | "single_total") */
  initialInstallmentsMode?: "single_total" | "per_installment";
  /** ID da cobrança a receber já vinculada (para evitar duplicidade ao gerar o link) */
  linkedDebtId?: string | null;
  /** Nome da categoria da despesa (para correspondência ao salvar via link) */
  categoryName?: string;
  /** Ícone da categoria */
  categoryIcon?: string;
  /** Se true e os dados Pix estiverem disponíveis, gera o link automaticamente ao abrir */
  autoGenerate?: boolean;
  /** Se true, opera em modo sandbox seguro em memória sem mutações no banco (§Plano 11) */
  isSimulation?: boolean;
}

/** Modal de criação de racha entre amigos com geração de link público e Pix Copia e Cola. */
export function SplitExpenseDialog(props: SplitExpenseDialogProps) {
  const { open, onOpenChange } = props;
  const form = useSplitExpenseForm(props);

  const footer = form.generatedLink ? (
    <ModalFooter borderless>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={form.handleShareWhatsApp}>
        <MessageCircle className="size-3.5 text-positive-strong" aria-hidden="true" />
        <span>WhatsApp</span>
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => void form.handleShareNative()}>
        <Share2 className="size-3.5" aria-hidden="true" />
        <span>Compartilhar</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          if (typeof window !== "undefined" && form.generatedLink) {
            window.open(form.generatedLink, "_blank", "noopener,noreferrer");
          }
        }}
      >
        <ExternalLink className="size-3.5" aria-hidden="true" />
        <span>Ver Página Pública</span>
      </Button>
      <Button type="button" variant="default" size="sm" onClick={() => onOpenChange(false)}>
        Concluir
      </Button>
    </ModalFooter>
  ) : (
    <ModalFooter borderless>
      <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={!form.isFormValid || form.isPending}
        onClick={() => void form.handleGenerateAndCopy()}
        className="gap-1.5"
      >
        <Share2 className="size-3.5" aria-hidden="true" />
        <span>
          {form.isPending
            ? "Gerando Link…"
            : form.isPreconfigured
              ? "Gerar Link & Copiar Pix"
              : "Gerar Racha & Copiar Link"}
        </span>
      </Button>
    </ModalFooter>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={form.isPreconfigured ? "Chave Pix & Link do Racha" : "Rachar Despesa"}
      description={
        form.isPreconfigured
          ? "Sua despesa já foi salva no extrato com o rateio definido. Agora confirme sua chave Pix para gerar o link e o QR Code de cobrança para os amigos."
          : "Divida o valor entre amigos e gere um link público com Pix Copia e Cola automático."
      }
      size="lg"
      showCalculator={!form.generatedLink && !form.isPreconfigured}
      footer={footer}
    >
      <div className="space-y-4">
        {form.generatedLink ? (
          <SplitGeneratedLinkView
            generatedLink={form.generatedLink}
            copied={form.copied}
            onCopyLinkAgain={() => void form.handleCopyLinkAgain()}
            totalCents={form.totalCents}
            summary={form.summary}
          />
        ) : (
          <div className="space-y-4">
            <SplitParticipantsEditor
              isPreconfigured={form.isPreconfigured}
              totalCents={form.totalCents}
              onTotalCentsChange={form.setTotalCents}
              description={form.description}
              onDescriptionChange={form.setDescription}
              peopleCount={form.peopleCount}
              onPeopleCountChange={form.handlePeopleCountChange}
              isCustomMode={form.isCustomMode}
              onCustomModeChange={form.setIsCustomMode}
              splitMode={form.splitMode}
              onSplitModeChange={form.handleSplitModeChange}
              customSharesCents={form.customSharesCents}
              onCustomShareChange={form.handleCustomShareChange}
              participants={form.participants}
              onParticipantNameChange={form.handleParticipantNameChange}
              onAddParticipant={form.handleAddParticipant}
              onRemoveParticipant={form.handleRemoveParticipant}
              summary={form.summary}
              remainderPolicy={form.remainderPolicy}
            />
            <SplitPixConfigFields
              pixKey={form.pixKey}
              onPixKeyChange={form.setPixKey}
              selectedKeyType={form.selectedKeyType}
              onSelectedKeyTypeChange={form.setSelectedKeyType}
              detectedType={form.detectedType}
              validationError={form.pixValidationError}
              isAmbiguousCpfOrPhone={form.isAmbiguousCpfOrPhone}
              onQuickSelectKeyType={(t) => form.setSelectedKeyType(t)}
              merchantName={form.merchantName}
              onMerchantNameChange={form.setMerchantName}
              merchantCity={form.merchantCity}
              onMerchantCityChange={form.setMerchantCity}
              remainderPolicy={form.remainderPolicy}
              onRemainderPolicyChange={form.setRemainderPolicy}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
