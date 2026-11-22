import {
  ArrowRight,
  CreditCard,
  HandCoins,
  HeartHandshake,
  Link2,
  PieChart,
  Share2,
  Wallet,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { ScrollReveal } from "./scroll-reveal";

export type EcosystemDestination =
  | { section: "dores"; key: "cash" | "capture" | "debts" | "shared" | "invest" }
  | { section: "profundidade"; key: "investments" | "reports" | "security" };

export interface UnifiedEcosystemSectionProps {
  onSelectDestination?: (destination: EcosystemDestination) => void;
}

interface EcosystemNode {
  step: string;
  title: string;
  replaces: string;
  description: string;
  icon: typeof Wallet;
  destination: EcosystemDestination;
  actionLabel: string;
}

const ECOSYSTEM_NODES: readonly EcosystemNode[] = [
  {
    step: "01",
    title: "Gasto Diário & Caixa Real",
    replaces: "No lugar de anotações soltas e saldo enganoso",
    description:
      "Desconta compromissos do mês e traduz o que sobra em um ritmo diário claro para gastar sem culpa.",
    icon: Wallet,
    destination: { section: "dores", key: "cash" },
    actionLabel: "Simular caixa real",
  },
  {
    step: "02",
    title: "Cartões & Parcelas (até 60x)",
    replaces: "No lugar de planilhas de fatura",
    description:
      "Faturas futuras, melhor dia de compra, importação e conciliação de extrato e radar de assinaturas.",
    icon: CreditCard,
    destination: { section: "dores", key: "debts" },
    actionLabel: "Ver parcelas e faturas",
  },
  {
    step: "03",
    title: "Contas a Pagar & a Receber",
    replaces: "No lugar do caderno de dívidas",
    description:
      "Controle o que você deve, contratos Price/SAC com amortização e quem ainda precisa acertar com você.",
    icon: HandCoins,
    destination: { section: "dores", key: "debts" },
    actionLabel: "Ver controle de dívidas",
  },
  {
    step: "04",
    title: "Racha de Parcelas & Viagens",
    replaces: "No lugar de apps separados de rateio",
    description:
      "Divida compras à vista ou parceladas com amigos via link Pix sem exigir que eles criem conta.",
    icon: Share2,
    destination: { section: "dores", key: "shared" },
    actionLabel: "Ver racha e viagens",
  },
  {
    step: "05",
    title: "Finanças da Família",
    replaces: "No lugar de acertos desencontrados no chat",
    description:
      "Orçamento compartilhado para casais e casas com teto conjunto e divisão proporcional justa.",
    icon: HeartHandshake,
    destination: { section: "dores", key: "shared" },
    actionLabel: "Ver Modo Família",
  },
  {
    step: "06",
    title: "Investimentos, Preço Teto & Relatórios",
    replaces: "No lugar de planilhas complexas de carteira",
    description:
      "Metas por classe e ativo, valuation (Bazin, Graham, Gordon e FIIs), rebalanceamento, DRE e Lâmina.",
    icon: PieChart,
    destination: { section: "profundidade", key: "investments" },
    actionLabel: "Explorar investimentos",
  },
];

export function UnifiedEcosystemSection({ onSelectDestination }: UnifiedEcosystemSectionProps) {
  const handleSelect = (destination: EcosystemDestination) => {
    onSelectDestination?.(destination);
    const targetId = destination.section === "dores" ? "dores" : "profundidade";
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="ecossistema"
      className="py-14 md:py-24 border-t border-border/60 bg-surface-raised/25 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 space-y-10 sm:space-y-12">
        <ScrollReveal className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong">
            <Link2 className="size-3.5 sm:size-4" aria-hidden="true" />
            <span>Consolidação de Ponta a Ponta</span>
          </div>
          <h2 className="mt-3 sm:mt-4 font-display text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Um único aplicativo no lugar de 6 controles espalhados
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground leading-relaxed">
            Em vez de pular entre aplicativo de banco, planilha de cartão, caderno de quem te deve e
            outro sistema para investir, tudo no Axir nasce conectado.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {ECOSYSTEM_NODES.map((node, index) => {
            const Icon = node.icon;
            return (
              <ScrollReveal key={node.step} delay={index * 50} className="h-full">
                <button
                  type="button"
                  onClick={() => handleSelect(node.destination)}
                  className="w-full h-full text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl cursor-pointer"
                >
                  <Card className="h-full border-border/80 bg-surface shadow-xs p-5 rounded-2xl flex flex-col justify-between gap-4 transition-all group-hover:border-primary/50 group-hover:shadow-md">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon
                            className="size-4 text-muted-foreground group-hover:text-primary-strong transition-colors shrink-0"
                            aria-hidden="true"
                          />
                          <h3 className="font-display text-sm sm:text-base font-bold text-foreground">
                            {node.title}
                          </h3>
                        </div>
                        <Badge variant="muted" size="xs" className="font-mono shrink-0">
                          {node.step}
                        </Badge>
                      </div>

                      <p className="text-[11px] font-medium text-muted-foreground">
                        {node.replaces}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {node.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-medium text-muted-foreground group-hover:text-primary-strong transition-colors">
                      <span>{node.actionLabel}</span>
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </Card>
                </button>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal delay={120}>
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <Link2 className="size-4 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Tudo conversa automaticamente:</strong> ao
                dividir uma compra parcelada, sua parte entra na fatura, a dos amigos vira conta a
                receber via Pix e seu Caixa Real e meta de aporte se recalculam na hora.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
