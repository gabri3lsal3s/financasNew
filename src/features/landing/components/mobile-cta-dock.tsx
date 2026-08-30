import { Link } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useLandingCta } from "@/features/landing/hooks";

export interface MobileCtaDockProps {
  /** Se o dock deve estar visível com base na rolagem. */
  visible: boolean;
}

/**
 * Dock inferior flutuante de conversão para dispositivos móveis.
 * Surge suavemente após o usuário rolar além do Hero e oferece acesso direto ao teste gratuito.
 */
export function MobileCtaDock({ visible }: MobileCtaDockProps) {
  const { trialUrl, isLoggedIn } = useLandingCta();

  if (!visible) return null;

  return (
    <aside
      aria-label="Ação rápida de cadastro"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 sm:hidden border-t border-border/80 bg-background/90 backdrop-blur-md px-4 py-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shadow-lg transition-all duration-300 animate-fade-slide-in",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-foreground truncate flex items-center gap-1">
            <Sparkles className="size-3 text-primary shrink-0" aria-hidden="true" />
            <span>Guia Financeiro</span>
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            {isLoggedIn ? "Acesse seu painel" : "30 dias grátis · Sem cartão"}
          </span>
        </div>

        <Link
          to={trialUrl}
          className={cn(
            buttonVariants({ size: "sm" }),
            "shadow-xs shrink-0 font-semibold inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs",
          )}
        >
          <span>{isLoggedIn ? "Acessar" : "Testar Grátis"}</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
