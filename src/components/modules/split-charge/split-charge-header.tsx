import { Calendar, Receipt, Sparkles, User, Users } from "lucide-react";
import { Badge, CardTitle } from "@/components/ui";
import { formatDateBR } from "@/lib/date";

export interface SplitChargeHeaderProps {
  title: string;
  date: string;
  hostName: string;
  peopleCount: number;
  isDemo?: boolean;
}

/**
 * Cabeçalho editorial do `SplitChargeCard` (badges de contexto, data, título e anfitrião).
 */
export function SplitChargeHeader({
  title,
  date,
  hostName,
  peopleCount,
  isDemo = false,
}: SplitChargeHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="default" size="xs" className="gap-1">
            <Receipt className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Despesa Compartilhada</span>
          </Badge>
          {isDemo && (
            <Badge variant="muted" size="xs" className="gap-1 shrink-0">
              <Sparkles className="size-3 text-portfolio" aria-hidden="true" />
              <span>Exemplo Demonstrativo</span>
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>{formatDateBR(date)}</span>
        </div>
      </div>

      <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-2">
        {title || "Racha de Despesa"}
      </CardTitle>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
        <div className="flex items-center gap-1.5">
          <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>
            Por: <strong className="font-semibold text-foreground">{hostName || "Anfitrião"}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>{peopleCount} participantes</span>
        </div>
      </div>
    </>
  );
}
