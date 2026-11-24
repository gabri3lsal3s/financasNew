/**
 * Motor Puro do Playbook de Lançamentos & Gestão de Cartões.
 *
 * Módulo de domínio financeiro responsável pela lógica de recomendação de rotina:
 *   1. Avaliação do Quiz de Ritmo (Frequência × Meio de Pagamento Dominante);
 *   2. Prescrição acionável com sugestão do fluxo ideal (Importação de Fatura, Pix IA ou Lançamento Rápido);
 *   3. Conteúdo educativo em 3 camadas com linguagem humana, sem jargões e foco em "Comece de Hoje".
 *
 * Função 100% pura: sem dependências de UI, React ou Supabase (AGENTS.md Regra 3).
 */

export type TransactionQuizFrequency = "realtime" | "weekly" | "monthly";
export type TransactionQuizPaymentMethod = "credit_card" | "pix_debit" | "mixed";

export interface TransactionQuizAnswers {
  readonly frequency: TransactionQuizFrequency;
  readonly paymentMethod: TransactionQuizPaymentMethod;
}

export type TransactionRecommendationKind =
  | "credit_import"
  | "pix_scanner"
  | "quick_manual"
  | "hybrid";

export type TransactionCtaType = "import_statement" | "scan_pix" | "new_transaction";

export interface TransactionRecommendation {
  readonly kind: TransactionRecommendationKind;
  readonly title: string;
  readonly subtitle: string;
  readonly reasons: readonly string[];
  readonly routineAdvice: string;
  readonly ctaType: TransactionCtaType;
  readonly ctaLabel: string;
}

export const INITIAL_TRANSACTION_QUIZ_ANSWERS: TransactionQuizAnswers = {
  frequency: "weekly",
  paymentMethod: "credit_card",
};

/**
 * Avalia as respostas do quiz e determina a rotina ideal de registro com 1-Click CTA.
 */
export function evaluateTransactionQuiz(
  answers: TransactionQuizAnswers,
): TransactionRecommendation {
  // Cenário 1: Quase tudo no Cartão de Crédito
  if (answers.paymentMethod === "credit_card") {
    return {
      kind: "credit_import",
      title: "Rotina Inteligente via Fatura",
      subtitle: "Importe sua fatura e deixe o Axir organizar cada compra automaticamente.",
      reasons: [
        "Elimina a digitação manual de dezenas de compras no cartão.",
        "O importador limpa nomes sujos de maquininhas (remove prefixos como PAG* e códigos estranhos).",
        "Compras parceladas são distribuídas nas competências certas sem duplicar despesas.",
      ],
      routineAdvice:
        "Você não precisa registrar compras todo dia. Uma vez por semana ou no fechamento da fatura, importe o arquivo OFX/CSV ou PDF do seu banco em 1 clique.",
      ctaType: "import_statement",
      ctaLabel: "Importar Fatura Agora",
    };
  }

  // Cenário 2: Muito Pix e Débito no dia a dia
  if (answers.paymentMethod === "pix_debit") {
    return {
      kind: "pix_scanner",
      title: "Rotina Ágil com Leitor Pix Inteligente",
      subtitle: "Compartilhe ou carregue comprovantes Pix para preenchimento automático.",
      reasons: [
        "A inteligência do Axir identifica o valor, a data e sugere a categoria certa.",
        "Ideal para quem faz transferências frequentes para prestadores e comércio local.",
        "Seu saldo bancário se mantém conciliado sem esforço de digitação.",
      ],
      routineAdvice:
        "Sempre que fizer um Pix importante, compartilhe o comprovante diretamente com o app ou suba a imagem no leitor para registrar em 3 segundos.",
      ctaType: "scan_pix",
      ctaLabel: "Ler Comprovante Pix",
    };
  }

  // Cenário 3: Misto ou Lançamento em Tempo Real
  if (answers.frequency === "realtime") {
    return {
      kind: "quick_manual",
      title: "Rotina de Registro em Tempo Real",
      subtitle: "Registro rápido no momento da compra com atalhos de categoria.",
      reasons: [
        "Maior consciência de gastos no exato momento em que o dinheiro sai.",
        "Permite registrar dinheiro vivo e gastos pequenos da carteira.",
        "Visão imediata do seu saldo livre para gastar atualizado na Home.",
      ],
      routineAdvice:
        "Lembre-se da regra da clareza: selecione a Categoria certa e escreva apenas o nome do estabelecimento (ex.: 'Padaria Estrela'), sem textão.",
      ctaType: "new_transaction",
      ctaLabel: "Novo Lançamento Rápido",
    };
  }

  // Cenário 4: Rotina Híbrida Equilibrada
  return {
    kind: "hybrid",
    title: "Rotina Híbrida Equilibrada",
    subtitle: "Importação periódica para o cartão e lançamentos rápidos para o dia a dia.",
    reasons: [
      "O melhor dos dois mundos: automação no cartão e agilidade no Pix.",
      "Garante que dinheiro vivo e pequenos trocos não fiquem de fora do orçamento.",
      "Revisão rápida de 5 minutos no final de semana mantém as contas 100% em dia.",
    ],
    routineAdvice:
      "Adote o ritual de domingo ou fechamento de mês: importe o cartão e faça uma checagem rápida do saldo bancário.",
    ctaType: "import_statement",
    ctaLabel: "Importar Fatura do Cartão",
  };
}
