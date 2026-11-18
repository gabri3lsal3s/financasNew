import { Link } from "react-router";
import { ArrowRight, BarChart3, CreditCard, Lock } from "lucide-react";
import { Badge } from "@/components/ui";
import { BrandLogo } from "@/components/layout/brand-logo";

const LOGIN_BENEFITS = [
  { icon: BarChart3, label: "Visão consolidada de receitas e despesas" },
  { icon: CreditCard, label: "Cartões, parcelas e faturas sob controle" },
  { icon: Lock, label: "Conexão segura com criptografia de ponta a ponta" },
] as const;

export function LoginSideHero() {
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
            Bem-vindo de volta.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Continue de onde parou e mantenha suas finanças sempre organizadas.
          </p>
        </div>

        <ul className="flex flex-col gap-3 mt-1">
          {LOGIN_BENEFITS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm text-foreground/90">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0 text-primary-strong">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="leading-snug">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-surface border border-border/80 p-4.5 shadow-xs flex flex-col gap-2">
        <Badge size="xs" variant="default" className="w-fit">
          Novo por aqui?
        </Badge>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
          Crie sua conta gratuitamente e tenha 30 dias de acesso Pro completo.
        </p>
        <Link
          to="/cadastro"
          tabIndex={-1}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-strong hover:text-primary transition-colors w-fit group"
        >
          <span>Começar agora</span>
          <ArrowRight
            className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </>
  );
}
