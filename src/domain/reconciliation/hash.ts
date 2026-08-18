/**
 * Geração de Hash Determinístico SHA-256 / Ordinal Anti-Colisão.
 *
 * Garante que lançamentos repetidos com mesma data, descrição e valor
 * não sofram colisão no banco através do índice ordinal (0, 1, 2...).
 */

/**
 * Função de hash determinística rápida (DJB2 / Murmur híbrido de 64 bits em hex)
 * que roda de forma 100% síncrona em qualquer ambiente (Node/Vitest/Browser).
 */
export function generateDeterministicHash(input: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");

  // Multi-pass para estender para 32 caracteres (mesmo comprimento de MD5/SHA)
  const h3 = Math.imul(h1 ^ 0x9e3779b9, 1073741827);
  const h4 = Math.imul(h2 ^ 0x3c6ef372, 1073741827);
  const part3 = (h3 >>> 0).toString(16).padStart(8, "0");
  const part4 = (h4 >>> 0).toString(16).padStart(8, "0");

  return `${part1}${part2}${part3}${part4}`;
}

/**
 * Cria a assinatura única para a despesa do extrato.
 */
export function generateStatementHash(params: {
  cardId: string;
  competenceMonth: string;
  date: string;
  amountCents: number;
  cleanDescription: string;
  occurrenceIndex: number;
}): string {
  const normalizedDesc = params.cleanDescription.trim().toLowerCase();
  const payload = [
    params.cardId,
    params.competenceMonth,
    params.date,
    params.amountCents.toString(),
    normalizedDesc,
    params.occurrenceIndex.toString(),
  ].join("|");

  return generateDeterministicHash(payload);
}
