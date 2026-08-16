/**
 * Barrel do layout — estrutura de página (sidebar, bottom-nav, header, shell).
 * Fonte única de importação externa (AGENTS.md §7 — toda pasta com index.ts).
 * Importações internas de layout→layout podem continuar diretas (co-localizadas).
 */
export type { BrandLogoProps } from "./brand-logo";
export { BrandLogo } from "./brand-logo";
export { CalculatorButton } from "./calculator-button";
export { MoreMenu } from "./more-menu";
export type { NavItem } from "./nav-items";
export { navItems } from "./nav-items";
export { PageShell } from "./page-shell";
