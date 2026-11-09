import { TicketsTab } from "./tickets-tab";

export function AdminTicketsPage() {
  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Central de Chamados &amp; Suporte
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Fila de atendimento de clientes, controle de SLA e registro de notas internas
        </p>
      </div>

      <TicketsTab />
    </div>
  );
}
