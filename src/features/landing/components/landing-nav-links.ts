export interface LandingNavLink {
  id: string;
  label: string;
  mobileLabel: string;
}

export const LANDING_NAV_LINKS: readonly LandingNavLink[] = [
  { id: "recursos", label: "Recursos", mobileLabel: "Recursos" },
  { id: "simulador", label: "Simulador", mobileLabel: "Simulador Patrimonial" },
  { id: "plataformas", label: "Plataformas", mobileLabel: "Plataformas & App" },
  { id: "ferramentas", label: "Ferramentas", mobileLabel: "Ferramentas Gratuitas" },
  { id: "precos", label: "Planos", mobileLabel: "Planos & Preços" },
  { id: "faq", label: "Dúvidas", mobileLabel: "Dúvidas Frequentes" },
];
