import { useId, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
  MoneyInput,
  PercentInput,
  Select,
} from "@/components/ui";
import {
  DEFAULT_MEI_ANNUAL_CEILING_CENTS,
  DEFAULT_MEI_MONTHLY_DAS_CENTS,
  DEFAULT_TAX_PROVISION_RATE_PCT,
} from "@/domain/business";
import { BUSINESS_PROFILE_LABELS } from "@/lib/labels";
import { triggerSensory } from "@/services/sensory";
import type { BusinessProfileKind, BusinessProfileSettings } from "@/types";

export interface BusinessProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: BusinessProfileSettings | null | undefined;
  isSaving?: boolean;
  onSave: (nextProfile: BusinessProfileSettings) => Promise<void>;
  onOpenGuide?: () => void;
}

const PROFILE_KIND_OPTIONS: Array<{ value: BusinessProfileKind; label: string }> = [
  { value: "mei", label: BUSINESS_PROFILE_LABELS.mei },
  { value: "liberal", label: BUSINESS_PROFILE_LABELS.liberal },
  { value: "micro_business", label: BUSINESS_PROFILE_LABELS.micro_business },
];

/** Modal de configuração do perfil fiscal e metas do negócio (MEI/Autônomo). */
export function BusinessProfileDialog({
  open,
  onOpenChange,
  profile,
  isSaving = false,
  onSave,
  onOpenGuide,
}: BusinessProfileDialogProps) {
  const formId = useId();

  const [profileKind, setProfileKind] = useState<BusinessProfileKind>(
    profile?.profileKind ?? "mei",
  );
  const [businessName, setBusinessName] = useState(profile?.businessName ?? "");
  const [monthlyDasCents, setMonthlyDasCents] = useState(
    profile?.monthlyDasCents ?? DEFAULT_MEI_MONTHLY_DAS_CENTS,
  );
  const [taxProvisionRatePct, setTaxProvisionRatePct] = useState(
    profile?.taxProvisionRatePct ?? DEFAULT_TAX_PROVISION_RATE_PCT,
  );
  const [targetProLaboreCents, setTargetProLaboreCents] = useState(
    profile?.targetProLaboreCents ?? 0,
  );
  const [annualCeilingCents, setAnnualCeilingCents] = useState(
    profile?.annualCeilingCents ?? DEFAULT_MEI_ANNUAL_CEILING_CENTS,
  );
  const [openingBalanceCents, setOpeningBalanceCents] = useState(
    profile?.openingBalanceCents ?? 0,
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setProfileKind(profile?.profileKind ?? "mei");
      setBusinessName(profile?.businessName ?? "");
      setMonthlyDasCents(profile?.monthlyDasCents ?? DEFAULT_MEI_MONTHLY_DAS_CENTS);
      setTaxProvisionRatePct(profile?.taxProvisionRatePct ?? DEFAULT_TAX_PROVISION_RATE_PCT);
      setTargetProLaboreCents(profile?.targetProLaboreCents ?? 0);
      setAnnualCeilingCents(profile?.annualCeilingCents ?? DEFAULT_MEI_ANNUAL_CEILING_CENTS);
      setOpeningBalanceCents(profile?.openingBalanceCents ?? 0);
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload: BusinessProfileSettings = {
      profileKind,
      businessName: businessName.trim() || null,
      monthlyDasCents: profileKind === "mei" ? monthlyDasCents : profile?.monthlyDasCents,
      taxProvisionRatePct:
        profileKind !== "mei" ? taxProvisionRatePct : profile?.taxProvisionRatePct,
      targetProLaboreCents,
      annualCeilingCents:
        profileKind === "mei" ? annualCeilingCents : profile?.annualCeilingCents,
      openingBalanceCents,
      onboardingCompleted: true,
    };
    await onSave(payload);
    triggerSensory("success");
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Configurar Meu Negócio"
      description="Defina seu enquadramento fiscal, alíquota de reserva e meta de retirada pessoal."
      size="md"
      showCalculator
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={isSaving}
            loading={isSaving}
          >
            Salvar configurações
          </Button>
        </ModalFooter>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-3.5 pt-2">
        <div className="flex flex-col gap-1.5">
          <FormField label="Enquadramento" htmlFor={`${formId}-kind`}>
            <Select
              id={`${formId}-kind`}
              value={profileKind}
              onValueChange={(value) => setProfileKind(value as BusinessProfileKind)}
              options={PROFILE_KIND_OPTIONS}
              ariaLabel="Enquadramento do negócio"
            />
          </FormField>
          {onOpenGuide ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="gap-1.5 text-xs text-portfolio hover:text-portfolio/80 p-0 h-auto self-start"
              onClick={onOpenGuide}
            >
              <Sparkles className="size-3" aria-hidden="true" />
              <span>Não sabe qual escolher? Faça o teste do perfil</span>
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Nome fantasia / negócio" optional htmlFor={`${formId}-name`}>
            <Input
              id={`${formId}-name`}
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Ex.: Consultório, Studio..."
            />
          </FormField>

          <FormField
            label="Saldo Inicial Profissional"
            optional
            htmlFor={`${formId}-opening-balance`}
            helperText="Saldo inicial do caixa da empresa sem afetar checkpoints bancários."
          >
            <MoneyInput
              id={`${formId}-opening-balance`}
              cents={openingBalanceCents}
              onCentsChange={setOpeningBalanceCents}
              aria-label="Saldo inicial do caixa do negócio"
            />
          </FormField>

          <FormField
            label="Meta de Pró-Labore mensal"
            optional
            htmlFor={`${formId}-prolabore`}
            helperText="Usada no cálculo do Ponto de Equilíbrio."
          >
            <MoneyInput
              id={`${formId}-prolabore`}
              cents={targetProLaboreCents}
              onCentsChange={setTargetProLaboreCents}
              aria-label="Meta mensal de pró-labore"
            />
          </FormField>

          {profileKind === "mei" ? (
            <>
              <FormField
                label="Guia DAS mensal estimada"
                htmlFor={`${formId}-das`}
                helperText="Valor padrão de provisão tributária no MEI."
              >
                <MoneyInput
                  id={`${formId}-das`}
                  cents={monthlyDasCents}
                  onCentsChange={setMonthlyDasCents}
                  aria-label="Valor mensal do DAS"
                />
              </FormField>

              <FormField
                label="Teto anual de faturamento MEI"
                htmlFor={`${formId}-ceiling`}
                helperText="Padrão atual: R$ 81.000,00."
              >
                <MoneyInput
                  id={`${formId}-ceiling`}
                  cents={annualCeilingCents}
                  onCentsChange={setAnnualCeilingCents}
                  aria-label="Teto anual do MEI"
                />
              </FormField>
            </>
          ) : (
            <FormField
              label="Alíquota de reserva fiscal"
              htmlFor={`${formId}-rate`}
              helperText="Percentual separado do faturamento bruto para impostos."
            >
              <PercentInput
                id={`${formId}-rate`}
                value={taxProvisionRatePct}
                onValueChange={setTaxProvisionRatePct}
                maxValue={50}
                aria-label="Alíquota de provisão fiscal"
              />
            </FormField>
          )}
        </div>
      </form>
    </Modal>
  );
}
