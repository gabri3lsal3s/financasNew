import { PageHeader } from "@/components/layout";
import { useAdminBroadcastNotifications, useAdminSendBroadcast } from "@/state";
import { BroadcastComposerForm } from "../components/broadcast-composer-form";
import { BroadcastHistoryList } from "../components/broadcast-history-list";

export function AdminNotificationsPage() {
  const broadcastsQuery = useAdminBroadcastNotifications();
  const sendMutation = useAdminSendBroadcast();
  const broadcasts = broadcastsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      <PageHeader
        title="Central de Notificações & Push"
        description="Dispare comunicados em tempo real diretamente para o aplicativo dos usuários"
      />

      <BroadcastComposerForm
        isPending={sendMutation.isPending}
        onSubmit={async (payload) => {
          await sendMutation.mutateAsync(payload);
        }}
      />

      <BroadcastHistoryList
        broadcasts={broadcasts}
        isLoading={broadcastsQuery.isLoading}
      />
    </div>
  );
}
