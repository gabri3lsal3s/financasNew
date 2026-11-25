import { AlertCircle } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { useAdminBroadcastNotifications, useAdminSendBroadcast } from "@/state";
import { BroadcastComposerForm } from "../components/broadcast-composer-form";
import { BroadcastHistoryList } from "../components/broadcast-history-list";

export function AdminNotificationsPage() {
  const broadcastsQuery = useAdminBroadcastNotifications();
  const sendMutation = useAdminSendBroadcast();
  const broadcasts = broadcastsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        title="Comunicados & Push"
        description="Disparo e gestão de avisos em tempo real"
      />

      <BroadcastComposerForm
        isPending={sendMutation.isPending}
        onSubmit={async (payload) => {
          await sendMutation.mutateAsync(payload);
        }}
      />

      {broadcastsQuery.isError ? (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar os comunicados"
          description="Ocorreu um erro ao buscar o histórico de mensagens enviadas. Tente novamente."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void broadcastsQuery.refetch()}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : (
        <BroadcastHistoryList
          broadcasts={broadcasts}
          isLoading={broadcastsQuery.isLoading}
        />
      )}
    </div>
  );
}
