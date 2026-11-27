# Plano Canônico v2 — Hardening Multi-Coluna, .xls Binário Legado & Cascata Vision

> **Status:** Concluído — Implementado, testado e homologado na `v3.29.0`
> **Classificação (`AGENTS.md §10.5`):** Fluxo Completo (Novos Extratores Puros + Evolução de Quality Gate + Refinamento Edge Function + Testes de Regressão)
> **Pré-requisito:** Base modular entregue na `v3.28.0` (`PLANO_REESTRUTURACAO_CANONICA_IMPORTACAO_FATURA.md`)

---

## 1. Problemas Reais Diagnosticados

### 1.1 Fatura PDF em 2 Colunas com Cabeçalhos/Rodapés Largos (ex.: BTG Pactual)
- **Sintoma observado:** Fatura de `R$ 830,38` (8 compras em 2 colunas na pág. 2 + pagamento `- R$ 942,40`) foi lida como apenas **4 compras somando `R$ 520,23`** (`Diferença de R$ 310,15`), fundindo colunas esquerda e direita (`"Mulvi R$ 112,39 29 Out Filialshopping"` com valor `R$ 156,50`).
- **Causas raízes verificadas no código:**
  1. `findBimodalGutterX` ([spatial-pdf-extractor.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/extractors/spatial-pdf-extractor.ts#L202-L285)) analisa **todos os tokens da página inteira**; títulos largos (`Lançamentos do cartão físico | Final 7182 Total do cartão: R$ 736,48`) e quadros de taxas no rodapé cruzam `30%..70%` da página e bloqueiam o corredor X, fazendo o detector retornar `null`.
  2. Sem `gutterX`, `groupTokensIntoLines` junta esquerda + direita na mesma linha Y; `DATE_REGEX` captura a primeira data e `extractBrlAmountFromLine` descarta o primeiro valor assumindo moeda estrangeira, ficando com o valor da direita.
  3. `evaluateStatementExtractionQuality` ([quality-gate.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/quality-gate.ts)) não penaliza descrições contaminadas com `R$ XX,XX + Data`, e `selectCandidatePdfVisionPagesWithOverflow` ([statement-vision-helpers.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/statement-import/statement-vision-helpers.ts#L83-L117)) não prioriza páginas de lançamentos acima de páginas de resumo/capa.
  4. `AMOUNT_REGEX` não reconhece sinal negativo separado por espaço antes de `R$` (`- R$ 942,40`).
  5. Faturas consolidadas com cartão físico + virtual (ex.: `Final 7182` e `Final 0864`) possuem subtotais (`Total do cartão: R$ 736,48`) que podem colidir com `Total a pagar` (`R$ 830,38`) ou disparar falso mismatch de cartão.

### 1.2 Planilhas Excel Binárias Legadas (`.xls` / BIFF8 — `D0 CF 11 E0`)
- **Sintoma observado:** `parseSpreadsheetOrHtmlToRows` ([spreadsheet-extractor.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/extractors/spreadsheet-extractor.ts#L464-L468)) bloqueia arquivos `.xls` binários reais com erro explícito: *"Planilhas no formato binário legado (.xls / Excel 97-2003) não são suportadas diretamente..."*.
- **Impacto:** Diversos bancos e cooperativas brasileiros exportam extratos/faturas em `.xls` BIFF8 genuíno (além dos `.xls` em HTML/XML já suportados).

---

## 2. Arquitetura da Solução (5 Pilares)

### Pilar 1 — Extrator Puro para Excel Binário Legado (`.xls` OLE2/BIFF8)
- **Novo módulo puro (`<= 320 LOC`):** `src/domain/reconciliation/extractors/biff8-xls-extractor.ts`
  - **Camada OLE2 / Compound File Binary (CFB):** leitura determinística do cabeçalho (sector size `512`/`4096`), FAT/DIFAT, Directory entries e Mini-Stream, extraindo o stream `Workbook` (BIFF8) ou `Book` (BIFF5).
  - **Camada BIFF8:** parser sequencial de registros (`BOUNDSHEET`, `SST` com suporte a `CONTINUE` e strings comprimidas ASCII/UTF-16LE, `DATEMODE` 1900/1904, `FORMAT`/`XF` para serial de data Excel, `LABELSST`, `LABEL`, `RSTRING`, `NUMBER`, `RK`, `MULRK`, `FORMULA` lendo valor em cache numérico/string).
  - **Seleção da melhor aba:** reutiliza `scoreWorksheetRows` de `spreadsheet-extractor.ts` para escolher automaticamente a aba transacional em planilhas multi-aba.
  - **Guardas:** se o stream contiver registro `FILEPASS` (arquivo protegido por senha/criptografado), lança mensagem clara orientando desproteger ou salvar como `.xlsx`/`.csv`; zero dependências externas e 100% compatível com Web, PWA e Capacitor Android.

### Pilar 2 — Motor Espacial PDF Multi-Coluna Resiliente
- **Arquivo:** [spatial-pdf-extractor.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/extractors/spatial-pdf-extractor.ts) + [type-sniffer.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/extractors/type-sniffer.ts)
  1. **Detecção Bimodal por Zona Transacional:** antes de buscar o corredor X (`findBimodalGutterX`), filtrar apenas tokens pertencentes a linhas candidatas com `Data + Valor` (excluindo cabeçalhos, títulos de seção de largura total e rodapés de taxas). Avaliar `gutterX` independentemente por página.
  2. **Split Intra-Linha por Tokens X (`splitMergedSpatialLineByTokens`):** segunda barreira determinística — mesmo sem `gutterX` global, se uma linha apresentar `>= 2` ocorrências de data (`DATE_REGEX`) e `>= 2` valores em BRL (não precedidos por moeda estrangeira), localizar o maior intervalo horizontal X entre o primeiro valor BRL e a segunda data, dividindo a linha em duas `SpatialPdfLine` limpas antes da extração.
  3. **Suporte a `- R$ XX,XX`:** atualizar `AMOUNT_REGEX` e `parseAmountToCents` para aceitar sinal negativo opcional separado por espaço antes de `R$` (`(?:-\s*)?R\$\s*...`).
  4. **Higiene de Glifos:** remover tokens isolados de ícones/símbolos gráficos adjacentes aos valores (ex.: globo internacional, setas) sem afetar texto válido.

### Pilar 3 — Detector de Colunas Fundidas no Quality Gate
- **Arquivo:** [quality-gate.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/quality-gate.ts)
  - Adicionar `merged_columns` em `QualityGateFailureReason`.
  - Sinalizar automaticamente qualquer transação cuja `description` final contenha **valor monetário em BRL + outra data** (ex.: `"Mulvi R$ 112,39 29 Out Filialshopping"`), derrubando `passed` para `false` e aplicando penalidade no `score` (`-35` pts).
  - Garante que leituras locais corrompidas sempre acionem a cascata IA/Vision e nunca superem uma extração limpa na função `shouldPreferAiCandidateByQuality`.

### Pilar 4 — Cascata IA Texto & Vision Priorizada por Conteúdo Transacional
- **Arquivos:** [statement-vision-helpers.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/statement-import/statement-vision-helpers.ts), [statement-import-pipeline.ts](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/statement-import/statement-import-pipeline.ts) e [index.ts](file:///home/gabrielsales/meus_apps/financasnew/supabase/functions/ai-financial-assistant/index.ts)
  1. **Ranking de Páginas no Vision:** diferenciar páginas de **resumo/capa** (densidade alta de termos de resumo/limites e `< 2` linhas com `Data + Estabelecimento + Valor`) de páginas de **lançamentos** (`>= 2` linhas transacionais), ordenando páginas de lançamentos primeiro na fila Vision (reduz latência e consumo de cota).
  2. **Prompt `statement_pdf_rows` Reforçado:** instrução explícita para detectar e separar 2 lançamentos na mesma linha de texto quando originados de tabelas lado a lado.
  3. **Fallback Direto ao Vision em Caso de `merged_columns`:** se o texto pré-extraído contiver vazamento de colunas e a IA Texto ainda falhar no Quality Gate, o Vision recebe as páginas priorizadas com renderização limpa da tabela visual.

### Pilar 5 — Precedência de Totais & Multi-Cartão no Mesmo PDF
- **Arquivos:** [statement-preprocessor.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/statement-preprocessor.ts) e [statement-metadata.ts](file:///home/gabrielsales/meus_apps/financasnew/src/domain/reconciliation/statement-metadata.ts)
  1. **Precedência de Totais:** priorizar `"Total a pagar"`, `"Total da fatura"` e `"Total de compras e despesas"` do resumo principal sobre `"Total do cartão: R$ X"` (que representa subtotal por sub-cartão físico/virtual).
  2. **Múltiplos Sub-Cartões (`detectedCardLast4s`):** armazenar lista de finais detectados no documento; considerar cartão compatível se o cartão ativo do usuário coincidir com **qualquer** dos finais encontrados no cabeçalho consolidado (evitando falso alerta entre cartão físico `7182` e virtual `0864` na mesma fatura).

---

## 3. Fases de Execução & Matriz de Testes

### Fase A — `.xls` BIFF8 + `- R$ XX,XX` + Multi-Coluna Espacial (Domínio Puro)
- Criar `biff8-xls-extractor.ts` + testes unitários cobrindo `SST`, `RK`/`MULRK`, `NUMBER`, datas seriais 1900/1904, múltiplas abas e `FILEPASS`.
- Atualizar `spatial-pdf-extractor.ts` (bimodal por banda transacional + split intra-linha + `- R$`) e `type-sniffer.ts`.
- Atualizar `quality-gate.ts` (`merged_columns`), `statement-preprocessor.ts` e `statement-metadata.ts`.
- Adicionar cenário completo **BTG Pactual** (2 colunas, cabeçalho/rodapé largos, `- R$ 942,40`, físico `7182` + virtual `0864`, soma exata `R$ 830,38`) em `multibank-regression.test.ts` e `spatial-pdf-extractor.test.ts`.

### Fase B — Cascata Vision & Edge Function
- Atualizar `selectCandidatePdfVisionPagesWithOverflow` com ranking de páginas transacionais vs resumo (+ testes em `statement-import-pipeline.test.ts`).
- Reforçar `buildStatementPdfRowsPrompt` em `supabase/functions/ai-financial-assistant/index.ts` (+ redeploy).

### Fase C — Portão de Qualidade & Release (`v3.29.0`)
- Executar `npm run verify:full`, suíte focada de reconciliação/cartões, bump `MINOR` (`3.29.0`), atualizar `PROJECT_STRUCTURE.md` / `ROADMAP.md`, commit/push e build APK + redeploy da Edge Function.
