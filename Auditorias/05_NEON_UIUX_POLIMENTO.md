# Auditoria 05 — Polimento de UI/UX, Responsividade & Design System (Axir)

> **Data:** 2026-11-26  
> **Escopo:** Auditoria estática integral de páginas, cards, modais, drawers, barras de ação, tabelas, estados de carregamento/vazio e gateway sensorial (`src/components/`, `src/features/`, `src/services/`, `src/styles/`).  
> **Restrição:** Modo somente-leitura — **zero arquivos de código-fonte foram alterados**.  
> **Documentos de Governança Verificados:** `AGENTS.md` (Regras 1–36), `docs/DESIGN_RULES.md` (v3.1) e `docs/design/DESIGN_SYSTEM.md` (v2.0).

---

## Resumo Executivo

A base visual do **Axir** apresenta alta maturidade arquitetural: o gateway sensorial (`src/services/sensory.ts`) concentra 100% das chamadas de áudio e vibração com degradação graciosa, não há nenhuma ocorrência de `autoFocus` declarativo em produção (Regra 20 cumprida), o primitivo `<Modal />` adota shell tripartite estanque com proteção de portais Radix, e o sistema de tokens CSS (`tokens.css` / `globals.css`) é sólido nos 3 temas (Light, Dark Abissal Teal e OLED).

Entretanto, a auditoria minuciosa identificou **29 pontos concretos de polimento** distribuídos nos 4 pilares críticos — com destaque para:

| Pilar | Severidade Máxima | Principais Achados |
|---|---|---|
| **1. Zero Truncamento & Fluidez em Cards** | **P0 (Crítico)** | `grid-cols-3` rígido com `truncate` direto em `<MoneyText />` no motor de aporte; `line-clamp-1 truncate` em KPIs de relatório; títulos de transações esmagados por badges inline em 360px. |
| **2. Responsividade Progressiva de Botões** | **P0 (Crítico)** | `grid-cols-3` com `"Registrar pagamento"` em 360px estourando a toolbar de faturas; 10+ `ConfirmDialog` e `ModalFooter` com rótulos de 18–22 caracteres em `grid-cols-2` com `whitespace-nowrap`; bug de contagem de filhos em `ModalFooter`. |
| **3. Ergonomia Mobile & Modais** | **P1 (Alto)** | 4 containers com `overflow-y-auto` aninhado dentro de modais/cards (Regra 26); 2 tabelas financeiras envoltas em `overflow-hidden` sem `overflow-x-auto` (Regra 25); divergência de tipografia/padding em `Input`. |
| **4. Sensorialidade & Coesão Visual** | **P1 (Alto)** | Duplo disparo sensorial + disparo após reset silencioso em `appearance-tab.tsx`; contraste AA insuficiente de `text-portfolio` em `MoneyText` e `KpiCard`; micro-fontes `< 10px`; 2 rotas sem skeleton dedicado; botões sem bloqueio/loading contra clique duplo. |

---

## 1. Zero Truncamento & Fluidez Responsiva em Cards

### 1.1 `grid-cols-3` rígido + `truncate` direto em `<MoneyText />` (Cockpit de Aporte)
- **Arquivo:** `src/components/modules/aporte-result/aporte-cockpit-command-card.tsx`
- **Linhas:** `399–445`
- **Regras Violadas:** `AGENTS.md` Regra 10 (proibição de `grid-cols-3` rígido para dados monetários), Regra 11 (proibição absoluta de `truncate` em valores monetários), Regra 16 (`border-border/80`).
- **Problema Atual:** A cápsula de síntese usa `border-border/50` e `<div className="grid grid-cols-3 divide-x divide-border/50 text-center">` com `truncate` aplicado diretamente nos 3 `<MoneyText />` (linhas 409, 432 e 444). Em smartphones de 360px–390px, cada coluna recebe ~96px úteis, cortando valores a partir de 5 dígitos (`R$ 12.500...`) com reticências.
- **Solução Exata:**
  1. Alterar a casca externa para `rounded-xl border border-border/80 bg-surface-raised/40 p-3 shadow-xs`.
  2. Trocar o grid rígido para mobile-first adaptativo: `grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-0 sm:divide-x sm:divide-border/80 text-left sm:text-center` (ou `grid-cols-2 sm:grid-cols-3`, fazendo o 3º item ocupar `col-span-2 sm:col-span-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60` no mobile).
  3. **Remover `truncate`** de todos os `<MoneyText />` (linhas 409, 432, 444) e usar `whitespace-nowrap tabular-nums text-sm sm:text-base font-bold` com `deemphasizeCents`.
  4. Nos rótulos (linhas 402, 414, 436), substituir `truncate` por `line-clamp-2 break-words`.

### 1.2 `grid-cols-3` rígido + `truncate` em `<MoneyText />` + formatação decimal com ponto (Resumo de Aporte)
- **Arquivo:** `src/components/modules/aporte-result/aporte-summary-section.tsx`
- **Linhas:** `78–113` e `123`
- **Regras Violadas:** `AGENTS.md` Regras 10, 11 e 28 (formatação pt-BR com vírgula decimal).
- **Problema Atual:**
  - Linha 78: `grid grid-cols-3 divide-x divide-border/60 text-center` com `truncate` direto nos 3 `<MoneyText />` (linhas 86, 100, 110) e rótulos longos (`"Alocado (3/8 feitos)"`) truncados no mobile.
  - Linha 123: `diversificationImpact.currentNef.toFixed(1)` renderiza ponto decimal (`4.2 → 5.1`) em vez de vírgula pt-BR (`4,2 → 5,1`).
- **Solução Exata:**
  1. Reestruturar linha 78 para `grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-0 sm:divide-x sm:divide-border/80`, atribuindo `col-span-2 sm:col-span-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/80` ao terceiro bloco ("Sobra para caixa").
  2. Remover `truncate` das linhas 86, 100 e 110 e usar escala fluida `text-sm sm:text-base font-bold tabular-nums whitespace-nowrap`.
  3. Formatar `currentNef` e `projectedNef` com `Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })` (ou helper dedicado em `src/services/masks/`).

### 1.3 `line-clamp-1 truncate` redundante e corte de valores em KPIs de Relatório
- **Arquivo:** `src/components/modules/reports/report-kpi-grid.tsx`
- **Linhas:** `68`, `86`, `90`
- **Regras Violadas:** `AGENTS.md` Regras 23 (títulos de KPI com `line-clamp-2 break-words`) e 24 (escala tipográfica adaptativa para grids de 2 colunas no mobile).
- **Problema Atual:**
  - Linha 68: `<span className="... line-clamp-1 truncate ...">{item.label}</span>` combina classes redundantes e corta títulos descritivos (ex.: `"Patrimônio Líquido Consolidado"`) em 1 linha no grid `grid-cols-2` mobile.
  - Linha 90: `item.subtext` também usa `line-clamp-1 truncate`, decepando informações comparativas.
  - Linha 86: `text-base sm:text-lg ... whitespace-nowrap` sem `overflow-x-auto no-scrollbar` nem redução adaptativa de fonte em 2 colunas mobile (`~148px` internos em 360px), podendo estourar o card em valores $\ge$ R$ 100.000,00.
- **Solução Exata:**
  1. Linha 68: trocar `line-clamp-1 truncate` por `line-clamp-2 break-words leading-snug`.
  2. Linha 90: trocar `line-clamp-1 truncate` por `line-clamp-2 break-words leading-snug`.
  3. Linha 86: ajustar escala para `text-[15px] sm:text-base lg:text-lg` e adicionar `overflow-x-auto no-scrollbar` no wrapper do valor para garantir contenção absoluta sem reticências.

### 1.4 Esmagamento do título de lançamento por badges inline em `TransactionRow`
- **Arquivo:** `src/components/modules/transaction-row.tsx`
- **Linhas:** `114–156`
- **Regras Violadas:** `AGENTS.md` Regra 23; `DESIGN_RULES.md` §4.1.
- **Problema Atual:** Na linha 115–151, o título (`<p className="truncate text-sm font-medium">`) divide a mesma linha flexível horizontal com até 3 `<Badge size="xs" />` (`chargeKind`, `Racha`, `splitLabel`), além do slot `badges` (linha 156) e do bloco de valor monetário à direita (linha 158). Em 360px, um lançamento com badge `"Racha"` e valor `"-R$ 1.250,00"` reduz o título a ~70–90px (`"Superme..."`), e o subtítulo (linha 153) usa `truncate` sem atributo `title`.
- **Solução Exata:**
  1. Na linha 115, trocar `flex items-center gap-1.5 min-w-0` por layout empilhado no mobile ou `flex-wrap`: renderizar o título em `line-clamp-2 sm:line-clamp-1 break-words text-sm font-medium text-foreground` (`title={title}`) e mover os badges de metadados (`chargeKind`, `Racha`, `splitLabel`, `badges`) para uma sub-linha `flex flex-wrap items-center gap-1 mt-0.5` abaixo do título em `< sm` (ou `flex-wrap` natural).
  2. Na linha 153, adicionar `title={[date, subtitle].filter(Boolean).join(" · ")}` e trocar `truncate` por `line-clamp-1 break-words` ou `flex flex-wrap items-center gap-x-1.5` para que a data nunca seja cortada.

### 1.5 Cabeçalho de card composto rígido com `truncate` no título (Negócio / PJ)
- **Arquivo:** `src/features/business/pages/business-page.tsx`
- **Linhas:** `465–476`
- **Regras Violadas:** `AGENTS.md` Regra 12 (cabeçalhos compostos com `flex-col sm:flex-row`) e Regra 23 (proibido `truncate` cego em título de card dividindo linha com badge).
- **Problema Atual:** `<CardHeader className="flex-row items-center justify-between gap-2.5 pb-3">` com `<CardTitle className="text-sm sm:text-base font-semibold truncate">` e `<Badge>` na mesma linha.
- **Solução Exata:** Trocar `CardHeader` para `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3` e remover `truncate` do `CardTitle`, adotando `line-clamp-2 break-words`.

### 1.6 Truncamento de título do cartão e densidade do rodapé no `CreditCard3D`
- **Arquivo:** `src/components/modules/credit-card-3d.tsx`
- **Linhas:** `136–150` e `190–228`
- **Regras Violadas:** `AGENTS.md` Regras 23 e 24.
- **Problema Atual:** Na linha 137, `card.name` usa `truncate` competindo horizontalmente com `Badge "Principal"`, `Badge "Inativo"` e `CardBrandBadge`. Em cartões com nomes compostos (ex.: `"Nubank Ultravioleta Black"`), o nome é cortado precocemente em 360px. No rodapé (linhas 190–228), quando há `Melhor dia`, `Fech.`, `Venc.` e `Disp.: R$ 12.450,00`, a quebra com `ml-auto` pode deixar o limite disponível desalinhado em segunda linha estreita.
- **Solução Exata:**
  1. Na linha 136, permitir `flex-wrap items-center gap-1.5` no bloco esquerdo com `card.name` em `line-clamp-1 break-words` e `title={card.name}` para leitura acessível.
  2. No rodapé (linha 190), adotar `flex flex-col xs:flex-row xs:items-center xs:justify-between gap-y-1.5 gap-x-2` para garantir alinhamento limpo entre o bloco de datas e o limite disponível em telas de 360px.

### 1.7 Títulos e descrições cortados em 1 linha (`line-clamp-1`) nas linhas de Notificação e Lembretes
- **Arquivos e Linhas:**
  - `src/features/reminders/components/notifications/SystemNotificationRows.tsx`: linhas `116`, `205`, `256`, `264`, `303`, `353`, `360`, `415`, `488`, `571`, `663`
  - `src/features/reminders/components/notifications/ReminderNotificationRows.tsx`: linhas `102`, `128`, `198`
  - `src/components/modules/reminder-item.tsx`: linha `139`
  - `src/features/insights/components/diagnostic-card.tsx`: linha `45`
- **Regras Violadas:** `AGENTS.md` Regras 19 e 23 (teto de 2 linhas legíveis em alertas/notificações para evitar perda de valores ou datas).
- **Problema Atual:** Tanto títulos quanto descrições dessas notificações usam `line-clamp-1`. No `NotificationsPopover` (`max-w-80` = 320px no mobile), mensagens financeiras como `"Fatura Nubank vence em 2 dias — R$ 1.840,00"` são cortadas antes mesmo de exibir o valor ou o prazo.
- **Solução Exata:** Promover `line-clamp-1` para `line-clamp-2 break-words` em todos os títulos e descrições dessas linhas (com `title={...}` nativo como fallback de leitura integral no desktop), preservando `leading-snug` para manter altura compacta sem cortar valores monetários.

### 1.8 Escala condicional redundante no Hero de Saldo Bancário
- **Arquivo:** `src/components/modules/real-cash-hero-card.tsx`
- **Linhas:** `173–178`
- **Regras Violadas:** `AGENTS.md` Regra 24.
- **Problema Atual:** O ternário nas linhas 175–177 retorna `"text-2xl sm:text-3xl"` em **ambos** os ramos (`>= 10_000_000` e default), deixando valores entre R$ 100.000,00 e R$ 999.999,99 no tamanho `text-2xl` (24px) em 360px sem redução intermediária.
- **Solução Exata:** Corrigir a escada de escala para 3 degraus reais:
  ```tsx
  Math.abs(cashBalance.currentBalanceCents) >= 100_000_000
    ? "text-lg sm:text-2xl"
    : Math.abs(cashBalance.currentBalanceCents) >= 10_000_000
      ? "text-xl sm:text-2xl"
      : "text-2xl sm:text-3xl"
  ```

---

## 2. Responsividade Progressiva de Botões (Texto Completo → Palavra Única → Ícone Lucide)

### Padrão Canônico Recomendado (DRY — `AGENTS.md` §4)

Como `buttonVariants` (`src/components/ui/button-variants.ts:9`) impõe `whitespace-nowrap`, qualquer botão com texto composto ($\ge 14$ caracteres) dentro de grids mobile (`grid-cols-2`, `grid-cols-3`) ou toolbars estreitas estoura o container ou esmaga vizinhos em 360px–390px.

**Proposta Arquitetural DRY:** Criar um sub-componente ou utilitário declarativo em `src/components/ui/` (ex.: `ResponsiveLabel` ou prop opcional no `<Button />`) que implemente a adaptação progressiva em **3 níveis** sem duplicar marcação nas telas:

| Nível | Viewport / Espaço | Apresentação | Requisitos Obrigatórios |
|---|---|---|---|
| **Nível 1 (Amplo)** | `md:` / `sm:` (`≥ 640px`) | Ícone Lucide + **Texto descritivo completo** (ex.: `Confirmar transação`) | `hidden sm:inline` |
| **Nível 2 (Intermediário / Mobile padrão)** | `xs:` / `360px–639px` (`min-[380px]:inline sm:hidden`) | Ícone Lucide + **Palavra-chave única** (ex.: `Confirmar` / `Salvar`) | `hidden min-[380px]:inline sm:hidden` |
| **Nível 3 (Muito estreito / Toolbar densa)** | `< 380px` ou barra com 3+ botões | **Somente ícone Lucide centralizado** | `aria-label` e `title` obrigatórios + área de toque mínima `min-h-11 min-w-11` (ou `after:-inset-1.5` já embutido em `Button size="sm"`). |

---

### 2.1 Estouro horizontal crítico na Toolbar de Faturas (`grid-cols-3` + `"Registrar pagamento"`)
- **Arquivo:** `src/features/cards/components/invoice-competence-toolbar.tsx`
- **Linhas:** `127–162`
- **Problema Atual:** Quando `onOpenCharge` existe, a div usa `grid grid-cols-3 sm:flex gap-2 w-full`. Em 360px (`~102px` por coluna), o 3º botão exibe `"Registrar pagamento"` (19 caracteres + `whitespace-nowrap`), estourando a largura da coluna e colidindo com os botões `"Estorno"` e `"Encargo"`. Além disso, `"Encargo"` (linha 151) e `"Registrar pagamento"` (linha 160) não possuem ícones Lucide.
- **Solução Exata:**
  1. Adicionar ícones contextuais: `<Undo2 />` (Estorno), `<ReceiptText />` (Encargo) e `<CheckCircle2 />` (Registrar pagamento).
  2. Aplicar adaptação progressiva nos 3 botões:
     - **Botão 1 (Estorno):** `sm:` `"Estorno"` → `min-[380px]:` `"Estorno"` → `< 380px:` ícone `<Undo2 />` (`aria-label="Registrar estorno"` `title="Estorno"`).
     - **Botão 2 (Encargo):** `sm:` `"Encargo"` → `min-[380px]:` `"Encargo"` → `< 380px:` ícone `<ReceiptText />` (`aria-label="Registrar encargo"` `title="Encargo"`).
     - **Botão 3 (Pagamento):** `sm:` `"Registrar pagamento"` → `min-[380px]:` `"Pagar"` → `< 380px:` ícone `<CheckCircle2 />` (`aria-label="Registrar pagamento"` `title="Registrar pagamento"`).
  3. Alternativamente, no mobile manter `grid-cols-2` para `Estorno` + `Encargo` e `col-span-2` para o CTA primário `Registrar pagamento` (`Pagar` em `< 380px`).

### 2.2 Bug estrutural de contagem de filhos em `ModalFooter`
- **Arquivo:** `src/components/ui/modal-footer.tsx`
- **Linhas:** `20–24`
- **Problema Atual:** `const count = Children.count(children);` conta `null`, `false`, `undefined` e conta `<Fragment>` como `1` único filho. Quando um modal passa `{cond && <Button />}` ou envolve 2 botões em `<>...</>`, `count` deixa de ser `2` e o layout quebra de `grid-cols-2` para `flex-col-reverse` inesperadamente (diferente de `PageHeader`, que implementou `countActionChildren` corretamente).
- **Solução Exata:** Reaproveitar a mesma lógica recursiva de `countActionChildren` (extraindo-a ou replicando o filtro de `null`/`undefined`/`boolean`/`Fragment`), garantindo que 2 botões reais sempre ativem `grid-cols-2 gap-2.5` no mobile.

### 2.3 Rótulos longos em `DiscardConfirmDialog` e `ConfirmDialog` estourando `grid-cols-2` no mobile
- **Arquivos e Linhas:**
  - `src/components/ui/modal.tsx`: linhas `106–124` (`"Continuar editando"` + `"Descartar"`)
  - `src/components/ui/confirm-dialog.tsx`: linhas `44–57` (primitivo base)
  - `src/features/cards/components/statement-import/statement-import-dialog.tsx`: linhas `312–313` (`"Descartar e voltar"` + `"Continuar conferindo"` lado a lado!)
  - `src/components/modules/reports/report-document-layout.tsx`: linha `158` (`"Emitir PDF mesmo assim"`)
  - `src/features/transactions/wizard/launch-wizard-modals.tsx`: linha `59` (`"Continuar preenchendo"`)
  - `src/features/settings/components/tabs/appearance-tab.tsx`: linha `220` (`"Confirmar Restauração"`)
  - `src/features/settings/components/tabs/active-devices-card.tsx`: linha `339` (`"Desconectar outros"`)
  - `src/features/investments/components/asset-detail-sheet.tsx`: linha `147` (`"Sim, excluir ativo"`)
  - `src/features/investments/components/portfolio-snapshots-dialog.tsx`: linha `284` (`"Restaurar Fechamento"`)
  - `src/features/investments/components/activity-panel/activity-delete-dialog.tsx`: linha `52` (`"Excluir movimentação"`)
- **Problema Atual:** Todos esses diálogos renderizam em `grid-cols-2` no mobile (`~136px` úteis por botão em 360px). Rótulos de 18–22 caracteres com `whitespace-nowrap` vazam pelas bordas do botão ou forçam overflow horizontal no modal.
- **Solução Exata:**
  1. Estender `ConfirmDialogProps` (`confirm-dialog.tsx`) com props opcionais `confirmShortLabel?: string`, `cancelShortLabel?: string` e `confirmIcon?: ReactNode` (padrão `<Trash2 />` quando `variant="destructive"`, `<Check />` quando `default`).
  2. Aplicar a matriz progressiva nos botões:
     - `statement-import-dialog.tsx:312-313`: `"Continuar conferindo"` → `"Continuar"` (`<ArrowLeft />`) | `"Descartar e voltar"` → `"Descartar"` (`<Trash2 />`).
     - `modal.tsx:113`: `"Continuar editando"` → `"Continuar"` (`<ArrowLeft />`) | `"Descartar"` (`<Trash2 />`).
     - `report-document-layout.tsx:158`: `"Emitir PDF mesmo assim"` → `"Emitir"` (`<Printer />`).
     - `appearance-tab.tsx:220`: `"Confirmar Restauração"` → `"Restaurar"` (`<RotateCcw />`).
     - `asset-detail-sheet.tsx:147`: `"Sim, excluir ativo"` → `"Excluir"` (`<Trash2 />`).
     - `active-devices-card.tsx:339`: `"Desconectar outros"` → `"Desconectar"` (`<LogOut />`).
     - `portfolio-snapshots-dialog.tsx:284`: `"Restaurar Fechamento"` → `"Restaurar"` (`<RotateCcw />`).
     - `activity-delete-dialog.tsx:52`: `"Excluir movimentação"` → `"Excluir"` (`<Trash2 />`).

### 2.4 Botões de confirmação no `LaunchWizardFooter` e `StatementImportDialog` sem ícone e sem adaptação progressiva
- **Arquivos e Linhas:**
  - `src/features/transactions/wizard/launch-wizard-footer.tsx`: linhas `28–64` (`"Salvar Transação"`, `"Confirmar lançamento"`)
  - `src/features/cards/components/statement-import/statement-import-dialog.tsx`: linhas `100–102` (`"Avançar para conferência"`)
  - `src/features/cards/components/statement-import/statement-mapping-fallback.tsx`: linhas `372–375` (`"Avançar para conferência"`)
- **Problema Atual:** Em 360px, `"Confirmar lançamento"` (20 chars) e `"Avançar para conferência"` (24 chars) estouram o slot de 50% do `ModalFooter` (`grid-cols-2`).
- **Solução Exata:**
  - `launch-wizard-footer.tsx`:
    - Modo rápido (linha 33): `<Check aria-hidden="true" />` + `<span className="hidden sm:inline">Salvar transação</span><span className="sm:hidden">Salvar</span>` (e `aria-label="Salvar transação"`).
    - Modo guiado (linha 52): `<Check aria-hidden="true" />` + `<span className="hidden sm:inline">Confirmar lançamento</span><span className="sm:hidden">Confirmar</span>` (e `aria-label="Confirmar lançamento"`).
  - `statement-import-dialog.tsx:100` e `statement-mapping-fallback.tsx:372`:
    - `<span className="hidden sm:inline">Avançar para conferência</span><span className="sm:hidden">Avançar</span>` + `<ArrowRight aria-hidden="true" />` (com `aria-label="Avançar para conferência"`).

### 2.5 Botões em `PageHeader` com `utilityActions` ao lado de `grid-cols-2` em 360px
- **Arquivos e Linhas:**
  - `src/components/layout/page-header.tsx`: linhas `70–84` e `124–128`
  - `src/features/cards/pages/cards-page.tsx`: linhas `77–95` (`PageGuideButton` + `"Importar fatura"` + `"Novo cartão"`)
  - `src/features/transactions/pages/transaction-list-page.tsx`: linhas `40–62` (`PageGuideButton` + `"Exportar CSV"` + `"Nova transação"`)
  - `src/features/debts/pages/debts-page.tsx`: linhas `25–43` (`"Novo contrato"` + `"Nova conta"`)
- **Problema Atual:** Quando `utilityActions` (32px + 8px gap = 40px) divide a linha mobile com `grid-cols-2` (`360px - 28px padding - 40px = 292px` → `142px` por botão), rótulos com ícone + 2 palavras (`"Importar fatura"`, `"Nova transação"`, `"Exportar CSV"`) ficam no limite de colisão ou transbordam em telas `< 375px`.
- **Solução Exata:** Adotar rótulos progressivos nos botões do `PageHeader`:
  - `cards-page.tsx`: `"Importar fatura"` → `min-[380px]:` `"Importar"` → `< 380px:` ícone `<FileUp />` (`aria-label="Importar fatura"` `title="Importar fatura"`); `"Novo cartão"` → `"Cartão"` (ou `"Novo"`).
  - `transaction-list-page.tsx`: `"Exportar CSV"` → `min-[380px]:` `"Exportar"` → `< 380px:` ícone `<Download />` (`aria-label="Exportar CSV"` `title="Exportar CSV"`); `"Nova transação"` → `"Novo"`.
  - `debts-page.tsx`: `"Novo contrato"` → `"Contrato"` (`<Coins />`); `"Nova conta"` → `"Conta"` (`<Plus />`).

### 2.6 Terceiro nível (ícone-only) no botão inline de `QuickAporteCard`
- **Arquivo:** `src/components/modules/quick-aporte-card.tsx`
- **Linhas:** `190–200`
- **Problema Atual:** Já implementa 2 níveis (`"Calcular Rebalanceamento"` em `sm:` e `"Calcular"` no mobile), porém em viewports de 320px–360px, o `MoneyInput` ao lado fica com largura reduzida quando o botão `"Calcular"` + ícone ocupa ~110px.
- **Solução Exata:** Adicionar o 3º nível para `< 380px`: `<span className="hidden sm:inline">Calcular Rebalanceamento</span><span className="hidden min-[380px]:inline sm:hidden">Calcular</span>` mantendo `<ArrowRight />` centralizado com `aria-label="Calcular Rebalanceamento"` e `title="Calcular Rebalanceamento"`, garantindo largura mínima `min-w-11` (44px) no mobile estreito.

---

## 3. Ergonomia Mobile & Modais

### 3.1 Auditoria de `autoFocus` e Foco Programático
- **Resultado (`autoFocus` declarativo):** **CONFORME (0 violações em produção).** Todas as ocorrências encontradas em `src/` são comentários documentando a proibição da Regra 20. O `<Modal />` (`src/components/ui/modal.tsx:268`) e o `DiscardConfirmDialog` (`modal.tsx:95`) bloqueiam `onOpenAutoFocus={(e) => e.preventDefault()}`.
- **Ponto de Atenção — Foco programático na Command Palette (`⌘K`):**
  - **Arquivo:** `src/components/ui/command.tsx`
  - **Linha:** `63` (`inputRef.current?.focus();`)
  - **Regra Afetada:** `DESIGN_RULES.md` §3.3 (*"Exceção única: Command Palette `⌘K` apenas em dispositivos com ponteiro fino `(pointer: fine)` no desktop"*).
  - **Problema Atual:** `command.tsx:63` foca o input incondicionalmente ao abrir, inclusive se acionado em telas touch/mobile, disparando o teclado virtual automaticamente.
  - **Solução Exata:** Guardar o foco com media query de ponteiro fino:
    ```ts
    if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus();
    }
    ```

### 3.2 Violação de Scroll Aninhado dentro de Modais e Cards (Regra 26)
- **Regras Violadas:** `AGENTS.md` Regra 26 e `DESIGN_RULES.md` §3.1 (*"É terminantemente proibido adicionar `overflow-y-auto`, `overflow-y-scroll`, `max-h-[*vh]` dentro dos elementos filhos passados ao `<Modal />`"*).
- **Achados Exatos:**
  1. `src/components/modules/split-charge/split-charge-installments.tsx:78` — `max-h-64 sm:max-h-72 overflow-y-auto no-scrollbar` dentro de card/modal de racha.
  2. `src/components/modules/split-charge/split-charge-participants.tsx:26` — `max-h-48 overflow-y-auto no-scrollbar` dentro de `SplitChargeCard` (que é exibido em modais e drawers).
  3. `src/components/modules/aporte-result/allocation-drift-bars.tsx:361` — `scrollable && "max-h-[250px] overflow-y-auto"` cria caixa de rolagem interna que trava o swipe vertical no mobile.
  4. `src/features/demo-tour/spotlight-step-card.tsx:80` — `max-h-[42vh] overflow-y-auto` usa `vh` estático (em vez de `dvh`, que sofre salto com a barra de endereços mobile).
- **Solução Exata:**
  - Em `split-charge-installments.tsx:78`, `split-charge-participants.tsx:26` e `allocation-drift-bars.tsx:361`: remover `max-h-* overflow-y-auto` quando montados dentro de `<Modal />`, delegando a rolagem ao `scrollRef` único do modal (ou usar paginação/expansão progressiva `"Ver todos (N)"` com `<Accordion>`/`Button`, conforme `DESIGN_RULES.md` M9).
  - Em `spotlight-step-card.tsx:80`: trocar `max-h-[42vh]` por `max-h-[42dvh] overscroll-contain`.

### 3.3 Tabelas Financeiras sem Contêiner de Rolagem Horizontal (Regra 25)
- **Regras Violadas:** `AGENTS.md` Regra 25 e `DESIGN_RULES.md` §4.1.
- **Achados Exatos:**
  1. `src/features/reports/components/consolidated-wealth/ConsolidatedBalanceSection.tsx:136–137` — `<div className="rounded-lg border border-border/80 overflow-hidden text-xs"><table className="w-full text-left border-collapse table-fixed">` usa `overflow-hidden` sem wrapper `overflow-x-auto`. Em 360px, a coluna `30%` de valor (`~90px`) esmaga números de 7+ dígitos.
  2. `src/features/reports/components/tax-facilitator/TaxBensDireitosSection.tsx:176–177` — `<div className="border-x border-b border-border/80 rounded-b overflow-hidden"><table className="w-full text-left text-xs border-collapse table-fixed">` com 3 colunas (`18% / 62% / 20%`). Em 360px, `20%` (`~60px`) é insuficiente para `"Situação em 31/12 (R$)"` e valores com `whitespace-nowrap`, sendo cortados pelo `overflow-hidden`.
- **Solução Exata:** Envolver ambas as tabelas com `<div className="w-full overflow-x-auto no-scrollbar scroll-smooth print:overflow-visible">` e atribuir `min-w-[420px] sm:min-w-full print:min-w-0` à `<table>`, mantendo legibilidade perfeita tanto no celular quanto na impressão A4.

### 3.4 Divergência de Geometria e Tipografia Anti-Zoom em `<Input />`
- **Arquivo:** `src/components/ui/input.tsx`
- **Linha:** `14`
- **Regra Afetada:** `DESIGN_RULES.md` §3.2 (*"Padding `px-3.5`, `shadow-xs`, Tipografia `text-base sm:text-sm`"*).
- **Problema Atual:** `input.tsx:14` utiliza `px-4 py-2 text-base shadow-sm` (sem `sm:text-sm`), ficando visualmente maior (16px no desktop) e com padding/sombra diferentes de `<Textarea />` (`px-3.5 text-base sm:text-sm shadow-xs`), `<Select />` e `<MoneyInput />` em grids de 2 colunas no desktop.
- **Solução Exata:** Alinhar `input.tsx:14` exatamente ao contrato de §3.2: `px-3.5 py-2 text-base sm:text-sm shadow-xs`.

---

## 4. Preferências Sensoriais & Coesão Visual

### 4.1 Auditoria de Áudio e Vibração (`sensory.ts`, `haptics.ts`, `audio-fx.ts`, `native/haptics.ts`)
- **Pontos Conformes (Blindagem Verificada):**
  - **0 chamadas diretas** a `navigator.vibrate`, `playSound`, `triggerHaptic`, `soundManager` ou `hapticsManager` fora de `src/services/`.
  - `src/services/haptics.ts:29–32, 68–101` verifica `isHapticsSupported()`, `hapticEnabled` (defesa em profundidade), throttle anti-concorrência (`60ms`) e envolve `navigator.vibrate(...)` em `try/catch` silencioso.
  - `src/services/audio-fx.ts:15–33, 42–162, 208–235` verifica `soundEnabled` (defesa em profundidade), faz fallback para `webkitAudioContext`, captura rejeições de `audioCtx.resume()` e envolve toda síntese em `try/catch` silencioso.
  - `src/services/native/haptics.ts:20–49` verifica `isNativePlatform()` e `hapticEnabled` com `try/catch` silencioso.

- **Achado S1 — Duplo Disparo Sensorial e Quebra de Silêncio no Reset de Aparência:**
  - **Arquivo:** `src/features/settings/components/tabs/appearance-tab.tsx`
  - **Linhas:** `132–138` e `216–224`
  - **Regras Violadas:** `AGENTS.md` Regra 17; `DESIGN_RULES.md` §5.2 (Leis 2 e 3).
  - **Problema Atual:** `handleResetDefaults` é passado ao `onConfirm` do `ConfirmDialog` (que já dispara `triggerSensory("success")` no `<Button>`). Dentro de `handleResetDefaults`, a linha 134 chama `visual.resetToDefaults()` (ligando `soundEnabled: true` e `hapticEnabled: true`) e logo em seguida a linha 138 chama `triggerSensory("action")`. Resultado: (a) **duplo disparo sensorial** no clique de confirmação; (b) se o usuário estava em modo `"discreet"` (silencioso), o reset dispara áudio/vibração indesejadamente antes mesmo de fechar o diálogo.
  - **Solução Exata:** Remover a linha 138 (`triggerSensory("action")`) de `handleResetDefaults`, deixando apenas o disparo único controlado pelo `<Button>` do `ConfirmDialog` (que respeita a preferência vigente antes do reset).

- **Achado S2 — Possível Duplo Disparo em `<Button>` customizado de `GoalCard`:**
  - **Arquivo:** `src/features/goals/components/goal-card.tsx`
  - **Linhas:** `55–58` e `124–132`
  - **Observação:** O botão `"Pública"` (linha 124) é um `<button>` nativo que chama `handleShareClick` (`triggerSensory("action")`), enquanto o botão `<Share2 />` irmão (linha 149) é um `<Button>` que já dispara sensorial internamente — OK. Porém, vale migrar o chip `"Pública"` para `<Chip sensoryIntent="action">` (DRY, `AGENTS.md` §4) em vez de `<button>` cru com classes manuais de pill (`rounded-pill bg-primary/12 px-2 py-1 text-[10px]`).

### 4.2 Governança de Cores & Contraste WCAG AA
- **Achado C1 — Uso de `text-portfolio` em vez de `text-portfolio-strong` em textos pequenos (Falha AA no Light Mode):**
  - **Arquivos e Linhas:**
    - `src/components/ui/money-text.tsx`: linha `54` (`portfolio: "text-portfolio"`)
    - `src/components/modules/kpi-card.tsx`: linha `35` (`portfolio: "text-portfolio"`)
  - **Regra Violada:** `DESIGN_RULES.md` §1.3 (*"Todo token semântico usado em texto deve usar `-strong` para garantir contraste mínimo 4.5:1 no Light Mode"*).
  - **Problema Atual:** O token `--portfolio-strong` (`#1B3A4B` no Light, `#38BDF8` no Dark) já está declarado em `tokens.css:52` e `globals.css:46`, mas `MoneyText` e `KpiCard` ainda apontam para `text-portfolio` (`#0284C7`), que não atinge 4.5:1 sobre `#FBFCFD` em textos pequenos (`caption`/`value`).
  - **Solução Exata:** Alterar `money-text.tsx:54` e `kpi-card.tsx:35` para `portfolio: "text-portfolio-strong"`.

- **Achado C2 — Cores hardcoded da paleta Tailwind padrão em componentes UI:**
  - **Arquivos e Linhas:**
    - `src/components/layout/notifications-button.tsx`: linhas `56` e `58` (`text-white`)
    - `src/components/modules/reports/report-risk-gauge.tsx`: linhas `71` e `76` (`border-white dark:border-surface`)
    - `src/components/modules/credit-card/credit-card-parts.tsx`: linhas `50–51`, `60–61`, `68`, `76` (`bg-rose-500/90`, `bg-amber-400/90`, `text-sky-400`, `text-purple-300`)
  - **Regra Violada:** `DESIGN_RULES.md` §1.5.
  - **Solução Exata:**
    - Em `notifications-button.tsx:56,58`: substituir `text-white` por `text-primary-foreground` (ou token `text-critical-foreground`/`text-warning-foreground`).
    - Em `report-risk-gauge.tsx:71,76`: substituir `border-white dark:border-surface` por `border-surface`.
    - Em `credit-card-parts.tsx`: centralizar as cores oficiais das bandeiras (Mastercard/Elo/Amex/Nubank) em `credit-card-gradient.ts` (exceção técnica documentada em `DESIGN_RULES.md` §1.5 item 3).

### 4.3 Hierarquia Tipográfica, Bordas e Affordance
- **Achado T1 — Micro-tipografia proibida (`< 10px`) em telas de Relatórios e Snapshots:**
  - **Arquivos e Linhas:**
    - `src/features/reports/components/consolidated-wealth/ConsolidatedBalanceSection.tsx`: linha `130` (`text-[8.5px]`)
    - `src/features/reports/components/tax-facilitator/TaxBensDireitosSection.tsx`: linhas `160`, `166`, `170`, `184`, `198` (`text-[8.5px]` e `text-[9px]`)
    - `src/features/reports/components/dividend-freedom-modal.tsx`: linha `194` (`text-[9px]` em `grid-cols-5` rígido!)
    - `src/features/investments/components/snapshots/snapshots-ledger-table.tsx`: linhas `68–100` (`text-[9px]`)
    - `src/components/modules/reports/report-equity-class-table.tsx`: linhas `214`, `221` (`text-[9px]`)
    - `src/components/modules/reports/report-header.tsx`: linha `233` (`text-[9.5px]`)
  - **Regra Violada:** `DESIGN_RULES.md` §2.3 (*"É proibido usar tamanhos `text-[8px]`, `text-[8.5px]` ou `text-[9px]` em qualquer interface de tela"*).
  - **Solução Exata:** Elevar todos os tamanhos em tela para no mínimo `text-[10px]` (ou `text-[11px]` em metadados/legendas), restringindo fontes menores exclusivamente ao prefixo `print:` (`print:text-[8.5px]`) para impressão A4. Em `dividend-freedom-modal.tsx:194`, trocar `grid-cols-5 text-[9px]` por `grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]`.

- **Achado T2 — Classes ad-hoc em `<Badge />` e opacidades de borda divergentes:**
  - **Arquivos e Linhas:**
    - `src/components/modules/aporte-result/aporte-desktop-table.tsx`: linha `148` (`<Badge size="xs" className="font-mono text-[10px] shrink-0">`)
    - `src/features/family/components/household-wealth-card.tsx`: linha `221` (`<Badge size="xs" className="uppercase font-mono text-[10px]">`)
    - `src/components/modules/snowball-action-card.tsx`: linha `55` (`border-border/50`)
  - **Regras Violadas:** `AGENTS.md` Regras 14 e 16.
  - **Solução Exata:** Remover `text-[10px]` redundante nos `<Badge size="xs" />` (já incluído pela variante) e normalizar a borda de `snowball-action-card.tsx:55` para `border-border/80`.

- **Achado T3 — Falsa affordance de hover em `KpiCard` estático:**
  - **Arquivo:** `src/components/modules/kpi-card.tsx`
  - **Linha:** `96`
  - **Regra Violada:** `DESIGN_RULES.md` §1.4 (*"Cards estáticos (não clicáveis) não mudam de sombra ou borda no `:hover`"*).
  - **Problema Atual:** `hover:border-border` é aplicado incondicionalmente no `className` mesmo quando `onClick` é `undefined`.
  - **Solução Exata:** Condicionar `onClick && "hover:border-primary/30 cursor-pointer"` e remover `hover:border-border` de cards informativos estáticos.

### 4.4 Loading Skeletons & Estados de Carregamento
- **Achado L1 — Rotas sem Skeleton estrutural dedicado em `RouteSkeletonFallback`:**
  - **Arquivo:** `src/components/layout/route-skeletons/route-skeleton-fallback.tsx`
  - **Linhas:** `29–72`
  - **Regra Violada:** `AGENTS.md` Regra 34 e `DESIGN_RULES.md` §3.3.
  - **Problema Atual:** As rotas `/negocio` (`BusinessPage`, que exibe DRE + Break-even + MEI + extrato) e `/assinatura` não possuem mapeamento explícito em `RouteSkeletonFallback`, caindo no fallback genérico `<OverviewSkeleton />` e provocando CLS na transição.
  - **Solução Exata:** Mapear `path.startsWith("/negocio")` (e `/business`) para um `BusinessSkeleton` (ou `ReportsSkeleton` provisoriamente) e `path.startsWith("/assinatura")` para `SettingsSkeleton`.

- **Achado L2 — Spinner ad-hoc em vez de `<ContentLoading />` no Modal 2FA:**
  - **Arquivo:** `src/features/settings/components/mfa-modal.tsx`
  - **Linhas:** `170–173`
  - **Regra Violada:** `AGENTS.md` Regra 34 (Nível 3 — usar exclusivamente `<ContentLoading />` em modais sem skeleton próprio).
  - **Problema Atual:** Renderiza manualmente `<div className="flex flex-col items-center justify-center py-8 space-y-3"><Loader2 className="size-6 animate-spin text-muted-foreground" /><span>Carregando status de segurança...</span></div>`.
  - **Solução Exata:** Substituir pelo primitivo canônico `<ContentLoading label="Carregando status de segurança..." />`.

### 4.5 Bloqueio contra Clique Duplo durante Salvamento
- **Achado D1 — `ConfirmDialog` sem `loading={confirmPending}` e sem bloquear Cancelar:**
  - **Arquivo:** `src/components/ui/confirm-dialog.tsx`
  - **Linhas:** `45–56`
  - **Problema Atual:** O botão de confirmar passa apenas `disabled={confirmPending}` sem `loading={confirmPending}` (perdendo `aria-busy="true"` e o feedback visual `Loader2` nativo do `<Button />`), e o botão Cancelar (linha 45) permanece clicável durante uma mutação em andamento.
  - **Solução Exata:** Passar `disabled={confirmPending}` no botão Cancelar e `loading={confirmPending}` no botão Confirmar.

- **Achado D2 — Botões `type="submit"` sem trava de `disabled`/`loading`:**
  - **Arquivos e Linhas:**
    - `src/features/cards/components/statement-import/statement-import-dialog.tsx`: linha `100` (`<Button type="submit" form={mappingFormId}>`) — não recebe `disabled={state.isPending}` nem `loading={state.isPending}`.
    - `src/features/cards/components/statement-import/statement-mapping-fallback.tsx`: linha `372` (`<Button type="submit">`) — sem prop `isSubmitting` / `disabled`.
    - `src/components/modules/quick-aporte-card.tsx`: linha `190` (`<Button type="submit">`) — permite cliques repetidos mesmo com `aporteCents <= 0`.
  - **Solução Exata:** Encaminhar estado `pending`/`isSubmitting` para `disabled` + `loading` em `statement-import-dialog.tsx:100` e `statement-mapping-fallback.tsx:372`; em `quick-aporte-card.tsx:190`, adicionar `disabled={aporteCents <= 0}` (ou feedback imediato no `FormField`).

- **Achado D3 — `LaunchWizardFooter` sem `loading={pending}` (`aria-busy`):**
  - **Arquivo:** `src/features/transactions/wizard/launch-wizard-footer.tsx`
  - **Linhas:** `32–34` e `51–53`
  - **Problema Atual:** Usa `disabled={!canSubmitQuick || pending}` com troca manual de string (`pending ? "Salvando…" : "Salvar Transação"`), sem passar `loading={pending}` nem `aria-busy`.
  - **Solução Exata:** Passar `loading={pending}` (ou `aria-busy={pending}`) mantendo `disabled={!canSubmitQuick || pending}` para feedback visual e acessibilidade consistentes com o restante do Design System.

### 4.6 Empty States sem Ação Clara (CTA)
- **Regra Afetada:** `AGENTS.md` §5 e `DESIGN_RULES.md` §3.3 (*"EmptyState dedicado com descrição curta e CTA objetivo quando houver ação recuperável"*).
- **Achados Exatos (Estados vazios acionáveis sem `action`):**
  1. `src/features/cards/components/statement-import/statement-reconcile-step.tsx:279` — Quando `searchQuery.trim()` não encontra resultados, exibe `<EmptyState title="Nenhum lançamento encontrado" description="Tente buscar por outro nome ou valor." />` **sem botão `"Limpar busca"`**.
  2. `src/features/family/components/household-clustering-ranking.tsx:51` — `"Nenhuma despesa familiar registrada"` sem CTA para registrar a primeira despesa compartilhada.
  3. `src/features/family/components/household-comparison-card.tsx:104` — `"Nenhum gasto para comparar"` sem CTA para lançar despesa ou ajustar filtro de período.
  4. `src/features/investments/components/asset-detail/asset-transactions-timeline.tsx:77` — `"Nenhuma operação registrada"` sem CTA direto `"Registrar operação"`.
  5. `src/features/investments/components/allocation-breakdown-dialog.tsx:349` e `489` — `"Sem setores definidos"` e `"Nenhum ativo alocado"` sem CTA para abrir metas/cadastro de ativo.
- **Solução Exata:** Adicionar prop `action={<Button size="sm" variant="solid" ...>...</Button>}` (ou `variant="outline"` para `"Limpar busca"` em estados filtrados) mantendo `tone="default"` conforme `DESIGN_RULES.md` §3.3 e M3.

---

## 5. Roadmap Priorizado de Execução

| Prioridade | Lote de Polimento | Arquivos Alvo | Impacto em Mobile (360px) |
|---|---|---|---|
| **P0 — Imediato** | Eliminar `truncate` em `<MoneyText />` e `grid-cols-3` rígidos | `aporte-cockpit-command-card.tsx`, `aporte-summary-section.tsx`, `report-kpi-grid.tsx`, `invoice-competence-toolbar.tsx` | Elimina 100% dos cortes de valores monetários e estouros de toolbar. |
| **P0 — Imediato** | Responsividade progressiva de botões + fix `ModalFooter` | `modal-footer.tsx`, `confirm-dialog.tsx`, `modal.tsx`, `launch-wizard-footer.tsx`, `statement-import-dialog.tsx`, `page-header.tsx` | Elimina estouro de rótulos longos em `grid-cols-2` e padroniza 3 níveis (Texto → Palavra → Ícone). |
| **P1 — Alto** | Ergonomia de modais, tabelas e contraste AA | `ConsolidatedBalanceSection.tsx`, `TaxBensDireitosSection.tsx`, `split-charge-*.tsx`, `money-text.tsx`, `kpi-card.tsx`, `appearance-tab.tsx`, `command.tsx` | Zero scroll duplo em modais, tabelas 100% roláveis, contraste AA no Light Mode e zero duplo-háptico. |
| **P2 — Médio** | Coesão visual, skeletons, double-click e empty states | `route-skeleton-fallback.tsx`, `mfa-modal.tsx`, `input.tsx`, `transaction-row.tsx`, `SystemNotificationRows.tsx`, `dividend-freedom-modal.tsx`, `EmptyState`s | Estabilidade CLS, tipografia $\ge 10\text{px}$, bloqueio de submit e CTAs claros. |

> **Quality Gate Pós-Implementação (conforme `AGENTS.md` §10):** Ao executar as correções deste relatório, validar obrigatoriamente com `npm run verify` (`typecheck` + `lint` + testes unitários) e inspeção visual em **360px**, **390px**, **768px** e **1280px** nos temas **Light**, **Dark** e **OLED**.
