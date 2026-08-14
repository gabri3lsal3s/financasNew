import { CreditCard } from "lucide-react";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface SmartInvoiceProjectionCardProps {
  /** Total de faturas em aberto (competência auto-selecionada por cartão). */
  openInvoicesCents: number;
  /** Quantidade de cartões com saldo em aberto. */
  openCount: number;
  /** Data do próximo vencimento (ISO) — null quando nada em aberto. */
  nearestDueDate: string | null;
}

function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Card inteligente de faturas em aberto (F8) — projeção da próxima competência. */
export function SmartInvoiceProjectionCard({
  openInvoicesCents,
  openCount,
  nearestDueDate,
}: SmartInvoiceProjectionCardProps) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <CreditCard className="size-4 text-foreground" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">Faturas em aberto</h2>
      </div>

      {openCount === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma fatura em aberto neste momento.</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="num text-2xl font-semibold text-foreground">
            {formatCentsAsBRL(openInvoicesCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            {openCount} {openCount === 1 ? "cartão" : "cartões"} com saldo
            {nearestDueDate ? (
              <>
                {" "}· próximo vencimento <span className="font-medium text-foreground">{formatDueDate(nearestDueDate)}</span>
              </>
            ) : null}
          </p>
        </div>
      )}
    </article>
  );
}
