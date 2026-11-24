import {
  StatementLayoutBlueprintSchema,
  type StatementLayoutBlueprint,
} from "@/domain/reconciliation/blueprints";

export const STATEMENT_BLUEPRINT_STORE_KEY = "axir_statement_layout_blueprints_v1";
export const MAX_STORED_BLUEPRINTS = 50;
export const BLUEPRINT_SELF_HEALING_FAILURE_LIMIT = 2;

// Fallback em memória para ambientes sem window/localStorage e testes síncronos
const inMemoryBlueprints = new Map<string, StatementLayoutBlueprint>();

function readRawBlueprintMap(): Map<string, StatementLayoutBlueprint> {
  if (typeof window === "undefined" || !window.localStorage) {
    return new Map(inMemoryBlueprints);
  }

  try {
    const raw = window.localStorage.getItem(STATEMENT_BLUEPRINT_STORE_KEY);
    if (!raw) {
      return new Map(inMemoryBlueprints);
    }
    const parsedJson: unknown = JSON.parse(raw);
    const items = Array.isArray(parsedJson)
      ? parsedJson
      : parsedJson && typeof parsedJson === "object"
        ? Object.values(parsedJson as Record<string, unknown>)
        : [];

    const validMap = new Map<string, StatementLayoutBlueprint>();
    for (const candidate of items) {
      const parsed = StatementLayoutBlueprintSchema.safeParse(candidate);
      if (parsed.success && parsed.data.origin !== "builtin") {
        validMap.set(parsed.data.fingerprint, parsed.data);
      }
    }

    // Sincroniza espelho em memória
    inMemoryBlueprints.clear();
    for (const [k, v] of validMap.entries()) {
      inMemoryBlueprints.set(k, v);
    }
    return validMap;
  } catch {
    return new Map(inMemoryBlueprints);
  }
}

function enforceLruCap(
  map: Map<string, StatementLayoutBlueprint>,
): StatementLayoutBlueprint[] {
  const list = Array.from(map.values()).sort((a, b) =>
    b.stats.updatedAt.localeCompare(a.stats.updatedAt),
  );
  return list.slice(0, MAX_STORED_BLUEPRINTS);
}

function writeBlueprintMap(map: Map<string, StatementLayoutBlueprint>): void {
  const trimmed = enforceLruCap(map);

  inMemoryBlueprints.clear();
  for (const bp of trimmed) {
    inMemoryBlueprints.set(bp.fingerprint, bp);
  }

  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.setItem(
      STATEMENT_BLUEPRINT_STORE_KEY,
      JSON.stringify(trimmed),
    );
  } catch {
    // QuotaExceeded ou storage bloqueado: mantém em memória sem interromper o fluxo
  }
}

/**
 * Retorna todos os blueprints aprendidos válidos (`user_learned` e `ai_learned`),
 * ordenados do mais recente ao mais antigo.
 */
export function listStoredStatementBlueprints(): StatementLayoutBlueprint[] {
  return enforceLruCap(readRawBlueprintMap());
}

/**
 * Salva ou atualiza um blueprint validado por Zod no armazenamento local,
 * respeitando o limite LRU de 50 entradas.
 */
export function saveStatementBlueprint(
  blueprint: StatementLayoutBlueprint,
): boolean {
  const parsed = StatementLayoutBlueprintSchema.safeParse(blueprint);
  if (!parsed.success || parsed.data.origin === "builtin") {
    return false;
  }

  const map = readRawBlueprintMap();
  const existing = map.get(parsed.data.fingerprint);

  // Não permite que `ai_learned` sobrescreva um `user_learned` confirmado pelo usuário
  if (existing && existing.origin === "user_learned" && parsed.data.origin === "ai_learned") {
    return false;
  }

  const merged: StatementLayoutBlueprint = {
    ...parsed.data,
    stats: {
      uses: existing ? Math.max(existing.stats.uses + 1, parsed.data.stats.uses) : Math.max(1, parsed.data.stats.uses),
      exactChecksumHits: existing
        ? existing.stats.exactChecksumHits + parsed.data.stats.exactChecksumHits
        : parsed.data.stats.exactChecksumHits,
      consecutiveFailures: 0,
      updatedAt: new Date().toISOString(),
    },
  };

  map.set(merged.fingerprint, merged);
  writeBlueprintMap(map);
  return true;
}

/**
 * Registra um acerto determinístico de um blueprint salvo (reseta `consecutiveFailures`).
 */
export function recordBlueprintSuccess(
  fingerprint: string,
  exactChecksumHit = true,
): void {
  const map = readRawBlueprintMap();
  const existing = map.get(fingerprint);
  if (!existing) return;

  map.set(fingerprint, {
    ...existing,
    stats: {
      uses: existing.stats.uses + 1,
      exactChecksumHits:
        existing.stats.exactChecksumHits + (exactChecksumHit ? 1 : 0),
      consecutiveFailures: 0,
      updatedAt: new Date().toISOString(),
    },
  });
  writeBlueprintMap(map);
}

/**
 * Self-Healing: registra uma falha consecutiva de um blueprint aprendido.
 * Quando `consecutiveFailures >= 2`, remove automaticamente o blueprint obsoleto
 * para que a fatura seja reaprendida no próximo ciclo.
 */
export function recordBlueprintFailure(fingerprint: string): {
  invalidated: boolean;
  consecutiveFailures: number;
} {
  const map = readRawBlueprintMap();
  const existing = map.get(fingerprint);
  if (!existing) {
    return { invalidated: false, consecutiveFailures: 0 };
  }

  const nextFailures = existing.stats.consecutiveFailures + 1;
  if (nextFailures >= BLUEPRINT_SELF_HEALING_FAILURE_LIMIT) {
    map.delete(fingerprint);
    writeBlueprintMap(map);
    return { invalidated: true, consecutiveFailures: nextFailures };
  }

  map.set(fingerprint, {
    ...existing,
    stats: {
      ...existing.stats,
      consecutiveFailures: nextFailures,
      updatedAt: new Date().toISOString(),
    },
  });
  writeBlueprintMap(map);
  return { invalidated: false, consecutiveFailures: nextFailures };
}

export function deleteStatementBlueprint(fingerprint: string): void {
  const map = readRawBlueprintMap();
  if (map.delete(fingerprint)) {
    writeBlueprintMap(map);
  }
}

export function clearAllStatementBlueprints(): void {
  inMemoryBlueprints.clear();
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(STATEMENT_BLUEPRINT_STORE_KEY);
    } catch {
      // Ignora erro de storage
    }
  }
}
