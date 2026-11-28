import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ContentLoading,
  EmptyState,
  ErrorState,
  KeyValueGrid,
} from "@/components/ui";
import { formatDateBR, formatDateTimeBR, formatMonthYear } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { useAdminUserSupportDiagnostics } from "@/state";

interface UserSupportDiagnosticsCardProps {
  userId: string;
  enabled: boolean;
}

export function UserSupportDiagnosticsCard({ userId, enabled }: UserSupportDiagnosticsCardProps) {
  const query = useAdminUserSupportDiagnostics(userId, enabled);

  if (!enabled) return null;
  if (query.isLoading) return <ContentLoading />;
  if (query.isError) {
    return <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return <EmptyState title="Nenhum diagnóstico disponível" />;

  const { devices, push_count, last_push_at, ai_quota } = query.data;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Registros de dispositivos e inscrições de push são históricos e não confirmam uma sessão ativa.
      </p>
      <Accordion type="multiple" defaultValue={["devices"]}>
        <AccordionItem value="devices">
          <AccordionTrigger>Dispositivos recentes ({devices.length})</AccordionTrigger>
          <AccordionContent className="space-y-2">
            {devices.length === 0 ? (
              <EmptyState title="Nenhum dispositivo registrado" />
            ) : (
              devices.map((device, index) => (
                <KeyValueGrid
                  key={`${device.last_seen_at}-${index}`}
                  items={[
                    { label: "Dispositivo", value: device.device_label ?? "Sem identificação" },
                    { label: "Plataforma", value: device.platform ?? "Não registrada" },
                    { label: "Versão do app", value: device.app_version ?? "Não registrada" },
                    { label: "Último registro", value: formatDateTimeBR(device.last_seen_at) },
                  ]}
                />
              ))
            )}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="push">
          <AccordionTrigger>Inscrições de push ({push_count})</AccordionTrigger>
          <AccordionContent>
            {push_count === 0 ? (
              <EmptyState title="Nenhuma inscrição de push habilitada" />
            ) : (
              <KeyValueGrid items={[
                { label: "Inscrições habilitadas", value: push_count },
                { label: "Último uso ou atualização", value: last_push_at ? formatDateTimeBR(last_push_at) : "Não registrado" },
              ]} />
            )}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="ai">
          <AccordionTrigger>Consumo da cota de IA no mês</AccordionTrigger>
          <AccordionContent>
            {ai_quota ? (
              <KeyValueGrid items={[
                { label: "Mês de referência", value: formatMonthYear(ai_quota.period_month) },
                { label: "Dia de referência", value: formatDateBR(ai_quota.period_day) },
                { label: "Chamadas de recibos no mês", value: ai_quota.receipt_calls_month },
                { label: "Chamadas de recibos no dia", value: ai_quota.receipt_calls_day },
                { label: "Chamadas em lote no mês", value: ai_quota.batch_calls_month },
                { label: "Chamadas em lote no dia", value: ai_quota.batch_calls_day },
                { label: "Última atualização", value: formatDateTimeBR(ai_quota.updated_at), fullWidth: true },
              ]} />
            ) : (
              <EmptyState title="Nenhuma cota de IA registrada neste mês" />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
