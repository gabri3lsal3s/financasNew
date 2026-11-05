import { Link } from "react-router";
import {
  ArrowRight,
  ExternalLink,
  PieChart,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { Badge, buttonVariants, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ToolsQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_TOOLS = [
  {
    path: "/ferramentas/simulador-dividas",
    badge: "Quitação de Dívidas",
    title: "Avalanche vs Bola de Neve",
    description: "Compare qual método economiza mais juros e tempo para zerar suas pendências.",
    icon: <ShieldAlert className="size-4 text-warning-strong" aria-hidden="true" />,
  },
  {
    path: "/ferramentas/rebalanceamento",
    badge: "Carteira & Aportes",
    title: "Rebalanceamento Inteligente",
    description: "Calcule a distribuição precisa do aporte mensal para reequilibrar seus investimentos.",
    icon: <PieChart className="size-4 text-portfolio" aria-hidden="true" />,
  },
  {
    path: "/ferramentas/juros-compostos",
    badge: "Longo Prazo & FIRE",
    title: "Juros Compostos & Independência",
    description: "Projete seu patrimônio futuro, juros mensais e o ano de conquista do FIRE.",
    icon: <TrendingUp className="size-4 text-positive-strong" aria-hidden="true" />,
  },
];

export function ToolsQuickDialog({ open, onOpenChange }: ToolsQuickDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Simuladores Financeiros Gratuitos"
      description="Ferramentas abertas e matemáticas. Escolha um simulador para iniciar sem precisar criar conta."
      size="lg"
    >
      <div className="flex flex-col gap-3 py-1">
        {QUICK_TOOLS.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            onClick={() => onOpenChange(false)}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-surface/70 hover:bg-surface hover:border-primary/40 transition-all shadow-2xs"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-hover border border-border/60 mt-0.5">
                {tool.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {tool.title}
                  </p>
                  <Badge variant="muted" size="xs">
                    {tool.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-auto">
              <span className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2.5 text-xs text-primary group-hover:text-primary-strong gap-1 pointer-events-none")}>
                <span>Abrir</span>
                <ArrowRight className="size-3" aria-hidden="true" />
              </span>
            </div>
          </Link>
        ))}

        <div className="pt-2 flex justify-center">
          <Link
            to="/ferramentas"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <span>Ver Hub Completo de Ferramentas</span>
            <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Modal>
  );
}
