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
[FASE 2: MOTOR DE SCROLL & CENTRALIZAÇÃO]   ░░░░░░░░░░░░░░░░░░░░   0% Pendente
[FASE 3: CATÁLOGO DE MICRO-TOURS & APK]      ░░░░░░░░░░░░░░░░░░░░   0% Pendente
[FASE 4: GOVERNANÇA DE MODAIS & UPDATE TOAST]░░░░░░░░░░░░░░░░░░░░   0% Pendente
[FASE 5: DESIGN SYSTEM, RESPONSIVIDADE & A11Y]░░░░░░░░░░░░░░░░░░░░   0% Pendente
[FASE 6: AUDITORIA INTEGRADA & POLIMENTO]    ░░░░░░░░░░░░░░░░░░░░   0% Pendente
[FASE 7: REVISÃO, PUSH, BUILD APK & TELEGRAM]░░░░░░░░░░░░░░░░░░░░   0% Pendente
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
- [ ] **2.1. Ouvinte de Scroll no Container Correto (`src/components/modules/demo-tour-spotlight.tsx`)**
  - [ ] Substituir `window.addEventListener("scroll", ...)` pelo listener no elemento `#main-content`:
    ```ts
    const container = document.getElementById("main-content");
    container?.addEventListener("scroll", handleResizeOrScroll, { passive: true });
    ```

- [ ] **2.2. Algoritmo Determinístico de Scroll com Offset do Header**
  - [ ] Substituir `element.scrollIntoView({ behavior: "smooth" })` por rolagem matemática calculada no container:
    ```ts
    const container = document.getElementById("main-content");
    const headerHeight = 64; // altura do header fixo
    const targetScrollTop = element.offsetTop - headerHeight - 16;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
    ```
  - [ ] Resetar `container.scrollTop = 0` imediatamente ao mudar de rota antes de buscar o novo elemento.

- [ ] **2.3. Sincronização Precisa pós-Estabilização (Fim Real da Rolagem)**
  - [ ] Eliminar `setTimeout(updateTargetRect, 200)`.
  - [ ] Implementar verificação de estabilização via `scrollend` com fallback de `requestAnimationFrame` que confirma quando o `container.scrollTop` para de variar por 2 frames consecutivos antes de chamar `updateTargetRect`.
  - [ ] Acoplar `ResizeObserver` ao elemento-alvo para recalcular dimensões caso o layout sofra expansão tardia.

- [ ] **2.4. Motor Anti-Colisão Mobile Adaptativo**
  - [ ] Medir posição vertical do elemento em relação à viewport:
    * Se `rect.y + rect.height / 2 > window.innerHeight * 0.45`:
      - Ancorar no **TOPO**: `fixed inset-x-3 top-[max(env(safe-area-inset-top,0px),16px)]`.
    * Se `rect.y + rect.height / 2 <= window.innerHeight * 0.45`:
      - Ancorar na **BASE**: `fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom,0px),16px)]`.
  - [ ] Limitar altura máxima do card mobile: `max-h-[42vh]` com `overflow-y-auto`.

- [ ] **2.5. Posicionamento Dinâmico no Desktop com Altura Real**
  - [ ] Substituir constante `220` pela medição real `cardRef.current?.offsetHeight`.
  - [ ] Inverter colocação (topo ↔ base) dinamicamente caso o espaço inferior seja menor que o card.
  - [ ] Clamp horizontal de segurança: `Math.max(16, Math.min(rect.x, window.innerWidth - cardWidth - 16))`.

- [ ] **2.6. Testes Unitários de Posicionamento e Anti-Colisão**
  - [ ] Testar cenários de viewport mobile simulando elemento no topo e na base em `demo-tour-spotlight.test.tsx`.

#### Portão de Qualidade 2:
- [ ] `npm run typecheck` aprovado.
- [ ] `npm run lint` aprovado.
- [ ] `npm test -- src/components/modules/demo-tour-spotlight.test.tsx` aprovado.
- [ ] Teste Manual: Navegar para frente e para trás entre os passos de Finanças e Investimentos no mobile (375x667 e 390x844). Comprovar que o recorte não oscila e que o card nunca encobre o elemento focado.

#### Commit & Push 2:
- [ ] Mensagem de Commit: `feat(tour): implementa motor de centralizacao deterministico e anti-colisao mobile`
- [ ] Executar push para a branch remota.

---

### FASE 3: CATÁLOGO DE MICRO-TOURS HIERÁRQUICOS & TOUR DO APK NATIVO

**Meta:** Transformar o seletor em um Hub de Aprendizado sob demanda com micro-tours específicos e tour de onboarding para o aplicativo APK Nativo (Android).

#### Tarefas:
- [ ] **3.1. Expansão de Tipos e Contratos de Domínio (`src/domain/demo-simulation/types.ts`)**
  - [ ] Expandir `TourTrackId` para suportar:
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
  - [ ] Criar estrutura de grupos de trilhas com metadados (ícone, categoria, passos, badges de conclusão).

- [ ] **3.2. Mapeamento dos Passos dos Novos Micro-Tours (`tour-steps.ts`)**
  - [ ] **Micro-Tour Wizard (+):**
    * Passo 1: Botão `+` na BottomNav (`[data-tour="bottom-nav-wizard"]`).
    * Passo 2: Modal do Wizard (seleção de despesa, receita, PIX).
    * Passo 3: Parcelamento inteligente de despesas.
  - [ ] **Micro-Tour Insights & Relatórios:**
    * Passo 1: Smart Advisor / Alertas de Ritmo na Home.
    * Passo 2: Radar de Assinaturas na tela de Cartões.
    * Passo 3: Fechamento mensal em Relatórios (`/relatorios`).
  - [ ] **Micro-Tour Ativos de Investimento:**
    * Passo 1: Botão `+ Nova Operação` em Investimentos.
    * Passo 2: Adicionar saldo em Caixa de corretora.
  - [ ] **Micro-Tour Personalização & Suporte:**
    * Passo 1: Botão de Privacidade (esconder saldos) e Tema no Header.
    * Passo 2: Canal direto de suporte no menu Mais/Configurações.
  - [ ] **Tour Exclusivo do APK Nativo Android (`app_native_apk`):**
    * Passo 1: Interface nativa e desempenho acelerado.
    * Passo 2: Assistente de Notificações Bancárias (captura automática de compras).
    * Passo 3: Bloqueio por Biometria e Escudo de Privacidade.

- [ ] **3.3. Inclusão dos Atributos `data-tour` nas Telas Correspondentes**
  - [ ] BottomNav: `data-tour="bottom-nav-wizard"` no botão central flutuante.
  - [ ] Investimentos: `data-tour="investments-new-op"` no botão Nova Operação.
  - [ ] Header: `data-tour="header-privacy-theme"` nos botões de privacidade e tema.

- [ ] **3.4. Redesign do Modal Seletor (`src/components/modules/demo-track-select-modal.tsx`)**
  - [ ] Renderizar Hub de Aprendizado com seções colapsáveis ou agrupadas por abas:
    * Card de Boas-Vindas do APK Nativo em destaque caso `isNative()` retorne `true`.
    * Bloco de Finanças Diárias com botão de "Visão Geral" e lista de 4 micro-tours específicos.
    * Bloco de Investimentos com botão de "Visão Geral" e lista de 4 micro-tours específicos.
    * Bloco de Configurações, Visual e Suporte.
  - [ ] Exibir badge `"Concluído"` em cada micro-tour finalizado pelo usuário.

- [ ] **3.5. Disparo de Onboarding no Primeiro Uso / Instalação do APK**
  - [ ] Em `src/state/demo-mode/demo-storage.ts`, verificar se o usuário já viu o onboarding nativo.
  - [ ] Se estiver rodando no APK (`isNative()`) e for o primeiro acesso, sugerir automaticamente o micro-tour de recursos nativos.

#### Portão de Qualidade 3:
- [ ] `npm run typecheck` aprovado.
- [ ] `npm run lint` aprovado.
- [ ] `npm test -- src/domain/demo-simulation/` aprovado com todos os novos passos validados.
- [ ] Teste Manual: Abrir o modal de seleção e comprovar a listagem organizada de micro-tours; iniciar o micro-tour do Wizard (+) e verificar se o botão central é focado com precisão.

#### Commit & Push 3:
- [ ] Mensagem de Commit: `feat(tour): implementa catalogo de micro-tours modulares e onboarding nativo do apk`
- [ ] Executar push para a branch remota.

---

### FASE 4: GOVERNANÇA DE MODAIS, PREVENÇÃO DE COLISÃO & NATIVE UPDATE TOAST

**Meta:** Eliminar 100% dos conflitos e sobreposições entre o Toast de Nova Versão e os modais/wizards do app, garantindo que atualizações só sejam sugeridas em momentos tranquilos e postergadas com persistência limpa.

#### Tarefas:
- [ ] **4.1. Hook Global de Detecção de Overlays Ativos (`src/hooks/use-active-overlays.ts`)**
  - [ ] Implementar verificação reativa que detecta:
    * Existência de `[role="dialog"]:not([data-state="closed"]):not([data-lock-overlay])` ou `[role="alertdialog"]` no DOM.
    * Se o tour de demonstração está ativo (`isDemoActive === true`).
    * Se o assistente de lançamento `LaunchWizard` está aberto (`wizardOpen === true`).
    * Se modais de primeiro uso / onboarding (`WelcomeFeatureModal`) estão abertos.
  - [ ] Retornar `hasBlockingOverlay: boolean` para componentes de notificação.

- [ ] **4.2. Supressão Condicional no `NativeUpdateToast` (`src/components/modules/native-update-toast.tsx`)**
  - [ ] Integrar `useActiveOverlays()`: se `hasBlockingOverlay === true`, retornar `null` (ou adiar a exibição).
  - [ ] Quando o modal/tour for fechado pelo usuário e a tela voltar ao estado limpo, permitir que o Toast seja exibido com transição suave.

- [ ] **4.3. Persistência de Adiantamento por Sessão no Dismiss (`[X]`)**
  - [ ] Ao clicar no `[X]` de dispensar o `NativeUpdateToast`, gravar flag com timestamp no `sessionStorage` (ou `localStorage` com prazo de 12 horas):
    `sessionStorage.setItem("financas:update_dismissed_session", "true")`.
  - [ ] Evitar que o toast volte a interromper o usuário durante a mesma sessão de uso. A notificação só volta a ser checada e sugerida na próxima vez que o aplicativo for aberto.

- [ ] **4.4. Prevenção de Bloqueio de Ponteiros e Stacking Context (`src/components/ui/toast.tsx`)**
  - [ ] Assegurar que o `Viewport` do Radix Toast e os itens de Toast não bloqueiem eventos de clique do modal inferior quando montados.
  - [ ] Ajustar `z-index`: o `NativeUpdateToast` deve operar com coordenação para que nunca sobreponha modais de primeiro uso.

- [ ] **4.5. Testes Unitários de Supressão de Modais (`native-update-toast.test.tsx`)**
  - [ ] Criar caso de teste: com atualização disponível e modal aberto (`[role="dialog"]` presente), comprovar que o Toast NÃO é renderizado.
  - [ ] Criar caso de teste: ao fechar o modal, comprovar que o Toast passa a ser exibido.
  - [ ] Criar caso de teste: ao clicar em dispensar `[X]`, comprovar que a preferência persiste e não reabre na mesma sessão.

#### Portão de Qualidade 4:
- [ ] `npm run typecheck` aprovado.
- [ ] `npm run lint` aprovado.
- [ ] `npm test -- src/components/modules/native-update-toast.test.tsx` aprovado.
- [ ] Teste Manual: Simular nova versão disponível e abrir o modal "A Mágica da Captura Sem Fricção" (ou o LaunchWizard). Comprovar que o banner de atualização NÃO aparece sobre o modal. Fechar o modal e comprovar que o toast de atualização aparece calmamente na tela inicial.

#### Commit & Push 4:
- [ ] Mensagem de Commit: `fix(updates): suprime toast de nova versao durante modais e persiste adiamento no dismiss`
- [ ] Executar push para a branch remota.

---

### FASE 5: DESIGN SYSTEM, RESPONSIVIDADE & ACESSIBILIDADE WCAG

**Meta:** Ajustar tipografia e botões para mobile (< 400px), aplicar tokens semânticos e implementar focus trap e leitor de tela.

#### Tarefas:
- [ ] **5.1. Rodapé Adaptativo sem Esmagamento (< 400px)**
  - [ ] Botão "Anterior": ícone `<ArrowLeft className="size-3.5" />` com texto `sm:inline`.
  - [ ] Dots de progresso: estilizados como pílulas discretas com espaçamento seguro.
  - [ ] Botão Conclusão adaptativo:
    * `sm:hidden`: `"Começar"`.
    * `hidden sm:inline`: `"Começar Conta Real"`.

- [ ] **5.2. Conformidade com a Regra 13 do Design System (Hierarquia Semântica)**
  - [ ] Trocar badge de passo de `variant="default"` para `variant="muted"`.
  - [ ] Ícone Sparkles em `text-muted-foreground`.
  - [ ] Manter cor `primary` exclusivamente no botão CTA de avanço.

- [ ] **5.3. Backdrop Suave e Borda Arredondada**
  - [ ] Opacidade suave de fundo: `fill="rgba(0, 0, 0, 0.60)"`.
  - [ ] Cantos arredondados do recorte com `rx={16}` e `ry={16}` (`rounded-2xl`).
  - [ ] Pulso da borda cessa suavemente após 3 segundos.

- [ ] **5.4. Focus Trap e Gerenciamento de Foco**
  - [ ] Salvar `document.activeElement` antes de abrir o tour.
  - [ ] Mover foco para o botão de ação ao renderizar o passo.
  - [ ] Confinar ciclo de Tab/Shift+Tab dentro do card popover.
  - [ ] Restaurar foco ao fechar via ESC ou botão `[X]`.

- [ ] **5.5. Acessibilidade ARIA e Anúncios para Leitores de Tela**
  - [ ] Inserir `aria-live="polite"` no bloco de título/descrição do passo.
  - [ ] Aplicar `role="presentation"` e `aria-hidden="true"` na camada SVG de fundo.
  - [ ] Tornar os dots clicáveis com `role="button"` e `aria-label={`Ir para o passo ${idx + 1}`}`.

#### Portão de Qualidade 5:
- [ ] `npm run typecheck` aprovado.
- [ ] `npm run lint` aprovado.
- [ ] `npm test -- src/components/modules/demo-tour-spotlight.test.tsx` aprovado.
- [ ] Teste Manual: Navegação 100% via teclado (Tab, Enter, Espaço, Setas ← →, Esc) em temas Claro e Escuro.

#### Commit & Push 5:
- [ ] Mensagem de Commit: `style(tour): alinha design tokens, ergonomia mobile, focus trap e a11y`
- [ ] Executar push para a branch remota.

---

### FASE 6: AUDITORIA FINAL INTEGRADA, GOVERNANÇA & POLIMENTO

**Meta:** Validar integridade de 100% da suíte de testes, marcar formalmente depreciações e atualizar a documentação.

#### Tarefas:
- [ ] **6.1. Governança e Limpeza de Componentes Legados**
  - [ ] Adicionar anotação `@deprecated` no JSDoc de `src/components/modules/demo-tour-bar.tsx`.
  - [ ] Assegurar que `page-shell.tsx` não renderiza a barra superior redundante.
  - [ ] Manter testes unitários de `demo-tour-bar.test.tsx` verdes para integridade.

- [ ] **6.2. Execução da Suíte Completa de Testes**
  - [ ] Rodar `npm test` em todo o repositório garantindo 100% de testes passando.
  - [ ] Executar auditoria de acessibilidade (`src/tests/accessibility-audit.test.tsx`).

- [ ] **6.3. Atualização de Documentação Canônica**
  - [ ] Atualizar referências no `docs/architecture/ESPECIFICACAO_TECNICA.md`.
  - [ ] Atualizar status da funcionalidade no `docs/roadmap/ROADMAP.md`.

#### Portão de Qualidade 6:
- [ ] `npm run typecheck` com zero erros.
- [ ] `npm run lint` 100% aprovado.
- [ ] `npm test` 100% verde em todos os arquivos de teste.
- [ ] Teste Manual E2E: Executar cada um dos micro-tours no desktop e em simulador mobile.

#### Commit & Push 6:
- [ ] Mensagem de Commit: `chore(tour): finaliza auditoria integrada, deprecation de componentes e documentacao`
- [ ] Executar push para a branch remota.

---

### FASE 7: REVISÃO DE FRAGILIDADES, RESOLUÇÃO DE BUGS, GIT PUSH, BUILD DO APK & NOTIFICAÇÃO TELEGRAM (ARGOS)

**Meta:** Realizar uma varredura completa de ponta a ponta procurando erros, bugs residuais e fragilidades de segurança/execução, implementar as soluções, realizar a sincronização final (`git push`), compilar o novo APK Android assinado e disparar relatório executivo com diagnóstico de migração Supabase via Bot Telegram ARGOS.

#### Tarefas:
- [ ] **7.1. Varredura Exaustiva de Fragilidades e Casos de Borda**
  - [ ] Verificar limpeza de listeners no `#main-content` ao desmontar o componente para evitar memory leaks.
  - [ ] Verificar transição entre modo demo e conta real (garantir que nenhum dado de mock vaze para o Supabase).
  - [ ] Verificar comportamento em modo offline ou rede intermitente durante o tour.
  - [ ] Verificar compatibilidade do tour exclusivo com permissões nativas no Android (notificações bancárias).
  - [ ] Identificar e corrigir qualquer bug ou fragilidade remanescente encontrada durante a revisão.

- [ ] **7.2. Portão de Qualidade Pré-Release (Preflight Check)**
  - [ ] Executar `npm run typecheck` (zero erros).
  - [ ] Executar `npm run lint` (zero warnings, sem emojis).
  - [ ] Executar `npm test` (100% de testes passando em toda a aplicação).
  - [ ] Executar `npm run preflight` (script oficial de prontidão).

- [ ] **7.3. Sincronização Final com Git Push**
  - [ ] Verificar status do git com `git status`.
  - [ ] Commitar todas as correções residuais: `fix(tour): resolve fragilidades remanescentes e consolida release`.
  - [ ] Executar `git push origin main` (ou branch ativa).

- [ ] **7.4. Compilação e Geração do APK Android da Nova Versão (`build:apk`)**
  - [ ] Executar o build de produção dos assets web: `npm run build`.
  - [ ] Sincronizar os assets e plugins nativos com o projeto Android: `npx cap sync android` (ou `npm run cap:sync`).
  - [ ] Executar o script oficial de build e assinatura do APK: `npm run build:apk`.
  - [ ] Validar a geração do artefato final em `dist-apk/` (ex: `dist-apk/guiafinanceiro-release.apk`).
  - [ ] Verificar a atualização do manifesto `public/releases/version.json` com a nova versão gerada.

- [ ] **7.5. Notificação e Relatório Executivo via Bot Telegram (ARGOS)**
  - [ ] Construir payload da mensagem formatado em HTML/Markdown contendo:
    * 📋 **Relatório da Release:** Resumo consolidado de todas as correções entregues (eliminação do erro SQL em cartões, motor de centralização determinístico no `#main-content`, anti-colisão mobile, supressão de toast durante modais, catálogo de micro-tours e tour do APK nativo).
    * 🗄️ **Diagnóstico de Banco de Dados / Supabase:** Confirmação explícita e transparente se há necessidade de rodar alguma migração de schema/SQL no Supabase (no caso da simulação em memória do tour e da governança de modais: destacar que **NÃO requer nenhuma migração de banco de dados**, operando com zero downtime e isolamento estrito in-memory).
    * 📱 **Status do APK:** Confirmação do build e assinatura da nova versão do APK, código de versão (`versionCode`), nome da versão (`versionName`) e caminho do arquivo gerado.
    * ✅ **Métricas de Qualidade:** Confirmação de 100% dos testes verdes, typecheck limpo e preflight check validado.
  - [ ] Disparar a mensagem via Telegram Bot API para o bot ARGOS utilizando `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` configurados no ambiente.
  - [ ] Validar o retorno HTTP 200 OK da API do Telegram.

#### Portão de Qualidade 7:
- [ ] Build do APK concluído com código de saída 0.
- [ ] Arquivo `.apk` assinado gerado com sucesso em `dist-apk/`.
- [ ] Repositório sincronizado e atualizado remotamente via `git push`.
- [ ] Mensagem de relatório entregue com sucesso no Telegram do bot ARGOS (HTTP 200 OK).

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
| `scripts/build-apk.sh` | Execução | Fase 7 | Script oficial de compilação e assinatura do APK Android |
| `docs/plans/PLANO_CORRECAO_E_OTIMIZACAO_TOUR_INTERATIVO.md` | Criação/Refinamento | Planejamento | Documento canônico da refatoração |

---

## 5. DEFINITION OF DONE (CRITÉRIOS DE ACEITAÇÃO FINAIS)

- [ ] **Zero Erros de API/Postgres:** Nenhuma mensagem *"Algo deu errado"* em Cartões ou em qualquer outra tela do tour.
- [ ] **Centralização Precisa:** O spotlight centraliza com margem uniforme nos elementos tanto ao avançar quanto ao retroceder passos, sem tremores ou medições no meio da animação de scroll.
- [ ] **Zero Sobreposição no Mobile:** O popover explicativo detecta o centro do elemento e ancora no topo ou na base, mantendo o conteúdo focado 100% desobstruído.
- [ ] **Zero Conflito entre Modais e Atualização:** O toast de nova versão NUNCA aparece sobre modais de onboarding, wizards de transação ou diálogos do app; se dispensado no [X], só volta a sugerir na próxima abertura do app.
- [ ] **Catálogo Completo de Micro-Tours:** O usuário pode escolher entre um tour geral rápido ou micro-tours específicos (Wizard +, Cartões, Orçamentos, Insights, Ativos, Aporte, Suporte).
- [ ] **Onboarding Nativo do APK Android:** Novos usuários no app nativo recebem apresentação das notificações bancárias automáticas e da biometria.
- [ ] **Aderência ao Design System:** Badges em tom suave (`muted`), acento primário estritamente no CTA, sem emojis, tipografia adaptativa.
- [ ] **Acessibilidade WCAG 2.1 AA:** Foco confinado (focus trap), navegação por teclado e por dots, anúncios em leitores de tela.
- [ ] **Revisão de Fragilidades Concluída:** Toda e qualquer fragilidade, bug ou vazamento de listener identificado é corrigido antes do release.
- [ ] **Git Push Concluído:** Repositório sincronizado remotamente com histórico limpo e atômico.
- [ ] **Build do APK Android Gerado:** APK assinado e compilado com sucesso via `npm run build:apk`.
- [ ] **Notificação Telegram Entregue:** Relatório detalhado disparado e recebido com sucesso via bot ARGOS com diagnóstico explícito sobre migração Supabase.
