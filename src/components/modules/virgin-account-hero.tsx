import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  CreditCard,
  Landmark,
  PlusCircle,
  Sparkles,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DemoTrackSelectModal } from "./demo-track-select-modal";

export interface VirginAccountHeroProps {
  /** Callback para calibrar o saldo bancário inicial (CashCheckpoint / Bater com o Banco). */
  onCalibrate?: () => void;
  /** Callback para abrir o assistente de nova transação (LaunchWizard). */
  onOpenNewTransaction?: () => void;
  /** Callback para abrir o diálogo de importação de extrato bancário. */
  onOpenStatementImport?: () => void;
  /** Callback customizado para abrir a demonstração. Se omitido, abre DemoTrackSelectModal internamente. */
  onOpenDemo?: () => void;
  className?: string;
}

/**
 * VirginAccountHero — Contêiner de recepção para o primeiro acesso (Regra 30 do AGENTS.md).
 *
 * Em contas virgens (sem movimentações nem cartões), substitui a sucessão de 8 cards analíticos
 * vazios e gráficos zerados por 3 portas de entrada claras e acolhedoras, eliminando a ansiedade
 * de partida a frio (cold-start anxiety).
 */
export function VirginAccountHero({
  onCalibrate,
  onOpenNewTransaction,
  onOpenStatementImport,
  onOpenDemo,
  className,
}: VirginAccountHeroProps) {
  const navigate = useNavigate();
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const handleOpenDemo = () => {
    if (onOpenDemo) {
      onOpenDemo();
    } else {
      setDemoModalOpen(true);
    }
  };

  return (
    <>
      <div
        role="region"
        aria-label="Primeiros passos na sua conta"
        className={cn(
          "flex flex-col gap-6 rounded-2xl border border-border/80 bg-surface p-5 sm:p-7 shadow-xs",
          className,
        )}
      >
        {/* Cabeçalho Acolhedor */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-strong">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <Badge variant="default" size="xs">
              Primeiro Acesso
            </Badge>
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Bem-vindo ao seu novo centro financeiro
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Sua conta está limpa e pronta para uso. Escolha por onde deseja começar a organizar o seu dinheiro hoje:
          </p>
        </div>

        {/* 3 Portas de Entrada Imediatas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Opção 1: Informar Saldo Inicial (Recomendada) */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4 transition-colors hover:border-primary/40 shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-strong">
                  <Landmark className="size-4.5" aria-hidden="true" />
                </div>
                <Badge variant="default" size="xs">
                  Recomendado
                </Badge>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Informar Saldo Inicial
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Defina o saldo real das suas contas bancárias para conciliação perfeita e acompanhamento de caixa desde o primeiro dia.
              </p>
            </div>

            {onCalibrate ? (
              <Button
                size="sm"
                variant="default"
                onClick={onCalibrate}
                className="w-full text-xs font-semibold cursor-pointer"
              >
                Calibrar Saldo
              </Button>
            ) : onOpenStatementImport ? (
              <Button
                size="sm"
                variant="default"
                onClick={onOpenStatementImport}
                className="w-full text-xs font-semibold cursor-pointer"
              >
                Importar Arquivo
              </Button>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={() => navigate("/cartoes")}
                className="w-full text-xs font-semibold cursor-pointer"
              >
                Calibrar Saldo
              </Button>
            )}
          </div>

          {/* Opção 2: Cadastrar Cartão de Crédito */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-border/80 bg-surface p-4 transition-colors hover:bg-surface-hover hover:border-border shadow-xs">
            <div className="space-y-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-muted-foreground">
                <CreditCard className="size-4.5" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Adicionar Cartão de Crédito
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Monitore limites disponíveis, datas de fechamento, vencimento de faturas e saiba seu melhor dia de compra.
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/cartoes")}
              className="w-full text-xs font-medium cursor-pointer"
            >
              Cadastrar Cartão
            </Button>
          </div>

          {/* Opção 3: Primeiro Lançamento Rápido */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-border/80 bg-surface p-4 transition-colors hover:bg-surface-hover hover:border-border shadow-xs">
            <div className="space-y-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-muted-foreground">
                <PlusCircle className="size-4.5" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Lançar Despesa ou Receita
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Registre uma movimentação agora mesmo com digitação rápida ou fotografando um comprovante Pix.
              </p>
            </div>

            {onOpenNewTransaction ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenNewTransaction}
                className="w-full text-xs font-medium cursor-pointer"
              >
                Fazer Lançamento
              </Button>
            ) : (
              <Link to="/transacoes?novo=transacao" className="w-full">
                <Button size="sm" variant="outline" className="w-full text-xs font-medium cursor-pointer">
                  Fazer Lançamento
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Rodapé: Ponte para o Modo Demonstração */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/80">
          <span className="text-xs text-muted-foreground text-center sm:text-left">
            Deseja ver como o app funciona com relatórios completos e investimentos antes de começar?
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenDemo}
            className="gap-1.5 text-xs text-primary-strong hover:bg-primary/10 shrink-0 cursor-pointer"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Explorar Conta Demonstrativa</span>
          </Button>
        </div>
      </div>

      <DemoTrackSelectModal
        open={demoModalOpen}
        onOpenChange={setDemoModalOpen}
      />
    </>
  );
}
