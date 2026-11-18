import type { GoalCompositionConfig, GoalContribution, PublicShare } from "@/types";

export interface ParsedCampaignMetrics {
  title: string;
  targetCents: number;
  currentCents: number;
  percentage: number;
  hasTarget: boolean;
  isCompleted: boolean;
  isArchived: boolean;
  isPersonalPrivate: boolean;
  isPubliclyShared: boolean;
  isLinkPaused: boolean;
  deadline?: string;
  daysRemaining: number | null;
  contributions: GoalContribution[];
  showContributionsPublicly: boolean;
  composition?: GoalCompositionConfig;
}

const DATE_ONLY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function computeDaysRemaining(deadline: string | undefined): number | null {
  if (!deadline) return null;
  const datePart = deadline.split("T")[0] ?? "";
  let targetDate: Date;
  if (DATE_ONLY_PATTERN.test(datePart)) {
    const [year, month, day] = datePart.split("-").map(Number);
    targetDate = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  } else {
    targetDate = new Date(deadline);
  }
  if (Number.isNaN(targetDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

export function parseCampaignMetrics(
  share: PublicShare,
  liveCurrentCents?: number,
): ParsedCampaignMetrics {
  const payload = share.payload ?? {};
  const composition = payload.composition_config as GoalCompositionConfig | undefined;
  const title = (payload.title as string) || "Meta Coletiva";
  const targetCents = Number(payload.target_cents ?? 0);
  const currentCents =
    liveCurrentCents !== undefined ? liveCurrentCents : Number(payload.current_cents ?? 0);
  const percentage = targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0;
  const hasTarget = targetCents > 0;
  const isCompleted = hasTarget ? currentCents >= targetCents : payload.status === "completed";
  const isArchived = payload.status === "archived";
  const isPersonalPrivate = payload.is_shared === false;
  const isPubliclyShared = !isPersonalPrivate && !share.is_revoked;
  const isLinkPaused = !isPersonalPrivate && share.is_revoked;
  const deadline = payload.deadline as string | undefined;
  const contributions: GoalContribution[] =
    (payload.contributions as GoalContribution[] | undefined) ?? [];
  const showContributionsPublicly = payload.show_contributions_publicly !== false;

  return {
    title,
    targetCents,
    currentCents,
    percentage,
    hasTarget,
    isCompleted,
    isArchived,
    isPersonalPrivate,
    isPubliclyShared,
    isLinkPaused,
    deadline,
    daysRemaining: computeDaysRemaining(deadline),
    contributions,
    showContributionsPublicly,
    composition,
  };
}
