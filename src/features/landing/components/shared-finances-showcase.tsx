import { useState } from "react";
import {
  Users,
  Target,
  Scale,
  Copy,
  CheckCircle2,
  Calendar,
  ArrowRightLeft,
  ShieldCheck,
  Share2,
  Check,
  MessageCircle,
  Plane,
} from "lucide-react";
import { Badge, Button, Card, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface SharedFinancesShowcaseProps {
  className?: string;
}

type SharedTab = "split" | "goal" | "family" | "trip";

export function SharedFinancesShowcase({ className }: SharedFinancesShowcaseProps) {
  const [activeTab, setActiveTab] = useState<SharedTab>("split");
  const [copiedPix, setCopiedPix] = useState(false);
  const [whatsAppShared, setWhatsAppShared] = useState(false);
  const [copiedGoalPix, setCopiedGoalPix] = useState(false);
  const [settledFamily, setSettledFamily] = useState(false);
  const [copiedTripPix, setCopiedTripPix] = useState(false);
  const [settledTrip, setSettledTrip] = useState(false);

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard?.writeText?.(
        "00020126360014BR.GOV.BCB.PIX0114demo@exemplo.com5204000053039865406120.005802BR5904Voce6009Sao Paulo62070503***6304ABCD",
      );
    } catch {
      // Ignora falhas de clipboard em ambientes sem permissão
    }
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleShareWhatsApp = () => {
    setWhatsAppShared(true);
    setTimeout(() => setWhatsAppShared(false), 2500);
  };

  const handleCopyGoalPix = async () => {
    try {
      await navigator.clipboard?.writeText?.("viagem.familia@exemplo.com");
    } catch {
      // Ignora falhas de clipboard
    }
    setCopiedGoalPix(true);
    setTimeout(() => setCopiedGoalPix(false), 2500);
  };

  const handleSettleFamily = () => {
    setSettledFamily(true);
    setTimeout(() => setSettledFamily(false), 3000);
  };

  return (
    <Card
      className={cn(
        "border-border/80 bg-surface/90 shadow-xl p-4 sm:p-6 md:p-7 space-y-4 sm:space-y-4.5 rounded-2xl sm:rounded-3xl",
        className,
      )}
    >
      {/* Navegação por Abas — Distribuição Fluida Proporcional (Zero Truncamento) */}
      <div
        role="tablist"
        aria-label="Cards de Finanças Compartilhadas"
        className="flex items-center p-1 rounded-xl bg-muted/50 border border-border/60 gap-1 w-full overflow-x-auto no-scrollbar scroll-smooth"
      >
        <button
          type="button"
          role="tab"
          id="tab-split"
          aria-selected={activeTab === "split"}
          aria-controls="panel-split"
          title="Racha com Pix"
          aria-label="Racha com Pix"
          onClick={() => setActiveTab("split")}
          className={cn(
            "flex-auto shrink-0 min-w-fit px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap font-medium",
            activeTab === "split"
              ? "bg-surface text-foreground shadow-xs border border-border/70 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
          )}
        >
          <Users className={cn("size-3.5 shrink-0", activeTab === "split" ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
          <span>Racha</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-goal"
          aria-selected={activeTab === "goal"}
          aria-controls="panel-goal"
          title="Vaquinha Coletiva (Metas)"
          aria-label="Vaquinha Coletiva (Metas)"
          onClick={() => setActiveTab("goal")}
          className={cn(
            "flex-auto shrink-0 min-w-fit px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap font-medium",
            activeTab === "goal"
              ? "bg-surface text-foreground shadow-xs border border-border/70 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
          )}
        >
          <Target className={cn("size-3.5 shrink-0", activeTab === "goal" ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
          <span>Metas</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-family"
          aria-selected={activeTab === "family"}
          aria-controls="panel-family"
          title="Modo Família (Orçamento Familiar)"
          aria-label="Orçamento Familiar — Modo Família"
          onClick={() => setActiveTab("family")}
          className={cn(
            "flex-auto shrink-0 min-w-fit px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap font-medium",
            activeTab === "family"
              ? "bg-surface text-foreground shadow-xs border border-border/70 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
          )}
        >
          <Scale className={cn("size-3.5 shrink-0", activeTab === "family" ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
          <span>
            <span className="hidden sm:inline">Modo </span>Família
          </span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-trip"
          aria-selected={activeTab === "trip"}
          aria-controls="panel-trip"
          title="Modo Viagem"
          aria-label="Modo Viagem"
          onClick={() => setActiveTab("trip")}
          className={cn(
            "flex-auto shrink-0 min-w-fit px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap font-medium",
            activeTab === "trip"
              ? "bg-surface text-foreground shadow-xs border border-border/70 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
          )}
        >
          <Plane className={cn("size-3.5 shrink-0", activeTab === "trip" ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
          <span>
            <span className="hidden sm:inline">Modo </span>Viagem
          </span>
        </button>
      </div>

      {/* 1. Card Visual: Racha de Despesas com cópia de Pix e botão de WhatsApp */}
      <div
        id="panel-split"
        role="tabpanel"
        aria-labelledby="tab-split"
        data-testid="card-racha"
        className={cn("space-y-3 sm:space-y-3.5", activeTab === "split" ? "block" : "hidden")}
      >
        {/* Cabeçalho Editorial Padronizado */}
        <div className="flex justify-between items-center border-b border-border/50 pb-2.5 sm:pb-3">
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Churrasco de Confraternização
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              Racha entre 4 amigos · Cota de <MoneyText cents={12000} className="font-semibold text-foreground" />
            </div>
          </div>
          <Badge variant="positive" size="xs" className="font-mono shrink-0">
            2 de 3 pagaram
          </Badge>
        </div>

        {/* Resumo Financeiro em Duas Colunas Simétricas */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs font-mono">
          <div className="p-2.5 sm:p-3 rounded-xl bg-background/50 border border-border/60">
            <span className="text-muted-foreground block text-[11px] font-sans">Valor Total da Conta:</span>
            <MoneyText cents={48000} className="font-bold text-foreground text-sm sm:text-base" />
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 border border-primary/30">
            <div className="flex justify-between items-baseline">
              <span className="text-primary-strong font-sans font-semibold text-[11px]">Total a Receber:</span>
              <span className="text-[10px] text-positive-strong font-semibold">67% pago</span>
            </div>
            <MoneyText cents={36000} className="font-bold text-primary-strong text-sm sm:text-base" />
          </div>
        </div>

        {/* Lista de Participantes com Avatares e Hierarquia Harmônica */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
            <span>Status dos Participantes</span>
            <span className="font-mono font-normal">4 pessoas</span>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 divide-y divide-border/40 overflow-hidden text-xs">
            {/* Você (Anfitrião) */}
            <div className="flex items-center justify-between p-2.5 transition-colors hover:bg-muted/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-bold font-mono">
                  VC
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground truncate block">Você (Anfitrião)</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Pagou o total da conta</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <Badge variant="muted" size="xs">
                  Pago
                </Badge>
                <MoneyText cents={12000} className="font-bold text-foreground text-xs" />
              </div>
            </div>

            {/* Mariana Costa */}
            <div className="flex items-center justify-between p-2.5 transition-colors hover:bg-muted/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-positive/15 text-positive-strong text-[11px] font-bold font-mono">
                  MC
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground truncate block">Mariana Costa</span>
                  <span className="text-[10px] text-positive-strong block truncate">Pix enviado às 14:28</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <Badge variant="positive" size="xs">
                  Pix Enviado
                </Badge>
                <MoneyText cents={12000} className="font-bold text-foreground text-xs" />
              </div>
            </div>

            {/* Lucas Oliveira */}
            <div className="flex items-center justify-between p-2.5 transition-colors hover:bg-muted/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-positive/15 text-positive-strong text-[11px] font-bold font-mono">
                  LO
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground truncate block">Lucas Oliveira</span>
                  <span className="text-[10px] text-positive-strong block truncate">Pix enviado às 15:02</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <Badge variant="positive" size="xs">
                  Pix Enviado
                </Badge>
                <MoneyText cents={12000} className="font-bold text-foreground text-xs" />
              </div>
            </div>

            {/* Beatriz Souza */}
            <div className="flex items-center justify-between p-2.5 transition-colors hover:bg-muted/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning-strong text-[11px] font-bold font-mono">
                  BS
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-foreground truncate block">Beatriz Souza</span>
                  <span className="text-[10px] text-muted-foreground block truncate">Lembrete pendente</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono">
                <Badge variant="warning" size="xs">
                  Aguardando
                </Badge>
                <MoneyText cents={12000} className="font-bold text-foreground text-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Box Pix Dinâmico e Ações Alinhadas ao Design System */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-background/60 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary shrink-0" aria-hidden="true" />
              <span>Chave Pix Dinâmica (E-mail):</span>
            </div>
            <span className="font-mono font-semibold text-foreground text-xs">financeiro.demo@exemplo.com</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyPix}
              className="w-full justify-center gap-1.5 h-8.5 text-xs font-semibold rounded-lg"
            >
              {copiedPix ? (
                <>
                  <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                  <span>Pix Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden="true" />
                  <span>Copiar Pix</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleShareWhatsApp}
              className="w-full justify-center gap-1.5 h-8.5 text-xs font-semibold rounded-lg shadow-xs"
            >
              {whatsAppShared ? (
                <>
                  <Check className="size-3.5" aria-hidden="true" />
                  <span>Lembrete Enviado</span>
                </>
              ) : (
                <>
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  <span>Cobrar no WhatsApp</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Card Visual: Termômetro de Vaquinha Coletiva (Metas) */}
      <div
        id="panel-goal"
        role="tabpanel"
        aria-labelledby="tab-goal"
        data-testid="card-vaquinha"
        className={cn("space-y-3 sm:space-y-3.5", activeTab === "goal" ? "block" : "hidden")}
      >
        <div className="flex justify-between items-center border-b border-border/50 pb-2.5 sm:pb-3">
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Viagem de Fim de Ano em Família
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              Vaquinha Coletiva com Chave Pix Oficial
            </div>
          </div>
          <Badge variant="positive" size="xs" className="font-mono shrink-0">
            75% Concluído
          </Badge>
        </div>

        {/* Termômetro e Barra de Progresso com Milestones */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-background/60 space-y-2.5">
          <div className="flex justify-between items-baseline font-mono">
            <div>
              <span className="text-[11px] font-sans text-muted-foreground block">Total Arrecadado:</span>
              <MoneyText cents={600000} className="text-xl sm:text-2xl font-bold text-foreground" />
            </div>
            <div className="text-right">
              <span className="text-[11px] font-sans text-muted-foreground block">Meta Final:</span>
              <MoneyText cents={800000} className="text-sm sm:text-base font-semibold text-muted-foreground" />
            </div>
          </div>

          {/* Barra Visual do Termômetro */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-positive-strong transition-all duration-700"
                style={{ width: "75%" }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span className="font-bold text-positive-strong">75% Atual</span>
              <span>100% Meta</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-0.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5 text-primary shrink-0" aria-hidden="true" />
            <span>
              Restam 14 dias para encerrar · Faltam <MoneyText cents={200000} className="font-semibold text-foreground" /> para a meta
            </span>
          </div>
        </div>

        {/* Mural de Apoiadores Recentes com Avatares em 3 Colunas */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
            Últimas Contribuições via Pix
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 p-2 rounded-lg bg-background/40 border border-border/50 min-w-0">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold font-mono">
                VC
              </div>
              <div className="min-w-0 truncate">
                <span className="text-[10px] text-muted-foreground block truncate">Você</span>
                <MoneyText cents={300000} className="font-bold text-foreground text-xs font-mono" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 p-2 rounded-lg bg-background/40 border border-border/50 min-w-0">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-positive/15 text-positive-strong text-[10px] font-bold font-mono">
                MC
              </div>
              <div className="min-w-0 truncate">
                <span className="text-[10px] text-muted-foreground block truncate">Mariana C.</span>
                <MoneyText cents={150000} className="font-bold text-foreground text-xs font-mono" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 p-2 rounded-lg bg-background/40 border border-border/50 min-w-0">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-positive/15 text-positive-strong text-[10px] font-bold font-mono">
                LO
              </div>
              <div className="min-w-0 truncate">
                <span className="text-[10px] text-muted-foreground block truncate">Lucas O.</span>
                <MoneyText cents={150000} className="font-bold text-foreground text-xs font-mono" />
              </div>
            </div>
          </div>
        </div>

        {/* Ação de Apoio via Chave Pix */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyGoalPix}
            className="w-full justify-center gap-1.5 h-8.5 text-xs font-semibold rounded-lg"
          >
            {copiedGoalPix ? (
              <>
                <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Chave Pix Copiada</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                <span>Copiar Chave Pix</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            className="w-full justify-center gap-1.5 h-8.5 text-xs font-semibold rounded-lg shadow-xs"
          >
            <Share2 className="size-3.5" aria-hidden="true" />
            <span className="truncate">Página Pública</span>
          </Button>
        </div>
      </div>

      {/* 3. Card Visual: Orçamento Familiar Seguro (Orçamentos) */}
      <div
        id="panel-family"
        role="tabpanel"
        aria-labelledby="tab-family"
        data-testid="card-familia"
        className={cn("space-y-3 sm:space-y-3.5", activeTab === "family" ? "block" : "hidden")}
      >
        <div className="flex justify-between items-center border-b border-border/50 pb-2.5 sm:pb-3">
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Gestão do Lar · Família Silva
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              Teto Compartilhado: <MoneyText cents={600000} className="font-semibold text-foreground" /> / mês
            </div>
          </div>
          <Badge variant="default" size="xs" className="font-mono shrink-0">
            Divisão 50% / 50%
          </Badge>
        </div>

        {/* Barra Bicolor de Contribuição nos Gastos da Casa com Avatares */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-background/60 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-foreground">Despesas Comuns do Mês:</span>
            <MoneyText cents={600000} className="font-mono font-bold text-foreground" />
          </div>

          <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-muted/60">
            <div className="h-full bg-primary" style={{ width: "53.3%" }} />
            <div className="h-full bg-portfolio" style={{ width: "46.7%" }} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                VC
              </div>
              <div className="min-w-0 truncate">
                <span className="font-sans text-muted-foreground block text-[11px] truncate">Você pagou:</span>
                <span className="font-bold text-foreground text-xs"><MoneyText cents={320000} /></span>{" "}
                <span className="text-[10px] text-muted-foreground">(53%)</span>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0 justify-end sm:justify-start">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-portfolio/20 text-portfolio text-[10px] font-bold">
                CS
              </div>
              <div className="min-w-0 truncate">
                <span className="font-sans text-muted-foreground block text-[11px] truncate">Camila pagou:</span>
                <span className="font-bold text-foreground text-xs"><MoneyText cents={280000} /></span>{" "}
                <span className="text-[10px] text-muted-foreground">(47%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Box de Compensação / Acerto sem Atrito com Layout Responsivo Desobstruído */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-primary/30 bg-primary/10 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <ArrowRightLeft className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              <div className="font-semibold text-foreground">Compensação Automática Calculada:</div>
              <div className="text-muted-foreground mt-0.5">
                Camila deve transferir <MoneyText cents={20000} className="font-bold text-foreground" /> para Você via Pix para equilibrar em 50/50.
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-0.5">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSettleFamily}
              className="w-full sm:w-auto justify-center gap-1.5 h-8.5 text-xs font-semibold rounded-lg shadow-xs"
            >
              {settledFamily ? (
                <>
                  <Check className="size-3.5" aria-hidden="true" />
                  <span>Acerto Quitado</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>Liquidar Acerto Pix</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Garantia de Privacidade Individual */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-background/50 text-[11px] sm:text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <span className="leading-relaxed">
            Privacidade absoluta: compras individuais, presentes e faturas pessoais permanecem 100% invisíveis para os outros membros da família.
          </span>
        </div>
      </div>

      {/* 4. Card Visual: Modo Viagem (Viagem) com multi-pagadores e algoritmo de compensação mínima */}
      <div
        id="panel-trip"
        role="tabpanel"
        aria-labelledby="tab-trip"
        data-testid="card-viagem"
        className={cn("space-y-3 sm:space-y-3.5", activeTab === "trip" ? "block" : "hidden")}
      >
        <div className="flex justify-between items-center border-b border-border/50 pb-2.5 sm:pb-3">
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Viagem Florianópolis / Réveillon
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              4 amigos · Livro-razão compartilhado · Link público com senha
            </div>
          </div>
          <Badge variant="warning" size="xs" className="font-mono shrink-0">
            4 despesas · 2 acertos
          </Badge>
        </div>

        {/* Resumo de Gastos Totais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 text-xs font-mono">
          <div className="p-2.5 sm:p-3 rounded-xl bg-background/50 border border-border/50">
            <span className="text-muted-foreground block text-[11px] font-sans">Total da Viagem:</span>
            <MoneyText cents={524000} className="font-bold text-foreground text-sm sm:text-base" />
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-positive/10 border border-positive/30">
            <span className="text-positive-strong block text-[11px] font-sans font-semibold">Você Pagou:</span>
            <MoneyText cents={368000} className="font-bold text-positive-strong text-sm sm:text-base" />
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 border border-primary/30 col-span-2 sm:col-span-1">
            <span className="text-primary-strong block text-[11px] font-sans font-semibold">Seu Saldo Líquido:</span>
            <span className="font-bold text-primary-strong text-sm sm:text-base">+R$ 2.370,00</span>
          </div>
        </div>

        {/* Balanço dos Participantes com Avatares */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-background/40 space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
            Balanço Individual em Tempo Real
          </div>

          <div className="space-y-1 text-xs divide-y divide-border/30">
            <div className="flex justify-between items-center py-1">
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold font-mono">
                  VC
                </div>
                <span className="font-medium text-foreground">Você (Anfitrião)</span>
              </div>
              <div className="text-right">
                <span className="text-positive-strong font-mono font-bold">+R$ 2.370,00</span>
                <span className="text-[10px] text-muted-foreground block">a receber</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-1">
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-negative/20 text-negative-strong text-[10px] font-bold font-mono">
                  LS
                </div>
                <span className="font-medium text-foreground">Lucas Silva</span>
              </div>
              <div className="text-right">
                <span className="text-negative-strong font-mono font-bold">-R$ 350,00</span>
                <span className="text-[10px] text-muted-foreground block">a pagar</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-1">
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-negative/20 text-negative-strong text-[10px] font-bold font-mono">
                  MC
                </div>
                <span className="font-medium text-foreground">Mariana Costa</span>
              </div>
              <div className="text-right">
                <span className="text-negative-strong font-mono font-bold">-R$ 710,00</span>
                <span className="text-[10px] text-muted-foreground block">a pagar</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-1">
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-negative/20 text-negative-strong text-[10px] font-bold font-mono">
                  PA
                </div>
                <span className="font-medium text-foreground">Pedro Alves</span>
              </div>
              <div className="text-right">
                <span className="text-negative-strong font-mono font-bold">-R$ 1.310,00</span>
                <span className="text-[10px] text-muted-foreground block">a pagar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Liquidação Otimizada com Pix: Layout Vertical Desobstruído com Botões em 2 Colunas */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-warning/30 bg-warning/10 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <ArrowRightLeft className="size-4 text-warning-strong shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              <div className="font-semibold text-foreground">Liquidação Otimizada (2 transferências em vez de 6):</div>
              <div className="text-muted-foreground mt-0.5">
                Pedro transfere <MoneyText cents={131000} className="font-bold text-foreground" /> e Mariana transfere <MoneyText cents={71000} className="font-bold text-foreground" /> direto via Pix.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText?.("voce@email.com");
                } catch {
                  // Fallback
                }
                setCopiedTripPix(true);
                setTimeout(() => setCopiedTripPix(false), 2500);
              }}
              className="w-full justify-center gap-1.5 text-xs h-8.5 font-semibold rounded-lg"
            >
              {copiedTripPix ? (
                <>
                  <Check className="size-3.5 text-positive-strong" aria-hidden="true" />
                  <span>Pix Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden="true" />
                  <span>Copiar Chave Pix</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                setSettledTrip(true);
                setTimeout(() => setSettledTrip(false), 3000);
              }}
              className="w-full justify-center gap-1.5 text-xs h-8.5 font-semibold rounded-lg shadow-xs"
            >
              {settledTrip ? (
                <>
                  <Check className="size-3.5" aria-hidden="true" />
                  <span>Confirmado</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>Confirmar Recebimento</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Link Público para Amigos Sem Conta */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-background/50 text-[11px] sm:text-xs text-muted-foreground">
          <Share2 className="size-4 text-primary shrink-0" aria-hidden="true" />
          <span className="leading-relaxed">
            Zero atrito: compartilhe o link seguro da viagem. Seus amigos lançam gastos e conferem o acerto pelo navegador, sem necessidade de baixar o app ou criar conta.
          </span>
        </div>
      </div>
    </Card>
  );
}
