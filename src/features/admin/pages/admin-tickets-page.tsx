import { useSearchParams } from "react-router";
import { BellRing, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { ErrorState, Tabs } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { useAdminBroadcastNotifications, useAdminSendBroadcast } from "@/state";
import { BroadcastComposerForm } from "../components/broadcast-composer-form";
import { BroadcastHistoryList } from "../components/broadcast-history-list";
import { TicketsTab } from "./tickets-tab";

function BroadcastsTab() {
  const broadcastsQuery = useAdminBroadcastNotifications();
  const sendMutation = useAdminSendBroadcast();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BroadcastComposerForm
        isPending={sendMutation.isPending}
        onSubmit={async (payload) => {
          await sendMutation.mutateAsync(payload);
        }}
      />

      {broadcastsQuery.isError ? (
        <ErrorState
          message={getErrorMessage(broadcastsQuery.error)}
          onRetry={() => void broadcastsQuery.refetch()}
        />
      ) : (
        <BroadcastHistoryList
          broadcasts={broadcastsQuery.data ?? []}
          isLoading={broadcastsQuery.isLoading}
        />
      )}
    </div>
  );
}

export function AdminTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "comunicados" ? "comunicados" : "chamados";

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        title="Chamados"
        description="Fila de atendimento e comunicados"
      />

      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            next.set("tab", tab);
            return next;
          }, { replace: true });
        }}
        ariaLabel="Seções de atendimento"
        items={[
          { value: "chamados", label: "Chamados", icon: <LifeBuoy aria-hidden="true" />, content: <TicketsTab /> },
          { value: "comunicados", label: "Comunicados", icon: <BellRing aria-hidden="true" />, content: <BroadcastsTab /> },
        ]}
      />
    </div>
  );
}
