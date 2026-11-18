import { Layers, PieChart, Shield } from "lucide-react";
import { Badge } from "@/components/ui";
import { BrandLogo } from "@/components/layout/brand-logo";

const REGISTER_FEATURES = [
  { icon: Layers, label: "Receitas, despesas e cartões em um só lugar" },
  { icon: PieChart, label: "Orçamentos, metas e rebalanceamento de carteira" },
  { icon: Shield, label: "Dados criptografados e protegidos (RLS)" },
] as const;

export function RegisterSideHero({ planoParam }: { planoParam: string | null }) {
  return (
    <>
      <div className="flex flex-col gap-6">
        <BrandLogo
          markClassName="size-11 drop-shadow-xs"
          showWordmark
          showSubtitle
        />

        <div className="flex flex-col gap-2 mt-2">
          <p className="text-lg font-semibold tracking-tight text-foreground leading-snug">
            {planoParam
              ? "Crie sua conta para ativar o Plano Pro."
              : "Controle total das suas finanças em minutos."}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {planoParam
              ? "Após o cadastro, você será conduzido para concluir a assinatura."
              : "Comece com 30 dias de acesso Pro completo, sem cartão de crédito."}
          </p>
        </div>

        <ul className="flex flex-col gap-3 mt-1">
          {REGISTER_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm text-foreground/90">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0 text-primary-strong">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
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
          Cancele quando quiser. Sem cobranças surpresa e sem cartão.
        </p>
      </div>
    </>
  );
}
