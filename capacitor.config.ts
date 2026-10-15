import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.guiafinanceiro.app",
  appName: "Guia Financeiro",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
