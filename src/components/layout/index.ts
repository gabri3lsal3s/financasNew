/**
 * Barrel do layout — estrutura de página (sidebar, bottom-nav, header, shell).
 * Fonte única de importação externa (AGENTS.md §7 — toda pasta com index.ts).
 * Importações internas de layout→layout podem continuar diretas (co-localizadas).
 */
export { BottomNav } from "./bottom-nav";
export type { BrandLogoProps } from "./brand-logo";
export { BrandLogo } from "./brand-logo";
export { CalculatorButton } from "./calculator-button";
export type { GlobalSearchProps } from "./global-search";
export { GlobalSearch } from "./global-search";
export { MoreMenu } from "./more-menu";
export type { NavItem } from "./nav-items";
export { navItems } from "./nav-items";
export { PageShell } from "./page-shell";
export { PrivacyToggle } from "./privacy-toggle";
export type { SidebarProps } from "./sidebar";
export { Sidebar } from "./sidebar";
export { ThemeToggle } from "./theme-toggle";
