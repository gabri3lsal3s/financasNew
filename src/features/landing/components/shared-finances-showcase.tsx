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
} from "lucide-react";
import { Badge, Button, Card, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface SharedFinancesShowcaseProps {
  className?: string;
}

type SharedTab = "split" | "goal" | "family";

export function SharedFinancesShowcase({ className }: SharedFinancesShowcaseProps) {
  const [activeTab, setActiveTab] = useState<SharedTab>("split");
  const [copiedPix, setCopiedPix] = useState(false);
  const [whatsAppShared, setWhatsAppShared] = useState(false);
  const [copiedGoalPix, setCopiedGoalPix] = useState(false);
  const [settledFamily, setSettledFamily] = useState(false);

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
        "border-border/80 bg-surface/90 shadow-xl p-4 sm:p-7 md:p-8 space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl",
        className,
      )}
    >
      {/* Navegação por Abas Fluidas com Scroll Desobstruído */}
      <div
        role="tablist"
        aria-label="Cards de Finanças Compartilhadas"
        className="flex p-1 rounded-xl bg-background/70 border border-border/60 gap-1 overflow-x-auto no-scrollbar scroll-smooth"
      >
        <button
          type="button"
          role="tab"
          id="tab-split"
          aria-selected={activeTab === "split"}
          aria-controls="panel-split"
          onClick={() => setActiveTab("split")}
          className={cn(
            "shrink-0 flex-initial min-w-fit px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
            activeTab === "split"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Racha com Pix</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-goal"
          aria-selected={activeTab === "goal"}
          aria-controls="panel-goal"
          onClick={() => setActiveTab("goal")}
          className={cn(
            "shrink-0 flex-initial min-w-fit px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
            activeTab === "goal"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          <Target className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Vaquinha Coletiva</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-family"
          aria-selected={activeTab === "family"}
          aria-controls="panel-family"
          onClick={() => setActiveTab("family")}
          className={cn(
            "shrink-0 flex-initial min-w-fit px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
            activeTab === "family"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          <Scale className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Orçamento Familiar</span>
        </button>
      </div>

      {/* 1. Card Visual: Racha de Despesas com cópia de Pix e botão de WhatsApp */}
      <div
        id="panel-split"
        role="tabpanel"
        aria-labelledby="tab-split"
        data-testid="card-racha"
        className={cn("space-y-4", activeTab === "split" ? "block" : "hidden")}
      >
        <div className="flex justify-between items-center border-b border-border/50 pb-3 sm:pb-3.5">
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Churrasco de Confraternização
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">
              Racha entre 4 amigos · Cota de <MoneyText cents={12000} className="font-semibold text-foreground" />
            </div>
          </div>
          <Badge variant="positive" size="xs" className="font-mono">
            2 de 3 pagaram
          </Badge>
        </div>

        {/* Resumo da Despesa em Centavos */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs font-mono">
          <div className="p-2.5 sm:p-3 rounded-xl bg-background/50 border border-border/50">
            <span className="text-muted-foreground block text-[11px] font-sans">Valor Total da Conta:</span>
            <MoneyText cents={48000} className="font-bold text-foreground text-sm sm:text-base" />
          </div>
          <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 border border-primary/30">
            <span className="text-primary-strong block text-[11px] font-sans font-semibold">Total a Receber:</span>
            <MoneyText cents={36000} className="font-bold text-foreground text-sm sm:text-base" />
          </div>
        </div>

        {/* Lista de Participantes */}
        <div className="space-y-2 text-xs">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Status dos Participantes
          </div>
          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between p-2 rounded-lg bg-background/40 border border-border/50">
              <span className="font-sans text-foreground">Você (Anfitrião)</span>
              <div className="flex items-center gap-2">
                <Badge variant="muted" size="xs">
                  Pago
                </Badge>
                <MoneyText cents={12000} className="font-semibold text-foreground" />
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-background/40 border border-border/50">
              <span className="font-sans text-foreground">Mariana Costa</span>
              <div className="flex items-center gap-2">
                <Badge variant="positive" size="xs">
                  Pix Enviado
                </Badge>
                <MoneyText cents={12000} className="font-semibold text-foreground" />
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-background/40 border border-border/50">
              <span className="font-sans text-foreground">Lucas Oliveira</span>
              <div className="flex items-center gap-2">
                <Badge variant="positive" size="xs">
                  Pix Enviado
                </Badge>
                <MoneyText cents={12000} className="font-semibold text-foreground" />
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-background/40 border border-border/50">
              <span className="font-sans text-foreground">Beatriz Souza</span>
              <div className="flex items-center gap-2">
                <Badge variant="warning" size="xs">
                  Aguardando
                </Badge>
                <MoneyText cents={12000} className="font-semibold text-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Box Pix Copia e Cola & Botão de WhatsApp */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-border/60 bg-background/60 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-sans">Chave Pix Dinâmica (E-mail):</span>
            <span className="font-mono font-semibold text-foreground">financeiro.demo@exemplo.com</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyPix}
              className="flex-1 justify-center gap-1.5"
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
              className="flex-1 justify-center gap-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white border-none"
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

      {/* 2. Card Visual: Termômetro de Vaquinha Coletiva em tempo real */}
      <div
        id="panel-goal"
        role="tabpanel"
        aria-labelledby="tab-goal"
        data-testid="card-vaquinha"
        className={cn("space-y-4", activeTab === "goal" ? "block" : "hidden")}
      >
        <div className="flex justify-between items-center border-b border-border/50 pb-3 sm:pb-3.5">
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Viagem de Fim de Ano em Família
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">
              Vaquinha Coletiva com Chave Pix Oficial
            </div>
          </div>
          <Badge variant="positive" size="xs" className="font-mono">
            75% Concluído
          </Badge>
        </div>

        {/* Termômetro e Barra de Progresso com Milestones */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-border/60 bg-background/60 space-y-3">
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
            <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden">
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

          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            <Calendar className="size-3.5 text-primary shrink-0" aria-hidden="true" />
            <span>
              Restam 14 dias para encerrar · Faltam <MoneyText cents={200000} className="font-semibold text-foreground" /> para a meta
            </span>
          </div>
        </div>

        {/* Mural de Apoiadores Recentes */}
        <div className="space-y-1.5 text-xs font-mono">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-sans">
            Últimas Contribuições via Pix
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-background/40 border border-border/50 text-center">
              <span className="font-sans text-[11px] text-muted-foreground block truncate">Você</span>
              <MoneyText cents={300000} className="font-bold text-foreground text-xs" />
            </div>
            <div className="p-2 rounded-lg bg-background/40 border border-border/50 text-center">
              <span className="font-sans text-[11px] text-muted-foreground block truncate">Mariana C.</span>
              <MoneyText cents={150000} className="font-bold text-foreground text-xs" />
            </div>
            <div className="p-2 rounded-lg bg-background/40 border border-border/50 text-center">
              <span className="font-sans text-[11px] text-muted-foreground block truncate">Lucas O.</span>
              <MoneyText cents={150000} className="font-bold text-foreground text-xs" />
            </div>
          </div>
        </div>

        {/* Ação de Apoio via Chave Pix */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyGoalPix}
            className="flex-1 justify-center gap-1.5"
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
            variant="ghost"
            size="sm"
            className="flex-1 justify-center gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
          >
            <Share2 className="size-3.5" aria-hidden="true" />
            <span>Página Pública de Arrecadação</span>
          </Button>
        </div>
      </div>

      {/* 3. Card Visual: Orçamento Familiar Seguro (divisão 50/50 e acerto sem atrito) */}
      <div
        id="panel-family"
        role="tabpanel"
        aria-labelledby="tab-family"
        data-testid="card-familia"
        className={cn("space-y-4", activeTab === "family" ? "block" : "hidden")}
      >
        <div className="flex justify-between items-center border-b border-border/50 pb-3 sm:pb-3.5">
          <div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              Gestão do Lar · Família Silva
            </div>
            <div className="text-[11px] sm:text-xs text-muted-foreground">
              Teto Compartilhado: <MoneyText cents={600000} className="font-semibold text-foreground" /> / mês
            </div>
          </div>
          <Badge variant="default" size="xs" className="font-mono">
            Divisão 50% / 50%
          </Badge>
        </div>

        {/* Barra Bicolor de Contribuição nos Gastos da Casa */}
        <div className="p-3.5 sm:p-4 rounded-xl border border-border/60 bg-background/60 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-foreground">Despesas Comuns do Mês:</span>
            <MoneyText cents={600000} className="font-mono font-bold text-foreground" />
          </div>

          <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted/40">
            <div className="h-full bg-primary" style={{ width: "53.3%" }} />
            <div className="h-full bg-portfolio" style={{ width: "46.7%" }} />
          </div>

          <div className="flex justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
              <span className="font-sans text-muted-foreground">Você pagou:</span>
              <MoneyText cents={320000} className="font-bold text-foreground" />
              <span className="text-[11px] text-muted-foreground">(53%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-portfolio shrink-0" aria-hidden="true" />
              <span className="font-sans text-muted-foreground">Camila pagou:</span>
              <MoneyText cents={280000} className="font-bold text-foreground" />
              <span className="text-[11px] text-muted-foreground">(47%)</span>
            </div>
          </div>
        </div>

        {/* Box de Compensação / Acerto sem Atrito */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-primary/30 bg-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ArrowRightLeft className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs">
              <div className="font-semibold text-foreground">Compensação Automática Calculada:</div>
              <div className="text-muted-foreground mt-0.5">
                Camila deve transferir <MoneyText cents={20000} className="font-bold text-foreground" /> para Você via Pix para equilibrar em 50/50.
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSettleFamily}
            className="shrink-0 self-stretch sm:self-auto gap-1.5"
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

        {/* Garantia de Privacidade Individual */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-background/50 text-[11px] sm:text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
          <span>
            Privacidade absoluta: compras individuais, presentes e faturas pessoais permanecem 100% invisíveis para os outros membros da família.
          </span>
        </div>
      </div>
    </Card>
  );
}
