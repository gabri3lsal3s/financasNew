import { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Database,
  FileText,
  Coins,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button, Badge, ResponsiveDialog, Tabs } from "@/components/ui";

export type LegalTab = "terms" | "privacy";

export interface LegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: LegalTab;
}

export function LegalDialog({
  open,
  onOpenChange,
  defaultTab = "terms",
}: LegalDialogProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(defaultTab);
  const [prevKey, setPrevKey] = useState(`${open}:${defaultTab}`);
  const currentKey = `${open}:${defaultTab}`;

  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    if (open) {
      setActiveTab(defaultTab);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Termos de Serviço & Privacidade (LGPD)"
      description="Compromisso absoluto com a segurança, sigilo e soberania dos seus dados financeiros."
      size="xl"
      headerActions={
        <Badge variant="muted" size="sm" className="hidden sm:inline-flex font-medium">
          Legal & LGPD
        </Badge>
      }
      footerClassName="sm:justify-between"
      footer={
        <>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-positive-strong dark:text-positive" aria-hidden="true" />
            <span>Em estrita conformidade com a LGPD (Lei nº 13.709/2018)</span>
          </div>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto min-w-[130px] bg-primary text-primary-foreground hover:bg-primary-strong shadow-xs font-semibold"
          >
            Entendido
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as LegalTab)}
          fullWidth
          variant="pills"
          forceMount
          items={[
            {
              value: "terms",
              label: "Termos de Serviço",
              icon: <FileText className="size-3.5" aria-hidden="true" />,
              content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 pt-1 pb-4">
                  {/* Item 1 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors hover:border-border">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10 text-warning-strong dark:text-warning">
                      <FileText className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Transparência, Teste Gratuito e Cancelamento sem Burocracia
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        O período de teste não exige inserção prévia de dados de cartão de crédito. Caso opte por um plano pago no futuro, o cancelamento é realizado com 1 clique direto no painel de configurações, sem retenções ou multas.
                      </p>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors hover:border-border">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-portfolio/30 bg-portfolio/10 text-portfolio dark:text-sky-400">
                      <Database className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Portabilidade Integral & Soberania dos Dados
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Você pode exportar a qualquer instante todos os seus lançamentos, carteira de investimentos e balanços patrimoniais em planilhas Excel formatadas (.xlsx) ou relatórios executivos em PDF. Você é o único proprietário do seu histórico financeiro.
                      </p>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors hover:border-border">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-portfolio/30 bg-portfolio/10 text-portfolio dark:text-sky-400">
                      <Coins className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Isenção de Custódia e Intermediação Financeira
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        O Áxis é exclusivamente uma plataforma de inteligência, organização financeira pessoal e rebalanceamento de aportes. O sistema não realiza custódia de moeda, não opera como banco e não executa ordens de corretagem em seu nome.
                      </p>
                    </div>
                  </div>

                  {/* Item 4 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors hover:border-border">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary-strong dark:text-primary">
                      <CheckCircle2 className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Disponibilidade Contínua e Arquitetura Online First
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        A plataforma opera com infraestrutura segura em nuvem e modelo Online First, garantindo sincronização confiável em todos os seus aparelhos e atualizações automáticas contínuas sem interrupção de uso.
                      </p>
                    </div>
                  </div>
                </div>
              ),
            },
            {
              value: "privacy",
              label: "Privacidade (LGPD)",
              icon: <ShieldCheck className="size-3.5" aria-hidden="true" />,
              content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 pt-1 pb-4">
                  {/* Item 1 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors hover:border-border">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary-strong dark:text-primary">
                      <Lock className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Isolamento Criptográfico e Row Level Security (RLS)
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Cada registro financeiro (transações, patrimônio, limites de cartões e metas) é estritamente isolado no banco de dados através de políticas ativas de Row Level Security. Nenhum outro usuário ou processo não autenticado tem acesso aos seus registros.
                      </p>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors hover:border-border">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-positive/30 bg-positive/10 text-positive-strong dark:text-positive">
                      <ShieldCheck className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Privacidade Absoluta e Conformidade com a LGPD
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Nós não vendemos, não alugamos e não compartilhamos seus dados financeiros com instituições bancárias, corretoras, anunciantes ou terceiros. Seus dados são utilizados única e exclusivamente para alimentar os seus cálculos pessoais e gráficos na plataforma.
                      </p>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors hover:border-border">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-portfolio/30 bg-portfolio/10 text-portfolio dark:text-sky-400">
                      <Database className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Portabilidade e Exportação em Formatos Abertos
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Em conformidade com o Artigo 18 da LGPD, você tem direito irrestrito de extrair todo o seu histórico em arquivos abertos (.xlsx e PDF), garantindo que seus dados nunca fiquem aprisionados.
                      </p>
                    </div>
                  </div>

                  {/* Item 4 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors hover:border-border">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-critical/30 bg-critical/10 text-critical-strong dark:text-critical">
                      <Trash2 className="size-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Direito ao Esquecimento e Exclusão Permanente
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Você tem controle total sobre suas informações. É possível solicitar a qualquer instante o encerramento da conta com o expurgo permanente, seguro e definitivo de todos os seus dados dos nossos servidores e backups.
                      </p>
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </ResponsiveDialog>
  );
}
