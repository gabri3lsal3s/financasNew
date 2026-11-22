import { Link } from "react-router";
import { ArrowRight, BarChart3, CreditCard, Lock } from "lucide-react";
import { Badge } from "@/components/ui";
import { BrandLogo } from "@/components/layout/brand-logo";

const LOGIN_BENEFITS = [
  { icon: BarChart3, label: "Caixa diário, cartões, dívidas, grupo e carteira sincronizados" },
  { icon: CreditCard, label: "Modo Família, viagens e cobranças Pix em tempo real" },
  { icon: Lock, label: "Zero senhas bancárias · proteção RLS e autenticação 2FA" },
] as const;

export function LoginSideHero() {
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
            Bem-vindo de volta.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Continue de onde parou e acompanhe toda a sua vida financeira em um só lugar.
          </p>
        </div>

        <ul className="flex flex-col gap-3.5 mt-1">
          {LOGIN_BENEFITS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-start gap-2.5 text-sm text-foreground/90">
              <Icon className="size-4 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
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
