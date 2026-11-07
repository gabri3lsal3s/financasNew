import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import {
  ShieldAlert,
  Target,
  TrendingUp,
  Wallet,
  Calendar,
  Clock,
  Check,
  Copy,
  QrCode,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  Share,
  Download,
  ExternalLink,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  buttonVariants,
  MoneyText,
  Progress,
  QrCodeCanvas,
  Skeleton,
  EmptyState,
} from "@/components/ui";
import { useSharedGoalTracker } from "@/state/queries/use-public-shares";
import { formatDateBR } from "@/lib/date";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { IosPwaInstallDialog } from "@/components/modules/ios-pwa-install-dialog";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import { SharedLinkHeaderNav } from "../components";

const PIX_KEY_TYPE_LABELS: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Celular",
  random: "Chave Aleatória (EVP)",
  auto: "Chave Pix",
  unknown: "Chave Pix",
};

export function GoalTrackerPublicPage() {
  const { token } = useParams<{ token: string }>();
  const { data: goalData, isLoading, isError, refetch, isRefetching } = useSharedGoalTracker(token);
  const { canInstall, isIOS, isInstalled, install } = usePWAInstall();

  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (goalData?.title) {
      document.title = `Termômetro: ${goalData.title} — Áxis Finance`;
    } else {
      document.title = "Termômetro de Meta Coletiva — Áxis Finance";
    }
  }, [goalData?.title]);

  const handlePwaAction = () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    void install();
  };

  const handleRefresh = async () => {
    triggerSensory("action");
    await refetch();
    pushToast({
      title: "Termômetro atualizado",
      description: "Os dados de arrecadação da meta foram sincronizados.",
      variant: "default",
    });
  };

  const handleCopyPix = async () => {
    if (!goalData) return;
    const pixToCopy = goalData.pix_br_code?.trim() || goalData.pix_key?.trim();
    if (!pixToCopy) return;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixToCopy);
      }
      setCopiedPix(true);
      triggerSensory("action");
      pushToast({
        title: "Pix do organizador copiado!",
        description: "Abra o aplicativo do seu banco para colar e transferir.",
        variant: "success",
      });
      setTimeout(() => setCopiedPix(false), 3000);
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível copiar o Pix",
        description: "Copie a chave Pix manualmente exibida na tela.",
        variant: "destructive",
      });
    }
  };

  const handleCopyKey = async () => {
    if (!goalData?.pix_key) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(goalData.pix_key.trim());
      }
      setCopiedKey(true);
      triggerSensory("action");
      pushToast({
        title: "Chave Pix copiada!",
        description: "Chave do organizador transferida para a área de transferência.",
        variant: "default",
      });
      setTimeout(() => setCopiedKey(false), 3000);
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível copiar a chave",
        variant: "destructive",
      });
    }
  };

  // 1. Estado de Carregamento (Skeleton)
  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          <header className="flex items-center justify-between pb-4 border-b border-border/80">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </header>
          <div className="space-y-4">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
            <Skeleton className="h-44 w-full rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  // 2. Estado de Erro ou Link Revogado/Inexistente
  if (isError || !goalData || goalData.is_revoked) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="flex justify-center">
            <BrandLogo />
          </div>
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6">
            <EmptyState
              icon={<ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />}
              title="Meta não encontrada ou expirada"
              description="Este termômetro público de arrecadação foi revogado pelo organizador ou já expirou. Solicite um novo link atualizado ao organizador da meta."
              action={
                <Link
                  to="/apresentacao"
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "rounded-xl cursor-pointer",
                  )}
                >
                  Conhecer o Áxis Finance
                </Link>
              }
            />
          </Card>
        </div>
      </main>
    );
  }

  // 3. Cálculos de progresso e resolução de status
  const isArchived = goalData.status === "archived";
  const isCompleted = goalData.status === "completed" || goalData.percentage >= 100;
  const progressTone = isCompleted ? "positive" : "portfolio";
  const hasDeadline = Boolean(goalData.deadline);

  const statusBadge = isArchived ? (
    <Badge variant="muted" size="xs" className="gap-1">
      <CheckCircle2 className="size-3 text-muted-foreground" aria-hidden="true" />
      <span>Arrecadação Concluída</span>
    </Badge>
  ) : isCompleted ? (
    <Badge variant="positive" size="xs" className="gap-1">
      <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
      <span>Meta Atingida ({goalData.percentage}%)</span>
    </Badge>
  ) : (
    <Badge variant="portfolio" size="xs" className="gap-1">
      <Target className="size-3 text-portfolio" aria-hidden="true" />
      <span>Em Arrecadação ({goalData.percentage}%)</span>
    </Badge>
  );

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Topo / Barra de Navegação Pública Unificada */}
        <div className="space-y-3">
          <SharedLinkHeaderNav
            badgeLabel="Termômetro de Meta"
            targetPath={`meta/${token || ""}`}
          />
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="gap-1.5 border-border/80 bg-surface hover:bg-surface-hover rounded-lg cursor-pointer text-xs h-7"
              aria-label="Atualizar dados do termômetro"
            >
              <RefreshCw
                className={cn("size-3 text-muted-foreground", isRefetching && "animate-spin")}
                aria-hidden="true"
              />
              <span>Atualizar dados</span>
            </Button>
          </div>
        </div>

        {/* Hero Card: Termômetro Visual de Progresso Dinâmico */}
        <Card className="border-border/80 bg-surface shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {goalData.title}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Organizado por {goalData.organizer_name} &middot; {goalData.organizer_city}
                </p>
              </div>
              <div>{statusBadge}</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {/* Termômetro de Progresso */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Progresso da Arrecadação</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {goalData.percentage}% concluído
                </span>
              </div>
              <Progress
                value={goalData.percentage}
                tone={progressTone}
                size="lg"
                aria-label={`Progresso da meta: ${goalData.percentage}%`}
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1">
                  <span>Arrecadado:</span>
                  <MoneyText cents={goalData.current_cents} variant="caption" tone="positive" />
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <span>Alvo:</span>
                  <MoneyText cents={goalData.target_cents} variant="caption" tone="default" />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid Responsivo de KPIs (Meta Total, Total Arrecadado, Falta Arrecadar) */}
        <section aria-label="Indicadores da Meta Coletiva">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* KPI 1: Alvo Total */}
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Meta Total</span>
                  <Target className="size-4 text-muted-foreground" aria-hidden="true" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                  <MoneyText cents={goalData.target_cents} variant="hero" tone="default" />
                </div>
                <p className="text-[11px] text-muted-foreground">Objetivo financeiro total</p>
              </CardContent>
            </Card>

            {/* KPI 2: Total Arrecadado */}
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Total Arrecadado</span>
                  <TrendingUp className="size-4 text-positive-strong" aria-hidden="true" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                  <MoneyText cents={goalData.current_cents} variant="hero" tone="positive" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {goalData.percentage}% do valor acumulado
                </p>
              </CardContent>
            </Card>

            {/* KPI 3: Falta Arrecadar */}
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardHeader className="pb-1.5">
                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>{isCompleted ? "Saldo Restante" : "Falta Arrecadar"}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="size-4 text-positive-strong" aria-hidden="true" />
                  ) : (
                    <Wallet className="size-4 text-portfolio" aria-hidden="true" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="tabular-nums font-bold text-foreground text-xl sm:text-2xl tracking-tight whitespace-nowrap">
                  <MoneyText
                    cents={goalData.remaining_cents}
                    variant="hero"
                    tone={isCompleted ? "positive" : "portfolio"}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isCompleted ? "Meta 100% financiada" : "Restante para completar o alvo"}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Card de Prazo Alvo e Contagem Regressiva de Dias (se houver prazo) */}
        {hasDeadline && goalData.deadline && (
          <section aria-label="Prazo e contagem regressiva">
            <Card className="border-border/80 bg-surface shadow-xs">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-foreground">
                    <Calendar className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-foreground block">
                      Data Alvo: {formatDateBR(goalData.deadline)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Prazo limite estipulado pelo organizador para o encerramento da arrecadação
                    </p>
                  </div>
                </div>
                <div>
                  {goalData.days_remaining !== null && (
                    <>
                      {goalData.days_remaining > 1 && (
                        <Badge variant="muted" size="sm" className="font-semibold text-xs gap-1.5">
                          <Clock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                          <span>{goalData.days_remaining} dias restantes</span>
                        </Badge>
                      )}
                      {goalData.days_remaining === 1 && (
                        <Badge variant="warning" size="sm" className="font-semibold text-xs gap-1.5">
                          <Clock className="size-3.5 text-warning-strong" aria-hidden="true" />
                          <span>1 dia restante (último dia)</span>
                        </Badge>
                      )}
                      {goalData.days_remaining === 0 && (
                        <Badge variant="warning" size="sm" className="font-semibold text-xs gap-1.5">
                          <Clock className="size-3.5 text-warning-strong" aria-hidden="true" />
                          <span>Hoje é o dia alvo da meta</span>
                        </Badge>
                      )}
                      {goalData.days_remaining < 0 && (
                        <Badge variant="critical" size="sm" className="font-semibold text-xs gap-1.5">
                          <Clock className="size-3.5 text-critical-strong" aria-hidden="true" />
                          <span>Prazo encerrado</span>
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Card de Contribuição Pix ou Aviso de Encerramento */}
        {isArchived ? (
          <Card className="border-border/80 bg-surface shadow-xs text-center p-6 sm:p-8 space-y-3">
            <div className="flex justify-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-positive/10 text-positive-strong">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-foreground">Campanha Concluída com Sucesso!</h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              A arrecadação para esta meta foi encerrada pelo organizador. Agradecemos a todos os participantes que contribuíram!
            </p>
          </Card>
        ) : (
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-border/80">
              <CardTitle className="text-base flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <span>Contribua com a Meta via Pix</span>
                <Badge variant="muted" size="xs">
                  {PIX_KEY_TYPE_LABELS[goalData.pix_key_type] ?? "Chave Pix"}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Envie qualquer quantia diretamente para o organizador para somar ao progresso da meta
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Botão de Um Toque: [Copiar Pix do Organizador] */}
              <Button
                type="button"
                variant="default"
                size="lg"
                onClick={handleCopyPix}
                className="w-full rounded-xl font-semibold cursor-pointer gap-2"
                aria-label="Copiar Pix do Organizador"
              >
                {copiedPix ? (
                  <>
                    <Check className="size-4 text-positive-strong" aria-hidden="true" />
                    <span>Pix Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-4" aria-hidden="true" />
                    <span>Copiar Pix do Organizador</span>
                  </>
                )}
              </Button>

              {/* Caixa com detalhes da Chave Pix */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground font-medium">Chave Pix:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-foreground select-all break-all text-right">
                      {goalData.pix_key}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyKey}
                      className="size-7 p-0 cursor-pointer shrink-0 text-muted-foreground hover:text-foreground"
                      title="Copiar apenas a chave"
                      aria-label="Copiar apenas a chave Pix"
                    >
                      {copiedKey ? (
                        <Check className="size-3 text-positive-strong" aria-hidden="true" />
                      ) : (
                        <Copy className="size-3" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="text-muted-foreground">Favorecido:</span>
                  <span className="font-semibold text-foreground text-right">
                    {goalData.organizer_name}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="text-muted-foreground">Cidade:</span>
                  <span className="text-foreground text-right">{goalData.organizer_city}</span>
                </div>
              </div>

              {/* Alternar QR Code Pix para visualização no computador */}
              <div className="space-y-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    triggerSensory("action");
                    setShowQrCode((prev) => !prev);
                  }}
                  className="w-full gap-2 border-border/80 bg-surface hover:bg-surface-hover rounded-xl cursor-pointer text-xs"
                >
                  <QrCode className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>{showQrCode ? "Ocultar QR Code Pix" : "Exibir QR Code Pix"}</span>
                </Button>

                {showQrCode && (
                  <div className="flex flex-col items-center justify-center p-4 bg-muted/20 rounded-xl border border-border/80 space-y-2.5">
                    <QrCodeCanvas
                      text={goalData.pix_br_code?.trim() || goalData.pix_key?.trim()}
                      size={180}
                    />
                    <p className="text-[11px] text-muted-foreground text-center max-w-xs">
                      Abra o aplicativo do seu banco no celular e escaneie o código QR acima para transferir.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Depósitos Registrados (Transparência Coletiva) */}
        {goalData.show_contributions_publicly !== false &&
          goalData.contributions &&
          goalData.contributions.length > 0 && (
          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="pb-3 border-b border-border/80">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span>Depósitos Registrados na Vaquinha</span>
                <Badge variant="muted" size="xs">
                  {goalData.contributions.length} recebimento{goalData.contributions.length > 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 divide-y divide-border/40 text-xs">
              {goalData.contributions.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {c.contributor_name || "Participante Anônimo"}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{c.date}</span>
                  </div>
                  <MoneyText cents={c.amount_cents} tone="positive" className="font-semibold tabular-nums shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Nota de Atualização Dinâmica */}
        <div className="rounded-xl border border-border/80 bg-surface p-4 text-xs text-muted-foreground leading-relaxed flex items-start gap-3">
          <RefreshCw className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Conforme o organizador cadastra os depósitos na meta pelo app, o termômetro atualiza sozinho na web para todos os participantes acompanharem em tempo real.
          </p>
        </div>

        {/* Atalho PWA / Fixar na Tela Inicial */}
        {(canInstall || isIOS || !isInstalled) && (
          <section aria-label="Fixar atalho na tela inicial">
            <div className="rounded-2xl border border-border/80 bg-surface shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-foreground">
                  <Smartphone className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-foreground block">
                    Acompanhar Meta no Celular
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Adicione este termômetro à tela inicial para checar o avanço da arrecadação a qualquer momento com 1 toque.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePwaAction}
                className="gap-2 shrink-0 border-border/80 bg-surface hover:bg-surface-hover cursor-pointer rounded-xl font-semibold text-xs"
              >
                {isIOS ? (
                  <>
                    <Share className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Como fixar no iPhone</span>
                  </>
                ) : (
                  <>
                    <Download className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Adicionar à Tela Inicial</span>
                  </>
                )}
              </Button>
            </div>
          </section>
        )}

        {/* Banner de Conversão Viral (Plano 06) */}
        <section aria-label="Experimentar Áxis Finance">
          <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-primary/10 via-surface to-surface shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary-strong">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Crie Vaquinhas & Metas Financeiras Coletivas
                  </span>
                  <Badge variant="muted" size="xs">
                    30 Dias Grátis
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Organize arrecadações com amigos, casamento, viagens ou projetos pessoais com link público e Pix integrado.
                </p>
              </div>
            </div>
            <Link
              to="/cadastrar?ref=meta"
              className={cn(
                buttonVariants({ size: "sm" }),
                "gap-1.5 shrink-0 font-semibold text-xs cursor-pointer rounded-xl",
              )}
            >
              <span>Criar Minha Meta Grátis</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Modal de Instruções iOS Safari */}
        <IosPwaInstallDialog open={showIosGuide} onOpenChange={setShowIosGuide} />
      </div>

      {/* Rodapé Informativo e Branding */}
      <footer className="max-w-3xl mx-auto w-full pt-8 pb-4 text-center space-y-2 border-t border-border/60 mt-8 text-xs text-muted-foreground">
        <p className="leading-relaxed">
          Termômetro público de transparência financeira via Áxis Finance.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <span>Áxis Finance</span>
          <span>&middot;</span>
          <Link
            to="/apresentacao"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>Conheça a plataforma</span>
            <ExternalLink className="size-2.5" aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </main>
  );
}
