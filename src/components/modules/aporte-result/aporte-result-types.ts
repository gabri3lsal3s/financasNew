import type {
  AporteOverflowEvent,
  ClassAporteSummary,
  DiversificationImpactSummary,
  PausedAssetDiagnostic,
  SectorAporteSummary,
  SkippedAssetDiagnostic,
} from "@/domain/portfolio";

export interface AporteRouteRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  targetValueBRL: number;
  currentValueBRL: number;
  gapBRL: number;
  allocatedBRL: number;
  quantity: number;
  priceBRL: number;
  rawScore?: number | null;
  effectiveTargetPct?: number;
  formulaLabel?: string;
  reasonKind?: "class_deficit" | "sector_deficit" | "asset_conviction";
  reasonLabel?: string;
  reasonDescription?: string;
  hasQualityConflict?: boolean;
  qualityConflictDetail?: string;
  lastReviewedAt?: string | null;
  reviewFrequencyMonths?: number;
  headroomBRL?: number;
  isConstrainedByCeiling?: boolean;
  ceilingReason?: string;
}

export interface CustomAporteExecutionItem {
  assetId: string;
  ticker: string;
  quantity: number;
  priceBRL: number;
  allocatedBRL: number;
}

export interface EffectiveAporteRouteState {
  isSelected: boolean;
  effectiveQuantity: number;
  effectivePrice: number;
  effectiveAllocatedBRL: number;
  isQuantityCustom: boolean;
  isPriceCustom: boolean;
}

export interface AporteTreeSectorGroup {
  sectorName: string;
  sectorSummary?: SectorAporteSummary;
  totalAllocatedBRL: number;
  totalGapBRL: number;
  routes: AporteRouteRow[];
}

export interface AporteTreeClassGroup {
  className: string;
  classSummary?: ClassAporteSummary;
  totalAllocatedBRL: number;
  totalGapBRL: number;
  sectors: Map<string, AporteTreeSectorGroup>;
}

export interface AporteResultProps {
  mode: "asset" | "class" | "both";
  aporte: number;
  totalAllocated: number;
  leftover: number;
  routes: AporteRouteRow[];
  classSummaries?: ClassAporteSummary[];
  sectorSummaries?: SectorAporteSummary[];
  skippedAssets?: SkippedAssetDiagnostic[];
  /** Ação rápida para gravar todas as transações sugeridas no extrato. */
  onExecuteAporte?: (items?: CustomAporteExecutionItem[]) => void;
  /** Ação para abrir o Wizard de Compra para um ativo específico com quantidade sugerida. */
  onOpenWizard?: (ticker: string, quantity: number, allocatedBRL?: number) => void;
  /** Ação para inspecionar ou reavaliar tese e nota de um ativo sem sair do fluxo de aporte. */
  onInspectAsset?: (ticker: string) => void;
  executing?: boolean;
  showDriftBars?: boolean;
  overflowEvents?: readonly AporteOverflowEvent[];
  pausedAssets?: readonly PausedAssetDiagnostic[];
  /** Slot opcional para encaixar o card de comando na coluna esquerda do layout de 2 colunas. */
  controlSlot?: React.ReactNode;
  /** Impacto quantitativo do aporte na descentralização e diluição de risco da carteira. */
  diversificationImpact?: DiversificationImpactSummary | null;
}
