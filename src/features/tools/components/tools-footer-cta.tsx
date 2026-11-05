import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { useAuth } from "@/hooks/use-auth";
import { useSaveSimulationToAccount } from "@/state";
import {
  storePendingSimulation,
  buildSimulationRegisterUrl,
  type PendingSimulation,
} from "@/domain/share";

export interface ToolsFooterCtaProps {
  title?: string;
  description?: string;
  registerQueryParams?: string;
  simulationPayload?: PendingSimulation;
}

export function ToolsFooterCta({
  title = "Deseja monitorar suas finanças e metas com automação diária?",
  description = "Centralize contas bancárias, cartões, dívidas, orçamentos e carteira de investimentos em um único painel inteligente com máxima privacidade e zero anúncios.",
  registerQueryParams = "",
  simulationPayload,
}: ToolsFooterCtaProps) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const saveMutation = useSaveSimulationToAccount();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoggedIn = !!session?.user;

  const handleQuickStart = async () => {
    triggerSensory("action");

    if (simulationPayload) {
      if (isLoggedIn) {
        setIsSubmitting(true);
        try {
          await saveMutation.mutateAsync(simulationPayload);
          const targetRoute =
            simulationPayload.type === "debt_simulator"
              ? "/dividas"
              : simulationPayload.type === "rebalance_simulator"
                ? "/investimentos"
                : "/";
          navigate(targetRoute);
        } catch {
          // Toast já disparado no callback onError da mutation
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      // Convidado/Não logado: persiste em storage e conduz para o cadastro com query param
      storePendingSimulation(simulationPayload);
      const url = buildSimulationRegisterUrl(simulationPayload);
      const targetUrl = registerQueryParams ? `${url}&${registerQueryParams}` : url;
      navigate(targetUrl);
      return;
    }

    const defaultUrl = `/cadastro${registerQueryParams ? `?${registerQueryParams}` : ""}`;
    navigate(isLoggedIn ? "/" : defaultUrl);
  };

  const primaryButtonLabel = isLoggedIn
    ? simulationPayload
      ? "Salvar Simulação na Minha Conta"
      : "Ir para o Painel"
    : "Criar Conta no Áxis Finance";

  return (
    <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <Card className="border-border/80 bg-surface shadow-xs overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <CardContent className="p-6 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>Plataforma Completa</span>
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
            <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
                <span>Dados Criptografados</span>
              </span>
              <span>·</span>
              <span>Online First</span>
              <span>·</span>
              <span>100% Sem Anúncios</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
            <Link to="/apresentacao" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full">
                Conhecer Recursos
              </Button>
            </Link>

            <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
              <Button
                variant="default"
                size="sm"
                className="w-full gap-2 font-semibold shadow-xs"
                onClick={handleQuickStart}
                disabled={isSubmitting}
                aria-label={primaryButtonLabel}
              >
                <span>{primaryButtonLabel}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              {simulationPayload && !isLoggedIn && (
                <span className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Sparkles className="size-3 text-primary" aria-hidden="true" />
                  <span>Transporta dados da simulação</span>
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="pt-8 text-center text-xs text-muted-foreground">
        <p>Áxis Finance · Gestão Financeira Pessoal & Motor de Rebalanceamento de Carteira.</p>
        <p className="mt-1 text-[11px] text-muted-foreground/80">
          Ferramentas e simuladores financeiros de livre acesso público com processamento 100% local no navegador.
        </p>
      </div>
    </footer>
  );
}
