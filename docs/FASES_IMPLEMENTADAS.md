# FASES_IMPLEMENTADAS.md — Resumo de Implementação (F0–F29)

> **Objetivo deste documento:** registro resumido de **cada fase de implementação** do projeto — o **problema** que motivou a fase e a **solução** implementada. Detalhe completo (entregas, DoD, arquivos) em `docs/ROADMAP.md` (§3); a ordem de execução e o status estão em `ROADMAP.md` §6.1.
>
> **Status atual (2026-08-16):** fases **F0–F29 concluídas** (+ hotfixes de responsividade do DatePicker e do Seletor de Pesos em modais; refatoração do motor de sugestões preditivas do wizard; **atualizações otimistas** em edição/exclusão de lançamentos; **edge inset do Swipe Navigation**; **Fechamento completo por mês/ano/período customizado com impressão multi-página**; **remoção do swipe de navegação entre meses** (MonthSwiper — gesto horizontal instável; seletor por botões mantido); **endurecimento dos seletores nos modais + sincronização da competência da fatura com a data no modal de edição**; **remoção do gesto de pull-up to top** (F26 — instável em dispositivos reais; rolagem nativa mantida); **padronização visual dos PDFs de relatório** (F22 — paleta clara fixa, tipografia única e quebras de página limpas em qualquer tema do app); **auditoria de código: remoção de código morto e resíduos** (componentes/funções/dependências sem uso, barrels mortos, script one-off; `KpiCard` com API unificada e `DebtRow` extraído do `DebtsPage` — ver `ROADMAP.md` v1.22); **exportação da fatura do cartão em CSV e PDF** (F22 — apenas os gastos lançados no cartão da competência, com planilha Excel-safe e documento imprimível profissional p/ comparar com a fatura do banco — ver `ROADMAP.md` v1.24); **auditoria de fluxo do usuário com correções de usabilidade** (ver `ROADMAP.md` v1.25): lembretes voltam a exibir dívidas vencidas de meses anteriores e TODAS as faturas com saldo; metas de renda sem falha silenciosa; novo primitivo `ErrorState` ("Tentar novamente") em Insights/Relatórios/Orçamentos/Dívidas/Categorias/Lembretes; edição de despesa/receita preserva os dados em falha (modal permanece aberto); swipe "Excluir" abre direto a confirmação; despesa no crédito exige cartão cadastrado; exclusão de dívidas/categorias movida para dentro do formulário de edição; **botões de exclusão dos modais de detalhe padronizados** — "Excluir despesa"/"Excluir receita" viraram apenas "Excluir" (ver `ROADMAP.md` v1.26); **responsividade dos modais no desktop corrigida** — o primitivo `Modal` ganhou prop `size` (sm/md/lg/xl): a classe base `lg:max-w-md` vencia `max-w-*` customizados na cascata do Tailwind (variante `lg:` compilada depois), comprimindo modais largos (fatura, fechamento, detalhe de relatório) a 448px; agora cada modal aplica UMA única classe de largura (ver `ROADMAP.md` v1.27); **fatura do cartão separada em parceladas × à vista** — as compras parceladas (herdadas de meses anteriores) ficam no topo e as à vista (gastos do mês) embaixo, cada grupo ordenado por data, com contagem e subtítulo da parcela (ver `ROADMAP.md` v1.28); **upgrade do motor de Insights** — recorrências com mediana robusta e agregação mensal real, catálogo de assinaturas expandido com matching por tokens (chaves curtas exigem token exato — sem falsos positivos) e página com alertas diagnósticos (reajuste de preço, duplicidade, economia por corte) (ver `ROADMAP.md` v1.29); **auditoria de fluxo do usuário (Fase 2)** — correções de resiliência: exclusão de dívidas e de ativos/transações da carteira com erro visível (toast + formulário preservado; antes promise rejeitada sem tratamento e diálogo preso), lembretes (lido/snooze/restaurar) com feedback de falha, compartilhar despesa/receita avisa quando cai no clipboard ou não é suportado, wizard pede confirmação ao fechar com dados preenchidos (anti-perda), Visão Geral com "Tentar novamente" (`ErrorState`), metas de renda com indicador de sucesso e timer limpo, e busca global exibe erro da query em vez de "Nenhum resultado" (ver `ROADMAP.md` v1.30); **auditoria de código (2ª passada)** — 74 exports mortos removidos dos barrels (`state`/`export`/`gestures`/`insights`/`money`), funções sem uso deletadas (`useSetManualPrice`/`useRemoveManualPrice`, `lastDayOfMonth`, `subscribeCalculatorTarget`…), script one-off `migrate-legacy-data.mjs` removido, **bug do snooze de lembretes corrigido** (snoozeUntil "NaN-NaN-NaN" fazia o lembrete adiado nunca voltar — agora `addDaysISO(today, 7)`) e helpers locais de soma de dias consolidados no canônico `addDaysISO` (ver `ROADMAP.md` v1.32); **auditoria arquitetural da camada de dados** — varredura de N+1/waterfalls confirmou a camada saudável (batches, cache compartilhado, payloads seletivos), com **1 correção de integridade**: exclusão de pagamento/estorno de fatura passou de **2 DELETEs sequenciais no cliente** (renda `[REFUND]` + pagamento, sem transação) para o **RPC transacional `delete_card_payment`** (migração 0011 — valida ownership, remove ambos atômicamente, audit D2; ver `ROADMAP.md` v1.33); **auditoria de fluxo do usuário (3ª passada)** — lembretes com cards **clicáveis e acessíveis** que navegam com deep-link (destaque da dívida específica `/dividas?q=<id>` e do cartão/mês nas faturas — antes os cards não levavam a lugar nenhum) e **feedback de sucesso no pagamento/estorno de fatura** (toast "Pagamento registrado"/"Estorno registrado"; ver `ROADMAP.md` v1.34); **auditoria de código (3ª passada)** — 26 exports mortos removidos (re-exports de chaves de query no barrel `state`, chaves internas un-exportadas, re-exports mortos de `AuthShell`/`TransactionListPage` nos barrels de features, constantes/funções internas un-exportadas em `domain/gestures`, `domain/savings`, `domain/insights`, `domain/projection`, `domain/onboarding` e `domain/export`; `AXIS_LOCK_TANGENT` totalmente morta removida; ver `ROADMAP.md` v1.35); **verificação final de erros e fragilidades** — `useSetFeedback` (avaliação de insight) sem `onError` corrigido com toast de erro (falha silenciosa); **padronização arquitetural dos modais de edição** (Modal Content with Key Pattern — ver `ROADMAP.md` v1.48); **pacote de usabilidade, conforto, micro-interações táteis e agilidade de entrada** (ver `ROADMAP.md` v1.49); **auditoria de integridade e carregamento assíncrono robusto** (ver `ROADMAP.md` v1.50)) · suíte **1144 testes / 141 arquivos** · typecheck/lint/build limpos · deploy funcional (Vercel + Supabase).

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

## Notas finais

- **Arquitetura:** todo cálculo de negócio vive em `src/domain/` como função pura testada; UI em `components/`; dados em `src/data/` (só acessado por `src/state/`); telas em `features/` — ver `docs/ARCHITECTURE.md`.
- **Verificação:** a cada fase — typecheck, lint, testes e build verdes antes do commit (regra do ciclo, `ROADMAP.md` §6.1).



