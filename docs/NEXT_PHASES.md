# 🧭 NEXT_PHASES.md — Proposta de Novas Fases do Roadmap

> **Status:** v1.0 — proposta oficial elaborada após auditoria completa da base de código (2026-08-15).
> Objetivos estratégicos:
> **1. Refinamento Máximo de UI/UX & Conforto Visual (Prioridade Principal)** — elevar usabilidade, fluidez, micro-interações, consistência de Design System e ergonomia em desktop e mobile.
> **2. Módulo de Carteira de Investimentos completo e integrado** — tirar o placeholder da Home do papel e entregar o ecossistema de investimentos.
>
> **As fases F14–F18 foram inseridas formalmente no `ROADMAP.md` §3 (2026-08-15)** com as decisões **default** de P1–P6 aplicadas (§4 abaixo); este documento permanece como fonte de detalhes, critérios de aceite e perguntas de alinhamento. Qualquer revisão de P1–P6 é ajustada em ambos os documentos.

---

## 1. DIAGNÓSTICO CONSOLIDADO

### 1.1 O que JÁ EXISTE (não reconstruir — evoluir)

**Módulo de Carteira — Fase 4 concluída e funcional:**

| Camada | Entregue |
|---|---|
| Banco | `portfolio_assets`, `portfolio_transactions` (buy/sell/dividend/jcp/fii_yield/split/reverse_split/subscription), `allocation_targets`, `class_targets`, `sector_targets`, `asset_prices` (cache global + override manual) |
| Domínio puro | `domain/portfolio` (65 testes): ledger com custo médio/caixa derivado/proventos, valoração (manual → cache → fallback), metas com soma ≤ 100%, calculadora de aporte em 2 modos, travas setoriais |
| Estado | `usePortfolioPosition()` → `totalBRL`, `cashBRL`, `rows[]` com `averageCost`, `dividends`, `valueBRL`, `pct`, `source`; `useAssetPrices` (override manual) |
| Telas | `/carteira` com 3 abas (Posição / Metas / Aporte), `PositionTable`, `TargetEditor`, `AporteResult` |
| Cotações | Edge function `supabase/functions/quotes/` (F1.7, Yahoo em cascata + guardrail de spike) — deploy/cron pendentes de execução |

**UI/UX — Design System maduro (F10–F13):** 3 temas × 6 acentos com contraste AA auditado; `MoneyText` (hero/value/caption); `NumberTicker`; `Sparkline`; skeletons por contexto (`SkeletonList/Kpi/Chart/Table`); `EmptyState` com tons; micro-interações (ripple, spring, haptics, swipe-to-action, densidade, privacidade com tecla P, calculadora flutuante); axe em 10 telas P0; zero elementos nativos (primitivos próprios).

### 1.2 Placeholders / stubs de Investimentos (o que preencher)

| # | Local | Estado atual | O que deve virar |
|---|---|---|---|
| 1 | `src/features/overview/pages/overview-page.tsx` (KPI "Investimentos") | `<KpiCard ... cents={totals.investmentCents} hint="Carteira na Fase 4" />` — e `computeOverview(..., 0)` **sempre passa 0** | KPI real com `usePortfolioPosition().totalBRL` + mini-alocação por classe |
| 2 | Home — sem widget de carteira | Só o KPI stub | Card "Carteira em resumo" (patrimônio, caixa, nº ativos, donut de alocação) |
| 3 | `/carteira` — sem rentabilidade | `PositionTable` mostra preço/custo médio/valor, mas **não compara** `averageCost × priceBRL` | Colunas Lucro/Prejuízo não realizado e Rentabilidade % |
| 4 | Sem dashboard de investimentos | Só a tela operacional `/carteira` | Nova tela `/investments` (visão executiva) ou evolução da atual |
| 5 | Sem gráficos de alocação | `CategoryDonut` existe (categorias de despesa) — nada para ativos | Donut por classe de ativo e por ticker |
| 6 | Sem extrato de proventos | Ledger calcula `dividends` por ativo, mas **não há tela** | Extrato/calendário de proventos recebidos e provisionados |

### 1.3 Oportunidades de refinamento UI/UX (observadas na auditoria)

1. **Skeleton da carteira genérico** — `PositionTab` usa `Skeleton className="h-24 w-full"` / `h-48 w-full`; a F12 padronizou `SkeletonKpi/SkeletonTable` na Overview/Transações mas **não na carteira**. Inconsistência clara.
2. **Estado vazio rico** — `PositionTab` usa `EmptyState` padrão; dá para enriquecer com tom por contexto e CTA multi-ação (como feito nas demais telas).
3. **Hierarquia de dados na Posição** — sem destaque de rentabilidade; valores de patrimônio não têm comparativo (ex.: vs. mês anterior).
4. **Micro-interações pontuais** — feedback de conclusão de escrita (check animado) existe em algumas ações; falta uniformizar em transações de carteira.
5. **Mobile/a11y** — `inputMode="decimal"` só em `TargetEditor`; o formulário de transação da carteira (`TransactionFormDialog`) deve auditar teclado numérico (quantidade/preço), alvos de toque ≥ 44px e foco visível.
6. **Transições** — entradas/saídas de abas e rotas já existem (150ms), mas cards de valor não têm micro-transição de mudança (NumberTicker já cobre KPIs; estender à tabela de posição é opcional).
7. **Consistência de densidade** — `DataList` suporta densidade; `PositionTable`/`ReportTable` herdam? Validar propagação do toggle de densidade para a carteira.

---

## 2. TRILHA A — REFINAMENTO UI/UX & CONFORTO VISUAL (PRIORITÁRIA)

> Princípios: **evoluir, não reconstruir** — reutilizar primitivos existentes (`components/ui`, `components/modules`), sem libs novas de animação (Decisão A mantida), respeitando `prefers-reduced-motion`/`data-motion` e contraste AA.

### Fase 14 — Consistência de Estados & Ergonomia de Dados

**Objetivo:** eliminar as inconsistências de loading/vazio/erro da carteira e elevar a leitura rápida de dados financeiros.

**Entregas:**
1. **Skeletons por contexto na carteira** — substituir os blocos genéricos de `PositionTab` por `SkeletonKpi` (3 KPIs) + `SkeletonTable` (linhas da PositionTable) — zero Layout Shift.
2. **Empty states ricos** — `PositionTab`, `TargetsTab` e `AporteTab` com `EmptyState` por contexto (tom primary/portfolio) e CTA multi-ação (adicionar ativo / registrar transação).
3. **Rentabilidade na Posição** — novas colunas/estatísticas derivadas no domínio: `unrealizedPnl` (valor − custo), `unrealizedPct` (÷ custo), exibidas com `MoneyText` + tom semântico (positive/negative) — **lógica pura em `domain/portfolio` com testes**, UI só recebe valores (regra de ouro).
4. **Hierarquia de patrimônio** — KPI "Patrimônio total" com comparativo (Δ vs. mês anterior via série mensal derivada) usando o padrão `DeltaHint` da Overview.
5. **Densidade & teclado** — propagar o toggle de densidade à `PositionTable`; audit `inputMode` (numeric/decimal) nos formulários de ativo/transação; alvos de toque ≥ 44px em ações de linha.

**Arquivos:** `src/domain/portfolio/` (+ testes) · `src/features/portfolio/pages/position-tab.tsx` · `src/components/modules/position-table.tsx` · `src/features/portfolio/components/transaction-form-dialog.tsx` · `src/features/portfolio/components/asset-form-dialog.tsx`.

**✅ DoD (critérios de aceite):**
- `PositionTab` sem blocos `h-24`/`h-48` genéricos — skeletons por contexto em todas as abas.
- Rentabilidade (não realizada e %) calculada em `domain/portfolio` (função pura) com testes de reconciliação (ex.: compra 10 × 100 → preço 120 ⇒ +R$ 200 / +20%).
- Colunas de lucro/prejuízo com tom semântico correto (negativo nunca vira "R$ 0,00" — `MoneyText`).
- `inputMode` correto em todos os campos numéricos da carteira; axe sem violações nas 3 abas.
- Suíte 100% verde; revisão desktop + mobile nos 3 temas.

### Fase 15 — Micro-Interações, Feedback & Conforto Visual

**Objetivo:** elevar a sensação de acabamento nas telas financeiras com micro-interações de feedback e leitura confortável.

**Entregas:**
1. **Feedback de escrita uniforme** — check animado após concluir transações da carteira (registrar compra/venda/provento, definir meta) — mesmo padrão das ações de conclusão existentes.
2. **Transições de dados** — estender `NumberTicker` aos valores dinâmicos da Posição (patrimônio/rentabilidade ao trocar dados) respeitando o toggle "Contagem Numérica Animada".
3. **Hover/focus refinados** — linhas da `PositionTable` com hover elevado e `focus-visible` ring (padrão `Card interactive`); destaque do ticker com preço manual ("informado manualmente") já existente — manter.
4. **Cards de investimento na Home** — micro-transição de entrada (fade + slide sutil, já existente nas rotas) ao montar o widget de carteira.
5. **Conforto visual** — revisar densidade do dashboard (KPIs, cards de resumo), respiro vertical (`gap`) e contraste de rótulos secundários nas telas de carteira.

**Arquivos:** `src/components/modules/position-table.tsx` · `src/components/modules/kpi-card.tsx` (reuso) · `src/features/overview/pages/overview-page.tsx` · `src/components/ui/number-ticker.tsx` (reuso).

**✅ DoD:**
- Toda ação de escrita da carteira com feedback visual/háptico; `prefers-reduced-motion`/`data-motion` respeitados.
- NumberTicker ativo nos valores principais da posição quando habilitado; desliga sem quebra de layout.
- Hover/focus unificados (mesma linguagem das demais telas — zero classes soltas novas).
- Suíte 100% verde; auditoria axe na carteira sem violações.

---

## 3. TRILHA B — MÓDULO DE CARTEIRA DE INVESTIMENTOS (INTEGRAÇÃO COMPLETA)

> Base: Fase 4 já entregou ledger, valoração, metas e calculadora. A Trilha B **integra a carteira ao restante do app** e entrega o dashboard executivo. **Backend:** sem migrations novas para 90% do escopo — `portfolio_transactions` já suporta proventos e a posição é derivada; modelagem extra apenas para "proventos provisionados" (§3.3).

### Fase 16 — Carteira na Home (KPI real + widget de alocação)

**Objetivo:** eliminar o stub "Carteira na Fase 4" e dar visibilidade imediata do investimento no Início.

**Entregas:**
1. **KPI "Investimentos" real** — `usePortfolioPosition().totalBRL` no lugar de `totals.investmentCents` (0); sparkline de patrimônio (série mensal derivada, F8 padrão) e hint contextual (nº de ativos / fonte dos preços).
2. **Widget "Carteira em resumo"** na Home (gated por `dashboardWidgets` — F11): patrimônio total, caixa derivado, nº de ativos e **mini-donut de alocação por classe** (reuso do padrão `CategoryDonut` → novo módulo `AllocationDonut` genérico de ativos).
3. **Deep-link** — clique no KPI/widget → `/investments` (ou `/carteira`).
4. **Estados** — loading (SkeletonKpi), vazio (EmptyState "Sem investimentos" com CTA "Adicionar ativo" → wizard/`/carteira`), erro (gateway + retry) — Online First.

**Arquivos:** `src/features/overview/pages/overview-page.tsx` · `src/components/modules/allocation-donut.tsx` (novo) · `src/domain/overview` (extensão pura p/ série de patrimônio, + testes).

**✅ DoD:**
- Nenhum texto "Fase 4"/stub de carteira na Home — KPI com valor real e estados completos.
- Donut de alocação por classe com paleta da marca (AA) e legenda acessível; axe sem violações.
- Série de patrimônio (para sparkline) é função pura testada (derivada do ledger + preços).
- Widget respeita a modulação do dashboard (Configurações > Dashboard).

### Fase 17 — Dashboard de Investimentos (`/investments`)

**Objetivo:** visão executiva da carteira com gráficos, rentabilidade e posições — tela de leitura, separada da operação (`/carteira` mantém cadastro/metas/aporte).

**Entregas:**
1. **Rota `/investments`** — nova página no `appRoutes` + item de navegação (nav-items; slot no menu "Mais" se necessário).
2. **KPIs executivos** — Patrimônio Total, Rentabilidade da Carteira (ponderada pelo valor, derivada dos unrealizedPct por ativo), Proventos no mês (recebidos) e Alocação por Classe (top classes).
3. **Gráfico de distribuição patrimonial** — donut/rosca **por classe de ativo** e **por ticker** (SVG próprio, padrão `CategoryDonut` — sem libs novas).
4. **Tabela de posições avançada** — PM (custo médio), quantidade, valor de mercado, **Lucro/Prejuízo não realizado (R$ e %)**, fonte do preço (manual/api/fallback com badge) e peso na carteira — com ordenação e densidade.
5. **Acessos rápidos** — botões para ir a `/carteira` (registrar transação, metas, aporte).

**Arquivos:** `src/features/investments/` (novo — `pages/`, `components/`, `index.ts` seguindo o padrão de feature do `PROJECT_STRUCTURE.md` §5) · `src/app/routes.ts` · `src/components/layout/nav-items.tsx` · `src/domain/portfolio` (motores de agregados puros + testes).

**✅ DoD:**
- `/investments` com KPIs, 2 donuts (classe e ticker), tabela com lucro/prejuízo e rentabilidade — todos derivados no domínio (funções puras testadas).
- Deep-link da Home chega à tela correta; navegação (sidebar/bottom/menu Mais) consistente — sem rotas duplicadas (fonte única `nav-items`).
- Estados loading/vazio/erro completos; axe sem violações; 3 temas × acentos consistentes.
- Suíte 100% verde (incl. testes dos motores de agregado).

### Fase 18 — Proventos: Extrato, Calendário & Provisionados

**Objetivo:** dar visibilidade total dos rendimentos da carteira — recebidos e esperados.

**Entregas:**
1. **Extrato de proventos recebidos** — agregação de `portfolio_transactions` (`dividend`/`jcp`/`fii_yield`) por mês e por ativo (o ledger já separa `dividends`); lista com valores, datas e totais.
2. **Calendário de proventos** — visão mensal (reuso de `MonthPicker` + lista ordenada); destaque do mês atual.
3. **Proventos provisionados (modelagem)** — decisão de escopo: estimativa por histórico (ex.: média dos últimos 3 meses por ativo) ou campo opcional de provento futuro no ativo. **Requere migration nova** (ex.: coluna `projected_dividend_monthly` em `portfolio_assets` ou tabela `dividend_schedule`) — **sujeito ao §4-P4**.
4. **Integração com o app** — opcional: proventos recebidos aparecerem como renda [PROVENTO] no fluxo financeiro (decisão §4-P5; fora do fluxo financeiro core hoje).

**Arquivos:** `src/domain/portfolio/dividends.ts` (motor puro + testes) · `src/features/investments/` (aba "Proventos") · migration condicional (§4-P4).

**✅ DoD:**
- Extrato mensal correto (soma por mês = transações de provento, reconciliado por teste).
- Calendário com navegação mensal e estado vazio acolhedor.
- Provisionados (se aprovado): estimativa/marcação explícita na UI com rótulo "provisionado" e fonte dos dados.
- Suíte 100% verde; axe sem violações.

---

## 4. PERGUNTAS DE ALINHAMENTO TÉCNICO

> Respostas definem detalhes das fases 16–18 antes da inserção no ROADMAP.

| # | Pergunta | Opções | Impacto |
|---|---|---|---|
| P1 | **Cotações:** a edge function (F1.7, Yahoo) + preço manual já cobrem a valoração. Manter esse pipeline como fonte primária? | a) Sim — edge function + manual (recomendado) · b) Só manual | Determina se F1.7 (deploy/cron) é pré-requisito da F16 |
| P2 | **Gráficos:** o projeto usa SVG próprio (`Sparkline`, `CategoryDonut`, `DailyFlowChart`) sem libs. Manter SVG próprio no dashboard de investimentos ou adotar lib (ex.: Recharts)? | a) SVG próprio (recomendado — DRY, zero bundle) · b) Recharts/visx | Define o padrão dos donuts da F16/17 |
| P3 | **Rota:** `/investments` como tela nova de leitura, mantendo `/carteira` para operação (cadastro/metas/aporte)? | a) Nova `/investments` (recomendado) · b) Unificar tudo em `/carteira` | Define arquitetura da F17 e navegação |
| P4 | **Proventos provisionados (F18):** modelar estimativa no banco (migration) ou apenas exibir recebidos? | a) Apenas recebidos (escopo mínimo) · b) Estimar por histórico (sem migration) · c) Campo/tabela de provisionados (migration) | Define se há migration nova e o escopo da F18 |
| P5 | **Integração financeira:** proventos recebidos devem entrar como renda no fluxo mensal (Home/Relatórios)? | a) Sim, lançamento automático [PROVENTO] · b) Não, ficam só na carteira (recomendado — fora do fluxo financeiro core, D11 preservado) | Escopo e RPCs envolvidos |
| P6 | **Prioridade de execução:** trilha A (F14–15) antes da B (F16–18)? | a) Sim, A primeiro (conforme estratégia) · b) Intercalar (ex.: F14 → F16 → F15 → …) | Ordem das fases no ROADMAP |

---

## 5. ORDEM SUGERIDA E MAPEAMENTO

```
F14 (Consistência de Estados & Ergonomia)  ← Trilha A — PRIORITÁRIA
F15 (Micro-Interações & Conforto Visual)   ← Trilha A
F16 (Carteira na Home — KPI real)          ← Trilha B — depende de P1
F17 (Dashboard /investments)               ← Trilha B — depende de P2/P3
F18 (Proventos)                            ← Trilha B — depende de P4/P5
```

**Pré-requisitos transversais:** suíte 837 testes verde + typecheck/lint/build (CI `ci.yml`) · deploy F1.7 (edge function + cron) se P1 = (a) · sem migrations obrigatórias fora de P4 = (c).

**Referências:** `docs/ROADMAP.md` (F0–F13) · `docs/ARCHITECTURE.md` (camadas) · `docs/PROJECT_STRUCTURE.md` (onde criar) · `docs/DESIGN_SYSTEM.md` (visual) · `docs/RELEASE.md` (QA/corte).
