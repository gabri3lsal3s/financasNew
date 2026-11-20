# DESIGN_RULES.md — Bíblia Visual Oficial & Contrato de UI/UX do Axir

> **Status:** Contrato Canônico Único de Design, Ergonomia e Conforto Visual (`v3.1`).
> **Escopo:** Vincula 100% das páginas autenticadas, rotas públicas (Landing, Simuladores, Links Compartilhados, Legal), Painel Admin, Modais, Bottom Sheets, Popovers, Tooltips, Formulários e Microinterações do **Axir** (`axir.com.br`).
> **Fontes de Implementação:** `src/styles/tokens.css` · `src/styles/globals.css` · `src/domain/theme/theme-resolver.ts` · `src/services/sensory.ts` · `src/components/ui/`.

---

## 1. TOKENS VISUAIS E CONFORTO OCULAR

O Axir foi projetado para leitura frequente de dados patrimoniais e tomada de decisão calma. A identidade cromática (**Azul Petróleo, Teal Vital, Ouro Âmbar e Coral Suave**) prioriza o conforto fisiológico da visão em sessões diurnas e noturnas, eliminando contrastes estourados (*halation*) e fadiga cromática (*accent fatigue*).

### 1.1 Modos de Tema Obrigatórios e Resolução Sem FOUC

O motor puro `src/domain/theme/theme-resolver.ts` e o `ThemeProvider` (`src/app/theme-provider.tsx`), sincronizados desde o primeiro frame via bootstrap inline no `<head>` do `index.html`, devem suportar obrigatoriamente:

1. **Dark Mode Padrão (`data-theme="dark"` — "Abissal Teal"):**
   - Referência padrão de conforto ocular do produto e variante escura oficial.
   - Utiliza base petróleo-ardósia profunda (`#0C1923`), **nunca preto absoluto `#000000`**, eliminando o efeito halo (*halation* em usuários com astigmatismo) e o arrasto de pixels (*black smearing*) na rolagem.
2. **Light Mode (`data-theme="light"` — "Vital Petróleo & Ouro"):**
   - Utiliza base ardósia acetinada off-white (`#F4F7F9`) e texto em Azul Petróleo Profundo (`#142531`), evitando o brilho estourado de telas 100% brancas (`#FFFFFF`) com texto preto puro (`#000000`).
3. **Detecção Automática do Sistema (`preference = "system"`):**
   - Escuta `window.matchMedia("(prefers-color-scheme: dark)")` em tempo real, resolvendo para `light` no período claro do SO e para a variante escura preferida (`dark` por padrão) no modo escuro do SO. Em ambientes onde a preferência do sistema não puder ser aferida, o fallback seguro deve ser `dark`.
4. **Agendamento Automático por Horário (`preference = "schedule"`):**
   - Alterna deterministicamente entre janela diurna (`dayStart`, padrão `06:00` → `light`) e janela noturna (`nightStart`, padrão `18:00` → `darkThemeVariant`), suportando janelas convencionais e invertidas, com reavaliação silenciosa a cada 30 segundos sem piscar a tela.
5. **Variante Opcional OLED (`data-theme="oled"` — Opt-in Estrito):**
   - Exclusiva para escolha deliberada do usuário que prioriza economia extrema em painéis AMOLED. Mesmo neste modo, o texto principal **nunca** usa `#FFFFFF` puro (teto em `0 0% 94%` / `#F0F0F0`) e cards usam relevo neutro (`#0C0C0E` + bordas `#262626`) para mitigar *halation*.

> **Sincronização Nativa e Web:** toda troca efetiva de tema atualiza simultaneamente `document.documentElement.dataset.theme`, `style.colorScheme`, todas as tags `<meta name="theme-color">` e a barra de status nativa (`syncStatusBarTheme`).

### 1.2 Paleta Oficial de Superfícies, Bordas e Texto (Conforto Ocular WCAG AA)

| Token CSS | Utilitário Tailwind | Light ("Vital Petróleo") | Dark Padrão ("Abissal Teal") | OLED (Opt-in) | Papel Estrito |
|---|---|---|---|---|---|
| `--background` | `bg-background` | `204 29% 97%` (`#F4F7F9`) | `206 49% 9%` (`#0C1923`) | `0 0% 0%` (`#000000`) | Fundo global da janela/página |
| `--surface` | `bg-surface` | `204 33% 99%` (`#FBFCFD`)* | `206 42% 15%` (`#162836`) | `0 0% 5%` (`#0D0D0D`) | Cards de dados, modais, tabelas, inputs |
| `--surface-raised` | `bg-surface-raised` | `204 25% 96%` (`#EFF4F7`) | `206 38% 19%` (`#1D3445`) | `0 0% 9%` (`#171717`) | Sub-cards internos dentro de modais/wizards |
| `--surface-hover` | `bg-surface-hover` | `200 22% 94%` (`#EDF2F4`) | `206 41% 19%` (`#1D3445`) | `0 0% 9%` (`#171717`) | Estado `:hover` de linhas e controles |
| `--surface-active` | `bg-surface-active` | `200 20% 90%` (`#E0E8EC`) | `204 39% 23%` (`#244053`) | `0 0% 13%` (`#212121`) | Estado `:active` / pressionado |
| `--muted` | `bg-muted` | `200 20% 95%` (`#F0F4F6`) | `206 42% 12%` (`#111F2A`) | `0 0% 7%` (`#121212`) | Fundos sutis de apoio, trilhas e skeletons |
| `--border` | `border-border` | `200 18% 87%` (`#D7E1E6`) | `208 36% 21%` (`#23384A`) | `0 0% 18%` (`#2E2E2E`) | Divisores estruturais e bordas de cards (`border-border/80`) |
| `--input` | `border-input` | `200 16% 79%` (`#C2D0D7`) | `208 34% 26%` (`#2C4459`) | `0 0% 24%` (`#3D3D3D`) | Contorno de campos de formulário |
| `--foreground` | `text-foreground` | `205 42% 14%` (`#142531`) | `199 39% 94%` (`#E8F1F5`) | `0 0% 94%` (`#F0F0F0`)* | Texto primário (contraste confortável 12:1–14:1, sem estourar 21:1) |
| `--muted-foreground` | `text-muted-foreground` | `215 26% 35%` (`#475569`) | `204 22% 68%` (`#9DB2C0`) | `0 0% 60%` (`#999999`) | Rótulos secundários, legendas e metadados (≥ 5.3:1 AA) |

*\*Nota: ver Seção 6 (Curadoria de Melhorias Sutis) sobre a calibração fina de `--surface` no Light Mode e `--foreground` no OLED.*

### 1.3 Cores de Marca, Acentos e Semânticas Financeiras

As cores semânticas financeiras possuem significado imutável em todo o aplicativo. **É proibido inverter ou reutilizar cores financeiras para estados genéricos de UI.**

| Domínio Semântico | Token Visual (Ícones, Barras, Fills `/10`–`/15`) | Token Tipográfico AA (Textos Pequenos e Badges) | Light (Base / Strong) | Dark & OLED (Base / Strong) | Uso Exclusivo |
|---|---|---|---|---|---|
| **Marca / Interação** | `--primary` | `--primary-strong` | `#2A9D8F` / `#1B6B62` | `#2DD4BF` / `#2DD4BF` | Estados ativos, foco (`--ring`), links, CTAs principais |
| **Destaque Executivo** | `--accent` | `--accent-foreground` | `#DDA726` / `#142531` | `#F3C352` / `#4A3605` | Selo Pro, órbita da marca e glow único de KPI (`shadow-kpi`) |
| **Receita / Positivo** | `--positive` | `--positive-strong` | `#2A9D8F` / `#1B6B62` | `#2DD4BF` / `#2DD4BF` | Entradas, rendas, poupança, metas cumpridas, quitação |
| **Despesa / Saída** | `--negative` | `--negative-strong` | `#E76F51` / `#B23A2A` | `#FB7185` / `#FB7185` | Saídas, débitos, variação negativa de fluxo |
| **Alerta / Atenção** | `--warning` | `--warning-strong` | `#E9C46A` / `#92400E` | `#F59E0B` / `#F59E0B` | Consumo ≥ 85% do teto, vencimento próximo, modo leitura |
| **Crítico / Erro** | `--critical` | `--critical-strong` | `#EF4444` / `#B91C1C` | `#F87171` / `#F87171` | Atraso (`overdue`), estouro de orçamento, erro de campo, exclusão |
| **Patrimônio / Carteira** | `--portfolio` | `--portfolio-strong`* | `#0284C7` / `#1B3A4B` | `#38BDF8` / `#38BDF8` | Investimentos, aportes, rebalanceamento e metas patrimoniais |

*\*Contrato Obrigatório de Token:* todo token semântico usado em texto (`primary`, `positive`, `negative`, `warning`, `critical`, `portfolio`) **deve** expor o par `<token>` e `<token>-strong` em `tokens.css` e `@theme inline` (`globals.css`), garantindo contraste mínimo **4.5:1 (WCAG AA)** para textos pequenos no Light Mode.
- **Categorias (`--cat-1` a `--cat-10`):** escala fechada de 10 cores harmônicas (`bg-cat-1`..`bg-cat-10`). Proibido criar cores avulsas fora desta escala para gráficos ou categorias.
- **Acentos personalizáveis oficiais (`data-accent`):** `teal` (padrão oficial), `gold` (ouro nobre) e `mono` (monocromático) devem ser persistidos tanto no `localStorage` quanto em `user_preferences.custom_settings`. Paletas que colidem com semântica de receitas/despesas foram permanentemente removidas para assegurar consistência visual executiva.

### 1.4 Elevação, Sombras, Backdrop e Escala Z-Index

1. **Superfície Canônica de Cards de Dados:**
   - Todo card de dados adota obrigatoriamente a trinca `rounded-xl` (ou `rounded-2xl` em Hero KPIs) + `border border-border/80 bg-surface shadow-xs`.
   - **Proibido** aplicar opacidades divergentes (`border-border/40`, `/50`, `/60`) em cards principais ou usar `backdrop-blur` em cards de dados (prejudica a nitidez tipográfica).
   - Cards estáticos (não clicáveis) **não** mudam de sombra ou borda no `:hover` (evitando falsa affordance de clique).
2. **Estilos de Superfície (`glass` vs `flat`):**
   - `glass` (padrão): aplica translucidez controlada exclusivamente no **chrome flutuante** (`z-modal`, `z-floating-tools`, Header sticky e Command Palette): `bg-surface/98 + blur(16px)` no Light e `bg-surface/82 + blur(12px)` no Dark/OLED.
   - `flat` (`data-surface-style="flat"`): zera **100% dos tokens de sombra** (`--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-2xl` e `--shadow-kpi`) e mantém o chrome 100% opaco.
   - **Glow de KPI (`shadow-kpi`):** restrito a no máximo **1 número protagonista por tela**.
3. **Escala Oficial e Imutável de Camadas (`Z-Index`):**
   - `z-base (10)` < `z-sticky / z-dropdown (20)` < `z-page-floating (24)` < `z-tooltip (25)` < `z-bottom-nav (30)` < `z-sidebar (40)` < `z-modal (50)` < `z-floating-tools (60)` < `z-toast (70)`.
   - Popovers, `Select`, `DatePicker`, `ColorPicker` e `IconPicker` abertos dentro de modais operam sempre em `z-floating-tools (60)` com `collisionPadding={{ top: 8, left: 8, right: 8, bottom: 80 }}`.

### 1.5 Proibição Estrita de Cores Hardcoded e Tokens Fantasmas

- **Proibido** escrever literais `#hex`, `rgb()`, `rgba()`, `hsl()` ou classes da paleta padrão do Tailwind (`slate-*`, `gray-*`, `zinc-*`, `emerald-*`, `green-*`, `amber-*`, `red-*`, `rose-*`, `blue-*`, `sky-*`, `indigo-*`, `purple-*`, `bg-white`, `bg-black`, `text-white`, `text-black`) em componentes `.tsx`/`.ts`.
- **Proibido** referenciar classes não declaradas em `@theme inline` (como `bg-danger`, `text-danger`, `bg-danger-surface`, `bg-surface-subtle`, `hover:bg-primary-hover`, `text-success`, `text-portfolio-foreground`).
- **Únicas exceções técnicas documentadas (isoladas em constantes de serviço/primitivo):**
  1. Renderização óptica de **QR Code** (`src/components/ui/qr-code-canvas.tsx` e `src/domain/pix/qr-code.ts`), onde leitores de câmera bancária exigem fundo claro `#FFFFFF` e módulos escuros `#000000` isolados num wrapper interno do canvas.
  2. Folha de impressão física `@media print` (`globals.css` / `PrintSheet`) e gerador XML de planilhas Excel (`src/services/excel-export.ts`), que operam fora do DOM temático em papel A4 branco.
  3. Cartão físico simulado `CreditCard3D` (`src/components/modules/credit-card-3d.tsx`), cujo plástico escuro emissor requer contraste sobre gradiente próprio, devendo concentrar seus tokens em `credit-card-gradient.ts`.

---

## 2. GEOMETRIA, ESPAÇO NEGATIVO E TIPOGRAFIA

### 2.1 Matriz Única de `border-radius`

Nunca misturar raios diferentes para componentes da mesma família:

| Elemento UI | Token CSS | Classe Tailwind | Valor |
|---|---|---|---|
| Micro-chips internos, teclas `<kbd>` | `--radius-sm` | `rounded-sm` | `6px` |
| **Inputs, Selects, DatePicker, Textarea, Stepper** | `--radius-md` | `rounded-md` | `8px` |
| **Botões (`Button`), itens de menu/dropdown, Toasts** | `--radius-lg` | `rounded-lg` (`12px`) / Toast `rounded-xl` | `12px` |
| **Cards padrão de dados (`Card`), Tabelas em card, EmptyState** | `--radius-xl` | `rounded-xl` | `16px` |
| **Hero Cards, Carrossel da Home, Modais (`md+`), Popovers** | `--radius-2xl` | `rounded-2xl` (Mobile sheet: `rounded-t-2xl`) | `20px` |
| **Badges (`Badge`), Switches, Indicadores de status** | `--radius-pill` | `rounded-pill` / `rounded-full` | `999px` |

### 2.2 Matriz Única de Espaçamento (`padding` e `gap` — Base 4px)

| Contexto Estrutural | Mobile (`< 640px`) | Tablet / Desktop (`≥ 640px`) | Regra de Ritmo |
|---|---|---|---|
| **Container de Página (`PageShell`)** | `px-3.5 pt-4 pb-28` (+ `safe-area-bottom`) | `sm:px-6 sm:pt-6 lg:px-8 lg:pb-10` (`max-w-7xl`) | Respiro garantido acima da `BottomNav` e `BackToTop` |
| **Stack Vertical entre Seções da Página** | `space-y-5` ou `gap-5` (`20px`) | `sm:space-y-6` ou `sm:gap-6` (`24px`) | Ritmo limpo sem blocos colados |
| **Card Padrão (1 coluna)** | `p-4` (`16px`) · `gap-3` (`12px`) | `sm:p-5` (`20px`) · `sm:gap-4` (`16px`) | Proibido `p-6`+ em cards internos de dados |
| **Card KPI em Grid 2 Colunas Mobile** | `p-3` (`12px`) · `gap-2` (`8px`) | `sm:p-4 lg:p-5` · `sm:gap-3` | Preserva largura útil para dígitos e centavos |
| **Modal / Bottom Sheet (Corpo e Rodapé)** | Corpo `px-4 pb-4` · Rodapé `px-4 py-3` (+ safe area) | Corpo `sm:px-6 sm:pb-5` · Rodapé `sm:px-6 sm:py-3.5` | Cabeçalho e rodapé alinhados no mesmo eixo `px` |
| **Formulários (Stack e Grid de Campos)** | `flex flex-col gap-3.5` (`14px`) | `grid grid-cols-1 sm:grid-cols-2 gap-3.5` | Label → Input com `gap-1.5` (`6px`) via `<FormField />` |
| **Linhas de Extrato / Tabela (`DataList`)** | `px-3.5 py-2.5` (altura `48px–52px`) | `sm:px-4 sm:py-2` (altura `40px–44px`) | Densidade responsiva automática de fábrica |

### 2.3 Hierarquia Tipográfica e Regra de Ouro Numérica (`tabular-nums`)

1. **Famílias Tipográficas:**
   - **Display (`Sora` 700/800 · `.display` / `font-display` · `tracking-tight`):** exclusivo para `<PageHeader />`, títulos de `<Modal />`, títulos de seções primárias e `<EmptyState />`.
   - **Interface (`Inter` 400/500/600 · `font-sans` · `cv11, ss01`):** rótulos, botões, abas, descrições, tabelas textuais e alertas.
   - **Dados Financeiros (`IBM Plex Mono` 500/600 · `.num`):** **obrigatório** para todo valor monetário, saldo, preço médio, quantidade de cotas, alíquota, taxa de juros e percentual.
2. **Escala Tipográfica Oficial:**
   - **Título de Página (`h1` em `PageHeader`):** `font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground` (`20px` → `24px`).
   - **Título de Modal (`DialogTitle`) e Card Principal (`CardTitle`):** `font-display text-base sm:text-lg font-bold tracking-tight` (`16px` → `18px`).
   - **Hero KPI (1 por página):** `.num text-2xl sm:text-3xl font-bold tracking-tight` (`24px` → `30px`).
   - **KPIs Secundários (Grids de 2–4 colunas):** `.num text-base sm:text-lg lg:text-xl font-semibold tracking-tight` (`16px` → `18px` → `20px`).
   - **Corpo Padrão, Abas e Botões:** `text-sm` (`14px`, line-height `1.45`). *Nota: inputs interativos usam `text-base sm:text-sm` (`16px` no mobile, `14px` no desktop).*
   - **Labels de Campo (`FormField`):** `text-xs font-semibold text-foreground` (`12px`).
   - **Helper / Metadados / Badges:** `text-[11px]` (`11px`) para helpers/badges `sm` e `text-[10px]` (`10px`) restrito a `<Badge size="xs" />`. **É proibido** usar tamanhos `text-[8px]`, `text-[8.5px]` ou `text-[9px]` em qualquer interface de tela.
3. **Invariantes de Valores Monetários:**
   - Todo valor monetário deve ser renderizado pelo primitivo `<MoneyText />` (ou possuir simultaneamente `.num whitespace-nowrap` / `font-mono tabular-nums whitespace-nowrap`).
   - **Zero Reticências:** é terminantemente **proibido** aplicar `truncate` ou `text-ellipsis` sobre um elemento monetário. Se o espaço for estreito, o layout quebra para linha própria ou reduz um degrau na escala responsiva, mantendo 100% dos dígitos e centavos legíveis.
   - **Modo Privacidade Automático:** como `html[data-privacy="masked"] .num` aplica o desfoque global, o uso consistente de `.num` / `<MoneyText />` garante que nenhum saldo vaze em tela com o escudo de privacidade ativo.

---

## 3. ANATOMIA DE MODAIS, DRAWERS E ELEMENTOS UI

### 3.1 Contrato Único de Modais e Bottom Sheets (`<Modal />`)

`<Modal />` é o **único** primitivo de diálogo/sheet do aplicativo (`<ResponsiveDialog />` deve convergir como alias deprecated ou ser unificado em `<Modal />`). Todo modal obedece à **Arquitetura Tripartite Estanque** (`flex flex-col overflow-hidden`):

1. **Topo (`shrink-0`):**
   - **Mobile (`< 768px`):** faixa dedicada da alça deslizante (*pill handle* `h-1 w-10 rounded-full bg-primary/30` centralizada no topo) + barra de controle minimalista (`h-9`/`h-10`) com ações contextuais (`headerActions`, `Calculator` apenas quando houver `MoneyInput`/`NumericInput`) e botão `Fechar (X)` à direita. O título editorial e o subtítulo iniciam no topo do corpo rolável; ao rolar `> 32px`, o micro-título reativo emerge na barra superior com `bg-surface/95 backdrop-blur-xs border-b border-border/80`.
   - **Tablet & Desktop (`≥ 768px` / `md:`):** cabeçalho sticky no topo com título (`font-display text-lg font-bold`), subtítulo opcional (`text-sm text-muted-foreground`) e barra de controles no canto superior direito (`top-4 right-6`), com reserva automática de padding direito (`md:pr-16` / `md:pr-24` / `md:pr-40`).
2. **Corpo Rolável Único (`flex-1 min-h-0 overflow-y-auto overscroll-contain`):**
   - Toda a rolagem vertical pertence exclusivamente ao `scrollRef` do `<Modal />`.
   - **Proibido** criar containers internos com `overflow-y-auto`, `overflow-y-scroll` ou `max-h-[*vh]` dentro dos filhos de um modal (elimina rolagem dupla e travamento de arrasto no touch).
3. **Rodapé Fixo Obrigatório (`footer={<ModalFooter ... />}` — `shrink-0`):**
   - Todo modal de formulário, wizard ou confirmação **deve** passar seus botões de ação pela prop `footer` do `<Modal />` (nunca soltos no fim do `children` rolável).
   - **Ordem Imutável de Botões:**
     - **Par Padrão (2 botões):** `Cancelar` / `Voltar` (`variant="outline"`) à **esquerda** e `Confirmar` / `Salvar` (`variant="default"` ou semântica correspondente) à **direita**. No mobile: `grid grid-cols-2 gap-2.5`; no desktop: `sm:flex sm:flex-row sm:justify-end gap-2.5`.
     - **Ação Destrutiva Secundária (ex: Excluir em modal de edição):** passada obrigatoriamente via prop `destructiveAction` do `<ModalFooter />` — posicionada à extrema esquerda no desktop (`sm:mr-auto`) e isolada na última linha no mobile (`order-last`), evitando erros de toque.
     - **Ações Utilitárias Múltiplas (Arquivar, Compartilhar, Rachar, PDF):** agrupadas em barra compacta de botões de ícone (`size="icon"`, `size-9` com `aria-label` e `title`) ou no `headerActions`.
4. **Escala Canônica de Larguras (`size`):**
   - `sm` (`448px`): confirmações (`ConfirmDialog`), alertas rápidos, PIN/2FA compacto.
   - `md` (`512px`): formulários enxutos de 1 coluna (metas, limites, convites).
   - `lg` (`672px`): detalhes/edição de transação, categorias, ajuda.
   - `xl` (`896px`): wizards multi-etapas, cadastro de cartão com preview 3D, contratos.
   - `2xl` (`1024px–1152px`): fichas completas de ativos, conciliação e importação.
   - `3xl` (`1280px`): relatórios executivos e dossiês A4 (`ReportDocumentLayout`).
   - **Proibido** injetar `max-w-*` manual em `className` do `<Modal />`.

### 3.2 Altura Única e Alinhamento de Controles de Formulário

Todos os controles de entrada de dados devem compartilhar a **mesma geometria base** para que nunca haja degraus visuais em grids de 2 colunas:

- **Altura Padrão (`size="md"`):** `h-10` (`40px`) exatos em `Input`, `PasswordInput`, `SearchInput`, `Select`, `DatePicker`, `MoneyInput`, `NumericInput`, `PercentInput` e `NumberStepperInput` (incluindo seus botões `−` e `+`, que devem ter `size-10` para casar 1:1 com o input central).
- **Padding Interno e Raio:** `px-3.5` (`14px`), `rounded-md` (`8px`), `border border-input bg-surface shadow-xs`.
- **Tipografia Anti-Zoom iOS:** `text-base sm:text-sm` (`16px` em `< 640px` para impedir auto-zoom do WebKit/Safari; `14px` em `≥ 640px` para densidade analítica limpa — exceto `MoneyInput size="lg"` que usa `h-16 text-3xl` em passos dedicados de valor).
- **Anatomia de Validação (`<FormField />`):**
  - Todo campo de formulário deve ser envolvido por `<FormField label="..." htmlFor="..." optional={...} helperText="..." error={...}>` (não duplicar `<label>` e `<span>` de erro dentro de `Textarea` ou nas páginas).
  - Em estado de erro: o input recebe `aria-invalid="true"`, `aria-describedby={errorId}` e `border-critical-strong focus-visible:ring-critical/20`, enquanto a mensagem renderiza abaixo com `role="alert"` em `text-[11px] font-medium text-critical-strong`.

### 3.3 Proibição de `autoFocus`, Empty States, Skeletons e Toasts

1. **Proibição Absoluta de `autoFocus` Intrusivo:**
   - **Nunca** usar `autoFocus` em inputs, selects ou botões ao abrir páginas, modais, drawers ou confirmações. O teclado virtual no mobile só abre mediante toque explícito do usuário no campo desejado. (Exceção única: Command Palette `⌘K` apenas em dispositivos com ponteiro fino `(pointer: fine)` no desktop).
2. **Empty States Calmos (`<EmptyState />`):**
   - Sempre `tone="default"` (`text-muted-foreground`), borda tracejada sutil (`border-dashed border-border/80 bg-surface`), ícone contextual `lucide-react` `size-6` sem fundo colorido, título objetivo ("Nenhum/Sem + substantivo"), descrição curta em 1–2 linhas (`max-w-sm`) e **um único botão CTA** recebendo o destaque cromático.
3. **Loading Skeletons Espelhados (Zero Spinners de Tela Cheia):**
   - **Proibido** exibir spinners centralizados durante carregamento de páginas ou abas.
   - `RouteSkeletonFallback` deve mapear **todas** as rotas reais do roteador (`/`, `/transacoes`, `/cartoes`, `/dividas`, `/orcamentos`, `/investments`, `/viagens`, `/familia`, `/insights`, `/relatorios`, `/lembretes`, `/configuracoes`), respeitando as dimensões exatas dos KPIs e gráficos para manter `CLS < 0.05`.
4. **Toasts Desobstruídos (`<Toast />` / `pushToast`):**
   - Máximo de 1 toast visível por vez ou fila curta (`duration = 3000ms`), deslizável para baixo (`swipeDirection="down"`), posicionado acima da `BottomNav` no mobile (`bottom-[calc(4.5rem+var(--safe-area-bottom))]`) e no canto inferior direito no desktop (`sm:right-6 sm:bottom-6`).
   - Evitar disparar toasts redundantes para micro-ajustes cujo resultado visual já é instantâneo na própria tela (ex: alternar tema claro/escuro).

---

## 4. RESPONSIVIDADE MULTI-TELA

### 4.1 Mobile (`< 768px` — Smartphones a partir de `320px`)

- **Navegação Inferior Compacta:** `BottomNav` fixa (`h-16` + `.pb-safe`), máximo de 4 destinos primários + 1 botão "Mais" (`MoreMenuSheet`) e FAB contextual central coerente com a rota ativa (incluindo `/viagens/:id` e `/familia`). `Sidebar` permanece oculta.
- **Coluna Única Estrutural & Grids Seguros:** seções principais fluem em **1 coluna**. Grids de KPIs iniciam em `grid-cols-1` ou no máximo `grid-cols-2` (`p-3`). **É proibido** `grid-cols-3`, `grid-cols-4` ou maior sem prefixo responsivo em cards financeiros ou rodapés de resumo.
- **Alvos de Toque Mínimos de `44×44px`:**
  - Todo botão, aba, link de navegação, ícone de fechar/limpar, chip de filtro ou linha clicável no mobile deve ter área física mínima de `44×44px` (`min-h-11 min-w-11` / `h-11`) — ou, em botões compactos visuais de `32px–36px` (como ícones de cabeçalho), área de toque expandida invisível (`after:absolute after:-inset-1.5`).
- **Safe Area Nativa Padronizada:**
  - Uso obrigatório das classes utilitárias `.pt-safe`, `.pb-safe`, `.pl-safe`, `.pr-safe` no Header, Sidebar, BottomNav, Modais e Splash/Lock Overlays.
  - O container rolável `<main id="main-content">` mantém zona de exclusão inferior mínima de `pb-28` + `safe-area-inset-bottom` para que o último card nunca fique coberto pela `BottomNav` ou pelo botão `BackToTop`.
- **Zero Overflow Horizontal (`100vw`):**
  - `html` e `body` com `overflow-x: clip; max-width: 100vw`. Todo container flex/grid com texto variável recebe `min-w-0`. Tabelas densas (`≥ 3` colunas numéricas) usam wrapper com `overflow-x-auto no-scrollbar scroll-smooth` ou convertem-se em cards empilhados no mobile (`PositionMobileCard`).

### 4.2 Tablet (`768px – 1024px` — `md:` até `< lg:`)

- **Grids Intermediários de 2 Colunas:** páginas e dashboards organizam-se em `md:grid-cols-2` (nunca saltar direto de 1 coluna para 4 colunas espremidas, nem esticar cards simples de 1 coluna por 960px inteiros).
- **Modais Centrados Proporcionais:** a partir de `768px` (`md:`), Bottom Sheets convertem-se em diálogos centralizados com largura controlada pela escala `ModalSize` (`448px` a `896px`) e margem lateral mínima `w-[calc(100vw-3rem)]`.
- **Navegação Limpa sem Colisão:** barras superiores de páginas públicas (`LandingHeader`, `ToolsHeader`) mantêm menu compacto até `lg:` (`1024px`), evitando quebra de links no header; a `BottomNav` expande seu container interno em tablets (`md:max-w-xl`) para não concentrar 5 ícones num centro estreito de 448px.

### 4.3 Desktop (`> 1024px` — `lg:` e `xl:`)

- **Sidebar Fixa Colapsável (`Sidebar`):** visível em `lg:flex` (`w-64` expandida ↔ `w-20` compacta com hover-expand assistido de `120ms` de delay), sincronizando o padding do conteúdo principal (`lg:pl-64` / `lg:pl-20`). Clicar no item da rota já ativa rola suavemente `#main-content` ao topo (`scrollToTop`).
- **Grids Multi-Coluna com Largura Máxima Controlada:** container central limitado a `max-w-7xl` (`1280px`) centrado (`mx-auto`). Páginas focadas em leitura ou ajustes (`Configurações`, `Lembretes`, ` Termos`) limitam formulários internos a `max-w-4xl` para conforto de leitura ocular (60–75 caracteres por linha).
- **Estados Interativos Universais (`:hover` e `:focus-visible`):**
  - **100% dos elementos clicáveis** (`Button`, `NavLink`, `TabsTrigger`, linhas clicáveis `role="button"`, chips, switches, cards interativos) devem exibir `:hover` suave (`150ms` sem deslocamento de layout), `cursor-pointer` explícito e anel `:focus-visible` nítido (`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` em ações; `focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20` em campos).

---

## 5. EFEITOS VISUAIS E SENSORIAIS

### 5.1 Curvas, Durações e Governança de Movimento (`prefers-reduced-motion`)

| Categoria de Transição | Duração Oficial | Curva (`easing`) | Uso |
|---|---|---|---|
| **Microinterações (hover, cor, active press `scale-[0.98]`)** | `150ms` | `ease-out` | Botões, links, linhas, switches, rota (`route-in`) |
| **Fades de Overlay, Popovers, Dropdowns e Accordions** | `200ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrada de diálogos desktop, menus Radix, alertas |
| **Bottom Sheets, Toasts e Carrosséis Direcionais** | `220ms – 280ms` | `cubic-bezier(0.32, 0.72, 0, 1)` | `sheet-in` (`250ms`), `toast-in` (`220ms`), `card-slide` (`280ms`) |
| **Interpolação Numérica (`NumberTicker`)** | `300ms` | `easeOutCubic` (`rAF`) | Apenas KPIs com `animated={true}` |

**Regras de Respeito ao Movimento:**
1. **CSS Global:** `@media (prefers-reduced-motion: reduce)` e `html[data-motion="reduced"]` reduzem todas as animações/transições a `0.01ms` e `scroll-behavior: auto`.
2. **Loops JavaScript:** todo efeito imperativo em JS (`NumberTicker`, `scrollToTop`, `Modal` drag rubber-band, `Button` ripple) **deve** consultar `prefers-reduced-motion` **e** `getVisualCustomization().motionLevel` antes de animar.
3. **Modo Eco (`data-motion="eco"`):** preserva transições rápidas de `150ms–200ms`, mas desativa `animate-shimmer` infinito, `animate-ping`, `animate-spring-pop` e ripples JS.
4. **Proibido** usar durações lentas (`duration-500`, `duration-700`, `duration-1000`) na interface autenticada ou animações infinitas decorativas em cards estáticos.

### 5.2 Arquitetura Blindada de Áudio e Vibração (`100% Opt-Out Garantido`)

Toda emissão sonora (Web Audio API) e tátil (Capacitor Haptics / `navigator.vibrate`) obedece a **5 leis inegociáveis**:

1. **Ponto Único de Entrada (`src/services/sensory.ts`):**
   - Componentes, hooks e páginas **só podem** acionar efeitos via `triggerSensory(intent, options)` ou `useSensory()`.
   - **É terminantemente proibido** importar `playSound`, `soundManager`, `triggerHaptic`, `hapticsManager`, `triggerNativeHaptic` ou chamar `navigator.vibrate` diretamente fora de `src/services/sensory.ts`.
2. **Defesa em Profundidade nas Preferências do Usuário:**
   - Tanto `triggerSensory` (gateway) quanto `soundManager.play` (`audio-fx.ts`), `hapticsManager.trigger` (`haptics.ts`) e `triggerNativeHaptic` (`native/haptics.ts`) **devem verificar internamente** `getVisualCustomization().soundEnabled` e `getVisualCustomization().hapticEnabled` (além de `disabledSensoryIntents`).
   - **Garantia Absoluta:** se o usuário desativou som (`soundEnabled === false`), modo Discreto (`experiencePreset === "discreet"`) ou vibração (`hapticEnabled === false`), **nenhum som ou vibração pode ser disparado sob nenhuma hipótese** (nem mesmo em botões de reset ou troca de preset).
   - Ao selecionar um preset silencioso (ex: `"discreet"`), o estado **deve ser persistido antes** de qualquer chamada sensorial, garantindo silêncio imediato já no clique de desativação.
3. **Zero Duplos Disparos (*Anti-Double-Sensory*):**
   - O primitivo `<Button />` já despacha automaticamente `triggerSensory(sensoryIntent ?? (variant === "destructive" ? "destructive" : "action"))`.
   - **É proibido** chamar `triggerSensory(...)` ou `sensory.*()` dentro de funções passadas ao `onClick` de um `<Button />` (caso a ação exija intenção semântica específica como `"success"` após `await` ou `"selection"`, passe `sensoryIntent="selection"` ou `sensoryIntent={false}` no `<Button />`).
4. **Silêncio em Digitação, Hover e Long-Press Contínuo:**
   - **Proibido** emitir som/vibração ao digitar caracteres em inputs (`MoneyInput`, `Input`, `PercentInput`), no `:hover` ou durante ticks repetidos de `HOLD_INTERVAL_MS` em `NumberStepperInput` (emitir apenas 1 pulso no início do toque e 1 ao atingir o limite `min`/`max`, ou usar `{ skipSound: true }` com throttle `≥ 120ms`).
5. **Mapeamento Canônico de Intenções (`SensoryIntent`):**
   - `selection`: troca de abas, datas, selects, filtros, fatias de gráfico (`light` 8ms / `click` 40ms).
   - `action`: clique primário/secundário de comando (`light` 8ms / `click` 40ms).
   - `toggle`: switches, checkboxes, modo privacidade (`light` 8ms / `pop` 60ms).
   - `success`: persistência concluída com êxito no servidor (`success` / acorde suave).
   - `warning`: alerta preventivo de limite/atenção (`warning` / bitom curto).
   - `destructive`: exclusão ou revogação confirmada (`destructive` / tom descendente).
   - `error`: bloqueio de validação ou falha de requisição (`error` / tom grave curto).

---

## 6. CURADORIA DE MELHORIAS SUTIS (SEÇÃO DESTACADA PARA APROVAÇÃO)

> [!IMPORTANT]
> As **10 melhorias abaixo** são ajustes sutis, de baixa complexidade de engenharia e altíssimo retorno perceptivo. Elas foram desenhadas para eliminar micro-atritos cognitivos, reduzir o cansaço visual e dar ao Axir o acabamento calmo e coeso de produtos financeiros de referência global. **Aguardam sua aprovação antes de qualquer alteração no código.**

### M1. Suavização do Branco Estourado no Light Mode e do Branco Puro no OLED
- **Hoje:** No Light Mode, `--surface` é `#FFFFFF` puro sobre `#F4F7F9`, e vários sub-cards usam `bg-white` hardcoded; no OLED e no `index.html`, textos chegam a `#FAFAFA` / `#FFFFFF` sobre `#000000` (contraste 21:1, gerando ofuscamento noturno).
- **Proposta Sutil:** Calibrar `--surface` no Light Mode para um branco papel acetinado (`204 33% 99%` / `#FBFCFD`, mantendo contraste limpíssimo com `--background: #F4F7F9` sem ofuscar em monitores grandes) e limitar `--foreground` no OLED a `0 0% 93%` (`#EDEDED`), reduzindo o brilho estourado sem perder nitidez.
- **Ganho:** Conforto ocular imediato em telas grandes de dia e leitura noturna sem vista cansada no celular.

### M2. Desbaste da "Síndrome da Caixa Dentro de Caixa" (*Border Noise Reduction*)
- **Hoje:** Muitos modais e páginas (Investimentos, Configurações, Detalhes de Despesa, Racha) empilham **3 a 4 níveis de bordas concêntricas** (Modal com borda → Card com borda → Sub-bloco com borda → Linha com borda).
- **Proposta Sutil:** Regra de **Alternância Superfície vs. Borda**: dentro de um `<Card>` ou `<Modal>` que já possui borda externa (`border-border/80`), agrupamentos internos usam **apenas contraste suave de superfície** (`bg-surface-raised` ou `bg-muted/50` sem `border`) ou divisores horizontais finos (`divide-y divide-border/50`), reservando bordas completas apenas para inputs e botões interativos.
- **Ganho:** Redução drástica de poluição visual; os números e os campos clicáveis saltam aos olhos naturalmente.

### M3. Diferenciação Clara da Ação Primária Única em Rodapés de Diálogo
- **Hoje:** Como todas as variantes de botão usam fundo translúcido suave (`bg-primary/10` com borda), em formulários densos o botão principal "Salvar / Confirmar" tem quase o mesmo peso óptico de chips, filtros e botões secundários ao redor.
- **Proposta Sutil:** Manter o estilo discreto (`tinted`) como padrão para botões secundários/contextuais nas páginas, mas dar ao **CTA primário único de conclusão** (`variant="solid"` ou evolução sutil do `default` em `ModalFooter` e `EmptyState`) preenchimento sólido sereno (`bg-primary-strong text-primary-foreground` no Light; `bg-primary/20 border-primary/50 text-primary` ou `bg-primary text-primary-foreground` no Dark).
- **Ganho:** Zero hesitação sobre "onde clicar para concluir", reduzindo o tempo de resposta em wizards e modais.

### M4. Toggles Diretos de "Sons" e "Vibração" ao Lado dos Presets Sensoriais
- **Hoje:** Em `Configurações > Aparência`, o usuário só vê 3 cards fechados (*Dinâmico*, *Foco*, *Discreto*). Se ele gosta das animações fluidas mas trabalha em escritório e quer apenas **desligar o som** mantendo a vibração no celular, não há um switch visível direto.
- **Proposta Sutil:** Adicionar uma linha discreta e compacta com 2 switches rápidos (`Sons de interface` e `Vibração tátil`) logo abaixo dos 3 presets em `ExperiencePresetsCard` (sincronizados automaticamente com `soundEnabled` e `hapticEnabled`).
- **Ganho:** Controle imediato em 1 toque sem inflar a tela com dezenas de opções técnicas.

### M5. Remoção de Animações Infinitas em Telas Estáticas (`LivePulseBeacon`)
- **Hoje:** Telas estáticas como `Configurações > Aparência` exibem um ponto piscando infinitamente (`animate-ping` "Tempo Real"), competindo perifericamente com a leitura do usuário.
- **Proposta Sutil:** Restringir `LivePulseBeacon` exclusivamente a eventos transitórios reais em andamento (ex: sincronização ativa de cotações ou modo simulação guiado ativo), removendo-o de cabeçalhos de cards estáticos.
- **Ganho:** Calma periférica e economia de CPU/bateria mobile.

### M6. Hierarquia Tipográfica de Centavos (*Subtle Cents De-emphasis*) em KPIs Grandes
- **Hoje:** Em grids densos de KPIs (`R$ 14.850,00`), os centavos `,00` têm exatamente o mesmo tamanho e peso tipográfico dos milhares, disputando espaço horizontal em telas estreitas.
- **Proposta Sutil:** Adicionar prop opcional `deemphasizeCents` (ativa por padrão apenas na variante `hero` de `<MoneyText />`), renderizando a parte inteira em peso total (`font-bold`) e os centavos `,00` um leve tom mais suave (`text-[0.82em] opacity-80`), preservando `100%` da visibilidade dos centavos e `tabular-nums`.
- **Ganho:** Escaneamento instantâneo da ordem de grandeza financeira na Home e em Investimentos, além de ganhar ~12% de folga horizontal nos KPIs mobile.

### M7. Silêncio de Toasts em Ações Auto-Evidentes (*Zero Toast Fatigue*)
- **Hoje:** Mudar o tema Claro/Escuro ou alternar um atalho de cabeçalho dispara um `Toast` flutuante ("Preferências salvas — Tema alterado para Escuro"), mesmo quando a tela inteira já mudou de cor instantaneamente diante dos olhos do usuário.
- **Proposta Sutil:** Regra de UX: **ações cujo efeito visual é imediato e auto-evidente na própria tela não disparam Toast** (usam apenas o micro-feedback tátil `selection`/`toggle`; apenas falhas de sincronização em background exibem toast de erro). Reservar Toasts para criações, edições salvas ao fechar modais, cópias de área de transferência (Pix/Link) e exclusões.
- **Ganho:** Fim da fadiga de notificações empilhadas ao personalizar o app.

### M8. Contextualização Inteligente do FAB `+` em Viagens e Família
- **Hoje:** Quando o usuário está dentro de uma Viagem (`/viagens/:id`) ou no Orçamento Familiar (`/familia`), tocar no botão central `+` da barra inferior abre o `LaunchWizard` pessoal em vez da despesa da viagem ou ação familiar.
- **Proposta Sutil:** Tornar o FAB 100% fiel ao contexto da tela ativa: em `/viagens/:id` abre diretamente "Novo Gasto da Viagem"; em `/viagens` abre "Nova Viagem"; em `/metas` abre "Nova Meta".
- **Ganho:** Previsibilidade mental absoluta — o botão principal sempre faz o que o contexto atual sugere.

### M9. Progressive Disclosure Padronizado em Formulários Longos ("Opções Avançadas")
- **Hoje:** Modais como `ExpenseDetailDialog`, `QuickTransactionSheet` e `LaunchWizard (StepDetails)` expõem simultaneamente campos essenciais (Valor, Data, Categoria) e metadados avançados (Peso em relatórios, Tags/Notas, Anexo fiscal, Racha, Indexadores), alongando o scroll.
- **Proposta Sutil:** Padronizar uma sanfona limpa `<Accordion>` ("Mais detalhes · Observações, comprovante e rateio") recolhida por padrão quando vazia e aberta automaticamente apenas quando já houver dado preenchido naqueles campos.
- **Ganho:** Formulários aparentam metade do tamanho para 90% dos lançamentos cotidianos, mantendo 100% do poder analítico a 1 toque de distância.

### M10. Fim de Banners Promocionais de APK na Web / iOS
- **Hoje:** Usuários navegando na Web (inclusive no iPhone/macOS via `AppDownloadModal` ou semanalmente no carrossel da Home via `AndroidProBanner`) recebem avisos recorrentes sugerindo download de arquivo `.apk` Beta.
- **Proposta Sutil:** Remover completamente banners promocionais de `.apk` do carrossel da Home na Web e ocultar qualquer menção a `.apk` em dispositivos iOS/Desktop, concentrando a opção de instalação de forma discreta, única e contextual ao SO apenas em `Configurações` / menu `Mais` (priorizando o PWA universal sem fricção).
- **Ganho:** Percepção imediata de produto SaaS maduro, limpo e respeitoso à plataforma do usuário.
