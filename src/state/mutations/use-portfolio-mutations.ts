/**
 * @fileoverview Agregador e re-exportador de mutações de carteira (Portfolio).
 * O monólito original (>1300 linhas) foi decomposto em sub-módulos temáticos em ./portfolio/:
 *   - portfolio-keys.ts
 *   - use-portfolio-asset-mutations.ts
 *   - use-portfolio-transaction-mutations.ts
 *   - use-portfolio-contribution-mutations.ts
 *   - use-portfolio-dividend-mutations.ts
 *   - use-portfolio-order-mutations.ts
 */
export * from "./portfolio";
