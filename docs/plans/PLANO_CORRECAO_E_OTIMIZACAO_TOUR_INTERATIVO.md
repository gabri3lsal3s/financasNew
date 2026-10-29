# CHECKLIST DE EXECUÇÃO — CORREÇÃO INTEGRAL E OTIMIZAÇÃO DO TOUR INTERATIVO

> **Documento Canônico de Rastreabilidade e Governança**  
> **Status Geral:** Em Planejamento / Pronto para Execução  
> **Arquivo:** `docs/plans/PLANO_CORRECAO_E_OTIMIZACAO_TOUR_INTERATIVO.md`  
> **Regras Vinculantes:** `AGENTS.md` (Regras 4, 10, 11, 13, 14, 15, 17, 18).

---

## 📊 PROGRESSO GERAL DA FUNCIONALIDADE

```
[INFRAESTRUTURA BASE ANTERIOR]  ████████████████████ 100% Concluído
[FASE 1: DADOS & ROTEAMENTO]     ░░░░░░░░░░░░░░░░░░░░   0% Pendente
[FASE 2: MOTOR ANTI-COLISÃO]     ░░░░░░░░░░░░░░░░░░░░   0% Pendente
[FASE 3: DESIGN SYSTEM & UI]     ░░░░░░░░░░░░░░░░░░░░   0% Pendente
[FASE 4: ACESSIBILIDADE & POLISH]░░░░░░░░░░░░░░░░░░░░   0% Pendente
```

---

## 0. INFRAESTRUTURA BASE E ESTADO ATUAL (JÁ CONCLUÍDO)

Itens da arquitetura base do tour implementados anteriormente e validados na base de código:

- [x] **0.1. Máquina de Estados da Sessão Demo em Memória**
  - [x] Implementação de `useSyncExternalStore` em `src/state/demo-mode/demo-session-store.ts`.
  - [x] Funções puras `startDemo`, `endDemo`, `goToNextStep`, `goToPrevStep`, `setStepIndex`.
  - [x] Persistência de conclusão no `localStorage` em `src/state/demo-mode/demo-storage.ts`.
  - [x] Testes unitários do store em `demo-session-store.test.ts`.

- [x] **0.2. Gerador de Mock Data em Memória**
  - [x] Dataset de finanças com despesas, receitas, categorias e orçamentos em `mock-finances.ts`.
  - [x] Dataset de investimentos com ativos, metas e snapshots em `mock-investments.ts`.
  - [x] Testes de validação dos dados simulados em `mock-data.test.ts`.

- [x] **0.3. Modal de Escolha de Trilha**
  - [x] Componente `DemoTrackSelectModal` com seleção entre Finanças Diárias e Investimentos.
  - [x] Hand-off contextual de encerramento em `handoff.ts`.
  - [x] Indicador minimalista `"Modo Simulação"` no Header com botão `"Sair"`.

- [x] **0.4. Componente Primitivo de Spotlight**
  - [x] Camada SVG com máscara e recorte dinâmico em `demo-tour-spotlight.tsx`.
  - [x] Suporte a atalhos de teclado iniciais (Esc para sair, setas para navegar).

---

## 1. FASE 1: RESILIÊNCIA DE DADOS SIMULADOS & ROTEAMENTO DE ABAS

**Meta:** Eliminar todos os erros *"Algo deu errado. Tente novamente em instantes"* na tela de Cartões e garantir que as abas de Investimentos carreguem com dados mockados sem requisições reais quebrando no Supabase/PostgreSQL.

### Checklist de Tarefas:
- [ ] **1.1. Mocks de Despesas e Pagamentos de Cartão (`src/state/queries/use-simulated-queries.ts`)**
  - [ ] Implementar `useSimulatedCardExpenses(cardId: string | null)` para filtrar despesas do cartão simulado.
  - [ ] Implementar `useSimulatedCardPayments(cardId: string | null)` para simular faturas/pagamentos.
  - [ ] Implementar `useSimulatedAllCardExpenses()` retornando todas as compras com cartão.
  - [ ] Implementar `useSimulatedAllCardPayments()` com pagamentos consolidados simulados.

- [ ] **1.2. Chaveamento por `isDemoActive` nas Queries de Cartão**
  - [ ] Em `src/state/queries/use-card-payments.ts`: chavear `useCardExpenses` para retornar mock em demo e desabilitar query real.
  - [ ] Em `src/state/queries/use-card-payments.ts`: chavear `useCardPayments` para retornar mock em demo e desabilitar query real.
  - [ ] Em `src/state/queries/use-overview.ts`: chavear `useAllCardExpenses` com `isDemoActive`.
  - [ ] Em `src/state/queries/use-overview.ts`: chavear `useAllCardPayments` com `isDemoActive`.

- [ ] **1.3. Correção Canônica das Rotas e Parâmetros de Abas (`src/domain/demo-simulation/tour-steps.ts`)**
  - [ ] Atualizar rota do Passo 1 de Investimentos: `targetRoute: "/investments"`.
  - [ ] Atualizar rota do Passo 2 de Investimentos: `targetRoute: "/investments?tab=metas"`.
  - [ ] Atualizar rota do Passo 3 de Investimentos: `targetRoute: "/investments?tab=aporte"`.

- [ ] **1.4. Redimensionamento Ergonômico de Seletores em Listas**
  - [ ] Ajustar `targetSelector` do Passo 2 de Finanças em `tour-steps.ts` para focar um bloco/card contido em vez da lista inteira de 800px.
  - [ ] Inserir atributo correspondente `data-tour="transactions-feed-card"` em `transaction-list-page.tsx`.

- [ ] **1.5. Preservação de Query Strings em Redirecionamentos (`src/app/router.tsx`)**
  - [ ] Atualizar `<Route path="/investimentos" element={<Navigate to={`/investments${location.search}`} replace />} />`.

- [ ] **1.6. Testes Unitários de Rota e Queries**
  - [ ] Atualizar asserções de rota em `src/domain/demo-simulation/tour-steps.test.ts`.
  - [ ] Validar que as queries retornam mocks quando `isDemoActive: true`.

### Portão de Qualidade 1:
- [ ] `npm run typecheck` executado com zero erros de tipo.
- [ ] `npm run lint` aprovado sem violações ou emojis.
- [ ] `npm test -- src/domain/demo-simulation/tour-steps.test.ts` aprovado.
- [ ] Teste manual: Acessar `/cartoes` durante a simulação e verificar ausência de `ErrorState` ("Algo deu errado").
- [ ] Teste manual: Avançar passos de investimentos e confirmar que as abas "Metas" e "Aporte" abrem corretamente.

### Commit & Push 1:
- [ ] Commit: `fix(tour): intercepta queries de cartao em modo demo e corrige rotas de abas de investimentos`
- [ ] Push para o repositório remoto.

---

## 2. FASE 2: MOTOR ANTI-COLISÃO MOBILE & POSICIONAMENTO DINÂMICO

**Meta:** Garantir que o card explicativo do tour nunca encubra o elemento em foco no mobile e eliminar cálculos imprecisos de altura no desktop.

### Checklist de Tarefas:
- [ ] **2.1. Algoritmo de Detecção Anti-Colisão Mobile (`src/components/modules/demo-tour-spotlight.tsx`)**
  - [ ] Calcular centro vertical do elemento: `const elementCenterY = rect.y + rect.height / 2`.
  - [ ] Se `elementCenterY > window.innerHeight * 0.45`:
    - [ ] Ancorar popover no **TOPO**: `fixed inset-x-3 top-[max(env(safe-area-inset-top,0px),16px)]`.
  - [ ] Se `elementCenterY <= window.innerHeight * 0.45`:
    - [ ] Ancorar popover na **BASE**: `fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom,0px),16px)]`.
  - [ ] Aplicar limite vertical seguro: `max-h-[42vh]` com `overflow-y-auto`.

- [ ] **2.2. Scroll Suave Contextual (`scrollIntoView`)**
  - [ ] Alinhar com `block: "end"` quando o popover estiver ancorado no topo.
  - [ ] Alinhar com `block: "start"` ou `"center"` quando o popover estiver ancorado na base.
  - [ ] Adicionar retry com `ResizeObserver` para recalcular dimensões após carregamento assíncrono.

- [ ] **2.3. Posicionamento Dinâmico no Desktop com Altura Real**
  - [ ] Substituir `cardEstimatedHeight = 220` pela medição real `cardRef.current?.offsetHeight`.
  - [ ] Inverter colocação (top ↔ bottom) dinamicamente caso o espaço inferior seja menor que a altura do card.
  - [ ] Aplicar clamp horizontal estrito contra vazamento de viewport: `Math.max(16, Math.min(rect.x, window.innerWidth - cardWidth - 16))`.

- [ ] **2.4. Testes Unitários de Posicionamento e Anti-Colisão**
  - [ ] Adicionar cenários de teste simulando alvos no topo e na base em `demo-tour-spotlight.test.tsx`.

### Portão de Qualidade 2:
- [ ] `npm run typecheck` executado com sucesso.
- [ ] `npm run lint` executado com sucesso.
- [ ] `npm test -- src/components/modules/demo-tour-spotlight.test.tsx` aprovado.
- [ ] Teste manual: Simular mobile (375x667 e 390x844) e verificar que nenhum elemento recortado é encoberto pelo card.

### Commit & Push 2:
- [ ] Commit: `feat(tour): implementa motor anti-colisao adaptativo mobile e posicionamento dinamico desktop`
- [ ] Push para o repositório remoto.

---

## 3. FASE 3: ERGONOMIA VISUAL, DESIGN SYSTEM & RESPONSIVIDADE

**Meta:** Sanar o esmagamento de botões no mobile (< 400px), adequar as cores e badges ao Design System e incluir transições suaves.

### Checklist de Tarefas:
- [ ] **3.1. Rodapé Adaptativo para Telas Pequenas (< 400px)**
  - [ ] Botão "Anterior": texto com classe `sm:inline` e ícone `<ArrowLeft className="size-3.5" />`.
  - [ ] Dots de navegação: espaçamento balanceado e centrado sem esmagamento.
  - [ ] Botão de Avanço / Conclusão com rótulo adaptativo:
    - [ ] `sm:hidden`: `"Começar"`.
    - [ ] `hidden sm:inline`: `"Começar Conta Real"`.

- [ ] **3.2. Hierarquia Semântica de Cores (Regra 13 do `AGENTS.md`)**
  - [ ] Alterar badge do passo de `variant="default"` (primário) para `variant="muted"`.
  - [ ] Ícone Sparkles com tom neutro suave `text-muted-foreground`.
  - [ ] Reservar acento primário (`primary`) exclusivamente para o botão de ação (CTA).

- [ ] **3.3. Refinamento Estético do Backdrop SVG e Borda do Spotlight**
  - [ ] Ajustar opacidade do backdrop para `rgba(0, 0, 0, 0.60)` para evitar sensação de blecaute pesado.
  - [ ] Configurar borda pontilhada com cantos suaves `rx={16}` e `ry={16}` (`rounded-2xl`).
  - [ ] Fazer a animação `animate-pulse` da borda cessar suavemente após 3 segundos.

- [ ] **3.4. Transições de Passo Fluidas**
  - [ ] Inserir `key={currentStep.id}` no contêiner do popover com `animate-fade-in` (200ms).
  - [ ] Eliminar piscamentos e saltos secos de layout durante a troca de passo.

### Portão de Qualidade 3:
- [ ] `npm run typecheck` executado com sucesso.
- [ ] `npm run lint` executado com sucesso.
- [ ] `npm test -- src/components/modules/demo-tour-spotlight.test.tsx` aprovado.
- [ ] Teste manual: Conferir legibilidade e alinhamento em temas Claro e Escuro em telas de 360px a 412px.

### Commit & Push 3:
- [ ] Commit: `style(tour): reestrutura rodape adaptativo mobile, tokens semanticos e transicoes fluidas`
- [ ] Push para o repositório remoto.

---

## 4. FASE 4: ACESSIBILIDADE WCAG, FOCUS TRAP E GOVERNANÇA

**Meta:** Garantir navegação 100% acessível por teclado e leitor de tela, e marcar formalmente a depreciação de componentes legados.

### Checklist de Tarefas:
- [ ] **4.1. Gerenciamento de Foco e Focus Trap (`src/components/modules/demo-tour-spotlight.tsx`)**
  - [ ] Capturar e armazenar `document.activeElement` antes de abrir o tour.
  - [ ] Focar automaticamente o primeiro botão interativo ao montar o passo.
  - [ ] Implementar aprisionamento de foco (ciclo de Tab e Shift+Tab confinado no card).
  - [ ] Restaurar foco para o elemento original ao sair do tour (`ESC` ou botão `[X]`).

- [ ] **4.2. Acessibilidade ARIA e Navegação por Dots**
  - [ ] Adicionar `aria-live="polite"` no contêiner de título/descrição do passo para sintetizadores de voz.
  - [ ] Atribuir `role="presentation"` e `aria-hidden="true"` na camada de máscara SVG.
  - [ ] Tornar os dots interativos: `role="button"` com `aria-label={`Ir para o passo ${idx + 1}`}` e suporte a clique direto.

- [ ] **4.3. Governança e Limpeza de Componentes Legados**
  - [ ] Marcar `@deprecated` no JSDoc de `src/components/modules/demo-tour-bar.tsx`.
  - [ ] Confirmar que `src/components/layout/page-shell.tsx` não utiliza a barra superior redundante.
  - [ ] Manter testes de `demo-tour-bar.test.tsx` verdes para integridade da suíte.

- [ ] **4.4. Auditoria Final Integrada**
  - [ ] Executar suíte completa de testes (`npm test`).
  - [ ] Atualizar status nos documentos de roadmap e histórico.

### Portão de Qualidade 4:
- [ ] `npm run typecheck` aprovado.
- [ ] `npm run lint` aprovado.
- [ ] `npm test` 100% verde em todo o repositório.
- [ ] Teste manual de A11y: Navegar e concluir o tour operando exclusivamente via teclado (Tab, Enter, Espaço, Setas ← →, Esc).

### Commit & Push 4:
- [ ] Commit: `fix(tour/a11y): implementa focus trap, aria-live, navegacao por dots e deprecation de componentes`
- [ ] Push para o repositório remoto.

---

## 5. MATRIZ DE ARQUIVOS E RESPONSABILIDADES

| Arquivo | Ação | Status | Responsabilidade |
|---|---|---|---|
| `src/state/demo-mode/demo-session-store.ts` | Existente | [x] Concluído | Máquina de estados da sessão em memória |
| `src/domain/demo-simulation/mock-finances.ts` | Existente | [x] Concluído | Dataset de finanças simuladas |
| `src/domain/demo-simulation/mock-investments.ts` | Existente | [x] Concluído | Dataset de carteira e investimentos simulados |
| `src/components/modules/demo-track-select-modal.tsx` | Existente | [x] Concluído | Diálogo modal de escolha de trilha |
| `src/state/queries/use-simulated-queries.ts` | Modificação | [ ] Pendente | Mocks de despesas e pagamentos de cartão |
| `src/state/queries/use-card-payments.ts` | Modificação | [ ] Pendente | Chaveamento demo eliminando erro de sintaxe UUID |
| `src/state/queries/use-overview.ts` | Modificação | [ ] Pendente | Chaveamento demo em totais consolidados de cartões |
| `src/domain/demo-simulation/tour-steps.ts` | Modificação | [ ] Pendente | Rotas `/investments?tab=...` e novo seletor de extrato |
| `src/domain/demo-simulation/tour-steps.test.ts` | Modificação | [ ] Pendente | Testes de asserção de rotas e integridade dos passos |
| `src/app/router.tsx` | Modificação | [ ] Pendente | Preservação de `location.search` em rotas legadas |
| `src/features/transactions/pages/transaction-list-page.tsx` | Modificação | [ ] Pendente | Inclusão do seletor contido de extrato |
| `src/components/modules/demo-tour-spotlight.tsx` | Modificação | [ ] Pendente | Motor anti-colisão, layout responsivo, tokens e A11y |
| `src/components/modules/demo-tour-spotlight.test.tsx` | Modificação | [ ] Pendente | Testes de anti-colisão, dots interativos e foco |
| `src/components/modules/demo-tour-bar.tsx` | Documentação | [ ] Pendente | Marcação de depreciação e manutenção da tipagem |
| `docs/plans/PLANO_CORRECAO_E_OTIMIZACAO_TOUR_INTERATIVO.md` | Criação | [x] Concluído | Checklist canônica de acompanhamento |
