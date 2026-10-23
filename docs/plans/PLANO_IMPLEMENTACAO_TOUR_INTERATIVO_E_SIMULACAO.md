# PLANO DE IMPLEMENTAÇÃO — JORNADA COMPLETA DE ONBOARDING & TOUR INTERATIVO EM MEMÓRIA

> **Documento Canônico de Arquitetura, Engenharia e Experiência do Usuário (UI/UX)**  
> **Status:** Aprovado para Execução · **Alinhamento:** Decisões D1–D6 do `/grill-me` + Ciclo de Onboarding Completo  
> **Módulos Afetados:** `src/domain/demo-simulation/`, `src/domain/onboarding/`, `src/state/demo-mode/`, `src/components/modules/`, `src/features/overview/`, `src/features/settings/`, `src/features/help/`, `docs/`  
> **Data:** Outubro de 2026 · **Ambiente:** Web (PWA), Mobile Responsivo & Android Nativo (Capacitor)  

---

## 1. SUMÁRIO EXECUTIVO & DIAGNÓSTICO DE ONBOARDING

O aplicativo disponibilizava anteriormente uma funcionalidade de "Ambiente de Demonstração" em `src/services/demo-data.ts` que operava através de **injeção física de registros falsos (tag `[Exemplo]`) diretamente no banco de dados Supabase**, com controles de inserção e exclusão cirúrgica expostos na aba Segurança das Configurações (`SecurityTab.tsx`) e um botão isolado no modal de checklist (`onboarding-banner.tsx`).

### 1.1 Diagnóstico Técnico das Limitações Anteriores
1. **Risco de Integridade e Poluição do Banco de Dados:**
   - Inserir dados sintéticos em tabelas de produção (`expenses`, `incomes`, `cards`, `investments`, `categories`) trazia risco de criação de registros órfãos, violação de restrições de chaves estrangeiras e confusão contábil.
2. **Onboarding Fragmentado e Sem Acolhimento Inicial:**
   - O novo usuário caía diretamente em uma tela inicial vazia, sem um diálogo introdutório de boas-vindas (*Welcome Modal*) que apresentasse os propósitos da plataforma e suas opções de largada.
3. **Ausência de Didática Guiada (Passo a Passo):**
   - A injeção apenas povoava as tabelas, mas não explicava ao usuário recém-chegado o fluxo financeiro, o funcionamento das faturas de cartão, as metas orçamentárias ou o motor de rebalanceamento de investimentos.
4. **Desconexão entre Demonstração e o Checklist Real:**
   - O usuário que usava dados de teste não sabia quando ou como transicionar para sua conta real, e não havia integração entre o encerramento da demonstração e o checklist de configuração nativo da conta (`onboardingSteps`).
5. **Empty States Desprovidos de Contexto de Demonstração:**
   - As telas vazias (Lançamentos, Cartões, Investimentos) ofereciam apenas o botão de cadastro cru, sem permitir ao usuário indeciso ver rapidamente como aquela tela ficaria populada antes de cadastrar seu primeiro dado.

### 1.2 A Solução Integrada: O Ciclo Completo de Onboarding do Usuário
A nova arquitetura unifica o acolhimento, a simulação em memória e o checklist de primeiro uso em uma jornada coesa de 4 etapas:
- **1. Acolhimento & Boas-Vindas (`WelcomeModal`):** No primeiro login de uma conta sem dados (`isFirstUse`), uma janela amigável e calorosa oferece duas opções:
  * *Opção A (Recomendada):* "Fazer Tour Rápido (2 min)" — ativa a simulação em memória sem gravar no banco.
  * *Opção B:* "Começar do Zero Agora" — fecha o diálogo e conduz direto ao checklist de configuração real.
- **2. Modo Simulação em Memória (Sandbox Isolado):**
  * Interceptação temporária de queries no cliente entregando dados sintéticos ricos com datas relativas ao mês corrente.
  * Barra persistente superior (`DemoTourBar`) com explicações didáticas de cada tela.
  * Trilhas modulares por demanda: *Finanças Diárias* ou *Investimentos & Rebalanceamento*.
- **3. Hand-off Transparente & Seguro para a Conta Real:**
  * Ao clicar em "Começar Minha Conta Real" ou em qualquer botão primário de cadastro, a simulação desliga instantaneamente.
  * O sistema abre contextualmente o primeiro passo pendente do checklist de configuração (`OnboardingBanner`), garantindo que o usuário comece a cadastrar sua conta com total clareza.
- **4. Reconhecimento de Usuário Ativo & Acesso Permanente:**
  * Ao atingir $\ge 3$ lançamentos ou 1 cartão real (`isUserActive`), o banner de onboarding se recolhe com celebração discreta.
  * O Tour Demonstrativo permanece acessível sob demanda no menu de **Ajuda & Suporte** ou no **Menu de Perfil**, permitindo consultas futuras a qualquer momento.
- **5. Depreciação Completa do Motor Legado de Banco:**
  * Exclusão total de `demo-data.ts`, `use-demo-data.ts` e remoção de todos os botões de injeção física de dados falsos nas configurações.

---

## 2. FLUXO ARQUITETURAL DA JORNADA COMPLETA DE ONBOARDING

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      JORNADA COMPLETA DE ONBOARDING NO PRODUTO                   │
└──────────────────────────────────────────────────────────────────────────────────┘

 [1. PRIMEIRO ACESSO / CADASTRO CONCLUÍDO]
                    │
                    ▼
 ┌────────────────────────────────────────────────────────┐
 │ DIÁLOGO DE ACOLHIMENTO & BOAS-VINDAS (WelcomeModal)    │
 │ "Boas-vindas ao seu novo centro financeiro pessoal!"   │
 │                                                        │
 │ ✦ [Fazer Tour Rápido com Simulação]                    │
 │   ↳ Abre seletor de trilha (Finanças ou Investimentos) │
 │                                                        │
 │ ✦ [Configurar Minha Conta do Zero]                     │
 │   ↳ Fecha modal e foca no Checklist de Primeiro Uso    │
 └──────────────────────────┬─────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
 [2A. EXPERIÊNCIA DE SIMULAÇÃO]    [2B. CONTA REAL LIMPA]
  • Zero chamadas ao Supabase       • Banner de Checklist Ativo
  • Mocks puros em memória            (Categorias → Cartão → 1º Gasto)
  • Barra guiada com passos         • Empty States educativos com
  • Interceptação amigável de ações   link discreto: "Ver na Simulação"
            │                               ▲
            │ (Ao concluir ou clicar)       │
            └───────────────┬───────────────┘
                            ▼
 [3. HAND-OFF CONTEXTUAL DIRETO AO CHECKLIST]
  • Desativa simulação em < 100ms sem recarregar a tela (SPA limpo).
  • Salva flag de conclusão no localStorage.
  • Conduz o usuário diretamente ao formulário do passo pendente no checklist.
                            │
                            ▼
 [4. TRANSIÇÃO PARA USUÁRIO ATIVO & ACESSO SOB DEMANDA]
  • Usuário cadastra dados reais e atinge critério ativo (`isUserActive`).
  • Banner de onboarding é ocultado suavemente com feedback positivo.
  • Tour Guiado fica disponível permanentemente em Ajuda & Perfil.
```

---

## 3. FASES DE EXECUÇÃO, TAREFAS E PORTÕES DE QUALIDADE

---

### FASE 1: DEPRECIAÇÃO E REMOÇÃO CIRÚRGICA DO MOTOR LEGADO DE BANCO

**Objetivo:** Eliminar com segurança todo o código antigo que realizava inserções e exclusões físicas no banco de dados, limpando telas, mutações e imports obsoletos.

#### Tarefas Granulares:
- [ ] **1.1. Remoção do Módulo de Injeção Física (`src/services/demo-data.ts`):**
  - Excluir o arquivo `src/services/demo-data.ts` e sua suíte de testes `src/services/demo-data.test.ts`.
  - Limpar exportações nos barrels de serviços (`src/services/index.ts`).
- [ ] **1.2. Remoção das Mutações de Banco (`src/state/mutations/use-demo-data.ts`):**
  - Excluir o arquivo `src/state/mutations/use-demo-data.ts`.
  - Atualizar o barrel `src/state/mutations/index.ts`.
- [ ] **1.3. Limpeza da Tela de Configurações (`SecurityTab.tsx`):**
  - Remover integralmente o bloco "Ambiente de Demonstração (Dados de Teste)" e o diálogo `ConfirmDialog` de limpeza de dados em `src/features/settings/components/tabs/security-tab.tsx`.
  - Limpar imports não utilizados (`loadDemoMutation`, `clearDemoMutation`, `Sparkles`, `Trash2`).
- [ ] **1.4. Remoção do Componente Legado `DemoModeBanner`:**
  - Excluir `src/components/modules/demo-mode-banner.tsx`.
  - Remover imports e tags `DemoModeBanner` em `src/features/overview/pages/overview-page.tsx` e referências a `hasDemoData`/`isDemoItem`.
- [ ] **1.5. Atualização de Barrels e Limpeza Geral:**
  - Revisar `src/components/modules/index.ts` e remover referências obsoletas.

#### Portão de Qualidade 1 (Quality Gate 1):
- **Testes Automatizados:** Executar `npm run test` e garantir que nenhuma suíte quebrou devido à remoção dos arquivos legados.
- **Checagem de Tipagem Estrita:** Executar `npm run typecheck` (`tsc --noEmit`) assegurando zero erros residuais de imports.
- **Verificação de Lint:** Executar `npm run lint` validando conformidade estrita e sem caracteres decorativos.
- **Verificação Visual:** Inspecionar `SecurityTab` e `OverviewPage` garantindo layout limpo e livre de botões órfãos.
- **Atualização da Documentação:** Registrar a depreciação do motor legado em `docs/ROADMAP.md` e `docs/PROJECT_STRUCTURE.md`.
- **Revisão de Código:** Confirmar que nenhuma mutação com tag `[Exemplo]` permaneceu ativa no código.
- **Commit Semântico & Push:**
  * Mensagem: `refactor(demo): remove legacy database demo injection and cleanup engine`
  * Executar `git push`.

---

### FASE 2: MOTOR DE SIMULAÇÃO EM MEMÓRIA & DATASETS MOCKADOS PUROS

**Objetivo:** Construir o repositório de dados simulados em memória com datas relativas ao mês corrente e criar o gerenciador de estado da simulação.

#### Tarefas Granulares:
- [ ] **2.1. Datasets Dinâmicos Puros (`src/domain/demo-simulation/`):**
  - Criar `src/domain/demo-simulation/types.ts`: contratos para trilhas (`DailyFinancesTrack`, `InvestmentsTrack`, `TourStep`).
  - Criar `src/domain/demo-simulation/mock-finances.ts`: gerador de transações, categorias e faturas calculadas com base no `currentYearMonth()` atual:
    * Receitas realistas: Salário, Freela, Rendimento de Aplicação.
    * Despesas categorizadas: Alimentação, Moradia, Transporte, Lazer, Saúde.
    * Cartões de crédito com limites, fatura aberta e parcelas vincendas coerentes.
  - Criar `src/domain/demo-simulation/mock-investments.ts`: gerador de ativos de carteira e metas:
    * Classes de ativos balanceadas: Renda Fixa (Tesouro/CDB), Ações Brasileiras, FIIs e Criptoativos.
    * Dados prontos para visualização de aporte ideal no motor de rebalanceamento.
  - Criar testes unitários colocalizados `src/domain/demo-simulation/mock-data.test.ts`.
- [ ] **2.2. Estado Global do Modo Simulação (`src/state/demo-mode/`):**
  - Criar `src/state/demo-mode/demo-session-store.ts` (ou hook contextual `useDemoSession`):
    * `isDemoActive: boolean`
    * `activeTrack: 'finances' | 'investments' | null`
    * `currentStepIndex: number`
    * Ações: `startDemo(track)`, `endDemo()`, `goToNextStep()`, `goToPrevStep()`.
  - Criar helper de persistência leve para tours concluídos no `localStorage` (`hasCompletedDemoTour`, `markTourCompleted`, `hasSeenWelcomeModal`).
  - Criar testes unitários para a máquina de estados do tour.
- [ ] **2.3. Interceptação Segura de Queries no TanStack Query:**
  - Criar hooks inteligentes em `src/state/queries/use-simulated-queries.ts` ou adaptar de forma transparente:
    * Quando `isDemoActive === true`, retornar dados sintéticos com `isFetching: false`, `isLoading: false`, `data: mockData`.
    * Quando `isDemoActive === false`, retornar as queries reais originais do Supabase.
- [ ] **2.4. Barrels do Domínio e Estado:**
  - Exportar contratos em `src/domain/demo-simulation/index.ts` e `src/state/demo-mode/index.ts`.

#### Portão de Qualidade 2 (Quality Gate 2):
- **Testes Automatizados:** Executar `npm run test` cobrindo geradores puros de dados e lógica da sessão.
- **Checagem de Datas Dinâmicas:** Validar que nenhum dado mockado possui data estática vencida ou fora do mês atual.
- **Tipagem Estrita:** `npm run typecheck` sem `any` ou type assertions perigosas.
- **Verificação de Lint:** `npm run lint` 100% verde.
- **Atualização da Documentação:** Documentar contratos do mock em `docs/ARCHITECTURE.md`.
- **Revisão de Código:** Garantir que o mock de dados não importa módulos de infraestrutura ou Supabase.
- **Commit Semântico & Push:**
  * Mensagem: `feat(demo): implement pure in-memory mock datasets and demo session store`
  * Executar `git push`.

---

### FASE 3: COMPONENTES DE UI DO ONBOARDING, NAVEGAÇÃO & INTERCEPTAÇÃO

**Objetivo:** Desenvolver componentes ergonômicos, acessíveis e padronizados para acolhimento inicial, escolha de trilhas, navegação guiada e interceptação inteligente.

#### Tarefas Granulares:
- [ ] **3.1. Diálogo de Boas-Vindas no Primeiro Login (`WelcomeModal`):**
  - Criar `src/components/modules/welcome-modal.tsx`:
    * Apresentado no primeiro acesso de uma conta virgem (`isFirstUse`).
    * Título caloroso: "Boas-vindas ao seu novo centro financeiro".
    * Explicação concisa dos diferenciais da plataforma (controle de fluxo, cartões inteligentes e carteira de investimentos).
    * Botão primário com ícone de destaque: "Fazer Tour Rápido (2 min)".
    * Botão secundário de contorno: "Configurar Minha Conta Agora".
    * Responsivo: gaveta inferior com drag no mobile (`< 768px`) e diálogo centralizado no desktop (`size="md"`).
- [ ] **3.2. Modal de Seleção de Trilha (`DemoTrackSelectModal`):**
  - Criar `src/components/modules/demo-track-select-modal.tsx`:
    * Apresenta as opções:
      1. *Finanças Diárias & Cartões:* "Explore entradas, saídas, faturas automáticas e limites de gastos."
      2. *Investimentos & Rebalanceamento:* "Conheça a visão patrimonial, alocação de classes e motor de aportes."
    * Botões estilizados com ícones da escala semântica (`Wallet`, `TrendingUp`).
    * Opção discreta "Pular tour e ir para conta real".
- [ ] **3.3. Barra Guiada do Tour (`DemoTourBar`):**
  - Criar `src/components/modules/demo-tour-bar.tsx`:
    * Fixada na parte superior da viewport com transição suave e fundo fosco (`bg-surface/95 backdrop-blur border-b border-border/80 shadow-xs`).
    * Indicador de passo (`Passo X de Y`) e texto explicativo do passo atual.
    * Botões de navegação: "Anterior" (se passo > 1), "Próximo", "Trocar Trilha" e botão de destaque "Começar Minha Conta Real" (`variant="primary"`).
    * Totalmente responsivo para mobile (botões compactos, rótulos legíveis, sem sobrepor notch ou FABs).
- [ ] **3.4. Diálogo de Interceptação de Ação Real (`DemoExitConfirmDialog`):**
  - Criar `src/components/modules/demo-exit-confirm-dialog.tsx`:
    * Disparado quando o usuário no modo demo clica em criar despesa, receita, cartão ou ativo real.
    * Explicação acolhedora: "Você está no modo de demonstração. Deseja sair da simulação e registrar seu primeiro lançamento real agora?"
    * Ações: `Cancelar (Continuar Explorando)` e `Confirmar (Cadastrar Meu Dado Real)`.
- [ ] **3.5. Atualização do `OnboardingBanner` e `ChecklistContent`:**
  - Em `src/components/modules/onboarding-banner.tsx`:
    * Substituir o botão legado de mutação pelo botão "Explorar com Simulação", que abre o `DemoTrackSelectModal`.
    * Manter o checklist visual fluido e sincronizado com os passos concluídos.
- [ ] **3.6. Barrels de Componentes:**
  - Exportar os novos componentes em `src/components/modules/index.ts`.

#### Portão de Qualidade 3 (Quality Gate 3):
- **Testes Automatizados de Componentes:** Criar testes em `src/components/modules/welcome-modal.test.tsx`, `demo-tour-bar.test.tsx` e `demo-track-select-modal.test.tsx`.
- **Acessibilidade & Design System:**
  * Verificar contraste de cores, labels de acessibilidade (`aria-label`, `role="region"`, `role="dialog"`).
  * Validar regra de ouro de zero controles nativos e zero emojis.
- **Ergonomia Mobile vs Desktop:**
  * Validar em viewports de 360px (mobile estreito) e 1440px (desktop grande).
- **Tipagem & Lint:** `npm run typecheck` e `npm run lint` sem erros.
- **Atualização da Documentação:** Atualizar `docs/DESIGN_SYSTEM.md` com os novos módulos de onboarding e tour.
- **Revisão de Código:** Inspecionar consistência de tokens (`border-border/80`, `bg-surface`, `size-4`).
- **Commit Semântico & Push:**
  * Mensagem: `feat(ui): add welcome modal, demo track selector, tour bar and update checklist banner`
  * Executar `git push`.

---

### FASE 4: INTEGRAÇÃO NAS TELAS, EMPTY STATES, HAND-OFF E ACESSO PERMANENTE

**Objetivo:** Integrar a experiência de onboarding e o tour interativo no Dashboard, nos Empty States de todas as páginas principais, na Central de Ajuda e no ciclo de vida de usuário ativo.

#### Tarefas Granulares:
- [ ] **4.1. Gatilho do `WelcomeModal` no Dashboard (`OverviewPage`):**
  - Em `src/features/overview/pages/overview-page.tsx`:
    * Detectar `isFirstUse(onboardingQuery.data)` no carregamento da página.
    * Se for primeiro acesso e ainda não visualizou o acolhimento, disparar o `WelcomeModal`.
- [ ] **4.2. Empty States Ricos com Atalho para a Simulação:**
  - Atualizar os Empty States nas páginas principais:
    * *Transações (`ExpensesTab` / `IncomesTab`):* Se vazio, exibir botão primário "+ Novo Lançamento" e botão secundário sutil "Ver exemplo na Simulação".
    * *Cartões (`CardsPage`):* Se vazio, exibir "+ Novo Cartão" e "Ver fatura na Simulação".
    * *Investimentos (`InvestmentsPage`):* Se vazio, exibir "+ Adicionar Ativo" e "Ver carteira na Simulação".
- [ ] **4.3. Ponto de Entrada para Usuários Existentes (`HelpModal` / Menu de Perfil):**
  - Adicionar opção permanente no menu de **Ajuda & Suporte** ou Perfil: "Rever Tour Guiado (Modo Simulação)".
  - Usuários que já possuem dados reais podem explorar as funcionalidades simuladas a qualquer momento, sem risco de interferir em seus registros.
- [ ] **4.4. Roteamento e Hand-off Contextual ao Sair do Tour:**
  - Ao clicar em "Começar Minha Conta Real":
    * O estado `isDemoActive` é desligado imediatamente.
    * O sistema direciona para a tela limpa correspondente (se em Finanças, abre o modal de Nova Despesa/Receita; se em Cartões, abre o modal de Novo Cartão).
    * Marca no `localStorage` que o tour foi realizado.
- [ ] **4.5. Integração do Shell Global da Aplicação (`PageShell.tsx`):**
  - Renderizar condicionalmente a `DemoTourBar` no topo da tela quando `isDemoActive === true`, garantindo que acompanhe a navegação entre rotas da simulação.

#### Portão de Qualidade 4 (Quality Gate 4):
- **Testes de Integração Ponta a Ponta:** Simular a jornada completa:
  1. Novo usuário cadastra-se -> `WelcomeModal` aparece automaticamente.
  2. Usuário escolhe "Fazer Tour Rápido" -> entra no modo simulação com trilha de Finanças.
  3. Navega pelas abas de Dashboard, Transações e Cartões vendo dados ricos e barra guiada.
  4. Clica em "Começar Minha Conta Real" -> simulação desliga -> cai na conta real limpa com o Checklist de Primeiro Uso pronto para preenchimento.
  5. Usuário adiciona 3 lançamentos -> atinge `isUserActive` -> banner de onboarding se recolhe.
  6. Usuário acessa o Menu de Ajuda e consegue reabrir a Simulação a qualquer momento.
- **Validação de Performance & UX:**
  * Transição de entrada/saída da demonstração em < 100ms sem reload de página.
  * Validação no PWA (Service Worker) e Android Nativo (Capacitor).
- **Tipagem, Lint e Testes:**
  * `npm run test` (todos os testes verdes).
  * `npm run typecheck` (zero erros).
  * `npm run lint` (zero violações).
- **Atualização da Documentação:** Atualizar `docs/ROADMAP.md` e `docs/ARCHITECTURE.md` registrando a conclusão do módulo v2.55.
- **Revisão de Código:** Revisão rigorosa de todas as alterações.
- **Commit Semântico & Push:**
  * Mensagem: `feat(onboarding): integrate complete onboarding journey with welcome modal, empty states and tour handoff`
  * Executar `git push`.

---

## 4. MATRIZ DE RASTREABILIDADE & DEFINITION OF DONE (DoD)

Para que a implementação seja considerada formalmente concluída, todos os critérios abaixo devem ser verificados:

| Dimensão | Verificação Obrigatória | Status Esperado |
|---|---|---|
| **Segurança do Banco** | Nenhuma linha de código realiza `insert`, `update` ou `delete` com dados falsos no Supabase. | 100% em memória |
| **Código Legado** | `src/services/demo-data.ts`, `use-demo-data.ts` e seção em `SecurityTab` eliminados. | Removido |
| **Acolhimento Inicial** | `WelcomeModal` acolhe novos usuários e dá escolha entre Tour Guiado e Checklist Real. | Implementado |
| **Checklist Nativo** | `OnboardingBanner` integrado com abertura do tour sem mutações no banco. | Sincronizado |
| **Empty States** | Páginas vazias convidam à ação com opção secundária de visualizar na simulação. | Padronizado |
| **Governança Visual** | Zero emojis, ícones Lucide padronizados, sem controles HTML nativos, badges estritos. | Conforme §4 |
| **Mobile-First & PWA** | Barra do tour responsiva, sem colisão com notch/safe-areas ou FABs no Android/PWA. | Testado |
| **Testes Vitest** | Todos os novos arquivos com testes colocalizados cobrindo 100% das branches de lógica. | `npm test` verde |
| **Qualidade de Código** | Sem `any`, sem type ignores, lint estrito aprovado sem exceções. | `tsc` + `eslint` ok |
| **Documentação Viva** | `ROADMAP.md`, `ARCHITECTURE.md`, `PROJECT_STRUCTURE.md` devidamente sincronizados. | Atualizado |

---

## 5. SEQUÊNCIA DE COMMITS E PUSHES

A execução seguirá rigorosamente a ordem abaixo, com commits atômicos e push ao final de cada portão de qualidade:

1. `refactor(demo): remove legacy database demo injection and cleanup engine`
2. `feat(demo): implement pure in-memory mock datasets and demo session store`
3. `feat(ui): add welcome modal, demo track selector, tour bar and update checklist banner`
4. `feat(onboarding): integrate complete onboarding journey with welcome modal, empty states and tour handoff`
