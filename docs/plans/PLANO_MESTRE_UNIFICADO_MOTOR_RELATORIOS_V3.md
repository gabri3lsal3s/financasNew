# Plano Mestre Unificado: Engenharia de Layout, Integridade de Dados e Padrão Editorial Private Banking (Motor de Relatórios Axir)

> **Documento:** Síntese Arquitetural & Plano Diretor Consolidado — Versão 3.0  
> **Status:** Concluído · 100% Homologado (Build 95)  
> **Fontes Integradas:** Auditoria Interna de Código-Fonte + Auditoria Externa Visual & Editorial (8 PDFs / 16 Páginas Físicas)  
> **Conformidade Regulatória & Governança:** `AGENTS.md` (Regras 1 a 27), Padrão CVM / ANBIMA / Receita Federal  

---

## 1. Fase 0 — Matriz de Convergência & Arbitragem

A auditoria cruzada confrontou a análise visual externa dos 8 PDFs físicos com a realidade da base de código (React 18, Tailwind CSS, TanStack Query, motor Chromium/Blink `@media print` e camada de cálculo puro em `src/domain/`).

### 1.1 Matriz de Convergências Confirmadas (Sintoma Visual $\leftrightarrow$ Causa-Raiz no Repositório)

| # | Sintoma Visual Detectado | Causa-Raiz Técnica no Código | Arquivo(s) Afetado(s) | Gravidade |
|---|---|---|---|:---:|
| **C1** | **Running Header na Página 1** (duplicando o cabeçalho em 7 dos 8 relatórios). | Primitivo `<ReportRunningHeader />` possui classe `hidden print:flex`. Por ter sido inserido no topo da folha logo após `<ReportHeader />`, o motor Blink o imprime na Página 1. | `report-header.tsx`, `consolidated-wealth-modal.tsx`, `dividend-freedom-modal.tsx`, `card-invoice-print-view.tsx`, `portfolio-snapshots-dialog.tsx`, `wealth-tear-sheet-modal.tsx`, `executive-report-document.tsx` | **Bloqueador** |
| **C2** | **Corte do valor central no Donut do Balanço 360°** (`R$ 485.000,00` virou ` $ 485.000,0`). | Violação da Regra 11 do `AGENTS.md`: aplicação de `max-w-[80px] truncate` em `centerValue` quando `size <= 112`. | `src/components/modules/reports/report-donut-chart.tsx` (linhas 68-71) | **Bloqueador** |
| **C3** | **Raios-X de Ações Brasil e Internacional vazios no Dossiê 6** (mesmo com ativos em carteira). | Em `class-breakdown.ts`, o filtro usava igualdade estrita (`cls === "acoes"`, `cls === "internacional"`) em vez dos predicados canônicos `isStockClass` e `isFiiClass`. Qualquer ativo cadastrado como `"Ações Brasil"` ou `"Internacional Global"` era sumariamente descartado. | `src/domain/portfolio/class-breakdown.ts` (linhas 498-504 e 670-676) | **Bloqueador** |
| **C4** | **Página 2 Órfã no Facilitador IRPF** (apenas 9 linhas / 129px contendo o rodapé). | Orçamento vertical de 1097px na Página 1. A soma do running header espúrio (28px) com margens folgadas empurrava o rodapé (129px) para uma 2ª folha 98,5% em branco. | `tax-facilitator-modal.tsx`, `TaxBensDireitosSection.tsx`, `TaxRendimentosSection.tsx` | **Crítico** |
| **C5** | **Tesouro IPCA+ caindo em Outras Aplicações (Código 99) no IRPF**. | `getBensDireitosClassification` testava apenas substrings na classe (`normClass.includes("renda fixa")`), falhando quando a classe vinha em maiúsculas (`FIXED_INCOME`) e sem checar o ticker (`TESOURO`). | `src/domain/portfolio/tax.ts` (linhas 86-93) | **Crítico** |
| **C6** | **Colisão textual em Custódia com saldos altos** (`10.318,93R$ 1,00`). | Coluna `Qtd` configurada com apenas `w-[6%]` (40pt de largura útil), insuficiente para números com decimais ou reserva de caixa. | `src/components/modules/reports/report-equity-class-table.tsx` (linha 40) | **Crítico** |
| **C7** | **Coluna `PM (US$)` e `COTAÇÃO (US$)` com valores em `R$`** no ativo `IVVB11`. | Se o grupo se chama `Internacional`, o cabeçalho assumia cegamente `(US$)`, mesmo para ETFs nacionais cotados em reais (`currency: "BRL"`). | `src/components/modules/reports/report-equity-class-table.tsx` (linhas 53-59) | **Moderado** |
| **C8** | **Volatilidade exibindo $\Sigma$ em vez de $\sigma$**. | O container aplicava a classe Tailwind `uppercase` (`text-transform: uppercase`), que converte o sigma grego minúsculo ($\sigma$) no glifo de somatório ($\Sigma$). | `src/components/modules/reports/performance-benchmarks-panel.tsx` (linha 182) | **Visual** |
| **C9** | **Pluralização mecânica em Proventos** (`ativo(s) autossustentável(is)`). | Strings estáticas interpoladas sem função de inflexão gramatical em pt-BR. | `src/features/reports/components/dividend-freedom-modal.tsx` (linhas 131 e 204) | **Editorial** |
| **C10** | **Coluna `DESVIO` na DRE exibindo `% do Total`** (ex.: `38,6%` sob o rótulo Desvio). | Fallback incorreto em `FinancialCompositionTables`: na ausência de `variancePct` explícito, exibia `cat.pct` (participação) sob o cabeçalho `Desvio`. | `src/features/reports/components/financial-close/FinancialCompositionTables.tsx` (linhas 77 e 104-115) | **Contábil** |

---

### 1.2 Melhorias Técnicas sobre o Plano Externo (Arbitragem de Arquitetura)

1. **Gestão de Running Headers:**
   - *Proposta Externa:* Sugeriu regras genéricas de `position: fixed` ou controle por numeração de páginas em CSS.
   - *Caminho Superior Adotado:* Como o motor de renderização é o Chromium (`window.print()` / `@media print`), o Chromium não suporta seletores CSS `@page :first` para ocultar nós DOM normais. A solução canônica e infalível é:
     - **Em documentos One-Pager (Balanço 360°, FIRE, Fatura, Snapshots, IRPF):** **Remover fisicamente** o `<ReportRunningHeader />` do JSX da página. O `ReportHeader 70/30` já identifica a folha e poupa 28px.
     - **Em documentos Multi-Páginas (DRE, Dossiê 6, Carteira 7):** Inserir `<ReportRunningHeader />` **exclusivamente dentro das seções com quebra explícita de página** (`print-break-before-page`), garantindo que apareça no topo das folhas 2+, sem nunca poluir a capa.
2. **Orientação do Extrato de Snapshots (Retrato vs. Paisagem):**
   - *Proposta Externa:* Cogitou migrar o Extrato de 26 meses para A4 Paisagem (Landscape).
   - *Caminho Superior Adotado:* **Manter A4 Retrato (Portrait)**. A auditoria de código provou que a aplicação da prop `hideCurrency` nas 5 colunas monetárias liberou 35% de largura horizontal. O relatório já foi homologado como um One-Pager de 1 página contínua em retrato (204 KB). Mudar para landscape quebraria a identidade visual da pasta executiva do investidor (onde todos os relatórios são encadernados em retrato).
3. **Equilíbrio da Carteira Mensal (Relatório 7):**
   - *Proposta Externa:* Sugeriu encolher fontes para tentar forçar tudo em 1 página.
   - *Caminho Superior Adotado:* **Arquitetura Formal de 2 Páginas Equilibradas**:
     - *Página 1 (Macro & Estratégia):* Header 70/30, 4 KPIs, Narrativa Executiva, Faixa Linear de Movimentações + **Quadro-Síntese de Alocação por Classe de Ativos** (Tabela consolidada com Classe, Saldo R$, % Carteira e Rentabilidade).
     - *Página 2 (Custódia Analítica):* Quebra explícita de página (`print-break-before-page`), `ReportRunningHeader` com micro-logo oficial Axir, todas as tabelas analíticas de custódia (`ReportClassTables`) e `ReportFooter` regulatório. Ambas as páginas operam com ~700px úteis, com harmonia visual impecável.

---

### 1.3 Achados Internos Preservados (Exclusivos da Auditoria de Código)

1. **Falha Estrutural do `display: block !important` em `globals.css`:** A auditoria interna descobriu que a regra `.print-sheet section` forçava `display: block`, destruindo o `<ReportKpiGrid columns={4} />` na impressão. Esta cura foi essencial para destravar todos os KPIs horizontais.
2. **Propriedade `hideCurrency` no Primitivo `<MoneyText />`:** Capacidade de suprimir o prefixo monetário `R$` mantendo a formatação inteira/centavos e algarismos tabulares em tabelas cujo `<thead>` já expressa `(R$)`.
3. **Reserva de Caixa tratada como Linha de Custódia:** Identificada a causa da colisão `10.318,93R$ 1,00` pela presença de quantidade fracionária e preço unitário 1,00 no mock do ledger.

---

### 1.4 Descartes / Artefatos de Mock (Não se Aplicam ao Motor de Produção)

- **Slugs crus `STOCK_BR`, `FII` no Dossiê 6:** A auditoria no repositório comprovou que o banco de dados Supabase e os contratos de produção em `src/types/` utilizam nomes canônicos (`Ações`, `Fundos Imobiliários`, `Renda Fixa`, `Internacional`). O aparecimento de slugs crus decorreu exclusivamente do script de seed de testes de estresse que inseriu chaves de banco sem passar pelo normalizador `normalizeClassName`. No entanto, como medida de defesa em profundidade, blindaremos os mappers para que, mesmo se receberem slugs crus, convertam automaticamente para o rótulo pt-BR legível.

---

## 2. Arquitetura-Alvo do Motor de Relatórios (SSOT)

A Central de Relatórios consolida-se sob a seguinte hierarquia de 4 camadas:

```
src/
├── domain/reports/                 # CAMADA 1: SSOT Matemático & Mappers Puros (Sem React/UI)
│   ├── build-tear-sheet-model.ts   # Modelos analíticos puros do Dossiê Vigente
│   ├── build-excel-workbook.ts     # Modelo da pasta de trabalho Excel
│   ├── report-mappers.ts           # Mapeamento canônico de classes, ativos e tickers
│   └── sanitize-text.ts            # Sanitização e blindagem de caracteres
│
├── components/modules/reports/     # CAMADA 2: Primitivas Visuais Compartilhadas (UI Pura)
│   ├── report-header.tsx           # Header Institucional 70/30 (AxirBrandLogo) + Running Header
│   ├── report-footer.tsx           # Rodapé Anti-Órfão (<45px), ID Criptográfico e QR Code
│   ├── report-kpi-grid.tsx         # KPI Strip em 3 ou 4 colunas sem truncamento
│   ├── report-donut-chart.tsx      # Donut SVG com auto-fit central e zero truncate
│   ├── report-stacked-bar.tsx      # Barra empilhada com separadores vetoriais de 2px
│   ├── report-risk-gauge.tsx       # Termômetro de risco segmentado
│   ├── report-class-tables.tsx     # Orquestrador de tabelas de custódia
│   ├── report-equity-class-table.tsx       # Tabela de Ações/FIIs/Intl (Qtd 9%, colgroup 100%)
│   └── performance-benchmarks-panel.tsx    # Benchmarks 5 colunas e Risco (σ protegido)
│
├── components/ui/                  # CAMADA 3: Componentes de Base do Design System
│   ├── money-text.tsx              # Formatação monetária, tabular-nums, hideCurrency e nowrap
│   └── badge.tsx                   # Badges padronizados xs/sm
│
└── features/reports/components/    # CAMADA 4: Documentos Montados (Templates A4)
    ├── consolidated-wealth-modal.tsx       # Relatório 2: Balanço 360° (One-Pager)
    ├── dividend-freedom-modal.tsx          # Relatório 4: Dossiê FIRE (One-Pager)
    ├── financial-close-report-modal.tsx    # Relatório 1: DRE Pessoal (2 Páginas Balanceadas)
    ├── tax-facilitator-modal.tsx           # Relatório 3: Facilitador IRPF (One-Pager)
    └── wealth-tear-sheet-modal.tsx         # Relatório 6: Dossiê Vigente (6 Páginas Densas)
```

### Regras Arquiteturais Inegociáveis:
1. **Regra de Execução da Moeda:** O prefixo `R$` só aparece em células de tabelas curtas (2 ou 3 colunas). Em tabelas densas ($\ge 4$ colunas), a unidade migra para o cabeçalho `(R$)` e as células utilizam `<MoneyText hideCurrency />`.
2. **Regra do Running Header:** É expressamente proibido renderizar `<ReportRunningHeader />` na Página 1 de qualquer relatório. Em One-Pagers, ele não existe no JSX; em Multi-Páginas, vive colocalizado após cada quebra física de folha (`print-break-before-page`).
3. **Regra de Blindagem Numérica:** Todos os números contábeis utilizam `font-mono tabular-nums text-right whitespace-nowrap` atrelados à cifra por espaço inquebrável (`\u00A0`).
4. **Regra Anti-Página-Órfã:** Todo documento One-Pager possui orçamento vertical estrito $\le 960\text{px}$ para garantir folga mínima de 56px antes do limite da folha física A4.

---

## 3. Plano de Execução Otimizado (Fases 43 a 50)

### Fase 1: Fundação do Motor, Primitivas & Donut (Fases 43 e 44)

#### Tarefa 43: Erradicação de Truncamento no Gráfico Donut (Regra 11 de Ouro)
- **Objetivo Visual:** Exibir o valor central de ativos no Balanço 360° (`R$ 485.000,00`) íntegro, sem corte de centavos nem reticências.
- **Objetivo Técnico:** Em `src/components/modules/reports/report-donut-chart.tsx`, remover a classe `max-w-[80px] truncate` aplicada em `centerValue`. Adotar escala tipográfica adaptativa proporcional: `text-[8.5pt]` quando `size <= 112`, com `font-mono font-bold tabular-nums tracking-tighter whitespace-nowrap`.
- **Arquivos Tocados:** `src/components/modules/reports/report-donut-chart.tsx`.
- **Definition of Done:** `RELATORIO_EXEMPLO_2_BALANCO_PATRIMONIAL_360.pdf` exibe `R$ 485.000,00` perfeitamente legível no centro da rosca patrimonial.

#### Tarefa 44: Governança Estrita de Running Headers (Remoção em One-Pagers e Injeção em Multi-Páginas)
- **Objetivo Visual:** Eliminar o cabeçalho duplo na Página 1 em todos os One-Pagers; garantir que as Páginas 2 a 6 do Dossiê Tear Sheet iniciem com o micro-logo oficial Axir e identificação de competência no topo.
- **Objetivo Técnico:**
  - *Remoção:* Retirar `<ReportRunningHeader />` do JSX de `ConsolidatedWealthModal`, `DividendFreedomModal`, `CardInvoicePrintView` e `PortfolioSnapshotsDialog`.
  - *Injeção:* Em `src/features/reports/components/tear-sheet/TearSheetCustodyAndBreakdowns.tsx`, inserir `<ReportRunningHeader />` no topo de cada seção com quebra de página: Custódia (Pág 2), Alocação Setorial (Pág 3), Raios-X 2x2 (Pág 4), Comparativo de Rentabilidade (Pág 5) e Metodologias (Pág 6).
- **Arquivos Tocados:**
  - `src/features/reports/components/consolidated-wealth-modal.tsx`
  - `src/features/reports/components/dividend-freedom-modal.tsx`
  - `src/components/modules/card-invoice-print-view.tsx`
  - `src/features/investments/components/portfolio-snapshots-dialog.tsx`
  - `src/features/reports/components/wealth-tear-sheet-modal.tsx`
  - `src/features/reports/components/tear-sheet/TearSheetCustodyAndBreakdowns.tsx`
- **Definition of Done:** Zero relatórios apresentam running header na Página 1; 100% das páginas 2 a 6 do Dossiê apresentam running header institucional com micro-logo oficial.

---

### Fase 2: Integridade de Mappers, Classificação Fiscal e Tabelas (Fases 45 e 47)

#### Tarefa 45: Orçamento de Altura e Conquista do One-Pager no Facilitador Fiscal IRPF
- **Objetivo Visual:** Consolidar o Facilitador Fiscal IRPF em **1 página física única**, eliminando a folha 2 órfã que continha apenas o rodapé e disclaimer.
- **Objetivo Técnico:**
  - Em `tax-facilitator-modal.tsx`, remover `<ReportRunningHeader />` da Página 1 (economia de 28px).
  - Em `TaxBensDireitosSection.tsx`, reduzir o espaçamento entre grupos para `print:gap-1.5` e padding de células para `print:py-0.5 print:px-1.5`.
  - Em `TaxRendimentosSection.tsx`, compactar padding de células para `print:py-0.5 print:px-2`.
  - Em `src/domain/portfolio/tax.ts`, corrigir `getBensDireitosClassification` para testar `isFixedIncomeClass(assetClass) || upperTicker.startsWith("TESOURO") || upperTicker.includes("IPCA") || upperTicker.includes("SELIC")`, classificando Tesouro Direto infalivelmente no `Grupo 04 - Código 02`.
- **Arquivos Tocados:**
  - `src/features/reports/components/tax-facilitator-modal.tsx`
  - `src/features/reports/components/tax-facilitator/TaxBensDireitosSection.tsx`
  - `src/features/reports/components/tax-facilitator/TaxRendimentosSection.tsx`
  - `src/domain/portfolio/tax.ts`
  - `src/domain/portfolio/tax.test.ts`
- **Definition of Done:** `RELATORIO_EXEMPLO_3_FACILITADOR_IRPF.pdf` tem exatamente 1 página física (altura útil $\le 940\text{px}$) e Tesouro IPCA+ é classificado sob o Código 02.

#### Tarefa 47: Recalibração de Colunas e Sensibilidade de Moeda em Custódia
- **Objetivo Visual:** Erradicar a colisão entre quantidade e preço médio (`10.318,93R$ 1,00`) e evitar rótulo `PM (US$)` para ativos em BRL como `IVVB11`.
- **Objetivo Técnico:**
  - Em `src/components/modules/reports/report-equity-class-table.tsx`:
    - Recalibrar o `<colgroup>`: `Ticker: 12%`, `Setor: 15%`, **`Qtd: 9%`** (expansão de 50%), `PM: 12%`, `Cotação: 12%`, `Total: 16%`, `Var. Cota: 12%`, `Ret. Total: 12%`.
    - Ajustar o rótulo de cabeçalho: só exibir `PM (US$)` e `Cotação (US$)` se **todos** os ativos daquele grupo possuírem `currency === "USD"`. Se houver ativos em reais (`IVVB11`, BDRs), rotular de forma neutra como `Preço Médio` e `Cotação`, exibindo o símbolo monetário nativo na célula via `<MoneyText currency={item.currency} />`.
- **Arquivos Tocados:**
  - `src/components/modules/reports/report-equity-class-table.tsx`
- **Definition of Done:** Espaço livre mínimo de 8px entre quantidade e preço médio em ativos de alta densidade; `IVVB11` exibido sob cabeçalho neutro sem falsas moedas.

---

### Fase 3: Equilíbrio Editorial da Carteira Mensal e DRE Pessoal (Fases 46 e 48)

#### Tarefa 46: Arquitetura Editorial de 2 Páginas Equilibradas na Carteira Mensal
- **Objetivo Visual:** Transformar a Carteira Mensal em um relatório equilibrado de 2 páginas (Página 1: Macro/Estratégia; Página 2: Custódia Analítica Completa), eliminando a Página 2 vazia.
- **Objetivo Técnico:**
  - Em `src/features/investments/components/executive-report/executive-report-document.tsx`:
    - *Página 1:* Manter `ReportHeader`, 4 KPIs, Narrativa Executiva, Faixa de Movimentações (`ReportMonthlyMovements`) e adicionar o **Quadro-Síntese de Alocação por Classe de Ativos** (tabela compacta de classes com colunas Classe, Saldo R$, % Carteira e Rentabilidade).
    - *Página 2:* Inserir quebra controlada `div className="print-break-before-page print:break-before-page"` contendo `<ReportRunningHeader title="Relatório Executivo da Carteira" periodLabel={periodLabel} />`, seguido por `ReportClassTables` e `ReportFooter`.
- **Arquivos Tocados:**
  - `src/features/investments/components/executive-report/executive-report-document.tsx`
- **Definition of Done:** Ambas as páginas possuem densidade equilibrada (~700px cada); a Página 2 começa com o running header e o micro-logo oficial Axir.

#### Tarefa 48: Saneamento de Truncamento em KPIs, Coluna de Desvio e Pluralização
- **Objetivo Visual:** Zero reticências no KPI da DRE (`RESULTADO OPERACIONAL`), cálculo correto do desvio orçamentário e linguagem natural sem `(s)/(is)`.
- **Objetivo Técnico:**
  - Em `FinancialCloseSummary.tsx`, alterar o rótulo do 3º KPI para `"RES. OPERACIONAL"` com tipografia `text-[7pt] tracking-wider uppercase font-bold`.
  - Em `FinancialCompositionTables.tsx`:
    - Calcular o desvio orçamentário real: `hasBudgets && hasLimit ? ((realizado - orçado) / orçado) * 100 : cat.pct`.
    - Se for desvio, exibir com sinal explícito (`+2,5%` em vermelho quando estourar, `-1,4%` em verde quando economizar).
    - Aplicar `hideCurrency` nas colunas `Orçado (R$)` e `Realizado (R$)`.
  - Em `dividend-freedom-modal.tsx`: substituir `ativo(s) autossustentável(is)` por função gramatical: `${count === 1 ? "1 ativo autossustentável" : `${count} ativos autossustentáveis`}`.
  - Em `performance-benchmarks-panel.tsx`: proteger o sigma minúsculo: `<span className="uppercase">Volatilidade</span> (<span className="normal-case">σ</span>)`.
- **Arquivos Tocados:**
  - `src/features/reports/components/financial-close/FinancialCloseSummary.tsx`
  - `src/features/reports/components/financial-close/FinancialCompositionTables.tsx`
  - `src/features/reports/components/dividend-freedom-modal.tsx`
  - `src/components/modules/reports/performance-benchmarks-panel.tsx`
- **Definition of Done:** Zero reticências nos KPIs da DRE; desvios contábeis matematicamente exatos; glifo $\sigma$ minúsculo preservado; pluralização natural.

---

### Fase 4: Desbloqueio dos Raios-X no Dossiê e Defesa em Profundidade (Fase 49)

#### Tarefa 49: Predicados Canônicos no Motor de Exposição (`class-breakdown.ts`)
- **Objetivo Visual:** Restaurar a exibição completa dos 4 cards de Raios-X no Dossiê da Posição Vigente (Ações Brasil, FIIs, Renda Fixa e Internacional), eliminando o falso estado vazio.
- **Objetivo Técnico:** Em `src/domain/portfolio/class-breakdown.ts`, substituir comparações de igualdade estrita (`cls === "acoes"`, `cls === "fiis"`, `cls === "internacional"`) pelos predicados canônicos do domínio:
  - Para ações: `isStockClass(p.assetClass) || cls.includes("acao") || cls.includes("stock")`.
  - Para FIIs: `isFiiClass(p.assetClass) || cls.includes("fii") || cls.includes("imobiliari")`.
  - Para Internacional: `cls.includes("internacional") || cls.includes("global") || cls.includes("bdr") || cls.includes("usd")`.
  - Para Renda Fixa: `isFixedIncomeClass(p.assetClass)`.
- **Arquivos Tocados:**
  - `src/domain/portfolio/class-breakdown.ts`
  - `src/domain/portfolio/class-breakdown.test.ts`
- **Definition of Done:** Todos os 4 cards de Raios-X renderizam gráficos de barras e tabelas ricas no Dossiê 6 para qualquer carteira com posições ativas.

---

### Fase 5: QA Automatizado, Re-geração dos 8 PDFs e Build 95 (Fase 50)

#### Tarefa 50: Homologação Completa, Amostras Físicas e Versionamento
- **Objetivo Técnico:**
  - Execução da suíte completa de testes: `npx vitest run src/domain/ src/features/reports/ src/components/modules/reports/`.
  - Verificação de tipos (`npx tsc -b`) e linting (`npm run lint`).
  - Re-geração física dos 8 PDFs A4 e PNGs de visualização em alta resolução no diretório de artefatos.
  - Atualização do manifesto `public/releases/version.json` para o **Build 95 (v3.14.0)**.
  - Atualização do [ROADMAP.md](file:///home/gabrielsales/meus_apps/financasnew/docs/roadmap/ROADMAP.md) e [PLANO_AUDITORIA_UIUX_MODAIS_E_PADRAO_EDITORIAL.md](file:///home/gabrielsales/meus_apps/financasnew/docs/plans/PLANO_AUDITORIA_UIUX_MODAIS_E_PADRAO_EDITORIAL.md).
- **Arquivos Tocados:**
  - `public/releases/version.json`
  - `docs/roadmap/ROADMAP.md`
  - `docs/plans/PLANO_AUDITORIA_UIUX_MODAIS_E_PADRAO_EDITORIAL.md`
  - Artefatos de PDF e PNG gerados.
- **Definition of Done:** 8 relatórios físicos gerados com nota visual $\ge 9,6/10$, suíte 100% verde, build compilado e commit/push realizados.

---

## 4. Protocolo de QA e Testes de Estresse

A homologação final do Bloco 7 exigirá a aprovação em **5 testes de estresse com inspeção automática por scripts**:

```
[TESTE 1: MAGNITUDE NUMÉRICA (7 DÍGITOS)]
• Cenário: Ativo de R$ 1.485.320,75 no Donut do Balanço 360°, no Extrato e na Custódia.
• Critério: Zero cortes de centavos; zero colisão com colunas vizinhas; tabular-nums perfeito.

[TESTE 2: DENSIDADE & TRANSIÇÃO DE PÁGINA]
• Cenário: Carteira com 25+ ativos e 24+ meses de histórico.
• Critério: Running Header aparece EXCLUSIVAMENTE nas páginas 2+; thead repete nas quebras; zero rodapés órfãos; zero páginas com menos de 20% de conteúdo útil.

[TESTE 3: BLINDAGEM DE MOEDA & INTERNACIONAL]
• Cenário: Carteira com IVVB11 (BRL) e VOO (USD).
• Critério: IVVB11 exibe R$; VOO exibe US$; cabeçalho não assume USD genericamente para ativos negociados na B3.

[TESTE 4: HIGIENE TIPOGRÁFICA & REGRAS DE OURO]
• Script de inspeção de texto buscando regex proibidos:
  - Reticências em KPIs: /\b[A-Z\s]{4,}\.\.\./
  - Slugs crus em tabelas: /STOCK_|FIXED_|FII_/
  - Pluralização mecânica: /\(s\)|\(is\)|\(es\)/
  - Espaços anômalos em números: /\d+\s,\s\d+/
  - Ponto decimal em porcentagens pt-BR: /\b\d+\.\d+%/
• Critério: Zero ocorrências encontradas.

[TESTE 5: CLASSIFICAÇÃO FISCAL RECEITA FEDERAL]
• Cenário: Bens e Direitos com Ações, FIIs e Tesouro IPCA+.
• Critério: Ações -> Grupo 03 Código 01; FIIs -> Grupo 07 Código 03; Tesouro Direto -> Grupo 04 Código 02 (nunca Código 99).
```
