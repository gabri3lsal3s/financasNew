import type { ReactNode } from "react";

export interface ResponsiveLabelProps {
  /** Texto compacto exibido entre 380px e 639px (ou < 640px quando `iconOnlyBelow380` for falso). */
  short: ReactNode;
  /** Texto completo exibido a partir de sm (≥ 640px). */
  full: ReactNode;
  /** Quando true, oculta o texto abaixo de 380px (botão com ícone Lucide, aria-label, title e alvo 44px). */
  iconOnlyBelow380?: boolean;
}

/**
 * Rótulo responsivo progressivo DRY (3 níveis):
 * - Nível 1 (`sm:` ≥ 640px): texto completo (`full`)
 * - Nível 2 (`min-[380px]:` 380–639px): palavra curta (`short`)
 * - Nível 3 (`< 380px`, se `iconOnlyBelow380`): somente ícone visível + `sr-only` acessível
 */
export function ResponsiveLabel({
  short,
  full,
  iconOnlyBelow380 = false,
}: ResponsiveLabelProps) {
  return (
    <>
      {iconOnlyBelow380 ? (
        <>
          <span className="sr-only min-[380px]:hidden">{full}</span>
          <span className="hidden min-[380px]:inline sm:hidden">{short}</span>
        </>
      ) : (
        <span className="sm:hidden">{short}</span>
      )}
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}
