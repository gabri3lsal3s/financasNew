export type {
  AnyTourTrackId,
  TourTrackCategory,
  LegacyTourTrackId,
  MicroTourTrackId,
  SharedTourTrackId,
  TourTrackId,
  TourIconName,
  TourTrackMeta,
  TourTrackGroup,
  TourStep,
  TourStepPlacement,
  DailyFinancesDataset,
  InvestmentsDataset,
  DemoSimulationDataset,
} from "./types";

export type { TourTrackLabelOptions } from "./metadata";

export {
  TOUR_CATEGORY_LABELS,
  TOUR_CATEGORY_DESCRIPTIONS,
  TOUR_TRACK_CATEGORY_LABELS,
  TOUR_TRACK_CONTEXTUAL_LABELS,
  TOUR_TRACK_TITLES,
  TOUR_TRACK_SHORT_TITLES,
  TOUR_TRACK_DESCRIPTIONS,
  getTourTrackCategory,
  getTourTrackCategoryLabel,
  getTourTrackContextualLabel,
  getTourCategoryDescription,
  getTourTrackDescription,
  getTourTrackTitle,
  getTourTrackShortTitle,
} from "./metadata";

export {
  TOUR_TRACK_METAS,
  TOUR_TRACK_GROUPS,
  getTourTrackMeta,
  getTourTrackGroups,
  getTourTracksByCategory,
} from "./tour-catalog";

export {
  DEMO_USER_ID,
  DEMO_FAMILY_ID,
  DEMO_PARTNER_USER_ID,
  formatIsoDate,
  generateMockFinances,
  generateMockPublicShares,
  generateMockFamily,
  generateMockFamilyConsolidation,
} from "./mock-finances";

export {
  generateMockInvestments,
} from "./mock-investments";

export {
  TOUR_STEPS,
  getTourSteps,
} from "./tour-steps";

export {
  INVASIVE_QUERY_PARAMS,
  cleanPathWithoutInvasiveParams,
  isCompleteTourTrack,
  getTourHandoffDestination,
} from "./handoff";

export type {
  CalculateFreeViewportOptions,
  FreeViewportWindow,
  CalculateDeadCenterScrollOptions,
  SpotlightGeometryOptions,
  SpotlightGeometry,
  SkeletonSpotlightOptions,
  DesktopCardPositionOptions,
  DesktopCardPosition,
} from "./viewport";

export {
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_BOTTOM_NAV_HEIGHT,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_SAFETY_MARGIN,
  DEFAULT_SEARCH_TIMEOUT_MS,
  DEFAULT_POLLING_INTERVAL_MS,
  MOBILE_BREAKPOINT,
  calculateFreeViewportWindow,
  calculateDeadCenterScrollTop,
  calculateSpotlightGeometry,
  calculateSkeletonSpotlightGeometry,
  isElementInsideFreeViewport,
  isDesktopViewport,
  resolveTourStepTargetSelector,
  resolveTourStepTitle,
  resolveTourStepContent,
  calculateDesktopCardPosition,
  getDesktopSidebarWidth,
} from "./viewport";
