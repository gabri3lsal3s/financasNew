# PLANO DE IMPLEMENTAÇÃO — REFATORAÇÃO DO TOUR INTERATIVO & EXPERIÊNCIA DE FOCO (SPOTLIGHT)

> **Documento Canônico de Arquitetura, Engenharia e Experiência do Usuário (UI/UX)**  
> **Status:** Aprovado para Execução · **Alinhamento:** Decisões D1–D5 do `/grill-me` + Eliminação de Ruído Visual  
> **Módulos Afetados:** `src/domain/demo-simulation/`, `src/state/demo-mode/`, `src/components/modules/`, `src/components/layout/`, `src/features/`, `docs/`  
> **Data:** Outubro de 2026 · **Ambiente:** Web (PWA), Mobile Responsivo & Android Nativo (Capacitor)  

---

## 1. SUMÁRIO EXECUTIVO & DIAGNÓSTICO DO TOUR ANTERIOR

O aplicativo implementou anteriormente uma simulação em memória do Tour Interativo (`DemoTourBar`, `demo-session-store.ts`, `tour-steps.ts`). Embora a abordagem em memória tenha eliminado a poluição do banco de dados, o feedback do usuário identificou falhas graves de ergonomia, desconforto visual e sobrecarga cognitiva na experiência atual.

### 1.1 Diagnóstico das Dores e Limitações
1. **Barra Fixa Sob o Header Invasiva e Incômoda:**
   - A `DemoTourBar` ficava prensada logo abaixo do header da aplicação, comprimindo o espaço vertical do conteúdo útil e adicionando um segundo nível de navegação duplicada com botões e setas espremidas.
2. **Ruído Visual e Falta de Foco (Ausência de Isolamento):**
   - O usuário via a tela inteira com dezenas de elementos, gráficos, tabelas e menus ao mesmo tempo em que lia o texto do tour. Sem nada direcionando a atenção para o recurso específico sendo explicado, a tela parecia caótica e desorientadora.
3. **Ausência de Distinção Clara do "Modo Demonstração":**
   - O aplicativo rodava visualmente idêntico ao modo normal, sem uma diferenciação estética evidente ou uma moldura/camada que deixasse explícito que se tratava de um ambiente simulado de teste.
4. **Falta de Saída Rápida e Descomplicada:**
   - Não havia um botão evidente de fechar `[X]` imediato em primeiro plano para o usuário abandonar o tour a qualquer instante com 1 clique, gerando sensação de "aprisionamento".
5. **Colisão de Navegação e Cliques Indesejados:**
   - Como os botões normais da página permaneciam 100% clicáveis durante o tour, o usuário podia clicar acidentalmente em links, abas ou modais da tela, desincronizando o passo do tour da rota real.

---

## 2. A NOVA ARQUITETURA DE FOCO: SPOTLIGHT & POPOVER ADAPTATIVO

Para sanar 100% dessas dores, a arquitetura do Tour é refatorada para o padrão ouro de mercado (**Spotlight com Backdrop Escurecido + Popover Adaptativo**):

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│              NOVA ARQUITETURA VISUAL DO TOUR: SPOTLIGHT & POPOVER                │
└──────────────────────────────────────────────────────────────────────────────────┘

 [HEADER GLOBAL]
  • Logo / Busca / Ações
  • [Badge Elegante: Modo Simulação] + [Botão Sair] ──> Encerra Tour com 1 clique
 ──────────────────────────────────────────────────────────────────────────────────
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │ [MÁSCARA DE BACKDROP ESCURECIDO] (bg-black/60 ou surface-backdrop)             │
 │                                                                                │
 │       Bloqueia cliques externos e ruídos visuais de fundo                      │
 │                                                                                │
 │            ┌──────────────────────────────────────────────┐                    │
 │            │ [HOLOFOTE / RECORTE SPOTLIGHT]               │                    │
 │            │  • Card/Seção Alvo Iluminado (100% nítido)   │                    │
 │            │  • data-tour="overview-kpis"                 │                    │
 │            │  • Borda com glow suave e foco visual        │                    │
 │            └──────────────────────┬───────────────────────┘                    │
 │                                   │                                            │
 │                                   ▼                                            │
 │            ┌──────────────────────────────────────────────┐                    │
 │            │ [CARD POPOVER ADAPTATIVO]                    │                    │
 │            │  • [Passo 2 de 4]           [Botão Fechar X] │                    │
 │            │  • Título & Explicação Concisa               │                    │
 │            │  • [Anterior]  (• • •)  [Próximo Passo]      │                    │
 │            └──────────────────────────────────────────────┘                    │
 │                                                                                │
 └────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Decisões Canônicas Alinhadas no `/grill-me`
- **D1. Spotlight com Backdrop Escurecido:** A tela é suavemente escurecida por uma camada de foco, destacando exclusivamente a seção ou card relevante do passo atual.
- **D2. Foco Guiado de Leitura:** O backdrop bloqueia cliques em links ou botões do fundo enquanto o tour estiver ativo, mantendo o usuário focado nas explicações e evitando bugs de navegação acidental.
- **D3. Popover Inteligente Adaptativo:** No Desktop, o card guia flutua ancorado ao elemento destacado; no Mobile, fixa-se na base como um Bottom Sheet compacto e ergonômico para o polegar, sem cortar nem encobrir o conteúdo iluminado.
- **D4. Eliminação Total da Barra Sob o Header:** A `DemoTourBar` é completamente removida. O Header recebe apenas um badge minimalista e elegante `"Modo Demonstração"` com botão `"Sair"`.
- **D5. Saída Direta sem Fricção:** O botão `[X]` no card e o botão `[Sair]` no header encerram o tour imediatamente em 1 clique (ou tecla `ESC`), sem exibir diálogos de confirmação burocráticos.
- **D6. Alvos Precisos por Seção:** Cada passo mapeia um seletor semântico com o atributo `data-tour="..."` na árvore JSX, com fallback suave para o contêiner principal da página se o elemento não carregar de imediato.

---

## 3. FASES DE EXECUÇÃO, TAREFAS E PORTÕES DE QUALIDADE

---

### FASE 1: CONTRATOS DE DOMÍNIO, SELETORES E MÁQUINA DE ESTADOS

**Objetivo:** Enriquecer a definição dos passos do tour em `src/domain/demo-simulation/` com seletores semânticos e propriedades de posicionamento, e adaptar o store de sessão para suportar fechamento direto e controle de spotlight.

#### Tarefas Granulares:
- [x] **1.1. Atualização dos Contratos de Tipos (`src/domain/demo-simulation/types.ts`):**
  - Adicionar ao `TourStep`:
    * `targetSelector: string` (ex.: `'[data-tour="overview-kpis"]'`).
    * `preferredPlacement?: 'top' | 'bottom' | 'left' | 'right'`.
    * `spotlightPadding?: number` (padding em pixels para o recorte, default 8px).
- [x] **1.2. Mapeamento das Trilhas com Seletores (`src/domain/demo-simulation/tour-steps.ts`):**
  - Mapear os passos da trilha `finances`:
    * Passo 1 (Visão Geral): `targetSelector: '[data-tour="overview-kpis"]'`, rota: `/`.
    * Passo 2 (Transações): `targetSelector: '[data-tour="transactions-content"]'`, rota: `/transacoes`.
    * Passo 3 (Cartões): `targetSelector: '[data-tour="cards-content"]'`, rota: `/cartoes`.
    * Passo 4 (Orçamentos): `targetSelector: '[data-tour="budgets-content"]'`, rota: `/orcamentos`.
  - Mapear os passos da trilha `investments`:
    * Passo 1 (Visão Geral): `targetSelector: '[data-tour="investments-summary"]'`, rota: `/investimentos`.
    * Passo 2 (Metas): `targetSelector: '[data-tour="investments-targets"]'`, rota: `/investimentos?tab=metas`.
    * Passo 3 (Aporte Inteligente): `targetSelector: '[data-tour="investments-rebalance"]'`, rota: `/investimentos?tab=aporte`.
- [x] **1.3. Testes Unitários de Domínio (`src/domain/demo-simulation/tour-steps.test.ts`):**
  - Validar que todos os passos possuem `targetSelector` válido, títulos, rotas coerentes e ordenação estrita.

#### Portão de Qualidade 1 (Quality Gate 1):
- **Testes Automatizados:** `npm run test -- tour-steps` passando com 100% de cobertura.
- **Tipagem Estrita:** `npm run typecheck` sem erros de TypeScript.
- **Lint:** `npm run lint` 100% aprovado.

---

### FASE 2: COMPONENTES DO SPOTLIGHT & POPOVER ADAPTATIVO

**Objetivo:** Construir o componente `DemoTourSpotlight` com backdrop SVG/CSS clip-path, cálculo dinâmico de coordenadas do elemento alvo, rolagem suave automática e o card popover adaptativo com suporte a teclado.

#### Tarefas Granulares:
- [x] **2.1. Criação do Componente `DemoTourSpotlight` (`src/components/modules/demo-tour-spotlight.tsx`):**
  - Escaneia a tela buscando o elemento pelo `targetSelector`.
  - Executa `scrollIntoView({ behavior: 'smooth', block: 'center' })` para centralizar o elemento na viewport.
  - Desenha uma máscara SVG fullscreen recortada com cantos arredondados (`rx="12"`) e borda iluminada (`stroke="rgba(var(--primary), 0.5)"`), escurecendo todo o restante da tela com `rgba(0,0,0,0.65)`.
  - Impede cliques no fundo (captura de ponteiro).
  - Inclui fallback gracioso: se o elemento não for encontrado em 300ms, ilumina a área central sem quebrar a renderização.
- [x] **2.2. Criação do Card Popover Adaptativo (`DemoTourCard` / integrado em `demo-tour-spotlight.tsx`):**
  - **Desktop (`md:` / >= 768px):** Ancorado ao lado ou acima/abaixo do recorte com base no espaço disponível.
  - **Mobile (`< 768px`):** Ancorado na parte inferior da tela como um Bottom Sheet compacto, com padding seguro para áreas de notch e sem tampar o elemento em foco.
  - **Controles Internos:**
    * Botão `[X]` de saída direta no topo direito.
    * Badge de progresso: `Passo X de Y` + nome da trilha.
    * Título e texto descritivo com tipografia canônica do Design System.
    * Botão `Anterior` (desabilitado no passo 1).
    * Botão `Próximo` (ou `Concluir Tour` no último passo).
    * Botão primário de hand-off `Começar Minha Conta Real` no passo final.
  - **Acessibilidade & Teclado:**
    * Tecla `Escape`: encerra o tour imediatamente.
    * Tecla `ArrowRight`: avança o passo.
    * Tecla `ArrowLeft`: retrocede o passo.
- [x] **2.3. Testes Automatizados de Componente (`src/components/modules/demo-tour-spotlight.test.tsx`):**
  - Testar navegação entre passos, acionamento do botão fechar `[X]`, fechamento por tecla `Escape`, e renderização em modo desktop e mobile.

#### Portão de Qualidade 2 (Quality Gate 2):
- **Testes Automatizados:** `npm run test -- demo-tour-spotlight` passando 100%.
- **Governança de Design System:** Zero emojis, zero controles HTML nativos, uso estrito de tokens do `DESIGN_SYSTEM.md`.
- **Lint & Typecheck:** `npm run typecheck` e `npm run lint` aprovados sem advertências.

---

### FASE 3: MARCAÇÃO SEMÂNTICA NAS TELAS (`data-tour`) & INTEGRAÇÃO NO HEADER

**Objetivo:** Adicionar os atributos `data-tour="..."` nas telas da aplicação, eliminar a barra antiga `DemoTourBar` do `PageShell`, e adicionar o badge discreto de demonstração no Header.

#### Tarefas Granulares:
- [x] **3.1. Adicionar Atributos `data-tour` nas Telas Principais:**
  - `src/features/overview/pages/overview-page.tsx`: adicionar `data-tour="overview-kpis"` no container dos cards de KPI/resumo.
  - `src/features/transactions/pages/transaction-list-page.tsx`: adicionar `data-tour="transactions-content"` na área de filtros e lista de lançamentos.
  - `src/features/cards/pages/cards-page.tsx`: adicionar `data-tour="cards-content"` na seção de faturas e cartões.
  - `src/features/budgets/pages/budgets-page.tsx`: adicionar `data-tour="budgets-content"` na grade de limites e orçamentos.
  - `src/features/investments/pages/`: adicionar `data-tour="investments-summary"`, `data-tour="investments-targets"` e `data-tour="investments-rebalance"`.
- [x] **3.2. Eliminar a `DemoTourBar` e Integrar Indicador no Header (`PageShell.tsx`):**
  - Remover a renderização de `<DemoTourBar />` abaixo do header em `src/components/layout/page-shell.tsx`.
  - Depreciar com segurança `src/components/modules/demo-tour-bar.tsx` (ou mantê-la sem uso/remover de barrels).
  - No `PageShell` / Header: quando `isDemoActive === true`, exibir um badge sutil e elegante ao lado das ações do topo:
    * `<Badge variant="default" size="xs">Modo Simulação</Badge>` + `<Button variant="ghost" size="xs" onClick={endDemo}>Sair</Button>`.
  - Renderizar o `<DemoTourSpotlight />` como overlay global no `PageShell`.
- [x] **3.3. Atualização dos Testes de Layout (`page-shell.test.tsx`):**
  - Atualizar as asserções em `page-shell.test.tsx` para validar a presença do indicador no header e do spotlight quando a simulação estiver ativa.

#### Portão de Qualidade 3 (Quality Gate 3):
- **Testes de Regressão:** `npm run test` em toda a suíte de layout e páginas.
- **Typecheck & Lint:** `npm run typecheck` e `npm run lint` sem erros.
- **Inspeção Visual:** Validar que a barra antiga sob o header sumiu completamente e a tela ganhou espaço e clareza.

---

### FASE 4: TESTES PONTA A PONTA, AJUSTES SENSORIAIS & DOCUMENTAÇÃO VIVA

**Objetivo:** Garantir fluidez perfeita nas transições de rotas, feedback tátil padronizado, fechamento sem atrito e documentação sincronizada.

#### Tarefas Granulares:
- [x] **4.1. Testes Ponta a Ponta do Fluxo de Tour:**
  - Simular: Início do tour -> Avançar passo a passo com spotlight acompanhando as rotas -> Pressionar `Escape` ou clicar no `[X]` -> Tour encerra imediatamente e o app volta ao estado limpo.
  - Simular: Chegar ao último passo e clicar em "Começar Minha Conta Real" -> Tour encerra e direciona para o primeiro cadastro.
- [x] **4.2. Integração Sensorial Centralizada:**
  - Utilizar `triggerSensory("navigation")` ao avançar/retroceder passos e `triggerSensory("action")` ao concluir ou sair, respeitando a regra de zero duplos disparos.
- [x] **4.3. Atualização da Documentação:**
  - Atualizar `docs/ROADMAP.md` e `docs/ARCHITECTURE.md` registrando a nova arquitetura de Spotlight & Foco do Tour (v2.78).

#### Portão de Qualidade 4 (Quality Gate 4):
- **Execução Global:** `npm test`, `npm run typecheck` e `npm run lint` 100% verdes.
- **Validação Mobile e Desktop:** Testado em viewport móvel (< 400px) e desktop (> 1200px).
- **Commit Semântico & Push:**
  * Mensagem: `refactor(tour): replace invasive tour bar with focused spotlight and adaptive popover`
  * Executar `git push`.

---

## 4. MATRIZ DE RASTREABILIDADE & DEFINITION OF DONE (DoD)

| Dimensão | Critério Canônico | Status Esperado |
|---|---|---|
| **Eliminação de Ruído** | A barra invasiva sob o header (`DemoTourBar`) foi 100% removida. | Eliminada |
| **Foco & Spotlight** | Backdrop escuro bloqueia distrações e holofote recorta apenas a área em explicação. | Implementado |
| **Prevenção de Bugs** | Backdrop bloqueia cliques externos durante o tour, prevenindo quebras de fluxo. | Protegido |
| **Responsividade** | Popover flutuante no Desktop e Bottom Sheet compacto no Mobile. | Adaptativo |
| **Saída sem Fricção** | Botão `[X]`, botão `[Sair]` e tecla `ESC` fecham o tour imediatamente com 1 clique. | 1-clique |
| **Governança de Código** | Zero emojis, sem controles HTML nativos, TypeScript estrito sem `any`. | Conforme §4 |
| **Testes Vitest** | Todas as suítes de teste de componentes e lógica 100% verdes. | Aprovado |
| **Documentação Viva** | `docs/` e `AGENTS.md` perfeitamente alinhados com a nova implementação. | Sincronizado |
