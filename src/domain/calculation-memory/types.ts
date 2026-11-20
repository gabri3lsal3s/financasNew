/**
 * Contrato Canônico de Memória de Cálculo e Explicabilidade Ativa.
 *
 * Cumpre a Regra 33 do AGENTS.md e as diretrizes de governança matemática do Axi.
 * Suporta tipagem universal multi-unidade: moedas em centavos, percentuais pt-BR,
 * meses de autonomia, quantidades e múltiplos.
 *
 * Módulo 100% puro: sem dependências de React, DOM ou Supabase.
 */

export type BreakdownUnit = "currency" | "percent" | "months" | "count" | "ratio";

export type BreakdownTone = "positive" | "negative" | "default" | "portfolio" | "muted";

export type BreakdownOperator = "+" | "-" | "x" | "/" | "=";

export interface BreakdownActionLink {
  /** Rota interna do aplicativo para navegação direta ao extrato/fonte (ex: "/transacoes?month=2026-11"). */
  to: string;
  /** Rótulo textual acessível da ação (ex: "Ver compras no extrato"). */
  label: string;
  /** Dica contextual complementar exibida no hover/acessibilidade. */
  hint?: string;
}

export interface BreakdownStep {
  /** Rótulo descritivo da parcela (ex: "Saldo Atual em Contas Bancárias"). */
  label: string;
  /** Operador aritmético exibido antes do valor (+, -, x, / ou =). */
  operator?: BreakdownOperator;
  /** Valor numérico bruto (moeda em centavos inteiros, percentual em float, etc.). */
  rawValue: number;
  /** Unidade de exibição desta linha específica (se omitida, assume a unidade do cálculo). */
  unit?: BreakdownUnit;
  /** Valor formatado para exibição opcional; se omitido, formatado automaticamente pelo engine. */
  formattedValue?: string;
  /** Detalhe explicativo, metadados ou contexto adicional abaixo da linha. */
  hint?: string;
  /** Tom semântico da cor do número. */
  tone?: BreakdownTone;
  /** Link de ação para navegação em 1 toque (auditoria direta da fonte). */
  actionLink?: BreakdownActionLink;
  /** Grau de destaque tipográfico da linha. */
  emphasis?: "normal" | "subtotal" | "total";
}

export interface BreakdownResult {
  /** Rótulo da linha de total (ex: "Saldo Livre Real"). */
  label: string;
  /** Valor numérico bruto final resultante da equação. */
  rawValue: number;
  /** Unidade do resultado final. */
  unit: BreakdownUnit;
  /** Valor formatado resultante; se omitido, formatado automaticamente pelo engine. */
  formattedValue?: string;
  /** Tom semântico da cor do total. */
  tone?: BreakdownTone;
  /** Observação final adicional ou esclarecimento sobre o resultado. */
  hint?: string;
}

export interface CalculationBreakdown {
  /** Identificador único e estável da métrica (ex: "dash-real-cash", "dash-safe-to-spend"). */
  id: string;
  /** Título legível da métrica alinhado ao card da UI (ex: "Saldo Livre Real (Safe-to-Spend)"). */
  title: string;
  /** Resumo objetivo em 1 frase humana do que o número mede e para que serve. */
  description?: string;
  /** Recorte temporal ou escopo exato do cálculo (ex: "Ciclo atual até 20/11/2026"). */
  periodLabel?: string;
  /** Expressão matemática resumida (ex: "Saldo em Conta + Recebíveis Previstos − Obrigações do Ciclo"). */
  formulaExpression?: string;
  /** Unidade padrão do resultado do cálculo. */
  unit: BreakdownUnit;
  /** Parcelas ordenadas da equação com seus valores e operadores. */
  steps: BreakdownStep[];
  /** Resultado final consolidado da equação. */
  result: BreakdownResult;
  /** Critérios explícitos do que foi incluído no cálculo. */
  inclusions?: string[];
  /** Critérios explícitos do que foi excluído de propósito (ex: transferências, compras no crédito). */
  exclusions?: string[];
  /** Alertas de transparência para dados estimados, cotação defasada ou mês incompleto. */
  notes?: string[];
  /** Resumo em texto limpo pré-gerado para cópia em 1 toque. */
  copyText?: string;
}
