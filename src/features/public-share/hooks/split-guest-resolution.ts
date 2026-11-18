import type { Category, SplitParticipantItem } from "@/types";

export function matchSplitCategoryByName(
  categories: Category[],
  sentCategoryName?: string,
): Category | null {
  const target = sentCategoryName?.trim().toLowerCase();
  if (!target || categories.length === 0) return null;
  return (
    categories.find((c) => c.name.trim().toLowerCase() === target) ||
    categories.find(
      (c) => c.name.toLowerCase().includes(target) || target.includes(c.name.toLowerCase()),
    ) ||
    null
  );
}

export function findGuestParticipantForSession(
  participants: SplitParticipantItem[],
  userMetadata?: { name?: unknown; full_name?: unknown },
): { autoSelected: SplitParticipantItem | null; requiresPicker: boolean } {
  const unsettled = participants.filter((p) => !p.is_host && !p.is_settled);
  if (unsettled.length === 0) {
    return { autoSelected: null, requiresPicker: false };
  }
  if (unsettled.length === 1) {
    return { autoSelected: unsettled[0] ?? null, requiresPicker: false };
  }

  const rawName = userMetadata?.name || userMetadata?.full_name || "";
  const userName = typeof rawName === "string" ? rawName.toLowerCase().trim() : "";
  if (userName) {
    const matched = unsettled.find(
      (p) => p.name.toLowerCase().includes(userName) || userName.includes(p.name.toLowerCase()),
    );
    if (matched) {
      return { autoSelected: matched, requiresPicker: false };
    }
  }

  return { autoSelected: null, requiresPicker: true };
}

export function resolveGuestActorName(
  participant: SplitParticipantItem | null | undefined,
  sessionUser: { email?: string; user_metadata?: { name?: unknown; full_name?: unknown } } | undefined,
  fallback: string,
): string {
  if (participant?.name) return participant.name;
  const metaName = sessionUser?.user_metadata?.name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  const fullName = sessionUser?.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  const emailPrefix = sessionUser?.email?.split("@")[0];
  return emailPrefix || fallback;
}
