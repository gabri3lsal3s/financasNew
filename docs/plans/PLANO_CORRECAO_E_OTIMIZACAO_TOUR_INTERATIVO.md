# CHECKLIST DE EXECUÇÃO — CORREÇÃO INTEGRAL E OTIMIZAÇÃO DO TOUR INTERATIVO

> **Documento Canônico de Rastreabilidade e Governança**  
> **Status Geral:** Em Planejamento / Pronto para Execução  
> **Arquivo:** `docs/plans/PLANO_CORRECAO_E_OTIMIZACAO_TOUR_INTERATIVO.md`  
> **Regras Vinculantes:** `AGENTS.md` (Regras 4, 10, 11, 13, 14, 15, 17, 18).

---

## 📊 PROGRESSO GERAL DA FUNCIONALIDADE

```
[INFRAESTRUTURA BASE ANTERIOR]  ████████████████████ 100% Concluído
[FASE 1: DADOS & ROTEAMENTO]     ████████████████████ 100% Concluído
[FASE 2: MOTOR ANTI-COLISÃO]     ████████████████████ 100% Concluído
[FASE 3: DESIGN SYSTEM & UI]     ████████████████████ 100% Concluído
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
- [x] **1.1. Mocks de Despesas e Pagamentos de Cartão (`src/state/queries/use-simulated-queries.ts`)**
  - [x] Implementar `useSimulatedCardExpenses(cardId: string | null)` para filtrar despesas do cartão simulado.
  - [x] Implementar `useSimulatedCardPayments(cardId: string | null)` para simular faturas/pagamentos.
  - [x] Implementar `useSimulatedAllCardExpenses()` retornando todas as compras com cartão.
  - [x] Implementar `useSimulatedAllCardPayments()` com pagamentos consolidados simulados.

- [x] **1.2. Chaveamento por `isDemoActive` nas Queries de Cartão**
  - [x] Em `src/state/queries/use-card-payments.ts`: chavear `useCardExpenses` para retornar mock em demo e desabilitar query real.
  - [x] Em `src/state/queries/use-card-payments.ts`: chavear `useCardPayments` para retornar mock em demo e desabilitar query real.
  - [x] Em `src/state/queries/use-overview.ts`: chavear `useAllCardExpenses` com `isDemoActive`.
  - [x] Em `src/state/queries/use-overview.ts`: chavear `useAllCardPayments` com `isDemoActive`.

- [x] **1.3. Correção Canônica das Rotas e Parâmetros de Abas (`src/domain/demo-simulation/tour-steps.ts`)**
  - [x] Atualizar rota do Passo 1 de Investimentos: `targetRoute: "/investments"`.
  - [x] Atualizar rota do Passo 2 de Investimentos: `targetRoute: "/investments?tab=metas"`.
  - [x] Atualizar rota do Passo 3 de Investimentos: `targetRoute: "/investments?tab=aporte"`.

- [x] **1.4. Redimensionamento Ergonômico de Seletores em Listas**
  - [x] Ajustar `targetSelector` do Passo 2 de Finanças em `tour-steps.ts` para focar um bloco/card contido em vez da lista inteira de 800px.
  - [x] Inserir atributo correspondente `data-tour="transactions-feed-card"` em `transaction-list-page.tsx`.

- [x] **1.5. Preservação de Query Strings em Redirecionamentos (`src/app/router.tsx`)**
  - [x] Atualizar `<Route path="/investimentos" element={<Navigate to={`/investments${location.search}`} replace />} />`.

- [x] **1.6. Testes Unitários de Rota e Queries**
  - [x] Atualizar asserções de rota em `src/domain/demo-simulation/tour-steps.test.ts`.
  - [x] Validar que as queries retornam mocks quando `isDemoActive: true`.

### Portão de Qualidade 1:
- [x] `npm run typecheck` executado com zero erros de tipo.
- [x] `npm run lint` aprovado sem violações ou emojis.
- [x] `npm test -- src/domain/demo-simulation/tour-steps.test.ts` aprovado.
- [x] Teste manual: Acessar `/cartoes` durante a simulação e verificar ausência de `ErrorState` ("Algo deu errado").
- [x] Teste manual: Avançar passos de investimentos e confirmar que as abas "Metas" e "Aporte" abrem corretamente.

### Commit & Push 1:
- [x] Commit: `fix(tour): intercepta queries de cartao em modo demo e corrige rotas de abas de investimentos`
- [x] Push para o repositório remoto.

---

## 2. FASE 2: MOTOR ANTI-COLISÃO MOBILE & POSICIONAMENTO DINÂMICO

**Meta:** Garantir que o card explicativo do tour nunca encubra o elemento em foco no mobile e eliminar cálculos imprecisos de altura no desktop.

### Checklist de Tarefas:
- [x] **2.1. Algoritmo de Detecção Anti-Colisão Mobile (`src/components/modules/demo-tour-spotlight.tsx`)**
  - [x] Calcular centro vertical do elemento: `const elementCenterY = rect.y + rect.height / 2`.
  - [x] Se `elementCenterY > window.innerHeight * 0.45`:
    - [x] Ancorar popover no **TOPO**: `fixed inset-x-3 top-[max(env(safe-area-inset-top,0px),16px)]`.
  - [x] Se `elementCenterY <= window.innerHeight * 0.45`:
    - [x] Ancorar popover na **BASE**: `fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom,0px),16px)]`.
  - [x] Aplicar limite vertical seguro: `max-h-[42vh]` com `overflow-y-auto`.

- [x] **2.2. Scroll Suave Contextual (`scrollIntoView`)**
  - [x] Alinhar com `block: "end"` quando o popover estiver ancorado no topo.
  - [x] Alinhar com `block: "start"` ou `"center"` quando o popover estiver ancorado na base.
  - [x] Adicionar retry com `ResizeObserver` para recalcular dimensões após carregamento assíncrono.

- [x] **2.3. Posicionamento Dinâmico no Desktop com Altura Real**
  - [x] Substituir `cardEstimatedHeight = 220` pela medição real `cardRef.current?.offsetHeight`.
  - [x] Inverter colocação (top ↔ bottom) dinamicamente caso o espaço inferior seja menor que a altura do card.
  - [x] Aplicar clamp horizontal estrito contra vazamento de viewport: `Math.max(16, Math.min(rect.x, window.innerWidth - cardWidth - 16))`.

- [x] **2.4. Testes Unitários de Posicionamento e Anti-Colisão**
  - [x] Adicionar cenários de teste simulando alvos no topo e na base em `demo-tour-spotlight.test.tsx`.

### Portão de Qualidade 2:
- [x] `npm run typecheck` executado com sucesso.
- [x] `npm run lint` executado com sucesso.
- [x] `npm test -- src/components/modules/demo-tour-spotlight.test.tsx` aprovado.
- [x] Teste manual: Simular mobile (375x667 e 390x844) e verificar que nenhum elemento recortado é encoberto pelo card.

### Commit & Push 2:
- [x] Commit: `feat(tour): implementa motor anti-colisao adaptativo mobile e posicionamento dinamico desktop`
- [x] Push para o repositório remoto.

---

## 3. FASE 3: ERGONOMIA VISUAL, DESIGN SYSTEM & RESPONSIVIDADE

**Meta:** Sanar o esmagamento de botões no mobile (< 400px), adequar as cores e badges ao Design System e incluir transições suaves.

### Checklist de Tarefas:
- [x] **3.1. Rodapé Adaptativo para Telas Pequenas (< 400px)**
  - [x] Botão "Anterior": texto com classe `sm:inline` e ícone `<ArrowLeft className="size-3.5" />`.
  - [x] Dots de navegação: espaçamento balanceado e centrado sem esmagamento.
  - [x] Botão de Avanço / Conclusão com rótulo adaptativo:
    - [x] `sm:hidden`: `"Começar"`.
    - [x] `hidden sm:inline`: `"Começar Conta Real"`.

- [x] **3.2. Hierarquia Semântica de Cores (Regra 13 do `AGENTS.md`)**
  - [x] Alterar badge do passo de `variant="default"` (primário) para `variant="muted"`.
  - [x] Ícone Sparkles com tom neutro suave `text-muted-foreground`.
  - [x] Reservar acento primário (`primary`) exclusivamente para o botão de ação (CTA).

- [x] **3.3. Refinamento Estético do Backdrop SVG e Borda do Spotlight**
  - [x] Ajustar opacidade do backdrop para `rgba(0, 0, 0, 0.60)` para evitar sensação de blecaute pesado.
  - [x] Configurar borda pontilhada com cantos suaves `rx={16}` e `ry={16}` (`rounded-2xl`).
  - [x] Fazer a animação `animate-pulse` da borda cessar suavemente após 3 segundos.

- [x] **3.4. Transições de Passo Fluidas**
  - [x] Inserir `key={currentStep.id}` no contêiner do popover com `animate-fade-in` (200ms).
  - [x] Eliminar piscamentos e saltos secos de layout durante a troca de passo.

### Portão de Qualidade 3:
- [x] `npm run typecheck` executado com sucesso.
- [x] `npm run lint` executado com sucesso.
- [x] `npm test -- src/components/modules/demo-tour-spotlight.test.tsx` aprovado.
- [x] Teste manual: Conferir legibilidade e alinhamento em temas Claro e Escuro em telas de 360px a 412px.

### Commit & Push 3:
- [x] Commit: `style(tour): reestrutura rodape adaptativo mobile, tokens semanticos e transicoes fluidas`
- [x] Push para o repositório remoto.

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
| `src/state/queries/use-simulated-queries.ts` | Modificação | [x] Concluído | Mocks de despesas e pagamentos de cartão |
| `src/state/queries/use-card-payments.ts` | Modificação | [x] Concluído | Chaveamento demo eliminando erro de sintaxe UUID |
| `src/state/queries/use-overview.ts` | Modificação | [x] Concluído | Chaveamento demo em totais consolidados de cartões |
| `src/domain/demo-simulation/tour-steps.ts` | Modificação | [x] Concluído | Rotas `/investments?tab=...` e novo seletor de extrato |
| `src/domain/demo-simulation/tour-steps.test.ts` | Modificação | [x] Concluído | Testes de asserção de rotas e integridade dos passos |
| `src/app/router.tsx` | Modificação | [x] Concluído | Preservação de `location.search` em rotas legadas |
| `src/features/transactions/pages/transaction-list-page.tsx` | Modificação | [x] Concluído | Inclusão do seletor contido de extrato |
| `src/components/modules/demo-tour-spotlight.tsx` | Modificação | [ ] Pendente | Motor anti-colisão, layout responsivo, tokens e A11y |
| `src/components/modules/demo-tour-spotlight.test.tsx` | Modificação | [ ] Pendente | Testes de anti-colisão, dots interativos e foco |
| `src/components/modules/demo-tour-bar.tsx` | Documentação | [ ] Pendente | Marcação de depreciação e manutenção da tipagem |
| `docs/plans/PLANO_CORRECAO_E_OTIMIZACAO_TOUR_INTERATIVO.md` | Criação | [x] Concluído | Checklist canônica de acompanhamento |
