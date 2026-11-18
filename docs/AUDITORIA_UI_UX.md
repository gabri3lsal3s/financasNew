# AUDITORIA_UI_UX.md — Inventário Exaustivo de Padronização, Refatoração e Faxina do Axir

> **Status de Execução:** **Concluído (100% das Ondas 1, 2, 3 e 4 executadas)**.
> **Escopo Auditado:** Varredura estática e inspeção linha por linha de **100% do código de produção** (`978` arquivos `.ts`/`.tsx` + folhas de estilo globais em `src/styles/` + `index.html`), confrontados com o contrato oficial [`docs/DESIGN_RULES.md`](./DESIGN_RULES.md) e com as regras de governança (`AGENTS.md`).
>
> **Resumo da Entrega Finalizada:**
> - **Onda 1 (Fundação & Faxina):** `[Concluído]` — Código morto removido (`content-loading.tsx`, `filter-toolbar.tsx`, `use-feature-flag.ts`, `use-apk-promo.ts`, `storage-migration.ts`, `use-app-mode.ts` e CSS legado), tokens Dark/OLED/Light + `@custom-variant dark` + `--portfolio-strong`/`--portfolio-foreground` + densidade `compact` + flat shadows em `tokens.css`/`globals.css`, blindagem sensorial 100% opt-out em `audio-fx.ts`, `haptics.ts` e `sensory.ts`, primitivos UI (`Modal` unificando `ResponsiveDialog`, `NumberStepper` unificado sem `.num`, `Accordion` nativo WAI-ARIA, `Switch`, `Checkbox`, `ColorPicker`, `DatePicker`, `NumericInput`, `PercentInput`, `Select`, `Button`, `Card`, `Tabs`, `PageHeader`, `BottomNav`, `Sidebar`, `AppErrorBoundary`, `LogoProfileButton`, `RouteSkeletonFallback`), serviço `receipt-resolution.ts`, `buildPixTransferCode`, `formatAssetQuantity` e remoção de `@/data` das camadas de UI.
> - **Onda 2 (Modais, Drawers e Formulários):** `[Concluído]` — 100% dos modais/drawers de Overview, Viagens, Família, Transações/Calculadora/Wizard/Racha, Cartões, Dívidas/Empréstimos (incluindo correção 100x de taxa em `loan-form-dialog` e `early-amortization-dialog`), Orçamentos, Investimentos (`QuickTransactionSheet`, `InvestmentWizard`, `AssetDetailSheet`, `AssetEditDialog`, `InitialPocketCostDialog`, `PortfolioImportDialog`, `PortfolioSnapshotsDialog` com `ReportDocumentLayout`, `MonthlyClosingEditor`), Relatórios, Metas, Insights, Lembretes, Configurações, Tour/Onboarding, Suporte e Admin padronizados (`footer={<ModalFooter borderless />}`, `showCalculator`, zero `autoFocus`, `< 240` linhas por arquivo UI/hook).
> - **Onda 3 (Páginas, Cards, Gráficos e Tabelas):** `[Concluído]` — Modularização completa (`< 240` linhas nos arquivos de UI/hooks) e responsividade Mobile (`< 768px`, alvos `>= 44px`), Tablet (`768px–1024px`) e Desktop (`> 1024px`) em todos os módulos (`overview`, `trips`, `family`, `transactions`, `cards`, `debts`, `budgets`, `investments`, `goals`, `insights`, `reports`, `reminders`, `settings`, `auth`, `subscription`, `landing`, `tools`, `legal`, `public-share`, `admin`), incluindo preservação integral dos ajustes solicitados na Home (sem cabeçalho "Visão Geral" e card de saldo disponível com `shadow-xs` limpo).
> - **Onda 4 (Validação Técnica Final):** `[Concluído]` — Zero ocorrências de `autoFocus`, `@/data` em `features/`/`components/`, chamadas sensoriais diretas fora de `src/services/`, `<select>`/`<input>` crus fora de `src/components/ui/` e tokens fantasmas (`shadow-2xs`, `xs:`, `*-danger*`); zero warnings de `export *`; `tsc --noEmit`, `npm run typecheck`, `npm run lint`, `npm test -- --run` e `npm run build` validados.

> **Legenda de Ações Recomendadas:**
> - **`[Padronizar]`** — Ajustar tokens visuais, tipografia, espaçamento, responsividade, acessibilidade ou feedback sensorial ao contrato da Bíblia Visual.
> - **`[Refatorar]`** — Quebrar arquivo monolítico (`> 250` linhas), corrigir defeito funcional/arquitetural ou isolar responsabilidades entre `domain/`, `state/` e `features/`.
> - **`[Unificar]`** — Consolidar componentes, modais, hooks ou utilitários duplicados em uma única fonte da verdade reutilizável (DRY).
> - **`[Excluir]`** — Remover código morto, arquivos órfãos, classes CSS sem uso, props mortas ou banners/elementos obsoletos que geram poluição visual.

---

## 0. SUMÁRIO EXECUTIVO — PADRÕES SISTÊMICOS TRANSVERSAIS

Antes do detalhamento módulo a módulo, a varredura automatizada + leitura manual revelou **8 desvios sistêmicos transversais** que se repetem em múltiplos módulos e devem ser atacados na base:

1. **Tokens Tailwind v4 Fantasmas (`150+` ocorrências sem efeito CSS):** classes usadas no JSX que **não existem** em `src/styles/tokens.css` nem no `@theme inline` de `src/styles/globals.css` — incluindo `shadow-2xs`, `bg-surface-subtle`, `bg-surface-muted`, `bg-danger`, `text-danger`, `bg-danger-surface`, `border-danger-border`, `bg-primary-hover`, `text-primary-hover`, `text-portfolio-strong`, `text-portfolio-foreground`, `text-success`, `border-destructive`, `bg-warning-surface`, `bg-warning-subtle` e o breakpoint inexistente `xs:` (`hidden xs:inline`, que oculta elementos em 100% das telas).
2. **Variáveis HSL Triplet Passadas Sem `hsl(...)` (`7` ocorrências críticas):** como os tokens CSS guardam triplas puras (`173 58% 39%`), passar `var(--primary)` ou `var(--positive)` direto em `style={{ backgroundColor }}` ou atributos SVG `stroke`/`stopColor` gera CSS inválido (invisível) em `credit-card-wallet.tsx`, `cycle-obligations-dialog.tsx`, `household-clustering-ranking.tsx` e `fire-projection-curve.tsx`.
3. **Vazamento de Dados no Modo Privacidade (`html[data-privacy="masked"]`):** dezenas de telas renderizam `formatCentsAsBRL(...)`, `formatCentsAsCurrency(...)` ou `.toLocaleString("pt-BR")` em `<span>`/`<p>` comuns sem `<MoneyText />` e sem a classe `.num` — deixando saldos, faturas no Cartão 3D, limites, encargos e cotas de racha **totalmente legíveis em texto aberto** mesmo com o Escudo de Privacidade ativo, além de perder `tabular-nums`.
4. **Anatomia Quebrada de `<Modal />` + `<ModalFooter />` (`81` ocorrências):**
   - **Erro Tipo A (`65` ocorrências):** `<ModalFooter>` renderizado **dentro do corpo rolável (`children`/`<form>`)** em vez da prop `footer` do `<Modal />`, fazendo os botões *Cancelar/Salvar* rolarem para fora da vista no mobile.
   - **Erro Tipo B (`16` ocorrências):** `<Modal footer={<ModalFooter>}>` sem `borderless={true}`, gerando **duas bordas superiores empilhadas** + `mt-6 pt-4` (`+40px` de espaço morto no rodapé).
   - **Calculadora ausente (`18` modais):** modais contendo `<MoneyInput />` que esqueceram de passar `showCalculator` ao `<Modal />` (e `2` modais exibindo calculadora em passos sem `MoneyInput`).
5. **Risco de Auto-Zoom no iOS Safari (`47` ocorrências):** `<Input />`, `<Textarea />` e `<Select />` com `text-xs` (`12px`) ou `text-sm` (`14px`) sem prefixo responsivo no mobile (`< 640px`), forçando o WebKit do iPhone a aplicar zoom automático e desalinhando modais.
6. **Falha na Blindagem Sensorial & Epidemia de Duplos Disparos (`40+` ocorrências):**
   - `src/services/audio-fx.ts` (`playSound`) **não verifica** `getVisualCustomization().soundEnabled` internamente; `src/services/native/haptics.ts` (`triggerNativeHaptic`) **não verifica** `hapticEnabled`; e selecionar o modo `"Discreto (Silencioso)"` dispara som/vibração *antes* de mutar o estado.
   - O primitivo `<Button />` já emite `triggerSensory` no clique, mas dezenas de handlers `onClick` chamam `triggerSensory(...)` novamente (gerando *double-haptic* e som sobreposto).
7. **Violações de Arquitetura de Camadas (`32` ocorrências):** `28` componentes em `src/components/modules/` importando `@/state` ou `@/features`, e `4` componentes de UI (`add-trip-expense-dialog.tsx`, `edit-trip-expense-dialog.tsx`, `launch-wizard.tsx`, `expense-detail-dialog.tsx`) importando repositórios diretamente de `@/data/repositories/*`!
8. **Controles Interativos Aninhados Inválidos (`22+` ocorrências WCAG/HTML5):** `<Link><Button>...</Button></Link>` (`<a>` envolvendo `<button>`), `<button>` envolvendo `<span role="button">` (`DatePicker`) e `<div onClick>` envolvendo `<Checkbox onCheckedChange>` sem `stopPropagation` (causando **bug de duplo toggle onde o checkbox não marca** em `emergency-fund-config-dialog.tsx` e `batch-invoice-payment-dialog.tsx`).

---

## MÓDULO 1: Estilos Globais, Primitivos UI, Layout & Serviços Compartilhados

### Prioridade Alta

- **`src/services/audio-fx.ts` (L203–235), `src/services/haptics.ts` (L67–78), `src/services/native/haptics.ts` (L16–45) e `src/services/sensory.ts` (L47–97)** — **`[Refatorar]`**
  - *Sensorial / Preferências:* `soundManager.play()` / `playSound()` assume `enabled = true` por default e **nunca consulta** `getVisualCustomization().soundEnabled`, permitindo emissão sonora indevida se invocado diretamente; `triggerNativeHaptic()` também não verifica `hapticEnabled`; `sensory.ts` reexporta `soundManager` e `hapticsManager`, expondo camadas internas. Blindar ambas as camadas baixas com checagem incondicional das preferências do usuário e restringir o consumo externo exclusivamente a `triggerSensory` / `useSensory`.
- **`src/styles/tokens.css` (L17–52, L179–210, L388–394) e `src/styles/globals.css` (L14–91)** — **`[Padronizar]`**
  - *Tokens Visuais, `@custom-variant dark` e Conforto Ocular:* (1) Ausência de `@custom-variant dark (&:where([data-theme="dark"], [data-theme="oled"], [data-theme="dark"] *, [data-theme="oled"] *));` em `globals.css` — no Tailwind v4, `dark:*` responde por padrão ao `@media (prefers-color-scheme: dark)` do SO e **não** a `html[data-theme]`, quebrando o contraste quando o SO está em Dark Mode e o usuário escolhe Tema Claro (ou agendamento diurno); (2) Ausência dos tokens `--portfolio-strong` e `--portfolio-foreground`, quebrando `button-variants.ts` (`text-portfolio-strong`) e `cumulative-renewal-card.tsx` (contraste `1.2:1`); (3) `html[data-surface-style="flat"]` (L388) esquece de zerar `--shadow-xl` e `--shadow-2xl`; (4) `--surface` no Light Mode usa `#FFFFFF` puro e `--foreground` no OLED / `index.html` usa `#FAFAFA`/`#FFFFFF` puro sobre `#000000` (ajustar conforme `DESIGN_RULES.md` §1.2); (5) `html[data-density="compact"]` não possui nenhuma regra CSS em `globals.css` (preferência 100% placebo).
- **`src/components/ui/switch.tsx` (L30–34, L65–78), `src/components/ui/checkbox.tsx` (L18, L32–38), `src/components/ui/color-picker.tsx` (L93–130, L167, L189) e `src/components/ui/icon-picker.tsx` (L93–122)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bugs Críticos em Controles de Formulário:*
    - `switch.tsx:65–78`: `<label htmlFor={switchId}>` aninhado dentro de `<div onClick={handleClick}>` causa **duplo toggle + duplo disparo sensorial** ao clicar no texto do rótulo (o clique borbulha para a `div` e o navegador dispara um 2º clique sintético no `<button id={switchId}>`); além de `switchId` derivado de texto colidir (usar `React.useId()`).
    - `checkbox.tsx:32–38`: `data-[state=checked]:bg-primary-strong` com `<Check className="text-primary-foreground" />` perde contraste no `accent="monochrome"` Dark/OLED (`--primary-strong` é `#FFFFFF`); usar `bg-primary text-primary-foreground` e `React.useId()`.
    - `color-picker.tsx`: aninha `<span role="button">` de limpar dentro do `<button>` trigger (L93–130, violação WCAG); `<Check className="text-white" />` fica invisível sobre swatches claros ouro `#F3C352` e menta `#2DD4BF` (L167, contraste `~1.5:1`); `id="color-picker-hex"` estático e `text-sm` no mobile (L180–189, auto-zoom iOS).
    - `icon-picker.tsx:93–122`: `text-sm` no input de busca no mobile (auto-zoom iOS) e `role="radiogroup"` sem navegação por setas.
- **`src/components/layout/bottom-nav.tsx` (L20–80, L82–102, L178)** — **`[Refatorar]` / `[Padronizar]`**
  - *Desvios Visuais e UX:* (1) Na L178 usa `bg-danger` (**token inexistente** — ponto de alerta urgente no botão "Mais" fica invisível); (2) `getFabAction` (L20–80) não trata `/viagens`, `/viagens/:id`, `/familia` nem `/metas`, abrindo `LaunchWizard` pessoal dentro de uma viagem compartilhada; (3) Não implementa `scrollToTop` ao tocar na aba já ativa (apesar de documentado no Design System); (4) Em tablets (`768px–1023px`), `max-w-md` espreme os 5 ícones no centro de uma barra de `1024px`.
- **`src/components/layout/sidebar.tsx` (L139–180, L268, L313, L346)** — **`[Padronizar]`**
  - *Desvios Visuais e Responsividade:* (1) Botões de upgrade nas L268 e L313 são `<button>` crus com fundo sólido `bg-primary` (violando estilo discreto de botões), altura `h-7` (`28px`) e tokens inexistentes `hover:bg-primary-hover` + `shadow-2xs`; (2) `NavLink` não aciona `scrollToTop` quando já está na rota ativa; (3) Botão `Recolher` (L346) não possui `cursor-pointer` nem feedback sensorial.
- **`src/components/layout/app-error-boundary.tsx` (L89) e `src/components/layout/logo-profile-button.tsx` (L140, L142, L171, L199, L258)** — **`[Padronizar]`**
  - *Desvios Visuais:* `app-error-boundary.tsx:89` usa `bg-danger-surface text-danger` (tokens inexistentes — ícone de erro perde cor/fundo); `logo-profile-button.tsx` usa `text-danger hover:bg-danger-surface` no botão "Sair" (L258), `bg-surface-subtle/60` (L140), `shadow-2xs` (L171, L199), `text-white` hardcoded (L142) e `<Modal>` sem `footer` (L132).
- **`src/components/ui/button.tsx` (L99–103) e `src/components/ui/button-variants.ts` (L22, L25–30)** — **`[Padronizar]`**
  - *Desvios Visuais e Mobile:* (1) Variante `portfolio` usa `text-portfolio-strong` inexistente; (2) No mobile (`< 640px`), `default` cai para `h-9` (`36px`) e `icon` cai para `size-9` (`36×36px` — menor que os `44×44px` exigidos no toque móvel e invertido em relação ao desktop `40px`); (3) Quando `loading={true}` em `size="icon"`, renderiza `<span>Carregando...</span>`, estourando botões quadrados de ícone.
- **`src/components/ui/select.tsx` (L48), `src/components/ui/date-picker.tsx` (L371–411), `src/components/ui/numeric-input.tsx` (L122–133) e `src/components/ui/percent-input.tsx` (L120)** — **`[Padronizar]` / `[Refatorar]`**
  - *Formulários, Acessibilidade e Calculadora:*
    - `select.tsx:48`: usa `text-sm` (`14px`) fixo no mobile enquanto `Input`/`MoneyInput`/`DatePicker` usam `text-base` (`16px`), criando desalinhamento tipográfico em grids de 2 colunas e risco de zoom no iOS.
    - `date-picker.tsx:383–395`: aninha `<span role="button">` de limpar data **dentro** do `<button>` trigger (violação WCAG `nested-interactive` e alvo de `20×20px`), além de usar `z-modal` no `PopoverContent` (L410) em vez de `z-floating-tools`.
    - `numeric-input.tsx:126–133`: dispara `CustomEvent("calculator:open")` paralelo em vez de `setCalculatorOpen(true)` e **esquece de chamar `registerCalculatorTarget(decimalTarget)` no `onClick` do ícone da calculadora**, abrindo a calculadora desconectada se o campo ainda não tinha foco.
    - `percent-input.tsx:120`: falta `tabular-nums` e usa `px-3 shadow-xs` divergente de `px-4 shadow-sm` do `Input`.
- **`src/components/ui/skeleton.tsx` (L432–466)** — **`[Padronizar]`**
  - *UX / Zero CLS:* `RouteSkeletonFallback` não mapeia `/viagens`, `/familia` / `/modo-familia`, `/insights` nem `/lembretes` (caindo erroneamente em `OverviewSkeleton`), e `SettingsSkeleton` renderiza 4 abas enquanto `SettingsPage` possui 6 abas.

### Prioridade Média

- **`src/components/ui/modal.tsx` (L1–461) e `src/components/ui/responsive-dialog.tsx` (L1–75)** — **`[Unificar]` / `[Refatorar]`**
  - *Duplicidade e Anatomia:* `ResponsiveDialog` é um wrapper redundante de 25 linhas sobre `Modal` sem suporte a `destructiveAction`, `modal` ou `dataTour`, dividindo o app entre dois contratos de diálogo. Unificar tudo em `<Modal />` (fazendo o slot `footer` suprimir automaticamente `mt-6 pt-4 border-t` de `<ModalFooter>` filho para eliminar de vez o Erro Tipo B de borda dupla).
- **`src/components/ui/number-stepper.tsx` (L1–61) e `src/components/ui/number-stepper-input.tsx` (L1–212)** — **`[Unificar]` / `[Padronizar]`**
  - *Duplicidade, Bug de Modo Privacidade e Sensorial:* (1) Dois componentes de stepper concorrentes; (2) Em `number-stepper.tsx:48`, o `<span>` do valor usa a classe `.num` — como `globals.css` borra `.num` em `html[data-privacy="masked"]`, **o Modo Privacidade borra o número de parcelas, dia de fechamento e dia de vencimento** nos formulários! (3) Em `NumberStepperInput`, usa `<input type="text">` cru (L167), botões `size-9` (`36px`) ao lado de `h-10` (`40px`), e segurar o botão (`HOLD_INTERVAL_MS = 100`) dispara `triggerSensory("selection")` 10 vezes por segundo. Unificar em um único `<NumberStepper editable? />` com `tabular-nums` (sem `.num`).
- **`src/components/ui/filter-chips.tsx` (L25, L79, L88) e `src/components/ui/data-list.tsx` (L45, L51–105)** — **`[Padronizar]`**
  - *Contraste e Densidade:* `filter-chips.tsx:25` usa `bg-warning-strong text-white` (no Dark/OLED `#F59E0B` sob branco tem contraste ilegível `2.15:1`), `h-6`/`h-7` com `flex-wrap` e `text-[10px]`; `data-list.tsx` ignora a preferência global `visual.density`, não dispara `triggerSensory("selection")` em `onRowClick` (L76) e esmaga 4+ colunas `flex-1` sem `min-w` no mobile.
- **`src/components/ui/textarea.tsx` (L12–33)** — **`[Padronizar]`**
  - *Formulários DRY:* Reimplementa `label` e `error` próprios (`text-xs text-critical` sem `role="alert"` e `border-critical` em vez de `text-[11px] text-critical-strong` do `<FormField />`), com `px-3` em vez de `px-3.5`/`px-4`.
- **`src/components/ui/card.tsx` (L11–16, L34, L42)** — **`[Padronizar]`**
  - *Conforto Visual e Mobile:* Variante `default` aplica `hover:shadow-sm hover:border-border` mesmo em cards estáticos não clicáveis; mantém variantes obsoletas/proibidas `glass` e `elevated` em cards de dados; `CardHeader` e `CardContent` fixam `p-5` (`20px`) sem redução `p-4 sm:p-5` no mobile.
- **`src/components/ui/tabs.tsx` (L118, L124)** — **`[Padronizar]`**
  - *Tipografia e Tokens:* Usa `text-xs sm:text-sm` (`12px` no mobile em vez de `14px` uniforme) e `data-[state=active]:shadow-black/5` hardcoded em vez de `shadow-xs`.
- **`src/components/layout/page-header.tsx` (L65, L73, L88)** — **`[Padronizar]`**
  - *Responsividade Mobile:* Botão voltar tem `size-8` (`32×32px` < `44px`); `<h1>` usa `truncate` em linha única (cortando títulos longos em `360px` em vez de `line-clamp-2`); container `actions` usa `flex flex-wrap` simples em vez do grid proporcional `grid-cols-2` no mobile quando recebe 2 botões.
- **`src/components/layout/more-menu-sheet.tsx` (L61, L121, L148, L172, L181–204) e `src/components/layout/logo-full.tsx` (L133)** — **`[Padronizar]`**
  - *Tokens:* `more-menu-sheet.tsx` usa `bg-surface-subtle` inexistente em 3 blocos e promove "APK Android Pro" mesmo no iOS/Desktop; `logo-full.tsx:133` usa paleta Tailwind hardcoded (`bg-amber-500/15 text-amber-600 border-amber-500/30 text-[9px]`).

### Prioridade Baixa

- **`src/styles/globals.css` (L390–491, L576–588, L619–621, L680–726)** — **`[Excluir]` / `[Padronizar]`**
  - *CSS Morto:* `14` classes `.icon-*` e `.icon-box-*` (`0` usos em todo o app), `.glow-primary`, `.spring-press`, `.z-base`, `.animate-live-pulse`, `.app-header`, `.modal-overlay`, `.dialog-overlay`, `.toaster`, `.print-hidden` (`0` usos) e bloco comentado de 47 linhas do Tailwind v3 (L680–726). Já `.pt-safe`/`.pb-safe` existem prontos em `globals.css`, mas `0` componentes os utilizam (repetindo `pt-[max(env(...))]` inline 15+ vezes — padronizar para `.pt-safe`/`.pb-safe`).
- **`src/components/ui/content-loading.tsx`, `src/components/ui/filter-toolbar.tsx`, `src/hooks/use-feature-flag.ts`, `src/hooks/use-apk-promo.ts`, `src/lib/storage-migration.ts`, `src/state/queries/use-app-mode.ts`** — **`[Excluir]`**
  - *Código Morto Confirmado:* `0` importações em qualquer arquivo de produção (ver Seção Consolidada A).

---

## MÓDULO 2: Dashboard, Visão Geral & Patrimônio (`overview` + Módulos da Home)

### Prioridade Alta

- **`src/features/overview/pages/overview-page.tsx` (909 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Colisão de Modais no 1º Login (L604–615):* Monta simultaneamente `<WelcomeModal open={welcomeModalOpen} />` e `<WelcomeFeatureModal />` auto-gerenciado, abrindo **dois modais empilhados** para novos usuários.
  - *Desvios Visuais, Privacidade e Poluição Cognitiva:* (1) Sem `<PageHeader />` (usa `<h1 className="sr-only">`); (2) Cores `#64748b` hardcoded (L300, L358); (3) Alerta inline `corporate-dividends-alert` (L515) formata moeda com `.toLocaleString` dentro de `<p className="truncate">` (**vaza no Modo Privacidade** e aplica reticências em valor monetário); (4) `<ActiveTripBanner>` (L418) não recebe `totalExpensesCents`, exibindo sempre `Total gasto: R$ 0,00`; (5) Empilha até **10 banners/cards de alerta antes dos KPIs**, gerando severa sobrecarga cognitiva; (6) Exibe `<EmptyState>` no fim da página mesmo após renderizar cards e gráficos acima (L825).
- **`src/components/modules/emergency-fund-config-dialog.tsx` (509 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bug Crítico de Duplo Toggle (L361–376 e L431–447):* `<div onClick>` e `<label onClick>` envolvem `<Checkbox onCheckedChange>` chamando o mesmo `handleToggleAsset` sem `stopPropagation()` — clicar diretamente no checkbox dispara duas vezes no mesmo evento e **não marca/desmarca o item**!
  - *Desvios de Modal:* Estados não resetam ao fechar/reabrir (L58–71); rodapé manual sem `<ModalFooter />` usando `flex-col-reverse` para 2 botões no mobile (L166); `border-border/60` e `/50`; botões de modo sem `triggerSensory("selection")`.
- **`src/components/modules/daily-flow-chart.tsx` (309 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bug de Fuso Horário no Tooltip (L274):* `new Date(scrubDay.day)` interpreta `YYYY-MM-DD` em UTC `00:00`, fazendo o dia `01` de qualquer mês no Brasil (`UTC-3`) exibir o último dia do mês anterior (ex: `01/08` vira `31/07`).
  - *CLS & Acessibilidade:* Altura `h-44` (`176px`) menor que o `SkeletonChart` (`260px–290px`), causando salto de layout; gráfico `100% aria-hidden` e sem feedback sensorial no scrubbing.
- **`src/components/modules/auto-registered-banner.tsx` (173 linhas) e `src/components/modules/dashboard-pix-clipboard-card.tsx` (92 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Performance, Camadas e Privacidade:* `auto-registered-banner.tsx` importa diálogos de `@/features/transactions/`, mantém um `setInterval(..., 1000)` rodando **infinitamente** após o fim do countdown de 5s (L31–37) e exibe valor monetário cru sem `<MoneyText />` (vazando no Modo Privacidade). `dashboard-pix-clipboard-card.tsx` (L40, L62) também renderiza `formatCentsAsBRL` dentro de `truncate` sem máscara de privacidade + duplo disparo sensorial em `handleLaunch` (L27 + L72) + botão `X` `size-7` (`28px`).
- **`src/components/modules/pending-suggestions-card.tsx` (624 linhas), `src/components/modules/pending-split-signals-card.tsx` (398 linhas) e `src/components/modules/smart-advisor-card.tsx` (715 linhas)** — **`[Refatorar]`**
  - *Violações de Camada, Responsividade e Duplo Sensorial:* Os 3 vivem em `src/components/modules/` mas importam hooks de `@/state` e `@/features/` (com `try { useQueryClient() }` suprimindo `rules-of-hooks` em `pending-split-signals-card.tsx:38`). Apresentam múltiplos duplos disparos sensoriais (`SmartAdvisorCard` dispara no `<Button>` e novamente dentro de `use-smart-advisor-insights.ts`), `<PopoverContent>` sem `collisionPadding` (`pending-suggestions-card.tsx:459`) e botões `< 28px` no mobile (`h-6`/`h-7`).

### Prioridade Média

- **`src/components/modules/dashboard-alerts-carousel.tsx` (266 linhas), `src/components/modules/surplus-aporte-banner.tsx` (109 linhas), `src/features/overview/components/goal-progress-alert-banner.tsx` (172 linhas), `src/components/modules/cash-gap-alert.tsx` (93 linhas), `src/components/modules/pace-alert-banner.tsx` (118 linhas) e `src/components/modules/subscription/trial-ending-banner.tsx` (147 linhas)** — **`[Padronizar]`**
  - *Despadronização do Carrossel & Movimento:*
    - `dashboard-alerts-carousel.tsx`: autoplay de 8s e transição `duration-[850ms]` ignoram `prefers-reduced-motion` e `data-motion="reduced"|"eco"`; dots de `6×6px` e setas de `24×24px` (`< 44px`); sem feedback sensorial ao navegar.
    - `surplus-aporte-banner.tsx`: injeta bloco monetário extra + borda interna no mobile (L71–82), quebrando a altura uniforme de `104px` do carrossel e gerando *layout jump*.
    - `goal-progress-alert-banner.tsx`: renderiza 2 CTAs + botão `X` `size-7` + duplo disparo sensorial (L39).
    - `cash-gap-alert.tsx` & `pace-alert-banner.tsx`: `<h2>` sem `truncate` e `bg-warning/10` divergente; `trial-ending-banner.tsx:118` usa `line-clamp-2` no título do carrossel.
- **`src/components/modules/category-donut.tsx` (535 linhas), `src/features/overview/components/overview-budgets-section.tsx` (177 linhas), `src/features/overview/components/other-budgets-dialog.tsx` (159 linhas) e `src/features/overview/components/other-categories-dialog.tsx` (144 linhas)** — **`[Unificar]` / `[Padronizar]`**
  - *UX, Contraste e DRY:* `category-donut.tsx` mantém legenda sempre em 1 coluna (ignorando `sm:grid-cols-2` acima de 4 itens), usa `dark:bg-border/60` (quebra no tema OLED) e `text-[9px]`; `overview-budgets-section.tsx` usa seta Unicode proibida `→` (L68), segmentos clicáveis de apenas `10px` de altura (`h-2.5`) e vaza valores em `title`; `OtherBudgetsDialog` e `OtherCategoriesDialog` são 85% duplicados e devem ser unificados.
- **`src/components/modules/real-cash-hero-card.tsx` (205 linhas), `src/components/modules/cash-kpi-card.tsx` (251 linhas), `src/components/modules/kpi-card.tsx` (133 linhas), `src/components/modules/cash-checkpoint-dialog.tsx` (147 linhas), `src/components/modules/cycle-obligations-dialog.tsx` (317 linhas) e `src/components/modules/emergency-thermometer.tsx` (396 linhas)** — **`[Padronizar]` / `[Refatorar]`**
  - *Desvios:* `real-cash-hero-card.tsx` esmaga 3 métricas em `sm:grid-cols-3` no tablet estreito e não usa `shadow-kpi`; `cash-kpi-card.tsx` usa `animate-pulse` cru em vez de `<SkeletonKpi />` e mantém botão "lápis" `size-6` (`24px`) oculto no teclado; `kpi-card.tsx` clicável não emite `triggerSensory`; `cash-checkpoint-dialog.tsx` coloca `<ModalFooter>` dentro do `<form>` rolável; `cycle-obligations-dialog.tsx:127` passa `"var(--primary)"` sem `hsl()` (cor invisível); `emergency-thermometer.tsx:384` exibe mês ISO cru (`"2027-04"`).
- **`src/components/modules/equation-breakdown-popover.tsx` (199 linhas) e `src/components/modules/qualified-dismiss-popover.tsx` (155 linhas)** — **`[Padronizar]`**
  - *Mobile & Popovers:* Gatilho de `EquationBreakdownPopover` tem apenas `20×20px` (`size-5`) + falta `collisionPadding` + duplo disparo sensorial; `QualifiedDismissPopover` usa `z-50` hardcoded, vaza `annualSavingsCents` sem `<MoneyText />` e duplica disparo sensorial.

### Prioridade Baixa

- **`src/components/modules/android-pro-banner.tsx` (69 linhas)** — **`[Excluir]`** (do carrossel Web da Home)
  - *Poluição Visual na Web:* Banner promocional de APK exibido no carrossel principal para usuários Web mobile com gradiente divergente e `aria-label` contraditório ("por 7 dias" vs dispensa permanente).
- **`src/components/modules/quick-balance-adjustment-modal.tsx` (149 linhas)** — **`[Excluir]`**
  - *Código Morto:* Modal 100% órfão em produção (substituído por `CashCheckpointDialog`).
- **`src/components/modules/month-picker.tsx` (70 linhas), `src/components/modules/virgin-account-hero.tsx` (210 linhas), `src/features/overview/components/household-alert-banner.tsx` (144 linhas) e `src/features/overview/components/split-pending-banner.tsx` (80 linhas)** — **`[Padronizar]`**
  - *DRY & Limpeza:* `month-picker.tsx` duplica `addMonths`/`monthLabel` de `@/lib/date` e dispara `"action"` em vez de `"selection"`; `virgin-account-hero.tsx` usa `bg-surface-subtle` inexistente, `<Link><Button>` aninhados e rota errada `"/cartoes"` no fallback de `"Calibrar Saldo"`; `split-pending-banner.tsx` tem props mortas (`totalExpensesCents`, `items`) e duplo disparo sensorial (assim como `household-alert-banner.tsx`).

---

## MÓDULO 3: Modo Viagem & Compartilhamento Público de Viagem (`trips` + `public-share`)

### Prioridade Alta

- **`src/features/trips/components/add-trip-expense-dialog.tsx` (624 linhas) e `src/features/trips/components/edit-trip-expense-dialog.tsx` (369 linhas)** — **`[Refatorar]` / `[Unificar]`**
  - *Violação Crítica de Arquitetura (`AGENTS.md` §3):* Ambos importam repositórios de banco diretamente (`@/data/repositories/expenses` e `@/data/repositories/credit-cards`) dentro da UI!
  - *Bugs e UX:* Ambos contêm `<MoneyInput />` sem `showCalculator`, `<ModalFooter>` com borda dupla (sem `borderless`), botões `"Nova Categoria"` de `20px` de altura (`h-5`), e `EditTripExpenseDialog` usa lista fixa de 6 categorias que perde categorias personalizadas criadas no `AddTripExpenseDialog`. Unificar o seletor de participantes com `AddPublicTripExpenseDialog`.
- **`src/features/trips/pages/trip-details-page.tsx` (815 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Exclusão Sem Confirmação & UX:* (1) Clicar na lixeira de um participante (L453–461) exclui imediatamente em 1 toque **sem `ConfirmDialog`**; (2) Datas exibidas em ISO cru (`YYYY-MM-DD`) nas L289, L387 e L557; (3) Valores em `formatCentsAsBRL` sem `<MoneyText />` (vazando no Modo Privacidade); (4) Botão `"Sair da Viagem"` triplicado em 3 lugares da mesma tela e `"Seu Saldo Líquido"` duplicado em 2 cards consecutivos; (5) Abas Nível 1 usando `variant="pills"` sem ícones; (6) `<EmptyState>` aninhado dentro de `<Card>` (borda dupla de card); (7) Botões de lápis/lixeira de `22×22px` (`p-1`).
- **`src/features/trips/components/trip-member-statement-dialog.tsx` (234 linhas) e `src/features/public-share/components/public-trip-member-statement-dialog.tsx` (233 linhas)** — **`[Unificar]` / `[Padronizar]`**
  - *Duplicação 98% Literal + Quebra Mobile:* Dois arquivos quase idênticos contendo o mesmo `grid-cols-3` rígido sem prefixo responsivo (L103/L104 — esmagando valores monetários em telas de `320px–375px`), datas ISO cruas, `formatCentsAsBRL` sem `<MoneyText />` e `<ModalFooter>` com borda dupla. Unificar em um único componente.
- **`src/features/trips/components/create-trip-dialog.tsx` (313 linhas) e `src/features/trips/components/invite-trip-member-dialog.tsx` (222 linhas)** — **`[Padronizar]`**
  - *Quebra Mobile (iOS Auto-Zoom) e Ortografia pt-BR:* `create-trip-dialog.tsx` força `text-xs` (`12px`) nos inputs de amigos (L271, L285); `invite-trip-member-dialog.tsx` força `h-9 text-xs` no input (L147), dispara duplo sensorial ao copiar link e exibe textos sem acentuação e com nome legado `"Axis Finance"` (`"Ola!"`, `"ja foi finalizada"`, `"estao"`, `"camera"`, `"lancar"`, `"propria"`).
- **`src/features/public-share/components/shared-link-header-nav.tsx` (148 linhas)** — **`[Padronizar]`**
  - *Bugs Visuais e Desktop:* (1) `hidden xs:inline` (L93) mantém o wordmark **"Axir" oculto em 100% das resoluções** porque o breakpoint `xs:` não existe; (2) Exibe botão `"Abrir no App"` com protocolo legado `com.guiafinanceiro.app://` mesmo em navegadores Desktop Windows/macOS/Linux; (3) `<header>` usa `z-30` hardcoded e `<Link><Button>` aninhados.

### Prioridade Média

- **`src/features/trips/components/trip-settlement-dialog.tsx` (802 linhas) e `src/features/public-share/pages/trip-public-page.tsx` (662 linhas)** — **`[Refatorar]` / `[Unificar]`**
  - *Duplicidade de Domínio, Rodapé e Sensorial:* Ambos duplicam a função `buildSettlementPixCode` (extrair para `src/domain/trips/settlement-pix.ts`); `trip-settlement-dialog.tsx` empilha 4 botões largos no `<ModalFooter>`, tem **6 duplos disparos sensoriais**, token inexistente `shadow-2xs`, botões `h-6`/`h-7` (`24px–28px`) e `formatCentsAsBRL` sem `<MoneyText />`; `trip-public-page.tsx` duplica duas vezes seguidas o banner `"Vincular esta viagem ao meu aplicativo"` para usuários logados (L485 e dentro do `PublicTripIdentityBanner`), exibe datas ISO cruas e usa `<Link><Button>`.
- **`src/features/trips/pages/trip-list-page.tsx` (235 linhas) e `src/features/trips/components/active-trip-banner.tsx` (55 linhas)** — **`[Padronizar]`**
  - *Desvios Visuais:* `trip-list-page.tsx` exibe datas ISO cruas (`{trip.start_date} até {trip.end_date}`), usa `variant="pills"` nas abas primárias e `<Link><Button>` aninhados; `active-trip-banner.tsx` não preenche `min-h-[104px] sm:min-h-[72px]` do carrossel da Home, vaza valor sem `<MoneyText />` e aninha `<Link><Button>`.
- **`src/features/public-share/components/claim-trip-member-dialog.tsx` (214 linhas), `src/features/public-share/components/add-public-trip-expense-dialog.tsx` (309 linhas) e `src/features/public-share/components/public-trip-identity-banner.tsx` (289 linhas)** — **`[Padronizar]` / `[Refatorar]`**
  - *Anatomia e DRY:* `claim-trip-member-dialog.tsx` coloca `<ModalFooter>` dentro de `children`; `add-public-trip-expense-dialog.tsx` omite `showCalculator`; `public-trip-identity-banner.tsx` copia e cola o mesmo bloco de 50 linhas duas vezes (L109–158 e L237–286) + duplo disparo sensorial no botão `"Alterar"`.

### Prioridade Baixa

- **`src/features/trips/components/add-trip-member-dialog.tsx`, `leave-trip-dialog.tsx`, `rebalance-trip-splits-dialog.tsx`, `reopen-trip-dialog.tsx`, `trip-delete-dialog.tsx`, `trip-expense-delete-dialog.tsx` e `trip-personal-context-card.tsx`** — **`[Padronizar]`**
  - *Polimento:* Remover borda dupla de `<ModalFooter>` (adicionar `borderless`), aplicar `formatDateBR` em `trip-expense-delete-dialog.tsx:113`, `<MoneyText />` em `leave-trip-dialog.tsx:90,102`, `loading={...}` nos botões de confirmação e eliminar ações repetidas em `trip-personal-context-card.tsx`.

---

## MÓDULO 4: Lançamentos, Wizard, Calculadora, Cartões, Dívidas & Orçamentos Individuais

### Prioridade Alta

- **`src/features/debts/components/loan-form-dialog.tsx` (192L), `src/features/debts/components/loan-edit-dialog.tsx` (437L), `src/features/debts/components/loan-schedule-dialog.tsx` (144L), `src/features/debts/components/loan-card.tsx` (182L) e `src/features/debts/components/early-amortization-dialog.tsx` (177L)** — **`[Refatorar]` / `[Unificar]`**
  - *Bug Crítico de Escala Matemática (`100×` na Taxa de Juros) + Read-Only:* `LoanFormDialog:61` salva `actualRate / 100` (`0.018`), mas `LoanScheduleDialog:36`, `LoanCard:48` e `LoanEditDialog:75,154` tratam o campo sem converter (`0.018% a.m.` no cronograma e `180% a.m.` após editar!). Além disso, `LoanFormDialog` não reseta ao fechar, `LoanCard` não verifica `isReadOnlyMode`, `EarlyAmortizationDialog:121` usa token inexistente `text-success` e `size="xl"` exagerado para 2 campos, e `LoanEditDialog` + `LoanFormDialog` duplicam os 7 campos de contrato (usar `<PercentInput />` e `<MoneyText />`).
- **`src/components/modules/floating-calculator.tsx` (529 linhas), `src/components/modules/calculator-keypad.tsx` (113 linhas) e `src/services/calculator-bridge.ts` (142 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Sequestro de Teclado e Colisão de Alvos:* (1) Quando o sub-modal `"Colar Valor Manualmente"` (`manualPasteOpen`) abre, o listener global `keydown` da calculadora intercepta `0–9`, `Backspace`, `Enter` e `Ctrl+V` com `preventDefault()`, **impedindo o usuário de digitar ou colar no input**; (2) `calculator-bridge.ts` usa variável escalar sem pilha, fazendo o último `MoneyInput` montado num formulário multi-campo sequestrar a calculadora; (3) Visor `text-3xl` estoura em valores longos no mobile; (4) Histórico no modo `decimal` exibe `R$` indevidamente; (5) Botão `"Usar valor"` está fora de `Modal.footer`.
- **`src/features/transactions/wizard/launch-wizard.tsx` (1.272 linhas), `step-quick.tsx` (813 linhas), `step-details.tsx` (719 linhas), `step-value.tsx` (116 linhas), `step-category.tsx` (86 linhas), `step-review.tsx` (182 linhas) e `wizard-state.ts` (397 linhas)** — **`[Refatorar]` / `[Unificar]`**
  - *Camadas, Controles Nativos, Duplicidade e Triplo Disparo Sensorial:*
    - `launch-wizard.tsx`: importa `@/data/repositories/expenses` e `@/data/repositories/trips` na UI (L514, L519); dispara som+toast **duplicados** após `AttachReceiptDialog`; exibe `showCalculator` em passos sem valor monetário; usa `wideHeaderActions` no modo rápido; `<ModalFooter>` dentro do corpo rolável.
    - `step-quick.tsx` & `step-details.tsx`: duplicam ~245 linhas do seletor de "Contexto Rápido"; `step-details.tsx:545` usa `<Input type="number" className="text-xs">` proibido + auto-zoom iOS e **reimplementa `ReportWeightField` inteiro** (L643–676) em vez de importar o componente pronto; cliques em `<Chip>` disparam **triplo feedback sensorial simultâneo** (`Chip` + `StepDetails` + `LaunchWizard`); `step-quick.tsx` usa `grid-cols-3` rígido no mobile e 10 ocorrências de `text-primary` em texto `text-xs`.
    - `step-review.tsx`: exibe datas ISO cruas (`YYYY-MM-DD`) e competência crua (`YYYY-MM`); `wizard-state.ts` cola duas vezes o mesmo `.superRefine` de 40 linhas.
- **`src/features/transactions/components/expense-detail-dialog.tsx` (1.195 linhas) e `src/features/transactions/components/income-detail-dialog.tsx` (686 linhas)** — **`[Refatorar]` / `[Unificar]`**
  - *Bug Família, Camadas, Privacidade e Duplicidade (~60%):* `expense-detail-dialog.tsx:543` importa `@/data/repositories/public-shares` direto na UI; `income-detail-dialog.tsx:400` esquece de gravar `family_id` ao marcar `is_family`; ambos exibem datas ISO cruas, vazam valores sem `<MoneyText />`, usam nome legado `"Finanças Pessoais"`, escondem os rótulos dos botões secundários no mobile (`hidden sm:inline`) e colocam `<ModalFooter>` dentro do `<form>` rolável.
- **`src/features/cards/pages/cards-page.tsx` (1.050 linhas), `src/components/modules/credit-card-3d.tsx` (313 linhas) e `src/components/modules/card-invoice-print-view.tsx` (214 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Read-Only Bypass, Vazamento de Privacidade e Corte Mobile:*
    - `cards-page.tsx`: botão `"Importar Fatura"` (L505) ignora `isReadOnlyMode`; erro de query renderiza `<Alert>` + `<ErrorState>` duplicados (L533–569); datas ISO cruas em `TransactionRow` (L263); duplo disparo sensorial nos seletores de mês (L234 + L709).
    - `credit-card-3d.tsx`: todos os 4 valores monetários do cartão (Fatura, Ponderada, Disponível, Total) **vazam em texto limpo com o Modo Privacidade ligado**; rodapé corta `Disp.: R$ ...` em telas `< 390px`; tilt 3D ignora `prefers-reduced-motion` / `data-motion`.
    - `card-invoice-print-view.tsx`: tabelas `min-w-[540px]` com `overflow-hidden` sem `overflow-x-auto` **cortam 4 colunas no preview mobile** + usa marca legada `"Finanças Pessoais"`.
- **`src/features/cards/components/batch-invoice-payment-dialog.tsx` (216 linhas) e `src/features/cards/components/statement-reconcile-step.tsx` (768 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bugs Críticos:* `batch-invoice-payment-dialog.tsx:118–128` sofre do **bug de duplo toggle** (`<div onClick>` envolvendo `<Checkbox onCheckedChange>`); `statement-reconcile-step.tsx:288` injeta scroll aninhado proibido (`max-h-[min(380px,45dvh)] overflow-y-auto`) dentro de `<Modal>`, usa tokens fantasmas (`bg-warning-subtle`, `bg-primary-subtle`), 6 abas `underline` e contém **2 submodais de 110 linhas copiados e colados** com 4 `<Input type="number">` proibidos e sem `showCalculator`.
- **`src/features/debts/pages/debts-page.tsx` (577 linhas) e `src/features/budgets/pages/budgets-page.tsx` (760 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bypasses de `isReadOnlyMode`:* `debts-page.tsx` permite criar e quitar dívidas nos 3 grupos pendentes em modo somente-leitura (L287–350); `budgets-page.tsx` permite criar/aportar/editar Metas & Campanhas em modo somente-leitura (L536–552), usa rótulo de aba composto proibido `"Metas & Campanhas"` e mantém `<Tabs>` visível abaixo de `<ErrorState>`.

### Prioridade Média

- **`src/features/transactions/pages/transaction-list-page.tsx` (735 linhas) e `src/components/modules/transaction-row.tsx` (159 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Acessibilidade, Abas e Auto-Zoom:* `transaction-list-page.tsx` usa 5 abas Nível 1 sem ícones e `<SearchInput className="h-9.5 text-xs sm:text-sm">` (`12px` no mobile → auto-zoom iOS); `transaction-row.tsx:152` remove o `focus-visible` ring (`focus-visible:outline-none` sem `ring`), não emite `triggerSensory("selection")` e aninha `PriceIncreaseBadge` clicável dentro de `<button>`.
- **`src/features/cards/components/card-form-dialog.tsx` (515L), `payment-dialog.tsx` (224L), `bill-refinance-dialog.tsx` (224L), `card-invoice-payments-feed.tsx` (82L) e `src/components/modules/card-subscription-radar.tsx` (145L)** — **`[Padronizar]` / `[Unificar]`**
  - *Tokens, Contraste e Privacidade:* `card-form-dialog.tsx` recria preview do cartão em vez de reutilizar `<CreditCard3D disableTilt />`, usa bolinhas de cor `20×20px` e `shadow-2xs`; `bill-refinance-dialog.tsx` vaza 4 valores no Modo Privacidade, usa `text-warning` ilegível no modo Light (`1.6:1`) e `<Input>` cru em vez de `<PercentInput />`; `card-subscription-radar.tsx` usa tokens inexistentes `border-warning-border` e `bg-warning-surface`; `card-invoice-payments-feed.tsx` exibe datas ISO cruas e pinta pagamentos de fatura em vermelho (`kind="expense"`).
- **`src/features/budgets/components/tabs/budgets-limits-tab.tsx` (493L), `budget-adjust-dialog.tsx` (350L), `category-form-dialog.tsx` (299L), `delete-category-dialog.tsx` (110L), `limit-dialog.tsx` (234L), `income-goal-dialog.tsx` (176L) e `src/components/modules/budget-progress-bar.tsx` (60L)** — **`[Unificar]` / `[Padronizar]`**
  - *UX, Contraste e DRY:* `category-form-dialog.tsx` exibe slugs crus sem acento no `IconPicker` (`"alimentacao"`, `"saude"`) e fecha o formulário pai ao cancelar o `DeleteCategoryDialog` (descartando edições!); `budget-adjust-dialog.tsx` omite `showCalculator` e usa `<Input type="number">`; `limit-dialog.tsx` e `income-goal-dialog.tsx` são 80% idênticos e exibem `{month}` cru (`2026-08`); `budget-progress-bar.tsx` usa `text-critical` em texto `text-xs` (reprova WCAG AA no Light Mode → usar `text-critical-strong`).

### Prioridade Baixa

- **`src/features/budgets/components/budget-category-row.tsx` (132 linhas)** — **`[Unificar]`** (ou **`[Excluir]`** o trecho duplicado em `budgets-limits-tab.tsx`)
  - *Código Órfão + Duplicação:* Arquivo 100% não importado em produção porque suas 100 linhas foram copiadas inline dentro de `budgets-limits-tab.tsx:375–471`.
- **`src/components/modules/credit-card-wallet.tsx` (267L), `src/features/debts/components/debt-form-dialog.tsx` (231L), `debt-row.tsx` (101L), `settle-dialog.tsx` (292L), `src/features/transactions/pages/share-target-page.tsx` (148L), `price-increase-badge.tsx` (47L), `report-weight-field.tsx` (75L) e `attach-receipt-dialog.tsx` (410L)** — **`[Padronizar]` / `[Unificar]`**
  - *Limpeza e Consistência:* Corrigir `useEffect` sem array de dependências e props mortas em `credit-card-wallet.tsx`; remover `showCalculator` quando não há `MoneyInput` em `settle-dialog.tsx`; unificar o pipeline de OCR entre `attach-receipt-dialog.tsx`, `share-target-page.tsx` e `launch-wizard.tsx`; aplicar vírgula decimal pt-BR em `price-increase-badge.tsx` e `<MoneyText />` em `report-weight-field.tsx`.

---

## MÓDULO 5: Racha de Despesa (`manage-split-dialog`, `split-expense-dialog`, `active-splits-card`)

### Prioridade Alta

- **`src/components/modules/split-expense-dialog.tsx` (1.032 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Vazamento de PII no Modo Simulação (L179–183):* Ao reabrir o modal (`open !== prevOpen`), ignora `isSimulationActive` e pré-preenche `profile?.cpf` / `profile?.email` reais do usuário! Além disso, na L124 usa fallback fictício `"financeiro.demo@exemplo.com"` até para contas reais sem CPF/e-mail.
  - *Camadas, Auto-Zoom iOS e Controles Proibidos:* Vive em `src/components/modules/` importando `@/state` (mover para `src/features/transactions/components/split/`); usa `<Input type="number" className="w-16 h-7 text-xs">` (L806) e 3 `<Input className="text-xs">` (`12px` no mobile → auto-zoom iOS); omite `showCalculator`; formata `R$ ${(cents/100).toFixed(2)}` com ponto inglês (L457); coloca rodapé dentro de `children`.
- **`src/components/modules/manage-split-dialog.tsx` (1.112 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Ícone Invisível, Tokens Fantasmas e Camada:* (1) Na L960 aplica `text-primary-foreground` (branco no Light Mode) sobre `<Button variant="default">` translúcido claro, deixando o `<Lock />` **invisível (branco sobre branco)**; (2) Na L1046 usa `border-destructive/50 bg-destructive/5` (**token inexistente**); (3) Vive em `components/modules/` importando 8 hooks de `@/state` + `try { useQueryClient() }`; (4) Omite `showCalculator`, vaza valores sem `<MoneyText />` e mantém `<ModalFooter>` dentro do scroll.
- **`src/features/transactions/components/active-splits-card.tsx` (782 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Responsividade, Sensorial e Tokens:* Renderiza até **5 botões na mesma linha** sem wrap em `< 360px` (L634–728), botões de paginação `24×24px` (`h-6 w-6`), **5 pontos de duplo disparo sensorial**, tokens inexistentes `hidden xs:inline` (L313) e `shadow-2xs` (L529), prop morta `onOpenSplitDialog` e duplicação da mensagem de WhatsApp com `split-expense-dialog.tsx`.

---

## MÓDULO 6: Orçamento Familiar (`family` + `family-budget-page`)

### Prioridade Alta

- **`src/features/family/components/family-settings-dialog.tsx` (979 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Auto-Zoom iOS em 100% dos Campos, Empilhamento de Modais e Ações Destrutivas:* (1) Todos os 7 inputs de texto forçam `text-sm` ou `text-xs` no mobile (`< 16px`, provocando auto-zoom no Safari iOS); (2) Os 3 modais secundários de confirmação (`Remover Membro`, `Sair`, `Excluir`) não passam `elevated={true}` sobre o modal pai aberto e colocam `<ModalFooter>` dentro de `children`; (3) Botão de revogar convite (L776) exclui em 1 clique sem confirmação e **sem `aria-label`**; (4) `4` duplos disparos sensoriais; (5) Omite `showCalculator`; (6) Importa `FamilyBudgetShareCard` de dentro de `features/settings/`.
- **`src/features/family/pages/family-invite-page.tsx` (725 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Auto-Zoom iOS, DRY Extremo e Tokens Fantasmas:* Inputs com `text-sm` e `text-sm text-xs` conflitantes no mobile (L330, L659, L677); repete **9 vezes** a mesma casca `<SharedLinkHeaderNav /><main><Card>` nas condicionais de status; usa `bg-surface-subtle/50` inexistente (L528, L544, L560); `<ModalFooter>` dentro de `children` (L458) e duplo disparo sensorial ao copiar link.
- **`src/features/family/components/household-clustering-ranking.tsx` (132 linhas) e `src/features/public-share/pages/family-budget-page.tsx` (449 linhas)** — **`[Padronizar]` / `[Refatorar]`**
  - *Barra Invisível & Botão Morto no Desktop:* Em `household-clustering-ranking.tsx:107`, `backgroundColor: cluster.color || "var(--primary)"` sem `hsl()` deixa a barra invisível quando sem cor, somado aos tokens fantasmas `bg-surface-subtle/50` e `bg-surface-muted/60` e caixa de ícone proibida `size-8`. Em `family-budget-page.tsx:384–423`, a condição `(!isInstalled)` exibe o card **"Fixar no Celular como Aplicativo"** em computadores Desktop com um botão `"Adicionar à Tela Inicial"` completamente morto!

### Prioridade Média & Baixa

- **`src/features/family/pages/family-page.tsx` (398L), `family-create-modal.tsx` (177L), `family-settlement-dialog.tsx` (304L), `family-share-assets-dialog.tsx` (292L), `household-balance-card.tsx` (182L), `household-ceiling-card.tsx` (126L), `household-combined-flow-card.tsx` (139L), `household-comparison-card.tsx` (212L), `household-expense-feed.tsx` (159L) e `household-wealth-card.tsx` (237L)** — **`[Padronizar]` / `[Unificar]`**
  - *Tokens Fantasmas e DRY:* Substituir `bg-surface-subtle/50`, `bg-surface-muted/30` e `shadow-2xs` por tokens reais (`bg-muted/50` / `bg-surface-raised` / `shadow-xs`); substituir as **5 barras de progresso HTML manuais** pelo primitivo `<Progress />` e o bloco de erro manual de `family-page.tsx:232` por `<ErrorState />`; adicionar `showCalculator` em `family-create-modal.tsx`, `monthLabel` em `family-settlement-dialog.tsx:124`, `borderless` nos `<ModalFooter>`, paginação de 50 itens em `household-expense-feed.tsx` e remover o `if (!open) return null` que corta a animação de saída em `family-share-assets-dialog.tsx:281`.


---

## MÓDULO 7: Investimentos, Carteira, Rebalanceamento, Provisões/Proventos, Metas, Insights, Relatórios & Lembretes

### Prioridade Alta

- **`src/features/investments/components/asset-detail-sheet.tsx` (1.179 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bugs Visuais e Funcionais Críticos:*
    1. **Prefixo Monetário Duplicado (`R$ R$ 1.000,00`):** renderiza `R$ <MoneyText cents={...} />` nas L949 e L961.
    2. **Colisão / Omissão de Ações Rápidas:** clicar no botão de Split (L497–500) chama `setSplitOpen(true)` (abrindo `QuickTransactionSheet` interno na L1155) **E** `onAction?.("split")` (fechando o sheet e abrindo uma 2ª folha no pai); inversamente, quando aberto a partir de `TargetsTab` (`targets-tab.tsx:794`) ou `Reports` (`investments-tab.tsx:470`), `onAction` é `undefined` e os botões `"Aportar"`, `"Vender"` e `"Provento"` (L433, L448, L482) **não fazem nada**.
    3. **Privacidade, Datas ISO e Sensorial:** `.toFixed(2)` e `toLocaleString` sem `.num` (L558, L760, L946–982), data ISO crua `{tx.date}` (L1043), duplo disparo `triggerSensory("destructive")` no `ConfirmDialog` (L1131, L1147), `text-critical` sem `-strong` (L353), `text-primary` em ícones estáticos (L718, L840, L930), `text-[9px]` (L629) e alvos `h-6`/`size-7` (`< 44px`, L1008, L1075, L1090).
- **`src/features/investments/components/quick-transaction-sheet.tsx` (1.494 linhas) + `src/features/investments/wizard/investment-wizard.tsx` (867 linhas) + `step-order.tsx` (796 linhas) + `wizard-state.ts` (608 linhas)** — **`[Unificar]` / `[Refatorar]`**
  - *Duplicidade Massiva (`3.157` linhas somadas) e Quebra Mobile:*
    1. `QuickTransactionSheet` reimplementa integralmente os 5 formulários de operação, preview fiscal regressivo de Renda Fixa (L289–386), editor manual de IRRF (L1042–1139) e cálculo de PM/P&L já existentes em `InvestmentWizard` + `StepOrder` + `wizard-state.ts`, com divergência funcional (proporção `X:Y` de split e dividendo por cota existem no Sheet, mas não no Wizard) e 250+ linhas de regras fiscais acopladas na camada `features/`.
    2. **Quebra Mobile:** `quick-transaction-sheet.tsx:722` aplica `grid-cols-3` rígido sem prefixo responsivo; `step-governance.tsx:183` usa `grid-cols-6 sm:grid-cols-11` (`h-9`); `step-order.tsx:707,755` usa `<Input type="number">` cru e textos sem acento (`"Diario"`, `"Extrato do Mes"`, L655–682); `step-review.tsx:369` exibe `{state.date}` em ISO cru; `investment-wizard.tsx:588` esquece `reverse_split` no título, repete dólar hardcoded `?? 5.25` 6 vezes e injeta `div` de 3 colunas dentro de `ModalFooter` (L611).
- **`src/components/modules/position-table.tsx` (1.465 linhas) e `src/components/modules/aporte-result.tsx` (1.157 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Quebras em Tablet/Mobile, iOS Auto-Zoom e Dessincronia de Dados:*
    1. `position-table.tsx`: em tablets (`640px–1023px`), `renderDesktopRow` (L883) distribui 7 colunas `flex-1` num `<div className="min-w-full">` (L1218) — sem `min-w-[780px]`, o `overflow-x-auto` **nunca ativa** e esmaga 7 colunas financeiras; usa token inexistente `bg-destructive/10` (L427, L452); aninha `<button>`s dentro de `div[role="row"][tabIndex=0]`; aplica caixas decorativas `size-7` nos grupos (L1091–1317); copia `sortRows` 3 vezes e ignora a prop morta `onDeleteAsset`.
    2. `aporte-result.tsx`: a visão `"Por Classe"` (`"tree"`, L1022–1046) ignora `excludedAssetIds` e `quantityOverrides` (`effectiveRouteMap`), exibindo valores divergentes dos KPIs do topo; usa `<Input type="number" className="h-6 w-16 text-xs" />` no mobile (L880 — `24px` de altura e auto-zoom iOS Safari!); vaza valores em `Gap:` sem `.num` (L616, L670, L965) e duplica `<KpiCard />` em `ResultStat` (L1128).
- **`src/features/investments/pages/proventos-tab.tsx` (1.127 linhas) e `src/features/investments/pages/resumo-tab.tsx` (1.130 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Colisão Tipográfica de KPIs, ARIA e Deep-Link Quebrado:*
    1. `proventos-tab.tsx`: recria manualmente 11 KPI cards e envolve `<MoneyText />` (`text-sm` = `14px`) dentro de `<p className="text-2xl font-bold">` (L458, L646, L654, L756, L764, L930), fazendo todos os KPIs monetários saírem em `14px` ao lado de contadores em `24px`; passa `SUBTAB_ITEMS` sem `content` para `<Tabs>` (gerando `tabpanel`s vazios, L1046); dispara `triggerSensory("selection")` em duplicidade (L116); omite `aria-label` no botão Excluir (`h-8 w-8`, L614).
    2. `resumo-tab.tsx`: deep-link `?ticker=CAIXA` / `?q=<cashId>` falha silenciosamente quando `InvestmentsPage` passa `onOpenCash` (L199, L1105); `InvestmentsPage:127` também descarta `initialQuantity` e `initialTotalCents`; usa `CategoryDonut` com `emptyText="Sem despesas"` (L686), `<button>` nativo de `26px` no alternador (L644) e vaza `formatCentsAsBRL` sem `.num` (L528).
- **`src/features/investments/components/portfolio-snapshots-dialog.tsx` (562 linhas) e `src/components/modules/reports/report-document-layout.tsx` (95 linhas)** — **`[Refatorar]`**
  - *Armadilha de Impressão em Branco vs Dupla Montagem DOM:* `portfolio-snapshots-dialog.tsx:38,111` invoca `usePrint()` sobre `<Modal>` comum sem `<PrintSheet>` — como `globals.css:789` oculta `#root` e `[data-radix-portal]` em `@media print`, clicar em `"Imprimir / PDF"` gera **folhas 100% em branco**. Já `ReportDocumentLayout` monta `{children}` duas vezes simultaneamente (no `<Modal>` e no `<PrintSheet open={open}>`), dobrando o custo de renderização de relatórios pesados como `WealthTearSheetModal` (`1.160` linhas) mesmo sem imprimir.
- **`src/features/goals/components/goal-composition-dialog.tsx` (480 linhas) e `src/features/reminders/components/reminders-preferences-form.tsx` (448 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bug Crítico de Duplo Toggle em Checkbox + Triplo Disparo Sensorial:* Em `goal-composition-dialog.tsx:365–374` e `reminders-preferences-form.tsx:183–218`, `<div onClick>` envolve `<Checkbox onCheckedChange>` sem `stopPropagation()` — clicar diretamente na caixa do checkbox executa o toggle duas vezes seguidas (**anulando o clique**) e dispara **3 feedbacks sensoriais simultâneos**. Além disso, `goal-composition-dialog.tsx` usa tokens inexistentes `bg-surface-muted` (trilha de progresso invisível, L206), `grid-cols-3` rígido no mobile (L297) e 4 duplos disparos em `<Button>`.
- **`src/components/modules/notifications-popover.tsx` (600 linhas) e `src/features/reminders/pages/reminders-page.tsx` (689 linhas)** — **`[Refatorar]` / `[Unificar]`**
  - *10 Tokens Inexistentes, Violação de Camada e Duplicidade:* `notifications-popover.tsx:477–590` usa **10 tokens inexistentes** (`border-danger-border`, `bg-danger-surface`, `text-danger-text`, `border-positive-border`, `bg-positive-surface`, `text-positive-text`, `border-warning-border`, `bg-warning-surface`, `text-warning-text`, `hover:text-primary-hover`), importa 8 hooks de `@/state` dentro de `components/modules/`, aninha `<Button>` em `div[role="button"]` 3 vezes e usa `w-80` sem `max-w-[calc(100vw-1.5rem)]`. `reminders-page.tsx` tem 6 duplos disparos sensoriais (L104, L153, L247, L485, L575, L620) e copia 95 linhas de `handleOpenAdvisorAlert` esquecendo `forma`/`cardId` na URL (L219–242). `reminder-item.tsx:87` exibe `{item.dueDate}` em ISO cru.
- **`src/features/reports/hooks/use-reports-data.ts` (977 linhas) e Modais Executivos (`wealth-tear-sheet-modal.tsx` 1.160L, `financial-close-report-modal.tsx` 516L, `dividend-freedom-modal.tsx` 230L)** — **`[Refatorar]` / `[Padronizar]`**
  - *Overfetching, Valores Mágicos e Tabelas Cortadas no Mobile:*
    1. `use-reports-data.ts` dispara **10 queries de Investimentos incondicionalmente** (L154–163, travando o loading mesmo na aba Finanças), inventa despesa mensal de `R$ 3.000,00` quando não há gastos (`monthlyExp ... : 3000`, L546), fixa `usdRate ?? 5.25` (L279), `appName: "Finanças & Investimentos"` (L738) e datas ISO cruas em `periodLabel` (L107).
    2. `report-performance-chart.tsx:109` impõe teto hardcoded `annualCdiRate <= 12.0` (descartando o CDI real sempre que a Selic supera 12% a.a.!).
    3. As tabelas de preview mobile em `wealth-tear-sheet-modal.tsx:687` (6 colunas), `dividend-freedom-modal.tsx:175` (5 colunas) e `financial-close-report-modal.tsx:237` (3 colunas) usam `overflow-hidden` **sem `overflow-x-auto`**, cortando valores no celular; além de cores hex hardcoded (`#1b6b62`, `#dda726`, `#0284c7`...).

### Prioridade Média

- **`src/features/investments/components/initial-pocket-cost-dialog.tsx` (1.092L), `portfolio-activity-panel.tsx` (1.064L), `portfolio-import-dialog.tsx` (792L) e `monthly-closing-editor.tsx` (558L)** — **`[Refatorar]` / `[Padronizar]`**
  - *Tokens Fantasmas, Contraste e Auto-Zoom iOS:* `initial-pocket-cost-dialog.tsx` usa `text-destructive` inexistente (L753–1004), `text-warning` ilegível no Light Mode (`1.7:1`), `Textarea text-xs` (L564, auto-zoom iOS), data fixa `"2024-02-26"` no estado inicial (L138, L181, L423), loop `await deleteContribution` N+1 (L337) e `<ModalFooter>` no scroll (L1079); `portfolio-import-dialog.tsx` usa `text-xs` em 5 campos + `<Input type="number">` cru (L480–681) e botões `size-7` sem `aria-label` (L740); `monthly-closing-editor.tsx` usa `text-xs` em `MoneyInput` (L431, L510) e `fxRate: 5.25` hardcoded (L76); `portfolio-activity-panel.tsx` usa `bg-destructive/10` inexistente (L712) e `<EmptyState tone="portfolio">` (L665).
- **`src/features/investments/pages/targets-tab.tsx` (827L), `aporte-tab.tsx` (546L), `portfolio-darf-monitor.tsx` (303L) e `asset-score-evaluation-dialog.tsx` (378L)** — **`[Refatorar]` / `[Unificar]`**
  - *Regras de Negócio na UI e Sensorial:* `targets-tab.tsx` tem **8 duplos disparos sensoriais** em `<Button>` (L491–594) e motor matemático de pesos na página; `aporte-tab.tsx` calcula câmbio `5.25` e metas na UI e monta 3ª instância de `<InvestmentWizard>`; `portfolio-darf-monitor.tsx` usa tokens inexistentes `border-portfolio-border/80 bg-portfolio-surface/20` (L263) e calcula apuração histórica de PM/DARF na UI (L46–76); `asset-score-evaluation-dialog.tsx` usa `text-warning-foreground`/`text-critical-foreground` inexistentes (L197–198) e duplica `StepGovernance`.
- **`src/features/goals/components/share-goal-dialog.tsx` (1.253L), `manage-contributions-dialog.tsx` (459L), `campaign-card.tsx` (365L) e `goal-card.tsx` (221L)** — **`[Refatorar]` / `[Padronizar]`**
  - *Sensorial, Responsividade e DRY:* `share-goal-dialog.tsx` tem 6 duplos disparos sensoriais, copia geração Pix BRCode **4 vezes** (L164, L220, L295, L481), usa `Input text-xs` (L700), `bg-white text-slate-500 text-[10px]` (L748), data ISO crua `deadline` (L636), 2 `<Modal size="sm">` manuais em vez de `<ConfirmDialog />` e `<ModalFooter>` no body; `manage-contributions-dialog.tsx` exibe `{c.date}` em ISO cru (L370), recria `<ConfirmDialog />` manualmente (L425) e encolhe `MoneyText` em `14px` (L171); `campaign-card.tsx` aninha 5 `<Button>`s (todos com duplo disparo sensorial) dentro de `<div role="button">`; `goal-card.tsx` esmaga o título com 6 badges na mesma linha em `< 400px` (L58–166) e tem 2 duplos disparos (L143, L159).
- **`src/features/insights/pages/insights-page.tsx` (677L), `recurrences-tab.tsx` (597L), `recurrence-audit-modal.tsx` (568L), `convert-recurrence-dialog.tsx` (403L) e `src/components/modules/insight-list.tsx` (307L)** — **`[Refatorar]` / `[Padronizar]`**
  - *Semântica Invertida, Cálculos na UI e Sensorial:* `insight-list.tsx:172` exibe **despesas recorrentes em verde** (`text-positive-strong`), usa token inexistente `hover:border-border-strong` (L117) e aninha 6 `<button>`s crus de `28px` em `<li role="button">`; `insights-page.tsx` mantém 340 linhas de cálculos financeiros na página, recria `<Tabs>` manualmente com duplo disparo sensorial (L503, L601), exibe `{r.maturityDate}` em ISO cru e typo `"Planeje a reinvestimento"` (L451); `recurrences-tab.tsx` dispara `triggerSensory` em duplicidade com `QualifiedDismissPopover` (L194–232) e `qualified-dismiss-popover.tsx:61` usa `w-80` fixo; `recurrence-audit-modal.tsx` usa `bg-surface-muted/30` inexistente (L181) e 4 duplos disparos (L89); `convert-recurrence-dialog.tsx` muta `setState` durante o render (L108) e empilha 2 botões em `flex-col-reverse` sem `<ModalFooter>` (L215).
- **`src/components/modules/reports/report-stocks-breakdown-card.tsx` (342L), `report-fii-breakdown-card.tsx` (211L), `report-fixed-income-breakdown-card.tsx` (343L), `report-international-breakdown-card.tsx` (354L), `report-allocation-donuts.tsx` (399L), `report-class-tables.tsx` (460L) e `export-data-hub.tsx` (476L)** — **`[Unificar]` / `[Padronizar]`**
  - *Quádrupla Duplicidade (`1.250` linhas) e Tokens:* Os 4 cards de breakdown copiam a mesma estrutura com `<button>`s nativos de `24px`, 20+ cores hex hardcoded e token inexistente `bg-positive-subtle/40` (`report-fixed-income-breakdown-card.tsx:136`) — unificar em `<ReportExposureBreakdownCard />`; `CategoryDonut`, `InteractiveTargetDonut`, `ReportDonutChart` e `AllocationDonut` duplicam o motor SVG Donut — unificar em `<DonutRing />`; `report-allocation-donuts.tsx:354` cria scroll aninhado nativo `max-h-72 overflow-y-auto`; `report-class-tables.tsx:78` usa `py-0.2` inválido e `text-[8.5px]`; `export-data-hub.tsx` copia literalmente 55 linhas de cards CSV duas vezes no mesmo arquivo (L227–281 vs L379–433).

### Prioridade Baixa

- **Rotas, Props Mortas e Polimento de Diálogos Menores (`investments-page.tsx`, `diagnostics-tab.tsx`, `projection-tab.tsx`, `pending-dividends-dialog.tsx`, `calibrate-snapshot-dialog.tsx`, `calibrate-fixed-income-dialog.tsx`)** — **`[Padronizar]` / `[Excluir]`**
  - Unificar navegações `/investimentos` -> `/investments` evitando redirect hops (`portfolio-insights-carousel.tsx:219`, `reports/investments-tab.tsx:112`); formatar datas ISO cruas em `pending-dividends-dialog.tsx:196,250`, `calibrate-fixed-income-dialog.tsx:83` e `report-detail-dialog.tsx:48`; corrigir acentuação em `asset-edit-dialog.tsx:677,752` (`"debentures"`, `"calculo"`); remover props mortas (`PositionTableProps.onDeleteAsset`, `DiagnosticsTabProps.burnRate`, `ProjectionTabProps.runwayMonths`, `QualifiedDismissPopoverProps.className`, `ReportStackedSegment.formattedValue`, `ReportExecutiveSummaryItem.tone`, `RemindersPreferencesFormProps.isInsideModal`).

---

## MÓDULO 8: Configurações, Tema, 2FA/PIN, Tour Guiado, APK/PWA, Auth, Checkout, Landing/Simuladores & Admin

### Prioridade Alta

- **`src/features/settings/components/tabs/security-tab.tsx` (641 linhas) e `src/app/app-lock-overlay.tsx` (230 linhas) + `src/components/layout/global-search.tsx` (236 linhas)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bugs Críticos de Segurança, PIN Inacessível na Web e Poluição de APK:*
    1. **PIN 100% Inacessível na Web/PWA (`security-tab.tsx:117–120`):** `showAppLockCard = showBiometrics || showPrivacyShield` avalia `false` em qualquer navegador Web sem biometria nativa, ocultando o card inteiro e tornando todo o bloco `"Bloqueio com PIN de Acesso"` (L417–491) e `PinSetupDialog` **inacessíveis na Web**!
    2. **Bypass de Foco e Atalhos no `AppLockOverlay`:** `app-lock-overlay.tsx:97` é uma `<div>` sem *focus trap* nem `inert` no fundo (permitindo navegar via `Tab` nos botões do app bloqueado!), exibe `"Usar PIN"` mesmo sem PIN configurado (L165), usa `text-destructive` inexistente (L148), e pressionar `Ctrl+K` / `/` abre o `GlobalSearch` **por cima do bloqueio** (`global-search.tsx:95` — adicionar guarda `if (isAppLocked()) return;` também em `privacy-toggle.tsx:27`).
    3. **Poluição de APK no Desktop/iOS (`security-tab.tsx:542–627`):** exibe `<PlatformsTriptychCard />`, `"Versão 3.0.7 / Build 31"` defasada (`package.json` é `3.10.0`), URL legada `guia-financeiro-release.apk` e botão `"Baixar APK"` mesmo em macOS, Windows e iPhone.
- **`src/features/settings/components/tabs/appearance-tab.tsx` (224L), `visual-identity-card.tsx` (337L), `experience-presets-card.tsx` (117L), `interface-shortcuts-card.tsx` (272L) e `src/hooks/use-visual-customization.ts` (430L)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bugs de Tema, Sincronização em Nuvem e Preferências Sensoriais:*
    1. **Ordem Invertida de Feedback Sensorial (`appearance-tab.tsx:39–48`):** clicar em `"Discreto (Silencioso)"` chama `triggerSensory("action")` **antes** de mutar o preset (emitindo som/vibração ao tentar silenciar), e sair de `"Discreto"` para `"Dinâmico"` fica mudo!
    2. **Tempestade no Reset (`handleResetDefaults`, L141–164):** dispara **6 toasts empilhados**, **6 gatilhos sensoriais** e **5 mutações paralelas** (race condition JSONB no Supabase), nunca chama `visual.resetToDefaults()` e grava `themeToggle: false` contradizendo `DEFAULT_HEADER_BUTTONS` (`true`).
    3. **Buracos de Cloud Sync & Ausência de Controles Granulares:** `handleSelectAccent` (L112) e `theme-toggle.tsx:30` não sincronizam com o Supabase (`syncVisualWithCloud` ignora `accent`); `AppearanceTab` não expõe switches individuais para `soundEnabled`, `hapticEnabled`, `motionLevel` ou `surfaceStyle`.
    4. **Desvios em Subcards:** `visual-identity-card.tsx` usa `<LivePulseBeacon>` infinito num card estático, swatches hex hardcoded (`bg-[#...]`), `bg-black text-white`, `text-amber-500`, `text-indigo-400`, trunca `"Monocromático"` (L326) e dispara 2 mutações + 2 toasts ao trocar Dark/OLED (L169–206); `interface-shortcuts-card.tsx` aninha `<Checkbox>`/`<Switch>` dentro de `<div role="button">` em 4 blocos (duplo toggle/sensory).
- **`src/features/settings/components/subscription/cumulative-renewal-card.tsx` (306L) e `src/features/settings/components/tabs/subscription-tab.tsx` (1.017L) + `src/features/subscription/pages/subscription-checkout-page.tsx` (1.169L)** — **`[Refatorar]` / `[Padronizar]`**
  - *Texto Invisível, Pesquisa Descartada e Controles Proibidos:*
    1. `cumulative-renewal-card.tsx:148,155`: usa `bg-portfolio text-portfolio-foreground` (`--portfolio-foreground` não existe -> **texto invisível com contraste `1.2:1` no Light Mode**!) e `<input type="text" className="text-xs">` nativo cru (L266).
    2. `subscription-tab.tsx`: usa `border-destructive/30 bg-destructive/10 text-destructive-strong` inexistentes nos alertas de erro (L359, L777), **descarta `cancelReason`** ao chamar `cancelMutation.mutateAsync()` (L113), vaza faturas com `Intl.NumberFormat` no Modo Privacidade (L944, L975) e usa `•` decorativo (L897–971).
    3. `subscription-checkout-page.tsx`: erro de pagamento invisível com `bg-destructive/10` (L825), **8 campos sem `htmlFor`/`id` nem `inputMode="numeric"`** em CPF/Cartão/Validade/CVV (L713–912), bloco `catch` em `DEV` engolindo falhas reais e redirecionando para sucesso (L373–408), senha mínima divergente (`6` chars sem Turnstile, L275) e string legada `"GUIA_FINANC"` (L446).
- **Orquestração de Onboarding & Tour Guiado (`overview-page.tsx:604–615`, `page-shell.tsx:340`, `demo-tour-spotlight.tsx` 1.169L, `welcome-modal.tsx` 392L, `welcome-feature-modal.tsx` 224L, `demo-track-select-modal.tsx` 431L)** — **`[Refatorar]` / `[Excluir]`**
  - *Colisão Tripla de Modais, Vazamento Multi-Usuário e Mobile:*
    1. No 1º login, `<WelcomeModal>` + `<WelcomeFeatureModal>` (e `<NativeOnboardingDialog>` no Android) **abrem simultaneamente empilhados**; `WelcomeFeatureModal` promove captura de notificações Android para usuários de Mac/Windows/iOS; chaves `financas:welcome_*` em `demo-storage.ts` não têm escopo por `userId`; escolher objetivo `"family"` em `WelcomeModal:132` navega para `/familia` sem ativar `isFamilyModeEnabled`.
    2. `demo-tour-spotlight.tsx`: 5 duplos disparos sensoriais em `<Button>` (L203–292), dots de paginação com `6×6px` (`h-1.5 w-1.5`) e ARIA inválido (`role="tablist"` > `role="button"`, L1041–1151), máscara `rgba(0,0,0,0.60)` hardcoded, transições ignorando `motionLevel` e card inferior sobrepondo a `BottomNav` no mobile (L975).
    3. `demo-track-select-modal.tsx:321`: afirma `"Metas por Classe e Ativo"`, contradizendo a regra de domínio do produto (metas apenas por Classe e Setor).
- **Poluição de APK Android na Web/iOS & Branding Legado (`app-download-modal.tsx` 215L, `android-pro-banner.tsx` 69L, `banking-assistant-card.tsx` 710L, `shared-link-header-nav.tsx` 116L)** — **`[Excluir]` / `[Padronizar]` / `[Unificar]`**
  - `app-download-modal.tsx:138–190` exibe e recomenda `"Baixar APK Android"` mesmo em **iPhone/iPad e Mac/Windows** (especialmente quando o PWA já está instalado!), com `bg-surface-subtle` inexistente e 3 duplos disparos sensoriais; `banking-assistant-card.tsx:273–320` exibe propaganda de APK dentro das Configurações Web no Desktop/iOS (além de 5 `<Checkbox>` aninhados em `div[role="button"]` e `<Select>` na L544 que não salva na nuvem); `shared-link-header-nav.tsx:45,93` e `split-onboarding-modal.tsx:60` usam URL scheme legado **`com.guiafinanceiro.app://`** e `hidden xs:inline` (**breakpoint `xs:` inexistente -> texto `"Abrir no App"` fica sempre invisível**!).
- **`src/features/landing/components/fire-projection-curve.tsx` (605 linhas) e Demais Componentes da Landing/Tools** — **`[Refatorar]` / `[Padronizar]`**
  - *Gráfico Principal Invisível e Violação Sensorial no Hover:*
    1. `fire-projection-curve.tsx:335–336,416` passa `stopColor="var(--positive)"` e `stroke="var(--positive-strong)"` **sem `hsl(...)`**, renderizando **a curva principal de patrimônio e seu gradiente 100% invisíveis**; na L228 dispara `triggerSensory("selection")` no `onPointerMove` (hover do mouse no desktop — proibido pela Regra 17!).
    2. `minimal-wealth-simulator.tsx:120,150,178` e `shared-finances-showcase.tsx:413` usam **`grid-cols-3` rígido no mobile**; `shared-finances-showcase.tsx:468` tem botão `"Página Pública"` morto sem `onClick` e 24 usos de `text-[10px]`; `landing-footer.tsx:93` tem âncora quebrada `#investimentos`; `tools-header.tsx` **não possui `<ThemeToggle />`** e usa `md:flex` em vez de `lg:flex` (Regra 22).
- **Console Administrativo (`admin-backups-page.tsx` 347L, `user-edit-dialog.tsx` 1.073L, `admin-dashboard-page.tsx` 257L, `admin-users-page.tsx` 253L, `admin-shell.tsx` 242L)** — **`[Refatorar]` / `[Padronizar]`**
  - *Bugs Críticos de Negócio, Contraste e Conforto Ocular:*
    1. `admin-backups-page.tsx:20,49`: chama `fetchUserDataExport()` (que exporta via RLS **apenas as finanças pessoais do admin logado**) e rotula/registra como `"Snapshot administrativo consolidado da plataforma"`!
    2. `admin-dashboard-page.tsx:195` -> `admin-users-page.tsx:16`: link `/admin/usuarios?status=pending_approval` quebrado (`AdminUsersPage` nunca lê `useSearchParams()`), e botão `"Recusar"` bane usuários sem `<ConfirmDialog />` (L49).
    3. `admin-shell.tsx`: **não possui `<ThemeToggle />`** (admin preso sem alternância Claro/Escuro) e menu mobile sem focus trap/`Escape` (L187).
    4. `user-edit-dialog.tsx`: `bg-warning text-white` ilegível (`2.1:1`, L698), `bg-emerald-600` hardcoded (L868), `text-portfolio-strong` e `shadow-2xs` inexistentes, `Input text-xs` (L839), mensagem WhatsApp legada `"aplicativo Finanças"` (L872), 3 duplos disparos sensoriais e estado obsoleto ao trocar de usuário sem `key`.

### Prioridade Média

- **`src/features/settings/components/tabs/account-tab.tsx` (721L), `active-devices-card.tsx` (420L), `change-password-modal.tsx` (230L), `delete-account-card.tsx` (228L) e `mfa-modal.tsx` (617L)** — **`[Refatorar]` / `[Padronizar]`**
  - `account-tab.tsx:307` usa **`<input type="email" className="h-8 text-xs">` nativo cru** (violação dupla: controle nativo + auto-zoom iOS!), `text-sm` em 3 inputs (L267, L601, L622), `bg-surface-subtle` inexistente (L461), modal manual de logout duplicando `<ConfirmDialog />` (L666) e 3 duplos disparos sensoriais; `mfa-modal.tsx` chama `renderQrCodeSvg` com `#09090b`/`#ffffff` + `bg-white` hardcoded em vez de `<QrCodeCanvas />`, usa `<Input type="password">` sem toggle (L367) e 4 `<ModalFooter>`s soltos no scroll; `active-devices-card.tsx:367` usa `<Input type="password">`, cabeçalho quebrando em `< 400px` (L155) e duplo disparo destrutivo.
- **`src/features/auth/pages/login-page.tsx` (564L), `register-page.tsx` (538L), `reset-password-page.tsx` (260L), `pending-approval-page.tsx` (81L) e `suspended-account-page.tsx` (49L)** — **`[Refatorar]` / `[Padronizar]`**
  - Auto-zoom iOS (`text-sm` / `text-xs`) nos inputs de `login-page.tsx:498,515`, **todos os 5 inputs** de `register-page.tsx:313–463` (que ainda exibe placeholder legado `"GF-XXXX-XXXX"`) e `reset-password-page.tsx:188,229`; `pending-approval-page.tsx:17–22` lê `isActive` obsoleto na closure após `await refetch()`, exibindo sempre `"Status mantido"` mesmo aprovado; `pending-approval-page.tsx` e `suspended-account-page.tsx` usam `text-warning`/`text-critical` sem `-strong` e não possuem `<ThemeToggle />`.
- **Links Públicos Compartilhados (`trip-public-page.tsx` 662L, `goal-tracker-public-page.tsx` 693L, `split-public-page.tsx` 625L, `public-trip-member-statement-dialog.tsx` 233L, `select-participant-dialog.tsx` 101L, `select-split-category-dialog.tsx` 115L)** — **`[Refatorar]` / `[Padronizar]`**
  - `select-participant-dialog.tsx` e `select-split-category-dialog.tsx` inicializam `selectedId` apenas no mount (travando o botão Confirmar quando a lista carrega assincronamente) e exibem português sem acentuação (`"Quem e voce no racha?"`, `"anfitriao"`); `public-trip-member-statement-dialog.tsx:103` usa **`grid-cols-3` rígido no mobile** + `formatCentsAsBRL` sem `<MoneyText />` + `•` proibido; `goal-tracker-public-page.tsx:472` repete o bug do banner PWA `"Fixar no Celular"` morto no Desktop; `trip-public-page.tsx` chama `useUserTrips()` sem login (L59) e formata 6 valores sem `<MoneyText />`.
- **Atalhos de Perfil, Atualização PWA/Nativa e Suporte (`logo-profile-button.tsx` 283L, `pwa-update-toast.tsx` 47L, `native-update-toast.tsx` 85L, `support-chat-dialog.tsx` 291L)** — **`[Unificar]` / `[Padronizar]`**
  - `logo-profile-button.tsx:200–220` tem 2 pares de links duplicados abrindo as mesmas abas (`appearance` 2x e `security` 2x), esquecendo `account` e `notifications`, além de exibir `"Axir • v1.0.0"` defasado; `PWAUpdateToast` e `NativeUpdateToast` duplicam o banner de atualização (e `PWAUpdateToast` não respeita `useActiveOverlays()` nem `isNativePlatform()` — unificar em `<AppUpdateToast />`); `support-chat-dialog.tsx:59,145` usa `any` com `eslint-disable` e envia `app_version: "1.0.0"` hardcoded.

### Prioridade Baixa

- **`src/features/settings/pages/settings-page.tsx` (273L), `support-tab.tsx` (235L), `family-budget-share-card.tsx` (507L), `debt-simulator-page.tsx` (518L), `rebalance-simulator-page.tsx` (694L) e `privacy-page.tsx` (337L)** — **`[Padronizar]` / `[Excluir]`**
  - Remover estados/modais 100% mortos `helpModalOpen` e `demoSelectOpen` em `settings-page.tsx:142,245` e adicionar botões reais para abrir FAQ (`HelpModal`) e Tour Guiado na `SupportTab`; mover `family-budget-share-card.tsx` de `settings/components/tabs/` para `features/family/components/`; corrigir `Input text-xs` (auto-zoom iOS) em `debt-simulator-page.tsx:303` e `rebalance-simulator-page.tsx:431`; alinhar links e texto de exportação em `privacy-page.tsx:285,307` e `subscription-success-page.tsx:76,247`.


---

## SEÇÃO CONSOLIDADA A: Faxina, Duplicidades, Poluição Visual e Código Morto (Poda Arquitetural)

### A.1. Elementos, Componentes, Modais, Hooks e Utilitários Duplicados (`[Unificar]`)

| Domínio / Papel | Arquivos Duplicados Atuais | Ação Recomendada (`[Unificar]`) |
|---|---|---|
| **Casca de Diálogo / Modal** | `src/components/ui/modal.tsx` (`461L`) vs `src/components/ui/responsive-dialog.tsx` (`75L`, `53` usos) | Unificar 100% em `<Modal />` (fazendo o slot `footer` suprimir borda/margem duplicada de `ModalFooter` automaticamente) e deprecar/remover `ResponsiveDialog`. |
| **Controle Stepper Numérico** | `src/components/ui/number-stepper.tsx` (`61L`) vs `src/components/ui/number-stepper-input.tsx` (`212L`) | Unificar em um único `<NumberStepper editable?: boolean />` com altura `h-10` uniforme, `tabular-nums` (sem `.num` para não borrar parcelas no Modo Privacidade) e throttling sensorial no *long-press*. |
| **Motor SVG de Gráficos Donut (`4x`)** | `src/components/modules/category-donut.tsx` (`535L`), `src/components/modules/interactive-target-donut.tsx` (`425L`), `src/components/modules/reports/report-donut-chart.tsx` (`255L`), `src/components/modules/allocation-donut.tsx` (`71L`) | Extrair geometria pura (`computeVisualShares`, arcos SVG e paleta `--cat-1..10`) para `src/domain/charts/donut-geometry.ts` + primitivo `<DonutRing />` em `src/components/ui/donut-ring.tsx`. |
| **Cards de Raio-X Patrimonial (`4x`, `1.250L`)** | `src/components/modules/reports/report-stocks-breakdown-card.tsx` (`342L`), `report-fii-breakdown-card.tsx` (`211L`), `report-fixed-income-breakdown-card.tsx` (`343L`), `report-international-breakdown-card.tsx` (`354L`) | Unificar em um único `<ReportExposureBreakdownCard />` parametrizado usando tokens CSS (`--cat-*`), eliminando `~1.000` linhas duplicadas e `20+` cores hex hardcoded. |
| **Formulários e Cálculos de Operação de Ativo (`3.157L`)** | `src/features/investments/components/quick-transaction-sheet.tsx` (`1.494L`) vs `src/features/investments/wizard/investment-wizard.tsx` (`867L`) + `step-order.tsx` (`796L`) | Extrair cálculos fiscais/PM para `src/domain/portfolio/` e compartilhar subformulários visuais (`OrderBuySellFields`, `OrderFixedIncomeTaxCard`, `OrderDividendFields`, `OrderSplitFields`). |
| **Cadastro vs Edição e Governança de Ativo** | `src/features/investments/wizard/step-new-position.tsx` (`437L`) vs `asset-edit-dialog.tsx` (`822L`); `step-governance.tsx` (`359L`) vs `asset-score-evaluation-dialog.tsx` (`378L`) | Extrair `<AssetIdentityPricingFields />` e `<AssetGovernanceForm />` compartilhados entre Wizard e Diálogos de edição. |
| **Cards de Metas por Classe vs Setor** | `src/features/investments/components/targets/target-classes-card.tsx` (`309L`) vs `target-sectors-card.tsx` (`316L`) | Unificar em `<TargetDistributionCard />` parametrizado. |
| **Despesas de Viagem (Criar vs Editar vs Público)** | `src/features/trips/components/add-trip-expense-dialog.tsx` (`624L`) vs `edit-trip-expense-dialog.tsx` (`369L`) vs `src/features/public-share/components/add-public-trip-expense-dialog.tsx` (`309L`) | Extrair `<TripExpenseFormFields />` e `<TripSplitParticipantsList />` reutilizáveis e unificar upload/anexo via hook em `src/state/`. |
| **Extrato Individual de Membro na Viagem** | `src/features/trips/components/trip-member-statement-dialog.tsx` (`212L`) vs `src/features/public-share/components/public-trip-member-statement-dialog.tsx` (`233L`) | Unificar em `<TripMemberStatementModal />` único com `<MoneyText />` e grid responsivo `grid-cols-1 sm:grid-cols-3`. |
| **Detalhe/Edição de Despesa vs Receita** | `src/features/transactions/components/expense-detail-dialog.tsx` (`1.195L`) vs `income-detail-dialog.tsx` (`686L`) | Extrair constantes `GROUP_STYLE`, `TransactionAuditMetadataSection`, `TransactionDeleteScopeModal` e `<ReportWeightField />` compartilhados. |
| **Pipeline OCR + Compressão + Hash de Comprovante (`3x`)** | `src/components/modules/attach-receipt-dialog.tsx` (`L137–207`), `src/features/transactions/wizard/launch-wizard.tsx` (`L299–386`), `src/features/transactions/pages/share-target-page.tsx` (`L72–147`) | Extrair serviço único `resolveAndScanReceiptFile(file)` em `src/services/receipt-resolution.ts`. |
| **Checklist de Requisitos de Senha (`3x`)** | `src/features/auth/pages/register-page.tsx`, `src/features/auth/pages/reset-password-page.tsx`, `src/features/settings/components/account/change-password-modal.tsx` | Extrair `<PasswordRequirementsChecklist />` único em `src/features/auth/components/` (usando ícones Lucide sem `•`). |
| **Toasts Flutuantes de Atualização do App (`2x`)** | `src/components/modules/pwa-update-toast.tsx` (`47L`) vs `src/components/modules/native-update-toast.tsx` (`85L`) | Unificar em `<AppUpdateToast />` respeitando `isNativePlatform()`, `useActiveOverlays()` e janela de supressão de 12h. |
| **Botão Flutuante Voltar ao Topo (`2x`)** | `src/components/layout/back-to-top.tsx` (`69L`) vs `src/features/landing/components/back-to-top.tsx` (`45L`) | Excluir `src/features/landing/components/back-to-top.tsx` e usar exclusivamente `src/components/layout/back-to-top.tsx`. |
| **Download de APK e Deep-Links Legados (`3x`)** | `src/components/modules/app-download-modal.tsx:13`, `apk-install-guide-dialog.tsx:70`, `security-tab.tsx:222` (`guia-financeiro-release.apk`) + `shared-link-header-nav.tsx:45`, `split-onboarding-modal.tsx:60` (`com.guiafinanceiro.app://`) | Centralizar URL/scheme canônicos do Axir em `src/services/native/app-links.ts`. |
| **Identidade de Visitante em Links Públicos (`2x`)** | `src/features/public-share/hooks/use-public-split-guest-identity.ts` (`106L`) vs `use-public-trip-guest-identity.ts` (`106L`) | Unificar em `useGuestIdentityStore(scope, token)`. |
| **Roteamento de Alertas do Smart Advisor (`2x`)** | `src/components/modules/notifications-popover.tsx` (`L108–205`) vs `src/features/reminders/pages/reminders-page.tsx` (`L152–243`) | Unificar em `navigateAdvisorAlert(insight, navigate)` em `src/features/reminders/utils/`. |
| **Geração Pix BRCode + QR Code (`7+` cópias)** | `share-goal-dialog.tsx` (`4` cópias internas), `split-public-page.tsx`, `trip-public-page.tsx`, `trip-settlement-dialog.tsx`, `family-settlement-dialog.tsx`, `mfa-modal.tsx` (`renderQrCodeSvg` direto) | Centralizar builder Pix em `src/domain/pix/build-pix-transfer-code.ts` e renderizar sempre via `<QrCodeCanvas />`. |
| **Formatadores Locais de Data e Quantidade** | `formatDatePT`/`formatDateBR`/`formatISODatePtBR` recriados em `initial-pocket-cost-dialog.tsx:457`, `financial-close-report-modal.tsx:89`, `report-redemptions-table.tsx:14`, `trip-details-page.tsx:52`, `trip-card.tsx:18`; `formatQty` recriado em `4` arquivos de investimentos | Substituir por `formatDateBR` / `formatShortDate` de `@/lib/date` e `formatAssetQuantity` único em `@/services/formatting`. |
| **Confirmações Manuais Reinventando `<ConfirmDialog />` (`12+`)** | `account-tab.tsx:666`, `family-budget-share-card.tsx:421–504`, `family-settings-dialog.tsx:849–970`, `manage-contributions-dialog.tsx:425`, `share-goal-dialog.tsx:1181–1230`, `manage-split-dialog.tsx:1079`, `expense-detail-dialog.tsx:1110`, `income-detail-dialog.tsx:637` | Substituir todos os `<Modal size="sm">` manuais de confirmação pelo primitivo `<ConfirmDialog />` (com `elevated` quando empilhado). |

---

### A.2. Elementos de UI Redundantes, Intrusivos ou Obsoletos (`[Excluir]` / `[Padronizar]`)

1. **Propaganda e Cards de APK Android na Web Desktop / iOS (`[Excluir]` na Web Desktop/iOS / `[Padronizar]`):**
   - `src/components/modules/android-pro-banner.tsx` no carrossel da Home (`overview-page.tsx:403`): ocupa espaço nobre acima dos KPIs financeiros na Web; restringir ou remover do carrossel principal.
   - `src/components/modules/app-download-modal.tsx` (`L138–190`): exibe e recomenda download de `.apk` mesmo em iOS e macOS/Windows (inclusive destacando o APK quando o PWA já está ativo!). Ocultar card de APK fora do Android.
   - `src/features/settings/components/tabs/security-tab.tsx` (`L542–627`): `<PlatformsTriptychCard />` + botões `"Baixar APK"` / `"Como instalar"` / `"Versão 3.0.7"` na Web Desktop/iOS.
   - `src/features/settings/components/notifications/banking-assistant-card.tsx` (`L273–320`) e `src/components/layout/more-menu-sheet.tsx` (`L180`): banners promovendo leitura passiva de notificações Android para usuários em Desktop/iPhone.
2. **Modal Duplicado de Novidades Empilhado no 1º Login (`[Excluir]` mount automático):**
   - `src/components/modules/welcome-feature-modal.tsx` montado automaticamente em `overview-page.tsx:615`: colide sobre `<WelcomeModal>` (e `<NativeOnboardingDialog>` no APK) e anuncia recurso Android na Web. Remover montagem automática no login.
3. **Banners `"Fixar no Celular"` com Botão Morto em Desktop Web (`[Padronizar]` / `[Excluir]` no Desktop):**
   - `src/features/public-share/pages/family-budget-page.tsx:384` e `goal-tracker-public-page.tsx:472`: condição `(canInstall || isIOS || !isInstalled)` exibe o banner em qualquer PC com botão inoperante. Restringir estritamente a `canInstall || isIOS` em dispositivos móveis.
   - `src/features/public-share/components/shared-link-header-nav.tsx:86–105`: botão `"Abrir no App"` dispara custom scheme `com.guiafinanceiro.app://` mesmo em monitores Desktop (ocultar no Desktop).
4. **Animação Infinita `<LivePulseBeacon>` em Card Estático de Configuração (`[Excluir]` uso no card):**
   - `src/features/settings/components/appearance/visual-identity-card.tsx:100`: remover badge pulsante `"Tempo Real"` do card de escolha de tema (distração periférica contínua).
5. **Triplicidade de Botão `"Sair da Viagem"` na Mesma Tela (`[Excluir]` `2` cópias):**
   - `src/features/trips/pages/trip-details-page.tsx` (`L415`, `L645`, `L748`): manter apenas 1 ação destrutiva contextual na aba Participantes/Configurações.
6. **Botão Redundante de Lápis `28×28px` nas Linhas de Limite (`[Excluir]`):**
   - `src/features/budgets/components/tabs/budgets-limits-tab.tsx:436–446`: linha com duas `div[role="button"]` + botão `<Edit3 />` minúsculo (o próprio `LimitDialog` já possui o link `"Editar detalhes da categoria"`).
7. **Casca Dupla `<Card><EmptyState /></Card>` (`[Padronizar]`):**
   - `trip-details-page.tsx:557,633`, `cards-page.tsx:813`, `debts-page.tsx:403,453`: remover `<Card>` externo redundante (`EmptyState` já renderiza borda tracejada, raio `rounded-2xl` e padding próprios).

---

### A.3. Código Morto, Arquivos Órfãos, Estados/Props Mortas e CSS Morto (`[Excluir]`)

#### 1. Arquivos e Pastas `100%` Órfãos em Produção (`0` importações em `src/`)
- `src/features/settings/components/restore-wizard/restore-wizard-dialog.tsx` (`309L`)
- `src/features/settings/components/restore-wizard/restore-wizard-types.ts` (`37L`)
- `src/features/settings/components/restore-wizard/step-file-upload.tsx` (`174L`)
- `src/features/settings/components/restore-wizard/step-module-selection.tsx` (`166L`)
- `src/features/settings/components/restore-wizard/step-deduplication.tsx` (`182L`)
- `src/features/settings/components/restore-wizard/step-confirmation.tsx` (`151L`)
- `src/features/settings/components/restore-wizard/step-result.tsx` (`158L`)
- `src/features/settings/components/restore-wizard/index.ts` (Total da pasta órfã: **`1.180+` linhas** — excluir ou reconectar caso a restauração JSON volte ao escopo)
- `src/components/modules/install-app-button.tsx` (`149L`)
- `src/components/modules/quick-balance-adjustment-modal.tsx` (`162L`)
- `src/components/ui/content-loading.tsx` (`38L`)
- `src/components/ui/filter-toolbar.tsx` (`52L`)
- `src/features/landing/components/spotlight-card.tsx` (`62L` — órfão e com CSS `rgba(var(--primary))` inválido)
- `src/hooks/use-apk-promo.ts` (`62L`) + `src/domain/native/apk-promo.ts` (`58L` — usado apenas pelo próprio teste unitário; zero uso no app)
- `src/hooks/use-feature-flag.ts` (`24L`)
- `src/state/queries/use-app-mode.ts` (`31L`)
- `src/lib/storage-migration.ts` (`48L`)
- `src/features/budgets/components/budget-category-row.tsx` (`126L` — órfão porque seu código continua copiado inline em `budgets-limits-tab.tsx:375–471`; reativar o componente e excluir a cópia inline!)
- **35+ arquivos barrel `index.ts` sem nenhum consumidor** (`src/features/*/index.ts`, `src/features/*/pages/index.ts`, `src/components/routing/index.ts`, `src/domain/finance/index.ts`, `src/domain/accessibility/index.ts`).

#### 2. Estados, Props, Funções e Trechos Mortos Dentro de Arquivos Ativos
- `src/features/settings/pages/settings-page.tsx:142–143, 245–264`: estados `helpModalOpen` e `demoSelectOpen` + JSX `<HelpModal>` e `<DemoTrackSelectModal>` nunca acionados.
- `src/features/overview/components/overview-contextual-banners.tsx:18–19`: props `onOpenCardStatement` e `onNavigate` nunca lidas.
- `src/components/modules/portfolio/position-types.ts:77` + `resumo-tab.tsx:754`: prop `onDeleteAsset` enviada mas nunca desestruturada em `PositionTable`.
- `src/features/insights/components/diagnostics-tab.tsx:36` (`burnRate`) e `projection-tab.tsx:23` (`runwayMonths`): props declaradas e enviadas mas nunca lidas.
- `src/components/modules/qualified-dismiss-popover.tsx:19` (`className`), `src/components/modules/reports/report-stacked-bar.tsx:11` (`formattedValue`), `report-executive-summary.tsx:7` (`tone`) e `src/features/reminders/components/reminders-preferences-form.tsx:36` (`isInsideModal`): props mortas.
- `src/components/modules/aporte-result.tsx:1124`: wrapper `ReactNodeFragment` recriando `React.Fragment`.
- `src/features/reminders/pages/reminders-page.tsx:383–400, 497–504`: ramos `if (isLoading)` e `if (!preferences.enabled)` inalcançáveis.
- `src/features/landing/components/shared-finances-showcase.tsx:468–476`: `<Button>Página Pública</Button>` sem handler nem link.

#### 3. Classes Utilitárias CSS `100%` Mortas em `src/styles/globals.css`
- **25 seletores com `0` usos em todo `src/`:** `.icon-xs`, `.icon-sm`, `.icon-md`, `.icon-lg`, `.icon-xl`, `.icon-2xl`, `.icon-box-xs`, `.icon-box-sm`, `.icon-box-md`, `.icon-box-lg`, `.icon-box-xl`, `.icon-box-primary`, `.icon-box-muted`, `.icon-box-critical`, `.glow-primary`, `.spring-press`, `.z-base`, `.animate-live-pulse`, `.app-header`, `.modal-overlay`, `.dialog-overlay`, `.toaster`, `.print-hidden`, além do bloco comentado de 47 linhas da migração Tailwind v3 (`L680–726`).

---

## SEÇÃO CONSOLIDADA B: Catálogo de Arquivos Monolíticos (`> 250` Linhas) e Plano de Quebra (`[Refatorar]`)

> Todos os arquivos de interface, wizards e hooks de orquestração que ultrapassam o teto arquitetural de **250 linhas** (ou acumulam cálculo de domínio + estado + JSX), organizados por módulo com proposta cirúrgica de decomposição:

### B.1. Primitivos UI, Layout & Onboarding Compartilhado

| Arquivo Atual (Linhas) | Proposta Exata de Quebra (`domain/` · `hooks/` · `components/`) |
|---|---|
| `src/components/modules/demo-tour-spotlight.tsx` (`1.169L`) | Mover para `src/features/demo-tour/`: extrair `data/tour-steps-catalog.ts` (`~450L` de dados estáticos), `hooks/use-spotlight-target-rect.ts`, `SpotlightSvgMask.tsx`, `SpotlightStepCard.tsx` e `SpotlightCompletionCard.tsx`. |
| `src/components/modules/emergency-fund-config-dialog.tsx` (`509L`) | Mover para `src/features/overview/components/emergency-fund/`: `EmergencyTargetModeStep.tsx`, `EmergencyAssetsSelectorList.tsx` (corrigindo bug do `Checkbox`) e `use-emergency-fund-form.ts`. |
| `src/components/ui/date-picker.tsx` (`474L`) | Dividir em `date-picker.tsx` (trigger + popover), `calendar-month-grid.tsx` (grade de dias + atalhos) e `date-picker-utils.ts` (parsing/formatação). |
| `src/components/ui/skeleton.tsx` (`468L`) | Manter primitivo base `<Skeleton />` (`~80L`) em `ui/skeleton.tsx` e mover skeletons compostos de página (`OverviewSkeleton`, `InvestmentsSkeleton`, `TripsSkeleton`, `FamilySkeleton`, `InsightsSkeleton`, `RemindersSkeleton`, `RouteSkeletonFallback`) para `src/components/layout/route-skeletons/`. |
| `src/components/ui/modal.tsx` (`461L`) | Extrair `use-bottom-sheet-drag.ts` (física de arrasto e *rubber-band* respeitando `motionLevel`) e `modal-header-bar.tsx`, mantendo `modal.tsx` focado na composição Radix (`< 220L`). |
| `src/components/modules/demo-track-select-modal.tsx` (`431L`) | Mover para `src/features/demo-tour/`: `demo-tracks-metadata.ts`, `TrackOptionCard.tsx` e `TourOverviewTab.tsx`. |
| `src/hooks/use-visual-customization.ts` (`430L`) | Separar contrato/defaults em `src/domain/preferences/visual-defaults.ts`, storage local em `src/services/visual-storage.ts` e sincronização cloud em `use-visual-cloud-sync.ts`. |
| `src/components/modules/welcome-modal.tsx` (`392L`) | Mover para `src/features/onboarding/`: `WelcomeGoalStep.tsx`, `WelcomeTourConfirmStep.tsx` e `use-initial-onboarding.ts` (escopado por `userId`). |
| `src/components/layout/page-shell.tsx` (`369L`) | Extrair `DesktopTopbar.tsx`, `MobileTopbar.tsx` e `use-shell-onboarding-orchestrator.ts` (fila única impedindo modais simultâneos). |
| `src/components/layout/sidebar.tsx` (`368L`) | Extrair `SidebarNavGroup.tsx`, `SidebarSubscriptionCard.tsx` e catálogo `navigation-items.ts`. |
| `src/components/modules/daily-flow-chart.tsx` (`309L`) | Extrair geometria SVG para `src/domain/charts/daily-flow-geometry.ts` e tooltip interativo para `DailyFlowTooltip.tsx`. |
| `src/components/modules/support/support-chat-dialog.tsx` (`291L`) | Mover para `src/features/support/`: extrair `collectDeviceDiagnostics()` tipado em `src/services/diagnostics.ts` + view enxuta. |
| `src/components/layout/logo-profile-button.tsx` (`283L`) | Extrair `ProfileQuickLinksGrid.tsx` e `ProfileIdentityHeader.tsx`. |
| `src/components/modules/help-modal.tsx` (`264L`) | Extrair `help-faq-data.ts` e usar `<Accordion />` canônico. |
| `src/components/modules/apk-install-guide-dialog.tsx` (`263L`) | Separar `ApkStepsTab.tsx` e `PwaStepsTab.tsx` sobre `<Modal />`. |
| `src/components/layout/bottom-nav.tsx` (`262L`) | Extrair resolvedor contextual `resolve-fab-action.ts` (cobrindo `/viagens`, `/familia`, `/metas`) e `BottomNavItem.tsx`. |

### B.2. Dashboard, Modo Viagem & Orçamento Familiar

| Arquivo Atual (Linhas) | Proposta Exata de Quebra (`domain/` · `hooks/` · `components/`) |
|---|---|
| `src/features/family/components/family-settings-dialog.tsx` (`979L`) | Dividir em `settings/FamilyRulesTab.tsx`, `FamilyMemberProfileTab.tsx`, `FamilyMembersInvitesTab.tsx` e `FamilyDangerConfirmDialogs.tsx` (usando `<ConfirmDialog elevated />`). |
| `src/features/overview/hooks/use-smart-advisor-insights.ts` (`975L`) | Mover regras heurísticas puras para `src/domain/insights/smart-advisor-rules.ts` (com testes Vitest) e deixar o hook apenas conectando queries (`< 180L`). |
| `src/features/overview/pages/overview-page.tsx` (`909L`) | Extrair `OverviewKpiGrid.tsx`, `OverviewAlertsStack.tsx`, `OverviewChartsSection.tsx`, `OverviewPatrimonyStrip.tsx` e hook `use-overview-modals.ts`. |
| `src/features/trips/pages/trip-details-page.tsx` (`815L`) | Extrair `TripHeroSummaryCard.tsx`, `TripExpensesTab.tsx`, `TripParticipantsTab.tsx`, `TripShoppingChecklistTab.tsx` e `use-trip-details-actions.ts`. |
| `src/features/trips/components/trip-settlement-dialog.tsx` (`802L`) | Extrair `TripSettlementPlanList.tsx`, `TripPixPaymentPanel.tsx`, `TripSettlementHistoryTab.tsx` e `use-trip-settlement-actions.ts`. |
| `src/features/family/pages/family-invite-page.tsx` (`725L`) | Extrair `FamilyInviteShell.tsx` (elimina 9 cascas repetidas), `FamilyInviteStatusCard.tsx`, `FamilyInviteGuestLanding.tsx` e `FamilyInviteAcceptForm.tsx`. |
| `src/features/overview/hooks/use-overview-data.ts` (`674L`) | Separar seletores puros em `src/domain/overview/build-overview-metrics.ts` + sub-hooks `use-overview-cashflow.ts` e `use-overview-networth.ts`. |
| `src/features/trips/components/add-trip-expense-dialog.tsx` (`624L`) | Extrair `<TripExpenseFormFields />` e `<TripSplitParticipantsList />` (compartilhados com `EditTripExpenseDialog`) + mutation de upload em `src/state/`. |
| `src/features/settings/components/tabs/family-budget-share-card.tsx` (`507L`) | Mover para `src/features/family/components/budget-share/`: `FamilyCeilingForm.tsx` e `FamilyShareLinkControls.tsx` + `<ConfirmDialog />`. |
| `src/features/family/pages/family-page.tsx` (`398L`) | Extrair `FamilyHeaderToolbar.tsx` e `FamilyOnboardingEmptyView.tsx`. |
| `src/features/trips/components/edit-trip-expense-dialog.tsx` (`369L`) | Reutilizar `<TripExpenseFormFields />` e `<TripSplitParticipantsList />` (`< 160L`). |
| `src/features/trips/components/create-trip-dialog.tsx` (`313L`) | Extrair `TripDatesCurrencyFields.tsx` e `TripInitialMembersEditor.tsx`. |
| `src/features/family/components/family-settlement-dialog.tsx` (`304L`) | Extrair `FamilyPixTransferBox.tsx` (com `<QrCodeCanvas />`) e `use-family-settlement-plan.ts`. |
| `src/features/family/components/family-share-assets-dialog.tsx` (`292L`) | Extrair `FamilyAssetClassGrid.tsx` e `FamilyIndividualAssetsList.tsx`. |
| `src/features/overview/components/category-breakdown-dialog.tsx` (`266L`) | Extrair `CategoryTransactionsDrilldownList.tsx`. |

### B.3. Lançamentos, Calculadora, Racha, Cartões, Dívidas & Orçamentos

| Arquivo Atual (Linhas) | Proposta Exata de Quebra (`domain/` · `hooks/` · `components/`) |
|---|---|
| `src/features/transactions/wizard/launch-wizard.tsx` (`1.272L`) | Extrair `use-launch-wizard-state.ts`, `use-launch-wizard-submit.ts` (movendo `@/data` para `@/state`), `use-receipt-autofill.ts` e `WizardHeaderActions.tsx`. |
| `src/features/transactions/components/expense-detail-dialog.tsx` (`1.195L`) | Extrair `transaction-group-constants.ts`, `ExpenseEditForm.tsx`, `ExpensePriceEvolutionCard.tsx`, `TransactionDeleteScopeModal.tsx` e `use-expense-detail-actions.ts`. |
| `src/components/modules/manage-split-dialog.tsx` (`1.112L`) | Mover para `src/features/transactions/components/split/`: `use-manage-split.ts`, `SplitSummaryKpis.tsx`, `SplitParticipantRow.tsx` e `<ConfirmDialog />`. |
| `src/features/cards/pages/cards-page.tsx` (`1.050L`) | Extrair `use-cards-page-state.ts`, `use-card-subscription-radar.ts`, `InvoiceCompetenceToolbar.tsx` e `InvoiceItemsSection.tsx`. |
| `src/components/modules/split-expense-dialog.tsx` (`1.032L`) | Mover para `src/features/transactions/components/split/`: `use-split-expense-form.ts`, `SplitParticipantsEditor.tsx`, `SplitPixConfigFields.tsx` e `SplitGeneratedLinkView.tsx`. |
| `src/features/transactions/wizard/step-quick.tsx` (`813L`) | Extrair `LaunchContextSelector.tsx` (compartilhado com `StepDetails`), `QuickCategoryGrid.tsx` e `MerchantAutocompleteInput.tsx`. |
| `src/features/transactions/components/active-splits-card.tsx` (`782L`) | Extrair `use-active-splits.ts`, `ActiveSplitItemCard.tsx` e `src/services/split-share-actions.ts`. |
| `src/features/cards/components/statement-reconcile-step.tsx` (`768L`) | Unificar os 2 modais internos duplicados em `StatementItemFormDialog.tsx` + `StatementReconcileRow.tsx`. |
| `src/features/budgets/pages/budgets-page.tsx` (`760L`) | Extrair `use-budgets-overview.ts` e `BudgetCampaignsModalsHost.tsx`. |
| `src/features/transactions/pages/transaction-list-page.tsx` (`735L`) | Extrair `use-transaction-feed.ts`, `use-export-transactions-csv.ts`, `TransactionFeedGroup.tsx` e `RachaDemoModals.tsx`. |
| `src/features/transactions/wizard/step-details.tsx` (`719L`) | Reutilizar `LaunchContextSelector.tsx` e `<ReportWeightField />` + extrair `PaymentConditionSection.tsx` e `LinkedDebtSection.tsx`. |
| `src/features/transactions/components/income-detail-dialog.tsx` (`686L`) | Reutilizar `transaction-group-constants.ts` e `TransactionDeleteScopeModal.tsx` + `IncomeEditForm.tsx`. |
| `src/features/debts/pages/debts-page.tsx` (`577L`) | Extrair `DebtsUrgencyList.tsx`, `LoansTabContent.tsx` e `use-export-debts-csv.ts`. |
| `src/components/modules/floating-calculator.tsx` (`529L`) | Extrair `use-floating-calculator.ts`, `CalculatorKeypad.tsx`, `CalculatorInstallmentSplitter.tsx` e `CalculatorManualPasteDialog.tsx`. |
| `src/features/cards/components/card-form-dialog.tsx` (`515L`) | Reutilizar `<CreditCard3D disableTilt />` + `use-card-form-submit.ts`. |
| `src/features/budgets/components/tabs/budgets-limits-tab.tsx` (`493L`) | Reativar `<BudgetCategoryRow />` (excluindo `100L` duplicadas inline) + `BudgetsSummaryCard.tsx` e `BudgetReallocationBanner.tsx`. |
| `src/features/cards/components/statement-import-dialog.tsx` (`464L`) | Extrair `use-statement-import.ts` e `StatementUploadDropzoneStep.tsx`. |
| `src/features/debts/components/loan-edit-dialog.tsx` (`437L`) | Extrair `LoanContractFields.tsx` (compartilhado com `LoanFormDialog`), `LoanRenegotiationPreview.tsx` e `LoanRenegotiationHistoryCard.tsx`. |
| `src/components/modules/attach-receipt-dialog.tsx` (`410L`) | Mover para `features/transactions/components/` e extrair `src/services/receipt-resolution.ts`. |
| `src/features/transactions/wizard/wizard-state.ts` (`397L`) | Dividir em `wizard-types.ts`, `wizard-schemas.ts` e `wizard-builders.ts`. |
| `src/features/budgets/components/budget-adjust-dialog.tsx` (`350L`) | Extrair `use-budget-adjust.ts` e `BudgetAdjustPreviewList.tsx`. |
| `src/components/modules/credit-card-3d.tsx` (`313L`) | Extrair `EmvChip.tsx` e `CardBrandBadge.tsx` para `credit-card-parts.tsx`. |
| `src/features/budgets/components/category-form-dialog.tsx` (`299L`) | Extrair `CategoryFormFields.tsx` e ancorar `ModalFooter` na prop `footer`. |
| `src/features/debts/components/settle-dialog.tsx` (`292L`) | Extrair `DebtPenaltiesFields.tsx`. |
| `src/components/modules/credit-card-wallet.tsx` (`267L`) | Extrair `use-card-carousel.ts`. |

### B.4. Investimentos, Carteira, Metas, Insights, Relatórios & Lembretes

| Arquivo Atual (Linhas) | Proposta Exata de Quebra (`domain/` · `hooks/` · `components/`) |
|---|---|
| `src/features/investments/components/quick-transaction-sheet.tsx` (`1.494L`) | `domain/portfolio/fixed-income-redemption-preview.ts` + `use-quick-transaction-form.ts` + subformulários compartilhados com `StepOrder` (`OrderBuySellFields`, `OrderFixedIncomeTaxCard`, `OrderDividendFields`, `OrderSplitFields`). |
| `src/components/modules/position-table.tsx` (`1.465L`) | `domain/portfolio/position-grouping.ts` (unifica 3 `sortRows`) + `PositionToolbar.tsx`, `PositionDesktopRow.tsx` e `PositionGroupSection.tsx` único para classe/setor. |
| `src/features/goals/components/share-goal-dialog.tsx` (`1.253L`) | `domain/pix/build-goal-share-payload.ts` (elimina 4 cópias Pix) + `use-share-goal-actions.ts`, `ShareGoalActivePanel.tsx`, `ShareGoalForm.tsx` e `<ConfirmDialog />`. |
| `src/features/investments/components/asset-detail-sheet.tsx` (`1.179L`) | `use-asset-detail-metrics.ts` + `AssetHeroSummary.tsx`, `AssetPositionMetricsGrid.tsx`, `AssetGovernanceCard.tsx`, `AssetFixedIncomePanel.tsx` e `AssetTransactionsTimeline.tsx`. |
| `src/features/reports/components/wealth-tear-sheet-modal.tsx` (`1.160L`) | `domain/reports/build-tear-sheet-model.ts` + `TearSheetAllocationSection.tsx`, `TearSheetMethodologyGrid.tsx` e `TearSheetMovementStrip.tsx`. |
| `src/components/modules/aporte-result.tsx` (`1.157L`) | `use-aporte-simulation-overrides.ts` + `AporteSummaryKpis.tsx`, `AporteDesktopTable.tsx`, `AporteMobileCardList.tsx` e `AporteTreeBreakdown.tsx`. |
| `src/features/investments/pages/resumo-tab.tsx` (`1.130L`) | `use-resumo-deep-links.ts` + `PortfolioKpiStrip.tsx`, `PortfolioAllocationCard.tsx`, `CustodySectionCard.tsx` e `PortfolioIndicatorsGuideModal.tsx` (remove `168L` estáticas). |
| `src/features/investments/pages/proventos-tab.tsx` (`1.127L`) | `domain/portfolio/dividends-analytics.ts` + `DividendsHistoryPanel.tsx`, `DividendsProvisionPanel.tsx`, `DividendsSnowballPanel.tsx` e `DividendsCalendar12MPanel.tsx` (usando `<KpiCard />`). |
| `src/features/investments/components/initial-pocket-cost-dialog.tsx` (`1.092L`) | `domain/portfolio/statement-text-parser.ts` + `use-pocket-cost-import.ts`, `PocketStatementImportTab.tsx` e `PocketContributionsLedgerTab.tsx`. |
| `src/features/investments/components/portfolio-activity-panel.tsx` (`1.064L`) | `domain/portfolio/unified-activity-feed.ts` + `use-activity-filters-export.ts`, `ActivityFilterBar.tsx` e `ActivityRowItem.tsx`. |
| `src/features/reports/hooks/use-reports-data.ts` (`977L`) | Dividir em 4 hooks com `enabled` estrito por aba: `use-report-period-filter.ts`, `use-finance-report-data.ts`, `use-investment-report-data.ts` e `use-report-excel-payload.ts`. |
| `src/features/investments/wizard/investment-wizard.tsx` (`867L`) | `use-investment-wizard-submit.ts` + `WizardHeaderProgress.tsx` e `WizardNavigationFooter.tsx`. |
| `src/features/investments/pages/targets-tab.tsx` (`827L`) | `domain/portfolio/target-draft-math.ts` + `use-targets-draft-state.ts`, `TargetsUnsavedStickyBar.tsx` e `TargetsOverviewDonutPanel.tsx`. |
| `src/features/investments/components/asset-edit-dialog.tsx` (`822L`) | Reutilizar `<AssetIdentityPricingFields />` com `StepNewPosition` + `AssetDividendEstimateFields.tsx` e `use-asset-edit-submit.ts`. |
| `src/features/investments/wizard/step-order.tsx` (`796L`) | Consumir subformulários de ordem compartilhados com `QuickTransactionSheet`. |
| `src/features/investments/components/portfolio-import-dialog.tsx` (`792L`) | `domain/portfolio/b3-csv-parser.ts` + `use-portfolio-csv-import.ts`, `ImportUploadStep.tsx` e `ImportPreviewTableStep.tsx`. |
| `src/features/investments/components/portfolio-executive-report.tsx` (`711L`) | `domain/reports/monthly-portfolio-statement.ts` + `ExecutiveReportPeriodBar.tsx` e `ExecutiveReportCustodySection.tsx`. |
| `src/features/reminders/pages/reminders-page.tsx` (`689L`) | `navigate-advisor-alert.ts` + `use-reminders-actions.ts`, `AdvisorReminderCard.tsx`, `RemindersPendingTab.tsx` e `RemindersReadTab.tsx`. |
| `src/features/insights/pages/insights-page.tsx` (`677L`) | Mover `340L` de cálculos para `domain/insights/build-insights-dashboard.ts` + `use-insights-dashboard-data.ts`. |
| `src/features/investments/wizard/step-select.tsx` (`672L`) | `AssetQuickPickGrid.tsx` (elimina bloco duplicado de `48L`) e `AssetSearchComboboxList.tsx`. |
| `src/features/investments/wizard/wizard-state.ts` (`608L`) | Mover `250L` de cálculos fiscais/PM para `src/domain/portfolio/wizard-calculations.ts`, mantendo apenas estado/reducer (`< 180L`). |
| `src/components/modules/notifications-popover.tsx` (`600L`) | Mover container conectado para `features/reminders/components/NotificationsBellPopover.tsx` + `BroadcastNotificationRow.tsx`, `SupportReplyRow.tsx` e `AdvisorNotificationRow.tsx`. |
| `src/features/insights/components/recurrences-tab.tsx` (`597L`) | `domain/insights/map-occurrence-item.ts` + `RecurrencesKpiBanner.tsx` e `CollapsibleOccurrenceSection.tsx`. |
| `src/features/insights/components/recurrence-audit-modal.tsx` (`568L`) | `RecurrenceClassificationBar.tsx`, `RecurrenceMetricsStrip.tsx` e `RecurrenceHistoryList.tsx`. |
| `src/features/investments/components/portfolio-snapshots-dialog.tsx` (`562L`) | Migrar para `<ReportDocumentLayout>` (corrigindo impressão em branco) + `SnapshotsEvolutionChart.tsx` e `SnapshotsLedgerTable.tsx`. |
| `src/features/investments/components/monthly-closing-editor.tsx` (`558L`) | `use-monthly-closing-draft.ts` + `ClosingSummaryHeader.tsx` e `ClosingAssetRowEditor.tsx`. |
| `src/features/investments/pages/aporte-tab.tsx` (`546L`) | `domain/portfolio/aporte-execution-mapper.ts` + `use-aporte-allocator.ts` e `AporteInputCard.tsx`. |
| `src/components/modules/category-donut.tsx` (`535L`) | Consumir `<DonutRing />` + `CategoryDonutLegend.tsx` e `CategoryDonutTooltip.tsx`. |
| `src/features/reports/components/financial-close-report-modal.tsx` (`516L`) | `FinancialDreTable.tsx`, `FinancialCompositionTables.tsx` e `FinancialPaidInvoicesSection.tsx`. |
| `src/features/reports/pages/reports-page.tsx` (`490L`) e `report-performance-chart.tsx` (`490L`) | `use-report-modals-state.ts` + `ReportsModalsHost.tsx`; `PerformanceSvgBars.tsx` e `PerformanceBenchmarksPanel.tsx`. |
| `src/features/reports/components/tabs/investments-tab.tsx` (`480L`) e `goal-composition-dialog.tsx` (`480L`) | `AllocationGapTreeTable.tsx` + `InvestmentsDeepBreakdowns.tsx`; `use-goal-asset-selection.ts` + `SelectableAssetRow.tsx`. |
| `src/components/modules/export-data-hub.tsx` (`476L`), `report-class-tables.tsx` (`460L`), `manage-contributions-dialog.tsx` (`459L`), `reminders-preferences-form.tsx` (`448L`) | `<CsvExportCard />` único (remove `55L` duplicadas); `ReportEquityClassTable.tsx` único; `use-goal-contributions-crud.ts` + `ContributionHistoryRow.tsx`; `InAppRemindersPrefsCard.tsx` + `DailyClosingReminderCard.tsx`. |
| Demais arquivos `255L–437L` do Módulo 7 (`step-review`, `step-new-position`, `interactive-target-donut`, `convert-recurrence-dialog`, `report-allocation-donuts`, `financial-tab`, `asset-score-evaluation-dialog`, `campaign-card`, `step-governance`, `report-*-breakdown-card` x3, `portfolio-insights-carousel`, `tax-facilitator-modal`, `portfolio-snapshots-carousel`, `contribution-form-dialog`, `position-mobile-card`, `target-*-card` x2, `allocation-breakdown-dialog`, `insight-list`, `portfolio-darf-monitor`, `fixed-income-form-fields`, `investments-page`, `cash-form-dialog`, `pending-dividends-dialog`, `portfolio-mapping-step`, `assistant-memory-section`, `report-donut-chart`) | Reduzidos automaticamente abaixo de `200L` pela extração dos componentes unificados da **Tabela A.1** (`<DonutRing />`, `<ReportExposureBreakdownCard />`, `<AssetGovernanceForm />`, `<TargetDistributionCard />`) e separação de cálculo puro para `src/domain/`. |

### B.5. Configurações, Auth, Assinatura, Landing, Ferramentas, Public Share & Admin

| Arquivo Atual (Linhas) | Proposta Exata de Quebra (`domain/` · `hooks/` · `components/`) |
|---|---|
| `src/features/subscription/pages/subscription-checkout-page.tsx` (`1.169L`) | `use-subscription-checkout.ts` + `CheckoutPlanSummarySidebar.tsx`, `CheckoutInlineAuthStep.tsx`, `CreditCardCheckoutForm.tsx` e `PixQrWaitingPanel.tsx`. |
| `src/features/admin/components/user-edit-dialog.tsx` (`1.073L`) | `user-edit/UserPiiAuditVaultCard.tsx`, `UserSaasPlanSection.tsx`, `UserModulePermissionsMatrix.tsx`, `UserSuperadminSupportActions.tsx` e `UserAccountStatusSection.tsx`. |
| `src/features/settings/components/tabs/subscription-tab.tsx` (`1.017L`) | `CurrentPlanHeroCard.tsx`, `PaymentMethodCard.tsx`, `BillingHistoryCard.tsx`, `UpdateCardModal.tsx` e `CancelSubscriptionWizardModal.tsx`. |
| `src/features/landing/components/shared-finances-showcase.tsx` (`786L`) | `SplitMockupPreview.tsx`, `TripMockupPreview.tsx` e `FamilyGoalMockupPreview.tsx`. |
| `src/features/settings/components/tabs/account-tab.tsx` (`721L`) | `use-account-profile-actions.ts` + `ProfileIdentityCard.tsx`, `AccountCredentialsCard.tsx` e `SetPasswordModal.tsx`. |
| `src/features/settings/components/notifications/banking-assistant-card.tsx` (`710L`) | `use-banking-assistant-settings.ts` + `BankingPermissionBanner.tsx`, `BankingDetectionRulesSection.tsx` e `BankingSyncHistoryList.tsx`. |
| `src/features/tools/pages/rebalance-simulator-page.tsx` (`694L`) | `RebalanceAssetRowList.tsx`, `RebalanceAllocationSummary.tsx` e `RebalanceTradePlanCard.tsx`. |
| `src/features/public-share/pages/goal-tracker-public-page.tsx` (`693L`) | `GoalThermometerHeroCard.tsx`, `GoalPixContributionSidebar.tsx` e `<PublicPwaShortcutCard />` compartilhado. |
| `src/features/public-share/pages/trip-public-page.tsx` (`662L`) | `domain/pix/build-trip-settlement-pix.ts` + `PublicTripHeroCard.tsx`, `PublicTripExpensesList.tsx` e `PublicTripSettlementsCard.tsx`. |
| `src/features/settings/components/tabs/security-tab.tsx` (`641L`) | `domain/export/csv-period-export.ts` + `TwoFactorSecurityCard.tsx`, `AppLockSecurityCard.tsx` e `DataPrivacyExportCard.tsx`. |
| `src/features/public-share/pages/split-public-page.tsx` (`625L`) | `use-public-split-actions.ts` + `SplitInstallmentsPublicCard.tsx` e `SplitPixPaymentCard.tsx`. |
| `src/features/settings/components/security/mfa-modal.tsx` (`617L`) | `use-mfa-enrollment-flow.ts` + `MfaPasswordGateStep.tsx`, `MfaQrEnrollStep.tsx`, `MfaRecoveryCodesStep.tsx` e `MfaActiveStatusStep.tsx`. |
| `src/features/landing/components/fire-projection-curve.tsx` (`605L`) | `domain/simulators/fire-curve.ts` + `FireControlsToolbar.tsx` e `FireInteractiveSvgChart.tsx`. |
| `src/features/auth/pages/login-page.tsx` (`564L`) e `register-page.tsx` (`538L`) | `use-login-flow.ts`, `LoginCredentialsForm.tsx`, `LoginMfaChallengeStep.tsx`; `use-register-submit.ts`, `RegisterFormFields.tsx` e `<PasswordRequirementsChecklist />`. |
| `src/features/tools/pages/debt-simulator-page.tsx` (`518L`) | `DebtItemEditorList.tsx`, `DebtStrategyComparisonCards.tsx` e `PayoffTimelineCard.tsx`. |
| `src/features/public-share/pages/family-budget-page.tsx` (`449L`), `minimal-wealth-simulator.tsx` (`447L`), `active-devices-card.tsx` (`420L`), `landing-header.tsx` (`411L`) | `FamilyBudgetHeroCard.tsx` + `FamilyBudgetExpensesCard.tsx`; `SimulatorScenarioCards.tsx` + `SimulatorInputsPanel.tsx`; `DeviceSessionRow.tsx` + `domain/settings/user-agent-parser.ts`; `LandingMobileDrawer.tsx`. |
| Demais arquivos `253L–363L` do Módulo 8 (`split-onboarding-modal` `363L`, `admin-backups-page` `347L`, `visual-identity-card` `337L`, `privacy-page` `337L`, `invites-tab` `333L`, `user-create-dialog` `325L`, `create-invite-dialog` `316L`, `add-public-trip-expense-dialog` `309L`, `cumulative-renewal-card` `306L`, `admin-notifications-page` `281L`, `ticket-manage-dialog` `279L`, `settings-page` `273L`, `interface-shortcuts-card` `272L`, `subscription-success-page` `265L`, `reset-password-page` `260L`, `admin-dashboard-page` `257L`, `admin-users-page` `253L`) | Extrair formulários/listas de subpasso (`SplitQuickAuthForm`, `BackupHistoryList`, `ThemeModeSelector` + `AccentPaletteSelector`, `InvitesDesktopTable`, `UserProvisionForm`, `ModuleWhitelistEditor`, `PublicExpenseSplitSelector`, `PixRenewalCheckoutModal`, `BroadcastComposerForm`, `settings-routes.ts`, `ShortcutToggleRow`), mantendo cada arquivo enxuto (`< 180L`). |

---

## 9. APÊNDICE: CORREÇÕES COMPLEMENTARES DE POLIMENTO E RESPONSIVIDADE (PÓS-AUDITORIA)

Durante a homologação visual em dispositivos móveis reais, foram identificados e resolvidos 4 pontos finos de congruência visual, responsividade e estabilidade de animação:

1. **Responsividade Estrita de Rodapés de Modais com Múltiplas Ações (`expense-detail-footer.tsx`, `income-detail-dialog.tsx`, `modal-footer.tsx`):**
   - **Causa Raiz:** O seletor descendente `[&_button]:w-full` em `ModalFooter` forçava largura integral em botões de toolbars aninhadas no mobile, entrando em conflito com `shrink-0` e provocando estouro horizontal da viewport em telas $< 400\text{px}$.
   - **Correção Canônica:** Restrição para seletor de filhos diretos `[&>button]:w-full [&>button]:sm:w-auto`. Nas barras de ações compostas (`expense-detail-footer.tsx` e `income-detail-dialog.tsx`), os botões de ícone secundários receberam `shrink-0`, enquanto o botão de edição principal recebeu `flex-1 min-w-0 sm:flex-initial sm:w-auto sm:min-w-[100px]` com texto `truncate` e ícone `shrink-0`, garantindo ajuste perfeito sem qualquer transbordamento horizontal.
2. **Padronização Canônica de Gráficos Donut de Metas e Classes (`interactive-target-donut.tsx`):**
   - **Causa Raiz:** O componente utilizava uma implementação isolada com terminais retos (`butt`), espessura divergente e uma casca interna de card (`border border-border/80 bg-surface shadow-xs`) redundante dentro da aba de investimentos.
   - **Correção Canônica:** Unificado com a arquitetura canônica `CategoryDonut` (`buildCategoryDonutArcs`, `viewBox="0 0 160 160"`, raio 72.5, espessura 15, terminais arredondados `strokeLinecap="round"`), removendo a borda de card aninhada e adicionando acessibilidade SVG (`role="button"`, `tabIndex={0}`, `aria-label`).
3. **Padronização Visual de Botões no Modo Viagem (`trip-list-page.tsx`, `trip-details-header-actions.tsx`, `trip-details-empty-views.tsx`, `trip-expenses-tab.tsx`):**
   - **Causa Raiz:** Uso indevido da variante `variant="solid"` (que gerava blocos brancos sólidos com texto preto no tema Dark/OLED, destoando do sistema de design).
   - **Correção Canônica:** Substituição pelos botões canônicos primários padrão (`variant="default"` com `shadow-xs`), harmonizando com a identidade visual sóbria do Axir.
4. **Estabilidade de Spotlight no Tour Guiado para Elementos em Modais/Bottom Sheets (`use-spotlight-target-rect.ts`, `tour-steps.ts`, `launch-context-selector.tsx`):**
   - **Causa Raiz:** A estabilização de scroll do spotlight monitorava exclusivamente `#main-content.scrollTop`. Em elementos situados dentro de modais/drawers, a rolagem ocorre no container interno (`scrollRef`), mantendo `main-content.scrollTop = 0` e causando medição prematura (em ~32ms) enquanto a animação do bottom sheet (`translateY(100%)` a `0`, 250ms) ainda estava em curso, posicionando o holofote fora da viewport visível.
   - **Correção Canônica:** Implementado rastreamento de centroide por quadros sucessivos em `use-spotlight-target-rect.ts`, medições redundantes de segurança aos 300ms e 550ms, escuta com `{ capture: true }` para rolagens de qualquer container e escuta a `animationend`/`transitionend`. Adicionados seletores canônicos `data-tour="launch-context-selector"` e seletores de fallback em `tour-steps.ts`.

---

## 10. APÊNDICE: ERRADICAÇÃO DE TRUNCAMENTO CEGO, ERGONOMIA DE BANNERS E FILTROS DE ATIVOS

Em complemento às homologações em aparelhos físicos, foram refinados 4 aspectos visuais críticos de leitura e controle tátil:

1. **Erradicação Transversal de Truncamento Cego em Alertas e Banners (`insight-slide.tsx`, `cash-gap-alert.tsx`, `pace-alert-banner.tsx`, `surplus-aporte-banner.tsx`, `permissions-alert-banner.tsx`, `android-pro-banner.tsx`, `trial-ending-banner.tsx`, `portfolio-governance-banner.tsx`):**
   - **Causa Raiz:** Uso de `truncate` ou `line-clamp-1` rígido na descrição de avisos, cortando o raciocínio explicativo e valores monetários com reticências (`...`) após ~25 caracteres no mobile.
   - **Correção Canônica:** Unificação com `line-clamp-2 sm:line-clamp-1 text-xs text-muted-foreground leading-relaxed break-words`, permitindo leitura confortável de até 2 linhas completas no smartphone e linha única limpa no desktop.
2. **Posicionamento Canônico do Botão de Fechar/Dispensar nos Slides de Insight (`insight-slide.tsx`):**
   - **Causa Raiz:** O botão `X` (com popover de 7/30 dias) era renderizado dentro do contêiner `actions` no rodapé do slide, colado ao lado do botão primário ("Simular com Caixa").
   - **Correção Canônica:** Mover o botão `X` para o canto superior direito com `absolute top-3 right-3 sm:static`, e adicionar zona de exclusão `pr-8 sm:pr-0` no título. A linha inferior agora pertence exclusivamente ao botão de ação primário com largura de toque completa no mobile (`w-full sm:w-auto`).
3. **Seletores da Tabela de Posição de Ativos sem Rolagem Lateral no Mobile (`position-toolbar.tsx`):**
   - **Causa Raiz:** No mobile, uma fita de chips com `overflow-x-auto flex-nowrap` competia com o alternador de agrupamento, forçando rolagem horizontal desajeitada e ocultando classes e o botão de posições encerradas.
   - **Correção Canônica:** No mobile ($< 640\text{px}$), substituído por um `<Select>` compacto e elegante integrado ao lado do alternador `[Por Classe | Por Setor]` (zero scroll lateral, 100% visível na tela). No desktop, mantidos chips em linha com `variant="default"` e `outline`.
4. **Erradicação de `variant="solid"` em Empty States e Ações Primárias (`dividends-history-panel.tsx`, `family-onboarding-empty-view.tsx`, `family-invite-*.tsx`, `target-distribution-card.tsx`):**
   - **Causa Raiz:** Botões de ação em estados vazios utilizando `variant="solid"`, gerando blocos brancos estourados em Dark/OLED mode.
   - **Correção Canônica:** Substituídos pela variante canônica padrão (`variant="default"` com `shadow-xs`), restabelecendo elegância e conforto ocular em todos os modos de tema.

---

## 11. APÊNDICE: RESPONSIVIDADE EM TABLETS, SELETOR ADAPTATIVO E PRIMITIVO SEGMENTEDCONTROL (BUILD 74)

Em resposta à homologação em telas intermediárias (tablets ~640px a 1024px — `sm` a `lg`), foram solucionados os pontos de quebra de layout e padronizados os componentes estruturais do app:

1. **Resolução de Quebra de Layout no Tablet em `PositionToolbar` (`position-toolbar.tsx`):**
   - **Causa Raiz:** No breakpoint `sm:` (640px), o componente forçava alinhamento horizontal único de 3 blocos (`[Por Classe | Por Setor]` + 5 chips de classe + `[Ver encerradas (2)]`), exigindo ~840px de largura. Em telas de tablet (768px em retrato), as pílulas sofriam `flex-wrap` assimétrico, derrubando a última classe para uma linha isolada embaixo enquanto o botão de encerradas permanecia no topo direito.
   - **Correção Canônica:** Implementado layout adaptativo em 3 estágios:
     - **Mobile (< 640px):** Segmentado full-width + `<Select>` dropdown para classes + botão de encerradas embaixo.
     - **Tablet (640px a 1023px — `sm` e `md`):** Segmentado à esquerda + `<Select>` compacto (`w-44` a `w-48`) à direita integrado ao botão de encerradas (largura necessária ~520px vs ~768px disponíveis — zero quebra e zero scroll lateral).
     - **Desktop (≥ 1024px — `lg`):** Chips rápidos inline completos em linha única garantida.
2. **Criação do Primitivo Canônico `SegmentedControl` (`src/components/ui/segmented-control.tsx`):**
   - **Causa Raiz:** Diversos seletores segmentados no app (`PositionToolbar`, `PortfolioAllocationCard`, `AporteResult`, `FinancialPeriodToolbar`, `TargetDistributionCard` e `TargetAssetsCard`) utilizavam marcações HTML manuais, `<button>` crus ou classes CSS duplicadas, incluindo resquícios de `variant="solid"`.
   - **Correção Canônica:** Primitivo `SegmentedControl<T>` com casca unificada `rounded-xl border border-border/80 bg-muted/50 p-0.5 shadow-xs`, botões `variant="default"` ativos com `shadow-xs font-semibold` e `variant="ghost"` inativos, suporte a ícones, atalhos de acessibilidade (`role="group"`, `aria-pressed`) e feedback tátil `triggerSensory("selection")` automático na alternância.
3. **Erradicação Ampla de `variant="solid"` em Filtros, Cards e Configurações (`target-distribution-card.tsx`, `target-assets-card.tsx`, `plan-comparison-card.tsx`, `current-plan-hero-card.tsx`, `change-email-modal.tsx`, `update-card-modal.tsx`, `dividends-history-panel.tsx`):**
   - **Causa Raiz:** Resquícios de `variant="solid"` em chips de filtro e botões de ação secundária gerando blocos brancos de alto contraste no tema escuro.
   - **Correção Canônica:** Substituídos por `SegmentedControl` ou `variant="default"` com `shadow-xs`, reservando `variant="solid"` exclusivamente para botões de submissão primária de autenticação e checkout.
4. **Harmonização de Alertas e Rosca Donut no Tablet (`insight-slide.tsx`, `interactive-target-donut.tsx`):**
   - **`InsightSlide`:** O botão dispensar (`X`) permanece ancorado no canto superior direito no mobile e no tablet (`absolute top-3 right-3 lg:static`) com zona de exclusão `pr-8 lg:pr-0`, liberando toda a largura horizontal da linha para a descrição e os botões de ação.
   - **`InteractiveTargetDonut`:** A transição para rosca + legenda lado a lado foi ajustada para `md:flex-row`, mantendo centralização vertical equilibrada em larguras menores e impedindo que a legenda de classes seja espremida lateralmente pela rosca no tablet.



