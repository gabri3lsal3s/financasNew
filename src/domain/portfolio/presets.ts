/**
 * Domínio de Cenários & Pré-definições de Metas (Presets de Alocação) — §F39/F4.
 *
 * Funções puras para criação, validação, serialização e aplicação de
 * templates estratégicos de alocação de carteira (sistema e usuário).
 */

import { clampTargetPercentage, distributeEquallyTargets, sanitizeTargetsForSave, targetsSum } from "./allocation";
import { cleanTicker } from "./tickers-catalog";
import type { AllocationPreset, PresetAssetTarget, PresetClassTarget } from "@/types";

export interface SystemPresetTemplate {
  id: string;
  name: string;
  description: string;
  asset_targets: PresetAssetTarget[];
  class_targets: PresetClassTarget[];
  isSystem: true;
}

/** Modelos de Referência de Mercado pré-curados do Sistema. */
export const SYSTEM_PRESET_TEMPLATES: readonly SystemPresetTemplate[] = [
  {
    id: "sys_dividends",
    name: "Foco em Dividendos / Renda Perpétua",
    description: "Estratégia focada em fluxo de proventos: 40% Ações, 40% FIIs, 15% Renda Fixa e 5% Caixa.",
    asset_targets: [],
    class_targets: [
      { name: "Ações", target_percentage: 40 },
      { name: "FIIs", target_percentage: 40 },
      { name: "Renda Fixa", target_percentage: 15 },
      { name: "Caixa", target_percentage: 5 },
    ],
    isSystem: true,
  },
  {
    id: "sys_all_weather",
    name: "All-Weather / Ray Dalio",
    description: "Carteira balanceada para todos os ciclos: 30% Ações, 40% Renda Fixa, 15% Internacional e 15% FIIs.",
    asset_targets: [],
    class_targets: [
      { name: "Ações", target_percentage: 30 },
      { name: "Renda Fixa", target_percentage: 40 },
      { name: "Internacional", target_percentage: 15 },
      { name: "FIIs", target_percentage: 15 },
    ],
    isSystem: true,
  },
  {
    id: "sys_boglehead",
    name: "Boglehead Clássico 60/40",
    description: "Alocação indexada clássica: 35% Ações Nacionais, 25% Internacional/ETFs e 40% Renda Fixa.",
    asset_targets: [],
    class_targets: [
      { name: "Ações", target_percentage: 35 },
      { name: "Internacional", target_percentage: 25 },
      { name: "Renda Fixa", target_percentage: 40 },
    ],
    isSystem: true,
  },
  {
    id: "sys_growth_equity",
    name: "Arrojada / 100% Renda Variável",
    description: "Foco exclusivo em valorização de longo prazo: 50% Ações, 35% FIIs e 15% Internacional.",
    asset_targets: [],
    class_targets: [
      { name: "Ações", target_percentage: 50 },
      { name: "FIIs", target_percentage: 35 },
      { name: "Internacional", target_percentage: 15 },
    ],
    isSystem: true,
  },
] as const;

export interface PositionAssetReference {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  pct: number;
}

export interface AppliedPresetDraft {
  assetDraft: Record<string, number>;
  classDraft: Record<string, number>;
  totalAssetSum: number;
  totalClassSum: number;
}

/**
 * Aplica um preset (customizado do usuário ou template do sistema) sobre a carteira atual.
 * - Mapeia metas por ativo priorizando `asset_id` e fallback para `ticker` (case-insensitive).
 * - Se o preset contiver apenas metas de classe (como os templates de sistema),
 *   distribui o percentual de cada classe proporcionalmente (1/N) entre os ativos daquela classe.
 * - Ativos não cobertos pelo preset recebem 0%.
 */
export function applyPresetToPosition(
  preset: Pick<AllocationPreset | SystemPresetTemplate, "asset_targets" | "class_targets">,
  positionAssets: readonly PositionAssetReference[],
): AppliedPresetDraft {
  const assetDraft: Record<string, number> = {};
  const classDraft: Record<string, number> = {};

  // 1. Mapeia metas de classe
  for (const ct of preset.class_targets ?? []) {
    if (ct.name) {
      classDraft[ct.name] = clampTargetPercentage(ct.target_percentage);
    }
  }

  // 2. Se o preset tiver metas explícitas de ativos, mapeia por ID ou Ticker
  if (preset.asset_targets && preset.asset_targets.length > 0) {
    const targetByAssetId = new Map<string, number>();
    const targetByTicker = new Map<string, number>();

    for (const at of preset.asset_targets) {
      const val = clampTargetPercentage(at.target_percentage);
      if (at.asset_id) {
        targetByAssetId.set(at.asset_id, val);
      }
      if (at.ticker) {
        targetByTicker.set(cleanTicker(at.ticker), val);
      }
    }

    for (const asset of positionAssets) {
      const targetById = targetByAssetId.get(asset.assetId);
      const targetByTick = targetByTicker.get(cleanTicker(asset.ticker));
      assetDraft[asset.assetId] = targetById ?? targetByTick ?? 0;
    }
  } else if (preset.class_targets && preset.class_targets.length > 0) {
    // 3. Se for um template de classes (ex.: Ray Dalio, Boglehead):
    // Distribui o target da classe igualmente (1/N) entre os ativos daquela classe na carteira
    const assetsByClass = new Map<string, PositionAssetReference[]>();
    for (const asset of positionAssets) {
      const cls = asset.assetClass ?? "Sem classe";
      const list = assetsByClass.get(cls) ?? [];
      list.push(asset);
      assetsByClass.set(cls, list);
    }

    for (const ct of preset.class_targets) {
      const clsAssets = assetsByClass.get(ct.name) ?? [];
      if (clsAssets.length > 0 && ct.target_percentage > 0) {
        const distributed = distributeEquallyTargets(
          clsAssets.map((a) => ({ id: a.assetId })),
          ct.target_percentage,
        );
        for (const item of distributed) {
          assetDraft[item.id] = item.targetPercentage;
        }
      }
    }

    // Ativos de classes que não estavam no preset recebem 0
    for (const asset of positionAssets) {
      if (assetDraft[asset.assetId] === undefined) {
        assetDraft[asset.assetId] = 0;
      }
    }
  } else {
    // Sem metas
    for (const asset of positionAssets) {
      assetDraft[asset.assetId] = 0;
    }
  }

  // 4. Higieniza o draft para garantir soma <= 100.00%
  const sanitizedList = sanitizeTargetsForSave(
    positionAssets.map((a) => ({ assetId: a.assetId, target: assetDraft[a.assetId] ?? 0 })),
  );
  for (const s of sanitizedList) {
    assetDraft[s.assetId] = s.target;
  }

  const totalAssetSum = targetsSum(positionAssets.map((a) => ({ target: assetDraft[a.assetId] ?? 0 })));
  const totalClassSum = targetsSum(Object.entries(classDraft).map(([, target]) => ({ target })));

  return {
    assetDraft,
    classDraft,
    totalAssetSum,
    totalClassSum,
  };
}

export interface PresetSnapshotInput {
  name: string;
  description?: string | null;
  asset_targets: PresetAssetTarget[];
  class_targets: PresetClassTarget[];
}

/**
 * Cria um snapshot de preset a partir do estado atual da interface.
 */
export function createPresetSnapshot(params: {
  name: string;
  description?: string | null;
  assetRows: readonly { assetId: string; ticker: string; target: number }[];
  classRows: readonly { name: string; target: number }[];
}): PresetSnapshotInput {
  const sanitizedAssets = sanitizeTargetsForSave(
    params.assetRows.map((r) => ({ assetId: r.assetId, ticker: r.ticker, target: r.target })),
  );

  const asset_targets: PresetAssetTarget[] = sanitizedAssets
    .filter((a) => a.target > 0)
    .map((a) => ({
      asset_id: a.assetId,
      ticker: cleanTicker(a.ticker),
      target_percentage: a.target,
    }));

  const class_targets: PresetClassTarget[] = params.classRows
    .filter((c) => c.target > 0)
    .map((c) => ({
      name: c.name,
      target_percentage: clampTargetPercentage(c.target),
    }));

  return {
    name: params.name.trim(),
    description: params.description?.trim() ? params.description.trim() : null,
    asset_targets,
    class_targets,
  };
}

/**
 * Valida se um preset é válido para ser salvo.
 */
export function validatePresetInput(input: PresetSnapshotInput): { ok: boolean; error: string | null } {
  if (!input.name || input.name.trim().length === 0) {
    return { ok: false, error: "O nome do cenário é obrigatório." };
  }
  if (input.name.trim().length > 60) {
    return { ok: false, error: "O nome do cenário deve ter no máximo 60 caracteres." };
  }

  const assetSum = targetsSum(input.asset_targets.map((a) => ({ target: a.target_percentage })));
  if (assetSum > 100.001) {
    return { ok: false, error: "A soma das metas de ativos excede 100%." };
  }

  const classSum = targetsSum(input.class_targets.map((c) => ({ target: c.target_percentage })));
  if (classSum > 100.001) {
    return { ok: false, error: "A soma das metas por classe excede 100%." };
  }

  return { ok: true, error: null };
}
