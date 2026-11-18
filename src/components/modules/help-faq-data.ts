import {
  Compass,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface FaqItem {
  id: string;
  icon: LucideIcon;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "rebalance",
    icon: TrendingUp,
    question: "Como funciona o Rebalanceamento de Carteira?",
    answer:
      "O motor de rebalanceamento calcula a distância percentual entre sua posição atual e os pesos-alvo que você configurou. Ao simular um aporte, o sistema calcula a alocação exata para direcionar o capital prioritariamente aos ativos mais distantes da meta ideal. O cálculo é estritamente matemático e não constitui recomendação de ativos ou consultoria financeira.",
  },
  {
    id: "invoices",
    icon: CreditCard,
    question: "Como são organizadas as Faturas de Cartão?",
    answer:
      "As transações feitas com cartão de crédito são agrupadas por competência e vencimento com base no dia de fechamento cadastrado para o cartão, respeitando o regime financeiro da fatura.",
  },
  {
    id: "shared",
    icon: Users,
    question: "Como funciona a divisão de despesas e o Modo Família?",
    answer:
      "No lançamento ou detalhe de uma despesa, você pode dividi-la entre participantes com cobranças Pix Copia e Cola automáticas para envio direto. No Modo Família, é possível definir um teto compartilhado para o lar e acompanhar o equilíbrio de contribuições entre os membros.",
  },
  {
    id: "security",
    icon: ShieldCheck,
    question: "Meus dados financeiros estão protegidos?",
    answer:
      "Sim. O sistema utiliza isolamento estrito de dados por usuário com políticas de segurança em nível de linha (RLS) no banco de dados e tráfego 100% criptografado. Nenhuma senha de conta bancária é solicitada.",
  },
  {
    id: "simulation",
    icon: Compass,
    question: "O Modo Simulação altera minhas finanças reais?",
    answer:
      "Não. O modo de simulação opera exclusivamente em memória no seu navegador com um conjunto de dados ilustrativos. Seus registros reais permanecem intactos e são restaurados no mesmo instante ao desligar a simulação.",
  },
];
