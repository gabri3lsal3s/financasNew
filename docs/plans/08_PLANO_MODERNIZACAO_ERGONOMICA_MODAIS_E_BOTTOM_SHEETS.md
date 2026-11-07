# PLANO DE IMPLEMENTAÇÃO 08 — MODERNIZAÇÃO ERGONÔMICA, ÁREA ÚTIL E PADRONIZAÇÃO DE MODAIS & BOTTOM SHEETS MOBILE

> **Documento Canônico de Arquitetura de UX, Engenharia de Frontend e Governança de Design System**  
> **Status:** Estruturado e Aprovado para Execução  
> **Arquivo:** `docs/plans/08_PLANO_MODERNIZACAO_ERGONOMICA_MODAIS_E_BOTTOM_SHEETS.md`  
> **Ordem de Implementação:** **8º (Ergonomia Mobile, Área Útil e Padronização de Diálogos)**  
> **Abrangência Auditada:** **85 componentes de modal** em 16 módulos do sistema  
> **Módulos Afetados:** `src/components/ui/modal.tsx`, `src/components/ui/responsive-dialog.tsx`, `src/components/ui/confirm-dialog.tsx`, `src/components/modules/`, `src/features/**/components/`, `docs/design/DESIGN_SYSTEM.md`, `AGENTS.md`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · Zero Emojis (`local/no-decorative-unicode`) · Regra 18 (Governança de Modais) · Mobile-First · Radix UI Dialog A11y AA  
> **Ambientes:** Web Desktop, Web PWA (iOS/Android) & Android Nativo (Capacitor Pro)  

---

## 1. SUMÁRIO EXECUTIVO & DIAGNÓSTICO DA PROBLEMÁTICA

Durante o uso diário em dispositivos móveis, foi identificada uma severa restrição de espaço útil e conforto visual nos modais da aplicação. O aplicativo opera em arquitetura híbrida (Bottom Sheet no mobile e Diálogo Centralizado no desktop). No entanto, a implementação atual de cabeçalhos e rodapés fixos gera o indesejado **efeito "Visor Estreito" (*Viewport Squeeze*)** e cortes visuais desconfortáveis.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ANATOMIA ATUAL VS. ANATOMIA MODERNA                  │
└────────────────────────────────────────────────────────────────────────┘

              ESTRUTURA ATUAL (CLAUSTRÓFOBICA)
   ┌──────────────────────────────────────────────┐ ◄── Topo da tela
   │              [--- Alça ---]                  │
   │  Título do Modal                    [ X ]    │ ◄── CABEÇALHO FIXO
   │  Descrição longa com 2 a 3 linhas de texto   │     (~130px permanentemente bloqueados)
   ├──────────────────────────────────────────────┤ ◄── CORTE SECO ABRUPTO ("Hard Edge")
   │ [Recebido dos Amigos] (Cortado pela metade)  │
   │ R$ 0,00                                      │ ◄── CORPO ROLÁVEL LIMITADO
   │                                              │     (Apenas ~250px a 300px restantes)
   ├──────────────────────────────────────────────┤
   │ [ Botão Cancelar ]                           │ ◄── RODAPÉ FIXO EMPILHADO
   │ [ Botão Confirmar ]                          │     (~120px permanentemente bloqueados)
   └──────────────────────────────────────────────┘ ◄── Base da tela

                               ▼  EVOLUÇÃO ERGONÔMICA

              ESTRUTURA MODERNA (ÁREA ÚTIL MÁXIMA)
   ┌──────────────────────────────────────────────┐
   │         [--- Alça ---]              [ X ]    │ ◄── BARRA MÍNIMA FIXA (~38px)
   ├──────────────────────────────────────────────┤ ◄── FADE SUAVE / SEM CORTE SECO
   │  Título do Modal                             │
   │  Descrição (Rola naturalmente com os cards) │
   │                                              │ ◄── CORPO EXPANDIDO (~550px ÚTEIS)
   │  [ Card Recebido dos Amigos ] (Íntegro)      │     Ganha +150px a +200px de tela livre!
   │  [ Card Cota Líquida ]                       │     Quando o título rola, um micro-título
   │  [ Lista de Participantes ]                  │     aparece sutilmente na barra de topo.
   │                                              │
   │  [ Cancelar ]  [ Confirmar ]                 │ ◄── RODAPÉ HORIZONTAL COMPACTO (~54px)
   └──────────────────────────────────────────────┘
```

### 1.1 As 4 Patologias Identificadas no Diagnóstico Técnico

1. **Corte Abrupto Seco (*Hard Edge Clipping*):**
   Conforme comprovado no exemplo do modal de Racha de Despesas ([`manage-split-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/manage-split-dialog.tsx)), ao rolar a página para ver itens inferiores, cards e textos passam sob o bloco opaco do cabeçalho fixo e são cortados bruscamente pela metade sem qualquer transição visual suave.
2. **Desperdício de Viewport por Descrições Estáticas:**
   Descrições de 2 a 3 linhas (ex.: *"Acompanhe baixas por pessoa, registre calotes parciais ou finalize o racha."*) servem apenas para situar o usuário no primeiro segundo. Mantê-las fixas permanentemente no topo do celular consome entre 20% e 25% da altura útil sem utilidade contínua.
3. **O Efeito Sanduíche (Cabeçalho Fixo + Rodapé Fixo):**
   Nos modais que usam a prop `footer` ou [`ResponsiveDialog`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/responsive-dialog.tsx), o cabeçalho fixo consome ~130px e o rodapé empilhado consome ~120px. Em uma tela mobile comum (667px a 844px de altura), sobram menos de 350px para o conteúdo.
4. **Colapso com Teclado Virtual Aberto:**
   Quando o usuário toca em qualquer input (`MoneyInput` ou `Input`), o teclado do sistema operacional sobe ocupando ~300px. A área rolável útil é comprimida para uma fresta crítica de **50px a 80px**, impossibilitando enxergar os campos adjacentes ou o contexto do formulário.

---

## 2. AUDITORIA DE ABRANGÊNCIA: CENÁRIO COMPLETO DOS 85 MODAIS

A auditoria em todo o repositório identificou **85 arquivos de modal** distribuídos em 16 módulos. Todos dependem direta ou indiretamente dos primitivos [`Modal`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/modal.tsx) e [`ResponsiveDialog`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/responsive-dialog.tsx).

A tabela a seguir consolida o inventário completo categorizado por módulo, perfil de cabeçalho e comportamento do rodapé:

| Módulo / Diretório | Qtd | Arquivos de Modal Catalogados | Perfil de Cabeçalho / Rodapé | Criticidade Mobile |
|---|---|---|---|---|
| **Investimentos** (`src/features/investments/`) | **21** | `asset-form-dialog.tsx`, `asset-edit-dialog.tsx`, `asset-detail-sheet.tsx`, `investment-wizard.tsx`, `portfolio-snapshots-dialog.tsx`, `portfolio-import-dialog.tsx`, `portfolio-mapping-step.tsx`, `allocation-breakdown-dialog.tsx`, `dividend-form-dialog.tsx`, `contribution-form-dialog.tsx`, `contributions-list-dialog.tsx`, `calibrate-fixed-income-dialog.tsx`, `initial-pocket-cost-dialog.tsx`, `manual-price-dialog.tsx`, `cash-form-dialog.tsx`, `asset-split-dialog.tsx`, `quick-transaction-sheet.tsx`, `transaction-form-dialog.tsx`, `portfolio-darf-monitor.tsx`, `asset-sell-tab.tsx`, `resumo-tab.tsx` | Cabeçalho fixo com subtítulos longos; rodapés mistos (wizards usam footer fixo, formulários usam ModalFooter rolável) | **Crítica** (tabelas, gráficos e grids densos que precisam de 100% de tela livre) |
| **Componentes Centrais** (`src/components/modules/` e `layout/`) | **18** | `manage-split-dialog.tsx` (Racha de Despesa), `split-expense-dialog.tsx`, `cash-checkpoint-dialog.tsx`, `confirm-dialog.tsx`, `emergency-fund-config-dialog.tsx`, `upgrade-dialog.tsx`, `help-modal.tsx`, `more-menu-sheet.tsx`, `native-onboarding-dialog.tsx`, `apk-install-guide-dialog.tsx`, `ios-pwa-install-dialog.tsx`, `support-chat-dialog.tsx`, `save-preset-dialog.tsx`, `welcome-modal.tsx`, `welcome-feature-modal.tsx`, `demo-track-select-modal.tsx`, `floating-calculator.tsx`, `logo-profile-button.tsx` | Cabeçalhos densos com instruções operacionais de 2 a 3 linhas; corte seco de cards de síntese no scroll | **Máxima** (inclui o exemplo auditado do Racha de Despesas e gavetas de uso diário) |
| **Cartões de Crédito** (`src/features/cards/`) | **7** | `card-form-dialog.tsx`, `payment-dialog.tsx`, `batch-invoice-payment-dialog.tsx`, `bill-refinance-dialog.tsx`, `statement-import-dialog.tsx`, `invoice-details-dialog.tsx`, `card-management-dialog.tsx` | Preview virtual de cartão 3D no topo somado a cabeçalho fixo consome 50% da viewport antes de qualquer input | **Crítica** (preview 3D comprime campos de vencimento, fechamento e limite) |
| **Dívidas & Financiamentos** (`src/features/debts/`) | **6** | `debt-form-dialog.tsx`, `early-amortization-dialog.tsx`, `extra-amortization-dialog.tsx`, `loan-schedule-dialog.tsx`, `settle-dialog.tsx`, `debt-details-dialog.tsx` | Descrições financeiras e cronogramas de amortização (Price/SAC) empurrados por cabeçalho estático | **Alta** (formulários com cálculos de juros e carência) |
| **Configurações & Governança** (`src/features/settings/`) | **6** | `restore-wizard-dialog.tsx`, `account-tab.tsx`, `delete-account-card.tsx`, `family-budget-share-card.tsx`, `family-tab.tsx`, `subscription-tab.tsx` | Assistente de restauração com cálculo SHA-256 e confirmações de segurança de conta | **Média** (ações sensíveis com formulários de senha) |
| **Orçamentos & Metas Mensais** (`src/features/budgets/`) | **5** | `category-form-dialog.tsx`, `budget-adjust-dialog.tsx`, `delete-category-dialog.tsx`, `income-goal-dialog.tsx`, `limit-dialog.tsx` | Paletas de cores e icon-picker em grade que sofrem com área de rolagem estrangulada | **Alta** (grades de ícones precisam de altura para rolagem suave) |
| **Modo Família / Casal** (`src/features/family/`) | **4** | `family-settlement-dialog.tsx`, `family-settings-dialog.tsx`, `family-share-assets-dialog.tsx`, `family-invite-page.tsx` | Dossiê de acerto de contas mensal compartilhado com métricas e rodapé de quitação | **Alta** (balanço do casal com múltiplos lançamentos) |
| **Transações** (`src/features/transactions/`) | **3** | `launch-wizard.tsx` (Lançamento Rápido FAB), `expense-detail-dialog.tsx`, `income-detail-dialog.tsx` | Ponto de entrada mais frequente do aplicativo inteiro; wizard em etapas com teclado numérico Nubank | **Máxima** (teclado virtual abre com frequência imediata) |
| **Metas Financeiras** (`src/features/goals/`) | **3** | `share-goal-dialog.tsx`, `add-contribution-dialog.tsx`, `manage-contributions-dialog.tsx` | Extrato de aportes e link público de compartilhamento com preview social | **Média** (listas de histórico) |
| **Visão Geral / Overview** (`src/features/overview/`) | **3** | `category-breakdown-dialog.tsx`, `other-budgets-dialog.tsx`, `other-categories-dialog.tsx` | Implementados via `ResponsiveDialog` com prop `footer` fixado e listas densas de itens | **Alta** (modais de auditoria analítica rápida) |
| **Administração da Plataforma** (`src/features/admin/`) | **3** | `user-edit-dialog.tsx`, `create-invite-dialog.tsx`, `ticket-manage-dialog.tsx` | Painéis densos de auditoria, chamados de suporte e emissão de convites | **Média** (uso de retaguarda) |
| **Divisão Pública / Racha Pix** (`src/features/public-share/`) | **2** | `select-participant-dialog.tsx`, `select-split-category-dialog.tsx` | Diálogos de acolhimento de convidados externos do racha para categorização com 1 clique | **Alta** (primeira impressão de convidados não-cadastrados) |
| **Central de Relatórios** (`src/features/reports/` + `ReportDocumentLayout`) | **6** | `financial-close-report-modal.tsx`, `wealth-tear-sheet-modal.tsx`, `consolidated-wealth-modal.tsx`, `dividend-freedom-modal.tsx`, `tax-facilitator-modal.tsx`, `report-detail-dialog.tsx` | Dossiês executivos com pré-visualização completa na tela e impressão A4 via portal PrintSheet | **Alta** (precisa manter as ações de Imprimir/Salvar PDF na barra superior) |
| **Insights & Recorrências** (`src/features/insights/`) | **1** | `convert-recurrence-dialog.tsx` | Conversão inteligente de assinatura identificada em lançamento fixo | **Média** |
| **Ferramentas Rápidas** (`src/features/tools/`) | **1** | `tools-quick-dialog.tsx` | Atalhos operacionais de utilidades | **Baixa** |
| **Landing Page / Legal** (`src/features/landing/`) | **1** | `legal-dialog.tsx` | Termos de uso, privacidade e compliance LGPD via `ResponsiveDialog` com abas | **Média** (leitura longa de contratos e cláusulas) |
| **Total Auditado** | **85** | **100% dos Modais e Diálogos do Aplicativo** | — | — |

---

## 3. PILARES ARQUITETURAIS DA NOVA EXPERIÊNCIA

### 3.1 Solução Sistêmica no Primitivo (`Single Source of Truth`)
Como todos os 85 modais do sistema herdam diretamente do primitivo [`Modal`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/modal.tsx) (ou indiretamente via [`ResponsiveDialog`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/responsive-dialog.tsx) e [`ReportDocumentLayout`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/reports/report-document-layout.tsx)), **modernizar a arquitetura do primitivo resolve imediatamente o problema em 100% dos 85 modais**:

1. **Barra de Controle Superior Minimalista (Mobile):** Contêiner fixo ultra-compacto (`h-10` / 40px) com alça de arrasto centralizada e botões de utilidade (`X`, calculadora e `headerActions`) perfeitamente alinhados à direita.
2. **Cabeçalho Fluido Integrado ao Scroll:** Título editorial principal (`DialogTitle`) e descrição (`DialogDescription`) são renderizados no topo do corpo de rolagem (`scrollRef`). Ao rolar a tela, sobem naturalmente, **liberando mais de 100px a 150px de espaço útil**.
3. **Micro-Título de Contexto Reativo:** Ao rolar além de ~32px (quando o título principal sai da tela), a barra de controle superior exibe suavemente o título em versão compacta (`text-xs font-semibold truncate text-foreground`), mantendo a orientação do usuário sem consumir altura.
4. **Alívio de Borda Suave (Eliminação do Corte Seco):** A barra superior conta com `bg-surface/95 backdrop-blur-xs` e borda adaptativa `border-border/80` ativada durante a rolagem, eliminando o corte reto pela metade de cards (como visto em "Recebido dos Amigos").
5. **Desktop 100% Preservado:** Zero alterações no desktop (`≥ md`), preservando o diálogo clássico centralizado do Radix UI.

### 3.2 Harmonização e Calibração dos Rodapés (`ModalFooter`)
- No mobile, rodapés com 2 botões ("Cancelar" e "Salvar") adotam layout horizontal simétrico (`grid grid-cols-2 gap-2` ou `flex-row justify-end`) com altura compacta de botão (`h-9 sm:h-9.5`), reduzindo a altura do rodapé de ~120px para ~54px.
- Padding inferior com safe area dinâmica: `pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]`.

---

## 4. FASES E ETAPAS DE IMPLEMENTAÇÃO

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAPA DE EXECUÇÃO EM 5 FASES CANÔNICAS                           │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [FASE 1] Núcleo dos Primitivos: Modal.tsx & ResponsiveDialog.tsx
   ├─ Etapa 1.1: Barra de Controle Minimalista (Grabber Bar h-10)
   ├─ Etapa 1.2: Cabeçalho Fluido Integrado ao Scroll (Inline Header Único)
   ├─ Etapa 1.3: Micro-Título de Contexto Dinâmico no Scroll (Reactive Mini-Title)
   └─ Etapa 1.4: Máscara & Borda Adaptativa Anti-Corte (Anti-Hard-Clipping)

 [FASE 2] Padronização & Compactação de Rodapés (ModalFooter)
   ├─ Etapa 2.1: Layout Horizontal Compacto no Mobile (Dois Botões Lado a Lado)
   ├─ Etapa 2.2: Otimização para Teclado Virtual & Safe-Area Dinâmica
   └─ Etapa 2.3: Unificação de Contratos da Prop `footer` vs `<ModalFooter>`

 [FASE 3] Validação nos 16 Módulos e 85 Modais do Ecossistema
   ├─ Etapa 3.1: Componentes Centrais (ManageSplitDialog, AttachReceipt, etc.)
   ├─ Etapa 3.2: Investimentos (21 modais: Wizards, Tabelas e Fichas)
   ├─ Etapa 3.3: Transações (LaunchWizard, Detalhes de Despesa/Receita)
   ├─ Etapa 3.4: Cartões (7 modais: Preview 3D, Pagamento, Extratos)
   ├─ Etapa 3.5: Dívidas, Família, Orçamentos e Metas (20 modais)
   └─ Etapa 3.6: Relatórios Executivos (ReportDocumentLayout e Dossiês A4)

 [FASE 4] Governança de Documentação & Design System
   ├─ Etapa 4.1: Atualização da Regra 18 do AGENTS.md
   ├─ Etapa 4.2: Atualização da Seção 13.2 do DESIGN_SYSTEM.md
   └─ Etapa 4.3: Registro de Padrões no ARCHITECTURE.md

 [FASE 5] Quality Gates, Bateria de Testes & Homologação
   ├─ Etapa 5.1: Testes Unitários de Primitivos (Vitest + Testing Library)
   ├─ Etapa 5.2: Validação de Acessibilidade Radix (axe / screen readers)
   └─ Etapa 5.3: Validação Visual Multi-Viewport (Mobile 360px a 430px & Desktop)
```

---

### FASE 1: NÚCLEO DOS PRIMITIVOS — `Modal.tsx` & `ResponsiveDialog.tsx`

- [ ] **Etapa 1.1: Barra de Controle Minimalista (Grabber Bar `h-10`)**
  - No arquivo [`src/components/ui/modal.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/modal.tsx), reestruturar o contêiner de topo para mobile:
    * Criar a barra fixa superior com altura contida (`h-10 md:hidden flex items-center justify-between px-3.5 shrink-0 relative`).
    * Alça do bottom sheet posicionada centralmente com área de toque ergonômica (`h-1 w-10 rounded-full bg-primary/30`).
    * Botões de ação contextual (`headerActions`, calculadora e fechar) posicionados à direita na barra minimalista com tamanho compacto (`size-8`).
- [ ] **Etapa 1.2: Cabeçalho Fluido Integrado ao Scroll (Inline Header Único)**
  - No corpo rolável (`scrollRef`), posicionar o bloco de título e descrição para visualização mobile:
    * Renderizar `<DialogPrimitive.Title>` e `<DialogPrimitive.Description>` no topo do corpo de rolagem no mobile (`md:hidden`).
    * Manter a renderização do cabeçalho clássico estático exclusivamente para desktop (`hidden md:block shrink-0 p-6 pb-3`).
    * Garantir que as tags acessíveis do Radix (`Title` e `Description`) permaneçam montadas e vinculadas aos IDs de acessibilidade (`aria-labelledby` e `aria-describedby`) com zero duplicação de texto no DOM.
- [ ] **Etapa 1.3: Micro-Título de Contexto Dinâmico no Scroll**
  - Implementar hook ou listener leve de scroll em `scrollRef`:
    * Quando `scrollTop > 32px`, ativar flag de estado `isScrolled`.
    * Na barra superior fixa do mobile, exibir o título resumido com transição de opacidade e corte gracioso (`text-xs font-semibold text-foreground truncate max-w-[60vw]`).
    * Respeitar rigorosamente `prefers-reduced-motion` e evitar re-renders desnecessários usando throttling ou ref direta.
- [ ] **Etapa 1.4: Máscara & Borda Adaptativa Anti-Corte**
  - Adicionar transição visual na barra de controle superior:
    * Quando `isScrolled === false`: fundo limpo e borda transparente.
    * Quando `isScrolled === true`: `bg-surface/95 backdrop-blur-xs border-b border-border/80 shadow-xs`, eliminando o corte reto de cards como visto em "Recebido dos Amigos".

---

### FASE 2: PADRONIZAÇÃO & COMPACTAÇÃO DE RODAPÉS (`ModalFooter`)

- [ ] **Etapa 2.1: Layout Horizontal Compacto no Mobile**
  - Refatorar [`ModalFooter`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/modal.tsx#L300-L312):
    * Substituir o layout empilhado vertical de 2 botões grandes (`flex-col-reverse [&_button]:w-full`) por layout horizontal equilibrado no mobile: `grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:justify-end`.
    * Padronizar altura de botões em rodapés de diálogos para `size="default"` (`h-9 sm:h-9.5`), liberando ~60px de tela útil no mobile.
    * Nos casos de 3 botões (ex.: "Excluir" + "Cancelar" + "Salvar"), o botão destrutivo assume largura total ou ícone com confirmação, mantendo Cancelar e Confirmar emparelhados.
- [ ] **Etapa 2.2: Otimização para Teclado Virtual & Safe-Area**
  - No contêiner de rodapé fixo da prop `footer`:
    * Ajustar o padding inferior para usar padding dinâmico seguro `pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]`.
    * Garantir que o contêiner `DialogPrimitive.Content` use `max-h-[calc(100dvh-1.5rem)]` ou `h-auto max-h-[92dvh]` evitando saltos bruscos ao abrir teclados em navegadores modernos (`interactive-widget=resizes-content`).
- [ ] **Etapa 2.3: Unificação de Contratos entre `footer` Prop e `<ModalFooter>` Inline**
  - Estabelecer diretriz clara e canônica:
    * Modais de formulário simples com $\le 4$ campos e ações de confirmação: utilizar a prop `footer={...}` (rodapé fixo e compacto).
    * Modais longos com listas dinâmicas, tabelas e feeds de auditoria (ex.: `ManageSplitDialog`, extratos): o rodapé pode rolar no final do conteúdo para maximizar 100% da área útil durante a leitura.

---

### FASE 3: VALIDAÇÃO NOS 16 MÓDULOS E 85 MODAIS DO ECOSSISTEMA

- [ ] **Etapa 3.1: Componentes Centrais (`src/components/modules/` e `layout/` — 18 modais)**
  - Validar [`manage-split-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/manage-split-dialog.tsx) (Racha de Despesa): conferir que os cards métricos ("Recebido dos Amigos", "Cota Líquida") sobem suavemente sem corte seco.
  - Validar [`split-expense-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/split-expense-dialog.tsx), [`cash-checkpoint-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/cash-checkpoint-dialog.tsx), [`attach-receipt-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/attach-receipt-dialog.tsx), [`more-menu-sheet.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/layout/more-menu-sheet.tsx), [`help-modal.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/help-modal.tsx) e [`upgrade-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/subscription/upgrade-dialog.tsx).
- [ ] **Etapa 3.2: Investimentos (`src/features/investments/` — 21 modais)**
  - Validar [`investment-wizard.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/wizard/investment-wizard.tsx): garantir que os passos do assistente de ativos tenham área útil de rolagem.
  - Validar [`portfolio-snapshots-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/portfolio-snapshots-dialog.tsx) e [`allocation-breakdown-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/allocation-breakdown-dialog.tsx): assegurar visualização tabular fluida.
  - Validar [`asset-form-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/asset-form-dialog.tsx), [`dividend-form-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/dividend-form-dialog.tsx) e [`contribution-form-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/investments/components/contribution-form-dialog.tsx).
- [ ] **Etapa 3.3: Transações (`src/features/transactions/` — 3 modais)**
  - Validar [`launch-wizard.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/transactions/wizard/launch-wizard.tsx): o assistente de lançamento rápido principal precisa respirar livremente mesmo quando o teclado numérico progressivo Nubank estiver ativo.
  - Validar [`expense-detail-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/transactions/components/expense-detail-dialog.tsx) e [`income-detail-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/transactions/components/income-detail-dialog.tsx).
- [ ] **Etapa 3.4: Cartões de Crédito (`src/features/cards/` — 7 modais)**
  - Validar [`card-form-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/card-form-dialog.tsx): assegurar que o preview virtual 3D do cartão não esmague os inputs de limite e fechamento no mobile.
  - Validar [`payment-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/payment-dialog.tsx), [`batch-invoice-payment-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/batch-invoice-payment-dialog.tsx) e [`invoice-details-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/cards/components/invoice-details-dialog.tsx).
- [ ] **Etapa 3.5: Dívidas, Família, Orçamentos e Metas (20 modais)**
  - Validar [`category-form-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/budgets/components/category-form-dialog.tsx) (grade de ícones com rolagem suave).
  - Validar [`debt-form-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/debts/components/debt-form-dialog.tsx), [`early-amortization-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/debts/components/early-amortization-dialog.tsx) e [`family-settlement-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/family/components/family-settlement-dialog.tsx).
  - Validar [`share-goal-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/goals/components/share-goal-dialog.tsx) e [`category-breakdown-dialog.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/overview/components/category-breakdown-dialog.tsx).
- [ ] **Etapa 3.6: Relatórios Executivos & Dossiês A4 (`ReportDocumentLayout` — 6 modais)**
  - Validar [`report-document-layout.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/reports/report-document-layout.tsx), [`financial-close-report-modal.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/reports/components/financial-close-report-modal.tsx) e [`wealth-tear-sheet-modal.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/features/reports/components/wealth-tear-sheet-modal.tsx): assegurar que o botão de "Imprimir / Salvar PDF" e customActions permaneçam perfeitamente operacionais na barra de topo minimalista.

---

### FASE 4: GOVERNANÇA DE DOCUMENTAÇÃO & DESIGN SYSTEM

- [ ] **Etapa 4.1: Atualização da Regra 18 do `AGENTS.md`**
  - Incorporar no item 18 do [`AGENTS.md`](file:///home/gabrielsales/meus_apps/financasnew/AGENTS.md) a regra canônica de cabeçalho fluido no mobile: proibição de cabeçalhos estáticos descritivos de grande porte no mobile e diretrizes de rodapé compacto.
- [ ] **Etapa 4.2: Atualização do `DESIGN_SYSTEM.md`**
  - Atualizar a Seção 13.2 do [`docs/design/DESIGN_SYSTEM.md`](file:///home/gabrielsales/meus_apps/financasnew/docs/design/DESIGN_SYSTEM.md) documentando a anatomia móvel de barra minimalista (`GrabberBar`) + cabeçalho integrado no scroll + micro-título reativo.
- [ ] **Etapa 4.3: Atualização do `ARCHITECTURE.md`**
  - Registrar as diretrizes de performance e prevenção de re-renders no ciclo de vida de modais no [`docs/architecture/ARCHITECTURE.md`](file:///home/gabrielsales/meus_apps/financasnew/docs/architecture/ARCHITECTURE.md).

---

### FASE 5: QUALITY GATES, BATERIA DE TESTES & HOMOLOGAÇÃO

- [ ] **Etapa 5.1: Testes Unitários dos Primitivos (`Vitest`)**
  - Atualizar [`src/components/ui/modal.test.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/modal.test.tsx) e [`src/components/ui/responsive-dialog.test.tsx`](file:///home/gabrielsales/meus_apps/financasnew/src/components/ui/responsive-dialog.test.tsx) para garantir que títulos, descrições e botões de fechar continuem acessíveis nas queries de teste do Testing Library.
  - Validar drag-to-close e ausência de vazamento de gestos.
- [ ] **Etapa 5.2: Validação de Acessibilidade Radix (A11y AA)**
  - Garantir que `aria-labelledby` aponte corretamente para o `DialogTitle` montado, sem violações no console do navegador ou falhas no leitor de tela.
- [ ] **Etapa 5.3: Validação Visual Multi-Viewport**
  - Homologar nas resoluções:
    * Mobile pequeno: 360x640px (ex.: Galaxy A / iPhone SE);
    * Mobile padrão: 390x844px (ex.: iPhone 13/14/15);
    * Mobile grande: 430x932px (ex.: iPhone Pro Max);
    * Tablet: 768x1024px;
    * Desktop: 1280x800px e 1920x1080px.

---

## 5. PONTOS DE QUALIDADE & DEFINITION OF DONE (DoD)

Para que a implementação deste plano seja considerada 100% concluída e pronta para produção, todos os seguintes critérios de aceitação devem ser estritamente atendidos:

1. **Cobertura Universal (85/85 Modais):** 100% dos modais do aplicativo herdam a nova ergonomia de cabeçalho fluido no mobile.
2. **Zero Cortes Visuais Bruscos:** Nenhum card, texto ou controle é cortado pela metade de forma seca contra fundos opacos ao rolar o modal no mobile.
3. **Ganho Mínimo de 100px a 150px de Tela Útil:** Todo modal no mobile libera imediatamente espaço vertical ao rolar, permitindo leitura ampla de dados e formulários.
4. **Preservação de Contexto (Micro-Título):** O usuário nunca perde a identificação do modal no mobile; ao rolar o título principal para fora, o micro-título discreto assume o topo.
5. **Isolamento de Impacto no Desktop:** Diálogos centralizados em telas `>= md` (768px+) preservam integralmente sua apresentação visual clássica e confortável sem quebras estéticas.
6. **Ergonomia com Teclado Virtual:** Abrir o teclado virtual dentro de qualquer modal não estrangula a área útil a ponto de impedir o preenchimento ou rolagem de campos.
7. **Zero Emojis e Conformidade com ESLint:** 100% de adesão à regra `local/no-decorative-unicode` e ícones estritamente com `lucide-react`.
8. **Suíte de Testes 100% Verde:** `npm run test -- --run` executando com sucesso e sem regressões em testes unitários e de integração de toda a aplicação.
