import { useState } from "react";
import { Compass, HelpCircle, LifeBuoy, Send } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { useMarkTicketAsReadMutation, useMySupportTickets } from "@/state";
import { SupportChatDialog } from "@/components/modules/support/support-chat-dialog";
import { DemoTrackSelectModal, HelpModal } from "@/components/modules";
import { SupportTicketCard } from "./support/support-ticket-card";

export function SupportTab() {
  const [chatOpen, setChatOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [demoSelectOpen, setDemoSelectOpen] = useState(false);
  const ticketsQuery = useMySupportTickets();
  const markAsReadMutation = useMarkTicketAsReadMutation();

  const tickets = ticketsQuery.data ?? [];

  const handleMarkRead = (ticketId: string) => {
    markAsReadMutation.mutate(ticketId);
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
      {/* Card 1: Autoatendimento, FAQ e Tour Guiado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Ajuda Rápida &amp; Tour Interativo</span>
          </CardTitle>
          <CardDescription>
            Consulte respostas rápidas sobre o funcionamento do Axir ou explore o modo de demonstração sem risco.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHelpOpen(true)}
              className="justify-start gap-2.5"
            >
              <HelpCircle className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Abrir FAQ e Central de Ajuda</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDemoSelectOpen(true)}
              className="justify-start gap-2.5"
            >
              <Compass className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Explorar Tour Guiado</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Central de Suporte & Chamados */}
      <Card data-tour="settings-support-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <LifeBuoy className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Central de Suporte &amp; Chamados</span>
            </CardTitle>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setChatOpen(true)}
              className="gap-2 shrink-0 self-start sm:self-auto"
            >
              <Send className="size-3.5" aria-hidden="true" />
              <span>Novo Chamado</span>
            </Button>
          </div>
          <CardDescription>
            Acompanhe o retorno das suas dúvidas, sugestões e reportes enviados à administração.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {ticketsQuery.isLoading ? (
            <div className="space-y-3" aria-hidden="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy className="size-6 text-muted-foreground" aria-hidden="true" />}
              title="Nenhum chamado aberto"
              description="Você ainda não enviou nenhuma mensagem ou dúvida para a nossa equipe."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setChatOpen(true)}
                  className="gap-2"
                >
                  <LifeBuoy className="size-4" aria-hidden="true" />
                  <span>Enviar Dúvida ou Sugestão</span>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3.5">
              {tickets.map((ticket) => (
                <SupportTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isMarkingRead={markAsReadMutation.isPending}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SupportChatDialog open={chatOpen} onOpenChange={setChatOpen} />
      <HelpModal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        onOpenDemoSelect={() => setDemoSelectOpen(true)}
        onOpenSupport={() => setChatOpen(true)}
      />
      <DemoTrackSelectModal open={demoSelectOpen} onOpenChange={setDemoSelectOpen} />
    </div>
  );
}
