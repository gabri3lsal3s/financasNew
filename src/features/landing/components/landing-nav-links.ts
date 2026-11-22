export interface LandingNavLink {
  id: string;
  label: string;
  mobileLabel: string;
}

export const LANDING_NAV_LINKS: readonly LandingNavLink[] = [
  { id: "ecossistema", label: "Visão Global", mobileLabel: "Visão Global" },
  { id: "dores", label: "Na Prática", mobileLabel: "Na Prática" },
  { id: "profundidade", label: "Recursos", mobileLabel: "Recursos & Relatórios" },
  { id: "simulador", label: "Simulador", mobileLabel: "Simulador de Aportes" },
  { id: "precos", label: "Planos", mobileLabel: "Planos & Preços" },
  { id: "faq", label: "Dúvidas", mobileLabel: "Dúvidas Frequentes" },
];
