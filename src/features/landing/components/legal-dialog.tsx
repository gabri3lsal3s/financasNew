import { ShieldCheck, Lock, Database, FileText } from "lucide-react";
import { Button, ResponsiveDialog } from "@/components/ui";

export interface LegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LegalDialog({ open, onOpenChange }: LegalDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Termos de Serviço & Privacidade (LGPD)"
      description="Compromisso absoluto com a segurança, sigilo e soberania dos seus dados financeiros."
      size="lg"
      footer={
        <Button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full sm:w-auto"
        >
          Entendido
        </Button>
      }
    >
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        {/* Pilar 1: Isolamento de Dados & RLS */}
        <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface/60 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Isolamento Criptográfico e Row Level Security (RLS)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada registro financeiro (transações, patrimônio, limites de cartões e metas) é estritamente isolado no banco de dados através de políticas ativas de Row Level Security. Nenhum outro usuário ou processo não autenticado tem acesso aos seus registros.
            </p>
          </div>
        </div>

        {/* Pilar 2: Zero Venda de Dados e Sem Anúncios */}
        <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface/60 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-positive/10 text-positive-strong dark:text-positive">
            <ShieldCheck className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Privacidade Absoluta e Conformidade com a LGPD
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Nós não vendemos, não alugamos e não compartilhamos seus dados financeiros com instituições bancárias, corretoras, anunciantes ou terceiros. Seus dados são utilizados única e exclusivamente para alimentar os seus cálculos pessoais e gráficos na plataforma.
            </p>
          </div>
        </div>

        {/* Pilar 3: Portabilidade e Exportação */}
        <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface/60 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 text-portfolio">
            <Database className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Portabilidade Integral & Soberania dos Dados
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Você pode exportar a qualquer instante todos os seus lançamentos, carteira de investimentos e balanços patrimoniais em planilhas Excel formatadas (.xlsx) ou relatórios executivos em PDF. Você é o único proprietário do seu histórico financeiro.
            </p>
          </div>
        </div>

        {/* Pilar 4: Termos de Uso e Cancelamento */}
        <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-surface/60 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning-strong dark:text-warning">
            <FileText className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Transparência, Teste Gratuito e Cancelamento sem Burocracia
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              O período de teste não exige inserção prévia de dados de cartão de crédito. Caso opte por um plano pago no futuro, o cancelamento é realizado com 1 clique direto no painel de configurações, sem retenções ou multas.
            </p>
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
