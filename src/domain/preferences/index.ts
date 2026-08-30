/**
 * Domínio de Preferências e Modos de Experiência (§3.10 / §3.11).
 * Funções puras sem efeitos colaterais, sem dependências de UI ou Supabase.
 */

export type ExperiencePreset = "dynamic" | "minimal" | "discreet" | "custom";

export type SensoryIntent =
  | "selection"
  | "action"
  | "toggle"
  | "success"
  | "warning"
  | "destructive"
  | "error";

export interface ExperienceConfig {
  motionLevel: "fluid" | "eco" | "reduced";
  density: "comfortable" | "compact";
  soundEnabled: boolean;
  hapticEnabled: boolean;
  numberTickerEnabled: boolean;
  disabledSensoryIntents: SensoryIntent[];
}

export interface PresetMetadata {
  id: ExperiencePreset;
  title: string;
  badgeLabel: string;
  tagline: string;
  description: string;
  highlights: string[];
}

/** Configurações predefinidas canônicas para os modos de experiência */
export const EXPERIENCE_PRESETS: Record<Exclude<ExperiencePreset, "custom">, ExperienceConfig> = {
  dynamic: {
    motionLevel: "fluid",
    density: "comfortable",
    soundEnabled: true,
    hapticEnabled: true,
    numberTickerEnabled: true,
    disabledSensoryIntents: [],
  },
  minimal: {
    motionLevel: "eco",
    density: "compact",
    soundEnabled: false,
    hapticEnabled: true,
    numberTickerEnabled: false,
    disabledSensoryIntents: ["selection", "action", "toggle"],
  },
  discreet: {
    motionLevel: "reduced",
    density: "compact",
    soundEnabled: false,
    hapticEnabled: false,
    numberTickerEnabled: false,
    disabledSensoryIntents: [
      "selection",
      "action",
      "toggle",
      "success",
      "warning",
      "destructive",
      "error",
    ],
  },
};

export const PRESET_METADATA_LIST: PresetMetadata[] = [
  {
    id: "dynamic",
    title: "Dinâmico",
    badgeLabel: "Fintech Pro",
    tagline: "Imersivo e expressivo",
    description: "Animações completas de física spring, contadores animados e retorno sensorial tátil e sonoro equilibrado.",
    highlights: [
      "Animações fluidas em menus e transições",
      "Feedback sonoro e vibração tátil ativos",
      "Contagem numérica animada nos KPIs",
    ],
  },
  {
    id: "minimal",
    title: "Foco",
    badgeLabel: "Minimalista",
    tagline: "Rápido e direto",
    description: "Transições ágeis em fade, layout compacto e apenas vibração sutil em erros e confirmações críticas.",
    highlights: [
      "Transições instantâneas com menor consumo",
      "Sem ruídos sonoros, foco em velocidade",
      "Vibração exclusiva para alertas e erros",
    ],
  },
  {
    id: "discreet",
    title: "Discreto",
    badgeLabel: "Silencioso",
    tagline: "Totalmente mudo para trabalho",
    description: "Zero som, zero vibração e animações reduzidas. Ideal para ambientes de trabalho e transporte.",
    highlights: [
      "Mudo total (zero sons e zero hápticos)",
      "Movimento visual mínimo para conforto",
      "Densidade compacta com foco em leitura",
    ],
  },
];

/**
 * Detecta se a configuração atual é compatível com um dos presets canônicos
 * ou se foi customizada pelo usuário.
 */
export function detectActivePreset(
  config: Partial<ExperienceConfig> | null | undefined,
): ExperiencePreset {
  if (!config) return "dynamic";

  const isDynamic =
    config.motionLevel === "fluid" &&
    (config.density === "comfortable" || !config.density) &&
    config.soundEnabled === true &&
    config.hapticEnabled === true &&
    config.numberTickerEnabled !== false &&
    (!config.disabledSensoryIntents || config.disabledSensoryIntents.length === 0);

  if (isDynamic) return "dynamic";

  const isMinimal =
    config.motionLevel === "eco" &&
    config.density === "compact" &&
    config.soundEnabled === false &&
    config.hapticEnabled === true &&
    config.numberTickerEnabled === false &&
    arraysHaveSameElements(config.disabledSensoryIntents ?? [], EXPERIENCE_PRESETS.minimal.disabledSensoryIntents);

  if (isMinimal) return "minimal";

  const isDiscreet =
    config.motionLevel === "reduced" &&
    config.density === "compact" &&
    config.soundEnabled === false &&
    config.hapticEnabled === false &&
    config.numberTickerEnabled === false &&
    arraysHaveSameElements(config.disabledSensoryIntents ?? [], EXPERIENCE_PRESETS.discreet.disabledSensoryIntents);

  if (isDiscreet) return "discreet";

  return "custom";
}

function arraysHaveSameElements(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

/**
 * Retorna as configurações completas resultantes da aplicação de um preset
 * sobre a configuração atual do usuário.
 */
export function applyExperiencePreset<T extends Partial<ExperienceConfig>>(
  preset: ExperiencePreset,
  currentConfig: T,
): T & ExperienceConfig {
  if (preset === "custom") {
    return {
      ...currentConfig,
      motionLevel: currentConfig.motionLevel ?? "fluid",
      density: currentConfig.density ?? "comfortable",
      soundEnabled: currentConfig.soundEnabled ?? false,
      hapticEnabled: currentConfig.hapticEnabled ?? true,
      numberTickerEnabled: currentConfig.numberTickerEnabled ?? true,
      disabledSensoryIntents: currentConfig.disabledSensoryIntents ?? [],
    };
  }

  const presetValues = EXPERIENCE_PRESETS[preset];
  return {
    ...currentConfig,
    ...presetValues,
  };
}
