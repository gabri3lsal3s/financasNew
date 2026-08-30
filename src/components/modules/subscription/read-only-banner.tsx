import { useNavigate } from "react-router";
import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface ReadOnlyBannerProps {
  className?: string;
  onActivatePro?: () => void;
}

/**
 * Banner informativo de Modo Somente-Leitura (Read-Only).
 *
 * Exibido no topo das páginas operacionais quando a conta entra em modo somente-leitura pós-trial.
 * Comunica que os dados estão 100% seguros e oferece atalho direto para reativação do Pro.
 *
 * Regras: zero emojis, zero controles nativos, hierarquia de ícones balanceada (AGENTS.md).
 */
export function ReadOnlyBanner({ className, onActivatePro }: ReadOnlyBannerProps) {
  const navigate = useNavigate();

  const handleActivate = () => {
    triggerSensory("selection");
    if (onActivatePro) {
      onActivatePro();
    } else {
      navigate("/assinatura");
    }
  };

  return (
    <div
      role="region"
      aria-label="Aviso de Modo de Visualização"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3.5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning-strong">
          <BookOpen className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-semibold text-foreground">
            Modo Somente-Leitura Ativo
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Seu período de teste encerrou. Seus dados e relatórios estão 100% seguros e disponíveis
            para consulta e exportação. Ative o Plano Pro para liberar novas escritas e edições.
          </p>
        </div>
      </div>

      <div className="shrink-0 sm:self-center">
        <Button
          size="sm"
          onClick={handleActivate}
          className="w-full sm:w-auto gap-1.5 text-xs font-medium"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          Ativar Plano Pro
        </Button>
      </div>
    </div>
  );
}
