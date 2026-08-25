/**
 * Barrel do layout — estrutura de página (sidebar, bottom-nav, header, shell).
 * Fonte única de importação externa (AGENTS.md §7 — toda pasta com index.ts).
 * Importações internas de layout→layout podem continuar diretas (co-localizadas).
 */
export type { BrandLogoProps } from "./brand-logo";
export { BrandLogo } from "./brand-logo";
export { CalculatorButton } from "./calculator-button";
export type { NavItem } from "./nav-items";
export { navItems } from "./nav-items";
export { PageShell } from "./page-shell";
export type { LoadingScreenProps } from "./loading-screen";
export { LoadingScreen } from "./loading-screen";
export { Sidebar } from "./sidebar";
export type { SidebarProps } from "./sidebar";
export { BottomNav } from "./bottom-nav";
export { GlobalSearch } from "./global-search";
export { PrivacyToggle } from "./privacy-toggle";
export { MoreMenuSheet } from "./more-menu-sheet";
export type { MoreMenuSheetProps } from "./more-menu-sheet";
export { NotificationsButton } from "./notifications-button";
export { LogoProfileButton } from "./logo-profile-button";
export { ThemeToggle } from "./theme-toggle";


