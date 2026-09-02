# FASES_IMPLEMENTADAS.md — Resumo de Implementação (F0–F29)

> **Objetivo deste documento:** registro resumido de **cada fase de implementação** do projeto — o **problema** que motivou a fase e a **solução** implementada. Detalhe completo (entregas, DoD, arquivos) em `docs/ROADMAP.md` (§3); a ordem de execução e o status estão em `ROADMAP.md` §6.1.
>
> **Status atual (2026-08-16):** fases **F0–F29 concluídas** (+ hotfixes de responsividade do DatePicker e do Seletor de Pesos em modais; refatoração do motor de sugestões preditivas do wizard; **atualizações otimistas** em edição/exclusão de lançamentos; **edge inset do Swipe Navigation**; **Fechamento completo por mês/ano/período customizado com impressão multi-página**; **remoção do swipe de navegação entre meses** (MonthSwiper — gesto horizontal instável; seletor por botões mantido); **endurecimento dos seletores nos modais + sincronização da competência da fatura com a data no modal de edição**; **remoção do gesto de pull-up to top** (F26 — instável em dispositivos reais; rolagem nativa mantida); **padronização visual dos PDFs de relatório** (F22 — paleta clara fixa, tipografia única e quebras de página limpas em qualquer tema do app); **auditoria de código: remoção de código morto e resíduos** (componentes/funções/dependências sem uso, barrels mortos, script one-off; `KpiCard` com API unificada e `DebtRow` extraído do `DebtsPage` — ver `ROADMAP.md` v1.22); **exportação da fatura do cartão em CSV e PDF** (F22 — apenas os gastos lançados no cartão da competência, com planilha Excel-safe e documento imprimível profissional p/ comparar com a fatura do banco — ver `ROADMAP.md` v1.24); **auditoria de fluxo do usuário com correções de usabilidade** (ver `ROADMAP.md` v1.25): lembretes voltam a exibir dívidas vencidas de meses anteriores e TODAS as faturas com saldo; metas de renda sem falha silenciosa; novo primitivo `ErrorState` ("Tentar novamente") em Insights/Relatórios/Orçamentos/Dívidas/Categorias/Lembretes; edição de despesa/receita preserva os dados em falha (modal permanece aberto); swipe "Excluir" abre direto a confirmação; despesa no crédito exige cartão cadastrado; exclusão de dívidas/categorias movida para dentro do formulário de edição; **botões de exclusão dos modais de detalhe padronizados** — "Excluir despesa"/"Excluir receita" viraram apenas "Excluir" (ver `ROADMAP.md` v1.26); **responsividade dos modais no desktop corrigida** — o primitivo `Modal` ganhou prop `size` (sm/md/lg/xl): a classe base `lg:max-w-md` vencia `max-w-*` customizados na cascata do Tailwind (variante `lg:` compilada depois), comprimindo modais largos (fatura, fechamento, detalhe de relatório) a 448px; agora cada modal aplica UMA única classe de largura (ver `ROADMAP.md` v1.27); **fatura do cartão separada em parceladas × à vista** — as compras parceladas (herdadas de meses anteriores) ficam no topo e as à vista (gastos do mês) embaixo, cada grupo ordenado por data, com contagem e subtítulo da parcela (ver `ROADMAP.md` v1.28); **upgrade do motor de Insights** — recorrências com mediana robusta e agregação mensal real, catálogo de assinaturas expandido com matching por tokens (chaves curtas exigem token exato — sem falsos positivos) e página com alertas diagnósticos (reajuste de preço, duplicidade, economia por corte) (ver `ROADMAP.md` v1.29); **auditoria de fluxo do usuário (Fase 2)** — correções de resiliência: exclusão de dívidas e de ativos/transações da carteira com erro visível (toast + formulário preservado; antes promise rejeitada sem tratamento e diálogo preso), lembretes (lido/snooze/restaurar) com feedback de falha, compartilhar despesa/receita avisa quando cai no clipboard ou não é suportado, wizard pede confirmação ao fechar com dados preenchidos (anti-perda), Visão Geral com "Tentar novamente" (`ErrorState`), metas de renda com indicador de sucesso e timer limpo, e busca global exibe erro da query em vez de "Nenhum resultado" (ver `ROADMAP.md` v1.30); **auditoria de código (2ª passada)** — 74 exports mortos removidos dos barrels (`state`/`export`/`gestures`/`insights`/`money`), funções sem uso deletadas (`useSetManualPrice`/`useRemoveManualPrice`, `lastDayOfMonth`, `subscribeCalculatorTarget`…), script one-off `migrate-legacy-data.mjs` removido, **bug do snooze de lembretes corrigido** (snoozeUntil "NaN-NaN-NaN" fazia o lembrete adiado nunca voltar — agora `addDaysISO(today, 7)`) e helpers locais de soma de dias consolidados no canônico `addDaysISO` (ver `ROADMAP.md` v1.32); **auditoria arquitetural da camada de dados** — varredura de N+1/waterfalls confirmou a camada saudável (batches, cache compartilhado, payloads seletivos), com **1 correção de integridade**: exclusão de pagamento/estorno de fatura passou de **2 DELETEs sequenciais no cliente** (renda `[REFUND]` + pagamento, sem transação) para o **RPC transacional `delete_card_payment`** (migração 0011 — valida ownership, remove ambos atômicamente, audit D2; ver `ROADMAP.md` v1.33); **auditoria de fluxo do usuário (3ª passada)** — lembretes com cards **clicáveis e acessíveis** que navegam com deep-link (destaque da dívida específica `/dividas?q=<id>` e do cartão/mês nas faturas — antes os cards não levavam a lugar nenhum) e **feedback de sucesso no pagamento/estorno de fatura** (toast "Pagamento registrado"/"Estorno registrado"; ver `ROADMAP.md` v1.34); **auditoria de código (3ª passada)** — 26 exports mortos removidos (re-exports de chaves de query no barrel `state`, chaves internas un-exportadas, re-exports mortos de `AuthShell`/`TransactionListPage` nos barrels de features, constantes/funções internas un-exportadas em `domain/gestures`, `domain/savings`, `domain/insights`, `domain/projection`, `domain/onboarding` e `domain/export`; `AXIS_LOCK_TANGENT` totalmente morta removida; ver `ROADMAP.md` v1.35); **verificação final de erros e fragilidades** — `useSetFeedback` (avaliação de insight) sem `onError` corrigido com toast de erro (falha silenciosa); **padronização arquitetural dos modais de edição** (Modal Content with Key Pattern — ver `ROADMAP.md` v1.48); **pacote de usabilidade, conforto, micro-interações táteis e agilidade de entrada** (ver `ROADMAP.md` v1.49); **auditoria de integridade e carregamento assíncrono robusto** (ver `ROADMAP.md` v1.50)) · suíte **1844 testes / 253 arquivos** · typecheck/lint/build limpos · deploy funcional (Cloudflare Pages + Supabase).

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
- **Solução:** **suíte de fidelidade** (63 testes espelhando regras da spec §1.3–§4.5); **auditoria RLS automatizada** (20 tabelas, zero leitura cross-user, RPCs endurecidos com `search_path` fixo, nenhum segredo rastreado); **Sentry env-gated** (zero impacto no bundle sem DSN) + Web Vitals; **deploy funcional em produção** (Cloudflare Pages + Supabase); documento de release (`RELEASE.md`).

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
- **Evolução (2026-08-23, otimização e fluidez no swipe entre abas e sub-abas):**
  - **Eliminação de dead zones em abas aninhadas:** o componente `Tabs` injeta o atributo `data-swipe-tabs-content` estritamente quando `swipeable === true`. Quando uma sub-aba filha não é swipeable (ex.: Calculadora, Metas ou Histórico dentro de Aportes/Investimentos), o toque escala para o contêiner do pai e executa a troca de abas principais com total fluidez.
  - **Detecção dinâmica de scroll horizontal (`hasActiveHorizontalScroll`):** removido o bloqueio estático cego em seletores `table` e `.overflow-x-auto`. Tabelas e cards que cabem na tela agora respondem ao swipe normalmente, enquanto contêineres com rolagem horizontal ativa real preservam seu scroll interno sem falsos disparos.
  - **Conteúdo acoplado na prop `content`:** Dívidas (`debts-page`), Orçamentos (`budgets-page`) e Lembretes (`reminders-page`) migrados para passar o corpo completo das páginas dentro de `items[...].content` de `Tabs`, garantindo que 100% da área útil da tela capture os gestos de puxar para o lado.
  - **Validação:** Suíte completa com 193 arquivos de teste e 1.485 testes aprovados; typecheck e lint 100% verdes.

## F21 — Inteligência de Entrada & Automações Preditivas

- **Problema:** lançar lançamentos manualmente era demorado e repetitivo.
- **Solução:** motor preditivo `domain/predictions`; **sugestões por descrição** + **Lançamentos Habituais** no wizard; **repetição rápida** nos diálogos de detalhe (repetir no mês seguinte etc.).
- **Evolução (2026-08-16, refatoração do motor de sugestões):** `buildHabitualEntries` reescrito com **ranking temporal ponderado** — janela de **±5–10 dias do mês** (`dayWindowWeight`), **limite estrito de 3 itens** (era 5) e ordenação por **relevância temporal × frequência × recência** (não mais contagem bruta); novo **`buildDescriptionSuggestions`** — sugestões de **descrição pura** que **filtram nomes de categoria** (ex.: com categoria "Alimentação" não sugere apenas "Alimentação") e rankeiam descrições reais do histórico (top 2–3 chips). **Bug de sobrescrita corrigido:** na Etapa 2, o clique num chip atualiza **apenas `description`** — o `amount`/`date` preenchidos na Etapa 1 são preservados 100%. Código morto removido (`predictFromHistory`/`PredictionSuggestion`/módulo `PredictionSuggestions` + testes).
- **Evolução (2026-08-16, inteligência de cadência mensal, consolidação & matriz preditiva 5D):**
  - **Supressão de contas mensais cumpridas:** `buildHabitualEntries` calcula a cadência média mensal histórica ($\text{ocorrências} / \text{meses distintos}$). Se a conta for periódica ($\le 1.25\times/\text{mês}$, ex.: Aluguel, Luz, Internet, Assinaturas, Salário) e já tiver sido registrada no mês da transação (`targetMonth`), ela é **automaticamente suprimida** dos 3 cards habituais, liberando espaço para despesas rotineiras e evitando duplicidades acidentais. Na virada do mês ou em datas de meses futuros/passados sem registro, a conta reaparece automaticamente com alta relevância.
  - **Consolidação de hábitos:** agrupamento primário por `descrição + categoria`, eliminando a fragmentação que ocorria ao alternar formas de pagamento (Pix vs. Cartão). A forma de pagamento e cartão sugeridos são calculados pela frequência dominante (**moda**) com desempate por recência.
  - **Valor representativo robusto:** o valor sugerido passa a ser calculado pela **mediana** dos lançamentos históricos (`medianOf`), impedindo que compras pontuais com valores atípicos contaminem o template habitual.
  - **Fator Horário Suave (`timeOfDayFactor`):** calcula a distância circular de horas entre o relógio local do dispositivo e os horários típicos de criação (`created_at`), priorizando despesas da manhã (06h–11h), almoço (11h30–15h), lanche (14h–18h) e jantar/delivery/lazer (18h–24h).
  - **Reforço Semântico:** palavras-chave contextuais (*café, almoço, jantar, pizza, lanche, delivery, posto, combustível, mercado*) garantem afinidade instantânea na janela ideal de consumo.
  - **Proteção do Lançador em Lote:** para usuários que registram notas acumuladas no fim do dia, o algoritmo detecta a concentração horária e neutraliza o timestamp, mantendo os atalhos relevantes através da semântica, dia da semana e frequência pura.
  - **Afinidade de Dia da Semana (`weekdayFactor`):** sintoniza hábitos característicos de dias úteis (Seg–Sex, ex.: estacionamento, almoço de trabalho) e de fins de semana (Sáb–Dom, ex.: bar, cinema, churrasco).

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

## Hotfix — Responsividade Mobile de Cabeçalhos, Ações e Modais (2026-08-16, layout)

- **Problema:** o cabeçalho de despesas da fatura do cartão (`CardsPage`) utilizava `flex items-center justify-between gap-2` em linha única horizontal rígida contendo o título da fatura ("Despesas · mês"), o contador de itens e dois botões de texto longo ("Imprimir / Salvar PDF" e "Exportar CSV"). No mobile (< 640px), o conjunto ultrapassava a largura do viewport (somando mais de 500px), causando quebra de layout e estouro horizontal; da mesma forma, rodapés de modais de impressão/fechamento e campos de meta de renda ficavam comprimidos no mobile.
- **Solução:**
  1. **Cabeçalho de despesas da fatura (`CardsPage`):** contêiner adaptado para `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`; primeira linha no mobile com título e contador; botões na segunda linha com `flex-1 sm:flex-none justify-center` e rótulos responsivos (`<span className="hidden sm:inline">Imprimir / Salvar </span>PDF` e `<span className="hidden sm:inline">Exportar </span>CSV`), garantindo encaixe perfeito em 320px–480px.
  2. **Barra de status da fatura (`CardsPage`):** botões "Estorno" e "Registrar pagamento" com `w-full sm:w-auto` e `flex-1 sm:flex-none justify-center`.
  3. **Rodapés dos modais de impressão/fechamento (`CardsPage` e `ReportsPage`):** adaptados com `flex flex-col-reverse sm:flex-row sm:justify-end gap-2` e botões com `w-full sm:w-auto justify-center`.
  4. **Botão de Fechamento (`ReportsPage`):** `w-full sm:w-auto justify-center`.
  5. **Metas de renda (`BudgetsPage`):** campo `MoneyInput` encapsulado com `flex-1 sm:w-40 min-w-0` ao lado do botão "Salvar" (`shrink-0`), evitando que o input tomasse 100% da linha e jogasse o botão sozinho para baixo.

---

## Auditoria de limpeza (2026-08-15 — refatoração DRY pós-F28)

- **Problema:** duplicações de formatação espalhadas — `formatDate` (ISO → dd/mm/aaaa) idêntica em 3 arquivos, `formatPct` (sinal + % ) idêntica em 2, e máscara monetária inline reimplementada no default de `InsightList`.
- **Solução:** fontes únicas com testes — `formatDateBR` em `src/lib/date.ts` (aceita data com/sem hora, fallback seguro para valores fora do padrão) e `formatSignedPct` em `src/services/masks/percent.ts` (`null`/inválido → "—"); 6 call sites atualizados (`proventos-tab`, `transaction-list-dialog`, `use-search`, `position-table`, `resumo-tab`, `insight-list`). Varredura adicional: zero arquivos órfãos, zero `console.log`/TODO pendentes e zero componentes não utilizados (deps do `package.json` todas em uso no bundle).

---

## Evolução de Assinaturas, Recorrências & Feedback (2026-08-16, Insights)

- **Problema:** (1) A aba de assinaturas e recorrências não informava a **previsão de datas de vencimento** (quando a conta iria cair no mês) nem contagem regressiva de dias; (2) Não havia **segmentação por tipo de serviço** (Streaming, Fitness, Nuvem & IA, Telecom, Mobilidade, Saúde); (3) Não havia diagnóstico para **assinaturas ausentes/pendentes no mês** (quando o dia previsto já passou sem lançamento identificado); (4) Os botões de feedback (*Confirmar / Ignorar / Restaurar*) continham texto longo que ocupava muito espaço horizontal e poluía visualmente os cards; (5) Ao ignorar uma ocorrência, ela sumia sem deixar um ponto de acesso rápido e organizado para restauração caso o usuário clicasse por engano.
- **Solução:**
  1. **Previsão de Próximo Vencimento & Dias Restantes:** `calculateTypicalDay` extrai o dia típico do mês via mediana das datas históricas; `estimateNextDueDate` deriva a próxima data de cobrança e os dias restantes (badges contextuais: *"Vence hoje"*, *"Em 4d"*, *"Dia ~12"*).
  2. **Segmentação por Tipo de Serviço (`ServiceSegment`):** Classificação no catálogo de serviços (`streaming`, `fitness`, `cloud_ai`, `telecom`, `mobility`, `health`, `other`) com badges dedicadas.
  3. **Diagnóstico de Cobrança Ausente no Mês (`missingThisMonth`):** Identifica se o dia típico de uma assinatura regular já transcorreu no mês de referência sem nenhum lançamento registrado (badge de alerta: *"Pendente no mês"*).
  4. **Botões de Ação Compactos (Icon-Only):** Botões discretos de ícones (`Check`, `X`, `RotateCcw`) com tamanhos adaptados (`size-7 sm:size-8`), hover sutil e `title`/`aria-label` descritivos, mantendo a interface leve e elegante.
  5. **Seção Colapsável de Ocorrências Ignoradas:** `partitionFeedback` separa as ocorrências ativas das ignoradas. As ignoradas ficam guardadas em um container colapsável *"Ocorrências ignoradas (N)"* ao final da página, permitindo ao usuário abrir a qualquer momento e restaurar qualquer item com 1 clique.
  6. **Qualidade & Testes:** Suíte de testes unitários dedicada em `insight-list.test.tsx` e `domain/insights/index.test.ts` (142 arquivos / 1155 testes verdes).
---

## Refatoração de UI/UX — Interação Integral do Elemento & Remoção de Lápis (2026-08-17)

- **Problema:** A aplicação utilizava botões redundantes de edição ("ícone de lápis") ao lado de vários elementos da interface (categorias, dívidas, orçamentos, lançamentos do ativo e carteira de cartões). Isso causava poluição visual, reduzia a área clicável no mobile e tornava a interação menos fluida e moderna.
- **Solução:**
  1. **Interação no Nível do Container:** O próprio cartão/linha torna-se clicável (`onClick` + teclado `Enter`/`Space`) para acionar o modal/diálogo de edição com feedback háptico (`triggerHaptic("light")`).
  2. **Eliminação de Botões de Lápis:** Removidos todos os botões de edição dedicados com ícone de lápis nas páginas de **Categorias** (`categories-page.tsx`), **Dívidas** (`debts-page.tsx`), **Orçamentos** (`budgets-page.tsx`), **Lançamentos da Carteira** (`transaction-list-dialog.tsx`), **Posições da Carteira** (`position-table.tsx`) e **Carteira de Cartões** (`credit-card-wallet.tsx`).
  3. **Acessibilidade Estrita & Prevenção de Controles Aninhados:** Ações secundárias (ex.: botão "Quitar/Quitada" em dívidas, exclusão em lançamentos) foram estruturadas como irmãos flexíveis (*siblings*), eliminando violações de controles interativos aninhados (*nested-interactive*) e garantindo 100% de conformidade com auditorias axe (WCAG 2.1 AA).
  4. **Micro-interações & Estilo:** Estados de interação padronizados com `cursor-pointer`, `hover:bg-surface-hover/60` e `active:scale-[0.99]`.
  5. **Qualidade & Testes:** Suíte completa com 143 arquivos e 1164 testes 100% aprovados, typecheck e lint limpos.

---

## Evolução — Insights: Remoção de Alertas Críticos e Unificação de Avisos & Diagnósticos (2026-08-17)

- **Problema:** A tela de Insights possuía uma seção pesada e redundante de "Alertas Críticos" com cards volumosos e numeração de prioridade (`#1..#6`), gerando poluição visual e separação desnecessária em relação aos diagnósticos e avisos contextuais.
- **Solução:**
  1. **Remoção de Alertas Críticos Visuais:** Eliminado o bloco exclusivo de cartões de alerta crítico (`AlertCard`) e badges numéricas.
  2. **Conversão para Avisos Unificados:** Alertas financeiros essenciais (saldo negativo, ritmo acelerado, orçamentos estourados, burn rate elevado, déficit projetado e poupança saudável) foram convertidos em avisos (`Alert`) e consolidados na seção **Avisos & Recomendações** ao lado dos diagnósticos de concentração de renda, fim de semana e tendências.
  3. **Aba Avisos & Diagnósticos:** Apresenta a grade 3x2 de indicadores de diagnóstico no topo e a lista de avisos contextuais logo abaixo.
  4. **Qualidade & Testes:** 145 arquivos e 1204 testes 100% verdes, typecheck e lint limpos.

---

## Fase 30 — Importação e Reconciliação Inteligente de Faturas de Cartão (2026-08-18)

- **Problema:** Lançamento de faturas de cartão de crédito de ponta a ponta exigia digitação manual de dezenas de compras por mês ou uso de formatos engessados. Faturas de diferentes bancos variam de formato (CSV com diferentes encodings/delimitadores, OFX SGML/XML ou texto corrido copiado do Internet Banking), trazendo ruídos de adquirentes (`PAG*`, `IFOOD*`), parcelamentos embutidos (`01/10`) e risco de duplicação com despesas já lançadas.
- **Solução:**
  1. **Motor Puro de Reconciliação Client-Side (`src/domain/reconciliation/`):**
     - **Limpeza e Sanitização:** Remoção inteligente de prefixos de adquirentes e sufixos de cidades (`cleanDescription`) e detecção de pagamentos de fatura para ignorar por padrão (`isPaymentOrSettlement`).
     - **Extração de Parcelas:** Identificação automática de padrões como `(01/10)`, `PARC 01/10`, `01 DE 10`.
     - **Sniffer Estatístico por Amostragem:** Inferência automática das colunas de Data, Descrição e Valor mesmo em arquivos CSV sem cabeçalho e com datas em formatos variados (DD/MM/AAAA, AAAA-MM-DD, etc.).
     - **Parsers Multi-Formato:** Hub universal capaz de processar CSV com auto-delimitador e fallback Latin-1/UTF-8 (`PapaParse`), OFX bancário nativo SGML/XML e Quick-Paste de texto corrido.
     - **Scoring Multidimensional 0–100:** 50% valor centesimal + 25% proximidade temporal + 25% similaridade textual Jaccard (reutilizando `domain/predictions`).
     - **Predição de Categorias:** Novos lançamentos recebem a categoria sugerida pelo histórico de compras do usuário.
     - **Deduplicação e Hashing Ordinal:** Geração de hash SHA-256 com índice ordinal diário garantindo que compras de mesmo valor no mesmo dia não colidam nem gerem duplicatas em reimportações.
  2. **Infraestrutura de Banco & RPC Transacional:**
     - Migration `20260101000015_statement_import.sql` com colunas `statement_hash`, `imported_from_statement` e índice condicional único.
     - RPC `import_statement_expenses` atômico e idempotente no Supabase com auditoria `audit_events`.
  3. **Interface Obsidian Glass em 3 Passos (`StatementImportDialog`):**
     - *Passo 1 (Upload):* Tabs com `Dropzone` para arquivos e `Textarea` para colar texto do extrato.
     - *Passo 2 (Mapeamento):* Tabela de prévia e seletores de coluna assistidos.
     - *Passo 3 (Conferência):* Tabela de conciliação com filtros rápidos (*Todos*, *Novos*, *Sugestões*, *Conciliados*), seleção em lote, badges semânticos, `MoneyText` e seletor de categorias.
  4. **Integração na Tela de Cartões:** Botão "Importar fatura" integrado à barra de ações da fatura da `CardsPage`.
  5. **Refinamento de UX, Prevenção de Duplicatas e Reconciliação Bidirecional (2026-08-18):**
     - **Prevenção de Duplicatas:** Lançamentos com correspondência identificada (*Conciliados* e *Sugestões*) vêm desmarcados por padrão (`selected: false`), protegendo o usuário contra reimportações acidentais; apenas compras faltantes (*Novos*) vêm selecionadas.
     - **Reconciliação Bidirecional:** O motor passa a identificar e listar despesas cadastradas no app na competência que não constam no extrato bancário oficial (`unmatchedExistingExpenses`), com alerta contextual no topo do diálogo e aba dedicada `No App apenas (X)` para auditoria de lançamentos manuais órfãos ou incorretos.
     - **Calibração de Scoring:** Mesmo valor e mesma data pontuam 85% $\rightarrow$ classificado como *Conciliado* (`exact_match`) direto.
     - **Sniffer Estatístico Inteligente:** Colunas com valores constantes de titular/portador (`GABRIEL I S SALES`) são penalizadas e descartadas em favor da coluna real de estabelecimentos por análise de cardinalidade e palavras-chave de cabeçalho.
     - **Mapeamento Manual Direto:** O Passo 2 aplica diretamente a seleção de colunas do usuário sem reexecutar o sniffer automático.
  6. **Qualidade & Testes:** Suíte completa com 154 arquivos e 1.254 testes (100% verde) + typecheck, lint e build de produção limpos.

---

## Evolução — Padronização Visual Global, Harmonização de Headers e Reorganização de Navegação (2026-08-18)

- **Problema:** Com a evolução do app, algumas telas possuíam cabeçalhos inconsistentes, banners redundantes ocupando espaço vertical nobre, excesso de abas horizontais no mobile (ex.: 7 abas em Configurações) e ordenação não ideal de seções e alertas.
- **Solução:**
  1. **Padronização Global de Headers:** Hierarquia visual unificada com `h1` em Sora (`font-display font-bold text-xl sm:text-2xl`) + subtítulo conciso em Inter (`text-xs text-muted-foreground sm:text-sm`) e botões de ação alinhados à direita em todas as páginas secundárias (`Relatórios`, `Insights`, `Lembretes`, `Dívidas`, `Investimentos`, `Categorias`, `Configurações`).
  2. **Enxugamento de Navegação & Abas:**
     - **Configurações (`/configuracoes`):** Consolidação das 7 abas dispersas em 3 blocos lógicos harmoniosos (*Personalização*, *Interface*, *Conta & Dados*).
     - **Categorias (`/orcamentos`):** Renomeado no menu para "Categorias" e abas simplificadas para *Despesas* e *Rendas*; despesas ordenadas pelo percentual consumido do orçamento.
     - **Relatórios (`/relatorios`):** Botão de fechamento movido para o topo e abas analíticas reordenadas com foco em valor (*Por categoria* $\rightarrow$ *Por encargos/juros* $\rightarrow$ *Por forma de pagamento* $\rightarrow$ *Por dia da semana*).
     - **Início (`/`):** Gráfico de Fluxo Diário priorizado em primeiro lugar, seguido pelo Donut de Categorias e resumo financeiro compacto.
     - **Dívidas (`/dividas`):** Resumo com 3 cards de saldo pendente (*A pagar pendente*, *A receber pendente*, *Saldo pendente líquido*).
     - **Insights (`/insights`):** Alertas de ação imediata posicionados no topo da aba de diagnósticos, com recolhimento inteligente (exibição dos 2 mais importantes com expansão/recolhimento sob demanda) e remoção de banners informativos redundantes.
     - **Lembretes (`/lembretes`):** Ordenação estrita por gravidade (atrasados $\rightarrow$ próximos $\rightarrow$ futuros).
  3. **Qualidade & Testes:** Suíte completa com 168 arquivos e 1.339 testes 100% aprovados, typecheck e lint limpos.

## Hotfix — Botão de Calculadora em Modais: Inversão do Padrão (2026-08-18)

- **Problema:** o componente `Modal` exibia o botão de calculadora **por padrão** em todos os modais via prop `hideCalculator` (opt-out). Isso fazia o botão aparecer em contextos onde não faz sentido: diálogos de confirmação/exclusão (`ConfirmDialog`, `DeleteCategoryDialog`), modais de visualização (detalhe de relatório, lista de lançamentos de portfólio), modais de importação (extrato bancário, fatura OFX) e formulário de categoria (sem campos de valor monetário).
- **Causa raiz:** design de opt-out (`hideCalculator` default `false`) — qualquer novo modal criado sem declarar a prop exibia o botão incorretamente.
- **Solução:** inversão para **opt-in** (`showCalculator` default `false`) — a calculadora só aparece quando declarada explicitamente. Regra documentada no `docs/DESIGN_SYSTEM.md §13`.
  - `components/ui/modal.tsx` — prop renomeada de `hideCalculator` para `showCalculator` (default `false`); lógica interna usa variável `displayCalculator = showCalculator && !elevated`.
  - **13 modais** receberam `showCalculator` (todos com `MoneyInput`): formulários de dívida/empréstimo/amortização/liquidação, formulários de cartão/pagamento/refinanciamento, limite de orçamento, cotação manual de ativo, transação de portfólio, wizard de novo lançamento; detalhe de despesa/receita usam `showCalculator={isEditing}` (aparece só no modo edição).
  - **4 modais** tiveram `hideCalculator` removido (prop desnecessária com o novo padrão): perfil de usuário, calculadora flutuante, fatura imprimível e fechamento de período.
  - Testes de `modal.test.tsx` atualizados: novo caso "não renderiza por padrão", caso "aparece com `showCalculator`", caso "`elevated` sobrepõe `showCalculator`".
- **Verificação:** 168/168 arquivos de teste passando (1339 testes), typecheck limpo, lint limpo, build de produção limpo.

## Auditoria de Acesso a Dados — Resolução de N+1, Batching e Índices Estruturais (2026-08-18)

- **Problema:** (1) A sincronização de cotações da carteira executava $N$ requisições HTTP externas + $3N$ operações no banco de dados ($1 \text{ SELECT} + 1 \text{ DELETE} + 1 \text{ INSERT}$ por ativo), totalizando ~80 round-trips para 20 ativos; (2) O RPC `materialize_recurrences` utilizava loops iterativos em cursor PL/pgSQL (RBAR) gerando até $4N$ instruções SQL síncronas por lote de recorrências; (3) Foreign Keys centrais e colunas de consulta frequente (`category_id`, `card_id`, `recurrence_id`, `installment_group_id`, `source_ref`, `due_date`) careciam de índices dedicados, resultando em *Sequential Scans* no PostgreSQL sob RLS.
- **Solução:**
  1. **Batching de Cotações:** Implementada `setAssetPricesBatchFromApi` em `src/data/repositories/asset-prices.ts` e refatorada `syncQuotesForAssets` em `src/services/quotes.ts`. Busca overrides manuais em uma query única e executa exclusão e inserção em lote atômico, reduzindo em **$97.5\%$** as chamadas de banco na tela de investimentos.
  2. **Otimização Set-Based de Recorrências:** Criada a migração `20260101000020_set_based_recurrences.sql` que converte a lógica de materialização para CTEs relacionais (`valid_expenses` e `valid_incomes`), reduzindo o processamento para apenas 2 comandos SQL atômicos sem alterar a assinatura do RPC.
  3. **Índices Estruturais B-Tree:** Criada a migração `20260101000019_performance_indexes.sql` cobrindo todas as Foreign Keys e filtros de consulta em `expenses`, `incomes`, `debts`, `card_payments`, `portfolio_transactions` e `recurrences`.

## Evolução — Agrupamento Inteligente por Urgência e Redesign Mobile de Dívidas (2026-08-18)

- **Problema:** A página de Dívidas (`DebtsPage`) exibia todas as contas a pagar e receber em uma lista plana corrida sem filtro de período temporal, resultando em sobrecarga visual à medida que novos registros eram adicionados. Além disso, o card de dívida individual (`DebtRow`) continha textos e ações aglomerados na mesma linha, ficando apertado no mobile, e as contas já quitadas poluíam a visualização das contas pendentes imediatas.
- **Solução:**
  1. **Resumo Financeiro Proporcional:** Grade com 3 cards simétricos (*A pagar*, *A receber*, *Saldo pendente*) adaptados com `grid-cols-3` e tipografia `MoneyText` harmonizada tanto para mobile quanto para desktop.
  2. **Agrupamento Inteligente por Urgência (Abordagem A):**
     - **Atrasadas & Vencendo Hoje:** Destaque no topo com indicador pulsante e `Badge` crítico para atenção imediata.
     - **Vencimento no Mês Corrente:** Agrupamento automático das contas com vencimento no mês atual (`YYYY-MM`).
     - **Próximos Vencimentos:** Contas futuras organizadas cronologicamente.
     - **Histórico de Quitadas (Colapsável):** Seção colapsável recolhida por padrão quando há contas pendentes, com contador de itens e toggle acessível (`ChevronDown`/`ChevronUp`), expandindo automaticamente caso todas as contas estejam quitadas.
  3. **Redesign Estruturado de `DebtRow`:** Layout limpo de 2 níveis (Linha superior: Nome + Badge de status à esquerda, `MoneyText` monetário à direita; Linha inferior: Data de vencimento/quitação com ícone de calendário à esquerda, Ação de Quitar/Receber ou botão Quitada à direita).
  4. **Acessibilidade WCAG (axe):** Hierarquia estrita de headings (`h1` $\rightarrow$ `h2`) e rótulos acessíveis completos.
  5. **Qualidade & Testes:** 170 arquivos e 1.346 testes 100% aprovados, typecheck limpo, lint limpo e build verificado.

## Evolução — Banner Contextual de Atenção e Governança de Widgets na Visão Geral (2026-08-20)

- **Contexto & Necessidade:** Proporcionar feedback inteligente e imediato no primeiro contato do usuário na Home (`OverviewPage`) sobre o ritmo de consumo do mês e possíveis riscos de déficit, integrando a inteligência da Projeção de Gastos sem poluir a interface quando as finanças estiverem no trilho normal.
- **Implementação:**
  1. **Novo Módulo `PaceAlertBanner` (`src/components/modules/pace-alert-banner.tsx`):**
     - Banner contextual e responsivo com variantes semânticas (`warning` para ritmo acelerado, `critical` para déficit projetado).
     - Exibe métricas de consumo (`% gasto`, `% do mês decorrido`, limite diário recomendado em `MoneyText` e dias restantes).
     - Botão de ação com deep linking para `/insights` (*"Simular cortes e projeção"*).
  2. **Integração na `OverviewPage`:**
     - Utiliza funções puras do domínio (`src/domain/projection` — `spendingPace`, `dailyBudget`, `endOfMonthProjection`).
     - Renderização condicional ativada apenas no mês corrente quando `pace.ahead === true` ou `projection.onTrack === false` e quando a preferência `contextBanners` estiver habilitada.
  3. **Personalização e Limite Mínimo de 3 Widgets no Dashboard:**
     - Adicionada opção `contextBanners` em `DashboardWidgetsConfig` (`useVisualCustomization` + `UserCustomSettings` no Supabase).
     - **Regra de limite mínimo:** O usuário é impedido de desativar widgets se houver $\le 3$ ativos, garantindo que o início mantenha uma composição rica e funcional.
     - Feedback com sensory haptics (`warning`), toast orientativo e bloqueio nos checkboxes.
  4. **Qualidade & Testes:** Testes unitários de módulo (`pace-alert-banner.test.tsx`), página (`overview-page.test.tsx`), hook de personalização (`use-visual-customization.test.ts`) e configurações (`settings-page.test.tsx`).

## F39 — Inteligência de Proventos, Bola de Neve & Margem de Segurança (2026-08-22)

- **Problema:** O investidor focado em proventos perpétuos precisava calcular manualmente o reinvestimento de proventos, o Yield on Cost e o Preço Teto, além de ter risco de desbalanceamento por sobreconcentração de ativos.
- **Solução:**
  1. **Domínio Puro (`src/domain/portfolio/snowball.ts`):** `calculateSnowballProgress` (fórmula de autosustentação da cota), `calculateYieldOnCost`, `calculateBazinTargetPrice` (Preço Teto 6% a.a. Bazin) e `normalizeAllocationTargets`.
  2. **Calculadora por Cota:** Alternador dinâmico em `DividendFormDialog` para lançamento por valor total ou valor por cota.
  3. **Visualização do Efeito Bola de Neve:** Seção com barras de progresso e badge "Bola de Neve Ativa" em `ProventosTab`.
  4. **Termômetro de Concentração e Normalização:** Diagnóstico automático para ativos com peso > 25% em `ResumoTab` e botão de normalização em 1-clique em `TargetsTab`.

## F40 — Central de Relatórios de Investimentos & Facilitador de IR/IRPF (2026-08-22)

- **Problema:** Acompanhamento fiscal e prestação de contas de investimentos dispersos e burocráticos, sem facilidade para a declaração anual de ajuste de IRPF e apuração mensal de DARF de bolsa.
- **Solução:**
  1. **Motor Fiscal Puro (`src/domain/portfolio/tax.ts`):** Enquadramento de Bens e Direitos por Grupo/Código da Receita, segregação de Rendimentos Isentos (Ficha 09) e Tributação Exclusiva (Ficha 10 - JCP), e apuração mensal de DARF com isenção de R$ 20.000 em ações e 20% em FIIs.
  2. **Relatório Executivo A4/PDF (`PortfolioExecutiveReport`):** Visão consolidada pronta para impressão limpa ou exportação PDF via `PrintSheet`.
  3. **Facilitador Anual de IRPF (`PortfolioTaxReport`):** Modal com textos pré-formatados das fichas da Receita Federal e botão de 1-clique para cópia rápida.
  4. **Monitor Mensal de DARF (`PortfolioDarfMonitor`):** Painel interativo com seletor de mês, compensação de prejuízos e alerta de recolhimento via DARF (Código 6015).
  5. **Aba "Relatórios & IR":** Nova aba no hub de investimentos (`InvestmentsPage`) com acesso ágil aos relatórios.

## Evolução — Card Dedicado de Saldo em Caixa & Diálogo Exclusivo sem Edição de Nome (2026-08-22)

- **Problema:** O saldo em Caixa não possuía fluxo ágil de edição quando zerado, o card de "Ativos em carteira" ocupava espaço desnecessário no dashboard, e o formulário de cadastro de ativos permitia selecionar nome arbitrário para caixa ou criar múltiplos caixas na mesma carteira.
- **Solução:**
  1. **Componente `CashKpiCard` (`src/components/modules/cash-kpi-card.tsx`):** Card de domínio dedicado ocupando as primeiras 2 colunas (`col-span-2`) da grade de KPIs, com botões rápidos de "Editar saldo" e "Excluir" (quando cadastrado) ou botão rápido "Adicionar caixa" (quando zerado/não cadastrado).
  2. **Diálogo Especializado `CashFormDialog` (`src/features/investments/components/cash-form-dialog.tsx`):**
     - Sem opção de escolher o nome: fixado compulsoriamente como `ticker: "CAIXA"` e `asset_class: "Caixa"`.
     - Campo monetário direto com `MoneyInput` para preenchimento de Saldo Disponível em centavos e campo opcional de anotações.
  3. **Restrição Estrita de Unicidade:**
     - Apenas **1 ativo de Caixa** é permitido na carteira.
     - O formulário geral `AssetFormDialog` oculta a sugestão "Caixa" e bloqueia qualquer tentativa de cadastrar um segundo ativo com ticker ou classe de caixa.
     - O `CashFormDialog` atualiza idempotentemente o saldo do caixa existente caso já cadastrado.
  4. **Harmonização da Grade de KPIs:** Remoção do card "Ativos em carteira", resultando em 4 colunas equilibradas no desktop: Saldo em Caixa (2 colunas) + Patrimônio Total (1 coluna) + Proventos no Mês (1 coluna).

## F41 — Arquitetura Unificada de Investimentos: Investment Wizard, Quick Transaction Sheet & Visão Dedicada de Ativos (2026-08-22)

- **Problema:** Sobrecarga de modais sobrepostos e fluxos redundantes no ecossistema de investimentos (diálogos aninhados `AssetFormDialog`, `TransactionListDialog`, `TransactionFormDialog`, `AssetSplitDialog`, `DividendFormDialog`), além de atrito cognitivo entre cadastrar novo ativo versus aportar em ativo existente.
- **Solução:**
  1. **Domínio Puro & Schemas Zod (`src/domain/portfolio/schemas.ts`):** `newAssetSchema`, `quickTransactionSchema`, `assetMetadataSchema` e validação com regex padronizada de tickers (`TICKER_REGEX`).
  2. **Catálogo Curado de Tickers (`src/domain/portfolio/tickers-catalog.ts`):** Autocomplete instantâneo com mais de 60 ativos pré-curados (Ibovespa, IFIX, BDRs, ETFs, Renda Fixa, Cripto, Globais) e gerador de sugestões preditivas de aporte orientadas por metas com déficit (`buildAporteSuggestions`).
  3. **Padronização Estrita de Tickers em Caixa Alta (UPPERCASE):** Todos os formulários e estados forçam caixa alta (`font-mono uppercase` e `.toUpperCase()`), mantendo total consistência com os padrões de mercado da B3 e corretoras.
  4. **Investment Wizard Unificado (`src/features/investments/wizard/`):** Máquina de estados pura com bifurcação inteligente entre *Novo Ativo* e *Aporte em Posição Existente* (com fast-track a partir da tabela e cálculo de novo Preço Médio ponderado em tempo real).
  5. **Quick Transaction Sheet (`QuickTransactionSheet`):** Bottom sheet ágil e mobile-first para lançamentos atômicos em 1 toque (Compra com recálculo de PM, Venda com apuração de ganho de capital e monitor de isenção de 20k, Proventos e Splits).
  6. **Visão Dedicada de Ativos (`AssetDetailSheet` & `AssetEditDialog`):** Painel lateral com deep linking (`?asset=<id>`), KPIs da posição, Preço Médio, Lucro Não Realizado, Yield on Cost (YoC) e extrato cronológico integrado com exclusão individual de operações.
  7. **Centralização de Mutações (`src/state/mutations/use-portfolio-mutations.ts`):** Invalidação atômica e coordenada de cache com TanStack Query.

## Evolução — Metas de Alocação: Normalização Contextual, Ações Rápidas 1/N, Espelhamento & Comparativo de Gap (2026-08-23)

- **Problema:** (1) O botão de normalizar metas para 100% calculava a proporção na carteira inteira mesmo com filtros de classe ativos (gerando percentuais inesperados para os ativos visíveis); (2) Definir metas manuais para 20 a 100+ ativos era lento e exaustivo sem ferramentas de distribuição equiponderada ($1/N$) e espelhamento da carteira real; (3) Falta de campo de busca e ordenação por déficit/gap para priorizar aportes; (4) Aba de classes sem barra de validação de soma total nem ações em lote.
- **Solução:**
  1. **Domínio Puro (`src/domain/portfolio/`):**
     - `normalizeAllocationTargets`: Aprimorado com suporte a `targetTotal` customizado (ex.: normalizar para a meta da classe de 40% ou global de 100%) e redistribuição inteligente.
     - `distributeEquallyTargets`: Divisão $1/N$ rigorosa com compensação determinística de dízimas periódicas no último item para fechar a soma exata (ex.: $33.33, 33.33, 33.34$).
     - `mirrorCurrentPositionTargets`: Transforma a alocação atual de mercado (`pct`) em metas ideais com 1 clique.
     - `calculateAssetAllocationDelta`: Cálculo de $\Delta = Alvo\% - Atual\%$ e identificação de subalocação (`isUnderallocated`).
  2. **Módulo `TargetEditor` (`src/components/modules/target-editor.tsx`):**
     - **Barra de Ações de 1-Clique:** Botões para *Normalizar*, *Distribuir igualmente (1/N)*, *Espelhar carteira atual* e *Zerar metas*.
     - **Busca Instantânea por Ticker/Classe:** Filtro em tempo real para navegação rápida em carteiras com muitos ativos.
     - **Ordenação Inteligente:** Opções de ordenação por *Prioridade de aporte (Gap)*, *Maior meta %*, *Maior patrimônio* e *Ticker (A-Z)*.
     - **Comparativo Visual ($\Delta$ Gap):** Badges contextuais (`+X.X% · Recebe aporte` ou `Alocado`).
  3. **Página `TargetsTab` (`src/features/investments/pages/targets-tab.tsx`):**
     - **Normalização e Distribuição Contextuais:** Ao filtrar por uma classe (ex.: *Ações* com meta de 60%), os botões adaptam-se para normalizar/distribuir apenas a classe visível para somar 60%, preservando as demais classes intactas.
     - **Aba de Classes:** Barra de progresso com validação da soma ($\le 100\%$), botões de normalização/distribuição entre classes e botão de *Salvar todas as classes*.
  4. **Qualidade & Testes:** Suíte de testes unitários e de integração dedicada em `allocation.test.ts`, `snowball.test.ts` e `targets-tab.test.tsx` (100% verde).

## Evolução — Tabela de Posições: Clique na Linha, Hover no Ativo, Isolamento no Preço & Eliminação dos 3 Pontinhos (2026-08-23)

- **Problema:** (1) A coluna de ações com menu popover de 3 pontinhos (`...`) gerava poluição visual e ocupava espaço horizontal na tabela desktop e nos cards mobile; (2) O clique na linha da tabela desktop não abria o modal de detalhes do ativo; (3) O botão do ativo não possuía feedback visual de hover evidente (ao contrário do botão de preço); (4) O menu de 3 pontinhos duplicava ações já disponíveis internamente no modal de detalhes (`AssetDetailSheet`).
- **Solução:**
  1. **Interatividade de Linha Inteira (`DataList` + `PositionTable`):** Suporte a `onRowClick` habilitado na `PositionTable`, permitindo que o clique em qualquer área neutra da linha (ou teclado `Enter`/`Espaço`) abra o modal de detalhes do ativo (`AssetDetailSheet`).
  2. **Hover Padronizado no Ativo:** O botão de Ticker/Classe recebeu estilo de hover e affordance idêntica ao botão de preço (`hover:bg-surface-hover/80`, `rounded-md px-1.5 py-1 -ml-1.5`, transição de cor e `group-hover:text-primary`).
  3. **Isolamento de Eventos no Preço:** `e.stopPropagation()` no clique da cotação garantindo que clicar no preço abra exclusivamente o modal de cotação manual (`ManualPriceDialog`), sem disparar o clique da linha.
  4. **Remoção dos 3 Pontinhos:** Eliminação da coluna e do botão de 3 pontinhos no desktop e mobile, limpando a interface enquanto todas as ações de gestão (Editar, Excluir, Aportar, Resgatar, Rendimentos) permanecem centralizadas no `AssetDetailSheet`.
## Evolução — Taxa de Poupança com Aportes, Precificação de Renda Fixa/Tesouro Direto & Calculadora Flutuante nos Modais (2026-08-23)

- **Problema:**
  1. A taxa de poupança zerava quando a renda disponível era destinada a aportes em investimentos, distorcendo o indicador patrimonial;
  2. Ativos de Renda Fixa (CDB, LCI, LCA, CRI, CRA, Debêntures) e Tesouro Direto estavam forçando campos de cotas fracionárias e preço médio unitário no cadastro e nas ordens de aporte/venda, além de exibir a opção de *split* (que não faz sentido para renda fixa);
  3. No Tesouro Direto não era possível escolher entre precificação em valor completo (padrão de RF) ou cotas fracionárias com preço médio;
  4. Faltava o botão de calculadora flutuante (`FloatingCalculator`) nos cabeçalhos dos modais de investimentos que utilizam entradas financeiras (`MoneyInput`).
- **Solução:**
  1. **Taxa de Poupança & Fechamento Consolidado:**
     - `computeOverview` (`src/domain/overview/index.ts`): Fórmula corrigida para $\text{savingsRate} = \frac{\text{income} - \text{expense}}{\text{income}} \times 100$, refletindo a renda líquida poupada/investida.
     - `DailyFlowChart` (`OverviewPage`) e `closeTotals` (`ReportsPage`): Inclusão dos aportes de investimentos no fluxo diário do mês e no fechamento do período ativo.
  2. **Domínio de Renda Fixa & Tesouro Direto (`src/domain/portfolio/valuation.ts`):**
     - Criadas funções puras `isFixedIncomeClass`, `isTesouroAsset` e `getAssetPricingMode` com suporte ao modo `"total_value"`.
     - Tesouro Direto com padrão **Valor Completo (Padrão RF)** e alternância para **Preço Médio / Cotas** persistida via tag `[PRICING:UNIT]`.
  3. **Formulários & Modais Adaptados (`AssetFormDialog`, `StepNewPosition`, `StepOrder`, `QuickTransactionSheet`, `AssetDetailSheet`):**
     - Renda Fixa e Tesouro (valor completo) exibem **Preço Inicial / Valor Aplicado** e **Preço Atual / Saldo Final**, sem campos de cotas ou PM.
     - No Wizard e no `QuickTransactionSheet`, a operação de *Split* é ocultada para Renda Fixa, e as ordens de aporte e resgate utilizam entrada monetária direta (`MoneyInput`) com atalhos de percentual (25%, 50%, 75%, 100%) e validação em `canProceed`.
  4. **Calculadora Flutuante nos Modais de Investimentos:**
     - Propriedade `showCalculator` habilitada nos componentes `<Modal>` de `AssetFormDialog`, `InvestmentWizard`, `CashFormDialog`, `DividendFormDialog`, `QuickTransactionSheet` e `AssetSplitDialog`.
     - Integração nativa com `MoneyInput` e `calculator-bridge` para injeção imediata de valores calculados no campo em foco.
  5. **Qualidade e Testes:** Suíte completa com 1510 testes passando em 193 arquivos, com typecheck e lint estritos 100% limpos.

## Evolução — Sistema de Cenários & Pré-definições de Metas de Alocação (Presets) (2026-08-23)

- **Problema:**
  1. O usuário não conseguia salvar estratégias ou cenários alternativos de alocação de carteira (ex.: *Foco em Dividendos*, *All-Weather / Ray Dalio*, *Boglehead 60/40*, *Agressiva / Growth*); qualquer alteração sobrescrevia as metas oficiais diretamente.
  2. Um trigger legado no PostgreSQL (`trg_allocation_targets_check`) disparava exceção `BEFORE DELETE`, causando um bloqueio que impedia salvar ou limpar metas quando a soma anterior estivesse superior a 100%.
- **Solução:**
  1. **Banco de Dados & RLS (`supabase/migrations/20260101000024_fix_allocation_targets_trigger.sql` & `20260101000025_allocation_presets.sql`):**
     - Remoção definitiva do trigger de linha `trg_allocation_targets_check` e substituição atômica no RPC `set_allocation_targets` (DELETE + INSERT).
     - Nova tabela `public.allocation_presets` com RLS estrito por usuário (`auth.uid() = user_id`), campos JSONB para `asset_targets` e `class_targets`, trigger de `updated_at` e índices de consulta rápida.
  2. **Domínio Puro (`src/domain/portfolio/presets.ts` & `src/domain/portfolio/presets.test.ts`):**
     - Catálogo de templates pré-curados de mercado (`SYSTEM_PRESET_TEMPLATES`: *Ray Dalio*, *Boglehead*, *Foco em Dividendos*, *Arrojada*).
     - Funções puras testadas com Vitest: `applyPresetToPosition` (mapeamento por Ticker e ID, distribuição 1/N de classes, resiliência a novos ativos e ativos excluídos), `createPresetSnapshot` e `validatePresetInput`.
  3. **Camada de Dados & Estado (`src/data/repositories/allocation-presets.ts` & `src/state/queries/use-allocation-presets.ts`):**
     - CRUD completo com TanStack Query (`useAllocationPresets`, `useCreateAllocationPreset`, `useUpdateAllocationPreset`, `useDeleteAllocationPreset`), invalidação automática de cache e toasts semânticos de feedback.
  4. **Componentes Modulares & UI (`PresetSelectorBar` & `SavePresetDialog`):**
     - Barra de controle no topo da aba de Metas com seletor categorizado (Metas Oficiais, Cenários Salvos e Modelos de Mercado).
     - **Modo Simulação & Prévia:** Permite explorar qualquer cenário mantendo as metas oficiais intactas, com botão de *Restaurar Metas Oficiais*, *Sobrescrever Cenário* e *Excluir Cenário* com diálogo seguro de confirmação.
     - Modal `SavePresetDialog` para nomear, descrever e pré-visualizar a quantidade de ativos/classes do snapshot.
## Evolução — Proventos Acumulados Históricos, Modo Extrato do Mês & Bola de Neve (2026-08-23)

- **Problema:**
  1. O usuário não tinha como cadastrar o total de proventos recebidos em anos/meses anteriores ao uso do app sem poluir o calendário e o extrato mensal com datas antigas ou estimativas imprecisas;
  2. O cálculo de *Yield on Cost* (YoC) ignorava o histórico anterior ao cadastro;
  3. No cálculo do *Efeito Bola de Neve*, ativos que não possuíam lançamentos em `portfolio_dividends` (mas tinham proventos acumulados históricos) eram ocultados da listagem (`return null`), ficando invisíveis;
  4. O usuário não conseguia escolher entre lançar proventos pontuais (data exata) ou lançar o extrato consolidado do mês de competência (extrato mensal) nos formulários e no Wizard.
- **Solução:**
  1. **Banco de Dados & Schema (`supabase/migrations/20260101000027_portfolio_accumulated_dividends.sql`):**
     - Adicionadas colunas `accumulated_dividends numeric(14,2) NOT NULL DEFAULT 0` e `estimated_monthly_dividend_per_share numeric(12,6) NOT NULL DEFAULT 0` na tabela `portfolio_assets`.
     - Validação e tipagem forte em `src/types/schema.ts` e `src/domain/portfolio/schemas.ts` com Zod.
  2. **Domínio Puro (`src/domain/portfolio/dividends.ts` & `snowball.ts`):**
     - Funções puras `resolveDividendDate` e `resolveDividendNote` para padronizar o registro no modo Extrato do Mês (`YYYY-MM-01` com tag `[MENSAL]`).
     - Função `calculateYieldOnCostTotal` incorporando proventos acumulados históricos e periódicos no YoC.
     - Função `resolveMonthlyDividendPerShare` com resolução hierárquica de fonte (Cenários A, B e C), garantindo que ativos com estimativa manual participem da Bola de Neve mesmo sem lançamentos periódicos.
  3. **UI & Experiência do Usuário (`InvestmentWizard`, `DividendFormDialog`, `QuickTransactionSheet`, `AssetDetailSheet` & `ProventosTab`):**
     - Seção de *Proventos Anteriores ao Cadastro* no Wizard e no `AssetEditDialog`.
     - Alternador de modo (*Diário / Data Exata* vs. *Extrato do Mês* com `MonthPicker`) em todos os pontos de entrada de proventos.
     - Badge informativo `"Estimado"` na Bola de Neve para ativos alimentados via estimativa cadastral.
     - Fast-Track no Wizard: abertura direta no Passo 2 com dados do ativo pré-carregados ao clicar em ações de ativos (`Aportar`, `Vender`, `Provento`).

## Evolução — Auditoria, Refatoração Estrutural, Responsividade e Motor de PDF no Módulo de Relatórios (2026-08-24)

- **Problema:**
  1. A página de Relatórios (`ReportsPage`) continha paddings redundantes (`p-3.5 sm:p-6 pb-20`) conflitando com o container mestre `PageShell`, além de recarga destrutiva no ErrorState (`window.location.reload()`);
  2. Modais editoriais (`ReportDocumentLayout`) duplicavam títulos e botões de fechar ("X") devido à renderização manual de barra superior dentro do Radix `Modal`;
  3. Tabelas densas de 8 colunas e agregações financeiras sofriam esmagamento em telas mobile `< 380px`;
  4. Na exportação e impressão de PDF A4, contêineres com `overflow-x-auto` cortavam as colunas da margem direita e seções contábeis quebravam no meio por falta de `break-inside-avoid`.
- **Solução:**
  1. **Alinhamento de Layout & Contêiner:** Contêiner raiz padronizado com `<div className="flex flex-col gap-6 w-full min-w-0">` e `refetch()` assíncrono TanStack no `ErrorState`.
  2. **Unificação de Cabeçalhos em Modais (`Modal` + `ReportDocumentLayout`):** Adicionada a prop `headerActions?: ReactNode` ao primitivo `Modal`, integrando o botão "Imprimir / Salvar PDF" diretamente no cabeçalho Radix Dialog e eliminando elementos duplicados.
  3. **Responsividade Mobile das Tabelas:** Larguras protegidas para colunas de valor e percentual em `ReportTable` (`DataList`), eliminação de tabelas ad-hoc e adoção universal de `<MoneyText>`.
  4. **Blindagem da Engine de PDF A4:** Classes `break-inside-avoid`, `print:overflow-visible`, `print:table-fixed` e larguras percentuais somando 100% da folha A4 Portrait, acompanhadas de reforço em `src/styles/globals.css`.
  5. **Fuso Horário Local:** Substituição de `toISOString()` por `todayISO()` na exportação do Caderno Excel.

## Evolução — Wizard de Investimentos: Sugestões Condicionadas a Metas, Feedback Visual & Tickers de 1 Letra (2026-08-24)

- **Problema:**
  1. Quando não havia metas cadastradas, o Wizard exibia todos os ativos em carteira como se fossem sugestões/recomendações calculadas de aporte;
  2. Ao selecionar uma sugestão ou resultado de busca, o item não recebia destaque visual claro, gerando dúvida sobre qual ativo seria adicionado, e o fluxo para novo ativo permanecia redundante no Step 1;
  3. Ativos globais com ticker de 1 letra (como "O" - Realty Income, "T" - AT&T, "V" - Visa) não podiam ser buscados nem cadastrados devido a restrições de comprimento mínimo ($q.length \ge 2$) e regexes de 2 a 5 letras.
- **Solução:**
  1. **Sugestões Estritamente Condicionadas a Metas (`StepSelect` & `buildAporteSuggestions`):** Verificação `hasTargets = targets.length > 0 || classTargets.length > 0`. Sem metas, exibe banner informativo amigável e apresenta a lista de ativos sob o rótulo "Seus ativos em carteira (seleção manual)".
  2. **Destaque Visual e Transição Fluida no Wizard:**
     - Aplicação de estilo visual ativo `isSelected` (`ring-2 ring-primary bg-primary/10 border-primary`), badge `Selecionado` e checkmark.
     - Sincronização automática do input de busca ao selecionar ativo.
     - Botão contextual no rodapé: `Continuar com ${state.ticker}`.
     - Ao selecionar um novo ativo do catálogo ou busca, o fluxo avança diretamente para o **Passo 2: Posição Inicial** (`mode: "new_asset", step: 2`), eliminando a tela duplicada.
  3. **Suporte Global a Tickers de 1 Caractere:**
     - Remoção da trava de tamanho mínimo em `tickers-catalog.ts` ($q.length \ge 1$) e adição de `"O"`, `"T"`, `"V"`, `"C"`, `"F"` no `CURATED_TICKERS_CATALOG`.
     - Atualização das regexes em `import-parser.ts`, `valuation.ts` e `quotes.ts` para `/^[A-Za-z]{1,5}$/`.
     - **Sistema de Ranking de Relevância em `searchTickers`:** Match exato de ticker pontua com maior prioridade ($score = 0$), garantindo que buscas curtas como "O" posicionem o ativo "O" no topo absoluto da lista.
## F49 — Saldo em Caixa Real (Regime de Caixa Estrito), Checkpoints de Âncora & Previsão de Liquidez (2026-08-24)

- **Problema:**
  1. O usuário não sabia quanto possuía em caixa para gastar porque o app apurava apenas o resultado de competência mensal (DRE operacional) que resetava a cada virada de mês;
  2. O saldo calculado nunca batia com o saldo real do extrato bancário;
  3. Compras no cartão de crédito debitavam o caixa prematuramente no dia da compra, antes do pagamento real da fatura;
  4. Lançamentos com datas futuras distorciam o saldo disponível de hoje;
  5. Não havia mecanismo de conciliação e aferição rápida com o extrato bancário sem criar despesas fictícias de "ajuste" que poluíam categorias e relatórios.
- **Solução:**
  1. **Domínio Puro de Caixa (`src/domain/cash/cash-ledger.ts`):**
     - Motor puro `calculateRealCashBalance`: computa o saldo acumulado histórico considerando receitas, despesas em débito/PIX/dinheiro, pagamentos/estornos de fatura de cartão de crédito, dívidas efetivamente liquidadas (`paid_at`) e aportes em investimentos;
     - Desacoplamento estrito de compras de cartão de crédito do caixa diário (apenas o evento `card_payments` na data da liquidação debita da conta corrente);
     - Filtragem temporal rigorosa: eventos $> \text{hoje}$ são desconsiderados do saldo disponível em conta de hoje;
     - Motor `calculateSafeToSpend`: projeta o Saldo Livre Real deduzindo faturas em aberto e compromissos/dívidas pendentes do ciclo.
  2. **Banco de Dados & Repositório (`supabase/migrations/20260101000035_cash_checkpoints.sql` & `src/data/repositories/cash-checkpoints.ts`):**
     - Tabela `cash_checkpoints` com RLS por `auth.uid()`, isolamento temporal e índice de performance;
     - Repositório completo com queries e mutations (`useCashCheckpoints`, `useLatestCashCheckpoint`, `useRealCashBalance`, `useCreateCashCheckpoint`, `useDeleteCashCheckpoint`);
     - Inclusão de `cash_checkpoints` na exportação e restauração de backup integral JSON.
  3. **Interface & Visão Geral (`RealCashHeroCard`, `CashCheckpointDialog`, `OverviewPage`):**
     - `RealCashHeroCard` no topo da Visão Geral exibindo o Saldo Disponível em Conta consolidado, badge de aferição/fluxo e projeção Safe-to-Spend;
     - Ação "Calibrar com o banco" abrindo `CashCheckpointDialog` com `MoneyInput`, `DatePicker` e anotações para ancorar o saldo em 1 clique;
     - Renomeação do 4º KPI da Visão Geral para "Resultado do mês" para diferenciar claramente o resultado de competência mensal do saldo bancário acumulado.
## F50 — Proatividade Patrimonial: Conexão Sobra de Caixa → Aporte, Auto-Snapshots & Gatilhos da Bola de Neve (2026-08-24)

- **Problema:**
  1. O usuário precisava calcular manualmente de cabeça quanto sobrava de caixa no fim do mês para decidir o valor de aporte na carteira de investimentos;
  2. A série histórica de evolução patrimonial exigia a criação manual de snapshots no 1º dia de cada mês; caso o usuário esquecesse, ficavam lacunas nos gráficos de patrimônio;
  3. Quando os proventos recebidos de um ativo atingiam o valor de uma nova cota inteira (efeito bola de neve ativo), o usuário não recebia nenhuma notificação ou atalho direto de reinvestimento nos extratos.
- **Solução:**
  1. **Domínio Puro de Sobra & Capacidade de Aporte (`src/domain/overview/surplus.ts`):**
     - Motor `calculateSurplusCapacity`: apura deterministamente a Sobra Líquida Real do ciclo mensal descontando despesas, faturas em aberto e compromissos/dívidas pendentes, derivando a capacidade ideal de aporte (`suggestedAporteCents`).
  2. **Gatilhos da Bola de Neve (`src/domain/portfolio/snowball.ts`):**
     - Motor puro `detectReinvestmentOpportunities`: rastreia ativos cuja soma de proventos no mês permite adquirir $\ge 1$ nova cota a mercado (`purchasableShares >= 1`), calculando o valor total de compra e as sobras fracionárias.
  3. **Auto-Snapshots Patrimoniais (`src/hooks/use-auto-portfolio-snapshot.ts`):**
     - Rotina inteligente client-side: ao carregar a carteira em um novo mês sem snapshot registrado, materializa automaticamente o `total_value` e `total_cost` via `upsertPortfolioSnapshot`, assegurando continuidade absoluta da série temporal sem exigir ações manuais.
  4. **Interface & Deep Linking (`SurplusAporteBanner`, `SnowballActionCard`, `OverviewPage`, `InvestmentsPage`, `AporteTab`, `ProventosTab`):**
     - `SurplusAporteBanner` exibido proativamente na Visão Geral com o valor líquido disponível e botão "Simular Aporte" que navega para `/carteira?tab=aporte&valor=XXXXX`;
     - `AporteTab` consome e pré-preenche o valor do aporte via query params sem disparar renders em cascata;
     - `SnowballActionCard` em `ProventosTab` listando as oportunidades ativas da Bola de Neve com atalho "Reinvestir Provento" integrado ao `InvestmentWizard`;
     - Sincronização bidirecional de abas em `InvestmentsPage` com a URL via `useSearchParams`.
## F51 — Radar Preditivo de Descasamento de Fluxo (Cash-Gap) & Runway Diário (2026-08-24)

- **Problema:**
  1. O usuário podia ter saldo suficiente para o total de despesas do mês, mas enfrentar descasamento temporal (ex: fatura de cartão vencendo no dia 05 e salário entrando apenas no dia 15);
  2. Falta de visibilidade prévia sobre dias em que o saldo em conta corrente ficaria temporariamente negativo antes do recebimento de receitas habituais;
  3. Ausência de alertas acionáveis sugerindo contingências prévias (realocação temporária de caixa ou postergação de contas flexíveis).
- **Solução:**
  1. **Domínio Puro de Cash-Gap & Runway Diário (`src/domain/projection/cash-gap.ts`):**
     - Motor `analyzeCashGap`: simula cronologicamente a evolução do saldo bancário dia a dia até o encerramento do mês;
     - Cruzamento dinâmico de datas de vencimento de faturas de cartão de crédito e contas/dívidas a pagar com entradas previstas (salários, dívidas a receber);
     - Detecção antecipada de descasamento temporal com cálculo do dia inicial do déficit, valor máximo faltante (`maxDeficitCents`), dias até o gap (`daysUntilGap`) e data de cobertura pela próxima renda (`nextInflowDate`);
     - Classificação semântica de gravidade: `critical` ($\le 3$ dias) vs. `warning` ($4-10$ dias).
  2. **Interface & Alerta Proativo (`CashGapAlert`, `OverviewPage`):**
     - Componente `CashGapAlert` estilizado com as cores e badges semânticas do Design System (`bg-warning/5 border-warning/40` ou `bg-critical/5 border-critical/40`);
     - Mensagem clara orientada à ação informando as datas exatas e o montante faltante, com CTA "Ver Contas e Vencimentos" direcionando para o gerenciamento de dívidas e compromissos;
     - Integração fluida no topo da Visão Geral sob o card hero de caixa.
## F52 — Inteligência Ativa de Alocação & Metas de Longo Prazo: Alertas de Desvio (Threshold Δ), Previsão da Reserva & Impacto FIRE (2026-08-24)

- **Problema:**
  1. O usuário não tinha visibilidade imediata de quais classes ou ativos estavam desbalanceados em relação às metas estipuladas de carteira;
  2. A Reserva de Emergência exibia apenas o status atual de meses cobertos, sem projetar o tempo e a data estimada para atingir os marcos de 3, 6 e 12 meses com base na velocidade de poupança;
  3. Não havia uma ponte quantitativa demonstrando o impacto financeiro de longo prazo que a eliminação de pequenos gastos recorrentes supérfluos produz na antecipação da independência financeira (FIRE).
- **Solução:**
  1. **Domínio Puro de Thresholds de Alocação (`src/domain/portfolio/thresholds.ts`):**
     - Motor `calculateAllocationDrift`: monitora o desvio percentual de cada ativo em relação à meta de alocação ($\Delta > \pm 5\%$), identificando ativos/classes *underweight* e calculando o aporte financeiro exato necessário para equilibrar a carteira (`recommendedAporteCents`).
  2. **Domínio Puro de Longo Prazo & Impacto FIRE (`src/domain/fire/`):**
     - Motor `projectEmergencyFund`: projeta marcos de 3, 6 e 12 meses de custo de vida essencial considerando o ritmo mensal de poupança/investimento, gerando o progresso percentual e a estimativa do mês de conclusão;
     - Motor `calculateHabitFireImpact`: capitaliza o valor futuro em 10, 20 e 30 anos gerado pela economia de gastos supérfluos/assinaturas e calcula a redução da meta FIRE e os anos de liberdade antecipados.
  3. **Interface & Módulos Analíticos (`AllocationDriftCard`, `PlanningSection`, `ResumoTab`):**
     - Componente `AllocationDriftCard` integrado na aba Resumo de Investimentos (`ResumoTab`) apresentando os ativos abaixo da meta e botão de ação rápida "Simular Rebalanceamento";
     - `PlanningSection` aprimorado com o Termômetro Preditivo da Reserva de Emergência em 3 faixas e o Simulador Interativo do Impacto de Hábitos na Aposentadoria.
  4. **Refinamentos de UX/UI & Padronização Visual:**
     - **Calculadora de Aporte (`AporteResult`):** Implementada visualização compacta e colapsável por prioridade de aporte nas seções *Macro por Classe* e *Meso por Setor*, exibindo inicialmente apenas as classes e setores com aporte alocado e botão de expansão "Ver todas / Recolher";
     - **Card Hero de Caixa Real (`RealCashHeroCard`):** Padronização visual estrita com os cards da Home, adotando ícones e botões neutros (`border-border/80`, `bg-surface-hover/80`, `text-muted-foreground`), desacoplados de variações de cor de destaque de tema, e rotulagem explícita de `Faturas e contas a pagar do ciclo (bruto)`;
     - **Harmonização de Métricas (Bruto como Padrão em Todo o App):** Overview, Orçamentos e KPIs padronizados para exibir valores nominais brutos como métrica primária, exibindo a cota ponderada (`Ponderado: R$ X,XX`) como detalhe secundário sempre que houver despesas com pesos compartilhados;
     - **Sincronização Reativa de Abas (`InvestmentsPage`):** Derivação direta da aba ativa a partir dos search params (`useSearchParams`), assegurando navegação instantânea de deep links sem descompasso de estado.
  5. **Qualidade & Testes:**
     - Suíte completa de testes unitários de domínio e testes de componentes com 100% de cobertura e conformidade total com acessibilidade.

## F53 — Padronização Global de Animações Numéricas, NumberTicker & Efeitos Visuais do Design System (2026-08-24)

- **Problema:**
  1. A interpolação suave de números (`NumberTicker`) só estava conectada a `KpiCard`, deixando cards de destaque (`RealCashHeroCard`, `SurplusAporteBanner`, `AporteResult`, `ProventosTab`, `DebtsPage`, `BudgetsPage`, `CreditCard3D`) com números estáticos;
  2. Incongruências de termos e casing (`ponderado` vs `Ponderado:` vs `"Sua cota"`);
  3. Mini barras de progresso com durações de transição divergentes (`duration-500` vs `duration-300`).
- **Solução:**
  1. **Evolução do Primitivo `MoneyText` (`src/components/ui/money-text.tsx`):**
     - Adicionada a propriedade `animated?: boolean` conectada nativamente ao `NumberTicker`, respeitando a preferência de acessibilidade do usuário (`prefers-reduced-motion`) e o toggle global das Configurações (`visual.numberTickerEnabled`);
     - Exportação de `NumberTicker` e `NumberTickerProps` no barrel `src/components/ui/index.ts`.
  2. **Animações Numéricas nos Cards Hero e Resumos em Todo o App:**
     - `RealCashHeroCard`: Saldo Disponível em Conta e Saldo Livre Real (Safe-to-Spend) com transição animada fluida;
     - `OverviewPage`: Saldo líquido de contas e Taxa de Poupança animadas;
     - `SurplusAporteBanner`: Capacidade de Aporte estimada com animação de valor;
     - `AporteResult`: Cards de aporte informado, alocado e sobra de caixa animados;
     - `ProventosTab`: Total anual de proventos animado e barras de progresso padronizadas com `duration-300 ease-out`;
     - `CreditCard3D`: Fatura bruta e fatura ponderada animadas com `NumberTicker`;
     - `DebtsPage` & `BudgetsPage`: Régua de métricas e cards de resumo com valores animados;
     - `ReportsPage`: Cards de resumo de Receitas Totais, Despesas Totais, Poupança, Patrimônio e DRE animados.
  3. **Harmonização do Design System:**
     - Padronização estrita de `Ponderada:` e `Ponderado:` em todas as exibições secundárias;
     - Transições de progresso e hover neutros padronizados.
  4. **Padronização da Página de Relatórios (`ReportsPage`):**
     - Cabeçalho padronizado (`<header>`) com título, subtítulo e hierarquia visual idêntica às páginas de Análise e Planejamento (`InvestmentsPage`, `DebtsPage`, `InsightsPage`);
     - Navegação estrita pelo primitivo `Tabs` com suporte a gestos de swipe horizontal (`swipeable`), navegação por teclado e sincronização bidirecional de URLs (`?tab=` e `?aba=`);
     - Reorganização de layout com o Caderno de Relatórios em Excel (.xlsx) posicionado no rodapé da página.
  5. **Padronização e Responsividade do Painel Administrativo (`AdminPage`):**
     - Remoção do padding e margens duplicadas na casca externa da página (`max-w-7xl` e `p-3.5 sm:p-6 lg:p-8`), liberando todo o espaço útil do container raiz do app;
     - Cabeçalho padronizado (`<header>`) com título, subtítulo e tipografia alinhados com o Design System;
     - Navegação nativa via componente `Tabs` com `swipeable`, suporte a gestos e persistência de query params (`?aba=` e `?tab=`);
     - Grid de KPIs na Visão Geral reorganizado (`grid-cols-2 sm:grid-cols-3 xl:grid-cols-6`) com cards espaçosos e números animados (`NumberTicker`);
     - Visualização adaptativa para Mobile (Cards otimizados com áreas de toque ampliadas) e Desktop/Tablets (tabelas completas com hover e espaçamento ideal) nas abas de Visão Geral, Usuários, Convites e Auditoria;
     - Cartões de Kill-Switch (`FeatureToggleCard`) aprimorados com ícones semânticos, badges e botões responsivos.
  6. **Reorganização de Ferramentas de Carteira & Contextualização de Importação:**
     - Remoção da barra de ferramentas/atalhos genéricos da aba Carteira (`ResumoTab`), eliminando a mistura de contextos e dependências não utilizadas;
     - Integração contextual do bloco de **Importação via Planilha (.xlsx/.csv)** diretamente na aba **Aporte** (`AporteTab`), permitindo ao usuário atualizar posições de carteira imediatamente antes da simulação de aportes;
     - Exclusão de arquivos e abas duplicadas/órfãs (`relatorios-tab.tsx`), mantendo as fichas IRPF e monitor DARF centralizados na Central de Relatórios (`/relatorios`);
     - Adição de suite de testes dedicada para `AporteTab` (`aporte-tab.test.tsx`).
  7. **Qualidade & Testes:**
     - Testes unitários de `AporteTab`, `ResumoTab`, `MoneyText`, `NumberTicker`, `ReportsPage` e `AdminPage` 100% aprovados;
     - 232 arquivos de teste e 1700 testes executados com sucesso;
     - Typecheck, ESLint e Build de produção gerados com sucesso.

## F54 — Simplificação Condicional do Modal de Ativo (2026-08-25)

- **Problema:** O modal "Editar Ativo" (`AssetEditDialog`) e o `AssetFormDialog` exibiam todos os campos simultaneamente independentemente do tipo de ativo, resultando em um formulário longo e cognitivamente pesado com campos irrelevantes para a maioria dos casos de uso.

- **Solução:** Refatoração dos três componentes afetados para exibição contextual e progressiva dos campos, sem remover nenhum dado do banco — apenas ajustando a visibilidade na UI:

  1. **Campo "Moeda" condicional** (`asset-edit-dialog.tsx`, `asset-form-dialog.tsx`):
     - Oculto automaticamente (currency fixada em `BRL`) para Ações, FIIs, ETFs, Renda Fixa, Cripto e Caixa;
     - Visível apenas para `BDRs` e `Internacional (EUA)`, onde a escolha de USD é semanticamente relevante;
     - Mudança de classe reseta automaticamente para `BRL` quando a nova classe não requer seleção de moeda.

  2. **Campo "Setor" adaptativo por classe**:
     - **Caixa:** oculto (sem setor útil);
     - **Renda Fixa / Tesouro:** exibe somente chips de seleção rápida (Pós-fixado / Inflação / Prefixado / Crédito Privado) sem input de texto livre; label renomeado para "Indexador / Segmento";
     - **Demais classes:** comportamento anterior preservado (input de texto + chips de sugestão).

  3. **Modo de Precificação do Tesouro — colapsado por padrão** (`asset-edit-dialog.tsx`, `asset-form-dialog.tsx`):
     - O seletor visual "Valor Completo / Preço Médio" inicia sempre colapsado (padrão `total_value`);
     - Exibe um link discreto "Usar modo Preço Médio / Cotas (avançado)" para expandir quando necessário;
     - Ativos já cadastrados em modo cotas (`[PRICING:UNIT]`) abrem o seletor automaticamente.

  4. **`FixedIncomeFormFields` — campos avançados e isenção de IR condicional** (`fixed-income-form-fields.tsx`):
     - **Data de Vencimento** promovida para a seção principal (sempre visível);
     - **Data-Base D₀ e Aplicação Original** movidas para um acordeão "Configurações avançadas" colapsado por padrão; expande automaticamente se já houver dados preenchidos;
     - **Isenção de IR ocultada** quando `isTesouro === true` — Tesouro Direto nunca é isento de IR, e o campo gerava confusão.

  5. **Proventos — visibilidade por tipo de ativo** (`asset-edit-dialog.tsx`):
     - **Renda Fixa / Tesouro:** bloco controlado por checkbox _"Distribui juros / cupons periodicamente (NTN-B, CRI, CRA, debêntures)"_; desmarcado limpa os campos; marcado expande o painel; ativo com dados já salvos abre o painel automaticamente;
     - **Ações / FIIs / ETFs / BDRs / Internacional:** bloco colapsado por padrão, acessível via link "+ Adicionar proventos anteriores ao cadastro (opcional)"; ativo com dados já salvos expande automaticamente;
     - **Cripto / Caixa:** bloco removido completamente (sem proventos no escopo do app).

- **Arquivos alterados:**
  - `src/features/investments/components/fixed-income-form-fields.tsx` — accordion avançado + isenção IR condicional;
  - `src/features/investments/components/asset-edit-dialog.tsx` — todos os blocos condicionais (1–5);
  - `src/features/investments/components/asset-form-dialog.tsx` — blocos 1–3 (Moeda, Setor, Tesouro);
  - `src/features/investments/components/asset-form-dialog.test.tsx` — teste do Tesouro atualizado para o novo fluxo de expansão.

- **Qualidade:**
  - Typecheck (`tsc --noEmit`): sem erros;
  - ESLint: sem violações;
  - 14/14 testes de componente aprovados.

## F55 — Remoção Definitiva do Modo Preço Médio / Cotas para Tesouro Direto (2026-08-25)

- **Problema:** A tentativa de modelar frações de títulos do Tesouro Direto como se fossem ações (Preço Médio / Cotas com tag `[PRICING:UNIT]` em `notes`) gerava complexidade excessiva, branching duplicado em 10+ arquivos, campos de anotações poluídos e atrito de configuração para o usuário, que precisava calcular e preencher manualmente o Preço Unitário (PU) sem cotação automática da API.
- **Solução:** Padronização canônica e definitiva da Renda Fixa e Tesouro Direto no modo **Valor Completo (`total_value`)**:
  1. **Domínio (`valuation.ts`, `valuation.test.ts`):**
     - `getAssetPricingMode`: Tesouro Direto e Renda Fixa são deterministicamente `total_value`, sem leitura de tags em `notes`;
     - `calculatePositionSummary`: Fortalecido para calcular `totalCost = quantity * averagePrice` com segurança caso haja ativos legados no banco com frações de cotas (`quantity > 0 && quantity !== 1`).
  2. **Diálogos e Formulários (`asset-edit-dialog.tsx`, `asset-form-dialog.tsx`):**
     - Removidos estados `tesouroMode` e `showTesouroModeSelector`;
     - Removida a injeção e leitura de tags `[PRICING:UNIT]` e `[PRICING:TOTAL]` no campo de anotações;
     - Diálogos simplificados exibem diretamente Valor Inicial Investido e Saldo Atual / Final;
     - Testes de formulário (`asset-form-dialog.test.tsx`) atualizados para validar o fluxo padronizado.
  3. **Wizard de Investimentos (`wizard-state.ts`, `step-new-position.tsx`, `step-order.tsx`, `step-review.tsx`, `investment-wizard.tsx`):**
     - Removido o campo `pricingMode` de `InvestmentWizardState`;
     - Removido o seletor de modo Tesouro de `StepNewPosition`;
     - Simplificadas as verificações de `isTotalValue` em `StepOrder`, `StepReview`, `canProceed` e `calculateInvestmentPreview`.
- **Arquivos alterados:**
  - `src/domain/portfolio/valuation.ts`
  - `src/domain/portfolio/valuation.test.ts`
  - `src/features/investments/components/asset-edit-dialog.tsx`
  - `src/features/investments/components/asset-form-dialog.tsx`
  - `src/features/investments/components/asset-form-dialog.test.tsx`
  - `src/features/investments/wizard/wizard-state.ts`
  - `src/features/investments/wizard/step-new-position.tsx`
  - `src/features/investments/wizard/step-order.tsx`
  - `src/features/investments/wizard/step-review.tsx`
  - `src/features/investments/wizard/investment-wizard.tsx`
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 40 arquivos de teste e 367/367 testes unitários e de componentes aprovados com 100% de sucesso.

## F56 — Colunas Contextuais por Classe na Tabela de Posições e Governança de Caixa (2026-08-25)

- **Problema:** A tabela de posições (`PositionTable`) utilizava uma grade única de 7 colunas de Renda Variável (`Ativo`, `Quantidade`, `Preço`, `Custo médio`, `Valor`, `Lucro/Prejuízo`, `Rentab.`) para todas as classes. Na Renda Fixa e Tesouro Direto, a coluna `Quantidade` ficava vazia (`—`), `Preço` e `Valor` duplicavam o mesmo número e `Custo médio` era um termo inadequado para o capital aplicado inicial. Além disso, ativos de Caixa podiam poluir a tabela de investimentos quando seu lugar exclusivo é o Card de Caixa / Hero Card.
- **Solução:**
  1. **Governança Estrita de Caixa:** `PositionTable` filtra `!r.isCash` por padrão; o Caixa fica concentrado exclusivamente no Card de Caixa dedicado no topo da tela, sendo removido dos filtros de classe e da listagem de posições.
  2. **Colunas Contextuais Semânticas de Renda Fixa:**
     - `Ativo` (Ticker + badge de taxa/indexador e atalho de detalhes);
     - `Valor Aplicado` (Custo inicial investido via `MoneyText`);
     - `Saldo Atual` (Saldo bruto com botão de calibragem/cotação manual);
     - `Rendimento` (Ganho bruto em R$ com cor semântica e sinal explícito);
     - `Rentabilidade` (% de retorno);
     - `Vencimento` (Data formatada `dd/mm/aaaa` via `formatDateBR` com badge "Vencido" se aplicável).
  3. **Preservação de Renda Variável:** Ações, FIIs, ETFs, BDRs e Internacional mantêm as 7 colunas clássicas de custódia por cotas (`Quantidade`, `Preço`, `Custo médio`, `Valor`, etc.).
  4. **Ordenação Adaptativa:** Suporte a ordenação por `maturityDate` (data de vencimento) e por custo total aplicado no cabeçalho.
- **Arquivos alterados:**
  - `src/components/modules/position-table.tsx` — colunas contextuais (`fixedIncomeColumns`, `variableIncomeColumns`), exclusão de Caixa, `getColumnsForClass` e ordenação por `maturityDate`;
  - `src/components/modules/position-table.test.tsx` — suite atualizada com 13 testes cobrindo colunas semânticas de RF, custódia de RV e exclusão de Caixa.
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 13/13 testes de `PositionTable` e 367/367 testes de investimentos aprovados.

## F57 — Refinamento dos Modais de Detalhe e Unificação do Saldo de Renda Fixa (2026-08-25)

- **Problema:** 
  1. O modal de detalhes do ativo (`AssetDetailSheet`) exibia dados duplicados (classe e setor repetidos no subtítulo e nas badges), exibia badge de moeda `BRL` desnecessária, formatava datas de vencimento em formato ISO bruto (`2027-01-04`) e exibia um card de `Yield on Cost (YoC) 0.00%` para títulos acumulativos de Renda Fixa sem proventos periódicos.
  2. Quando títulos de Renda Fixa eram cadastrados com taxa zerada/não informada (`rate_value = 0`), badges exibiam `0% a.a. • Projetado` ou `0% CDI` de forma inconsistente.
  3. O diálogo de cotação manual (`ManualPriceDialog`) continha terminologias de ações ("preço unitário", "cotação API", "usar cotação automática") inadequadas para Renda Fixa e Tesouro Direto.
- **Solução:**
  1. **Governança de Taxa Zerada em Renda Fixa:** Se a taxa contratada for $\le 0$ ou omitida, o sistema suprime badges de taxa projetada e sinaliza no card e na tabela como **"Saldo cadastrado manual"**.
  2. **Refinamento do `AssetDetailSheet`:**
     - Subtítulo limpo e badges sem duplicação de classe/setor e sem badge `BRL`;
     - Data de vencimento formatada via `formatDateBR` (`04/01/2027`);
     - Card de custo ajustado para **"Valor Aplicado"** (em vez de "Preço Inicial");
     - Card contextual: se for Renda Fixa acumulativa sem proventos (`totalDividends === 0`), substitui o *YoC 0.00%* por **"Vencimento & Prazo"**;
     - Botão `Rendimento` condicionado a ativos que distribuem proventos/juros periódicos.
  3. **Unificação do Saldo de Renda Fixa via Calibração de Extrato:**
     - O clique no **Saldo Atual** de Renda Fixa na `PositionTable` aciona diretamente o diálogo **"Calibrar com Extrato"** (`CalibrateFixedIncomeDialog`), permitindo ajustar o saldo oficial e registrar a data de Marco Zero ($D_0$) com `MoneyInput`.
     - O diálogo `ManualPriceDialog` foi mantido 100% exclusivo para Renda Variável (Ações, FIIs, etc.).
- **Arquivos alterados:**
  - `src/features/investments/components/asset-detail-sheet.tsx` — badges limpas, data pt-BR, governança de taxa zerada, card "Valor Aplicado", card contextual Vencimento/YoC e botão de rendimento condicional;
  - `src/features/investments/components/asset-detail-sheet.test.tsx` — testes para RV e RF (com e sem taxa);
  - `src/features/investments/components/manual-price-dialog.tsx` — focado exclusivamente em Renda Variável;
  - `src/components/modules/position-table.tsx` — suporte à prop `onCalibrateAsset` e tratamento de taxa zerada na badge de ticker;
  - `src/features/investments/pages/resumo-tab.tsx` — integração de `onCalibrateAsset` com `CalibrateFixedIncomeDialog`.
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 22 arquivos de teste e 95/95 testes de investimentos aprovados com 100% de sucesso.

## F58 — Inteligência e Governança Tributária de Renda Fixa (Estratégia A + B) & Supressão Estrita de IR (2026-08-25)

- **Problema:**
  1. Quando um título de Renda Fixa antigo era cadastrado sem que o usuário informasse a data da aplicação original ou se a taxa de remuneração estivesse zerada (saldo manual), o sistema assumia a data de hoje ($D_0$) como início do prazo contábil;
  2. Isso gerava uma alíquota máxima e imprecisa de $22,5\%$ e uma contagem regressiva enganosa (`IR 22.5% ➔ 20% em 181d`), quando na realidade o título poderia já estar na alíquota mínima de $15\%$ ou nem possuir dados suficientes para estimativa de IR.
- **Solução:**
  1. **Opção Avançada de Tributação (`FixedIncomeFormFields`, `AssetEditDialog`, `InvestmentWizard`):**
     - Adicionado campo opcional e discreto no acordeão de configurações avançadas permitindo que o usuário selecione a alíquota fixa vigente (`15,0%`, `17,5%`, `20,0%`, `22,5%` ou `Automático pela data de aplicação`);
     - Permite que usuários com títulos antigos na corretora travem a alíquota exata sem precisarem buscar notas de corretagem antigas.
  2. **Motor de Domínio Puro (`src/domain/portfolio/fixed-income.ts` & `src/types/schema.ts`):**
     - Suporte a `manual_tax_rate_pct` em `FixedIncomeMetadata` e `getFixedIncomeTaxRatePct`;
     - Regra de supressão estrita: se a data inicial não foi informada no passado (`hasExplicitDate === false`) e a alíquota não foi fixada manualmente, a contagem regressiva `taxCountdown` é suprimida;
     - Propriedade determinística `hasExplicitTaxInfo` para governança de renderização de badges e textos tributários.
  3. **Interface Adaptativa (`AssetDetailSheet`):**
     - Se o ativo não possuir taxa contratada informada E a data inicial não tiver sido preenchida retroativamente, qualquer menção/badge de IR é estritamente ocultada da interface, mantendo a visualização limpa e livre de dados imprecisos.
- **Arquivos alterados:**
  - `src/types/schema.ts` — inclusão de `manual_tax_rate_pct` em `FixedIncomeMetadata`;
  - `src/domain/portfolio/schemas.ts` — validação Zod para `manual_tax_rate_pct`;
  - `src/domain/portfolio/fixed-income.ts` — suporte a alíquota manual e `hasExplicitTaxInfo`;
  - `src/domain/portfolio/fixed-income.test.ts` — testes unitários para alíquota manual e supressão de countdown;
  - `src/domain/portfolio/valuation.ts` — propagação de `manual_tax_rate_pct`;
  - `src/features/investments/components/fixed-income-form-fields.tsx` — seletor de alíquota em configurações avançadas;
  - `src/features/investments/components/asset-edit-dialog.tsx` — persistência de `manual_tax_rate_pct`;
  - `src/features/investments/wizard/wizard-state.ts` & `step-new-position.tsx` & `investment-wizard.tsx` — fluxo de criação no wizard;
  - `src/features/investments/components/asset-detail-sheet.tsx` — supressão estrita de badges e legendas de IR;
  - `src/features/investments/components/asset-detail-sheet.test.tsx` — testes para supressão de IR.
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 40 arquivos e 371/371 testes aprovados com 100% de sucesso.

## F59 — Simplificação, Remoção de Redundâncias & Harmonização Visual do Wizard de Novo Ativo (2026-08-25)

- **Problema:**
  1. No Passo 2 (Posição) do Wizard de Novo Ativo, os formulários reexibiam inputs de Ticker e Classe de Ativo que o usuário já havia acabado de preencher no Passo 1 (Identificação);
  2. O seletor de Moeda aparecia com valor BRL para todas as classes nacionais, ocupando espaço desnecessário;
  3. O bloco de proventos históricos ficava sempre aberto com múltiplos campos monetários, poluindo ativos que não possuem fluxo de dividendos (como CDBs acumulativos e Criptomoedas);
  4. Fragmentação excessiva em cards empilhados causando scroll longo no modal.
- **Solução:**
  1. **Cabeçalho Compacto de Resumo:**
     - Substituição dos inputs de Ticker e Classe por um cabeçalho limpo no topo do Passo 2 (`[ TICKER ] · [ Nome da Classe ]` + badge de moeda se estrangeiro);
  2. **Divulgação Progressiva de Moeda & Setor:**
     - O campo de Moeda é exibido exclusivamente para classes que aceitam moedas estrangeiras (`Internacional`, `BDRs`), sendo omitido para ativos 100% em BRL;
     - Campo de Setor/Segmento contextual para Renda Variável;
  3. **Proventos & Anotações Colapsáveis:**
     - Para Renda Fixa: checkbox discreto `[ ] Distribui juros / cupons periodicamente (NTN-B, CRI, CRA, debêntures)` (desmarcado por padrão para CDBs e LCIs/LCAs);
     - Para Renda Variável: link textual discreto `+ Adicionar proventos anteriores ao cadastro (opcional)`;
     - Para Cripto e Caixa: bloco de proventos completamente desabilitado (não aplicável);
     - Anotações integradas via link colapsável `+ Adicionar anotações ou descrição (opcional)`.
- **Arquivos alterados:**
  - `src/features/investments/wizard/step-new-position.tsx` — reestruturação completa com layout compacto e contextual por classe;
  - `src/features/investments/wizard/investment-wizard.test.tsx` — asserções atualizadas para o novo cabeçalho de resumo.
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 2 arquivos e 20/20 testes do wizard aprovados (100% de sucesso).

## F60 — Responsividade Mobile do Resultado de Aportes (`AporteResult`) via Cards Adaptativos (2026-08-25)

- **Problema:**
  1. A tabela de simulação de aportes (`AporteResult`) continha 7 colunas com `flex-1` que, em telas mobile (< 640px), esmagavam cabeçalhos e valores monetários em colunas de ~45px;
  2. Textos quebravam de forma desalinhada e o botão de execução (*"Pendente" / "Feito"*) ficava deformado;
  3. A tabela em árvore hierárquica sofria compressão horizontal em telas estreitas.
- **Solução:**
  1. **Padrão Dual Canônico (Cards no Mobile + Tabela no Desktop):**
     - **No Mobile (`sm:hidden`):** Cada ativo sugerido para aporte é renderizado como um Card de Aporte Adaptativo (`border-border/80 bg-surface shadow-xs p-3.5`), com cabeçalho contendo Ticker, Classe, Setor e botão de Execução de toque fácil no canto superior direito, além de um grid 2 colunas com o *Aporte Sugerido* em destaque verde (`text-portfolio`) e *Atual ➔ Alvo*;
     - **No Desktop (`hidden sm:block`):** Tabela tabular completa preservada com `min-w-[700px]`, mantendo alinhamento numérico à direita e alta densidade;
  2. **Visualização em Árvore com Rolagem Destravada:**
     - Adicionado `min-w-[660px]` com `overflow-x-auto` na tabela hierárquica (Classe ➔ Setor ➔ Ativos), permitindo scroll suave sem corte de texto.
- **Arquivos alterados:**
  - `src/components/modules/aporte-result.tsx` — implementação da renderização dual mobile/desktop e largura segura para árvore;
  - `src/features/investments/pages/aporte-tab.test.tsx` — testes de AporteTab mantidos 100% verdes.
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 2/2 testes de `aporte-tab.test.tsx` aprovados.

## F61 — Auto-Criação de Ativo Caixa & Sincronização Consistente de Proventos e Vendas (2026-08-25)

- **Problema:**
  1. Ao registrar proventos ou vendas no Wizard com a opção `syncCash: true` (*"Creditar no saldo em caixa"*), caso a carteira do usuário ainda não contivesse um ativo pré-existente de classe `Caixa`, a variável `cashAsset` vinha nula;
  2. O motor `useRecordOrder` continha a guarda estrita `if (syncCash && cashAsset && totalBRL > 0)`, o que silenciosamente descartava o crédito do valor em caixa em vez de criar o ativo correspondente;
  3. O modal rápido de proventos (`DividendFormDialog`) não possuía o controle de sincronização com o Caixa (`syncCash`).
- **Solução:**
  1. **Auto-Criação Inteligente de Ativo Caixa no Motor Central (`useRecordOrder`):**
     - Em transações de **Provento** (`dividend`, `jcp`, `fii_yield`) e de **Venda** (`sell`), se `syncCash` estiver ativo:
       - Se o ativo `Caixa` já existir: soma o valor ao saldo atual (`updateAsset`);
       - Se o ativo `Caixa` NÃO existir: cria automaticamente o ativo `CAIXA` (`createAsset`) com Ticker `CAIXA`, Classe `Caixa`, Setor `Reserva / Liquidez`, Quantidade = valor creditado, Preço Médio = `1.00` e Moeda `BRL`;
  2. **Paridade no `DividendFormDialog`:**
     - Adicionado o checkbox `[x] Creditar provento no saldo em caixa (corretora)` (marcado por padrão) e integração completa com `useRecordOrder`;
  3. **Lookup Resiliente no Wizard:**
     - Busca do `cashAsset` por classe (`isCashAssetClass`) ou por ticker (`CAIXA`).
- **Arquivos alterados:**
  - `src/state/mutations/use-portfolio-mutations.ts` — suporte a auto-criação de ativo Caixa em `useRecordOrder`;
  - `src/features/investments/components/dividend-form-dialog.tsx` — adição de `syncCash` e uso de `recordOrder`;
  - `src/features/investments/components/dividend-form-dialog.test.tsx` — testes atualizados com mock de `useRecordOrder`;
  - `src/features/investments/wizard/investment-wizard.tsx` — busca resiliente por ticker ou classe de Caixa.
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 40 arquivos e 371/371 testes aprovados (100% de sucesso).

## F62 — Sincronização em Cascata de Aportes, Proventos e Histórico de Operações de Ativos (2026-08-25)

- **Problema:**
  1. Ao excluir um provento na aba **Proventos**, o registro era removido apenas de `portfolio_dividends`, mantendo a transação correspondente em `portfolio_transactions` (visível no histórico do modal de detalhes do ativo);
  2. Ao excluir um aporte financeiro na aba **Aportes**, o registro era removido apenas de `portfolio_contributions`, mantendo a transação correspondente no histórico do ativo;
  3. Ao excluir uma transação individual no modal de detalhes do ativo (`AssetDetailSheet`), o lançamento continuava visível nas abas de Proventos e Aportes.
- **Solução:**
  1. **Exclusões com Matching em Cascata no Repositório (`src/data/repositories/portfolio.ts`):**
     - Criadas funções de deleção por matching: `deletePortfolioTransactionsMatching`, `deletePortfolioDividendsMatching` e `deletePortfolioContributionsMatching`;
  2. **Mutations Sincronizadas Bidirecionalmente (`src/state/mutations/use-portfolio-mutations.ts`):**
     - `useDeletePortfolioDividend`: remove em `portfolio_dividends` e remove a transação vinculada em `portfolio_transactions` (matching por `asset_id`, `date`, tipo de provento e `total`);
     - `useDeletePortfolioContribution`: remove em `portfolio_contributions` e remove a transação de compra vinculada em `portfolio_transactions`;
     - `useDeletePortfolioTransaction`: remove em `portfolio_transactions` e remove o respectivo provento em `portfolio_dividends` (se provento) ou aporte em `portfolio_contributions` (se compra);
     - Suporte polimórfico a ID string (com resolução de metadados do cache) ou objeto completo;
     - Invalidação conjunta de queries (`dividends`, `contributions`, `transactions`, `allTransactions`, `assets`, `snapshots`);
  3. **Atualização das Telas e Modais:**
     - `proventos-tab.tsx`, `contributions-panel.tsx`, `contributions-list-dialog.tsx`, `asset-detail-sheet.tsx`, `portfolio-statement-dialog.tsx` e `transaction-list-dialog.tsx` atualizados para passar os objetos completos de exclusão;
  4. **Suíte de Testes Dedicada:**
     - Criado `src/state/mutations/use-portfolio-mutations.test.tsx` com 5 testes cobrindo todos os fluxos de cascata e resolução de cache.
- **Arquivos alterados:**
  - `src/data/repositories/portfolio.ts`
  - `src/state/mutations/use-portfolio-mutations.ts`
  - `src/state/mutations/use-portfolio-mutations.test.tsx` [NOVO]
  - `src/features/investments/pages/proventos-tab.tsx`
  - `src/features/investments/components/contributions-panel.tsx`
  - `src/features/investments/components/contributions-list-dialog.tsx`
  - `src/features/investments/components/asset-detail-sheet.tsx`
  - `src/features/investments/components/portfolio-statement-dialog.tsx`
  - `src/features/investments/components/transaction-list-dialog.tsx`
  - `src/features/investments/components/transaction-list-dialog.test.tsx`
  - `src/components/modules/aporte-result.test.tsx`
- **Qualidade & Verificação:**
  - Typecheck (`tsc -b`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Build de Produção (`npm run build`): 100% de sucesso;
  - Testes: 24 arquivos e 108/108 testes de investimentos e estado aprovados.

## F63 — Responsividade Mobile de Proventos por Ativo via Cards Adaptativos (2026-08-25)

- **Problema:**
  1. A tabela de consolidação de proventos por ativo (`ProventosTab`) continha 5 colunas monetárias e percentuais rígidas que sofriam compressão ou causavam quebra de visualização em dispositivos móveis (< 640px);
  2. A hierarquia visual não dava o devido destaque ao valor principal (*Total Recebido* e *Yield on Cost*).
- **Solução:**
  1. **Padrão Dual Canônico (Cards no Mobile + Tabela no Desktop):**
     - **No Mobile (`sm:hidden`):** Cada ativo é renderizado como um Card de Provento Adaptativo (`border-border/80 bg-surface shadow-xs p-3.5`), com cabeçalho contendo Ticker, Badge da Classe e indicador de Yield on Cost (*YoC: XX.XX%*) no canto superior direito, além de divisão horizontal comparando *Histórico Inicial / No App* à esquerda e o *Total Recebido* com destaque positivo verde (`text-positive-strong`) à direita;
     - **No Desktop (`hidden sm:block`):** Tabela tabular completa preservada com `min-w-[620px]` e rolagem horizontal suave;
  2. **Normalização Tipográfica em Relatórios:**
     - Ajustado `INVISIBLE_CHARS_REGEX` em `src/domain/reports/sanitize-text.ts` para conformidade com regras estritas de ESLint.
- **Arquivos alterados:**
  - `src/features/investments/pages/proventos-tab.tsx`
  - `src/domain/reports/sanitize-text.ts`
- **Qualidade & Verificação:**
  - Typecheck (`tsc -b`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Build de Produção (`npm run build`): 100% de sucesso;
  - Testes: 7/7 testes de `proventos-tab.test.tsx` aprovados.

## F64 — Modernização do Motor de Relatórios Executivos & Dossiês em PDF (A4) (2026-08-25)

- **Problema:**
  1. No Dossiê Fiscal de IRPF, 62 cards interativos de tela vazavam para a folha de impressão devido ao seletor forçado `.print-sheet section { display: flex !important; }` no CSS global, gerando 5 páginas em branco;
  2. No Dossiê de Carteira, os 4 KPIs de topo ficavam empilhados verticalmente ocupando toda a folha 1;
  3. Nomes e tickers de ativos como `CDB-BMG-JAN27` e `TESOURO-IPCA-29` exibiam caracteres corrompidos (losangos com ponto de interrogação ``) devido a hífens Unicode especiais não mapeados no renderer de PDF;
  4. Falta de zebra striping e contraste em tabelas longas de custódia e ausência de tratamento gracioso de seções vazias (*zero-state*).
- **Solução:**
  1. **Blindagem do CSS de Impressão (`globals.css`):**
     - Removido seletor genérico forçado `.print-sheet section`;
     - Blindada classe `.print:hidden` (`display: none !important; height: 0 !important; overflow: hidden !important; pointer-events: none !important;`);
     - Grade horizontal restaurada em `<ReportKpiGrid>` com `print:grid-cols-4`;
  2. **Sanitização Tipográfica Pura (`src/domain/reports/sanitize-text.ts`):**
     - Função pura com testes unitários em `sanitize-text.test.ts` normalizando hífens Unicode especiais (`\u2010`–`\u2015`, `\u2212` para `-`), espaços especiais (`\u00A0` para ` `) e caracteres invisíveis;
  3. **Ergonomia e Alto Contraste em Tabelas Contábeis:**
     - Zebra striping suave (`even:bg-slate-50/50 print:even:bg-slate-50/50`) em todas as tabelas;
     - Cabeçalhos de alto contraste (`bg-slate-100 text-slate-700 font-bold uppercase text-[10px]`) com repetição automática no topo de cada página (`display: table-header-group !important`);
     - Tratamento institucional gracioso de seções sem lançamentos (*zero-state*).
- **Arquivos alterados:**
  - `src/domain/reports/sanitize-text.ts` [NOVO]
  - `src/domain/reports/sanitize-text.test.ts` [NOVO]
  - `src/domain/reports/index.ts`
  - `src/styles/globals.css`
  - `src/components/modules/reports/report-kpi-grid.tsx`
  - `src/components/modules/reports/report-stacked-bar.tsx`
  - `src/components/modules/reports/report-risk-gauge.tsx`
  - `src/features/reports/components/tax-facilitator-modal.tsx`
  - `src/features/reports/components/wealth-tear-sheet-modal.tsx`
  - `src/features/reports/components/financial-close-report-modal.tsx`
  - `src/features/reports/components/dividend-freedom-modal.tsx`
  - `src/features/reports/components/consolidated-wealth-modal.tsx`
  - `docs/ROADMAP.md`
  - `docs/FASES_IMPLEMENTADAS.md`
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 249 arquivos e 1.798/1.798 testes aprovados (100% verde).


## F65 — Modernização Editorial & Visual dos Relatórios e PDFs (Meio-Termo Executivo & Tabelas Especializadas) (2026-08-25)

- **Problema:**
  1. No Dossiê Fiscal de IRPF (`TaxFacilitatorModal`), códigos fiscais ocupavam muito espaço (`03 - 01 (Ações)`), a discriminação não continha separadores de milhar (`2474,55`), apresentava concordância gramatical incorreta (`1 cotas de...`), e a Ficha de Rendimentos Isentos era quebrada para uma página 4 órfã;
  2. No Dossiê de Carteira (`WealthTearSheetModal`), cards de KPIs sofriam truncamento com reticências, havia 11 caixas/cards cinzas pesados no corpo da página e a tabela de custódia era monolítica com colunas vazias para Renda Fixa e linhas duplicadas por ativo;
  3. O usuário solicitou um meio-termo equilibrado: manter recursos visuais de alto impacto (barras empilhadas, sparklines, donuts, termômetros lineares e cascatas DRE), eliminando caixas cinzas pesadas e organizando os ativos em tabelas especializadas por classe em linha única por ativo.
- **Solução:**
  1. **Componente Reutilizável de Síntese Executiva (`ReportExecutiveSummary`):**
     - Faixa horizontal compacta com 4 métricas-chave integradas com síntese narrativa editorial contextual, eliminando a fadiga de molduras e cards cinzas pesados;
  2. **Tabelas Especializadas por Classe (`ReportClassTables`):**
     - Quatro tabelas com colunas sob medida para cada classe de ativos em linha única por ativo:
       - *Ações & FIIs:* Ticker, Setor/Segmento, Qtd, Preço Médio, Cotação, Total (R$), Retorno (%) e YoC (%);
       - *Renda Fixa / Tesouro:* Título / Emissor, Indexador / Vencimento, Qtd, Saldo Atual (R$) e Rendimento (%), sem colunas vazias de cotação ou YoC;
       - *Internacional:* Ticker, Setor/Tema, Qtd, Preço Médio, Cotação USD, Total (R$) e Retorno (%);
     - Zebra striping suave (`even:bg-slate-50/50 print:even:bg-slate-50/50`) e cabeçalhos de alto contraste (`bg-slate-100 text-slate-700 font-bold uppercase text-[9px]`);
  3. **Refinamento do Dossiê Fiscal de IRPF (`TaxFacilitatorModal` e `tax.ts`):**
     - Códigos fiscais compactados (`03-01 Ações`, `07-03 FIIs`, `04-02 Renda Fixa`, `07-09 Internacional`);
     - Formatação com pontuação de milhar (`R$ 2.474,55`) e concordância perfeita (`1 cota de...` vs `X cotas de...`);
     - Fluxo contínuo sem quebra de página órfã para a Ficha de Rendimentos Isentos;
  4. **Padronização Visual em Todos os Modais de Relatório:**
     - Aplicado `ReportExecutiveSummary` em `FinancialCloseReportModal`, `DividendFreedomModal`, `ConsolidatedWealthModal` e `PortfolioExecutiveReport`;
     - Ajustada a impressão do extrato da carteira (`PortfolioStatementDialog`), fatura de cartões (`CardInvoicePrintView`) e fechamento mensal (`MonthlyClosePrintView`).
- **Arquivos alterados:**
  - `src/components/modules/reports/report-executive-summary.tsx` [NOVO]
  - `src/components/modules/reports/report-class-tables.tsx` [NOVO]
  - `src/components/modules/reports/report-risk-gauge.tsx`
  - `src/components/modules/reports/index.ts`
  - `src/domain/portfolio/tax.ts`
  - `src/features/reports/components/tax-facilitator-modal.tsx`
  - `src/features/reports/components/wealth-tear-sheet-modal.tsx`
  - `src/features/reports/components/financial-close-report-modal.tsx`
  - `src/features/reports/components/dividend-freedom-modal.tsx`
  - `src/features/reports/components/consolidated-wealth-modal.tsx`
  - `src/features/investments/components/portfolio-executive-report.tsx`
  - `src/features/investments/components/portfolio-statement-dialog.tsx`
  - `src/components/modules/card-invoice-print-view.tsx`
  - `src/components/modules/monthly-close-print-view.tsx`
  - `docs/FASES_IMPLEMENTADAS.md`
- **Qualidade & Verificação:**
  - Typecheck (`tsc --noEmit`): 0 erros;
  - ESLint (`npm run lint`): 0 erros / 0 avisos;
  - Testes: 249 arquivos e 1.798/1.798 testes aprovados (100% verde).

### Refinamento de Espaçamento e Ritmo Vertical de Relatórios PDF (2026-08-26)
- **Problema:** o estilo de impressão forçava quebras artificiais estáticas por classe, gerando páginas semipreenchidas ou órfãs; a sobreposição de faixas de cabeçalho e mini-resumo no topo causava poluição visual e redundância de dados; valores em USD sofriam colisão por colunas estreitas; e faltava o símbolo `%` nos subtotais.
- **Solução:**
  1. **Padrão Contábil / Auditoria com `<tfoot>`:** substituição do mini-quadro pesado no topo por uma linha de subtotal consolidado no rodapé da tabela (`<tfoot>`), alinhando Custo, Saldo e Retorno diretamente sob suas colunas numéricas;
  2. **Cabeçalho Leve em Linha Única:** cabeçalho da classe simplificado para uma única barra elegante com acento cromático (`border-l-4`), contador de ativos e participação na carteira (`%`), eliminando repetições de dados;
  3. **Fluxo Contínuo Natural:** remoção de quebras artificiais intermediárias (`printBreakBefore`) entre classes, mantendo apenas a quebra editorial da Capa (Página 1) para a Custódia (Página 2+);
  4. **Ordenação Normalizada de Classes:** ordenação imune a acentuação (`Ações` $\rightarrow$ `FIIs` $\rightarrow$ `Internacional` $\rightarrow$ `Renda Fixa`);
  5. **Redistribuição Proporcional de Colunas:** colunas de moeda em dólar ampliadas (`15%` / `15%` / `17%`) com padding e `whitespace-nowrap`, eliminando colisão de valores monetários;
  6. **Eliminação de Truncamento:** substituição de `truncate` por `whitespace-normal break-words leading-tight`;
  7. **Padronização Monetária USD:** formato em locale pt-BR com prefixo explícito (`US$ 430,48`);
  8. Correção do percentual nos subtotais de classe (`{formatPercent(group.sharePct)}% da carteira`).
- **Arquivos alterados:**
  - `src/styles/globals.css`
  - `src/services/masks/money.ts`
  - `src/services/masks/money.test.ts`
  - `src/components/modules/reports/report-header.tsx`
  - `src/components/modules/reports/report-footer.tsx`
  - `src/components/modules/reports/report-executive-summary.tsx`
  - `src/components/modules/reports/report-risk-gauge.tsx`
  - `src/components/modules/reports/report-class-tables.tsx`
  - `src/components/modules/reports/reports.test.tsx`
  - `src/features/reports/components/wealth-tear-sheet-modal.tsx`
  - `docs/DESIGN_SYSTEM.md`
  - `docs/FASES_IMPLEMENTADAS.md`

### Otimização de Responsividade e Organização Visual Mobile (2026-08-26)
- **Problema:** no mobile (< 400px), o widget de orçamentos espremia os nomes de categorias ao lado de valores monetários longos e badges com classes ad-hoc; o cabeçalho do Fluxo Diário quebrava a legenda em coluna ocupando altura excessiva; o anel Donut de categorias gerava rolagem longa; e o card de ativo da carteira usava `grid-cols-1 xs:grid-cols-3` (empilhando 3 linhas verticais em mobile) e duplicava a exibição do Saldo Atual.
- **Solução:**
  1. **Widget de Orçamentos:** reorganizado em hierarquia de 2 linhas por categoria com micro-barra de progresso colorida (`h-1`), espaço total para o nome da categoria e bloco de uso consolidado com métrica em destaque;
  2. **Cabeçalho do Fluxo Diário:** alinhamento compacto em linha única adaptativa com micro-legendas (*Rec*, *Desp*, *Inv*), maximizando a área do gráfico;
  3. **Donut de Categorias:** anel SVG adaptativo (`size-28` em mobile até `size-40` em desktop) com redução do gap e espaçamento da lista (`space-y-1.5`);
  4. **Card de Ativo da Carteira (Mobile):** grid de 3 colunas nativo no mobile (`grid-cols-3 gap-1.5 sm:gap-2`), eliminação da duplicação do *Saldo Atual* para Renda Fixa e foco do topo em Ticker + Taxa e Rentabilidade percentual (`pctLabel`).
- **Arquivos alterados:**
  - `src/features/overview/pages/overview-page.tsx`
  - `src/components/modules/category-donut.tsx`
  - `src/components/modules/position-table.tsx`
  - `src/components/modules/dashboard-alerts-carousel.tsx`
  - `docs/FASES_IMPLEMENTADAS.md`

### Padronização e Harmonização dos Cards da Home (2026-08-26)
- **Problema:** no mobile e desktop, o card de Saldo Disponível quebrava em linhas desalinhadas no rodapé com frases compridas; o grid 2x2 de KPIs principais apresentava alturas desiguais entre cards com e sem sparkline; o Resumo Financeiro empilhava 3 linhas verticais no Saldo Líquido criando assimetria com a Taxa de Poupança; e os botões de CTA dos banners ficavam flutuando à direita.
- **Solução:**
  1. **Saldo Disponível em Conta (`RealCashHeroCard`):** cabeçalho flex adaptativo, badge `size="xs"` e sub-grid de 2 colunas no box inferior com rótulo conciso (*"Obrigações do ciclo"* e *"Saldo Livre Real"*);
  2. **Grid de KPIs Principais (`KpiCard`):** container com altura unificada (`min-h-[136px] sm:min-h-[148px]` e `h-full flex flex-col justify-between`), garantindo simetria perfeita na grade 2x2 no mobile;
  3. **Resumo Financeiro:** rodapé de *Saldo Líquido de Contas* com `grid-cols-3` no mobile (1 linha com 3 colunas compactas: *A receber*, *A pagar*, *Faturas*), alinhando a altura com o card de *Taxa de Poupança*;
  4. **Banners de Alerta (`PaceAlertBanner`, `CashGapAlert`, `SurplusAporteBanner`):** botões de CTA adaptativos (`w-full sm:w-auto`) para melhor ergonomia ao toque em smartphones;
  5. **Conformidade de Tokens:** migração de `bg-surface/90` para `bg-surface` canônico e padronização de todos os Badges com `size="xs"`.
- **Arquivos alterados:**
  - `src/components/modules/real-cash-hero-card.tsx`
  - `src/components/modules/kpi-card.tsx`
  - `src/features/overview/pages/overview-page.tsx`
  - `src/components/modules/pace-alert-banner.tsx`
  - `src/components/modules/cash-gap-alert.tsx`
  - `src/components/modules/surplus-aporte-banner.tsx`
  - `docs/FASES_IMPLEMENTADAS.md`

### Correção do Desacoplamento de Compras no Cartão do Saldo Disponível (2026-08-27)
- **Problema:** compras no cartão de crédito cadastradas como `payment_method: "credit_card"` ou com `card_id` estavam sendo indevidamente deduzidas do Saldo Disponível em Conta no dia da compra, porque o motor de caixa (`cash-ledger.ts`) verificava apenas o literal `"credit"`.
- **Solução:**
  1. **Motor de Fluxo de Caixa (`src/domain/cash/cash-ledger.ts`):** expansão do filtro para ignorar `credit_card`, `credit` e despesas com `card_id != null`. Compras no cartão agora afetam estritamente as *Obrigações do Ciclo* e o *Saldo Livre Real*, deduzindo o saldo bancário apenas no registro de liquidação da fatura (`card_payments`);
  2. **Suíte de Testes (`src/domain/cash/cash-ledger.test.ts`):** cobertura completa com o enum canônico `credit_card`, `card_id` e verificação de eventos de caixa;
  3. **Estabilidade de Testes (`src/features/debts/pages/debts-page.test.tsx`):** isolamento temporal no mock de vencimento para evitar flakiness na derivação de status.
- **Arquivos alterados:**
  - `src/domain/cash/cash-ledger.ts`
  - `src/domain/cash/cash-ledger.test.ts`
  - `src/features/debts/pages/debts-page.test.tsx`
  - `docs/FASES_IMPLEMENTADAS.md`

### Auditoria de Segurança Completa, Relatório Executivo & Remediações (2026-08-29)
- **Problema:** necessidade de certificar a segurança da aplicação contra as 5 principais categorias de vulnerabilidade (Banco sem Tranca/RLS, Permissão no Navegador vs Backend, IDOR, Chaves Expostas e XSS/Inputs), gerar relatório oficial auditável em PDF e remediar pontos residuais de segurança identificados.
- **Solução:**
  1. **Auditoria Estática & Revisão Arquitetural:** Varredura em 100% dos arquivos do repositório (PostgreSQL RLS, RPCs transacionais PL/pgSQL, Edge Functions Deno, Frontend React 19, workflows CI/CD e histórico Git completo);
  2. **Relatório Executivo em PDF (`docs/security-audit/relatorio-auditoria-seguranca.pdf`):** Produzido em padrão A4, 4 páginas, alta densidade e legibilidade, contendo capa, nota metodológica, resumo executivo, gráficos de rosca e barras de alta resolução, pontos fortes comprovados, tabela de achados com chips coloridos, recomendações priorizadas P1–P3 e as 3 issues do GitHub em formato Markdown prontas para uso;
  3. **Script Automatizado (`docs/security-audit/generate_report.py`):** Script Python isolado (ReportLab + Matplotlib) para gerar e atualizar o relatório em PDF;
  4. **Blindagem de Status Ativo na RPC `delete_card_payment` (Migration 0039):** Inclusão da trava `public.is_current_user_active()` para impedir que usuários suspensos ou inativos excluam pagamentos de cartão e cancelem estornos;
  5. **Backend Enforcement de Feature Flags no PostgreSQL (Migration 0039):** Criação da trigger `public.enforce_feature_flag_trigger()` em `portfolio_assets`, `portfolio_transactions`, `loans` e `budgets`, bloqueando mutações diretas via API REST caso a funcionalidade esteja desativada por Kill-Switch global ou restrição de usuário;
  6. **Hardening de Permissões no Schema `cron`:** Revogação explícita de acesso ao schema `cron` e tabelas `cron.job` para as roles `public`, `anon` e `authenticated` em `quotes-cron.sql` e `scripts/deploy-quotes.mjs`;
  7. **Cobertura de Testes Automatizados:** Criação de `src/data/repositories/feature-flags-backend.test.ts` e expansão de `card-payments.test.ts` para validar o bloqueio e propagação de erros pt-BR.
- **Arquivos alterados:**
  - `supabase/migrations/20260101000039_security_fixes_and_feature_flag_triggers.sql` [NOVO]
  - `docs/security-audit/generate_report.py` [NOVO]
  - `docs/security-audit/relatorio-auditoria-seguranca.pdf` [NOVO]
  - `src/data/repositories/feature-flags-backend.test.ts` [NOVO]
  - `src/data/repositories/card-payments.test.ts`
  - `supabase/quotes-cron.sql`
  - `scripts/deploy-quotes.mjs`
  - `docs/ROADMAP.md`
  - `docs/FASES_IMPLEMENTADAS.md`

### Redesign da Landing Page, Modelo SaaS & Ergonomia de Layout (2026-08-29)
- **Problema:** A Landing Page antiga utilizava componentes estáticos e simulador simplista que não expressavam a sofisticação do produto; faltava um modelo estruturado de precificação SaaS com 30 dias de degustação/trial e restrições de downgrade; e a usabilidade em páginas longas e navegação de perfil carecia de atalhos ergonômicos fluídos.
- **Solução:**
  1. **Redesign Editorial da Landing Page (`/apresentacao`, `/precos`, `/landing`):**
     - **Hero Editorial & Simulador FIRE Interativo (`HeroEditorial`, `MinimalWealthSimulator`, `FireProjectionCurve`):** Projeção matemática determinística de liberdade financeira com slider reativo, curva dinâmica SVG com marcadores de Marcos Patrimoniais (1º Salário Passivo, Metade do Custo de Vida, Liberdade Total 100%) e tempo estimado até a aposentadoria;
     - **Spotlight Cards & Product Narratives (`SpotlightCard`, `ProductNarratives`):** Efeito de iluminação radial no cursor mouse/touch destacando as 4 grandes fortalezas da plataforma (Controle & Orçamentos, Cartões & Parcelamentos, Projeções & Radar, Segurança Bancária RLS);
     - **Investments Showcase (`InvestmentsShowcase`):** Vitrine interativa de rebalanceamento e aporte inteligente simulando carteira multi-ativos com YoC e taxas reais;
     - **Pricing & FAQ Section (`PricingSection`, `FaqSection`):** Tabela de planos com toggle Mensal / Anual (2 meses grátis / 17% de desconto), badge de "Mais Escolhido", garantia incondicional e FAQ interativo;
     - **Mobile CTA Dock & Back to Top (`MobileCtaDock`, `BackToTop`):** Barra ergonômica fixada na base no mobile com gatilhos rápidos para Iniciar Degustação e Entrar;
     - **Scroll Reveal & Scroll Spy (`ScrollReveal`, `useLandingMetrics`):** Efeitos de revelação suave via IntersectionObserver sem bibliotecas pesadas de animação;
     - **Modais Legais (`LegalDialog`):** Termos de Uso e Política de Privacidade acessíveis diretamente pelo rodapé.
  2. **Arquitetura SaaS e Modelo de Assinaturas (`PROJETO_SAAS.md`):**
     - Especificação canônica dos 30 dias de degustação completa (Trial Pro), regras de downgrade suave para o plano Gratuito, limites de cartões/ativos e gatilhos de upgrade;
     - Primitivos e componentes de assinatura em `src/components/modules/subscription/` (`SubscriptionBadge`, `UpgradeDialog`, `CheckoutSheet`) e página de checkout dedicada `src/features/subscription/pages/subscription-checkout-page.tsx`;
     - Nova aba de "Assinatura" nas Configurações da conta (`SubscriptionTab`) exibindo dias restantes do trial, plano atual e histórico de faturas;
     - Tipagem e estado reativo com TanStack Query (`src/types/subscription.ts`, `src/state/queries/use-user-subscription.ts`).
  3. **Ergonomia e Atalhos no App Shell:**
     - **BackToTop Global (`src/components/layout/back-to-top.tsx`):** Botão flutuante ergonômico acima da BottomNav móvel com scrollToTop suave e hook de monitoramento cirúrgico `useContainerScroll` a 120fps sem re-renders;
     - **Logo Profile Button (`LogoProfileButton`):** Atalho no cabeçalho permitindo navegação rápida e direta ao perfil/configurações do usuário.
- **Arquivos alterados:**
  - `docs/PROJETO_SAAS.md` [NOVO]
  - `src/types/subscription.ts` [NOVO]
  - `src/components/modules/subscription/` [NOVO]
  - `src/features/subscription/` [NOVO]
  - `src/features/landing/components/hero-editorial.tsx` [NOVO]
  - `src/features/landing/components/minimal-wealth-simulator.tsx` [NOVO]
  - `src/features/landing/components/fire-projection-curve.tsx` [NOVO]
  - `src/features/landing/components/spotlight-card.tsx` [NOVO]
  - `src/features/landing/components/product-narratives.tsx` [NOVO]
  - `src/features/landing/components/investments-showcase.tsx` [NOVO]
  - `src/features/landing/components/legal-dialog.tsx` [NOVO]
  - `src/features/landing/components/mobile-cta-dock.tsx` [NOVO]
  - `src/features/landing/components/scroll-reveal.tsx` [NOVO]
  - `src/features/landing/components/scroll-reveal-context.tsx` [NOVO]
  - `src/components/layout/back-to-top.tsx` [NOVO]
  - `src/components/layout/logo-profile-button.tsx`
  - `src/hooks/use-container-scroll.ts` [NOVO]
  - `src/features/settings/components/tabs/subscription-tab.tsx` [NOVO]
  - `src/state/queries/use-user-subscription.ts` [NOVO]
  - `docs/PROJECT_STRUCTURE.md`
  - `docs/FASES_IMPLEMENTADAS.md`

## F74 — Aprimoramento de Liquidação de Renda Fixa & Resiliência de Cotações Internacionais

- **Problema:** 
  1. Ao resgatar ou liquidar títulos de Renda Fixa no vencimento, o sistema limitava a operação ao custo de aquisição inicial (`average_price`), bloqueando o resgate pelo valor total rentabilizado acumulado.
  2. Tickers internacionais de 1 letra (como `O` — Realty Income, `T` — AT&T) eram incorretamente convertidos para o sufixo `.SA` (B3) pela Edge Function de cotações, falhando a consulta no Yahoo Finance e caindo no fallback manual.
- **Solução:**
  1. **Motor de Resgate e Liquidação de Renda Fixa (`wizard-state.ts`, `step-order.tsx`, `quick-transaction-sheet.tsx`, `use-portfolio-mutations.ts`):**
     - Cálculo em tempo real do saldo bruto e líquido com rendimento acumulado via `getFixedIncomeRedemptionInfo`;
     - Liberação do teto de resgate para o saldo bruto total (`grossValue`);
     - Atalhos percentuais (25%, 50%, 75%, 100%) calibrados com o saldo rentabilizado;
     - Encerramento contábil da custódia (`quantity: 0`, `average_price: 0`) e crédito líquido no Caixa no resgate total;
     - Exibição simultânea de Saldo Aplicado, Saldo Bruto e Saldo Líquido Estimado (pós-IRRF).
  2. **Normalização e Suporte a Tickers de 1 Letra (`quotes-core.ts`, `import-parser.ts`):**
     - Ajuste da expressão regular da Edge Function para `/^[A-Za-z]{1,5}$/`;
     - Whitelist `KNOWN_SINGLE_LETTER_US_TICKERS` no parser de linguagem natural para capturar ativos como `O` e `T` sem colidir com artigos ou preposições em português.
- **Arquivos alterados:**
  - `src/features/investments/wizard/wizard-state.ts`
  - `src/features/investments/wizard/wizard-state.test.ts`
  - `src/features/investments/wizard/step-order.tsx`
  - `src/features/investments/components/quick-transaction-sheet.tsx`
  - `src/state/mutations/use-portfolio-mutations.ts`
  - `supabase/functions/_shared/quotes-core.ts`
  - `src/domain/portfolio/import-parser.ts`
  - `src/domain/portfolio/import-parser.test.ts`
  - `src/tests/quotes-core.test.ts`
  - `docs/FASES_IMPLEMENTADAS.md`

## F75 — Correção Contábil de Resgate/Caixa, Posições Encerradas & Extrato Geral de Movimentações

- **Problema:** 
  1. Ao resgatar um ativo de Renda Fixa e creditar o saldo no Caixa, o valor do patrimônio total ficava duplicado porque o motor de valoração continuava projetando juros sobre o título zerado, e o Caixa inflava o custo de aquisição da carteira.
  2. Ativos zerados ou liquidados permaneciam na tabela de custódia ativa, gerando poluição visual.
  3. A aba de Histórico exibia apenas aportes simples (`portfolio_contributions`), omitindo compras avulsas, vendas, resgates de renda fixa, proventos recebidos e splits.
- **Solução:**
  1. **Motor de Valoração e Contabilidade (`valuation.ts`, `use-portfolio-position.ts`):**
     - Garantia de que ativos com `quantity <= 0` ou custo zero tenham saldo em custódia (`valueBRL`) e custo (`totalCostBRL`) estritamente iguais a **R$ 0,00**, eliminando qualquer projeção em títulos liquidados e preservando proventos históricos;
     - Exclusão do Caixa (`isCash`) do acumulador de custo de aquisição (`totalCostBRL`), somando 100% no Patrimônio Total (`totalBRL`) e na liquidez (`cashBRL`);
  2. **Gestão de Posições Encerradas na Custódia (`PositionTable`):**
     - Separação de posições ativas (`quantity > 0 && valueBRL > 0`) de posições encerradas (`quantity === 0 && valueBRL === 0`);
     - Toggle rápido *"Ocultar encerradas"* (ativo por padrão) e seção colapsável no rodapé: *"Posições Encerradas (X ativos liquidados)"*;
     - Exibição enriquecida da rentabilidade final realizada: Total Aplicado histórico, Total Resgatado, Proventos e Badge de Rentabilidade Final % (`finalReturnPct`), com layout adaptativo no desktop e mobile;
  3. **Extrato Geral de Movimentações da Carteira (`PortfolioActivityPanel`):**
     - Unificação completa de `portfolio_transactions`, `portfolio_contributions` e `portfolio_dividends` em uma timeline padronizada;
     - Cards de fluxo mensal: Total Aportado, Total Resgatado, Total Proventos e Fluxo Líquido do Mês;
     - Filtros rápidos por tipo (`Todas`, `Aportes/Compras`, `Vendas/Resgates`, `Proventos`), busca por ticker e exclusão de lançamentos;
  4. **Ficha de Detalhes do Ativo (`AssetDetailSheet`):**
     - Layout adaptativo para posições encerradas com Badge de Status, métricas de Total Aplicado vs. Resgatado e Rentabilidade Final Realizada.
- **Arquivos alterados:**
  - `src/domain/portfolio/valuation.ts`
  - `src/domain/portfolio/valuation.test.ts`
  - `src/state/queries/use-portfolio-position.ts`
  - `src/components/modules/position-table.tsx`
  - `src/components/modules/position-table.test.tsx`
  - `src/features/investments/components/asset-detail-sheet.tsx`
  - `src/features/investments/components/portfolio-activity-panel.tsx` [NOVO]
  - `src/features/investments/components/portfolio-activity-panel.test.tsx` [NOVO]
  - `src/features/investments/components/index.ts`
  - `src/features/investments/pages/aporte-tab.tsx`
  - `src/features/investments/pages/aporte-tab.test.tsx`
  - `src/features/investments/pages/proventos-tab.tsx`
  - `src/features/investments/pages/proventos-tab.test.tsx`
  - `docs/FASES_IMPLEMENTADAS.md`

## Notas finais

- **Arquitetura:** todo cálculo de negócio vive em `src/domain/` como função pura testada; UI em `components/`; dados em `src/data/` (só acessado por `src/state/`); telas em `features/` — ver `docs/ARCHITECTURE.md`.
- **Verificação:** a cada fase — typecheck, lint, testes e build verdes antes do commit (regra do ciclo, `ROADMAP.md` §6.1).








