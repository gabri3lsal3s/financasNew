import { Link } from "react-router";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { Card, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PublicTripLedgerData } from "@/types/trips";

export interface PublicTripStatusBannersProps {
  trip: PublicTripLedgerData["trip"];
  isAlreadyLinked: boolean;
  isAuthenticated: boolean;
}

/**
 * Banners informativos de viagem finalizada e viagem já sincronizada com a conta do visitante.
 */
export function PublicTripStatusBanners({
  trip,
  isAlreadyLinked,
  isAuthenticated,
}: PublicTripStatusBannersProps) {
  return (
    <>
      {trip.status === "completed" && (
        <div className="p-3.5 sm:p-4 rounded-xl border border-warning/30 bg-warning/10 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-warning-strong">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            <span>Link de compartilhamento encerrado</span>
          </div>
          <p className="text-muted-foreground text-[11px]">
            Esta viagem foi finalizada pelo organizador e suas contas foram encerradas. O link permanece disponível para consulta histórica, com novos lançamentos desativados.
          </p>
        </div>
      )}

      {isAuthenticated && isAlreadyLinked && (
        <Card className="border-border/80 bg-surface shadow-xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Esta viagem está sincronizada com a sua conta Axir
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                Acesse para gerenciar gastos, categorias e conferir o rateio no painel principal.
              </p>
            </div>
          </div>
          <Link
            to={`/viagens/${trip.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "w-full sm:w-auto gap-1.5 text-xs font-semibold shrink-0",
            )}
          >
            <span>Abrir no Aplicativo</span>
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </Card>
      )}
    </>
  );
}
