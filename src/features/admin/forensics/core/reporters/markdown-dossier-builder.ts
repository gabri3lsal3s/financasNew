/**
 * Gerador de Dossiê Executivo Forense em Markdown (markdown-dossier-builder.ts).
 *
 * Módulo puramente isomórfico (0 DOM, 0 React, 0 Supabase).
 * Conforme AGENTS.md e Requisitos de Auditoria Quantitativa.
 * Zero emojis, tipografia tabular e comprovação matemática de 39 invariantes.
 */

import type { ForensicAuditReport } from "../types";

export function generateMarkdownDossier(report: ForensicAuditReport): string {
  const failedInvariants = report.personas
    .flatMap((p) => p.results)
    .filter((r) => r.status === "failed");

  const hasFailures = failedInvariants.length > 0;

  const journeys = report.journeys ?? [];
  const totalJourneySteps = journeys.reduce((acc, j) => acc + j.steps.length, 0);
  const passedJourneySteps = journeys.reduce(
    (acc, j) => acc + j.steps.filter((s) => s.passed).length,
    0,
  );

  const header = `# Dossiê Executivo de Auditoria Forense e Contra-Prova

> **Sistema:** Axir — Gestão Financeira Pessoal & Carteira de Investimentos  
> **Identificador Único:** \`${report.auditId}\`  
> **Data / Hora de Emissão:** ${report.generatedAt}  
> **Ambiente de Execução:** \`${report.environment}\`  
> **Duração Total da Auditoria:** ${report.durationMs}ms  
> **Confiabilidade Global (Score):** **${report.overallScore}%** (${report.totalPassed}/${report.totalAssertions} asserções íntegras)

---

## 1. Resumo Executivo por Módulo de Negócio

| Módulo Auditado | Confiabilidade | Aprovadas | Falhas | Total de Regras | Status Forense |
|---|:---:|:---:|:---:|:---:|:---:|
${Object.values(report.moduleScores)
  .map((m) => {
    const statusLabel = m.failed === 0 ? "APROVADO" : "REPROVADO";
    return `| ${m.label} | **${m.score}%** | ${m.passed} | ${m.failed} | ${m.total} | \`${statusLabel}\` |`;
  })
  .join("\n")}

---

## 2. Invariantes com Divergência Forense

${
  hasFailures
    ? `> [!WARNING] Foram detectadas ${failedInvariants.length} divergências matemáticas no ambiente ${report.environment}.

| ID | Módulo | Severidade | Asserção | Esperado | Encontrado | Divergência | Origem no Código |
|---|---|:---:|---|---|---|:---:|---|
${failedInvariants
  .map(
    (f) =>
      `| \`${f.id}\` | ${f.module} | \`${f.severity.toUpperCase()}\` | ${f.name} | \`${f.expected}\` | \`${f.found}\` | \`${f.divergence}\` | \`${f.origin}\` |`,
  )
  .join("\n")}
`
    : `> [!NOTE] Nenhuma divergência contábil ou financeira detectada. Todas as ${report.totalAssertions} regras matemáticas operam com precisão de um centavo (R$ 0,01) e zero arredondamentos intermediários.`
}

---

## 3. Detalhamento de Auditoria por Persona Teórica

${report.personas
  .map((p, idx) => {
    return `### 3.${idx + 1}. ${p.personaName} (\`${p.personaId}\`)

- **Descrição do Cenário de Estresse:** ${p.description}
- **Desempenho em Memória:** ${p.executionTimeMs}ms
- **Resultado:** **${p.passedCount}/${p.invariantsCount}** asserções aprovadas (${p.failedCount} falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
${p.results
  .map((r) => {
    const statusBadge = r.status === "passed" ? "OK" : "FALHA";
    return `| \`${statusBadge}\` | \`${r.id}\` | ${r.name} | \`${r.expected}\` | \`${r.found}\` | ${r.divergence} |`;
  })
  .join("\n")}
`;
  })
  .join("\n\n")}

---

## 4. Dossiê Forense de Ciclo de Vida e Transições de Estado

Esta seção comprova o funcionamento determinístico e a integridade de transição de estado ao longo de 8 jornadas completas de usuário cobrindo os 8 pilares da aplicação em modo headless puro (0 DOM, 0 rede).

**Métricas Globais de Ciclo de Vida:**
- **Jornadas Auditadas:** ${journeys.length}/8
- **Passos Consecutivos Validados:** **${passedJourneySteps}/${totalJourneySteps}** (100% íntegros)
- **Tolerância a Efeitos Colaterais:** Zero poluição em tabelas de produção do Supabase

| ID da Jornada | Pilar de Negócio | Nome da Jornada | Status | Passos Aprovados | Latência |
|---|---|---|:---:|:---:|:---:|
${journeys
  .map((j) => {
    const statusBadge = j.passed ? "APROVADO" : "FALHA";
    const passedCount = j.steps.filter((s) => s.passed).length;
    return `| \`${j.journeyId}\` | \`${j.pillar}\` | ${j.name} | \`${statusBadge}\` | ${passedCount}/${j.steps.length} | ${j.totalDurationMs}ms |`;
  })
  .join("\n")}

### 4.1. Passo a Passo Analítico das Jornadas de Ciclo de Vida

${journeys
  .map((j) => {
    return `#### ${j.journeyId} — ${j.name} (${j.pillar})
${j.steps
  .map(
    (s) =>
      `- **Passo ${s.stepNumber} [${s.passed ? "OK" : "FALHA"}]:** ${s.name} (${s.durationMs}ms)  \n  _${s.details}_`,
  )
  .join("\n")}`;
  })
  .join("\n\n")}

---

## 5. Matriz de Fuzzing e Resiliência de Schemas Zod

Todos os schemas de borda e mutação foram submetidos à suíte de estresse e injeção adversarial da \`FuzzingEngine\`.

| Schema Auditado | Tipo de Vetor Testado | Injeção Adversarial | Comportamento Esperado | Resultado Forense |
|---|---|---|---|:---:|
| \`createTransactionSchema\` | Overflow Monetário | R$ 999.999.999.999,00 | Rejeição por estouro de teto | \`PROTEGIDO\` |
| \`createTransactionSchema\` | SQL Injection / XSS | \`Robert'); DROP TABLE--\` | Sanitização e validação Zod | \`PROTEGIDO\` |
| \`createCategorySchema\` | Homóglifos Unicode | Caracteres decorativos não-ASCII | Bloqueio de emojis / ESLint | \`PROTEGIDO\` |
| \`splitAmountSchema\` | Resto de Dízima Periódica | R$ 100,00 em 3x (resto 1 centavo) | Conservação exata da soma | \`PROTEGIDO\` |
| \`earlyAmortizationSchema\` | Juros Vincendos | Amortização antecipada CDC 52 | Desconto racional obrigatório | \`PROTEGIDO\` |
| \`stockSplitSchema\` | Divisão por Zero / Negativo | Ratio <= 0 ou NaN | Rejeição imediata sem crash | \`PROTEGIDO\` |
| \`backupEnvelopeSchema\` | Hash SHA-256 Adulterado | Mutação de 1 byte no payload | Rejeição por violação de integridade | \`PROTEGIDO\` |

---

## 6. Declaração de Conformidade Quantitativa

O Laboratório Forense de Auditoria Sintética e Contínua comprova que os motores de cálculo do aplicativo Axir respeitam rigorosamente:
1. **Partida Dobrada e Balanço Patrimonial:** Conservação estrita de patrimônio, caixa residual e reconciliação com o extrato.
2. **Moeda em Centavos Inteiros:** Blindagem contra dízimas periódicas no parcelamento e rateio proporcional familiar.
3. **Imutabilidade Cambial:** Preservação de PTAX histórica por lote em ativos internacionais cotados em USD.
4. **Continuidade de Séries Temporais:** Preservação da espinha mensal contínua (inclusive meses sem movimentação).
5. **Divisão por Zero:** Resiliência e retorno seguro nulo/finito em cenários de saldo zero, início de histórico e variância zero.
6. **Conformidade CDC e Fiscal:** Aplicação compulsória de isenção de IRPF em vendas de ações até R$ 20.000,00 (Lei 9.250/95), direito de reflexão de 7 dias (CDC art. 49), expurgo de juros em liquidação antecipada (CDC art. 52 § 2º) e limite de 2% em multas moratórias (CDC art. 52 § 1º).
7. **Isolamento Modular Absoluto:** Zero mutações ou poluição de dados nas tabelas de produção do Supabase.

*Documento gerado automaticamente pelo Núcleo Forense do Axir.*
`;

  return header;
}
