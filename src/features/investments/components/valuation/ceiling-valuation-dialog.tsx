import { useMemo } from "react";
import { Check } from "lucide-react";
import { Button, FormField, Input, Modal, ModalFooter, Tabs, type TabItem } from "@/components/ui";
import { formatCeilingCurrency } from "@/domain/portfolio/ceiling-valuation";
import { CeilingBazinForm } from "./ceiling-bazin-form";
import { CeilingConsensusPanel } from "./ceiling-consensus-panel";
import { CeilingFiiForm } from "./ceiling-fii-form";
import { CeilingGordonForm } from "./ceiling-gordon-form";
import { CeilingGrahamForm } from "./ceiling-graham-form";
import { useCeilingValuation, type UseCeilingValuationParams } from "./use-ceiling-valuation";

export interface CeilingValuationDialogProps extends UseCeilingValuationParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CeilingValuationDialog({
  open,
  onOpenChange,
  ticker,
  assetClass,
  currency = "BRL",
  currentPrice,
  initialCeilingPrice,
  initialCeilingMethod,
  initialCeilingMetadata,
  onApply,
  onClose,
}: CeilingValuationDialogProps) {
  const handleDialogClose = () => {
    onClose?.();
    onOpenChange(false);
  };

  const valuation = useCeilingValuation({
    ticker,
    assetClass,
    currency,
    currentPrice,
    initialCeilingPrice,
    initialCeilingMethod,
    initialCeilingMetadata,
    onApply,
    onClose: handleDialogClose,
  });

  const {
    isFii,
    activeTab,
    setActiveTab,
    bazinDpaStr,
    setBazinDpaStr,
    bazinYieldPct,
    setBazinYieldPct,
    grahamLpaStr,
    setGrahamLpaStr,
    grahamVpaStr,
    setGrahamVpaStr,
    grahamMarginPct,
    setGrahamMarginPct,
    gordonDpaStr,
    setGordonDpaStr,
    gordonGrowthPct,
    setGordonGrowthPct,
    gordonRequiredPct,
    setGordonRequiredPct,
    fiiMode,
    setFiiMode,
    fiiMonthlyDividendStr,
    setFiiMonthlyDividendStr,
    fiiYieldPct,
    setFiiYieldPct,
    fiiVpaStr,
    setFiiVpaStr,
    fiiMaxPvp,
    setFiiMaxPvp,
    manualPriceStr,
    setManualPriceStr,
    manualNotes,
    setManualNotes,
    consensusRule,
    setConsensusRule,
    selectedSpecificMethod,
    setSelectedSpecificMethod,
    computedModels,
    effectivePrice,
    handleApply,
  } = valuation;

  const currentPriceFormatted = currentPrice > 0 ? formatCeilingCurrency(currentPrice, currency) : "Sem cotação";

  const tabItems: TabItem[] = useMemo(() => {
    const manualContentElement = (
      <div className="flex flex-col gap-3">
        <FormField
          label="Preço Teto Manual"
          htmlFor="manual-ceiling-input"
          helperText="Digite o preço máximo de compra estipulado por você ou por casas de análise"
        >
          <Input
            id="manual-ceiling-input"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 45,00"
            value={manualPriceStr}
            onChange={(e) => setManualPriceStr(e.target.value)}
          />
        </FormField>

        <FormField
          label="Anotações / Justificativa da Tese"
          htmlFor="manual-notes-input"
          helperText="Opcional: fonte da recomendação ou rationale de preço"
        >
          <Input
            id="manual-notes-input"
            type="text"
            placeholder="Ex: Preço-alvo do relatório trimestral do BTG"
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
          />
        </FormField>
      </div>
    );

    if (isFii) {
      return [
        {
          value: "fii",
          label: "Métodos de FII",
          content: (
            <CeilingFiiForm
              mode={fiiMode}
              onModeChange={setFiiMode}
              monthlyDividendStr={fiiMonthlyDividendStr}
              onMonthlyDividendStrChange={setFiiMonthlyDividendStr}
              yieldPct={fiiYieldPct}
              onYieldPctChange={setFiiYieldPct}
              vpaStr={fiiVpaStr}
              onVpaStrChange={setFiiVpaStr}
              maxPvp={fiiMaxPvp}
              onMaxPvpChange={setFiiMaxPvp}
              calculatedPrice={
                fiiMode === "bazin"
                  ? (computedModels.fii_bazin?.price ?? null)
                  : fiiMode === "pvp"
                    ? (computedModels.fii_pvp?.price ?? null)
                    : (computedModels.fii_hybrid?.price ?? null)
              }
              currentPrice={currentPrice}
              currency={currency}
            />
          ),
        },
        {
          value: "manual",
          label: "Manual",
          content: manualContentElement,
        },
      ];
    }

    return [
      {
        value: "bazin",
        label: "Décio Bazin",
        content: (
          <CeilingBazinForm
            dpaStr={bazinDpaStr}
            onDpaStrChange={setBazinDpaStr}
            yieldPct={bazinYieldPct}
            onYieldPctChange={setBazinYieldPct}
            calculatedPrice={computedModels.bazin?.price ?? null}
            currentPrice={currentPrice}
            currency={currency}
          />
        ),
      },
      {
        value: "graham",
        label: "Graham",
        content: (
          <CeilingGrahamForm
            lpaStr={grahamLpaStr}
            onLpaStrChange={setGrahamLpaStr}
            vpaStr={grahamVpaStr}
            onVpaStrChange={setGrahamVpaStr}
            marginPct={grahamMarginPct}
            onMarginPctChange={setGrahamMarginPct}
            calculatedData={computedModels.graham ?? null}
            currentPrice={currentPrice}
            currency={currency}
          />
        ),
      },
      {
        value: "gordon",
        label: "Gordon",
        content: (
          <CeilingGordonForm
            dpaStr={gordonDpaStr}
            onDpaStrChange={setGordonDpaStr}
            growthPct={gordonGrowthPct}
            onGrowthPctChange={setGordonGrowthPct}
            requiredPct={gordonRequiredPct}
            onRequiredPctChange={setGordonRequiredPct}
            calculatedPrice={computedModels.gordon?.price ?? null}
            currentPrice={currentPrice}
            currency={currency}
          />
        ),
      },
      {
        value: "manual",
        label: "Manual",
        content: manualContentElement,
      },
    ];
  }, [
    isFii,
    fiiMode,
    setFiiMode,
    fiiMonthlyDividendStr,
    setFiiMonthlyDividendStr,
    fiiYieldPct,
    setFiiYieldPct,
    fiiVpaStr,
    setFiiVpaStr,
    fiiMaxPvp,
    setFiiMaxPvp,
    computedModels,
    currentPrice,
    currency,
    bazinDpaStr,
    setBazinDpaStr,
    bazinYieldPct,
    setBazinYieldPct,
    grahamLpaStr,
    setGrahamLpaStr,
    grahamVpaStr,
    setGrahamVpaStr,
    grahamMarginPct,
    setGrahamMarginPct,
    gordonDpaStr,
    setGordonDpaStr,
    gordonGrowthPct,
    setGordonGrowthPct,
    gordonRequiredPct,
    setGordonRequiredPct,
    manualPriceStr,
    setManualPriceStr,
    manualNotes,
    setManualNotes,
  ]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Calculadora de Preço Teto & Valuation"
      description={`${ticker} · Cotação Atual: ${currentPriceFormatted}`}
      footer={
        <ModalFooter>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end w-full">
            <Button type="button" variant="outline" onClick={handleDialogClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={effectivePrice === null || effectivePrice <= 0}
              onClick={handleApply}
              className="gap-1.5"
            >
              <Check className="size-4" aria-hidden="true" />
              <span>
                {effectivePrice !== null && effectivePrice > 0
                  ? `Aplicar Teto: ${formatCeilingCurrency(effectivePrice, currency)}`
                  : "Defina um Modelo"}
              </span>
            </Button>
          </div>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        {/* Abas Padronizadas Radix com forceMount */}
        <Tabs
          items={tabItems}
          value={activeTab}
          onValueChange={setActiveTab}
          forceMount={true}
          variant="pills"
        />

        {/* Mesa de Consenso Multimodelo (aparece se >= 2 modelos estiverem preenchidos) */}
        <CeilingConsensusPanel
          computedModels={computedModels}
          consensusRule={consensusRule}
          onConsensusRuleChange={setConsensusRule}
          selectedSpecificMethod={selectedSpecificMethod}
          onSelectedSpecificMethodChange={setSelectedSpecificMethod}
          effectivePrice={effectivePrice}
          currency={currency}
        />
      </div>
    </Modal>
  );
}
