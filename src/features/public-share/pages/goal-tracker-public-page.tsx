import { useEffect } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowRight,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/layout";
import {
  Badge,
  Button,
  EmptyState,
  Skeleton,
  buttonVariants,
} from "@/components/ui";
import { useSharedGoalTracker } from "@/state/queries/use-public-shares";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import { sanitizeShareToken } from "@/domain/share/token";
import { PublicPwaShortcutCard, SharedLinkHeaderNav } from "../components";
import { GoalThermometerHeroCard } from "../components/goal-thermometer-hero-card";
import { GoalPixContributionSidebar } from "../components/goal-pix-contribution-sidebar";

export function GoalTrackerPublicPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = sanitizeShareToken(rawToken);
  const { data: goalData, isLoading, isError, refetch, isRefetching } =
    useSharedGoalTracker(token);

  useEffect(() => {
    if (goalData?.title) {
      document.title = `Termômetro: ${goalData.title} — Axir`;
    } else {
      document.title = "Termômetro de Meta Coletiva — Axir";
    }
  }, [goalData?.title]);

  const handleRefresh = async () => {
    await refetch();
    pushToast({
      title: "Termômetro atualizado",
      description: "Os dados de arrecadação da meta foram sincronizados.",
      variant: "default",
    });
  };

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

  if (isError || !goalData || goalData.is_revoked) {
    return (
      <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="flex justify-center">
            <BrandLogo />
          </div>
          <EmptyState
            icon={<ShieldAlert className="size-10 text-muted-foreground" aria-hidden="true" />}
            title="Meta não encontrada ou expirada"
            description="Este termômetro público de arrecadação foi revogado pelo organizador ou já expirou. Solicite um novo link atualizado ao organizador da meta."
            action={
              <Link
                to="/apresentacao"
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "rounded-xl",
                )}
              >
                Conhecer o Axir
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <SharedLinkHeaderNav
        badgeLabel="Termômetro de Meta"
        targetPath={`meta/${token || ""}`}
        maxWidth="5xl"
      />

      <main className="flex-1 max-w-2xl md:max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
            Termômetro coletivo em tempo real
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            sensoryIntent="selection"
            onClick={handleRefresh}
            disabled={isRefetching}
            className="gap-1.5 text-xs ml-auto"
            aria-label="Atualizar dados do termômetro"
          >
            <RefreshCw
              className={cn("size-3 text-muted-foreground", isRefetching && "animate-spin")}
              aria-hidden="true"
            />
            <span>Atualizar dados</span>
          </Button>
        </div>

        <div className="md:grid md:grid-cols-12 md:gap-6 items-start space-y-6 md:space-y-0">
          <div className="md:col-span-7 space-y-6">
            <GoalThermometerHeroCard goalData={goalData} />

            <div className="rounded-xl border border-border/80 bg-surface p-4 text-xs text-muted-foreground leading-relaxed flex items-start gap-3">
              <RefreshCw className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                Conforme o organizador cadastra os depósitos na meta pelo app, o termômetro atualiza sozinho na web para todos os participantes acompanharem em tempo real.
              </p>
            </div>

            <PublicPwaShortcutCard
              title="Acompanhar Meta no Celular"
              description="Adicione este termômetro à tela inicial para checar o avanço da arrecadação a qualquer momento com 1 toque."
            />

            <section aria-label="Experimentar Axir">
              <div className="rounded-2xl border border-border/80 bg-surface shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <Sparkles className="size-5 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        Crie Vaquinhas &amp; Metas Financeiras Coletivas
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Organize arrecadações com amigos, casamento, viagens ou projetos pessoais com link público e Pix integrado.
                    </p>
                  </div>
                </div>
                <Link
                  to="/"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "gap-1.5 shrink-0 font-semibold text-xs rounded-xl",
                  )}
                >
                  <span>Conhecer o Axir</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </div>

          <div className="md:col-span-5 md:sticky md:top-20 space-y-4">
            <GoalPixContributionSidebar goalData={goalData} />
          </div>
        </div>
      </main>

      <footer className="max-w-2xl md:max-w-5xl mx-auto w-full pt-8 pb-4 text-center space-y-2 border-t border-border/80 mt-8 text-xs text-muted-foreground px-4">
        <p className="leading-relaxed">
          Termômetro público de transparência financeira via Axir.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <span>Axir</span>
          <span aria-hidden="true">·</span>
          <Link
            to="/apresentacao"
            className="text-primary-strong hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>Conheça a plataforma</span>
            <ExternalLink className="size-2.5" aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
