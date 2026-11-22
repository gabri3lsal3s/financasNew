import { useState } from "react";
import {
  CheckCircle2,
  Coins,
  Database,
  FileText,
  Lock,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge, Button, Modal, ModalFooter, Tabs } from "@/components/ui";
import { cn } from "@/lib/utils";

export type LegalTab = "terms" | "privacy";

export interface LegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: LegalTab;
}

interface LegalCardItem {
  title: string;
  description: string;
  icon: typeof FileText;
  iconTone: string;
}

const TERMS_ITEMS: readonly LegalCardItem[] = [
  {
    title: "Transparência, Teste Gratuito e Cancelamento sem Burocracia",
    description:
      "O período de teste não exige inserção prévia de dados de cartão de crédito. Caso opte por um plano pago no futuro, o cancelamento é realizado com 1 clique direto no painel de configurações, sem retenções ou multas.",
    icon: FileText,
    iconTone: "text-warning-strong",
  },
  {
    title: "Portabilidade Integral & Soberania dos Dados",
    description:
      "Você pode exportar a qualquer instante todos os seus lançamentos, carteira de investimentos e balanços patrimoniais em planilhas Excel formatadas (.xlsx) ou relatórios executivos em PDF. Você é o único proprietário do seu histórico financeiro.",
    icon: Database,
    iconTone: "text-portfolio",
  },
  {
    title: "Isenção de Custódia e Consultoria CVM",
    description:
      "O Axir é exclusivamente uma plataforma de inteligência, organização financeira pessoal e rebalanceamento de aportes. O sistema não realiza custódia de moeda, não opera como banco, não executa ordens de corretagem e não emite recomendações ou consultoria de valores mobiliários (Resoluções CVM nº 19 e nº 20/2021). Todas as alocações decorrem de metas parametrizadas pelo usuário.",
    icon: Coins,
    iconTone: "text-portfolio",
  },
  {
    title: "Disponibilidade Contínua e Arquitetura Online First",
    description:
      "A plataforma opera com infraestrutura segura em nuvem e modelo Online First, garantindo sincronização confiável em todos os seus aparelhos e atualizações automáticas contínuas sem interrupção de uso.",
    icon: CheckCircle2,
    iconTone: "text-positive-strong",
  },
];

const PRIVACY_ITEMS: readonly LegalCardItem[] = [
  {
    title: "Isolamento Criptográfico e Row Level Security (RLS)",
    description:
      "Cada registro financeiro (transações, patrimônio, limites de cartões e metas) é estritamente isolado no banco de dados através de políticas ativas de Row Level Security. Nenhum outro usuário ou processo não autenticado tem acesso aos seus registros.",
    icon: Lock,
    iconTone: "text-muted-foreground",
  },
  {
    title: "Privacidade Absoluta e Conformidade com a LGPD",
    description:
      "Nós não vendemos, não alugamos e não compartilhamos seus dados financeiros com instituições bancárias, corretoras, anunciantes ou terceiros. Seus dados são utilizados única e exclusivamente para alimentar os seus cálculos pessoais e gráficos na plataforma.",
    icon: ShieldCheck,
    iconTone: "text-positive-strong",
  },
  {
    title: "Portabilidade e Exportação em Formatos Abertos",
    description:
      "Em conformidade com o Artigo 18 da LGPD, você tem direito irrestrito de extrair todo o seu histórico em arquivos abertos (.xlsx e PDF), garantindo que seus dados nunca fiquem aprisionados.",
    icon: Database,
    iconTone: "text-portfolio",
  },
  {
    title: "Direito ao Esquecimento e Exclusão Permanente",
    description:
      "Você tem controle total sobre suas informações. É possível solicitar a qualquer instante o encerramento da conta com o expurgo permanente, seguro e definitivo de todos os seus dados dos nossos servidores e backups.",
    icon: Trash2,
    iconTone: "text-critical-strong",
  },
];

function renderLegalGrid(items: readonly LegalCardItem[]) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 pt-1 pb-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.title}
            className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs"
          >
            <Icon className={cn("size-4 shrink-0 mt-0.5", item.iconTone)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Diálogo institucional de Termos de Serviço e Privacidade (LGPD).
 */
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
    <Modal
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
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="font-semibold"
          >
            Entendido
          </Button>
        </ModalFooter>
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
              content: renderLegalGrid(TERMS_ITEMS),
            },
            {
              value: "privacy",
              label: "Privacidade (LGPD)",
              icon: <ShieldCheck className="size-3.5" aria-hidden="true" />,
              content: renderLegalGrid(PRIVACY_ITEMS),
            },
          ]}
        />

        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-positive-strong" aria-hidden="true" />
          <span>Em estrita conformidade com a LGPD (Lei nº 13.709/2018)</span>
        </div>
      </div>
    </Modal>
  );
}
