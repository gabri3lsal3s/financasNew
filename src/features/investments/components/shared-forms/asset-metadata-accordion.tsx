import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Checkbox,
  FormField,
  Input,
  MoneyInput,
} from "@/components/ui";
import type { AssetCurrency } from "@/types";

const CLASSES_WITHOUT_DIVIDENDS = new Set(["Cripto", "Caixa"]);

export interface AssetMetadataAccordionProps {
  idPrefix: string;
  assetClass: string;
  currency: AssetCurrency;
  isCash: boolean;
  isFixedIncome: boolean;
  isFamilyModeEnabled: boolean;
  isEmergencyFund: boolean;
  onEmergencyFundChange: (checked: boolean) => void;
  isFamily: boolean;
  onFamilyChange: (checked: boolean) => void;
  distributesInterest: boolean;
  onDistributesInterestChange: (checked: boolean) => void;
  accumulatedDividendsCents: number;
  onAccumulatedDividendsCentsChange: (cents: number) => void;
  estimatedDividendPerShareCents: number;
  onEstimatedDividendPerShareCentsChange: (cents: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}

export function AssetMetadataAccordion({
  idPrefix,
  assetClass,
  currency,
  isCash,
  isFixedIncome,
  isFamilyModeEnabled,
  isEmergencyFund,
  onEmergencyFundChange,
  isFamily,
  onFamilyChange,
  distributesInterest,
  onDistributesInterestChange,
  accumulatedDividendsCents,
  onAccumulatedDividendsCentsChange,
  estimatedDividendPerShareCents,
  onEstimatedDividendPerShareCentsChange,
  notes,
  onNotesChange,
}: AssetMetadataAccordionProps) {
  const canHaveDividends = !CLASSES_WITHOUT_DIVIDENDS.has(assetClass);
  const hasStoredAdvanced =
    notes.trim().length > 0 ||
    accumulatedDividendsCents > 0 ||
    estimatedDividendPerShareCents > 0 ||
    (isFixedIncome && distributesInterest);

  const [openAccordion, setOpenAccordion] = useState<string>(() =>
    hasStoredAdvanced ? "advanced-metadata" : "",
  );

  const moneyPlaceholder = currency === "USD" ? "$ 0.00" : "R$ 0,00";

  const handleDistributesToggle = (checked: boolean) => {
    onDistributesInterestChange(checked);
    if (checked) {
      setOpenAccordion("advanced-metadata");
    } else {
      onAccumulatedDividendsCentsChange(0);
      onEstimatedDividendPerShareCentsChange(0);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {isFixedIncome && !isCash && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface-raised/50 p-3.5">
            <Checkbox
              id={`${idPrefix}-emergency-fund`}
              checked={isEmergencyFund}
              onCheckedChange={(checked) => onEmergencyFundChange(Boolean(checked))}
              label="Compõe minha Reserva de Emergência"
              aria-label="Compõe minha Reserva de Emergência"
            />
            <p className="pl-6 text-[11px] text-muted-foreground">
              Inclui automaticamente este título no termômetro de liquidez e reserva da casa.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <Checkbox
              id={`${idPrefix}-distributes-interest`}
              checked={distributesInterest}
              onCheckedChange={(checked) => handleDistributesToggle(Boolean(checked))}
              label="Distribui juros / cupons periodicamente (NTN-B, CRI, CRA, debêntures)"
            />
            {distributesInterest && (
              <p className="pl-6 text-[11px] text-muted-foreground">
                Informe os proventos anteriores ao cadastro para alimentar o Yield on Cost e a Bola de Neve.
              </p>
            )}
          </div>
        </div>
      )}

      {isFamilyModeEnabled && (
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface-raised/50 p-3.5">
          <Checkbox
            id={`${idPrefix}-is-family`}
            checked={isFamily}
            onCheckedChange={(checked) => onFamilyChange(Boolean(checked))}
            label="Compartilhar com a Família / Reserva"
            aria-label="Compartilhar este ativo com o Modo Família"
          />
          <p className="pl-6 text-[11px] text-muted-foreground">
            Inclui este ativo na consolidação patrimonial e reserva de emergência da casa.
          </p>
        </div>
      )}

      <Accordion
        type="single"
        collapsible
        value={openAccordion}
        onValueChange={setOpenAccordion}
      >
        <AccordionItem value="advanced-metadata">
          <AccordionTrigger className="px-4 py-3 text-xs font-semibold">
            <span>
              Mais detalhes · Anotações e proventos anteriores{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4 pt-1">
            <FormField label="Anotações / Descrição" htmlFor={`${idPrefix}-notes`} optional>
              <Input
                id={`${idPrefix}-notes`}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Ex: Tese, corretora, custódia..."
              />
            </FormField>

            {canHaveDividends && (!isFixedIncome || distributesInterest) && (
              <div className="flex flex-col gap-3 rounded-xl bg-surface p-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-foreground">
                    Proventos Anteriores ao Cadastro
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Alimentam o Yield on Cost e a Bola de Neve sem distorcer o extrato mensal.
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <FormField
                    label={`Total Acumulado Recebido (${currency})`}
                    htmlFor={`${idPrefix}-accumulated-dividends`}
                  >
                    <MoneyInput
                      id={`${idPrefix}-accumulated-dividends`}
                      cents={accumulatedDividendsCents}
                      currency={currency}
                      onCentsChange={onAccumulatedDividendsCentsChange}
                      placeholder={moneyPlaceholder}
                      aria-label="Total de proventos acumulados anteriores ao cadastro"
                    />
                  </FormField>

                  <FormField
                    label={`Estimativa Mensal / Cota (${currency})`}
                    htmlFor={`${idPrefix}-estimated-div-per-share`}
                  >
                    <MoneyInput
                      id={`${idPrefix}-estimated-div-per-share`}
                      cents={estimatedDividendPerShareCents}
                      currency={currency}
                      onCentsChange={onEstimatedDividendPerShareCentsChange}
                      placeholder={moneyPlaceholder}
                      aria-label="Dividendo mensal estimado por cota para cálculo da Bola de Neve"
                    />
                  </FormField>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
