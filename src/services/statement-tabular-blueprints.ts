import {
  StatementLayoutBlueprintSchema,
  type StatementLayoutBlueprint,
} from "@/domain/reconciliation";

export const LOCAL_TABULAR_BLUEPRINT_ID_PREFIX = "local-tab:";
const STORAGE_KEY_PREFIX = "financas:tabular_blueprints:v1:";
const MAX_LOCAL_TABULAR_BLUEPRINTS = 40;

function getStorageKey(userId?: string | null): string {
  return `${STORAGE_KEY_PREFIX}${userId?.trim() || "anon"}`;
}

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function isLocalTabularBlueprintId(id?: string | null): boolean {
  return typeof id === "string" && id.startsWith(LOCAL_TABULAR_BLUEPRINT_ID_PREFIX);
}

export function loadLocalTabularBlueprints(
  userId?: string | null,
): StatementLayoutBlueprint[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: StatementLayoutBlueprint[] = [];
    for (const item of parsed) {
      const res = StatementLayoutBlueprintSchema.safeParse(item);
      if (res.success && (res.data.fileKind === "csv" || res.data.fileKind === "xlsx")) {
        valid.push(res.data);
      }
    }
    return valid;
  } catch {
    return [];
  }
}

function writeLocalTabularBlueprints(
  blueprints: readonly StatementLayoutBlueprint[],
  userId?: string | null,
): void {
  if (!canUseLocalStorage()) return;
  try {
    const trimmed = blueprints.slice(0, MAX_LOCAL_TABULAR_BLUEPRINTS);
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(trimmed));
  } catch {
    // armazenamento local é best-effort
  }
}

export function saveLocalTabularBlueprint(
  blueprint: StatementLayoutBlueprint,
  userId?: string | null,
): StatementLayoutBlueprint | null {
  if (blueprint.fileKind !== "csv" && blueprint.fileKind !== "xlsx") {
    return null;
  }
  const nowIso = new Date().toISOString();
  const localId = `${LOCAL_TABULAR_BLUEPRINT_ID_PREFIX}${blueprint.fingerprint}`;
  const existing = loadLocalTabularBlueprints(userId);
  const prev = existing.find((item) => item.fingerprint === blueprint.fingerprint);

  const candidate = StatementLayoutBlueprintSchema.safeParse({
    ...blueprint,
    origin: blueprint.origin === "builtin" ? "user_verified" : blueprint.origin,
    cloudId: localId,
    cloudScope: "user",
    cloudStatus: "active",
    stats: {
      uses: (prev?.stats.uses ?? 0) + 1,
      exactChecksumHits: (prev?.stats.exactChecksumHits ?? 0) + 1,
      consecutiveFailures: 0,
      updatedAt: nowIso,
    },
  });
  if (!candidate.success) return null;

  const next = [
    candidate.data,
    ...existing.filter((item) => item.fingerprint !== candidate.data.fingerprint),
  ];
  writeLocalTabularBlueprints(next, userId);
  return candidate.data;
}

export function recordLocalTabularBlueprintOutcome(
  blueprintId: string,
  exactChecksumHit: boolean,
  userId?: string | null,
): void {
  if (!isLocalTabularBlueprintId(blueprintId)) return;
  const existing = loadLocalTabularBlueprints(userId);
  let changed = false;
  const nowIso = new Date().toISOString();

  const updated = existing.map((bp) => {
    if (bp.cloudId !== blueprintId) return bp;
    changed = true;
    const consecutiveFailures = exactChecksumHit ? 0 : bp.stats.consecutiveFailures + 1;
    return {
      ...bp,
      cloudStatus: consecutiveFailures >= 2 ? ("suspended" as const) : ("active" as const),
      stats: {
        uses: bp.stats.uses + 1,
        exactChecksumHits: bp.stats.exactChecksumHits + (exactChecksumHit ? 1 : 0),
        consecutiveFailures,
        updatedAt: nowIso,
      },
    };
  });

  if (changed) {
    writeLocalTabularBlueprints(updated, userId);
  }
}
