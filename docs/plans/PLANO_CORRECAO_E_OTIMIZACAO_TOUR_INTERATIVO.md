# PLANO CANÔNICO & CHECKLIST — REFATORAÇÃO INTEGRAL DO TOUR INTERATIVO, MICRO-TOURS E GOVERNANÇA DE MODAIS

> **Documento Canônico de Engenharia, Arquitetura Visual e Experiência do Usuário (UI/UX)**  
> **Status:** Revisado, Refinado e Pronto para Execução  
> **Arquivo:** `docs/plans/PLANO_CORRECAO_E_OTIMIZACAO_TOUR_INTERATIVO.md`  
> **Módulos:** `src/domain/demo-simulation/`, `src/state/demo-mode/`, `src/state/queries/`, `src/components/modules/`, `src/components/layout/`, `src/components/ui/`, `src/features/`  
> **Regras Vinculantes:** `AGENTS.md` (Regras 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18).

---

## 📊 PAINEL DE PROGRESSO GERAL DA FUNCIONALIDADE

```
[FASE 0: INFRAESTRUTURA BASE ANTERIOR]       ████████████████████ 100% Concluído
[FASE 1: RESILIÊNCIA DE DADOS & ROTAS]       ████████████████████ 100% Concluído
[FASE 2: MOTOR DE SCROLL & CENTRALIZAÇÃO]   ████████████████████ 100% Concluído
[FASE 3: CATÁLOGO DE MICRO-TOURS & APK]      ████████████████████ 100% Concluído
[FASE 4: GOVERNANÇA DE MODAIS & UPDATE TOAST]████████████████████ 100% Concluído
[FASE 5: DESIGN SYSTEM, RESPONSIVIDADE & A11Y]████████████████████ 100% Concluído
[FASE 6: AUDITORIA INTEGRADA & POLIMENTO]    ████████████████████ 100% Concluído
[FASE 8: REFINAMENTO DE FLUIDEZ, DESKTOP & ZERO MODAIS INVASIVOS]████████████████████ 100% Concluído
[FASE 7: REVISÃO, PUSH, BUILD APK & TELEGRAM]████████████████████ 100% Concluído
```

---

## 1. SUMÁRIO EXECUTIVO & DIAGNÓSTICO DE CAUSAS RAÍZES

A auditoria exaustiva do código-fonte e a análise das capturas de tela fornecidas pelo usuário identificaram as falhas críticas do sistema atual:

### 1.1 Diagnóstico de Erros Críticos

#### A. Falha de Banco no Tour de Cartões ("Algo deu errado. Tente novamente em instantes")
- **Causa Raiz:** Em `cards-page.tsx`, as queries `useCardExpenses`, `useCardPayments`, `useAllCardExpenses` e `useAllCardPayments` não possuíam chaveamento para `isDemoActive`. Elas disparavam chamadas reais ao Supabase passando o ID do cartão simulado (`"card-nubank"`).
- **Mecanismo da Quebra:** A coluna `card_id` na tabela do PostgreSQL é do tipo `UUID`. Ao receber `"card-nubank"`, o Postgres abortava com erro `invalid input syntax for type uuid: "card-nubank"`. A página renderizava dois blocos de `ErrorState` vermelhos na tela.

#### B. Páginas/Abas de Investimentos Não Carregam
- **Causa Raiz:** `tour-steps.ts` definia `targetRoute: "/investimentos?tab=metas"` e `targetRoute: "/investimentos?tab=aporte"`.
- **Mecanismo da Quebra:** Em `router.tsx`, a rota legada `/investimentos` executava um `<Navigate to="/investments" replace />` estático que descartava `location.search`. A aplicação permanecia na aba "Carteira" (resumo), os seletores de Metas e Aporte nunca eram montados no DOM e o Spotlight ficava órfão (tela 100% preta sem iluminação).

#### C. Descentralização e Oscilação do Spotlight (Passar e Voltar / Trocar de Página)
- **Causa Raiz 1 (Ouvinte no Objeto Errado):** O listener de scroll estava em `window.addEventListener("scroll", ...)`. No entanto, em `page-shell.tsx`, a rolagem da aplicação acontece internamente em `<main id="main-content">`. O window nunca rolava, impedindo o Spotlight de acompanhar o movimento real.
- **Causa Raiz 2 (Medição Prematura em Animação Suave):** `element.scrollIntoView({ behavior: "smooth" })` demora entre 350ms e 600ms para concluir. O código executava `setTimeout(updateTargetRect, 200)` — medindo o `getBoundingClientRect()` com o elemento ainda em pleno movimento.
- **Causa Raiz 3 (Invasão do Header Fixo):** `scrollIntoView({ block: "center" })` ignorava a altura do Header fixo (`64px` + safe area top). Ao rolar, o elemento subia demais e o recorte cobria o Header, conforme evidenciado nas capturas de tela.
- **Causa Raiz 4 (Scroll Residual):** Ao navegar de uma página longa para outra, o scroll anterior de `#main-content` não era resetado deterministicamente antes do cálculo de coordenadas.

#### D. Colisão e Inoperância entre Modais e o Toast de Nova Versão (Captura Recente)
- **Causa Raiz:** Em `providers.tsx`, o `<NativeUpdateToast />` roda autoCheck incondicional no Android e renderiza dentro do `<Toaster>` com `z-toast = 60` no terço inferior da viewport (`bottom-[calc(4.5rem+...)]`).
- **Mecanismo do Bloqueio Mútuo:** Quando o modal de onboarding ("A Mágica da Captura Sem Fricção" / `WelcomeFeatureModal`) ou qualquer wizard está aberto, o Toast de atualização aparece flutuando diretamente sobre os botões do modal. Porém, como o Radix Dialog do modal intercepta o foco com focus trap e bloqueia ponteiros externos, o usuário **NÃO CONSEGUE CLICAR** no botão "Atualizar" nem no "X" do Toast, ao mesmo tempo em que o Toast obstrui o conteúdo explicativo e o botão "Próximo" do modal de baixo.
- **Solução Arquitetural:** O pop-up de atualização só deve ser liberado quando o usuário estiver em uma página limpa, sem nenhum modal, diálogo, wizard ou tour aberto. Se o usuário dispensar no "X", a notificação só voltará a ser sugerida na próxima inicialização do app.

#### E. Colisão Crítica de Sobreposição no Mobile
- **Causa Raiz:** O card do tour estava fixo na base (`fixed inset-x-3 bottom-3`). Quando o elemento recortado estava na metade inferior da tela (ex: KPIs de Investimentos, Lançamentos em Transações), o popover era desenhado exatamente por cima do elemento.

#### F. Fricção Cognitiva & Omissão de Funcionalidades Essenciais
- O tour atual era puramente passivo e omitia os maiores valores do app: o **Botão Wizard (+)**, a inteligência do **Saldo Livre Real**, a criação de **Categorias & Tetos**, o radar de **Insights (Smart Advisor)**, os **Relatórios**, o cadastro de **Ativos de Investimento**, a **Personalização** e o **Canal de Suporte**.
- Ausência de onboarding modular e ausência de explicação para os recursos exclusivos do **APK Nativo Android** (leitor de notificações bancárias, biometria e escudo de privacidade).

---

## 2. ARQUITETURA DA NOVA EXPERIÊNCIA DE TOURS & GOVERNANÇA DE MODAIS

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   HUB DE TOURS GUIADOS & MICRO-APRENDIZADO                       │
└──────────────────────────────────────────────────────────────────────────────────┘

 [MOTOR DE CENTRALIZAÇÃO & PRECISÃO]
  • Rolagem determinística no container #main-content com offset do Header (64px)
  • Medição sincronizada após estabilização do scroll (evento 'scrollend' ou RAF)
  • Algoritmo Anti-Colisão Mobile: elemento na metade inferior ──> Card no Topo
                                  elemento na metade superior ──> Card na Base

 [GOVERNANÇA INTELIGENTE DE MODAIS & ATUALIZAÇÕES]
  • Hook useCanShowUpdateNotification(): monitora [role="dialog"], [role="alertdialog"],
    isDemoActive e wizards ativos.
  • Se houver qualquer overlay/modal aberto: Toast de atualização permanece oculto/em espera.
  • Quando a tela fica limpa: Toast é exibido suavemente sem colisões.
  • Se o usuário dispensar [X]: posterga para a próxima abertura do aplicativo.

 [CATÁLOGO DE TRILHAS E MICRO-TOURS]
  ├─ 🌟 TRILHA 0: BEM-VINDO AO APP NATIVO (Exclusivo APK Android via isNative())
  │    Passo 1: Visão Geral do App Nativo
  │    Passo 2: Leitor de Notificações Bancárias em Tempo Real
  │    Passo 3: Biometria e Escudo de Privacidade
  │
  ├─ 💳 TRILHA 1: FINANÇAS DIÁRIAS & CARTÕES
  │    ├─ Visão Geral Rápida (Home + Saldo Livre Real) [3 passos]
  │    ├─ Micro-Tour 1.1: O Botão Wizard (+) e Lançamento Rápido/PIX [3 passos]
  │    ├─ Micro-Tour 1.2: Cartões, Faturas e Melhor Dia de Compra [3 passos]
  │    ├─ Micro-Tour 1.3: Categorias e Tetos de Gastos [3 passos]
  │    └─ Micro-Tour 1.4: Smart Advisor (Insights) e Relatórios [3 passos]
  │
  ├─ 📈 TRILHA 2: INVESTIMENTOS & REBALANCEAMENTO
  │    ├─ Visão Geral da Carteira [3 passos]
  │    ├─ Micro-Tour 2.1: Cadastrando seu Primeiro Ativo (Nova Operação) [2 passos]
  │    ├─ Micro-Tour 2.2: Metas de Alocação por Classe & Ativo [2 passos]
  │    ├─ Micro-Tour 2.3: Calculadora de Aporte Inteligente [2 passos]
  │    └─ Micro-Tour 2.4: Proventos & Calendário de Dividendos [2 passos]
  │
  └─ ⚙️ TRILHA 3: PERSONALIZAÇÃO, VISUAL & SUPORTE
       └─ Micro-Tour 3.1: Temas, Modo Privacidade e Canal de Ajuda [2 passos]
```

---

## 3. CHECKLIST DETALHADO POR FASES DE EXECUÇÃO

---

### FASE 0: INFRAESTRUTURA BASE EXISTENTE (JÁ CONCLUÍDO)

- [x] **0.1. Máquina de Estados da Sessão em Memória**
  - [x] Store reativo via `useSyncExternalStore` em `src/state/demo-mode/demo-session-store.ts`.
  - [x] Funções `startDemo`, `endDemo`, `goToNextStep`, `goToPrevStep`, `setStepIndex`.
  - [x] Persistência de conclusão em `src/state/demo-mode/demo-storage.ts`.
  - [x] Cobertura de testes unitários em `demo-session-store.test.ts`.

- [x] **0.2. Datasets Simulados em Memória**
  - [x] Dataset de finanças com despesas, receitas, categorias e orçamentos em `mock-finances.ts`.
  - [x] Dataset de investimentos com ativos, metas e snapshots em `mock-investments.ts`.
  - [x] Validação de invariantes em `mock-data.test.ts`.

- [x] **0.3. Componentes Primitivos Iniciais**
  - [x] Diálogo modal inicial em `demo-track-select-modal.tsx`.
  - [x] Máscara SVG e recorte preliminar em `demo-tour-spotlight.tsx`.

---

### FASE 1: RESILIÊNCIA DE DADOS SIMULADOS & ROTEAMENTO DE ABAS

**Meta:** Eliminar 100% dos erros *"Algo deu errado. Tente novamente"* em Cartões, corrigir o roteamento das abas de Investimentos e ajustar seletores desproporcionais.

#### Tarefas:
- [x] **1.1. Implementação de Mocks de Cartão (`src/state/queries/use-simulated-queries.ts`)**
  - [x] Implementar `useSimulatedCardExpenses(cardId: string | null)` para filtrar despesas do cartão simulado.
  - [x] Implementar `useSimulatedCardPayments(cardId: string | null)` com histórico de pagamentos/faturas simuladas.
  - [x] Implementar `useSimulatedAllCardExpenses()` retornando todas as despesas com cartão do mock.
  - [x] Implementar `useSimulatedAllCardPayments()` com totalizações de pagamentos simulados.

- [x] **1.2. Chaveamento por `isDemoActive` nas Queries de Cartão**
  - [x] Em `src/state/queries/use-card-payments.ts`:
    * Chavear `useCardExpenses` com `isDemoActive ? simulated : real` e `enabled: !isDemoActive`.
    * Chavear `useCardPayments` com `isDemoActive ? simulated : real` e `enabled: !isDemoActive`.
  - [x] Em `src/state/queries/use-overview.ts`:
    * Chavear `useAllCardExpenses` com `isDemoActive ? simulated : real` e `enabled: !isDemoActive`.
    * Chavear `useAllCardPayments` com `isDemoActive ? simulated : real` e `enabled: !isDemoActive`.

- [x] **1.3. Correção Canônica das Rotas de Investimentos (`src/domain/demo-simulation/tour-steps.ts`)**
  - [x] Atualizar Passo 1 de Investimentos: `targetRoute: "/investments"`.
  - [x] Atualizar Passo 2 de Investimentos: `targetRoute: "/investments?tab=metas"`.
  - [x] Atualizar Passo 3 de Investimentos: `targetRoute: "/investments?tab=aporte"`.

- [x] **1.4. Preservação de Query Strings no Redirecionamento (`src/app/router.tsx`)**
  - [x] Atualizar redirecionamento de compatibilidade:
    ```tsx
    <Route
      path="/investimentos"
      element={<Navigate to={`/investments${location.search}`} replace />}
    />
    ```

- [x] **1.5. Redimensionamento de Seletores em Transações (`transaction-list-page.tsx`)**
  - [x] Substituir o seletor da lista inteira de 800px por um seletor contido:
    `data-tour="transactions-feed-card"` no primeiro bloco representativo de lançamentos.
  - [x] Atualizar o seletor correspondente em `tour-steps.ts`.

- [x] **1.6. Testes Unitários de Rota e Mocks**
  - [x] Atualizar asserções de teste em `src/domain/demo-simulation/tour-steps.test.ts`.
  - [x] Testar retorno síncrono das queries de cartão com `isDemoActive = true`.

#### Portão de Qualidade 1:
- [x] `npm run typecheck` executado com zero erros de tipo.
- [x] `npm run lint` aprovado sem nenhuma violação.
- [x] `npm test -- src/domain/demo-simulation/tour-steps.test.ts src/state/queries/` aprovado.
- [x] Teste Manual: Navegar até `/cartoes` durante o tour e verificar se a carteira carrega perfeitamente sem nenhuma caixa vermelha de erro.
- [x] Teste Manual: Avançar os passos de investimentos e confirmar que as abas "Metas" e "Aporte" abrem imediatamente.

#### Commit & Push 1:
- [x] Mensagem de Commit: `fix(tour): intercepta queries de cartao em modo demo e corrige rotas de abas de investimentos`
- [x] Executar push para a branch remota.

---

### FASE 2: MOTOR MATEMÁTICO DE SCROLL, CENTRALIZAÇÃO & ANTI-COLISÃO

**Meta:** Garantir que o spotlight centralize perfeitamente nos elementos sem oscilar ao navegar para frente e para trás, e posicionar o popover no topo ou na base evitando sobreposição no mobile.

#### Tarefas:
- [x] **2.1. Ouvinte de Scroll no Container Correto (`src/components/modules/demo-tour-spotlight.tsx`)**
  - [x] Substituir `window.addEventListener("scroll", ...)` pelo listener no elemento `#main-content`:
    ```ts
    const container = document.getElementById("main-content");
    container?.addEventListener("scroll", handleResizeOrScroll, { passive: true });
    ```

- [x] **2.2. Algoritmo Determinístico de Scroll com Offset do Header**
  - [x] Substituir `element.scrollIntoView({ behavior: "smooth" })` por rolagem matemática calculada no container:
    ```ts
    const container = document.getElementById("main-content");
    const headerHeight = 64; // altura do header fixo
    const targetScrollTop = element.offsetTop - headerHeight - 16;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
    ```
  - [x] Resetar `container.scrollTop = 0` imediatamente ao mudar de rota antes de buscar o novo elemento.

- [x] **2.3. Sincronização Precisa pós-Estabilização (Fim Real da Rolagem)**
  - [x] Eliminar `setTimeout(updateTargetRect, 200)`.
  - [x] Implementar verificação de estabilização via `scrollend` com fallback de `requestAnimationFrame` que confirma quando o `container.scrollTop` para de variar por 2 frames consecutivos antes de chamar `updateTargetRect`.
  - [x] Acoplar `ResizeObserver` ao elemento-alvo para recalcular dimensões caso o layout sofra expansão tardia.

- [x] **2.4. Motor Anti-Colisão Mobile Adaptativo**
  - [x] Medir posição vertical do elemento em relação à viewport:
    * Se `rect.y + rect.height / 2 > window.innerHeight * 0.45`:
      - Ancorar no **TOPO**: `fixed inset-x-3 top-[max(env(safe-area-inset-top,0px),16px)]`.
    * Se `rect.y + rect.height / 2 <= window.innerHeight * 0.45`:
      - Ancorar na **BASE**: `fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom,0px),16px)]`.
  - [x] Limitar altura máxima do card mobile: `max-h-[42vh]` com `overflow-y-auto`.

- [x] **2.5. Posicionamento Dinâmico no Desktop com Altura Real**
  - [x] Substituir constante `220` pela medição real `cardRef.current?.offsetHeight`.
  - [x] Inverter colocação (topo ↔ base) dinamicamente caso o espaço inferior seja menor que o card.
  - [x] Clamp horizontal de segurança: `Math.max(16, Math.min(rect.x, window.innerWidth - cardWidth - 16))`.

- [x] **2.6. Testes Unitários de Posicionamento e Anti-Colisão**
  - [x] Testar cenários de viewport mobile simulando elemento no topo e na base em `demo-tour-spotlight.test.tsx`.

#### Portão de Qualidade 2:
- [x] `npm run typecheck` aprovado.
- [x] `npm run lint` aprovado.
- [x] `npm test -- src/components/modules/demo-tour-spotlight.test.tsx` aprovado.
- [x] Teste Manual: Navegar para frente e para trás entre os passos de Finanças e Investimentos no mobile (375x667 e 390x844). Comprovar que o recorte não oscila e que o card nunca encobre o elemento focado.

#### Commit & Push 2:
- [x] Mensagem de Commit: `feat(tour): implementa motor de centralizacao deterministico e anti-colisao mobile`
- [x] Executar push para a branch remota.

---

### FASE 3: CATÁLOGO DE MICRO-TOURS HIERÁRQUICOS & TOUR DO APK NATIVO

**Meta:** Transformar o seletor em um Hub de Aprendizado sob demanda com micro-tours específicos e tour de onboarding para o aplicativo APK Nativo (Android).

#### Tarefas:
- [x] **3.1. Expansão de Tipos e Contratos de Domínio (`src/domain/demo-simulation/types.ts`)**
  - [x] Expandir `TourTrackId` para suportar:
    * `"finances_overview"` (Visão Geral Finanças - 3 passos)
    * `"finances_wizard"` (O Botão Wizard (+) e Lançamento Rápido - 3 passos)
    * `"finances_cards"` (Cartões, Faturas e Limites - 3 passos)
    * `"finances_budgets"` (Categorias e Tetos de Gastos - 3 passos)
    * `"finances_insights"` (Smart Advisor e Relatórios - 3 passos)
    * `"investments_overview"` (Visão Geral da Carteira - 3 passos)
    * `"investments_assets"` (Cadastro de Ativos / Nova Operação - 2 passos)
    * `"investments_targets"` (Metas por Classe e Ativo - 2 passos)
    * `"investments_aporte"` (Calculadora de Aporte Inteligente - 2 passos)
    * `"settings_support"` (Personalização, Privacidade e Suporte - 2 passos)
    * `"app_native_apk"` (Recursos Nativos do APK Android - 3 passos)
  - [x] Criar estrutura de grupos de trilhas com metadados (ícone, categoria, passos, badges de conclusão).

- [x] **3.2. Mapeamento dos Passos dos Novos Micro-Tours (`tour-steps.ts`)**
  - [x] **Micro-Tour Wizard (+):**
    * Passo 1: Botão `+` na BottomNav (`[data-tour="bottom-nav-wizard"]`).
    * Passo 2: Modal do Wizard (seleção de despesa, receita, PIX).
    * Passo 3: Parcelamento inteligente de despesas.
  - [x] **Micro-Tour Insights & Relatórios:**
    * Passo 1: Smart Advisor / Alertas de Ritmo na Home.
    * Passo 2: Radar de Assinaturas na tela de Cartões.
    * Passo 3: Fechamento mensal em Relatórios (`/relatorios`).
  - [x] **Micro-Tour Ativos de Investimento:**
    * Passo 1: Botão `+ Nova Operação` em Investimentos.
    * Passo 2: Adicionar saldo em Caixa de corretora.
  - [x] **Micro-Tour Personalização & Suporte:**
    * Passo 1: Botão de Privacidade (esconder saldos) e Tema no Header.
    * Passo 2: Canal direto de suporte no menu Mais/Configurações.
  - [x] **Tour Exclusivo do APK Nativo Android (`app_native_apk`):**
    * Passo 1: Interface nativa e desempenho acelerado.
    * Passo 2: Assistente de Notificações Bancárias (captura automática de compras).
    * Passo 3: Bloqueio por Biometria e Escudo de Privacidade.

- [x] **3.3. Inclusão dos Atributos `data-tour` nas Telas Correspondentes**
  - [x] BottomNav: `data-tour="bottom-nav-wizard"` no botão central flutuante.
  - [x] Investimentos: `data-tour="investments-new-op"` no botão Nova Operação.
  - [x] Header: `data-tour="header-privacy-theme"` nos botões de privacidade e tema.

- [x] **3.4. Redesign do Modal Seletor (`src/components/modules/demo-track-select-modal.tsx`)**
  - [x] Renderizar Hub de Aprendizado com seções colapsáveis ou agrupadas por abas:
    * Card de Boas-Vindas do APK Nativo em destaque caso `isNative()` retorne `true`.
    * Bloco de Finanças Diárias com botão de "Visão Geral" e lista de 4 micro-tours específicos.
    * Bloco de Investimentos com botão de "Visão Geral" e lista de 4 micro-tours específicos.
    * Bloco de Configurações, Visual e Suporte.
  - [x] Exibir badge `"Concluído"` em cada micro-tour finalizado pelo usuário.

- [x] **3.5. Disparo de Onboarding no Primeiro Uso / Instalação do APK**
  - [x] Em `src/state/demo-mode/demo-storage.ts`, verificar se o usuário já viu o onboarding nativo.
  - [x] Se estiver rodando no APK (`isNative()`) e for o primeiro acesso, sugerir automaticamente o micro-tour de recursos nativos.

#### Portão de Qualidade 3:
- [x] `npm run typecheck` aprovado.
- [x] `npm run lint` aprovado.
- [x] `npm test -- src/domain/demo-simulation/` aprovado com todos os novos passos validados.
- [x] Teste Manual: Abrir o modal de seleção e comprovar a listagem organizada de micro-tours; iniciar o micro-tour do Wizard (+) e verificar se o botão central é focado com precisão.

#### Commit & Push 3:
- [x] Mensagem de Commit: `feat(tour): implementa catalogo de micro-tours modulares e onboarding nativo do apk`
- [x] Executar push para a branch remota.

---

### FASE 4: GOVERNANÇA DE MODAIS, PREVENÇÃO DE COLISÃO & NATIVE UPDATE TOAST

**Meta:** Eliminar 100% dos conflitos e sobreposições entre o Toast de Nova Versão e os modais/wizards do app, garantindo que atualizações só sejam sugeridas em momentos tranquilos e postergadas com persistência limpa.

#### Tarefas:
- [x] **4.1. Hook Global de Detecção de Overlays Ativos (`src/hooks/use-active-overlays.ts`)**
  - [x] Implementar verificação reativa que detecta:
    * Existência de `[role="dialog"]:not([data-state="closed"]):not([data-lock-overlay])` ou `[role="alertdialog"]` no DOM.
    * Se o tour de demonstração está ativo (`isDemoActive === true`).
    * Se o assistente de lançamento `LaunchWizard` está aberto (`wizardOpen === true`).
    * Se modais de primeiro uso / onboarding (`WelcomeFeatureModal`) estão abertos.
  - [x] Retornar `hasBlockingOverlay: boolean` para componentes de notificação.

- [x] **4.2. Supressão Condicional no `NativeUpdateToast` (`src/components/modules/native-update-toast.tsx`)**
  - [x] Integrar `useActiveOverlays()`: se `hasBlockingOverlay === true`, retornar `null` (ou adiar a exibição).
  - [x] Quando o modal/tour for fechado pelo usuário e a tela voltar ao estado limpo, permitir que o Toast seja exibido com transição suave.

- [x] **4.3. Persistência de Adiantamento por Sessão no Dismiss (`[X]`)**
  - [x] Ao clicar no `[X]` de dispensar o `NativeUpdateToast`, gravar flag com timestamp no `sessionStorage` (ou `localStorage` com prazo de 12 horas):
    `sessionStorage.setItem("financas:update_dismissed_session", "true")`.
  - [x] Evitar que o toast volte a interromper o usuário durante a mesma sessão de uso. A notificação só volta a ser checada e sugerida na próxima vez que o aplicativo for aberto.

- [x] **4.4. Prevenção de Bloqueio de Ponteiros e Stacking Context (`src/components/ui/toast.tsx`)**
  - [x] Assegurar que o `Viewport` do Radix Toast e os itens de Toast não bloqueiem eventos de clique do modal inferior quando montados.
  - [x] Ajustar `z-index`: o `NativeUpdateToast` deve operar com coordenação para que nunca sobreponha modais de primeiro uso.

- [x] **4.5. Testes Unitários de Supressão de Modais (`native-update-toast.test.tsx`)**
  - [x] Criar caso de teste: com atualização disponível e modal aberto (`[role="dialog"]` presente), comprovar que o Toast NÃO é renderizado.
  - [x] Criar caso de teste: ao fechar o modal, comprovar que o Toast passa a ser exibido.
  - [x] Criar caso de teste: ao clicar em dispensar `[X]`, comprovar que a preferência persiste e não reabre na mesma sessão.

#### Portão de Qualidade 4:
- [x] `npm run typecheck` aprovado.
- [x] `npm run lint` aprovado.
- [x] `npm test -- src/components/modules/native-update-toast.test.tsx` aprovado.
- [x] Teste Manual: Simular nova versão disponível e abrir o modal "A Mágica da Captura Sem Fricção" (ou o LaunchWizard). Comprovar que o banner de atualização NÃO aparece sobre o modal. Fechar o modal e comprovar que o toast de atualização aparece calmamente na tela inicial.

#### Commit & Push 4:
- [x] Mensagem de Commit: `fix(updates): suprime toast de nova versao durante modais e persiste adiamento no dismiss`
- [x] Executar push para a branch remota.

---

### FASE 5: DESIGN SYSTEM, RESPONSIVIDADE & ACESSIBILIDADE WCAG

**Meta:** Ajustar tipografia e botões para mobile (< 400px), aplicar tokens semânticos e implementar focus trap e leitor de tela.

#### Tarefas:
- [x] **5.1. Rodapé Adaptativo sem Esmagamento (< 400px)**
  - [x] Botão "Anterior": ícone `<ArrowLeft className="size-3.5" />` com texto `sm:inline`.
  - [x] Dots de progresso: estilizados como pílulas discretas com espaçamento seguro.
  - [x] Botão Conclusão adaptativo:
    * `sm:hidden`: `"Começar"`.
    * `hidden sm:inline`: `"Começar Conta Real"`.

- [x] **5.2. Conformidade com a Regra 13 do Design System (Hierarquia Semântica)**
  - [x] Trocar badge de passo de `variant="default"` para `variant="muted"`.
  - [x] Ícone Sparkles em `text-muted-foreground`.
  - [x] Manter cor `primary` exclusivamente no botão CTA de avanço.

- [x] **5.3. Backdrop Suave e Borda Arredondada**
  - [x] Opacidade suave de fundo: `fill="rgba(0, 0, 0, 0.60)"`.
  - [x] Cantos arredondados do recorte com `rx={16}` e `ry={16}` (`rounded-2xl`).
  - [x] Pulso da borda cessa suavemente após 3 segundos.

- [x] **5.4. Focus Trap e Gerenciamento de Foco**
  - [x] Salvar `document.activeElement` antes de abrir o tour.
  - [x] Mover foco para o botão de ação ao renderizar o passo.
  - [x] Confinar ciclo de Tab/Shift+Tab dentro do card popover.
  - [x] Restaurar foco ao fechar via ESC ou botão `[X]`.

- [x] **5.5. Acessibilidade ARIA e Anúncios para Leitores de Tela**
  - [x] Inserir `aria-live="polite"` no bloco de título/descrição do passo.
  - [x] Aplicar `role="presentation"` e `aria-hidden="true"` na camada SVG de fundo.
  - [x] Tornar os dots clicáveis com `role="button"` e `aria-label={`Ir para o passo ${idx + 1}`}`.

#### Portão de Qualidade 5:
- [x] `npm run typecheck` aprovado.
- [x] `npm run lint` aprovado.
- [x] `npm test -- src/components/modules/demo-tour-spotlight.test.tsx` aprovado.
- [x] Teste Manual: Navegação 100% via teclado (Tab, Enter, Espaço, Setas ← →, Esc) em temas Claro e Escuro.

#### Commit & Push 5:
- [x] Mensagem de Commit: `style(tour): alinha design tokens, ergonomia mobile, focus trap e a11y`
- [x] Executar push para a branch remota.

---

### FASE 6: AUDITORIA FINAL INTEGRADA, GOVERNANÇA & POLIMENTO

**Meta:** Validar integridade de 100% da suíte de testes, marcar formalmente depreciações e atualizar a documentação.

#### Tarefas:
- [x] **6.1. Governança e Limpeza de Componentes Legados**
  - [x] Adicionar anotação `@deprecated` no JSDoc de `src/components/modules/demo-tour-bar.tsx`.
  - [x] Assegurar que `page-shell.tsx` não renderiza a barra superior redundante.
  - [x] Manter testes unitários de `demo-tour-bar.test.tsx` verdes para integridade.

- [x] **6.2. Execução da Suíte Completa de Testes**
  - [x] Rodar `npm test` em todo o repositório garantindo 100% de testes passando.
  - [x] Executar auditoria de acessibilidade (`src/tests/accessibility-audit.test.tsx`).

- [x] **6.3. Atualização de Documentação Canônica**
  - [x] Atualizar referências no `docs/architecture/ESPECIFICACAO_TECNICA.md`.
  - [x] Atualizar status da funcionalidade no `docs/roadmap/ROADMAP.md`.

#### Portão de Qualidade 6:
- [x] `npm run typecheck` com zero erros.
- [x] `npm run lint` 100% aprovado.
- [x] `npm test` 100% verde em todos os arquivos de teste.
- [x] Teste Manual E2E: Executar cada um dos micro-tours no desktop e em simulador mobile.

#### Commit & Push 6:
- [x] Mensagem de Commit: `chore(tour): finaliza auditoria integrada, deprecation de componentes e documentacao`
- [x] Executar push para a branch remota.

---

---

### FASE 8: REFINAMENTO DE FLUIDEZ (ZERO FLICK), EXPERIÊNCIA DESKTOP, CORREÇÃO DE TAXONOMIA & DIDÁTICA INTEGRADA DOS TOURS

**Meta:** Eliminar qualquer flick ou piscar na tela durante a movimentação do card de tour utilizando aceleração por hardware GPU sem recriação do nó DOM; corrigir a categorização semântica errônea nos badges (que exibia indevidamente "Investimentos" em telas de Finanças Pessoais); substituir iluminações estáticas genéricas por foco real nos modais de criação (`LaunchWizard`) e tabelas relevantes (despesas parceladas, faturas); eliminar elementos fantasmas no tour de cartões e configurações; estruturar os Tours Gerais de Finanças e Investimentos para unificar e encadear os passos de todos os micro-tours em uma sequência lógica e altamente didática; e assegurar encerramento limpo sem abertura invasiva de modais (`?novo=...`).

#### Tarefas:
- [x] **8.1. Eliminação de Flicks e Otimização da Movimentação do Card Popover**
  - [x] **Preservação do Nó DOM no `DemoTourSpotlight` (`src/components/modules/demo-tour-spotlight.tsx`):**
    * Remover a prop `key={currentStep.id}` do container principal do card para impedir o ciclo destrutivo de unmount/mount a cada troca de passo.
    * Animar a transição posicional do card exclusivamente através de `transform: translate3d(x, y, 0)` com aceleração por hardware GPU.
    * Aplicar transição de curva suave nos estilos do container do card:
      `transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease`.
  - [x] **Cross-Fade Suave no Conteúdo Textual:**
    * Manter o envelope visual do card estável e aplicar animação suave de fade apenas no bloco textual interno (título, descrição, contadores), evitando recargas ou flashes bruscos na tela.
  - [x] **Eliminação de Salto Inicial Desktop:**
    * Iniciar opacidade em 0 (`opacity: 0`) até que as primeiras coordenadas matemáticas de posicionamento estejam plenamente calculadas e estáveis, transicionando suavemente para `opacity: 1`.

- [x] **8.2. Correção Canônica da Taxonomia e Rótulos Semânticos nos Badges**
  - [x] **Erradicação do Fallback Incorreto em `demo-tour-spotlight.tsx`:**
    * Substituir o ternário ingênuo `activeTrack === "finances" ? "Finanças Diárias" : "Investimentos"` por função pura canônica `getTourTrackCategoryLabel(trackId: TourTrackId)` em `src/domain/demo-simulation/metadata.ts`.
    * Garantir o mapeamento semântico exato para cada trilha ativa:
      - `finances`, `finances_overview`, `finances_wizard`, `finances_cards`, `finances_budgets`, `finances_insights` $\rightarrow$ **"Finanças Diárias"** (ou subtítulo contextual: *"Finanças · Lançamentos"*, *"Finanças · Cartões"*, *"Finanças · Orçamentos"*).
      - `investments`, `investments_overview`, `investments_assets`, `investments_targets`, `investments_aporte` $\rightarrow$ **"Investimentos"**.
      - `settings_support` $\rightarrow$ **"Configurações"**.
      - `app_native_apk` $\rightarrow$ **"App Nativo"**.
  - [x] Validar que em todas as telas de cartões, orçamentos, lançamentos e transações o badge exiba categorização correta de finanças pessoais, nunca investimentos.

- [x] **8.3. Didática Real de Lançamento de Transações (Foco no Modal `LaunchWizard`)**
  - [x] **Iluminação do Modal em Vez de Linha Estática do Extrato:**
    * No micro-tour do Wizard e no tour geral de finanças, ao explicar *"Lançamento de Despesa, Receita e Pix"*, o passo deve navegar para a rota ou abrir o diálogo de lançamento (ex: `targetRoute: "/transacoes?novo=despesa"` em modo demonstração assistida) com atributo contido `[data-tour="launch-wizard-dialog"]`.
    * Explicar didaticamente a alternância entre **Despesa**, **Receita** e **Pix**, as sugestões preditivas de categorias inteligentes e o botão de **Anexar Comprovante**.
    * Assegurar que ao avançar ou retroceder o passo, o modal de demonstração seja fechado sem poluir a navegação.

- [x] **8.4. Resolução de Ações Fantasmas e Ajuste Fino de Seletores (Cartões e Configurações)**
  - [x] **Radar de Assinaturas e Recorrências:**
    * Se o radar de assinaturas estiver vazio ou colapsado no cartão ativo, focar no resumo da fatura aberta `[data-tour="cards-invoice-summary"]` ou nas despesas fixas recorrentes, sem apontar genericamente para a carteira 3D inteira.
  - [x] **Parcelamento Inteligente:**
    * Apontar o spotlight diretamente para a seção de `[data-tour="cards-installments-section"]` (Despesas Parceladas) ou para o cálculo de competências futuras, proporcionando coerência visual entre o texto explicativo e o elemento destacado.
  - [x] **Suporte e Configurações:**
    * Corrigir o seletor do passo 2 de `settings_support`, substituindo o seletor órfão `[data-tour="overview-kpis"]` por `[data-tour="settings-support-card"]` ou `[data-tour="settings-help-section"]` na página `/configuracoes`.

- [x] **8.5. Composição Hierárquica e Didática dos Tours Gerais (Finanças e Investimentos)**
  - [x] **Reestruturação Completa do Tour Geral de Finanças Diárias (`finances`):**
    * Compor uma jornada sequencial, completa e contínua integrando os passos essenciais de todos os micro-tours:
      1. *Dashboard & Saldo Livre Real:* foco nos KPIs e visão patrimonial de caixa (`/`).
      2. *O Botão Wizard (+) e Atalhos:* foco no botão central no mobile ou botão no topo/`Ctrl+K` no desktop.
      3. *Modal de Lançamento Inteligente:* apresentação dos tipos (Despesa, Receita, Pix), categorias preditivas e OCR de comprovantes.
      4. *Extrato Unificado & Filtros:* visão cronológica com separação de parcelas e conciliação (`/transacoes`).
      5. *Cartões & Faturas Abertas:* melhor dia de compra, limite disponível e competências (`/cartoes`).
      6. *Parcelamentos Fixos e Futuros:* projeção de faturas futuras para planejamento sem surpresas.
      7. *Categorias & Tetos Mensais:* definição de limites por categoria e barras de ritmo (`/orcamentos`).
      8. *Smart Advisor (Insights) & Relatórios:* recomendações de corte de gastos, fechamento mensal e gráficos executivos (`/relatorios`).
  - [x] **Reestruturação Completa do Tour Geral de Investimentos (`investments`):**
    * Compor uma trilha integrada de aprendizado patrimonial:
      1. *Visão Patrimonial Global:* distribuição por classes (Renda Fixa, Ações, FIIs, Cripto) e saldo em corretora (`/investments`).
      2. *Cadastro de Ativo (Nova Operação):* registro de compras com preço médio, quantidade e corretora.
      3. *Metas Estratégicas de Alocação:* definição de percentuais ideais por classe e papel (`/investments?tab=metas`).
      4. *Calculadora de Aporte Inteligente:* motor matemático de rebalanceamento sem vender posições (`/investments?tab=aporte`).
      5. *Proventos & Renda Passiva:* acompanhamento de dividendos e rendimentos futuros.
  - [x] **Reestruturação Completa do Tour de Configurações, Personalização & Suporte (`settings_support`):**
    * Substituir o tour simplório de 2 passos por uma jornada rica de 5 passos contemplando as capacidades avançadas de personalização do app:
      1. *Atalhos Rápidos de Cabeçalho:* Modo Privacidade (ocultar valores em público) e alternância de Tema no Header (`data-tour="header-privacy-theme"`).
      2. *Modos de Experiência & Sensorial:* Presets Dinâmico, Foco (Minimalista) e Discreto (Silencioso), regulando densidade, sons e haptics (`/configuracoes?tab=appearance` -> `[data-tour="settings-experience-presets"]`).
      3. *Identidade Visual & Cores de Destaque:* Seleção de temas Claro/Escuro/Sistema, paleta de cores primárias (Teal, Blue, Emerald, Violet...) e modo sem centavos no Dashboard (`[data-tour="settings-visual-identity"]`).
      4. *Notificações, Lembretes & Assistente Bancário:* Gestão de alertas de vencimento, fechamento diário e leitor passivo de notificações (`/configuracoes?tab=notifications` -> `[data-tour="settings-notifications-card"]`).
      5. *Central de Ajuda & Suporte Direto:* Rolagem determinística até a seção de suporte no rodapé da página (`/configuracoes` -> `[data-tour="settings-support-card"]`) com `scrollIntoView` forçado até o final da página e ancoragem superior do card popover (`preferredPlacement: "top"`).
  - [x] **Diagnóstico do Passo 5 de Configurações Invisível / Órfão:**
    * **O que acontece:** Ao avançar do Passo 4 (`/configuracoes?tab=notifications`) para o Passo 5 (`/configuracoes`), a navegação para a rota sem query param remove a aba ativa, voltando para `appearance`. A seção `[data-tour="settings-support-card"]` fica no fim da página, bem abaixo da primeira dobra (`mb-12`). Como o container `#main-content` não rolava até o final, a seção ficava fora da viewport visível e o spotlight desistia ou calculava coordenadas fora da tela, fazendo o card desaparecer.
    * **Solução:** No Passo 5, garantir rota explícita `/configuracoes` (ou `/configuracoes?tab=account` / aba ativa com suporte), disparar rolagem garantida até o fim do `#main-content` (`container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })`) e ancorar o popover no topo da tela com `preferredPlacement: "top"`.
  - [x] **Preservação dos Micro-Tours Modulares:** Manter disponíveis no `DemoTrackSelectModal` os micro-tours individuais de 2 a 3 passos para usuários que queiram apenas consultar tópicos rápidos sob demanda.

- [x] **8.6. Centralização Determinística no Viewport Útil Mobile & Calibragem Precisa do FAB**
  - [x] **Diagnóstico do Escondimento sob a BottomNav:**
    * No mobile, o container `<main id="main-content">` se estende até o chão da tela e a `<BottomNav>` flutua por cima com `fixed bottom-0` e altura de `64px + safe-area-bottom` (~80px).
    * Se o card explicativo ancora no topo e o elemento focado rola para o final da página (ou usa `block: "end"`), o elemento é empurrado exatamente para baixo da barra inferior, ficando totalmente oculto pelo menu.
  - [x] **Diagnóstico da Descentralização do Botão FAB (+):**
    * Na captura de tela, o recorte verde aparece como um retângulo largo deslocado para baixo e achatado na parte inferior.
    * **Causa Raiz:** O atributo `data-tour="bottom-nav-wizard"` foi colocado no contêiner pai `<NavLink>` (`flex min-h-11 items-center justify-center`). Esse link ocupa o slot da coluna (altura de 44px) dentro da barra inferior, enquanto o botão FAB físico real é o círculo flutuante interno com margem negativa (`-mt-6`) e tamanho `size-14` (56px) / `size-12` (48px). O spotlight estava medindo a caixa retangular do link em vez do círculo do botão!
    * **Solução:** Mover `data-tour="bottom-nav-wizard"` para o elemento circular real do botão (`<span className="-mt-6 flex size-14 ...">` ou no botão físico `<span className="flex size-12 ...">`) e utilizar `rounded-full` (`borderRadius: 9999`) no cálculo do spotlight para gerar um recorte perfeitamente circular e milimetricamente centralizado no FAB (+).
  - [x] **Fórmula Matemática do Viewport Útil Livre:**
    * Calcular a janela visual livre de obstrução no mobile:
      ```ts
      const headerHeight = 64; // Header fixo superior
      const bottomNavHeight = 72; // Altura efetiva da barra de ferramentas inferior + safe area
      const cardHeight = isMobile ? (cardRef.current?.offsetHeight || 180) : 0;
      
      // Quando o card ancorar no topo: a área visível para o elemento fica entre (headerHeight + cardHeight + 16) e (window.innerHeight - bottomNavHeight - 16)
      // Quando o card ancorar na base: a área visível fica entre (headerHeight + 16) e (window.innerHeight - cardHeight - bottomNavHeight - 16)
      ```
  - [x] **Rolagem para o Centro da Janela Livre (Dead Center do Viewport Útil):**
    * Em vez de alinhar com `block: "end"` ou `targetScrollTop` extremo, rolar o elemento para que seu centro fique exatamente no ponto médio da zona visível desobstruída:
      `targetScrollTop = container.scrollTop + (elementCenterY - viewportFreeCenterY)`.
    * Garantir que tanto a mensagem explicativa quanto a barra inferior respeitem uma margem de segurança mínima de 16px acima e abaixo do recorte iluminado.

- [x] **8.7. Resiliência de Carregamento e Foco de Elementos com Montagem Tardia**
  - [x] **Diagnóstico de Falhas de Foco / Carregamento:**
    * Elementos que dependem de queries assíncronas do TanStack Query ou de animações de transição de rota (`animate-route-in`, 150ms) demoram mais que os 8 attempts de 100ms caso a CPU do smartphone engasgue.
    * Quando a busca falha (`attemptsLeft === 0`), o Spotlight desistia, chamava `updateTargetRect()` vazio e o spotlight ficava órfão ou centralizado no vazio.
  - [x] **Implementação de MutationObserver + Polling Adaptativo com Timeout de 2.5s:**
    * Substituir o timer fixo frágil por uma estratégia híbrida:
      1. Tenta encontrar imediatamente no DOM.
      2. Se não encontrar, acopla um `MutationObserver` ao `#main-content` ouvindo inserções de novos nós por até 2500ms.
      3. Assim que o nó correspondente ao `targetSelector` for montado e possuir dimensões válidas (`width > 0 && height > 0`), desconecta o observer e dispara imediatamente a medição e rolagem.
    * Adicionar esqueleto discreto de foco com fallback gracioso para impedir recortes pretos congelados enquanto os dados carregam.

- [x] **8.8. Adaptação Responsiva Desktop vs Mobile (Tratamento para Ausência de FAB)**
  - [x] **Contratos de Domínio Responsivos (`src/domain/demo-simulation/types.ts`):**
    * Manter e utilizar propriedades adaptativas:
      ```ts
      targetSelectorDesktop?: string;
      titleDesktop?: string;
      contentDesktop?: string;
      ```
  - [x] **Resolução Dinâmica do Alvo no Spotlight (`demo-tour-spotlight.tsx`):**
    * Detectar viewport desktop (`window.innerWidth >= 768`) e utilizar `targetSelectorDesktop` prioritariamente.
    * No Desktop, apontar para `[data-tour="desktop-new-transaction"]` e atalho `Ctrl+K`, em vez de procurar o botão central da `BottomNav`.

- [x] **8.9. Governança Contextual de Handoff e Modais de Entrada (`handoff.ts`)**
  - [x] **Regra de Ouro: Modais de Ação Apenas nos Tours Completos (Zero Interrupção em Micro-Tours):**
    * **Nos Micro-Tours Individuais** (`finances_overview`, `finances_wizard`, `finances_cards`, `finances_budgets`, `finances_insights`, `investments_overview`, `investments_assets`, `investments_targets`, `investments_aporte`, `settings_support`, `app_native_apk`):
      - O usuário buscou uma consulta didática pontual. Ao concluir ("Começar" ou `[X]`), encerra **sem nenhum modal**, permanecendo na rota atual limpa (`/`, `/cartoes`, `/orcamentos`, `/investments`).
    * **No Tour Completo de Finanças Diárias (`finances`):**
      - Ao concluir a jornada completa de finanças, direciona para `/?novo=transacao` (ou `/?novo=despesa`), abrindo sobre o Dashboard o modal central **LaunchWizard** (inserção guiada do 1º lançamento de despesa/renda para iniciar a conta real).
    * **No Tour Completo de Investimentos & Rebalanceamento (`investments`):**
      - Ao concluir a jornada completa de investimentos, direciona para `/investments?novo=investimento` (ou `/investments?tab=aporte`), abrindo o modal de **Inserção de Operação/Aporte** para cadastrar o primeiro ativo patrimonial.
    * **No Tour Completo de Configurações, Visual e Suporte (`settings` / `settings_support` completo):**
      - Ao concluir, direciona para `/configuracoes?tab=suporte` (ou abre o canal/modal de **Suporte e Ajuda**), permitindo ao usuário tirar dúvidas imediatamente ou falar com o atendimento.
  - [x] **Atualização da Função Pura `getTourHandoffDestination()` (`src/domain/demo-simulation/handoff.ts`):**
    * Recebe `(track: TourTrackId | null, currentPath?: string)`.
    * Verifica se a trilha concluída é um Tour Completo (`track === "finances"`, `track === "investments"`, etc.) para injetar o parâmetro de ação (`novo=...`), ou se é micro-tour para retornar estritamente a rota limpa sem query params invasivos.
  - [x] Atualizar testes unitários em `handoff.test.ts` cobrindo tanto a abertura dos modais certos nos tours completos quanto o fechamento limpo nos micro-tours.

- [x] **8.10. Otimização de Responsividade e Refinamento Visual dos Cards Popover**
  - [x] **Diagnóstico da Quebra Visual e Colisão de Elementos no Rodapé:**
    * Na captura de tela, o botão *"Começar Conta Real"* colide com os dots de progresso e transborda para fora da margem direita do card popover.
    * **Causa Raiz 1 (Largura Rígida Desktop):** `desktopCardStyle()` usava `cardWidth = 380` rígido. Em passos com 8 passos (como Finanças Diárias completo), a soma de:
      Botão Anterior (~90px) + 8 dots de progresso com gap (~85px) + Botão *"Começar Conta Real"* (~165px) + gaps e paddings internos (~48px) = **~388px**.
      O conteúdo ultrapassa os 380px estáticos, esmagando os dots e fazendo o botão saltar para fora da borda arredondada.
    * **Causa Raiz 2 (Layout Flex Rígido no Rodapé):** O rodapé do card usava `flex items-center justify-between gap-2` com todos os botões marcados com `shrink-0`. Sem flexibilidade, quando a largura atinge o limite, os elementos se sobrepõem visualmente.
  - [x] **Solução Arquitetural Responsiva:**
    * **Largura Adaptativa no Desktop:** Alterar a largura do card para `min(420px, calc(100vw - 32px))` (ou `w-[420px]` dinâmico), oferecendo a folga necessária para comportar os 8 dots e o botão com rótulo completo.
    * **Auto-fit Inteligente no Botão de Ação:** Usar `max-w-fit truncate` ou encurtar o rótulo suavemente para `"Começar"` caso a largura disponível seja restrita (`< 400px`), mantendo o ícone `<Check className="size-3.5" />` e a ergonomia intacta.
    * **Clamp Horizontal contra a Sidebar Desktop:** Garantir que o card popover nunca fique colado nas bordas nem sobreponha a Sidebar de navegação esquerda (`DesktopNav`), respeitando `left >= sidebarWidth + 16px`.

- [x] **8.11. Testes Unitários e Validação da Fase 8**
  - [x] Testar `getTourTrackCategoryLabel` assegurando 100% de precisão nos badges.
  - [x] Testar cálculo da janela livre útil mobile e ausência de sobreposição por BottomNav.
  - [x] Testar resiliência com MutationObserver em montagens tardias de elementos assíncronos.
  - [x] Testar encadeamento dos passos dos novos tours gerais em `tour-steps.test.ts`.
  - [x] Testar persistência do nó do card e ausência de flashes em `demo-tour-spotlight.test.tsx`.
  - [x] Testar conclusão limpa de todos os tours em `handoff.test.ts`.

#### Portão de Qualidade 8:
- [x] `npm run typecheck` executado com zero erros de tipo.
- [x] `npm run lint` aprovado sem violações.
- [x] `npm test -- src/domain/demo-simulation/ tour-steps spotlight handoff` 100% verde.
- [x] Teste Manual Mobile (iPhone/Android Viewport): Percorrer passos longos (ex: Passo 1 KPIs e Passo 6 Parceladas) comprovando que o elemento iluminado NUNCA fica escondido atrás da BottomNav nem colado no card superior, mantendo-se perfeitamente visível na zona central livre.
- [x] Teste Manual Desktop e Mobile: Percorrer os tours de Finanças e Orçamentos e conferir se os badges indicam "Finanças Diárias".
- [x] Teste Manual de Lançamentos: Comprovar que o passo de lançamento demonstra o modal com campos didáticos em vez de um item solto do extrato.
- [x] Teste Manual do Tour Geral: Percorrer o tour geral de Finanças e de Investimentos comprovando a jornada lógica e completa de todas as funcionalidades.
- [x] Teste Manual de Conclusão: Concluir os tours completos (Finanças, Investimentos, Configurações) comprovando a abertura do modal correto (LaunchWizard para Finanças, Aporte para Investimentos, Suporte para Configurações), e concluir micro-tours comprovando encerramento limpo sem nenhum modal.

#### Commit & Push 8:
- [x] Mensagem de Commit: `refactor(tour): aprimora taxonomia de badges, didatica dos tours gerais e foco nos modais reais`
- [x] Executar push para a branch remota.

---

### FASE 7: CONSOLIDAÇÃO FINAL, GIT PUSH & NOTIFICAÇÃO TELEGRAM (ARGOS)

**Meta:** Sincronização final do repositório (`git push`) e disparo de relatório executivo de release via Bot Telegram ARGOS.

#### Tarefas:
- [x] **7.3. Sincronização Final com Git Push**
  - [x] Verificar status do git com `git status`.
  - [x] Commitar todas as correções residuais: `fix(tour): resolve fragilidades remanescentes e consolida release`.
  - [x] Executar `git push origin main` (ou branch ativa).

- [x] **7.5. Notificação e Relatório Executivo via Bot Telegram (ARGOS)**
  - [x] Construir payload da mensagem formatado em HTML/Markdown contendo:
    * 📋 **Relatório da Release:** Resumo consolidado de todas as correções entregues (eliminação do erro SQL em cartões, motor de centralização determinístico no `#main-content`, anti-colisão mobile, supressão de toast durante modais, catálogo de micro-tours e tour do APK nativo).
    * 🗄️ **Diagnóstico de Banco de Dados / Supabase:** Confirmação explícita e transparente se há necessidade de rodar alguma migração de schema/SQL no Supabase (no caso da simulação em memória do tour e da governança de modais: destacar que **NÃO requer nenhuma migração de banco de dados**, operando com zero downtime e isolamento estrito in-memory).
    * 📱 **Status do APK:** Confirmação de integridade dos assets para distribuição nativa.
    * ✅ **Métricas de Qualidade:** Confirmação de 100% dos testes verdes e typecheck limpo.
  - [x] Disparar a mensagem via Telegram Bot API para o bot ARGOS utilizando `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` configurados no ambiente.
  - [x] Validar o retorno HTTP 200 OK da API do Telegram.

---

## 4. MATRIZ DE ARQUIVOS E RESPONSABILIDADES

| Arquivo | Ação | Fase | Responsabilidade Técnica |
|---|---|---|---|
| `src/state/queries/use-simulated-queries.ts` | Modificação | Fase 1 | Criação de mocks para despesas e pagamentos de cartão |
| `src/state/queries/use-card-payments.ts` | Modificação | Fase 1 | Chaveamento demo eliminando erro de sintaxe UUID |
| `src/state/queries/use-overview.ts` | Modificação | Fase 1 | Chaveamento demo em totais consolidados de cartão |
| `src/app/router.tsx` | Modificação | Fase 1 | Preservação de query strings no redirecionamento legado |
| `src/features/transactions/pages/transaction-list-page.tsx` | Modificação | Fase 1 | Inclusão de seletor contido de extrato |
| `src/components/modules/demo-tour-spotlight.tsx` | Modificação | Fases 2, 5, 7 | Motor de centralização, listener em `#main-content`, anti-colisão, A11y e mitigação de leaks |
| `src/components/modules/demo-tour-spotlight.test.tsx` | Modificação | Fases 2, 5 | Testes de centralização, anti-colisão, dots e foco |
| `src/domain/demo-simulation/types.ts` | Modificação | Fase 3 | Novos contratos de trilhas e micro-tours |
| `src/domain/demo-simulation/tour-steps.ts` | Modificação | Fases 1, 3 | Passos de todos os micro-tours e tour do APK nativo |
| `src/domain/demo-simulation/tour-steps.test.ts` | Modificação | Fases 1, 3 | Asserções de rotas e integridade dos novos passos |
| `src/components/layout/bottom-nav.tsx` | Modificação | Fase 3 | Seletor `data-tour="bottom-nav-wizard"` no botão central |
| `src/components/modules/demo-track-select-modal.tsx` | Modificação | Fase 3 | Redesign do seletor em Hub de Micro-Tours |
| `src/hooks/use-active-overlays.ts` | Criação | Fase 4 | Hook de detecção de modais, diálogos e wizards abertos |
| `src/components/modules/native-update-toast.tsx` | Modificação | Fase 4 | Supressão de toast de atualização durante modais e adiamento no dismiss |
| `src/components/modules/native-update-toast.test.tsx` | Modificação | Fase 4 | Testes de supressão de toast durante modais ativos |
| `src/components/modules/demo-tour-bar.tsx` | Documentação | Fase 6 | Marcação de depreciação e manutenção da tipagem |
| `src/domain/demo-simulation/metadata.ts` | Criação | Fase 8 | Função pura canônica de taxonomia e rótulos de categoria de trilha |
| `src/domain/demo-simulation/metadata.test.ts` | Criação | Fase 8 | Testes unitários de precisão dos rótulos e taxonomia semântica |
| `scripts/build-apk.sh` | Execução | Fase 7 | Script oficial de compilação e assinatura do APK Android |
| `docs/plans/PLANO_CORRECAO_E_OTIMIZACAO_TOUR_INTERATIVO.md` | Criação/Refinamento | Planejamento | Documento canônico da refatoração |

---

## 5. DEFINITION OF DONE (CRITÉRIOS DE ACEITAÇÃO FINAIS)

- [x] **Zero Erros de API/Postgres:** Nenhuma mensagem *"Algo deu errado"* em Cartões ou em qualquer outra tela do tour.
- [x] **Centralização Precisa:** O spotlight centraliza com margem uniforme nos elementos tanto ao avançar quanto ao retroceder passos, sem tremores ou medições no meio da animação de scroll.
- [x] **Zero Sobreposição no Mobile:** O popover explicativo detecta o centro do elemento e ancora no topo ou na base, mantendo o conteúdo focado 100% desobstruído.
- [x] **Zero Conflito entre Modais e Atualização:** O toast de nova versão NUNCA aparece sobre modais de onboarding, wizards de transação ou diálogos do app; se dispensado no [X], só volta a sugerir na próxima abertura do app.
- [x] **Catálogo Completo de Micro-Tours:** O usuário pode escolher entre um tour geral rápido ou micro-tours específicos (Wizard +, Cartões, Orçamentos, Insights, Ativos, Aporte, Suporte).
- [x] **Onboarding Nativo do APK Android:** Novos usuários no app nativo recebem apresentação das notificações bancárias automáticas e da biometria.
- [x] **Aderência ao Design System:** Badges em tom suave (`muted`), acento primário estritamente no CTA, sem emojis, tipografia adaptativa.
- [x] **Acessibilidade WCAG 2.1 AA:** Foco confinado (focus trap), navegação por teclado e por dots, anúncios em leitores de tela.
- [x] **Revisão de Fragilidades Concluída:** Toda e qualquer fragilidade, bug ou vazamento de listener identificado é corrigido antes do release.
- [x] **Git Push Concluído:** Repositório sincronizado remotamente com histórico limpo e atômico.
- [x] **Build do APK Android Gerado:** APK assinado e compilado com sucesso via `npm run build:apk`.
- [x] **Notificação Telegram Entregue:** Relatório detalhado disparado e recebido com sucesso via bot ARGOS com diagnóstico explícito sobre migração Supabase.
