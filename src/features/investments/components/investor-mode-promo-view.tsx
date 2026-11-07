import { useNavigate } from "react-router";
import { ArrowLeft, Check, Sparkles, Target, TrendingUp, Wallet } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { useAppMode } from "@/state";

export interface InvestorModePromoViewProps {
  onActivate?: () => void;
}

const HIGHLIGHTS = [
  {
    icon: Target,
    title: "Metas & Rebalanceamento Inteligente",
    description:
      "Defina alocações ideais para ações, FIIs e renda fixa. Nosso motor calcula exatamente onde aportar cada centavo para manter sua carteira equilibrada.",
  },
  {
    icon: TrendingUp,
    title: "Acompanhamento de Proventos",
    description:
      "Extrato unificado de dividendos, JCP e rendimentos mensais com calendário projetado e cálculo de retorno sobre custo (Yield on Cost).",
  },
  {
    icon: Wallet,
    title: "Snapshots Patrimoniais & Reserva",
    description:
      "Evolução histórica do patrimônio consolidado, integração com reserva de emergência e termômetro de autonomia financeira sem planilhas paralelas.",
  },
] as const;

/**
 * Tela de Acolhimento Amigável do Módulo de Investimentos (§Plano 07).
 *
 * Exibida graciosa e informativamente quando um usuário em Modo Essencial acessa
 * a rota `/investments` diretamente (zero 404 e zero redirecionamentos secos).
 * Permite ativar a experiência patrimonial completa em 1 clique sem recarregar a janela.
 */
export function InvestorModePromoView({ onActivate }: InvestorModePromoViewProps) {
  const navigate = useNavigate();
  const { setAppMode, isUpdating } = useAppMode();

  const handleActivate = async () => {
    triggerSensory("action");
    if (onActivate) {
      onActivate();
    } else {
      await setAppMode("investor");
    }
  };

  const handleBackToHome = () => {
    triggerSensory("selection");
    navigate("/");
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center py-6 sm:py-10 animate-fade-slide-in">
      {/* Herói Editorial com Ícone Nível 2 */}
      <div className="mb-6 flex flex-col items-center text-center">
        <span
          className="mb-4 flex size-14 sm:size-16 items-center justify-center rounded-2xl border border-portfolio/25 bg-portfolio/10 text-portfolio shadow-xs"
          aria-hidden="true"
        >
          <Sparkles className="size-7 sm:size-8" />
        </span>

        <div className="mb-2 flex items-center gap-2">
          <Badge variant="muted" size="sm">
            Módulo Opcional & Adaptativo
          </Badge>
          <Badge variant="portfolio" size="sm">
            Modo Investidor
          </Badge>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Gestão Patrimonial & Carteira de Ativos
        </h1>
        <p className="mt-2 max-w-lg text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Dê o próximo passo nas suas finanças quando estiver pronto. Ative as ferramentas avançadas de
          investimento com um único clique, sem perder nada da sua organização diária.
        </p>
      </div>

      {/* Grid de Recursos / Pilares */}
      <div className="grid w-full grid-cols-1 sm:grid-cols-3 gap-3.5 mb-8">
        {HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex flex-col rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs transition-all hover:border-border"
            >
              <div className="mb-3 flex size-8 items-center justify-center rounded-lg border border-portfolio/20 bg-portfolio/10 text-portfolio">
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-semibold text-foreground mb-1.5 leading-snug">
                {item.title}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed mt-auto">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Card de Ação & Confirmação */}
      <div className="w-full rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold text-foreground">
            <Check className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
            <span>Pode ser ativado ou desativado a qualquer momento</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Você pode alternar entre o Modo Essencial e o Modo Investidor nas Configurações do aplicativo.
          </p>
        </div>

        <div className="flex w-full sm:w-auto items-center justify-end gap-2.5 shrink-0 flex-col sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={handleBackToHome}
            className="w-full sm:w-auto text-xs font-semibold rounded-xl h-9.5 gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Voltar para o Início</span>
          </Button>

          <Button
            type="button"
            variant="portfolio"
            size="default"
            onClick={handleActivate}
            disabled={isUpdating}
            className="w-full sm:w-auto text-xs font-semibold rounded-xl h-9.5 gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>{isUpdating ? "Ativando..." : "Ativar Módulo de Investimentos"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
