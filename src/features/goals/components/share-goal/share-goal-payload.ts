import { buildPixTransferCode, resolvePixKeyType, type PixKeyType } from "@/domain/pix";
import type { Category, GoalTrackerSharePayload, GoalTrackerStatus } from "@/types";

export interface BuildGoalSharePayloadInput {
  base?: Record<string, unknown>;
  statusOverride?: GoalTrackerStatus;
  category?: Category | null;
  month: string;
  title: string;
  targetCents: number;
  initialCollectedCents: number;
  deadline: string;
  isShared: boolean;
  pixKey: string;
  selectedKeyType: string;
  merchantName: string;
  merchantCity: string;
  showContributionsPublicly: boolean;
}

export function buildGoalPixData(params: {
  isShared: boolean;
  pixKey: string;
  selectedKeyType: string;
  merchantName: string;
  merchantCity: string;
}) {
  if (!params.isShared || !params.pixKey.trim()) {
    return { keyType: "unknown" as const, brCode: "" };
  }
  const resolvedType = resolvePixKeyType(
    params.pixKey,
    params.selectedKeyType as PixKeyType | "auto" | "unknown",
  );
  const brCode =
    buildPixTransferCode({
      pixKey: params.pixKey,
      keyType: params.selectedKeyType as PixKeyType | "auto" | "unknown",
      merchantName: params.merchantName,
      merchantCity: params.merchantCity,
      txId: "***",
      defaultMerchantName: "Organizador",
      defaultMerchantCity: "SAO PAULO",
    }) ?? "";
  return { keyType: resolvedType ?? ("unknown" as const), brCode };
}

export function buildGoalSharePayload({
  base,
  statusOverride,
  category,
  month,
  title,
  targetCents,
  initialCollectedCents,
  deadline,
  isShared,
  pixKey,
  selectedKeyType,
  merchantName,
  merchantCity,
  showContributionsPublicly,
}: BuildGoalSharePayloadInput): GoalTrackerSharePayload {
  const { keyType, brCode } = buildGoalPixData({
    isShared,
    pixKey,
    selectedKeyType,
    merchantName,
    merchantCity,
  });

  const currentStatus = (base?.status as GoalTrackerStatus) || "active";
  const resolvedStatus =
    statusOverride ??
    (currentStatus === "archived"
      ? "archived"
      : initialCollectedCents >= targetCents
        ? "completed"
        : "active");

  return {
    ...(base ?? {}),
    title: title.trim() || category?.name || "Meta Coletiva",
    category_id: category?.id ?? (base?.category_id as string | null | undefined) ?? null,
    month,
    target_cents: targetCents,
    current_cents: initialCollectedCents,
    deadline: deadline.trim() || null,
    organizer_name: merchantName.trim() || "Organizador",
    organizer_city: merchantCity.trim() || "SAO PAULO",
    pix_key: isShared ? pixKey.trim() : "",
    pix_key_type: keyType,
    pix_br_code: brCode,
    status: resolvedStatus,
    is_shared: isShared,
    show_contributions_publicly: showContributionsPublicly,
  };
}
