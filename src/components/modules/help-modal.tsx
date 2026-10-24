import { useState } from "react";
import {
  Compass,
  CreditCard,
  HelpCircle,
  ShieldCheck,
  TrendingUp,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupportChatDialog } from "@/components/modules/support";
import { cn } from "@/lib/utils";

export interface HelpModalProps {
  /** Se o diálogo de ajuda está aberto */
  open: boolean;
  /** Callback para alternar o estado de visibilidade */
  onOpenChange: (open: boolean) => void;
  /** Callback acionado para abrir o seletor de trilha da simulação */
  onOpenDemoSelect?: () => void;
  /** Callback opcional acionado para abrir diretamente o diálogo de suporte */
  onOpenSupport?: () => void;
}

interface FaqItem {
  id: string;
  icon: typeof TrendingUp;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "rebalance",
    icon: TrendingUp,
    question: "Como funciona o Rebalanceamento de Carteira?",
    answer:
      "O motor de rebalanceamento calcula a distância percentual entre sua posição atual e os pesos-alvo que você configurou. Ao simular um aporte, o sistema calcula a alocação exata para direcionar o capital prioritariamente aos ativos mais distantes da meta ideal.",
  },
  {
    id: "invoices",
    icon: CreditCard,
    question: "Como são organizadas as Faturas de Cartão?",
    answer:
      "As transações feitas com cartão de crédito são agrupadas por competência e vencimento com base no dia de fechamento cadastrado para o cartão, respeitando o regime financeiro da fatura.",
  },
  {
    id: "security",
    icon: ShieldCheck,
    question: "Meus dados financeiros estão protegidos?",
    answer:
      "Sim. O sistema utiliza isolamento estrito de dados por usuário com políticas de segurança em nível de linha (RLS) no banco de dados e tráfego 100% criptografado. Nenhuma senha de conta bancária é solicitada.",
  },
  {
    id: "simulation",
    icon: Compass,
    question: "O Modo Simulação altera minhas finanças reais?",
    answer:
      "Não. O modo de simulação opera exclusivamente em memória no seu navegador com um conjunto de dados ilustrativos. Seus registros reais permanecem intactos e são restaurados no mesmo instante ao desligar a simulação.",
  },
];

/**
 * Modal central de Ajuda & Suporte do sistema.
 * Disponibiliza atalhos rápidos para o tour interativo, perguntas frequentes sobre os motores
 * financeiros e canais de orientação.
 */
export function HelpModal({
  open,
  onOpenChange,
  onOpenDemoSelect,
  onOpenSupport,
}: HelpModalProps) {
  const [expandedFaq, setExpandedFaq] = useState<string | null>("rebalance");
  const [supportChatOpen, setSupportChatOpen] = useState(false);

  const handleToggleFaq = (id: string) => {
    setExpandedFaq((prev) => (prev === id ? null : id));
  };

  const handleStartTour = () => {
    onOpenChange(false);
    if (onOpenDemoSelect) {
      onOpenDemoSelect();
    }
  };

  const handleOpenSupport = () => {
    if (onOpenSupport) {
      onOpenChange(false);
      onOpenSupport();
    } else {
      setSupportChatOpen(true);
    }
  };

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Central de Ajuda & Suporte"
        description="Orientações de uso, modo de demonstração interativo e dúvidas frequentes"
        size="lg"
      >
        <div className="space-y-6 pt-2 pb-2">
          {/* Card Destaque: Modo Simulação */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-accent/5 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Compass className="size-5 text-primary-strong shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Tour Guiado & Modo Simulação
                  </h3>
                  <Badge variant="muted" size="xs">
                    Sem risco
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  Explore as telas e motores do aplicativo com dados realistas em memória.
                  Você pode experimentar o rebalanceamento de carteira e gestão de faturas
                  sem alterar nenhum dos seus registros reais.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleStartTour}
                className="gap-2 shrink-0 self-start sm:self-center font-medium"
              >
                <Compass className="size-4" aria-hidden="true" />
                <span>Rever Tour Guiado</span>
              </Button>
            </div>
          </div>

          {/* Dúvidas Frequentes */}
          <section aria-labelledby="faq-heading" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <HelpCircle className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="faq-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dúvidas Frequentes
              </h3>
            </div>

            <div className="space-y-2">
              {FAQ_ITEMS.map((item) => {
                const isExpanded = expandedFaq === item.id;
                const ItemIcon = item.icon;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/80 bg-surface overflow-hidden shadow-xs transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleFaq(item.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center justify-between gap-3 p-3.5 text-left hover:bg-surface-hover/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ItemIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="text-xs font-semibold text-foreground">
                          {item.question}
                        </span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          isExpanded && "rotate-180 text-foreground",
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-0 text-xs text-muted-foreground leading-relaxed border-t border-border/40 mt-1">
                        <p className="pt-2">{item.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Contato & Atendimento Direto */}
          <div className="rounded-xl border border-border/80 bg-surface-subtle/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2.5 min-w-0">
              <MessageSquare className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Precisa de suporte personalizado, relatar um bug ou enviar uma sugestão?</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleOpenSupport}
              className="shrink-0 self-start sm:self-center font-medium gap-1.5"
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              <span>Falar com o Suporte</span>
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {supportChatOpen && (
        <SupportChatDialog
          open={supportChatOpen}
          onOpenChange={setSupportChatOpen}
        />
      )}
    </>
  );
}
