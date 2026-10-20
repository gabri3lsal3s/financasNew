/**
 * Gera gradiente suave com base na cor do cartão de crédito.
 */
export function getCardGradient(colorHex?: string | null): string {
  if (!colorHex || colorHex.trim() === "") {
    return "linear-gradient(135deg, #162432 0%, #0F172A 100%)";
  }

  const hex = colorHex.trim();
  return `linear-gradient(135deg, ${hex}EE 0%, ${hex}99 40%, #090e15 100%)`;
}
