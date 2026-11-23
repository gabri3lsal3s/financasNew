import {
  DEFAULT_PIX_CITY,
  buildPixTransferCode,
  resolvePixKeyType,
  validateAndClassifyPixKey,
  type PixKeyType,
} from "@/domain/pix";
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
    return { keyType: "unknown" as const, normalizedKey: "", brCode: "" };
  }
  const validation = validateAndClassifyPixKey(
    params.pixKey,
    params.selectedKeyType as PixKeyType | "auto" | "unknown",
  );
  const resolvedType =
    validation.resolvedType ??
    resolvePixKeyType(
      params.pixKey,
      params.selectedKeyType as PixKeyType | "auto" | "unknown",
    );
  const normalizedKey = validation.normalizedKey ?? params.pixKey.trim();

  if (!validation.isValid || !resolvedType) {
    return {
      keyType: resolvedType ?? ("unknown" as const),
      normalizedKey,
      brCode: "",
    };
  }

  const brCode =
    buildPixTransferCode({
      pixKey: normalizedKey,
      keyType: resolvedType,
      merchantName: params.merchantName,
      merchantCity: params.merchantCity,
      txId: "***",
      defaultMerchantName: "Organizador",
      defaultMerchantCity: DEFAULT_PIX_CITY,
    }) ?? "";
  return { keyType: resolvedType, normalizedKey, brCode };
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
  const { keyType, normalizedKey, brCode } = buildGoalPixData({
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
    organizer_city: merchantCity.trim() || DEFAULT_PIX_CITY,
    pix_key: isShared ? normalizedKey : "",
    pix_key_type: keyType,
    pix_br_code: brCode,
    status: resolvedStatus,
    is_shared: isShared,
    show_contributions_publicly: showContributionsPublicly,
  };
}
