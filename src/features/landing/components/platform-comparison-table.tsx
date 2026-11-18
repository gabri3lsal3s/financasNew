import { CheckCircle2 } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

export interface PlatformFeature {
  name: string;
  web: boolean | string;
  pwa: boolean | string;
  androidPro: boolean | string;
}

const PLATFORM_FEATURES: PlatformFeature[] = [
  {
    name: "Compartilhar comprovantes de qualquer banco direto no app",
    web: false,
    pwa: false,
    androidPro: true,
  },
  {
    name: "Captura de comprovantes com OCR no dispositivo",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Caixa Real Seguro e orçamento diário",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Rebalanceamento de aportes sem vender ativos",
    web: true,
    pwa: true,
    androidPro: true,
  },
  {
    name: "Instalação na tela inicial sem loja de aplicativos",
    web: false,
    pwa: true,
    androidPro: "Nativo",
  },
  {
    name: "Biometria física (digital ou reconhecimento facial)",
    web: "PIN local",
    pwa: "PIN local",
    androidPro: true,
  },
];

function FeatureCellValue({
  value,
  highlight = false,
}: {
  value: boolean | string;
  highlight?: boolean;
}) {
  if (typeof value === "boolean") {
    return value ? (
      <CheckCircle2
        className={
          highlight
            ? "size-4 text-positive-strong mx-auto"
            : "size-4 text-positive-strong dark:text-positive mx-auto"
        }
        aria-hidden="true"
      />
    ) : (
      <span className="text-muted-foreground font-medium" aria-label="Não disponível">
        —
      </span>
    );
  }
  return (
    <span
      className={
        highlight
          ? "font-semibold text-primary-strong dark:text-primary"
          : "font-semibold text-foreground"
      }
    >
      {value}
    </span>
  );
}

export function PlatformComparisonTable() {
  return (
    <ScrollReveal delay={200} className="mt-12">
      <div className="overflow-x-auto no-scrollbar scroll-smooth rounded-2xl border border-border/80 bg-surface shadow-xs">
        <table className="w-full min-w-[560px] text-left text-xs sm:text-sm">
          <caption className="sr-only">Matriz comparativa de funcionalidades por plataforma</caption>
          <thead className="border-b border-border/60 bg-surface-raised/60 font-semibold text-foreground">
            <tr>
              <th scope="col" className="p-3.5 sm:p-4">
                Funcionalidade
              </th>
              <th scope="col" className="p-3.5 sm:p-4 text-center">
                Web Desktop
              </th>
              <th scope="col" className="p-3.5 sm:p-4 text-center bg-primary/5">
                Mobile PWA (Oficial)
              </th>
              <th scope="col" className="p-3.5 sm:p-4 text-center">
                Android App Pro Nativo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-muted-foreground">
            {PLATFORM_FEATURES.map((f) => (
              <tr key={f.name} className="hover:bg-surface-hover/50 transition-colors">
                <td className="p-3.5 sm:p-4 font-medium text-foreground">{f.name}</td>
                <td className="p-3.5 sm:p-4 text-center">
                  <FeatureCellValue value={f.web} />
                </td>
                <td className="p-3.5 sm:p-4 text-center bg-primary/5">
                  <FeatureCellValue value={f.pwa} highlight />
                </td>
                <td className="p-3.5 sm:p-4 text-center">
                  <FeatureCellValue value={f.androidPro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs sm:text-sm text-muted-foreground text-center">
        E mais: Radar Fiscal, Escudo de Privacidade, Facilitador de IRPF, simuladores públicos e
        atalhos de launcher.
      </p>
    </ScrollReveal>
  );
}
