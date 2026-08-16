# FASES_IMPLEMENTADAS.md — Resumo de Implementação (F0–F29)

> **Objetivo deste documento:** registro resumido de **cada fase de implementação** do projeto — o **problema** que motivou a fase e a **solução** implementada. Detalhe completo (entregas, DoD, arquivos) em `docs/ROADMAP.md` (§3); a ordem de execução e o status estão em `ROADMAP.md` §6.1.
>
> **Status atual (2026-08-16):** fases **F0–F29 concluídas** (+ hotfixes de responsividade do DatePicker e do Seletor de Pesos em modais; refatoração do motor de sugestões preditivas do wizard; **atualizações otimistas** em edição/exclusão de lançamentos; **edge inset do Swipe Navigation**; **Fechamento completo por mês/ano/período customizado com impressão multi-página**; **remoção do swipe de navegação entre meses** (MonthSwiper — gesto horizontal instável; seletor por botões mantido); **endurecimento dos seletores nos modais + sincronização da competência da fatura com a data no modal de edição**; **remoção do gesto de pull-up to top** (F26 — instável em dispositivos reais; rolagem nativa mantida); **padronização visual dos PDFs de relatório** (F22 — paleta clara fixa, tipografia única e quebras de página limpas em qualquer tema do app); **auditoria de código: remoção de código morto e resíduos** (componentes/funções/dependências sem uso, barrels mortos, script one-off; `KpiCard` com API unificada e `DebtRow` extraído do `DebtsPage` — ver `ROADMAP.md` v1.22); **exportação da fatura do cartão em CSV e PDF** (F22 — apenas os gastos lançados no cartão da competência, com planilha Excel-safe e documento imprimível profissional p/ comparar com a fatura do banco — ver `ROADMAP.md` v1.24); **auditoria de fluxo do usuário com correções de usabilidade** (ver `ROADMAP.md` v1.25): lembretes voltam a exibir dívidas vencidas de meses anteriores e TODAS as faturas com saldo; metas de renda sem falha silenciosa; novo primitivo `ErrorState` ("Tentar novamente") em Insights/Relatórios/Orçamentos/Dívidas/Categorias/Lembretes; edição de despesa/receita preserva os dados em falha (modal permanece aberto); swipe "Excluir" abre direto a confirmação; despesa no crédito exige cartão cadastrado; exclusão de dívidas/categorias movida para dentro do formulário de edição; **botões de exclusão dos modais de detalhe padronizados** — "Excluir despesa"/"Excluir receita" viraram apenas "Excluir" (ver `ROADMAP.md` v1.26); **responsividade dos modais no desktop corrigida** — o primitivo `Modal` ganhou prop `size` (sm/md/lg/xl): a classe base `lg:max-w-md` vencia `max-w-*` customizados na cascata do Tailwind (variante `lg:` compilada depois), comprimindo modais largos (fatura, fechamento, detalhe de relatório) a 448px; agora cada modal aplica UMA única classe de largura (ver `ROADMAP.md` v1.27); **fatura do cartão separada em parceladas × à vista** — as compras parceladas (herdadas de meses anteriores) ficam no topo e as à vista (gastos do mês) embaixo, cada grupo ordenado por data, com contagem e subtítulo da parcela (ver `ROADMAP.md` v1.28); **upgrade do motor de Insights** — recorrências com mediana robusta e agregação mensal real, catálogo de assinaturas expandido com matching por tokens (chaves curtas exigem token exato — sem falsos positivos) e página com alertas diagnósticos (reajuste de preço, duplicidade, economia por corte) (ver `ROADMAP.md` v1.29)) · suíte **1127 testes / 139 arquivos** · typecheck/lint/build limpos · deploy funcional (Vercel + Supabase).

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
| F26 | Pull-up Overscroll to Top | A · Gestos | Botão flutuante scroll-to-top poluía o mobile (gesto removido em 2026-08-16 — ver seção F26) |
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
- **Evolução (2026-08-16, atualizações otimistas):** editar/excluir lançamentos (Extrato, faturas de cartão, relatórios) agora reflete **na hora** — `onMutate` atualiza o cache (listas por mês/range/cartão + query singular), `onError` faz **rollback seguro com toast** (bus de toasts imperativos `services/toast.ts` + `ToastHost`) e `onSettled` sincroniza com o servidor. Modal fecha imediatamente; totais/KPIs/faturas recalculam do cache. Motor puro novo `domain/expenses` (`resolveExpenseDeleteIds` — single/all/subsequent espelhando o RPC).

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

- **Problema:** navegação por swipe sem rigor → riscos de falsos positivos (thumb drift, swipe-to-action de despesas, formulários, modais) e conflito com o **edge swipe de voltar do sistema** (Android/iOS).
- **Solução:** motor puro `domain/gestures/swipe` (**axis-lock ±30°**, thresholds de distância/velocidade, flick); hook `useSwipeNavigation` com **`ignoreSelectors`** (inputs, diálogos, `.swipeable-item`, `data-swipe-nav-ignore`); `MonthSwiper` nas **5 telas de mês**; `Tabs` com `swipeable` nas **6 telas de abas**; `touch-action: pan-y` e mouse ignorado.
- **Evolução (2026-08-16, edge inset):** **zona de segurança de borda** — `EDGE_INSET_PX` (24px) + `isEdgeZoneTouch(clientX, vw, inset)`: toques iniciados a menos de 24px das bordas físicas são ignorados no `onPointerDown` (opção `edgeInsetPx` no hook), reservando o edge swipe de voltar para o sistema e operando o app na área central segura; **arming com dominância 1.5** — `isHorizontalDominant(dx, dy, ratio = 1.5)` (`|dx| > 1.5·|dy|`): rolagem vertical com leve desvio horizontal é descartada imediatamente, com o cone ±30° mantido como decisão final no `resolveSwipeIntent`.
- **Evolução (2026-08-16, remoção do swipe de meses):** o gesto horizontal para **trocar de mês** (`MonthSwiper`) foi **removido** por instabilidade na navegação temporal em dispositivos reais. As **5 telas de mês** (Visão Geral, Transações, Cartões, Orçamentos, Relatórios) voltaram ao `MonthPicker` por botões (acessível e previsível); o swipe de **sub-abas** (`Tabs` com `swipeable`) e o Swipe-to-Action de despesas permanecem. Removidos o componente `month-swiper.tsx` e seus 4 testes.

## F21 — Inteligência de Entrada & Automações Preditivas

- **Problema:** lançar lançamentos manualmente era demorado e repetitivo.
- **Solução:** motor preditivo `domain/predictions`; **sugestões por descrição** + **Lançamentos Habituais** no wizard; **repetição rápida** nos diálogos de detalhe (repetir no mês seguinte etc.).
- **Evolução (2026-08-16, refatoração do motor de sugestões):** `buildHabitualEntries` reescrito com **ranking temporal ponderado** — janela de **±5–10 dias do mês** (`dayWindowWeight`), **limite estrito de 3 itens** (era 5) e ordenação por **relevância temporal × frequência × recência** (não mais contagem bruta); novo **`buildDescriptionSuggestions`** — sugestões de **descrição pura** que **filtram nomes de categoria** (ex.: com categoria "Alimentação" não sugere apenas "Alimentação") e rankeiam descrições reais do histórico (top 2–3 chips). **Bug de sobrescrita corrigido:** na Etapa 2, o clique num chip atualiza **apenas `description`** — o `amount`/`date` preenchidos na Etapa 1 são preservados 100%. Código morto removido (`predictFromHistory`/`PredictionSuggestion`/módulo `PredictionSuggestions` + testes).

## F22 — Central de Exportação, Backup & Fechamento Mensal

- **Problema:** dados presos no app — sem portabilidade, backup ou fechamento imprimível.
- **Solução:** `domain/export` (**CSV pt-BR** + backup JSON versionado com Zod e integridade referencial); `fetchAllUserData`/`restoreBackup` via **RPC transacional** (wipe + insert com IDs originais); hub **Configurações > Dados** (JSON completo + CSVs por mês/custom + restauração em 2 etapas); **Fechamento Mensal imprimível** nos Relatórios (`@media print`) e **Web Share** nos comprovantes.
- **Evolução (a pedido do usuário):** o fechamento virou **detalhado** — além do resumo executivo, o documento agora lista **cada gasto do mês** separado por **categoria → dia → gasto**, com descrição, método de pagamento, cartão e parcela (motor puro `domain/reports/detailed-close.ts` + seção "Despesas em detalhe" no `MonthlyClosePrintView`).
- **Evolução (2026-08-16, exportação completa + períodos flexíveis):** o fechamento imprimia **somente a 1ª página** (o Chrome corta a folha `position: absolute` na impressão) — corrigido com o primitivo **`PrintSheet`** (portal em nível `body`, fluxo normal; `@media print` esconde o app por `display: none`), validado com **9 páginas / 186 lançamentos** em Chrome real; e o relatório passou a aceitar **mês, ano e período personalizado** (motor `buildDetailedClose` período-agnóstico + prop `periodLabel` no documento).
- **Evolução (2026-08-16, exportação da fatura do cartão):** botão **"Exportar fatura"** na página de Cartões (cabeçalho da seção de despesas da competência) baixa um **CSV com APENAS os gastos lançados no cartão** da fatura selecionada (Data, Descrição, Categoria, Valor, Valor p/ relatório, Parcelas — BOM + `;` pt-BR), via novo serializador puro `serializeCardInvoiceCsv` (`domain/export` + 2 testes) — permite comparar com a fatura do banco em planilha.
- **Evolução (2026-08-16, CSV Excel-safe + versão PDF da fatura):** a planilha gerava **"caracteres e formatação bugadas"** — o `formatCsvDecimal` usava separador de milhar (`1.234,56`), que o Excel interpreta como **texto** (não soma, células desalinhadas); corrigido para **número sem agrupamento** (`1234,56` — vírgula decimal pt-BR), mantendo BOM/`;`/CRLF — a fatura agora abre como planilha numérica de verdade. Além do CSV, a fatura ganhou a **versão PDF**: botão **"Imprimir / Salvar PDF"** ao lado do CSV abre o preview no modal com o novo componente `CardInvoicePrintView` (padrão F22 — resumo bruto/ponderado/pago/saldo + gastos com parcelas + pagamentos/estornos, `print-area` com paleta clara fixa e paginação multi-página via portal `PrintSheet`), o botão "Exportar CSV" mantém o download. +5 testes do documento imprimível.
- **Evolução (2026-08-16, visual profissional dos PDFs):** o documento **herdava o tema ativo do app** — no dark/oled os PDFs saíam com **fundos escuros** (`bg-surface`, `bg-muted/40`), **cores despadronizadas** (`text-positive-strong`/`text-negative-strong`/`text-primary-strong` brilhantes) e **fontes variadas** (mono `.num` + display Sora). Corrigido na folha `@media print` do `globals.css`: as **variáveis de tema são redefinidas para a paleta clara fixa** (fundo branco, texto quase-preto, bordas cinza-claras, acentos da identidade) com `!important` — cobre todas as utilitárias de uma vez e qualquer utilitária futura; **tipografia única** (sans com números tabulares); `@page` A4 (14mm); `tr { break-inside: avoid }` + `thead` repetido por página. Validado em Chrome real + CDP (media print): **cores e fonte idênticas nos temas light/dark/oled e accent gold** + PDF multi-página íntegro (6 páginas em dataset grande).

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
- **Evolução (2026-08-16, confiabilidade):** gesto instável/aleatório corrigido — **engajamento e re-âncora no meio do gesto** (atingiu o fim do scroll durante o `pointermove`, o pull conta daquele instante — não depende mais do `pointerdown` no rodapé); **fim de scroll com `Math.ceil` + tolerância 8px** (subpixel de telas DPI alto); **`overscroll-behavior-y: contain` + listener nativo `touchmove` não-passivo** (anexado no `pointerdown`, removido ao fim — `preventDefault()` só quando puxando além do rodapé); **threshold 80 → 60px** (mais confortável).
- **Remoção (2026-08-16, decisão de produto):** o gesto de **pull-up to top foi removido** por continuar instável em dispositivos reais — a rolagem nativa do contêiner `main` segue intacta (sem atalho de retorno ao topo; a rolagem manual sempre funcionou). Removidos `usePullUpToTop` (hook), `PullUpToTopIndicator` (indicador), o motor puro `domain/gestures/overscroll` e seus testes; `page-shell.tsx` volta a ser um contêiner de scroll simples e `globals.css` perde o comentário F26. O `overscroll-behavior-y: contain` global permanece (comportamento de scroll independente do gesto).

## F27 — Insights: Precisão, Deduplicação & Casos de Borda

- **Problema:** desafios de economia usavam **o mês isolado** rotulado de "média mensal"; a linha "30% em não essenciais" **duplicava** o desafio individual com 1 categoria; sem dados de dia útil o card de fim de semana mostrava "∞×" e alerta absurdo.
- **Solução:** `typicalMonthlySpendCents` (média real dos meses com gasto — mês vazio não dilui); `DiscretionaryChallenge.categoryCount` (linha agregada oculta com `categoryCount < 2`); guarda `weekendComparable` (exibe "—" com tom neutro, sem alerta "∞×") — motor puro preservado, guarda só na apresentação.

## F28 — Investimentos Mobile Responsive & Organização

- **Problema:** o hub `/investments` estava **bagunçado no mobile** — KPIs em 1 coluna (o app usa 2×2), tabela de posição larga com scroll horizontal (8+ colunas) e metas por classe estourando a largura.
- **Solução:** **cards de posição empilhados no mobile** (tabela completa só em `sm+`, mesmas ações via `PositionRowActions` extraído — DRY); **KPIs 2×2** (padrão do app); metas por classe empilháveis (`flex-col sm:flex-row`); header responsivo; **remoção do código morto pós-F17** (`portfolio-page`/`position-tab`) e barrel do feature corrigido.

## F29 — Insights: Inteligência de Recorrências, Alertas & Diagnósticos e Polish do Planejamento

- **Problema:** (1) assinaturas/recorrências **sumiam do extrato** — serviço conhecido (Netflix, Spotify…) com reajuste de preço acima de ±50% era descartado, e faturas variáveis (água/luz) passavam da tolerância por compararem com o **primeiro** valor; catálogo pequeno; (2) alertas e diagnósticos ficavam em **abas separadas** (leitura duplicada); (3) Planejamento com cards lado a lado apertados e gráfico FIRE **distorcido** (`preserveAspectRatio="none"` esticava os textos).
- **Solução:** (1) **nome conhecido/categoria de assinatura sempre emitem a ocorrência** — a variância só reduz a confiança (penalidade no `confidenceScore`); tolerância `recurring`/`similar` relativa à **mediana**; catálogo expandido (+20 serviços: globoplay, starplus, crunchyroll, deezer, alura, xbox, nordvpn, uberone…); (2) abas unificadas em **"Alertas & Diagnósticos"** (primeira: alertas em destaque → KPIs → avisos contextuais); (3) Planejamento com cards **uma linha cada** (largura cheia), headers com subtítulo, gauge em linha com os stats em chips, inputs FIRE em 3 colunas e `FireProjectionChart` sem distorção (proporcional, máx. 460px).

**Ajuste pós-F29 (2026-08-15, decisão de produto):** botões do header (tema/privacidade/calculadora) voltaram ao `title` nativo (Tooltip primitivo mantido na biblioteca); `brand-logo` com `whitespace-nowrap` + animação `fade-slide-in` (token em `globals.css`) para o colapso da sidebar.

## Hotfix — Seletor de Pesos (Select dentro de modais) (2026-08-16, interação)

- **Problema:** o seletor de peso no relatório funcionava no **wizard** (tela cheia), mas nos **modais de edição** (despesa/receita — e no relatório, com `ReportDetailDialog` → `ExpenseDetailDialog` aninhados) o dropdown **renderizava sem responder aos cliques**; o valor personalizado (MoneyInput) também ficava inerte.
- **Causa raiz:** o `Modal` é um **Dialog Radix modal** — aplica `pointer-events: none` no `<body>` e reativa só a camada interna do portal; o **wrapper `position: fixed` do popper** (`[data-radix-popper-content-wrapper]`) fica entre o body e a camada do Select **herdando `none` sem estilo próprio** (padrão frágil em WebKit: "renderiza mas não clica"). O Select ainda usava `position="item-aligned"`, frágil dentro do bottom sheet com `transform`/`overflow`.
- **Solução:** (1) `select.tsx` — `position="popper"` + `sideOffset={4}` + `align="start"` (config shadcn p/ dialogs: colisão de viewport), `min-w-[var(--radix-select-trigger-width)]` e `max-h-72 overflow-y-auto`; (2) `globals.css` — regra `[data-radix-popper-content-wrapper] { pointer-events: auto }` reativando a camada intermediária do portal. **Validação real** (Chrome headless + CDP, mouse/touch): fluxo completo de edição com cliques reais registrando (trigger atualiza para 75%/Personalizado e MoneyInput aceita digitação). Testes novos no `expense-detail-dialog.test.tsx` (preset 75% e Personalizado → fração resolvida no payload de salvar).

## Hotfix — Seletores nos modais: endurecimento do popper + fluxo de competência (2026-08-16, edição)

- **Problema:** seletores (categoria, peso no relatório, cartão) do modal de **editar despesa** reportados como inoperantes em dispositivos reais — "não consigo selecionar a opção que desejo"; além disso, dois bugs de fluxo no mesmo modal: (a) a **competência da fatura dessincronizava da data** (editar a data não recalculara o mês da fatura pelo fechamento do cartão) e (b) o campo de competência era texto livre sem validação — formato inválido (ex.: `2026-8`) ia ao servidor e falhava com erro genérico.
- **Diagnóstico:** validação real em **Chrome headless + CDP** (touch e mouse, 390px e 1280px, modal simples e aninhado `ReportDetailDialog` → `ExpenseDetailDialog`): o dropdown **abre, fica por cima (hit-test no item) e seleciona** — o hotfix anterior (pointer-events no wrapper) cobre o Chromium; a fragilidade remanescente é **WebKit** (z-index do wrapper só injetado por efeito do Radix, 1 frame depois; camadas internas do portal herdando `pointer-events: none` do body).
- **Solução:** (1) `globals.css` — **`z-index: var(--z-modal)` explícito** em `[data-radix-popper-content-wrapper]` (dropdown nunca fica sob o overlay do modal, mesmo antes do efeito do Radix) + `pointer-events: auto` também nas **camadas internas** (`[data-radix-select-content]`, `[data-radix-popover-content]`, `[data-radix-dropdown-menu-content]`) — cinto e suspensório para WebKit; (2) `expense-detail-dialog.tsx` — a **data agora recalcula a competência** pelo fechamento do cartão (`resolveBillCompetence`), preservando **override manual** (flag `competenceTouched` — editar o campo manualmente trava o recálculo; trocar de cartão re-baselineia); campo com `inputMode="numeric"`/`maxLength={7}`/`autoComplete="off"` + hint explicando o cálculo; (3) **validação pt-BR clara** de `AAAA-MM` no submit (`MONTH_KEY_RE`) com mensagem "Competência da fatura inválida — use o formato AAAA-MM (ex.: 2026-08).". **+3 testes** no `expense-detail-dialog.test.tsx` (data recalcula → 2026-09; override manual preservado ao mudar a data; formato inválido bloqueia com mensagem).

## Hotfix — DatePicker responsivo (2026-08-16, correção prioritária de layout)

- **Problema:** o calendário (DatePicker) estourava a largura no mobile — a grade cortava os dias de sábado/domingo (a visualização parava na sexta); as setas de navegação renderizavam na lateral (ao lado da grade) em vez de no header; faltava ajuste à altura disponível (`max-h`), gerando rolagens desnecessárias.
- **Causa raiz:** a CSS base do react-day-picker não é importada no app; com `navLayout="around"` e `.month` como `flex` em linha, a `<table>` da grade virava **item de linha do flex** ao lado das setas/caption → overflow horizontal.
- **Solução:** (1) **header topo compacto** — `.month` `relative flex flex-col` (linha do header no topo, grade abaixo), setas absolutas nas extremidades (`left-1`/`right-1`, `top-1`) e Mês/Ano centralizado (`flex h-8 items-center justify-center px-12`); (2) **grade 100% responsiva** — `month_grid` `w-full table-fixed` (7 colunas iguais que cabem no viewport) e botões de dia `aspect-square w-full max-w-9` (quadrados e proporcionais à coluna); (3) **container com limite** — popover `w-[calc(100vw-1.5rem)] max-w-sm max-h-[85dvh] overflow-y-auto`. **Validação real** com Chrome headless + CDP em 320px e 390px: zero overflow horizontal, 7 colunas iguais (36,3px), botões 36×36px, setas no topo e mês centralizado exato; foco visível no dia selecionado mantido. Testes do DatePicker ampliados (4 → 8).

---

## Auditoria de limpeza (2026-08-15 — refatoração DRY pós-F28)

- **Problema:** duplicações de formatação espalhadas — `formatDate` (ISO → dd/mm/aaaa) idêntica em 3 arquivos, `formatPct` (sinal + % ) idêntica em 2, e máscara monetária inline reimplementada no default de `InsightList`.
- **Solução:** fontes únicas com testes — `formatDateBR` em `src/lib/date.ts` (aceita data com/sem hora, fallback seguro para valores fora do padrão) e `formatSignedPct` em `src/services/masks/percent.ts` (`null`/inválido → "—"); 6 call sites atualizados (`proventos-tab`, `transaction-list-dialog`, `use-search`, `position-table`, `resumo-tab`, `insight-list`). Varredura adicional: zero arquivos órfãos, zero `console.log`/TODO pendentes e zero componentes não utilizados (deps do `package.json` todas em uso no bundle).

---

## Notas finais

- **Arquitetura:** todo cálculo de negócio vive em `src/domain/` como função pura testada; UI em `components/`; dados em `src/data/` (só acessado por `src/state/`); telas em `features/` — ver `docs/ARCHITECTURE.md`.
- **Verificação:** a cada fase — typecheck, lint, testes e build verdes antes do commit (regra do ciclo, `ROADMAP.md` §6.1).
- **Pendências operacionais** (não são código): deploy da edge function de cotações + cron (`npm run quotes:deploy` / `quotes:cron`), testes contra banco real (Supabase local) e execução do QA manual (`docs/RELEASE.md`).
