import {
  Check,
  DollarSign,
  LogOut,
  Plus,
  RotateCcw,
  Share2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui";
import type { TripStatus } from "@/types/trips";

export interface TripDetailsHeaderActionsProps {
  tripStatus: TripStatus;
  isHost: boolean;
  hasMember: boolean;
  copiedLink: boolean;
  onOpenAddExpense: () => void;
  onOpenSettlement: () => void;
  onOpenInvite: () => void;
  onCopyPublicLink: () => void;
  onOpenReopenTrip: () => void;
  onOpenDeleteTrip: () => void;
  onOpenLeaveTrip: () => void;
}

export function TripDetailsHeaderActions({
  tripStatus,
  isHost,
  hasMember,
  copiedLink,
  onOpenAddExpense,
  onOpenSettlement,
  onOpenInvite,
  onCopyPublicLink,
  onOpenReopenTrip,
  onOpenDeleteTrip,
  onOpenLeaveTrip,
}: TripDetailsHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
      <Button
        type="button"
        size="sm"
        variant="solid"
        onClick={onOpenAddExpense}
        className="gap-1.5"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        <span>Nova Despesa</span>
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        data-tour="trip-settlement-card"
        onClick={onOpenSettlement}
        className="gap-1.5"
      >
        <DollarSign className="size-3.5" aria-hidden="true" />
        <span>Fechar Contas</span>
      </Button>

      <div className="flex items-center gap-1.5 shrink-0">
        {isHost && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenInvite}
            className="size-9 !w-9 !min-w-9 sm:size-8 sm:!w-8 sm:!min-w-8 p-0 shrink-0"
            title="Convidar amigos para a viagem via link ou WhatsApp"
            aria-label="Convidar Amigos"
          >
            <UserPlus className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Convidar Amigos</span>
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          variant="outline"
          sensoryIntent={false}
          onClick={onCopyPublicLink}
          disabled={tripStatus === "completed"}
          className="size-9 !w-9 !min-w-9 sm:size-8 sm:!w-8 sm:!min-w-8 p-0 shrink-0"
          title={
            copiedLink
              ? "Link de acesso copiado!"
              : tripStatus === "completed"
                ? "Link de compartilhamento encerrado"
                : "Copiar link de acesso público"
          }
          aria-label="Link Público"
        >
          {copiedLink ? (
            <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
          ) : (
            <Share2 className="size-3.5" aria-hidden="true" />
          )}
          <span className="sr-only">Link Público</span>
        </Button>

        {isHost && tripStatus === "completed" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenReopenTrip}
            className="size-9 !w-9 !min-w-9 sm:size-8 sm:!w-8 sm:!min-w-8 p-0 shrink-0"
            title="Reabrir a viagem para novos lançamentos e acertos"
            aria-label="Reabrir Viagem"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Reabrir Viagem</span>
          </Button>
        )}

        {isHost && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenDeleteTrip}
            className="size-9 !w-9 !min-w-9 sm:size-8 sm:!w-8 sm:!min-w-8 p-0 shrink-0 text-muted-foreground hover:text-critical-strong hover:border-critical/30"
            title="Excluir viagem definitivamente"
            aria-label="Excluir Viagem"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Excluir Viagem</span>
          </Button>
        )}

        {!isHost && hasMember && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenLeaveTrip}
            className="size-9 !w-9 !min-w-9 sm:size-8 sm:!w-8 sm:!min-w-8 p-0 shrink-0 text-muted-foreground hover:text-critical-strong hover:border-critical/30"
            title="Desvincular sua conta e sair desta viagem"
            aria-label="Sair da Viagem"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Sair da Viagem</span>
          </Button>
        )}
      </div>
    </div>
  );
}
