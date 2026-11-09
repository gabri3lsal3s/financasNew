# 15_PLANO_MODO_VIAGEM_TOGGLE_TOUR_E_APRESENTACAO.md

> **Status:** Concluído / Implementado — v1.0  
> **Objetivo:** Adicionar governança de ativação/desativação modular (Toggle) do **Modo Viagem**, integrar a funcionalidade à experiência guiada de novos usuários (**Tour Interativo & Onboarding**) e expandir a **Apresentação do Produto** na Landing Page com visual interativo e narrativas de liquidação em grupo.

---

## 1. VISÃO GERAL & MOTIVAÇÃO

O **Modo Viagem** foi implementado com sucesso no ecossistema Áxis, provendo um livro-razão multi-pagadores, algoritmo de liquidação líquida mínima e compartilhamento público sem login obrigatório via `/viagem/:token`.

Para elevar a experiência a um padrão de excelência de produto SaaS:
1. **Desobstrução Cognitiva (Toggle Modular):** Nem todo usuário viaja com frequência ou necessita da funcionalidade o tempo todo. Assim como no **Modo Familiar**, o usuário deve poder ligar ou desligar o Modo Viagem com 1 toque nas Configurações. Quando desligado, a interface é despoluída (oculta menus e seletores no lançamento rápido), mas **nenhum dado é apagado ou perdido** — ao reativar, todo o histórico permanece 100% íntegro.
2. **Onboarding & Tour Interativo (Novos Usuários):** Novos usuários que entram no Modo Simulação ou no Tour Guiado devem conseguir experimentar o Modo Viagem imediatamente, visualizando uma viagem realista pré-configurada, a compensação líquida de saldos e o acerto via Pix Copia e Cola, sem depender de banco de dados real.
3. **Showcase na Apresentação Pública (Landing Page):** A Landing Page do Áxis precisa destacar essa vantagem competitiva no **Eixo 4 (Finanças Compartilhadas)**, adicionando um card demonstrativo interativo que comprove a eliminação de planilhas e o alívio das cobranças constrangedoras em viagens com amigos.

---

## 2. MATRIZ DE REQUISITOS & FRAGILIDADES

| Dimensão | Fragilidade Potencial | Solução Canônica Áxis |
|---|---|---|
| **Toggle & Persistência** | Risco de perda de dados acidental se o usuário desativar o modo | **Invariante de Dados:** Os dados (`trips`, `trip_members`, `trip_expenses`, `trip_settlements`) vivem no banco Postgres com RLS e **nunca são tocados pela desativação**. O toggle apenas ajusta `custom_settings.tripModeEnabled` nas preferências do usuário. |
| **Acesso Direto Desabilitado** | Usuário desativa o modo mas acessa `/viagens` ou `/viagens/:id` via URL ou histórico do navegador | Exibição de **EmptyState explicativo de ativação** (padrão idêntico a `family-page.tsx`), com botão para ativar o Modo Viagem e botão para voltar ao Início. |
| **Ergonomia no Lançamento** | Assistente de transação (`LaunchWizard`) exibir campo de viagem mesmo para quem não usa | Se `!isTripModeEnabled`, os campos de vínculo de viagem são omitidos de `step-details.tsx` e `step-quick.tsx`, reduzindo a carga cognitiva. |
| **Simulação Sem Backend** | Tour guiado falhar por falta de dados reais no Supabase | Criação de dataset sintético em memória (`mock-finances.ts`) com viagem simulada e chaveamento transparente em `useTrips` quando `isDemoActive: true`. |
| **Apresentação Visual** | Showcase da Landing Page ficar estático ou confuso | Inclusão da aba interativa "Modo Viagem" no card `SharedFinancesShowcase`, demonstrando visualmente a simplificação de 4 dívidas cruzadas em apenas 2 transferências Pix. |

---

## 3. FASES DE IMPLEMENTAÇÃO

### FASE 1: GOVERNANÇA DO TOGGLE & HOOK `useTripMode`
- Atualização de `UserCustomSettings` em `src/types/schema.ts` com `tripModeEnabled?: boolean`.
- Criação do hook `useTripMode` em `src/state/queries/use-trip-mode.ts` com testes em `use-trip-mode.test.tsx`.
- Atualização de navegação (`nav-items.tsx`, `sidebar.tsx`, `more-menu-sheet.tsx`, `bottom-nav.tsx`) com flag `tripOnly: true`.
- Switch de controle em `interface-shortcuts-card.tsx` com `triggerSensory("toggle")` e `pushToast`.
- EmptyState de ativação em `trip-list-page.tsx` e `trip-details-page.tsx`.
- Condicionamento do seletor no `LaunchWizard` e no `ActiveTripBanner` na Home.

### FASE 2: TOUR INTERATIVO & SIMULAÇÃO EM MEMÓRIA
- Atualização de `types.ts` com `finances_trips` e ícone `plane`.
- Criação de mock dataset `generateMockTrips()` em `mock-finances.ts`.
- Conexão de `useTrips` com `useDemoSession()`.
- Metadados em `tour-catalog.ts` e 3 passos em `tour-steps.ts`:
  1. Hub de Viagens (`[data-tour="trips-hub"]`)
  2. Balanços e Extrato Coletivo (`[data-tour="trip-balances"]`)
  3. Liquidação Mútua via Pix (`[data-tour="trip-settlement-card"]`)
- Inclusão do card de tour em `demo-track-select-modal.tsx`.

### FASE 3: APRESENTAÇÃO & LANDING PAGE PÚBLICA
- Adição da 4ª aba ("Modo Viagem") em `shared-finances-showcase.tsx` com simplificação de grafo de transferências e teste interativo de Pix.
- Atualização das narrativas editoriais em `product-narratives.tsx` (Eixo 4).
- Nova pergunta frequente no FAQ (`faq-section.tsx`) sobre colaboração via link sem necessidade de cadastro.

### FASE 4: PORTÕES DE QUALIDADE & DOCUMENTAÇÃO
- Execução de `typecheck` (`tsc -b`), `lint` (zero emojis / ESLint strict), vitest e build de produção Vite/PWA.
- Atualização contínua de `docs/architecture/ESPECIFICACAO_TECNICA.md` e `docs/architecture/ARCHITECTURE.md`.
