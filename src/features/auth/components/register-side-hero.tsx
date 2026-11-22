import { Layers, PieChart, Shield } from "lucide-react";
import { Badge } from "@/components/ui";
import { BrandLogo } from "@/components/layout/brand-logo";

const REGISTER_FEATURES = [
  {
    icon: Layers,
    label: "Caixa real, cartões (60x), contas a pagar/receber e parcelas divididas em um só lugar",
  },
  {
    icon: PieChart,
    label: "Família, viagens, investimentos com preço teto e relatórios com memória de cálculo",
  },
  {
    icon: Shield,
    label: "Zero senhas bancárias — dados isolados e criptografados (RLS)",
  },
] as const;

export function RegisterSideHero({ planoParam }: { planoParam: string | null }) {
  return (
    <>
      <div className="flex flex-col gap-6">
        <BrandLogo
          markClassName="size-11 drop-shadow-xs"
          showWordmark
          showSubtitle
          priority
        />

        <div className="flex flex-col gap-2 mt-2">
          <p className="text-lg font-semibold tracking-tight text-foreground leading-snug">
            {planoParam
              ? "Crie sua conta para ativar o Plano Pro."
              : "Toda a sua vida financeira conectada em um só lugar."}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {planoParam
              ? "Após o cadastro, você será conduzido para concluir a assinatura."
              : "Comece com 30 dias de acesso Pro completo, sem cartão de crédito e sem burocracia."}
          </p>
        </div>

        <ul className="flex flex-col gap-3.5 mt-1">
          {REGISTER_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-start gap-2.5 text-sm text-foreground/90">
              <Icon className="size-4 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
              <span className="leading-snug">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-surface border border-border/80 p-4.5 shadow-xs flex flex-col gap-1.5">
        <Badge size="xs" variant="default" className="w-fit">
          Período de Avaliação
        </Badge>
        <p className="text-sm font-bold text-foreground mt-0.5">30 dias Pro sem custo</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Cancele quando quiser em 1 clique. Sem cobranças surpresa e sem cartão.
        </p>
      </div>
    </>
  );
}
