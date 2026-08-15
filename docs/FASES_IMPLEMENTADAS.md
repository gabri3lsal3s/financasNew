# FASES_IMPLEMENTADAS.md — Resumo de Implementação (F0–F29)

> **Objetivo deste documento:** registro resumido de **cada fase de implementação** do projeto — o **problema** que motivou a fase e a **solução** implementada. Detalhe completo (entregas, DoD, arquivos) em `docs/ROADMAP.md` (§3); a ordem de execução e o status estão em `ROADMAP.md` §6.1.
>
> **Status atual (2026-08-15):** fases **F0–F29 concluídas** · suíte **1087 testes / 140 arquivos** · typecheck/lint/build limpos · deploy funcional (Vercel + Supabase).

## Visão geral

| Fase | Título | Trilha | Problema (resumo) |
|---|---|---|---|
| F0 | Fundação & Design System | Base | Projeto do zero, sem base técnica nem visual |
| F1 | Infraestrutura de Dados & Autenticação | Base | Dados seguros, atômicos e auditáveis (Online First) |
| F2 | Core de Finanças Pessoais | Base | CRUDs financeiros complexos (parcelas, faturas, dívidas…) |
| F3 | Análise, Projeção & Corte de Gastos | Base | Sem inteligência sobre os dados |
| F4 | Carteira & Rebalanceamento | Base | Sem posição confiável nem calculadora de aporte |
| F5 | Experiência Transversal | Base | Falta de busca, a11y, performance, empty states e PWA polish |
| F6 | Hardening & Lançamento | Base | Garantir confiança, segurança e produção |
| F7 | Ergonomia de Navegação & Header Adaptativo | Base | Navegação mobile/desktop não otimizada |
| F8 | Refinamento Visual Premium & Dashboard de Insights | Base | Visual "genérico"; Visão Geral sem inteligência contextual |
| F9 | Utilitários Nativos | Base | Lançamentos lentos; navegação longa sem atalhos |
| F10 | Identidade Visual Oficial "Guia Financeiro" | Base | App sem marca; temas genéricos |
| F11 | Centro de Personalização & Micro-Interações | Base | Experiência uniforme para todos os usuários |
| F12 | Polimento de UI/UX, Design System & Visual | Base | Acabamento inconsistente (skeletons, moeda, superfícies) |
| F13 | Hotfixes Mobile & Consistência | Base | Layout mobile quebrado; sem edição de despesas |
| F14 | Consistência de Estados & Ergonomia de Dados | A · UI/UX | Carteira com estados genéricos e sem rentabilidade |
| F15 | Micro-Interações & Conforto Visual | A · UI/UX | Falta feedback e acabamento nas telas financeiras |
| F16 | Carteira na Home (KPI real) | B · Investimentos | KPI de investimentos era stub (valor 0) |
| F17 | Dashboard `/investments` | B · Investimentos | Sem visão executiva da carteira |
| F18 | Proventos: Extrato & Calendário | B · Investimentos | Proventos calculados, mas sem tela |
| F19 | Inteligência & Consistência dos Insights | A · Inteligência | Insights com repetições e inconsistências |
| F20 | Swipe Navigation & Gesture UX | A · Gestos | Navegação por gesto sem rigor (falsos positivos) |
| F21 | Inteligência de Entrada & Automações Preditivas | C · Inteligência | Lançamento manual demorado e repetitivo |
| F22 | Exportação, Backup & Fechamento Mensal | C · Dados | Dados presos no app; sem portabilidade |
| F23 | Performance & Code-Splitting 3D | C · Infra | Carregamento inicial pesado |
| F24 | Planejamento Financeiro & Simulador FIRE | C · Estratégia | Sem visão de longo prazo (independência financeira) |
| F25 | Micro-interações, Feedback Visual & Ergonomia | A · UI/UX | Controles nativos do browser e modais rígidos no mobile |
| F26 | Pull-up Overscroll to Top | A · Gestos | Botão flutuante scroll-to-top poluía o mobile |
| F27 | Insights: Precisão, Deduplicação & Casos de Borda | A · Inteligência | Desafios imprecisos; recomendações duplicadas |
| F28 | Investimentos Mobile Responsive | A · Mobile | Hub de investimentos bagunçado no mobile |

---

## F0 — Fundação & Design System

- **Problema:** repositório começando do zero — nenhuma base técnica, visual ou de componentes; qualquer tela exigiria primitivos consistentes antes.
- **Solução:** Vite + React + TypeScript estrito com CI (typecheck/lint/testes); **tokens dos 3 temas** (light/dark/oled) com toggle e persistência; **biblioteca de primitivos** `components/ui` (Button, Input, MoneyInput, Select, Modal, Tabs, DataList, Command/⌘K, Toast…); shell de navegação (Sidebar + BottomNav + PageShell) com deep-links; **PWA base** (manifest, service worker, offline).

## F1 — Infraestrutura de Dados & Autenticação

- **Problema:** app Online First precisa de dados seguros, atômicos e auditáveis, com autenticação e contratos claros.
- **Solução:** projeto Supabase com **schema completo** (19 tabelas + constraints: parcelas 1–60, peso 0–1, soma de metas ≤ 100%) e migrations versionadas; **RLS por `auth.uid()`** em todas as tabelas + `audit_events` imutável; **10 RPCs transacionais** com validação de invariantes no servidor (escritas compostas nunca orquestradas no cliente); gateway de erros pt-BR; telas de auth + guard de rota; **edge function de cotações** (Yahoo em cascata + guardrail de spike) com scripts de deploy/cron. Storage (R2) **removido do escopo** (decisão do usuário).

## F2 — Core de Finanças Pessoais

- **Problema:** CRUDs financeiros com regras complexas (parcelamento, competência de fatura, status derivado de dívida, estorno, herança de orçamentos) — sem fidelidade à spec.
- **Solução:** **domínio puro primeiro** (centavos, parcelamento exato, competência com overrides, status de dívida nunca armazenado, peso de relatório); wizard de lançamento em 4 passos (tela cheia, navegável por teclado); parcelamento 1–60× com exclusão em 3 modos via RPC em cascata; cartões com **estorno → renda automática** e seleção automática de mês; dívidas com quitação e recebimento integrado; categorias com sugestão inteligente e migração na exclusão; orçamentos com herança e **realocação atômica**; Visão Consolidada (Overview) com KPIs, saldo líquido de contas e fluxo diário.

## F3 — Análise, Projeção & Corte de Gastos

- **Problema:** os dados existiam, mas o app não os transformava em inteligência (alertas, assinaturas, projeções, relatórios, lembretes).
- **Solução:** motores puros testados — **insights** (alertas priorizados 1–6, assinaturas com 3 sinais + tiers, recorrências em 3 níveis, confiança + **aprendizado ignorar/confirmar/restaurar persistido**, diagnósticos); **economia** (desafios 10/20/30% com limite mínimo dinâmico + sugestões de limite); **projeção** (gasto diário, ritmo, fim de mês, pendências — determinística); **relatórios** (categoria/forma/dia da semana, período custom ≤ 366 dias, merge de dívidas pagas); **lembretes** in-app com snooze com expiração. Telas: Insights, Relatórios, Lembretes.

## F4 — Carteira & Rebalanceamento

- **Problema:** nenhuma posição confiável de investimentos (custo médio, caixa) nem calculadora de aporte/rebalanceamento.
- **Solução:** **ledger derivado** (custo médio, caixa nunca armazenado, splits/proventos — reconciliado com exemplos manuais); **valoração** com pipeline preço manual → cache → fallback + **guardrail de spike** (>50% em 1 dia mantém o último preço); **metas** por ativo/classe com soma ≤ 100% (bloqueada na UI **e** no banco via RPC em lote) + **travas setoriais**; **calculadora de aporte** em 2 modos (meta individual / por classe) com log de roteamento, quantidades inteiras e sobra para caixa.

## F5 — Experiência Transversal

- **Problema:** faltavam busca, acessibilidade, performance, empty states e polimento PWA — o app funcionava, mas não estava "redondo".
- **Solução:** **busca global ⌘K** com scoring, recência e deep-link com destaque; tema OLED refinado; **auditoria axe em 10 telas P0** + contraste AA como regra de domínio + navegação por teclado; empty states completos + onboarding de primeiro uso (4 passos); **performance** (bundle splitting por rota, virtualização de listas, revisão de N+1); **PWA polish** (instalação via `beforeinstallprompt`, atualização automática com toast, splash/iOS, auditoria automatizada).

## F6 — Hardening & Lançamento

- **Problema:** antes de lançar: provar fidelidade à spec, blindar segurança, ganhar observabilidade e colocar em produção.
- **Solução:** **suíte de fidelidade** (63 testes espelhando regras da spec §1.3–§4.5); **auditoria RLS automatizada** (20 tabelas, zero leitura cross-user, RPCs endurecidos com `search_path` fixo, nenhum segredo rastreado); **Sentry env-gated** (zero impacto no bundle sem DSN) + Web Vitals; **deploy funcional em produção** (Vercel + Supabase) + CI/CD `deploy.yml` com gates; documento de release (`RELEASE.md`).

## F7 — Ergonomia de Navegação, Responsividade & Header Adaptativo

- **Problema:** navegação não otimizada — Relatórios ocupava slot nobre da barra móvel, sidebar fixa e header cru.
- **Solução:** **BottomNav de 5 slots com FAB central** (Início | Transações | + Novo | Cartões | Mais — toque mínimo 44×44px); **sidebar colapsável** (expandida `w-64` ↔ compacta `w-20`) com persistência e margem da página sincronizada; **header sticky fluido** com busca responsiva — tudo com transições CSS nativas e **zero libs de animação**.

## F8 — Refinamento Visual Premium & Dashboard de Insights

- **Problema:** visual "genérico" e Visão Geral sem inteligência contextual (só números).
- **Solução:** **NumberTicker** (valores animados), **swipe-to-action** nas linhas de transação (editar/excluir), **haptics** táteis, toggle de **densidade**, **modo privacidade** (oculta valores), micro-sparklines nos KPIs, **CategoryDonut**, **DailyFlowChart** com scrubbing tátil, **cards inteligentes** (ritmo de gastos, projeção de faturas, anomalias) + saúde da poupança/runway.

## F9 — Utilitários Nativos (Calculadora Flutuante & Scroll)

- **Problema:** lançamentos lentos (cálculos manuais) e páginas longas sem atalho de retorno.
- **Solução:** **calculadora flutuante arrastável** com motor puro (`domain/calculator`), divisão de parcelas em centavos e **"Usar valor"** injetando o resultado direto no campo ativo (`calculator-bridge`); **scroll-to-top inteligente** (posteriormente substituído pelo gesto da F26).

## F10 — Identidade Visual Oficial "Guia Financeiro" & Reestilização de Temas

- **Problema:** o app não tinha marca — temas genéricos e assets sem identidade.
- **Solução:** identidade oficial (**Teal Petróleo, Ouro Âmbar, Coral Suave**) aplicada aos 3 temas; **BrandLogo vetorial** integrado (Sidebar/Header/Auth/PWA); assets de marca regenerados; contraste AA certificado por teste. **Correções pós-F10:** bug "Dados inválidos" em todas as escritas (perfis órfãos → backfill + auto-cura em runtime), ColorPicker/IconPicker, botões discretos, privacidade global por CSS, scrollbars ocultas, calculadora contextual no header, wizard centralizado no desktop e guia de migração de dados legados.

## F11 — Centro de Personalização Avançada & Micro-Interações

- **Problema:** todos os usuários viam exatamente a mesma interface — sem personalização.
- **Solução:** **motor de personalização visual** (6 acentos de cor, 3 estilos de superfície, níveis de movimento, som) persistido e aplicado por tokens CSS; **Button com ripple/spring/loading morfológico**; `LivePulseBeacon`; hub completo **`/configuracoes`** (Perfil, Aparência, Movimento, Sensorial, Dashboard); **Visão Geral modular** com widgets gated por preferência.

## F12 — Polimento de UI/UX, Design System & Experiência Visual

- **Problema:** acabamento inconsistente — empty states genéricos, skeletons `h-24 w-full`, formatação de moeda ad-hoc (negativos virando "R$ 0,00") e superfícies soltas.
- **Solução:** `EmptyState`/`Skeleton` por contexto (list/kpi/chart/table); **primitivo `MoneyText`** com hierarquia e tom semântico (corrige bug de negativos zerados); badges/tags consistentes; animações de entrada/saída (Radix `data-state`) e feedback de escrita; **auditoria de contraste 3 temas × 6 acentos** (18 combinações); headers removidos nas páginas com seletor de mês; **FAB contextual por página**; ícones sem fundo; peso personalizado no relatório; paleta de alto contraste de categorias.

## F13 — Hotfixes Mobile, Layout Fixo & Consistência

- **Problema:** layout mobile quebrado (overflow, scroll duplo, linhas coladas), sem edição de despesas e ícones de categoria inconsistentes.
- **Solução:** estrutura fixa `h-dvh` com scroll interno no `main` (header e BottomNav fixos); salvaguarda global de overflow; `Modal` com `max-h`; correções de overflow em várias telas; **edição completa de despesas** (detalhe → formulário completo); ícones/cores de categoria integrados nas listas. **Pós-F13:** **bloqueio estrito de orientação portrait** (manifest `orientation: portrait` + API de lock com ativação por gesto).

## F14 — Consistência de Estados & Ergonomia de Dados (Trilha A)

- **Problema:** a carteira (F4) usava skeletons genéricos, empty state pobre e não mostrava rentabilidade — inconsistente com as demais telas.
- **Solução:** `SkeletonKpi`/`SkeletonTable` na carteira (zero layout shift); `EmptyState` por contexto com CTA; **colunas de Lucro/Prejuízo e Rentabilidade %** na `PositionTable` com tom semântico; KPIs com comparativo **Δ vs. mês anterior** (`DeltaHint`).

## F15 — Micro-Interações & Conforto Visual (Trilha A)

- **Problema:** falta de acabamento em micro-interações e feedback nas telas financeiras.
- **Solução:** feedback de escrita uniforme (haptics + áudio + confirmação), elevação tátil, transições fluidas e leitura confortável de valores — mesmo padrão em todas as ações de conclusão.

## F16 — Carteira na Home: KPI Real & Widget de Alocação (Trilha B)

- **Problema:** o KPI "Investimentos" da Home era **stub** (passava sempre 0).
- **Solução:** KPI real com **aportes líquidos do mês** (sparkline + DeltaHint) vindo da posição da carteira; `KpiCard` clicável (deep-link para a carteira); motor `allocationByClass` + `AllocationDonut` na aba Posição (decisão: sem widget extra na Home).

## F17 — Dashboard de Investimentos (`/investments`) (Trilha B)

- **Problema:** sem visão executiva da carteira — gráficos, rentabilidade e posições.
- **Solução:** rota `/investments` com **KPIs executivos** (patrimônio com Δ, rentabilidade ponderada, proventos do mês, ativos), motores puros (`portfolioReturnPct`, `dividendsInMonth`, `allocationByTicker`), **donuts por classe e por ativo**, `PositionTable` com ordenação acessível. **Unificação (decisão do produto):** `/carteira` vira redirect e `/investments` é o **hub único** (Resumo/Metas/Aporte).

## F18 — Proventos: Extrato & Calendário (Trilha B)

- **Problema:** proventos eram calculados no ledger, mas não havia tela para vê-los.
- **Solução:** aba **Proventos** no hub — extrato mensal e **calendário anual** (motor `dividends.ts`); escopo mínimo: apenas **recebidos**, e fora do fluxo financeiro core (decisão D11).

## F19 — Inteligência & Consistência dos Insights (Trilha A)

- **Problema:** insights com repetições desnecessárias — 4 módulos mortos (F8), 8 `toCents` locais divergentes, 3 listas sobrepostas de categorias essenciais, normalização duplicada, O(n²) na montagem, investimentos zerados nas projeções.
- **Solução:** remoção do código morto; **`numberToCents` canônico**; **`ESSENTIAL_CATEGORY_ICONS`** fonte única; `normalizeText`/`valuesWithinTolerance` unificados; reuso de `computeOverview`/`aggregateByWeekday` e helpers de budgets; **`isSignificantTrend` exibida** nos Diagnósticos; Map pré-computado (O(n)); **investimentos reais nas projeções**; labels centralizados.

## F20 — Sistema de Gestos & Navegação por Swipe (Mobile Gesture UX)

- **Problema:** navegação por swipe sem rigor → riscos de falsos positivos (thumb drift, swipe-to-action de despesas, formulários, modais).
- **Solução:** motor puro `domain/gestures/swipe` (**axis-lock ±30°**, thresholds de distância/velocidade, flick); hook `useSwipeNavigation` com **`ignoreSelectors`** (inputs, diálogos, `.swipeable-item`, `data-swipe-nav-ignore`); `MonthSwiper` nas **5 telas de mês**; `Tabs` com `swipeable` nas **6 telas de abas**; `touch-action: pan-y` e mouse ignorado.

## F21 — Inteligência de Entrada & Automações Preditivas

- **Problema:** lançar lançamentos manualmente era demorado e repetitivo.
- **Solução:** motor preditivo `domain/predictions`; **sugestões por descrição** + **Lançamentos Habituais** no wizard; **repetição rápida** nos diálogos de detalhe (repetir no mês seguinte etc.).

## F22 — Central de Exportação, Backup & Fechamento Mensal

- **Problema:** dados presos no app — sem portabilidade, backup ou fechamento imprimível.
- **Solução:** `domain/export` (**CSV pt-BR** + backup JSON versionado com Zod e integridade referencial); `fetchAllUserData`/`restoreBackup` via **RPC transacional** (wipe + insert com IDs originais); hub **Configurações > Dados** (JSON completo + CSVs por mês/custom + restauração em 2 etapas); **Fechamento Mensal imprimível** nos Relatórios (`@media print`) e **Web Share** nos comprovantes.
- **Evolução (a pedido do usuário):** o fechamento virou **detalhado** — além do resumo executivo, o documento agora lista **cada gasto do mês** separado por **categoria → dia → gasto**, com descrição, método de pagamento, cartão e parcela (motor puro `domain/reports/detailed-close.ts` + seção "Despesas em detalhe" no `MonthlyClosePrintView`).

## F23 — Engenharia de Performance & Code-Splitting 3D

- **Problema:** carregamento inicial pesado e navegação menos fluida em conexões móveis.
- **Solução:** **política de cache centralizada** (`state/cache-policy.ts`: estático 5 min / analítico 60 s / transacional 30 s) aplicada nas 15 queries; **pre-fetching discreto de chunks** das rotas vizinhas (`prefetchPageChunks` + `useRoutePrefetch` com `requestIdleCallback`); decisão **3D N/A** (sem Three.js — o 3D dos cartões é CSS puro dentro do chunk lazy de `/cartoes`).

## F24 — Planejamento Financeiro & Simulador FIRE

- **Problema:** sem visão de longo prazo — independência financeira, fundo de emergência e metas de aporte.
- **Solução:** motor puro `domain/fire` (regra dos 4%: meta = despesas anuais × 25; projeção anual com retorno real editável; `emergencyFundMonths` com faixas de saúde); módulos `EmergencyFundGauge` e `FireProjectionChart` (SVG, sem libs); aba **Planejamento** na InsightsPage.

## F25 — Micro-interações, Feedback Visual & Ergonomia

- **Problema:** sidebar sem hover no desktop, modais rígidos no mobile, `title` nativos nos botões e **controles nativos do navegador** (date picker e `input[type=number]` crus).
- **Solução:** sidebar **hover-expand em overlay** (delay anti-disparo 120 ms, zero layout shift); **Modal → bottom sheet** no mobile com **drag-to-close** (threshold/fling/resistência/spring-back); primitivo **Tooltip** acessível (substitui `title`); **DatePicker refatorado** (setas nas extremidades, mês centralizado, dia selecionado com gradiente, hoje com dot) e **NumberStepperInput** (substitui `input[type=number]` — spin buttons ocultos, long-press com repetição contínua).

## F26 — Gesto Interativo de Retorno ao Topo (Pull-up Overscroll UX)

- **Problema:** o botão flutuante "Rolar para o Topo" poluía o mobile e conflitava com cards e listas.
- **Solução:** **gesto de pull-up no rodapé** da página: motor puro `domain/gestures/overscroll` (resistência elástica logarítmica, **barreira de inércia** — momentum nunca dispara, threshold 80 px); hook `usePullUpToTop` com FSM e **cancelamento reversível**; **sem pointer capture** (coexiste com o swipe-to-action); indicador minimalista com anel de progresso SVG; **remoção** do `ScrollToTopButton`/`useScrollPosition`.

## F27 — Insights: Precisão, Deduplicação & Casos de Borda

- **Problema:** desafios de economia usavam **o mês isolado** rotulado de "média mensal"; a linha "30% em não essenciais" **duplicava** o desafio individual com 1 categoria; sem dados de dia útil o card de fim de semana mostrava "∞×" e alerta absurdo.
- **Solução:** `typicalMonthlySpendCents` (média real dos meses com gasto — mês vazio não dilui); `DiscretionaryChallenge.categoryCount` (linha agregada oculta com `categoryCount < 2`); guarda `weekendComparable` (exibe "—" com tom neutro, sem alerta "∞×") — motor puro preservado, guarda só na apresentação.

## F28 — Investimentos Mobile Responsive & Organização

- **Problema:** o hub `/investments` estava **bagunçado no mobile** — KPIs em 1 coluna (o app usa 2×2), tabela de posição larga com scroll horizontal (8+ colunas) e metas por classe estourando a largura.
- **Solução:** **cards de posição empilhados no mobile** (tabela completa só em `sm+`, mesmas ações via `PositionRowActions` extraído — DRY); **KPIs 2×2** (padrão do app); metas por classe empilháveis (`flex-col sm:flex-row`); header responsivo; **remoção do código morto pós-F17** (`portfolio-page`/`position-tab`) e barrel do feature corrigido.

## F29 — Insights: Inteligência de Recorrências, Alertas & Diagnósticos e Polish do Planejamento

- **Problema:** (1) assinaturas/recorrências **sumiam do extrato** — serviço conhecido (Netflix, Spotify…) com reajuste de preço acima de ±50% era descartado, e faturas variáveis (água/luz) passavam da tolerância por compararem com o **primeiro** valor; catálogo pequeno; (2) alertas e diagnósticos ficavam em **abas separadas** (leitura duplicada); (3) Planejamento com cards lado a lado apertados e gráfico FIRE **distorcido** (`preserveAspectRatio="none"` esticava os textos).
- **Solução:** (1) **nome conhecido/categoria de assinatura sempre emitem a ocorrência** — a variância só reduz a confiança (penalidade no `confidenceScore`); tolerância `recurring`/`similar` relativa à **mediana**; catálogo expandido (+20 serviços: globoplay, starplus, crunchyroll, deezer, alura, xbox, nordvpn, uberone…); (2) abas unificadas em **"Alertas & Diagnósticos"** (primeira: alertas em destaque → KPIs → avisos contextuais); (3) Planejamento com cards **uma linha cada** (largura cheia), headers com subtítulo, gauge em linha com os stats em chips, inputs FIRE em 3 colunas e `FireProjectionChart` sem distorção (proporcional, máx. 460px).

---

## Auditoria de limpeza (2026-08-15 — refatoração DRY pós-F28)

- **Problema:** duplicações de formatação espalhadas — `formatDate` (ISO → dd/mm/aaaa) idêntica em 3 arquivos, `formatPct` (sinal + % ) idêntica em 2, e máscara monetária inline reimplementada no default de `InsightList`.
- **Solução:** fontes únicas com testes — `formatDateBR` em `src/lib/date.ts` (aceita data com/sem hora, fallback seguro para valores fora do padrão) e `formatSignedPct` em `src/services/masks/percent.ts` (`null`/inválido → "—"); 6 call sites atualizados (`proventos-tab`, `transaction-list-dialog`, `use-search`, `position-table`, `resumo-tab`, `insight-list`). Varredura adicional: zero arquivos órfãos, zero `console.log`/TODO pendentes e zero componentes não utilizados (deps do `package.json` todas em uso no bundle).

---

## Notas finais

- **Arquitetura:** todo cálculo de negócio vive em `src/domain/` como função pura testada; UI em `components/`; dados em `src/data/` (só acessado por `src/state/`); telas em `features/` — ver `docs/ARCHITECTURE.md`.
- **Verificação:** a cada fase — typecheck, lint, testes e build verdes antes do commit (regra do ciclo, `ROADMAP.md` §6.1).
- **Pendências operacionais** (não são código): deploy da edge function de cotações + cron (`npm run quotes:deploy` / `quotes:cron`), testes contra banco real (Supabase local) e execução do QA manual (`docs/RELEASE.md`).
