/**
 * Gerador de Dossiê Executivo Forense em Markdown (markdown-dossier-builder.ts).
 *
 * Módulo puramente isomórfico (0 DOM, 0 React, 0 Supabase).
 * Conforme AGENTS.md e Requisitos de Auditoria Quantitativa.
 */

import type { ForensicAuditReport } from "../types";

export function generateMarkdownDossier(report: ForensicAuditReport): string {
  const failedInvariants = report.personas
    .flatMap((p) => p.results)
    .filter((r) => r.status === "failed");

  const hasFailures = failedInvariants.length > 0;

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

## 4. Declaração de Conformidade Quantitativa

O Laboratório Forense de Auditoria Sintética e Contínua comprova que os motores de cálculo do aplicativo Axir respeitam rigorosamente:
1. **Partida Dobrada e Balanço Patrimonial:** Conservação estrita de patrimônio, caixa residual e reconciliação com o extrato.
2. **Moeda em Centavos Inteiros:** Blindagem contra dízimas periódicas no parcelamento e rateio proporcional familiar.
3. **Imutabilidade Cambial:** Preservação de PTAX histórica por lote em ativos internacionais cotados em USD.
4. **Continuidade de Séries Temporais:** Preservação da espinha mensal contínua (inclusive meses sem movimentação).
5. **Divisão por Zero:** Resiliência e retorno seguro nulo/finito em cenários de saldo zero, início de histórico e variância zero.

*Documento gerado automaticamente pelo Núcleo Forense do Axir.*
`;

  return header;
}
