import { BUILTIN_STATEMENT_BLUEPRINTS } from "../extractors/issuer-profiles";
import type {
  BlueprintFileKind,
  BlueprintOrigin,
  MatchedBlueprintResult,
  StatementFingerprintResult,
  StatementLayoutBlueprint,
} from "./types";

const ORIGIN_TIER_GROUPS: ReadonlyArray<readonly BlueprintOrigin[]> = [
  ["user_verified", "user_learned"],
  ["global_active", "ai_learned"],
  ["builtin"],
];

/**
 * Busca o melhor `StatementLayoutBlueprint` aplicável respeitando estritamente:
 * 1) Precedência de origem: `user_verified` -> `global_active` -> `builtin` (`issuer-profiles.ts`)
 * 2) Busca em 2 níveis dentro de cada origem:
 *    - Nível 1: fingerprint exato (`<kind>:<issuerKey>:<headerTokensHash>`)
 *    - Nível 2: fallback por emissor (`<kind>:<issuerKey>`)
 * 3) Auto-proteção (self-healing): ignora blueprints com `status !== "active"` ou `consecutiveFailures >= 2`.
 */
export function findBestStatementBlueprint(params: {
  fingerprint: StatementFingerprintResult;
  learnedBlueprints?: readonly StatementLayoutBlueprint[];
  builtinBlueprints?: readonly StatementLayoutBlueprint[];
  fileKind?: BlueprintFileKind;
}): MatchedBlueprintResult | null {
  const {
    fingerprint,
    learnedBlueprints = [],
    builtinBlueprints = BUILTIN_STATEMENT_BLUEPRINTS,
    fileKind,
  } = params;

  const healthyLearned = learnedBlueprints.filter(
    (bp) =>
      bp.stats.consecutiveFailures < 2 &&
      (!bp.cloudStatus || bp.cloudStatus === "active"),
  );
  const allCandidates: StatementLayoutBlueprint[] = [
    ...healthyLearned,
    ...builtinBlueprints,
  ].filter((bp) => (!fileKind ? true : bp.fileKind === fileKind));

  const sortByTrust = (a: StatementLayoutBlueprint, b: StatementLayoutBlueprint): number => {
    const aDist = a.distinctUsersVerified ?? 0;
    const bDist = b.distinctUsersVerified ?? 0;
    if (bDist !== aDist) return bDist - aDist;
    if (b.stats.exactChecksumHits !== a.stats.exactChecksumHits) {
      return b.stats.exactChecksumHits - a.stats.exactChecksumHits;
    }
    if (b.stats.uses !== a.stats.uses) {
      return b.stats.uses - a.stats.uses;
    }
    return b.stats.updatedAt.localeCompare(a.stats.updatedAt);
  };

  for (const tierOrigins of ORIGIN_TIER_GROUPS) {
    const bucket = allCandidates
      .filter((bp) => tierOrigins.includes(bp.origin))
      .sort(sortByTrust);
    if (bucket.length === 0) continue;

    // Nível 1: match exato pelo hash estrutural de cabeçalho
    const exactMatch = bucket.find(
      (bp) => bp.fingerprint === fingerprint.exactFingerprint,
    );
    if (exactMatch) {
      return { blueprint: exactMatch, matchLevel: "exact" };
    }

    // Nível 2: fallback por emissor (protege mudança de frase promocional entre meses)
    if (fingerprint.issuerKey && fingerprint.issuerKey !== "unknown") {
      const issuerFallback = bucket.find(
        (bp) =>
          bp.fingerprint === fingerprint.fallbackFingerprint ||
          bp.issuerKey === fingerprint.issuerKey,
      );
      if (issuerFallback) {
        return { blueprint: issuerFallback, matchLevel: "issuer_fallback" };
      }
    }
  }

  return null;
}
