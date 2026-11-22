import { useMemo, useState } from "react";
import type {
  AssetCeilingMetadata,
  AssetCeilingMethod,
  ConsensusRule,
} from "@/domain/portfolio/ceiling-types";
import {
  calculateBazinCeiling,
  calculateFiiBazinCeiling,
  calculateFiiHybridCeiling,
  calculateFiiPvpCeiling,
  calculateGordonCeiling,
  calculateGrahamCeiling,
  calculateMultipleCeiling,
  resolveConsensusCeiling,
  round2,
} from "@/domain/portfolio/ceiling-valuation";
import { getScoreArchetypeKey } from "@/domain/portfolio/score-criteria";
import { triggerSensory } from "@/services/sensory";

export interface UseCeilingValuationParams {
  ticker: string;
  assetClass?: string | null;
  currency?: "BRL" | "USD";
  currentPrice: number;
  initialCeilingPrice?: number | null;
  initialCeilingMethod?: AssetCeilingMethod | null;
  initialCeilingMetadata?: AssetCeilingMetadata | null;
  onApply: (params: {
    price: number;
    method: AssetCeilingMethod;
    metadata: AssetCeilingMetadata;
  }) => void;
  onClose?: () => void;
}

export function useCeilingValuation({
  assetClass,
  initialCeilingPrice,
  initialCeilingMethod,
  initialCeilingMetadata,
  onApply,
  onClose,
}: UseCeilingValuationParams) {
  const archetype = getScoreArchetypeKey(assetClass);
  const isFii = archetype === "fiis";

  // Aba inicial selecionada de acordo com o arquétipo
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (initialCeilingMethod && initialCeilingMethod !== "conservative" && initialCeilingMethod !== "average") {
      return initialCeilingMethod;
    }
    return isFii ? "fii" : "bazin";
  });

  // 1. Estado Bazin (Ações)
  const initialBazin = initialCeilingMetadata?.models?.bazin;
  const [bazinDpaStr, setBazinDpaStr] = useState<string>(initialBazin?.dpa ? String(initialBazin.dpa) : "");
  const [bazinYieldPct, setBazinYieldPct] = useState<number>(initialBazin?.targetYield ? initialBazin.targetYield * 100 : 6);

  // 2. Estado Graham (Ações de Valor)
  const initialGraham = initialCeilingMetadata?.models?.graham;
  const [grahamLpaStr, setGrahamLpaStr] = useState<string>(initialGraham?.lpa ? String(initialGraham.lpa) : "");
  const [grahamVpaStr, setGrahamVpaStr] = useState<string>(initialGraham?.vpa ? String(initialGraham.vpa) : "");
  const [grahamMarginPct, setGrahamMarginPct] = useState<number>(
    initialGraham?.marginOfSafety ? initialGraham.marginOfSafety * 100 : 20,
  );

  // 3. Estado Gordon (Proventos com Crescimento)
  const initialGordon = initialCeilingMetadata?.models?.gordon;
  const [gordonDpaStr, setGordonDpaStr] = useState<string>(initialGordon?.dpa ? String(initialGordon.dpa) : "");
  const [gordonGrowthPct, setGordonGrowthPct] = useState<number>(
    initialGordon?.growthRate ? initialGordon.growthRate * 100 : 2,
  );
  const [gordonRequiredPct, setGordonRequiredPct] = useState<number>(
    initialGordon?.requiredRate ? initialGordon.requiredRate * 100 : 9,
  );

  // 4. Estado Múltiplo Alvo
  const initialMultiple = initialCeilingMetadata?.models?.multiple;
  const [multipleType, setMultipleType] = useState<"pe" | "pvp">(initialMultiple?.metricType ?? "pe");
  const [multipleValueStr, setMultipleValueStr] = useState<string>(
    initialMultiple?.metricValue ? String(initialMultiple.metricValue) : "",
  );
  const [targetMultipleStr, setTargetMultipleStr] = useState<string>(
    initialMultiple?.targetMultiple ? String(initialMultiple.targetMultiple) : "8",
  );

  // 5. Estado FII
  const initialFiiBazin = initialCeilingMetadata?.models?.fii_bazin;
  const initialFiiPvp = initialCeilingMetadata?.models?.fii_pvp;
  const initialFiiHybrid = initialCeilingMetadata?.models?.fii_hybrid;
  const [fiiMode, setFiiMode] = useState<"bazin" | "pvp" | "hybrid">(
    initialFiiHybrid ? "hybrid" : initialFiiPvp ? "pvp" : "bazin",
  );
  const [fiiMonthlyDividendStr, setFiiMonthlyDividendStr] = useState<string>(
    initialFiiBazin?.monthlyDividend
      ? String(initialFiiBazin.monthlyDividend)
      : initialFiiHybrid?.monthlyDividend
        ? String(initialFiiHybrid.monthlyDividend)
        : "",
  );
  const [fiiYieldPct, setFiiYieldPct] = useState<number>(
    initialFiiBazin?.targetYield
      ? initialFiiBazin.targetYield * 100
      : initialFiiHybrid?.targetYield
        ? initialFiiHybrid.targetYield * 100
        : 8.5,
  );
  const [fiiVpaStr, setFiiVpaStr] = useState<string>(
    initialFiiPvp?.vpa ? String(initialFiiPvp.vpa) : initialFiiHybrid?.vpa ? String(initialFiiHybrid.vpa) : "",
  );
  const [fiiMaxPvp, setFiiMaxPvp] = useState<number>(
    initialFiiPvp?.maxPvp ?? initialFiiHybrid?.maxPvp ?? 1.02,
  );

  // 6. Estado Manual
  const [manualPriceStr, setManualPriceStr] = useState<string>(
    initialCeilingPrice && initialCeilingMethod === "manual" ? String(initialCeilingPrice) : "",
  );
  const [manualNotes, setManualNotes] = useState<string>(initialCeilingMetadata?.models?.manual?.notes ?? "");

  // 7. Estado Mesa de Consenso
  const [consensusRule, setConsensusRule] = useState<ConsensusRule>(
    initialCeilingMetadata?.selectionRule ?? "conservative",
  );
  const [selectedSpecificMethod, setSelectedSpecificMethod] = useState<AssetCeilingMethod>(
    initialCeilingMetadata?.selectedMethod ?? "bazin",
  );

  // Helper de parse seguro de string para número positivo
  const parseNum = (val: string): number => {
    const clean = val.replace(/\s+/g, "").replace(",", ".");
    const n = Number(clean);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  // Cálculos reativos dos modelos
  const computedModels = useMemo(() => {
    const res: NonNullable<AssetCeilingMetadata["models"]> = {};

    // Bazin
    const bazinDpa = parseNum(bazinDpaStr);
    const bazinYield = bazinYieldPct > 0 ? bazinYieldPct / 100 : 0;
    const bazinPrice = calculateBazinCeiling(bazinDpa, bazinYield);
    if (bazinPrice !== null) {
      res.bazin = { dpa: bazinDpa, targetYield: bazinYield, price: bazinPrice };
    }

    // Graham
    const grahamLpa = parseNum(grahamLpaStr);
    const grahamVpa = parseNum(grahamVpaStr);
    const grahamMargin = grahamMarginPct >= 0 && grahamMarginPct < 100 ? grahamMarginPct / 100 : 0.2;
    const grahamRes = calculateGrahamCeiling(grahamLpa, grahamVpa, grahamMargin);
    if (grahamRes !== null) {
      res.graham = {
        lpa: grahamLpa,
        vpa: grahamVpa,
        marginOfSafety: grahamMargin,
        intrinsicValue: grahamRes.intrinsicValue,
        price: grahamRes.price,
      };
    }

    // Gordon
    const gordonDpa = parseNum(gordonDpaStr);
    const gordonGrowth = gordonGrowthPct >= 0 ? gordonGrowthPct / 100 : 0;
    const gordonRequired = gordonRequiredPct > 0 ? gordonRequiredPct / 100 : 0;
    const gordonPrice = calculateGordonCeiling(gordonDpa, gordonGrowth, gordonRequired);
    if (gordonPrice !== null) {
      res.gordon = {
        dpa: gordonDpa,
        growthRate: gordonGrowth,
        requiredRate: gordonRequired,
        price: gordonPrice,
      };
    }

    // Múltiplos
    const mValue = parseNum(multipleValueStr);
    const mTarget = parseNum(targetMultipleStr);
    const multiplePrice = calculateMultipleCeiling(mValue, mTarget);
    if (multiplePrice !== null) {
      res.multiple = {
        metricType: multipleType,
        metricValue: mValue,
        targetMultiple: mTarget,
        price: multiplePrice,
      };
    }

    // FII
    const fiiMonthly = parseNum(fiiMonthlyDividendStr);
    const fiiYield = fiiYieldPct > 0 ? fiiYieldPct / 100 : 0;
    const fiiVpa = parseNum(fiiVpaStr);

    if (fiiMode === "bazin") {
      const p = calculateFiiBazinCeiling(fiiMonthly, fiiYield);
      if (p !== null) res.fii_bazin = { monthlyDividend: fiiMonthly, targetYield: fiiYield, price: p };
    } else if (fiiMode === "pvp") {
      const p = calculateFiiPvpCeiling(fiiVpa, fiiMaxPvp);
      if (p !== null) res.fii_pvp = { vpa: fiiVpa, maxPvp: fiiMaxPvp, price: p };
    } else if (fiiMode === "hybrid") {
      const p = calculateFiiHybridCeiling(fiiMonthly, fiiYield, fiiVpa, fiiMaxPvp);
      if (p !== null) {
        res.fii_hybrid = {
          monthlyDividend: fiiMonthly,
          targetYield: fiiYield,
          vpa: fiiVpa,
          maxPvp: fiiMaxPvp,
          yieldPrice: p.yieldPrice,
          pvpPrice: p.pvpPrice,
          price: p.price,
        };
      }
    }

    // Manual
    const manualP = parseNum(manualPriceStr);
    if (manualP > 0) {
      res.manual = { price: manualP, notes: manualNotes.trim() || undefined };
    }

    return res;
  }, [
    bazinDpaStr,
    bazinYieldPct,
    fiiMaxPvp,
    fiiMode,
    fiiMonthlyDividendStr,
    fiiVpaStr,
    fiiYieldPct,
    gordonDpaStr,
    gordonGrowthPct,
    gordonRequiredPct,
    grahamLpaStr,
    grahamMarginPct,
    grahamVpaStr,
    manualNotes,
    manualPriceStr,
    multipleType,
    multipleValueStr,
    targetMultipleStr,
  ]);

  // Resolução do Preço Teto Vigente pela Mesa de Consenso
  const { effectivePrice, effectiveMethod } = useMemo(() => {
    return resolveConsensusCeiling(computedModels, consensusRule, selectedSpecificMethod);
  }, [computedModels, consensusRule, selectedSpecificMethod]);

  const modelCount = Object.keys(computedModels).length;

  const handleApply = () => {
    if (effectivePrice === null || effectivePrice <= 0 || !effectiveMethod) return;

    triggerSensory("success");

    const metadata: AssetCeilingMetadata = {
      selectionRule: modelCount > 1 ? consensusRule : "specific",
      selectedMethod: effectiveMethod,
      calculatedAt: new Date().toISOString(),
      models: computedModels,
    };

    onApply({
      price: round2(effectivePrice),
      method: effectiveMethod,
      metadata,
    });
    onClose?.();
  };

  return {
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
    multipleType,
    setMultipleType,
    multipleValueStr,
    setMultipleValueStr,
    targetMultipleStr,
    setTargetMultipleStr,
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
    effectiveMethod,
    modelCount,
    handleApply,
  };
}
