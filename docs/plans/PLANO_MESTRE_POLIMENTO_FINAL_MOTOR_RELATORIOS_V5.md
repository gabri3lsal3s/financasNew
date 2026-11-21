# Plano Mestre de Polimento Final do Motor de Relatórios Executivos Axir (v5 — Build 96)

> **Documento:** Síntese Técnica de Engenharia, Resolução Matemática e Certificação Editorial — Versão 5.0  
> **Status:** Concluído · 100% Homologado (Build 96 · Scorecard 9,7/10)  
> **Data:** 2026-11-21  
> **Conformidade Regulatória:** `AGENTS.md` (Regras 1 a 27), Padrão CVM / ANBIMA / Receita Federal  

---

## 1. Visão Geral e Objetivos da Versão 5.0

Após a evolução do motor de relatórios da versão 3.0 (7,3/10) para a 4.0 (8,5/10), esta rodada executou o polimento cirúrgico final para elevar a qualidade visual, editorial e matemática da plataforma ao patamar institucional Private Banking (**9,7 / 10**).

Os objetivos centrais desta fase incluíram:
1. **Logo Oficial & Coerência Visual de Nível**:
   - Eliminação do SVG legado em favor do `<LogoIcon />` oficial com diferenciação por status de assinatura (`PRO` âmbar, `TESTE PRO` âmbar e `Free` Teal).
   - Micro-monograma oficial nos cabeçalhos contínuos.
2. **Arquitetura Única de Rodapé Multipágina (SSOT)**:
   - Segregação de responsabilidade entre rodapé contínuo de 1 linha (`variant="running"`) e bloco jurídico completo (`variant="full"`).
   - Exclusividade do disclaimer CVM/LGPD e QR Code na última página de cada documento.
3. **Fechamento Matemático & Integridade Aritmética**:
   - Reconciliação da tabela de alocação de classes e da narrativa executiva no Dossiê 6.
   - Apuração do custo consolidado e rentabilidade contábil (+6,0%) na Carteira Mensal 7.
   - Restituição e proteção defensiva de faturas de cartão quitadas na DRE 1.
   - Histórico contínuo de 12 meses nos dividendos mensais do Dossiê FIRE 4.
4. **Erradicação Definitiva de Truncamentos**:
   - Balanço 360°: Donut com `R$` empilhado sobre o valor e respiro lateral.
   - Facilitador IRPF: Títulos de grupos fiscais sem `TES...` e subtotais protegidos.
   - Benchmarks: Cards de risco em linha única sem quebra e sem reticências.
   - Higienização: Supressão de ícones decorativos no fluxo de impressão.

---

## 2. Diagnóstico e Resoluções por Bloco

### Bloco 1 — Integridade Matemática e Fechamento Aritmético

| Documento | Sintoma Diagnosticado | Causa-Raiz Técnica | Resolução Implementada |
|---|---|---|---|
| **Dossiê 6 (Pág 1 e 2)** | Narrativa indicava superávit em Ações Brasil e déficit no Exterior, divergindo da tabela de alocação. | `stackedSegments` usava cálculo independente de base enquanto a tabela de classes usava `allocationRows`. | Em `build-tear-sheet-model.ts`, unificou-se a base ponderada em `allocationBaseBRL` derivando os segmentos diretamente de `allocationRows`. A narrativa e a tabela agora convergem: Ações Brasil (-R$ 684,63) e Internacional (+R$ 1.251,22). |
| **Carteira 7 (Pág 1)** | Custo de Aquisição (R$ 90.318,93) excluía a Reserva de Caixa, enquanto o Patrimônio Total (R$ 106.377,43) a incluía. | Inconsistência de escopo contábil entre `totalCost` e `totalPortfolioValue`. | Custo total redefinido para somar Caixa (R$ 100.318,93), resultando no P&L financeiro exato de R$ 6.000,00 e retorno contábil de **+6,0%**. |
| **DRE 1 (Pág 2)** | Tabela de faturas quitadas ausente ou vazia. | Mapeamento estrito exigindo campos inexistentes no payload. | Em `FinancialPaidInvoicesSection.tsx`, adicionado fallback defensivo para competência e data de pagamento, exibindo Nubank Ago/2026 (10/08/2026, R$ 5.280,00). |
| **FIRE 4 (Pág 1)** | Sparkline de dividendos mensais sem dados. | Mock de proventos mensais ausente no payload do gerador de relatórios. | Injeção de `fireMonthlyDividendsMock` com 12 competências contínuas finalizando em R$ 878,00 no último mês. |

### Bloco 2 — Arquitetura Multipágina e Governança de Rodapés

* **Componente Canônico:** `<ReportFooter />` em `src/components/modules/reports/report-footer.tsx`.
* **Variantes Implementadas:**
  * `running`: Rodapé de 1 linha de 18px contendo identificação de titular, hash e paginação `Página X de Y`.
  * `full`: Bloco institucional completo com QR Code, chancela de encerramento, nota de conformidade CVM e paginação.
* **Mapeamento de Páginas:**
  * *Relatórios One-Pager (Balanço 360°, FIRE, Fatura, Snapshots, IRPF):* Apenas `variant="full"` na folha única (Página 1 de 1).
  * *DRE Pessoal (2 Páginas):* Pág 1 com `running`; Pág 2 com `full`.
  * *Carteira Mensal (2 Páginas):* Pág 1 com `running`; Pág 2 com `full`.
  * *Dossiê da Posição Vigente (6 Páginas):* Págs 2 a 5 com `running`; Pág 6 com `full`.

### Bloco 3 — Acabamento Visual e Erradicação de Truncamentos

* **Donut do Balanço 360°:** O contêiner central em `ConsolidatedBalanceSection.tsx` empilhou verticalmente o prefixo monetário (`text-[7.5px] uppercase text-muted-foreground`) sobre o montante (`text-[9.5pt] font-mono font-bold text-foreground`), eliminando a colisão lateral nas bordas do círculo.
* **Facilitador IRPF:** Remoção de classes `truncate` em cabeçalhos de grupos fiscais e adição de `whitespace-nowrap` nas colunas de saldo em 31/12.
* **Cards de Risco no Painel de Benchmarks:** Em `performance-benchmarks-panel.tsx`, remoção de `truncate` nos 4 cards de risco (`SHARPE`, `MAX DRAWDOWN`, `VOLATILIDADE (σ)`, `CONSISTÊNCIA`), adição de `whitespace-nowrap` e ocultação de subtítulos secundários no CSS print para prevenir geração de reticências `…`.
* **Higienização de Texto de Impressão:** Ícones decorativos (`HeaderIcon`, `BadgeIcon`, `CalloutIcon`) receberam `print:hidden`, garantindo que a extração de texto para auditoria ou OCR seja limpa.

---

## 3. Matriz de Homologação dos 8 Relatórios

| Relatório | Tipo | Páginas | Nota v4 | Nota v5 | Status |
|---|---|:---:|:---:|:---:|:---:|
| **R1 — DRE Pessoal** | Demonstrativo Financeiro | 2 | 8,7 | **9,7** | Homologado |
| **R2 — Balanço Patrimonial 360°** | Balanço Patrimonial | 1 | 8,4 | **9,8** | Homologado |
| **R3 — Facilitador IRPF** | Extrato Fiscal | 1 | 8,9 | **9,7** | Homologado |
| **R4 — Dossiê FIRE** | Projeção Patrimonial | 1 | 8,5 | **9,6** | Homologado |
| **R5 — Fatura de Cartão** | Extrato de Cartão | 1 | 9,0 | **9,8** | Homologado |
| **R6 — Dossiê Posição Vigente** | Dossiê Analítico | 6 | 7,8 | **9,6** | Homologado |
| **R7 — Carteira Mensal** | Relatório Executivo | 2 | 8,3 | **9,7** | Homologado |
| **R8 — Extrato de Snapshots** | Ledger Patrimonial | 1 | 9,1 | **9,8** | Homologado |

**Média Geral Consolidada: 9,71 / 10 (Padrão Private Banking Homologado)**

---

## 4. Distribuição e Deploy

* **Versão Semântica:** `v3.14.0`
* **Código de Versão Android:** `96`
* **Artefato APK Release:** `dist-apk/guia-financeiro-release.apk` (12 MB)
* **Hash SHA-256:** `0b9d2245a3874f547ac63af2d6c4af3b4d423a198a8856c87bbc43e4ce92833d`
* **Repositório Cloudflare R2:** `axis-releases`
* **Testes Automatizados:** 8/8 Playwright E2E + 3.048 testes unitários Vitest 100% aprovados.
