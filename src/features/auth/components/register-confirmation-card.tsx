import { Link } from "react-router";
import { ArrowRight, MailCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface RegisterConfirmationCardProps {
  email: string;
  loginUrl: string;
}

export function RegisterConfirmationCard({
  email,
  loginUrl,
}: RegisterConfirmationCardProps) {
  return (
    <div className="rounded-2xl border border-positive/30 bg-surface p-6 shadow-xs flex flex-col items-center text-center space-y-4">
      <div className="size-12 rounded-2xl bg-positive/10 border border-positive/20 flex items-center justify-center text-positive-strong">
        <MailCheck className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-foreground">
          Confirme seu endereço de e-mail
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
          Enviamos um link de ativação para o endereço abaixo. Clique no link recebido para validar sua conta e começar a usar o app.
        </p>
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-muted/30 border border-border/80 text-xs font-medium text-foreground">
          {email}
        </div>
      </div>

      <div className="w-full rounded-xl bg-surface-raised/60 p-3 text-left space-y-1.5">
        <p className="text-[11px] font-semibold text-foreground">Dicas importantes:</p>
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
          <li>Verifique sua pasta de spam ou lixo eletrônico se não encontrar na caixa de entrada.</li>
          <li>O link de ativação enviado é seguro e válido por 24 horas.</li>
        </ul>
      </div>

      <Link
        to={loginUrl}
        className={cn(buttonVariants({ variant: "solid" }), "w-full text-xs font-semibold gap-1.5")}
      >
        <span>Ir para o login</span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
