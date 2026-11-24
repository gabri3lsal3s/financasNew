import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Compass, HelpCircle, MessageSquare } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, Modal, ModalFooter } from "@/components/ui";
import { SupportChatDialog } from "@/components/modules/support";
import { useModalTransition } from "@/hooks/use-modal-transition";
import { startDemo } from "@/state/demo-mode";
import { FAQ_ITEMS } from "./help-faq-data";

export interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDemoSelect?: () => void;
  onOpenSupport?: () => void;
}

/**
 * Modal central de Ajuda & Suporte do sistema com tour interativo e FAQ em Accordion.
 */
export function HelpModal({
  open,
  onOpenChange,
  onOpenDemoSelect,
  onOpenSupport,
}: HelpModalProps) {
  const navigate = useNavigate();
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const [hasOpenedSupportChat, setHasOpenedSupportChat] = useState(false);
  const { scheduleAfterClose, cancelTransition } = useModalTransition();

  useEffect(() => {
    if (open) cancelTransition();
  }, [open, cancelTransition]);

  const handleStartTour = () => {
    if (onOpenDemoSelect) {
      scheduleAfterClose(() => onOpenChange(false), onOpenDemoSelect);
    } else {
      cancelTransition();
      onOpenChange(false);
      startDemo("finances");
      navigate("/");
    }
  };

  const handleOpenSupport = () => {
    if (onOpenSupport) {
      scheduleAfterClose(() => onOpenChange(false), onOpenSupport);
    } else {
      scheduleAfterClose(
        () => onOpenChange(false),
        () => {
          setHasOpenedSupportChat(true);
          setSupportChatOpen(true);
        },
      );
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Central de Ajuda & Suporte"
        description="Orientações de uso, modo de demonstração interativo e dúvidas frequentes"
        size="lg"
        footer={
          <ModalFooter borderless>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-6 pt-2 pb-2">
          <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-accent/5 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Compass className="size-5 text-primary-strong shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Tour Guiado &amp; Modo Simulação
                  </h3>
                  <Badge variant="muted" size="xs">Sem risco</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  Explore as telas e motores do aplicativo com dados realistas em memória.
                  Você pode experimentar o rebalanceamento de carteira, faturas e finanças
                  compartilhadas sem alterar nenhum dos seus registros reais.
                </p>
              </div>
              <div className="shrink-0">
                <Button type="button" size="sm" onClick={handleStartTour} className="gap-2 shrink-0 font-medium w-full sm:w-auto">
                  <Compass className="size-4" aria-hidden="true" />
                  <span>Rever Tour Guiado</span>
                </Button>
              </div>
            </div>
          </div>

          <section aria-labelledby="faq-heading" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="faq-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dúvidas Frequentes
              </h3>
            </div>

            <Accordion type="single" collapsible defaultValue="rebalance">
              {FAQ_ITEMS.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger className="px-3.5 py-3 text-xs sm:text-sm">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <ItemIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="text-xs font-semibold text-foreground">{item.question}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-3.5 pb-3.5 text-xs text-muted-foreground leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </section>

          <div className="rounded-xl border border-border/80 bg-muted/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2.5 min-w-0">
              <MessageSquare className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Precisa de suporte personalizado, relatar um bug ou enviar uma sugestão?</span>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={handleOpenSupport} className="shrink-0 self-start sm:self-center font-medium gap-1.5">
              <MessageSquare className="size-3.5" aria-hidden="true" />
              <span>Falar com o Suporte</span>
            </Button>
          </div>
        </div>
      </Modal>

      {hasOpenedSupportChat ? (
        <SupportChatDialog open={supportChatOpen} onOpenChange={setSupportChatOpen} />
      ) : null}
    </>
  );
}
