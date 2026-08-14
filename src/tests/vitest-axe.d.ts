import type { AxeResults } from "axe-core";

/**
 * Augmentação do matcher `toHaveNoViolations` (axe-core) no `expect` do
 * Vitest 4. O `vitest-axe/extend-expect` original declara o matcher num
 * namespace global `Vi` removido no Vitest 4 — aqui o matcher é anexado à
 * interface `Assertion` exportada pelo módulo `vitest` (declaration
 * merging com o parâmetro genérico da interface original).
 */
declare module "vitest" {
  interface Assertion<Type> {
    /** Valida que o resultado do axe não contém violações de acessibilidade. */
    toHaveNoViolations(): Type extends AxeResults ? void : never;
  }
}
