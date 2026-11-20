/**
 * Compara duas versões SemVer no formato [v]MAJOR.MINOR.PATCH.
 *
 * Retorna:
 *  1 se versionA for maior que versionB;
 * -1 se versionA for menor que versionB;
 *  0 se versionA for estritamente equivalente a versionB.
 */
export function compareSemVer(versionA: string, versionB: string): number {
  const cleanA = (versionA || "0").trim().replace(/^[^\d]*/, "").split("-")[0] ?? "0";
  const cleanB = (versionB || "0").trim().replace(/^[^\d]*/, "").split("-")[0] ?? "0";

  const partsA = cleanA.split(".").map((p) => parseInt(p, 10) || 0);
  const partsB = cleanB.split(".").map((p) => parseInt(p, 10) || 0);

  const length = Math.max(partsA.length, partsB.length, 3);
  for (let i = 0; i < length; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA > valB) return 1;
    if (valA < valB) return -1;
  }

  return 0;
}

/**
 * Retorna se a versão candidata/remota é estritamente superior à versão corrente instalada.
 */
export function isNewerVersion(candidateVersion: string, currentVersion: string): boolean {
  return compareSemVer(candidateVersion, currentVersion) > 0;
}
