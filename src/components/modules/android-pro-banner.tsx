import { useNavigate } from "react-router";
import { Download, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AndroidProBannerProps {
  onDismiss: () => void;
  className?: string;
}

export function AndroidProBanner({ onDismiss, className }: AndroidProBannerProps) {
  const navigate = useNavigate();

  const handleOpenDevicesTab = () => {
    navigate("/configuracoes?tab=devices");
  };

  return (
    <div
      role="region"
      aria-label="Sugestão do Aplicativo Android Pro"
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-surface to-surface p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0 pr-6 sm:pr-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-strong">
          <Zap className="size-4.5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-foreground">
              Experimente a Leitura Automática de Gastos
            </p>
            <Badge variant="default" size="xs">
              App Android Pro
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Detecta compras no cartão e transações Pix em tempo real no seu celular. Sem digitação manual.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 sm:self-center">
        <Button
          size="sm"
          variant="default"
          onClick={handleOpenDevicesTab}
          className="w-full sm:w-auto gap-1.5 text-xs font-medium"
        >
          <Download className="size-3.5" aria-hidden="true" />
          <span>Baixar App Pro</span>
        </Button>

        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 sm:static flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          aria-label="Dispensar sugestão por 7 dias"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
