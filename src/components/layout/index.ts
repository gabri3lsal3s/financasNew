/**
 * Barrel do layout — estrutura de página (sidebar, bottom-nav, header, shell).
 * Fonte única de importação externa (AGENTS.md §7 — toda pasta com index.ts).
 * Importações internas de layout→layout podem continuar diretas (co-localizadas).
 */
export type { BrandLogoProps } from "./brand-logo";
export { BrandLogo } from "./brand-logo";
export type { LogoIconProps } from "./logo-icon";
export { LogoIcon } from "./logo-icon";
export type { LogoFullProps } from "./logo-full";
export { LogoFull } from "./logo-full";
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
export type { LogoProfileButtonProps } from "./logo-profile-button";
export { ThemeToggle } from "./theme-toggle";
export { BackToTop } from "./back-to-top";
export type { BackToTopProps } from "./back-to-top";
export { NetworkStatusBanner } from "./network-status-banner";
export type { NetworkStatusBannerProps } from "./network-status-banner";


