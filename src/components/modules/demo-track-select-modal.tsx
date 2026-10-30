import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Briefcase,
  Calculator,
  Check,
  ChevronRight,
  CreditCard,
  Lightbulb,
  PieChart,
  PlusCircle,
  Settings,
  Smartphone,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge, Button, Modal, Tabs, type TabItem } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { isNativePlatform } from "@/services/native/platform";
import { getTourTrackMeta, type TourTrackId } from "@/domain/demo-simulation";
import { hasCompletedDemoTour, startDemo } from "@/state/demo-mode";

export interface DemoTrackSelectModalProps {
  /** Se o diálogo seletor de trilha está visível. */
  open: boolean;
  /** Callback acionado ao alterar a visibilidade do modal. */
  onOpenChange: (open: boolean) => void;
  /** Callback opcional acionado quando o usuário seleciona e inicia uma trilha. */
  onSelectTrack?: (track: TourTrackId) => void;
  /** Callback opcional acionado quando o usuário decide pular a simulação e ir para a conta real. */
  onSkipToReal?: () => void;
}

interface TourCardItemProps {
  id: TourTrackId;
  title: string;
  description: string;
  stepsCount: number;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  iconColorClass?: string;
  isCompleted: boolean;
  isPrimary?: boolean;
  onSelect: (track: TourTrackId) => void;
}

function TourCardItem({
  id,
  title,
  description,
  stepsCount,
  icon: Icon,
  iconColorClass,
  isCompleted,
  isPrimary,
  onSelect,
}: TourCardItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        "w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20",
        isPrimary
          ? "border-primary/40 bg-surface/80 hover:bg-surface-hover/80 hover:border-primary"
          : "border-border/80 hover:border-primary/50 bg-surface/50 hover:bg-surface-hover/70",
      )}
    >
      <div
        className={cn(
          "size-9 rounded-lg border border-border/80 bg-surface flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs",
          iconColorClass ?? "text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </h4>
          {isCompleted ? (
            <Badge variant="positive" size="xs" className="gap-1 shrink-0">
              <Check className="size-3" aria-hidden="true" />
              <span>Concluído</span>
            </Badge>
          ) : (
            <Badge variant="muted" size="xs" className="shrink-0">
              {stepsCount} passos
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>

      <ChevronRight
        className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 self-center"
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * Hub de Tours Guiados e Demonstração Interativa (DemoTrackSelectModal).
 * Permite ao usuário escolher entre a visão geral das trilhas ou micro-tours específicos
 * de aprendizado (Wizard +, Cartões, Tetos, Insights, Ativos, Metas, Aportes, Suporte e APK Nativo).
 */
export function DemoTrackSelectModal({
  open,
  onOpenChange,
  onSelectTrack,
  onSkipToReal,
}: DemoTrackSelectModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("finances");
  const isNative = isNativePlatform();

  const handleSelectTrack = useCallback(
    (track: TourTrackId) => {
      triggerSensory("action");
      startDemo(track);

      if (track === "investments") {
        navigate("/investimentos");
      } else {
        const meta = getTourTrackMeta(track);
        navigate(meta?.startRoute ?? "/");
      }

      onSelectTrack?.(track);
      onOpenChange(false);
    },
    [navigate, onOpenChange, onSelectTrack],
  );

  const handleSkip = useCallback(() => {
    onOpenChange(false);
    if (onSkipToReal) {
      onSkipToReal();
    } else {
      navigate("/?novo=despesa");
    }
  }, [navigate, onOpenChange, onSkipToReal]);

  const nativeCompleted = hasCompletedDemoTour("app_native_apk");
  const financesOverviewCompleted =
    hasCompletedDemoTour("finances") || hasCompletedDemoTour("finances_overview");
  const investmentsOverviewCompleted =
    hasCompletedDemoTour("investments") || hasCompletedDemoTour("investments_overview");

  const tabItems: TabItem[] = useMemo(
    () => [
      {
        value: "finances",
        label: "Finanças",
        shortLabel: "Finanças",
        icon: <Wallet className="size-4 text-positive-strong" aria-hidden="true" />,
        content: (
          <div className="space-y-4 pt-3 pb-1">
            {/* Visão Geral Finanças */}
            <TourCardItem
              id="finances"
              title="Finanças Diárias & Cartões"
              description="Explore entradas, saídas, faturas automáticas e limites de gastos."
              stepsCount={4}
              icon={Wallet}
              iconColorClass="text-positive-strong"
              isCompleted={financesOverviewCompleted}
              isPrimary={true}
              onSelect={handleSelectTrack}
            />

            <div>
              <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">
                Micro-Tours Específicos
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <TourCardItem
                  id="finances_wizard"
                  title="Botão Wizard (+) e Lançamento"
                  description="Registro rápido de despesas, receitas, Pix e parcelamentos inteligentes."
                  stepsCount={3}
                  icon={PlusCircle}
                  iconColorClass="text-primary"
                  isCompleted={hasCompletedDemoTour("finances_wizard")}
                  onSelect={handleSelectTrack}
                />
                <TourCardItem
                  id="finances_cards"
                  title="Cartões, Faturas e Limites"
                  description="Faturas abertas, limite disponível, melhor dia de compra e parcelas futuras."
                  stepsCount={3}
                  icon={CreditCard}
                  iconColorClass="text-warning-strong"
                  isCompleted={hasCompletedDemoTour("finances_cards")}
                  onSelect={handleSelectTrack}
                />
                <TourCardItem
                  id="finances_budgets"
                  title="Categorias e Tetos de Gastos"
                  description="Definição de tetos por categoria e alertas automáticos de ritmo de consumo."
                  stepsCount={3}
                  icon={PieChart}
                  iconColorClass="text-negative-strong"
                  isCompleted={hasCompletedDemoTour("finances_budgets")}
                  onSelect={handleSelectTrack}
                />
                <TourCardItem
                  id="finances_insights"
                  title="Smart Advisor e Relatórios"
                  description="Recomendações automáticas de economia, radar de assinaturas e fechamento do mês."
                  stepsCount={3}
                  icon={Lightbulb}
                  iconColorClass="text-primary"
                  isCompleted={hasCompletedDemoTour("finances_insights")}
                  onSelect={handleSelectTrack}
                />
              </div>
            </div>
          </div>
        ),
      },
      {
        value: "investments",
        label: "Investimentos",
        shortLabel: "Investimentos",
        icon: <TrendingUp className="size-4 text-portfolio" aria-hidden="true" />,
        content: (
          <div className="space-y-4 pt-3 pb-1">
            {/* Visão Geral Investimentos */}
            <TourCardItem
              id="investments"
              title="Investimentos & Rebalanceamento"
              description="Conheça a visão patrimonial, alocação de classes e motor de aportes."
              stepsCount={3}
              icon={TrendingUp}
              iconColorClass="text-portfolio"
              isCompleted={investmentsOverviewCompleted}
              isPrimary={true}
              onSelect={handleSelectTrack}
            />

            <div>
              <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">
                Micro-Tours Específicos
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <TourCardItem
                  id="investments_assets"
                  title="Cadastro de Ativos / Nova Operação"
                  description="Cadastre ativos, registre operações e controle saldo em caixa."
                  stepsCount={2}
                  icon={Briefcase}
                  iconColorClass="text-portfolio"
                  isCompleted={hasCompletedDemoTour("investments_assets")}
                  onSelect={handleSelectTrack}
                />
                <TourCardItem
                  id="investments_targets"
                  title="Metas por Classe e Ativo"
                  description="Percentuais ideais por classe e ativo para calibrar a exposição ao risco."
                  stepsCount={2}
                  icon={Target}
                  iconColorClass="text-positive-strong"
                  isCompleted={hasCompletedDemoTour("investments_targets")}
                  onSelect={handleSelectTrack}
                />
                <TourCardItem
                  id="investments_aporte"
                  title="Calculadora de Aporte Inteligente"
                  description="Motor matemático que calcula onde alocar cada centavo para rebalancear."
                  stepsCount={2}
                  icon={Calculator}
                  iconColorClass="text-primary"
                  isCompleted={hasCompletedDemoTour("investments_aporte")}
                  onSelect={handleSelectTrack}
                />
              </div>
            </div>
          </div>
        ),
      },
      {
        value: "settings",
        label: "Ajustes & Suporte",
        shortLabel: "Ajustes",
        icon: <Settings className="size-4 text-muted-foreground" aria-hidden="true" />,
        content: (
          <div className="space-y-4 pt-3 pb-1">
            <TourCardItem
              id="settings_support"
              title="Personalização, Privacidade e Suporte"
              description="Oculte saldos em público com o modo privacidade, alterne o tema visual e acesse o suporte imediato."
              stepsCount={2}
              icon={Settings}
              iconColorClass="text-muted-foreground"
              isCompleted={hasCompletedDemoTour("settings_support")}
              isPrimary={true}
              onSelect={handleSelectTrack}
            />
          </div>
        ),
      },
    ],
    [
      financesOverviewCompleted,
      investmentsOverviewCompleted,
      handleSelectTrack,
    ],
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Escolha sua Trilha de Demonstração"
      description="Explore os recursos do aplicativo com dados simulados em memória, sem alterar sua conta real."
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            className="w-full sm:w-auto text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Pular tour e ir para conta real
          </Button>
        </div>
      }
    >
      <div className="py-1">
        {/* Card de Boas-Vindas do APK Nativo em destaque caso isNativePlatform() retorne true */}
        {isNative && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => handleSelectTrack("app_native_apk")}
              className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-primary/40 bg-surface/80 hover:bg-surface-hover/80 hover:border-primary transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            >
              <div className="size-9 rounded-lg border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0 text-primary group-hover:scale-105 transition-transform shadow-2xs">
                <Smartphone className="size-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      Bem-vindo ao App Nativo Android
                    </h4>
                    <Badge variant="default" size="xs" className="shrink-0">
                      Exclusivo APK
                    </Badge>
                  </div>
                  {nativeCompleted ? (
                    <Badge variant="positive" size="xs" className="gap-1 shrink-0">
                      <Check className="size-3" aria-hidden="true" />
                      <span>Concluído</span>
                    </Badge>
                  ) : (
                    <Badge variant="muted" size="xs" className="shrink-0">
                      3 passos
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  Aceleração nativa, leitor de notificações bancárias em tempo real e escudo biométrico de privacidade.
                </p>
              </div>

              <ChevronRight
                className="size-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 self-center"
                aria-hidden="true"
              />
            </button>
          </div>
        )}

        {/* Abas do Hub de Aprendizado */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          variant="pills"
          forceMount={true}
          items={tabItems}
        />
      </div>
    </Modal>
  );
}
