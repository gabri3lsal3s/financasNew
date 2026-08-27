# 🎨 DESIGN_SYSTEM.md — Identidade Visual & Design Tokens

> **Status:** v1.1 — Identidade oficial: **"Guia Financeiro — Azul Petróleo, Teal Vital, Ouro Âmbar e Coral Suave"** (F10).
> Base acolhedora de bem-estar financeiro (teal petróleo) + precisão técnica de leitura de números (mono/tabular).
> Tema padrão: **segue o sistema** · Densidade: **equilibrada** · Cores de categoria: **paleta restrita e sóbria**.
> **Tokens implementados em:** `src/styles/tokens.css` (fonte única) + `src/styles/globals.css` (mapeamento Tailwind v4).

---

## 1. PRINCÍPIOS DA IDENTIDADE

1. **Calma e controle** — o app transmite "seu dinheiro sob controle", nunca "mercado de risco". Teal Petróleo como âncora emocional (F10).
2. **Números são protagonistas** — valores, taxas e percentuais usam **IBM Plex Mono com tabular-nums**: alinhamento perfeito em tabelas, leitura rápida em dashboards.
3. **Semântica financeira imediata** — verde = entra dinheiro, vermelho = sai dinheiro, âmbar = atenção, vermelho forte = crítico, azul = investimentos/rebalanceamento. Nunca variar esses significados.
4. **Sobriedade nas categorias** — paleta restrita e dessaturada: cor ajuda a reconhecer, não compete com os dados.
5. **Tudo é token** — nenhuma cor/fonte/raio/sombra hard-coded em componente; qualquer alteração em `tokens.css` propaga para o app inteiro (DRY).

---

## 2. CORES — TOKENS

### 2.1 Marca e neutros

| Token | Light | Dark | OLED | Uso |
|---|---|---|---|---|
| `--background` | `204 29% 97%` `#F4F7F9` | `206 49% 9%` `#0C1923` | `0 0% 0%` `#000` | Fundo de tela |
| `--surface` | `0 0% 100%` `#FFF` | `206 42% 15%` `#162836` | `0 0% 4%` `#0A0A0A` | Cards, modais, tabelas |
| `--surface-hover` | `200 22% 94%` | `206 41% 19%` | `0 0% 8%` | Hover de linhas/cards |
| `--surface-active` | `200 20% 90%` | `204 39% 23%` | `0 0% 12%` | Estado pressionado |
| `--border` | `200 18% 87%` `#D7E1E6` | `208 36% 21%` `#23384A` | `0 0% 18%` `#2E2E2E` | Bordas e divisores (cinza neutro P&B no OLED) |
| `--input` | `200 16% 79%` | `208 34% 26%` | `0 0% 24%` `#3D3D3D` | Bordas de campos |
| `--muted` | `200 20% 95%` | `206 42% 12%` | `0 0% 6%` | Skeletons, backgrounds suaves |
| `--foreground` | `205 42% 14%` `#142531` | `199 39% 94%` `#E8F1F5` | `0 0% 98%` | Texto principal (Azul Petróleo Profundo) |
| `--muted-foreground` | `215 26% 35%` `#475569` | `204 22% 68%` `#9DB2C0` | `0 0% 50%` | Texto secundário, rótulos |
| `--overlay` | `12 40% 10% / 40%` | `0 0% 0% / 60%` | `0 0% 0% / 70%` | Escurecimento de modais/palette (glass §8) |
| `--scrollbar-thumb` / `--scrollbar-track` | `200 16% 74%` / `204 29% 95%` | `208 30% 32%` / `206 49% 11%` | `0 0% 22%` / `0 0% 4%` | Scrollbars via tokens (§13) |

### 2.2 Marca — primárias e accent

| Token | Light | Dark | OLED | Uso |
|---|---|---|---|---|
| `--primary` | `173 58% 39%` `#2A9D8F` | `173 66% 50%` `#2DD4BF` | igual dark | Acentos, ícones, estados ativos, gráficos, fills `primary/10` (Teal Petróleo / Teal vivo) |
| `--primary-strong` | `173 66% 26%` `#1B6B62` | `173 66% 50%` | igual dark | **Botões discretos (borda + texto) e links** (contraste AA) |
| `--primary-foreground` | `0 0% 100%` | `166 92% 9%` `#022C22` | igual dark | Texto sobre `primary-strong` |
| `--secondary` | `174 65% 37%` `#219E92` | `174 65% 43%` `#26B5A7` | igual dark | Elementos secundários (chips, realce) |
| `--secondary-foreground` | `172 80% 8%` | `172 80% 8%` | igual dark | Texto sobre `secondary` (AA) |
| `--accent` | `42 73% 51%` `#DDA726` | `42 87% 64%` `#F3C352` | igual dark | **Ouro Âmbar**: órbita da marca, glow de KPI (`shadow-kpi`) |
| `--accent-foreground` | `205 42% 14%` | `43 87% 15%` `#4A3605` | igual dark | Texto sobre o ouro (AA) |
| `--ring` | `173 58% 39%` | `173 66% 50%` | igual dark | Anel de foco (`:focus-visible`) |

> **Regra de contraste (AA):** em Light, texto pequeno **não** usa `--primary` (3.0:1 — gráficos/fills) — usa `--primary-strong` (5.7:1). `--accent` (ouro) é decorativo/grande (glow, órbita); texto sobre ouro usa `--accent-foreground` (AA). Em Dark, `--primary` já é claro e o foreground escuro garante 8:1.

> **Acentos personalizáveis (F11/F13):** o root aceita `data-accent="emerald|gold|rose|sapphire|violet|mono"` (teal é o padrão, sem atributo) — sobrescreve `--primary`/`--primary-strong`/`--ring` nos 3 temas, aplicado via `use-visual-customization` (persistido em `localStorage`). `mono` oferece a opção Monocromático Preto & Branco puro de alto contraste. Regra de contraste: o mesmo princípio acima vale por paleta (texto pequeno usa a variante *strong*).

### 2.3 Semânticas financeiras

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--positive` / `--positive-strong` | `#2A9D8F` / `#1B6B62` | `#2DD4BF` | **Receitas, rendas, saldo positivo, poupança** (Teal) |
| `--negative` / `--negative-strong` | `#E76F51` / `#B23A2A` | `#FB7185` | **Despesas, saídas, saldo negativo** (Coral Suave) |
| `--warning` / `--warning-strong` | `#E9C46A` / `#92400E` | `#F59E0B` | Atenção (≥85% do limite), alertas leves (Ouro Âmbar) |
| `--critical` / `--critical-strong` | `#EF4444` / `#B91C1C` | `#F87171` | Orçamento excedido, atraso, erro destrutivo |
| `--portfolio` | `#1B3A4B` | `#38BDF8` | Rebalanceamento, gap de meta, aportes (Sky Petróleo) |

**Regras de uso:**
- **Texto pequeno** → variante `-strong` (Light). **Gráficos, ícones, badges, fills** → variante base.
- Verde/vermelho **nunca** são usados para aprovação/erro genérico de formulário — isso é papel de `--primary`/`--critical`; as semânticas financeiras são exclusivas de dinheiro.
- Badge de status de dívida: `overdue` → critical · `due_today` → warning · `due_soon` → warning claro · `paid` → positive · `pending` → muted.

### 2.4 Categorias — paleta de alto contraste e distinção (10 cores)

| Token | Light | Dark/OLED | Token | Light | Dark/OLED |
|---|---|---|---|---|---|
| `--cat-1` safira oceano | `199 90% 40%` | `199 95% 58%` | `--cat-6` rubi rose | `338 75% 50%` | `340 88% 66%` |
| `--cat-2` esmeralda teal | `162 76% 36%` | `160 80% 50%` | `--cat-7` turquesa ciano | `185 85% 36%` | `185 90% 50%` |
| `--cat-3` âmbar ouro | `36 95% 44%` | `38 96% 60%` | `--cat-8` oliva lima | `88 68% 36%` | `88 75% 52%` |
| `--cat-4` coral intenso | `12 85% 52%` | `12 92% 66%` | `--cat-9` orquídea magenta | `286 65% 48%` | `286 80% 68%` |
| `--cat-5` violeta íris | `262 70% 54%` | `265 85% 70%` | `--cat-10` ardósia aço | `215 40% 46%` | `215 35% 65%` |

**Regras:** paleta harmônica com alta distinção cromática e contraste aprimorado (legibilidade máxima no anel donut e nas barras de distribuição); cada categoria recebe uma cor da escala (associação por nome na sugestão inteligente); em gráficos e badges, usar a mesma cor correspondente da categoria.

---

## 3. TIPOGRAFIA

| Papel | Fonte | Observações |
|---|---|---|
| UI (texto corrido, labels, botões) | **Inter** | `font-feature-settings: "cv11", "ss01"`; `-webkit-font-smoothing: antialiased` |
| Títulos de tela / display | **Sora** (700/800) | `tracking: -0.02em`; usado em títulos de página e seções |
| **Números, valores, taxas, quantidades** | **IBM Plex Mono** (500/600) | Classe `.num` = mono + `tabular-nums`; obrigatória em: valores monetários, saldos, KPIs, percentuais, colunas numéricas de tabelas |

### 3.1 Escala (densidade equilibrada)

| Token de uso | Tamanho | Peso | Exemplo |
|---|---|---|---|
| `text-xs` | 12px | 500 | Labels, footnotes |
| `text-sm` | 14px | 400/500 | Corpo de tabelas, descrições, botões |
| `text-base` | 16px | 400 | Corpo geral |
| `text-lg` | 18px | 500 | Subtítulos, valores de linha |
| `text-xl` | 20px | 600 | Valores de cards de resumo |
| `text-2xl` | 24px | 700 | KPIs principais (mono) |
| `text-3xl` | 30px | 700/800 | KPI hero (ex.: saldo do mês) |
| `text-4xl` | 36px | 800 | Raríssimo — só telas focadas em um número |

Line-height: 1.4 corpo / 1.2 títulos / 1.5 mono. Números em KPI: mono 600, `text-2xl`+.

---

## 4. ESPAÇAMENTO E DENSIDADE (equilibrada)

Escala base de **4px**: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`.

| Contexto | Valor |
|---|---|
| Padding de página | 24px desktop · 16px mobile |
| Padding de card | 20px |
| Altura de linha em tabelas | 48px (confortável) · célula py 12px |
| Gap padrão entre elementos | 16px |
| Gap entre seções | 32px |
| Stack vertical de formulário | 20px |

---

## 5. RAIO (RADIUS)

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 6px | Chips pequenos, inputs internos |
| `--radius-md` | 8px | Inputs, selects, botões secundários |
| `--radius-lg` | 12px | Botões primários, modais, tooltips |
| `--radius-xl` | 16px | **Cards**, tabelas em cards, skeletons |
| `--radius-2xl` | 20px | Cards hero, modais grandes |
| `--radius-pill` | 999px | Badges, avatares, toggle |

Regra: cards sempre ≥ `xl`; inputs `md`; badges `pill`. Nunca radius diferente nos mesmos tipos de componente.

---

## 6. SOMBRAS E ELEVAÇÃO

| Token | Light | Uso |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgb(0 0 0/5%)` | Micro-elevação padrão de cards e contêineres de dados |
| `--shadow-sm` | `0 1px 2px rgb(0 0 0/4%)` | Cards em estado padrão, linhas elevadas |
| `--shadow-md` | `0 2px 8px rgb(0 0 0/6%)` | Cards flutuantes, dropdowns |
| `--shadow-lg` | `0 8px 24px rgb(0 0 0/10%)` | Modais, command palette (⌘K) |
| `--shadow-kpi` | anel accent + glow suave | **KPI principal** por tela (1 no máx.) |

**Regras:** elevação por sombra, nunca por cor escura; dark/oled dependem mais de bordas do que de sombras (alpha maior); o **glow de KPI** é reservado a um único número-chave por tela (ex.: saldo do mês) — nunca vários. No estilo *Flat*, 100% dos tokens de sombra (`--shadow-xs` a `--shadow-lg`) são zerados; no estilo *Elevated*, a dispersão é aumentada proporcionalmente.

**OLED refinado (F5.2 + F10):** sobre o true black `#000`, bordas são a principal pista de elevação — `--border` ardósia `#1C2E3D` e `--input` 22% garantem definição sem acender pixels; hover/pressed mais perceptíveis (`8%`/`12%`); `--muted-foreground` 50% assegura AA (5.3:1) para texto secundário; `--overlay` 70% escurece o conteúdo atrás de modais sem perder o preto puro; scrollbar com polegar ardósia `22%` discreto. Acentos luminosos (teal vivo/ouro) dão o caráter "Órbitas Douradas".

---

## 7. ESTADOS DE COMPONENTES

| Estado | Regra |
|---|---|
| **Default** | `surface` + borda `border` + `shadow-sm` |
| **Hover** | `surface-hover`; transição 150ms; sem mudança de layout |
| **Active/pressed** | `surface-active`; botões com `scale(0.99)` |
| **Focus-visible** | Anel `ring` 2px + offset 2px (sempre visível — a11y) |
| **Disabled** | Opacidade 50%, `cursor: not-allowed`, sem sombra, sem hover |
| **Erro** | Borda `critical-strong` + anel `critical/25`; mensagem via gateway (`getErrorMessage`) |
| **Sucesso** | Texto/ícone `positive-strong`; toast de confirmação |
| **Selecionado** | Fill `primary/12` + borda `primary/40` (ex.: categoria ativa, aba) |
| **Loading** | **Skeleton** (`muted` com shimmer) — proibido spinner genérico em tela cheia |
| **Microinterações** | Transições 150ms em `transition-colors`/`transition-transform`; botões com **press `scale(0.98)`** (`active:scale-[0.98]`); `prefers-reduced-motion: reduce` desativa animações (F5.2) |

**Botões — estilo discreto (pós-F10):** sem fundo sólido. As variantes com cor (`default`/`destructive`/`positive`) usam **borda de cor + texto colorido** (`border-primary-strong/40 text-primary-strong`, `border-critical/50 text-critical-strong`, etc.) com hover de tinta suave (`bg-primary/10`, `bg-critical/10`) e **sem sombra**; `secondary` usa tinta 15% (`bg-secondary/15`); `ghost`/`outline` permanecem neutros. FABs (BottomNav, calculadora flutuante) seguem o mesmo princípio: círculo `background/95` + borda teal + ícone teal. Texto/borda sempre com contraste AA nos 3 temas.

---

## 8. TRANSPARÊNCIA / GLASSMORPHISM

- **Uso permitido (sutil):** header sticky com `backdrop-blur` (8–12px) + fundo `surface/80` (light) ou `surface/70` (dark); command palette ⌘K; modais sobre conteúdo.
- **Proibido:** glass em cards de dados (prejudica legibilidade), múltiplas camadas de blur empilhadas.
- Transparências de cor sempre via token: `bg-primary/10`, `bg-negative/10` etc.
- **Estilo de superfície "Glass" (F11, padrão):** quando `data-surface-style` está ausente, o chrome — **modais, paleta de busca e painéis flutuantes** (`rounded-xl/2xl + bg-surface` com `z-modal`/`z-floating-tools`) — fica translúcido (`surface/82` + `backdrop-filter: blur(12px)`); o fundo do app (`body`) recebe um **gradiente radial sutil tintado pelo acento** (`--primary`) e pelo ouro (`--accent`) ancorado aos limites da janela do app (`background-attachment: fixed`), fazendo a cor personalizada aparecer no fundo global sem ficar confinada à coluna de conteúdo. **Cards de dados permanecem opacos** (regra de legibilidade acima). `flat`/`elevated` (`data-surface-style`) mantêm o chrome opaco.
- **Níveis de movimento (F11):** `fluid` (tudo ligado) · `eco` (`data-motion="eco"` — mantém fades, desliga shimmer/pulso/spring/ripple) · `reduced` (`data-motion="reduced"` — mesmas animações/transições zeradas do `prefers-reduced-motion`). O toggle **"Contagem Numérica Animada"** (`numberTickerEnabled`) desliga o `NumberTicker` (valor exibido direto).

---

## 9. ACESSIBILIDADE

- Contraste AA: textos pequenos usam variantes `-strong` em Light (ver §2.2/2.3).
- Foco visível padronizado (`--ring`) em todo componente interativo.
- Alvos de toque ≥ 44×44px (mobile); tabelas com scroll horizontal acessível por teclado.
- Os 3 temas passam por auditoria (axe) na Fase 5 — nenhum token pode ser alterado sem revalidar contraste.

### 9.1 Regra — Proibição de `autoFocus` em Modais

**`autoFocus` é proibido em qualquer campo dentro de `Modal`, `Sheet` ou `ConfirmDialog`.** Motivo: em dispositivos móveis, `autoFocus` abre o teclado virtual automaticamente ao exibir o modal, empurrando o layout para cima, cortando conteúdo e perturbando a experiência do usuário antes mesmo que ele decida interagir. O usuário escolhe quando e qual campo quer preencher.

- **Proibido:** `<Input autoFocus />`, `<MoneyInput autoFocus />`, `<Button autoFocus />` dentro de qualquer modal/sheet.
- **Permitido:** focar programaticamente **após interação explícita** do usuário (ex.: ao clicar em "Editar inline" um item específico).
- **ConfirmDialog:** o botão "Cancelar" **não** recebe `autoFocus` — no mobile isso abre o teclado sem motivo.

### 9.2 Padrão — Sugestões Contextuais nos Wizards

Blocos de sugestões inteligentes (habituais, recomendações de aporte) seguem o mesmo padrão visual em todos os wizards:

**Cabeçalho do bloco:**
```tsx
<p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
  <IconName className="size-3" aria-hidden="true" />
  Título da Seção
</p>
```

**Cards de sugestão (items individuais com gap):**
```tsx
<div className="flex flex-col gap-1.5">
  {items.map((item) => (
    <button
      key={item.id}
      type="button"
      className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-raised px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* conteúdo */}
    </button>
  ))}
</div>
```

> Sugestões com acento de marca (ex.: recomendações de aporte) usam `border-primary/20 bg-primary/5` com `hover:border-primary/40 hover:bg-primary/10` — nunca um container único com `divide-y`.

---

## 10. MAPEAMENTO PARA O CÓDIGO

| Arquivo | Papel |
|---|---|
| `src/styles/tokens.css` | **Fonte única da verdade** — todos os tokens (3 temas + fallback de sistema) |
| `src/styles/globals.css` | Importa tokens; `@theme inline` (Tailwind v4) gera utilitários `bg-primary`, `text-negative`, `rounded-xl`, `shadow-kpi`, `font-mono`, `bg-cat-3`…; utilitários `.num` e `.display`; base (body, selection, focus) |
| `tailwind.config.ts` | **Somente se a Fase 0 usar Tailwind v3** — bloco completo no final de `globals.css` |
| `index.html` | Carregar Google Fonts: Inter (400/500/600/700), Sora (700/800), IBM Plex Mono (400/500/600) + `preconnect`, meta `color-scheme` e inline bootstrap script |

**Fluxo de tema:** `ThemeProvider` (Fase 0) resolve `system → light|oled` (modo escuro padrão do sistema/forced-dark resolve para OLED `#000000`) e grava `data-theme` e `style.colorScheme` em `<html>`; preferência persistida em `user_preferences.theme` e espelhada no storage local síncrono. O fallback `@media (prefers-color-scheme)` e `index.html` inline script evitam flash sem JS e garantem sincronização de tema desde o 1º frame do HTML Splash Screen.

---

## 11. DO & DON'T

**✅ Do**
- Sempre token: cores, fontes, raios, sombras (`bg-surface`, `text-positive-strong`, `rounded-xl`, `shadow-kpi`).
- Números em `.num` (mono + tabular) — especialmente tabelas e KPIs.
- Despesa = `negative` · receita = `positive` · rebalanceamento = `portfolio` em qualquer contexto.
- 1 KPI com glow por tela; demais com `shadow-md`.
- Cores de categoria pela escala `cat-1..10` (mesma cor no ícone, badge e gráfico).
- **Tom de voz dos empty states:** título no padrão "Nenhum/Nenhuma/Sem + substantivo" (ex.: "Nenhum cartão", "Sem lançamentos neste mês") e descrição em imperativo curto (ex.: "Registre…", "Crie…", "Adicione…", "Defina…") com **ícone lucide contextual** (`size-6`, `aria-hidden`) — nunca emoji, nunca tom coloquial exagerado.

**❌ Don't**
- Nada de hex hard-coded em componente (quebra a propagação global).
- Não usar `--primary` para texto pequeno em Light (contraste) — usar `primary-strong`.
- Não usar verde/vermelho para sucesso/erro genérico de formulário (reservado ao dinheiro).
- Não adicionar novas cores de categoria fora da escala — a paleta é restrita de propósito.
- Não criar sombras ad-hoc (usar a escala sm/md/lg/kpi).
- **Nunca** usar elementos nativos de controle (select, checkbox, date, file, range, alert/confirm/dialog) — sempre os primitivos do app (ver §13).
- **Nunca** usar emojis/emoticons nem caracteres Unicode decorativos (✓, ▲, ●, 🎉, 👍…) em textos de UI, empty states, alertas ou mensagens — **toda representação gráfica usa ícones `lucide-react` padronizados** (tamanhos `size-3`/`size-4`/`size-5`, `aria-hidden`, mesmo estilo de stroke), mantendo o visual harmônico.

---

## 13. ZERO ELEMENTOS NATIVOS DO NAVEGADOR

Todo controle de interface é um **componente do próprio app** (`components/ui/`), estilizado com os tokens desta identidade. Elementos nativos de controle **são proibidos** nas telas:

| Nativo (proibido) | Substituição — primitivo do app (`components/ui/`) |
|---|---|
| `<select>` | `Select` (acessível, com teclado) |
| `<input type="checkbox">` | `Checkbox` |
| `<input type="radio">` | `RadioGroup` |
| `<input type="date">` | `DatePicker` (pt-BR, com tokens, auto-close ao selecionar, atalhos rápidos Hoje/Ontem e haptic) |
| `<input type="file">` | `Dropzone` (encapsula o input de arquivo; upload fica fora do escopo atual) |
| `<input type="range">` | `Slider` |
| `<input type="color">` | `ColorPicker` (paleta de marca + hex custom validado) |
| `<select>` de ícones (emojis/texto) | `IconPicker` (grade de `lucide-react` com busca) |
| `alert()` / `confirm()` / `prompt()` | `ConfirmDialog` / `Modal` + `Toast` |
| `<dialog>` | `Modal` (componente do app) |
| `<details>/<summary>` | `Accordion` |
| Scrollbars padrão | **Ocultas** (pós-F10): `scrollbar-width: none` + `::-webkit-scrollbar{display:none}` — o scroll permanece funcional (wheel/toque/teclado); tokens `--scrollbar-*` mantidos como reserva |

**Exceção permitida:** inputs de texto base (`<input type="text">`, textarea) — desde que **sempre encapsulados** em primitivos do app (`Input`, `MoneyInput`), nunca usados crus em telas.

**Regra de criação:** qualquer novo controle nativo que precise ser usado deve primeiro virar um primitivo em `components/ui/` (ver `docs/PROJECT_STRUCTURE.md` §8) — proibido ad-hoc em tela.

**Tamanhos de Modais no Desktop (`size`):** o componente `Modal` expõe a prop `size?: ModalSize` (`"sm"`: 384px, `"md"`: 448px [default], `"lg"`: 512px, `"xl"`: 768px, `"2xl"`: 1024px, `"3xl"`: 1152px, `"full"`: 1280px). Modais com tabelas analíticas, dossiês executivos A4 e relatórios contábeis utilizam `"2xl"` ou `"3xl"` para garantir excelente respiro e leitura fluida no desktop.

**Calculadora em modais (`showCalculator`):** o componente `Modal` expõe a prop `showCalculator` (default `false`). O botão de calculadora **só deve aparecer em modais com campo de valor monetário** (i.e., que contêm `MoneyInput`). Modais de confirmação, exclusão, visualização, importação e configuração **nunca passam `showCalculator`**. Modais com `elevated={true}` ignoram a prop (a calculadora não abre sobre si mesma).

**Ações no Cabeçalho de Modais (`headerActions`):** o componente `Modal` expõe a prop `headerActions?: ReactNode`, permitindo injetar ações de topo (como botões de imprimir PDF, exportar, compartilhar) diretamente ao lado do botão de fechar nativo do Radix Dialog, eliminando cabeçalhos redundantes internos.

**Padrão de Relatórios e Impressão A4 (`ReportDocumentLayout` + `usePrint`):**
- **Contêiner Canônico (`ReportDocumentLayout`):** unifica o preview interativo na tela (`size="2xl"`, scroll interno e cabeçalho com ações) e a folha de impressão em `@media print` via portal `PrintSheet` montado em `document.body`.
- **Nomenclatura Contextual de Arquivo (`documentTitle`):** o hook `usePrint` define temporariamente o `document.title` durante a captura do navegador (ex.: `Fatura_Nubank_2026-08.pdf`, `Informe_Rendimentos_IRPF_2026.pdf`), garantindo nomes profissionais ao salvar o PDF e restaurando o título original do app automaticamente.
- **Regras Físicas A4 (`@page`):** margem de `10mm 12mm 10mm 12mm` com ritmo vertical editorial e fluido (`gap-4.5` a `gap-5` entre seções principais, `gap-2.5` a `gap-3` em sub-blocos, `p-4.5` / `print:p-4` em cards de síntese/risco e células de tabela com `py-1.5 px-2.5`), anti-corte por linhas de tabela (`tr { break-inside: avoid !important }`), anti-órfãos (`break-after: avoid !important` em títulos/cabeçalhos), quebra explícita de página (`print:break-before-page`) para seções de inventário/custódia e repetição automática de cabeçalhos de tabela (`thead { display: table-header-group !important; }`).

---

## 12. ENTRADA MONETÁRIA — PADRÃO NUBANK (INPUT MONETÁRIO PROGRESSIVO)

Padrão oficial de entrada de valores do app — herdado do app antigo (estilo Nubank). **Todas** as telas que recebem valores (wizard de lançamento, formulários de despesa/renda, limites de orçamento, metas, cobranças) usam o mesmo componente `MoneyInput` — nenhuma tela reimplementa a lógica (DRY).

### 12.1 Comportamento

1. **Digitação da direita para a esquerda:** só números (sem vírgula/ponto); o primeiro dígito entra nos **centavos** e cada novo dígito desloca o valor para a esquerda:

   | Digitar | Dígitos crus | Exibição |
   |---|---|---|
   | `1` | `1` | R$ 0,01 |
   | `5` | `15` | R$ 0,15 |
   | `0` | `150` | R$ 1,50 |
   | `0` | `1500` | R$ 15,00 |
   | `0` | `15000` | R$ 150,00 |
   | `0` | `150000` | R$ 1.500,00 |

   > **Regra central:** a string de dígitos crus é interpretada como um inteiro de **centavos** (`1500` = 1500 centavos = R$ 15,00). Zeros à esquerda são descartados naturalmente.

2. **Backspace:** remove o último dígito (recuo na ordem inversa) — `R$ 15,00` → `R$ 1,50`; de `R$ 0,01` volta para `R$ 0,00`.
3. **Formatação:** sempre `R$` + separador de milhar `.` + decimal `,` (Intl pt-BR); o campo **nunca fica vazio** (mostra `R$ 0,00`).
4. **Colar é suportado:** extrai apenas os dígitos da string colada (ex.: `R$ 1.500,00` → 150000 centavos).
5. **Limite:** 12 dígitos (compatível com `numeric(12,2)` → máx. `9.999.999.999,99`).
6. **Caret sempre no fim** — impede inserção no meio do valor; digitação e backspace operam sempre nas extremidades.
7. Valores **negativos não são digitáveis** neste campo (despesas/receitas positivas; estornos são fluxo de cartões).

### 12.2 Onde vive o código (DRY)

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Domínio puro | `src/domain/money/currency-input.ts` | Máquina de estados (appendDigit/removeLastDigit/extractDigits/centsFromDigits/digitsFromCents) — sem UI, testável |
| Apresentação | `src/services/masks/money.ts` | `formatCentsAsBRL(cents)` — Intl pt-BR (`R$ 1.500,00`) |
| Estado | `src/hooks/use-currency-input.ts` | Hook controlado: `digits`, `valueCents`, `value`, `display`, `handleChange`, `handleKeyDown`, `setCents`, `clear` |
| UI | `src/components/ui/money-input.tsx` | Componente controlado por centavos (`cents`/`onCentsChange`) com variantes `sm | md | lg` |
| Testes | `src/domain/money/currency-input.test.ts` | Sequência Nubank, backspace, paste, limite e formatação |

### 12.3 API do componente

```tsx
<MoneyInput
  cents={valueCents}
  onCentsChange={setValueCents}
  size="lg"      // sm: tabelas/filtros · md: formulários · lg: passo de valor do wizard (text-3xl, centralizado)
  disabled={saving}
  aria-label="Valor da despesa"
/>
```

### 12.4 Estilo & acessibilidade

- Fonte **mono + tabular-nums** (identidade "Terminal" — números são protagonistas).
- `type="text"` + `inputMode="numeric"` → teclado numérico no mobile, sem spinners de `type=number`.
- Estados seguem §7: foco com ring `--ring`, disabled 50%, erro → borda `critical-strong` + mensagem via gateway (`getErrorMessage`).
- `label`/`aria-label` obrigatória; erro associado via `aria-describedby`.

### 13.1 PercentInput (Entrada Percentual Progressiva)
- **Componente:** `src/components/ui/percent-input.tsx` (primitivo).
- **Comportamento:** Segue o mesmo padrão progressivo do `MoneyInput` (estilo Nubank), onde a digitação alimenta os centésimos da direita para a esquerda (`"852"` $\to$ `"8,52"` / `8.52%`), eliminando problemas de parsing com ponto/vírgula.
- **Sufixo Dinâmico:** Suporta indicação contextual (`%`, `% do CDI`, `% da Selic`, `% a.a.`, `% a.a. + IPCA`).
- **Contrato:** `value?: number`, `onValueChange?: (val: number) => void`, `suffix?: string`.

---

## 14. RECURSOS VISUAIS PREMIUM & MICRO-INTERAÇÕES

### 14.1 Number Ticker (Transição Numérica Animada)
- **Componente:** `src/components/ui/number-ticker.tsx` (primitivo).
- **Comportamento:** Ao alternar de mês ou atualizar valores de KPIs, os dígitos realizam interpolação suave em ~300ms via `requestAnimationFrame` em vez de um salto brusco.
- **Acessibilidade & Governança de Movimento:** Mantém fonte mono (`IBM Plex Mono`) e `tabular-nums` com largura fixa; respeita estritamente `prefers-reduced-motion: reduce`, o nível de movimento interno do app (`motionLevel === "reduced"`) e o toggle de preferência do usuário (`numberTickerEnabled: false`), exibindo o valor numérico final de forma imediata e estática sem acionar o loop de animação JS.

### 14.2 Feedback Sensorial Unificado (Sound & Haptic Feedback)
- **Gateway Central:** `src/services/sensory.ts` (`triggerSensory`, `sensory.*`).
- **Serviços Subjacentes:**
  - Áudio: `src/services/audio-fx.ts` (Sintetizador Web Audio API de 6 efeitos: `click`, `pop`, `success`, `delete`, `warning`, `error`).
  - Háptico: `src/services/haptics.ts` (`navigator.vibrate` com 6 padrões calibrados: `light`, `medium`, `success`, `warning`, `destructive`, `error`).
- **Taxonomia de Intenções Semânticas:**
  - `selection` → Toque suave (`light` / `click`) em tabs, datepickers, selects, radio groups, checkboxes, color/icon pickers e toggles de filtro.
  - `action` → Disparo de botões de comando primário/secundário e FAB (`light` / `click`).
  - `toggle` → Alternância de switches, checkboxes e atalhos de exibição/privacidade (`light` / `pop`).
  - `success` → Confirmações de persistência, criação e importação de lançamentos (`success` [12, 40, 24]ms / acorde harmônico `success`).
  - `warning` → Avisos e atenções (`warning` [30, 40, 30]ms / bitom `warning`).
  - `destructive` → Exclusões e operações destrutivas (`destructive` [40, 60, 40]ms / tom descendente `delete`).
  - `error` → Falhas de validação e impedimentos (`error` [50, 40, 50, 40]ms / tom dissonante `error`).
- **Governança de Preferências e Blindagem Absoluta:**
  - **Respeito Incondicional:** `triggerHaptic` consulta `getVisualCustomization().hapticEnabled` por padrão — quando desligado pelo usuário, **nenhuma vibração é disparada no dispositivo**, mesmo se chamada de forma direta.
  - **Zero Duplos Disparos (*Anti-Double-Haptic*):** O primitivo `<Button />` já dispara `triggerSensory("action" | "destructive")` internamente. É estritamente proibido adicionar chamadas manuais a `triggerHaptic` dentro de handlers `onClick` de botões.
  - **Silêncio Estrito na Digitação:** Proibido emitir feedback tátil/sonoro durante a digitação em campos (`MoneyInput`, `Input`, `Textarea`), no scroll passivo ou no hover de desktop.
  - **Personalização Granular:** O usuário pode ativar ou silenciar individualmente qualquer uma das 7 categorias (`disabledSensoryIntents`), personalizando a experiência tátil e auditiva com botões de pré-escuta/teste instantâneo na aba Sensorial.
  - Degradação graciosa: sem falhas em SSR, JSDOM ou navegadores/dispositivos sem suporte a `AudioContext` ou `navigator.vibrate`.

### 14.3 Interação Direta de Linhas (Direct Click Interaction)
- **Componente:** `src/components/modules/transaction-row.tsx`.
- **Mecânica:** As linhas de transação utilizam o modelo de interação integral direta por clique/toque (Whole-Element Interaction). Clicar na linha abre o diálogo de detalhes/edição com disparo sensorial suave (`sensory.selection()`). Ações destrutivas (exclusão) são concentradas com segurança dentro dos diálogos de detalhes com confirmação explícita (`ConfirmDialog`), eliminando estados ocultos e colisões de gestos.

### 14.4 Densidade Universal Equilibrada & Responsiva de Fábrica
- **Padrão Oficial:** O aplicativo adota a densidade universal calibrada de fábrica, eliminando a necessidade de configuração manual e garantindo perfeita ergonomia de toque e leitura em qualquer dispositivo.
- **Mobile (< 640px):** Altura confortável de 48px a 52px (`py-2.5`), garantindo área útil de toque seguro com o polegar (WCAG AA).
- **Desktop (≥ 640px):** Altura analítica compacta de 40px a 44px (`py-2`), permitindo visualizar 50% a 70% mais linhas na tela de extrato e custódia sem rolagem excessiva.

### 14.5 Modo Privacidade / Ocultar Valores ("Privacy Masking")
- **Componente:** `src/components/layout/privacy-toggle.tsx` + hook `usePrivacyMask`.
- **Efeito:** Ofusca valores monetários no app inteiro substituindo o conteúdo por máscara de pontos (`••••••`) ou aplicando classe `.privacy-masked` (`filter: blur(6px)` + `user-select: none`).
- **Ativação:** Toggle no Header (ícone `Eye`/`EyeOff`) ou atalho de teclado `P`.

### 14.6 Micro-Sparklines de Tendência
- **Componente:** `src/components/ui/sparkline.tsx`.
- **Estilo:** Curva SVG vetorial minimalista (1px stroke com gradiente sutil de preenchimento opacidade 15%) exibida discretamente no canto de `KpiCard` para demonstrar a trajetória dos últimos 3 a 6 meses.

### 14.7 Gráfico de Fluxo Diário com Curvas Suaves (Bézier Cúbicas)
- **Módulo:** `src/components/modules/daily-flow-chart.tsx`.
- **Estilo & Interatividade:** Curvas suaves Bézier cúbicas orgânicas sem cantos pontiagudos e **sem sombras nas linhas**, com preenchimentos em gradiente leve e linhas guias horizontais limpas; suporte a scrubbing interativo (ponteiro/toque) com tooltip flutuante exibindo entradas, saídas e resultado do dia.

### 14.8 Gráfico Donut de Categorias (Alto Contraste)
- **Módulo:** `src/components/modules/category-donut.tsx`.
- **Estilo:** Anel SVG de alto contraste com trilha de fundo nítida (`stroke-border/70`), centro tipográfico estruturado (Total) e lista de categorias com porcentagem, valores formatados e mini-barras de progresso relativas de alta legibilidade.

### 14.9 Transições de Rota no PageShell ("App-like Transitions")
- **Estilo:** Fade + micro-slide suave de 150ms na entrada de novas páginas no `<Outlet />` (`opacity: 0 → 1`, `translateY: 4px → 0px`), automaticamente desativado se `prefers-reduced-motion: reduce`.

### 14.10 Identidade Visual & Assets Oficiais da Marca
- **Componente:** `src/components/layout/brand-logo.tsx`.
- **Assets:** Gerados a partir de `identidadeVisual/` em `public/brand/` (`logo.png`, `logo-192.png`, `logo-128.png`, `logo-64.png`, `logo-32.png`, `favicon-32.png`, `favicon-16.png`, `favicon.svg`, `logo-full.png`) e `public/pwa/icons/` (`icon-192.png`, `icon-512.png` com transparência icon-only `purpose: "any"`, `maskable-192.png`, `maskable-512.png` com fundo seguro `purpose: "maskable"`, `apple-touch-icon-180.png`, `favicon.ico`, `favicon.svg`).
- **Padrão:** O `BrandLogo` renderiza o emblema oficial com antialiasing de alta resolução, suporte a modos símbolo único, marca horizontal e lockup completo com subtítulo ("Organização & Economia"), padronizado em Header mobile, Sidebar desktop, AuthShell, MoreMenu e PWA.

### 14.11 Iconografia Sem Fundo ("Icon-Only") & Hierarquia Balanceada de Ícones em Cards
- **Diretriz Global:** Todos os ícones da aplicação seguem o padrão *icon-only* limpo, sem containers visuais decorativos atrás (sem classes `bg-primary/10`, `rounded-full`, `rounded-lg`, `p-2` ou sombras/bordas ao redor do ícone). Contêineres de fundo (`size-7`/`size-8 rounded-lg bg-surface-hover`) são restritos exclusivamente a **botões com ação de clique direta** (ex.: fechar, editar inline, excluir).
- **Matriz de Hierarquia Semântica (Prevenção de Fadiga de Acento):**
  - **Informativo / Estrutural / Cabeçalhos (`CardTitle` / `CardHeader`):** Ícone em tom **neutro suave (`text-muted-foreground`)** no padrão *icon-only* (`size-4` / 16px). É expressamente proibido aplicar `text-primary` arbitrariamente em ícones descritivos estáticos para evitar sobrecarga e fadiga visual (*accent fatigue*).
  - **Fluxo Financeiro Direto:** Cores semânticas exclusivas:
    - *Receitas / Entradas / Saldo Positivo:* `text-positive-strong` (Teal / Verde);
    - *Despesas / Saídas / Saldo Negativo:* `text-negative-strong` (Coral / Vermelho);
    - *Investimentos / Carteira / Aportes:* `text-portfolio` (Sky / Azul Petróleo).
  - **Risco & Atenção:** `text-warning-strong` (Atenção / Desvio) ou `text-critical-strong` (Atraso / Estouro).
  - **Cor de Destaque (*Accent / Primary*):** Reservada estritamente para **interatividade ativa** (botões de comando/CTA, abas ativas, switches ligados, radio buttons selecionados e anel de foco `--ring`).
- **Dimensões & Stroke Padronizados:** Ícones utilizam tamanhos da escala (`size-3.5`, `size-4`, `size-5`, `size-6` em empty states) com stroke uniforme (`lucide-react`) e `aria-hidden="true"`, garantindo coerência visual, contraste WCAG AA e alinhamento impecável em todos os módulos e dispositivos.

### 14.12 Micro-Interações "Obsidian Glass" & Indicadores Reativos de Ação
- **Morphing Action Buttons (`InsightList`):** Em Assinaturas & Recorrências, a ação de ignorar ou confirmar é unificada em botões de ação que transmitem transição imediata de estado com micro-animação física (`animate-spring-pop`) e remoção de badges redundantes.
- **Checklist Interativo de Aportes (`AporteResult`):** As rotas de aporte sugeridas suportam marcação de execução em lote ("Pendente" ↔ "Feito") com contagem dinâmica de execução nos KPIs e disparo háptico imediato (`light` / `success`).
- **Barra de Progresso de Orçamento (`BudgetProgressBar` & `Progress`):** Indicador visual de progresso com transição CSS contínua (`transition-[width,background-color] duration-300`) e destaque tipográfico semântico (`text-critical`) para o estado "Excedido".
- **Controles Globais Responsivos (`PrivacyToggle`, `MonthPicker`):** Navegação mensal por slide suave com `animate-fade-slide-in` e alternância do modo privacidade com micro-rotação `animate-spring-pop` e disparo háptico calibrado.
- **Respeito a Níveis de Movimento:** Todas as animações são suprimidas ou simplificadas automaticamente nos modos `eco` e `reduced` via `data-motion` no root.

### 14.13 Rolagem ao Topo na Aba Ativa ("Tap-Active-Tab to Scroll to Top")
- **Serviço Central:** `src/services/scroll.ts` (`scrollToTop`).
- **Componentes:** `src/components/layout/bottom-nav.tsx` e `src/components/layout/sidebar.tsx`.
- **Mecânica:**
  - Ao clicar ou tocar em um item de navegação (BottomNav ou Sidebar) cuja rota **já é a rota ativa atual**, a aplicação não recarrega a página nem desvia o histórico: intercepta o evento e executa a rolagem suave até o topo (`#main-content` / `window`).
  - **Feedback Sensorial:** No mobile, ao disparar a subida de uma página rolada (`scrollTop > 0`), emite um pulso háptico suave (`triggerSensory("selection", { skipSound: true })`), sem emissão sonora para preservar o silêncio e evitar fadiga auditiva na navegação.
  - **Acessibilidade (`prefers-reduced-motion`):** Em ambientes com redução de movimento ativada, a rolagem ocorre instantaneamente (`behavior: "auto"`).
  - **No-op Elegante:** Se a página já estiver no topo (`scrollTop === 0`), nenhum scroll ou vibração redundante é disparado.

### 14.14 Interação Integral do Elemento (Whole-Element Interaction & Remoção de Lápis)
- **Diretriz de Usabilidade:** Eliminação de botões de edição redundantes ("lápis") em listas e cartões de domínio (Categorias, Dívidas, Orçamentos, Posições da Carteira, Lançamentos e Cartões de Crédito). O próprio container ou linha torna-se o acionador primário da edição.
- **Hierarquia Visual Limpa:** Telas ficam despoluídas e minimalistas, aumentando a área útil de toque (*touch target*) no mobile e a ergonomia no desktop.
- **Acessibilidade Estrita & Prevenção de Controles Aninhados (WCAG / axe):**
  - O elemento interativo principal possui semântica de botão (`<button>` ou `<div role="button">` com `tabIndex={0}`, `aria-label` descritivo e suporte a `Enter`/`Space`).
  - Ações secundárias (ex.: botão "Quitar", exclusão) são organizadas como elementos irmãos (*siblings*) dentro do layout flex, prevenindo violações de *nested-interactive controls*.
- **Feedback Tátil & Visual:** Cada clique de edição dispara `triggerHaptic("light")` e aplica estados visuais de `cursor-pointer`, `hover:bg-surface-hover/60` e `active:scale-[0.99]`.

### 14.15 Contenção e Responsividade Mobile (Zero Horizontal Overflow & Safe Flex/Grid)
- **Diretriz de Contenção de Layout:** Nenhum elemento ou card de dashboard pode ultrapassar a largura do viewport em dispositivos móveis (< 640px).
- **Regra de Flexbox & Grid:**
  - Todo filho de flex/grid que contém texto dinâmico ou truncado deve ter `min-w-0` e `flex-1 truncate` (evitando expansão forçada por `min-content` de strings longas como nomes de categorias ou descrições).
  - Rótulos em gráficos e listas de distribuição (`CategoryDonut`, `DailyFlowChart`, `KpiCard`) usam truncamento com tooltip acessível (`title` nativo ou Radix Tooltip) e valores monetários/percentuais com `shrink-0` e `tabular-nums`.
- **Delimitação de Gráficos SVG:**
  - Contêineres de gráficos SVG (`DailyFlowChart`, `Sparkline`, `CategoryDonut`) usam `overflow-hidden` e `w-full min-w-0` com limites de pontos/marcadores contidos (*clamped*), impedindo vazamento de traços vetoriais fora das margens do card.
- **Espaçamento Responsivo:** Cards e contêineres adotam padding responsivo (`p-4 sm:p-5`, `px-3.5 sm:px-4`) para manter proporções ideais e máxima área útil em telas estreitas (≥ 320px).

### 14.17 Hierarquia de Abas, Rótulos Únicos & Alinhamento Responsivo (Underline Nível 1 & Pills Nível 2)
- **Componente:** `src/components/ui/tabs.tsx` (`variant="underline"` e `variant="pills"`).
- **Hierarquia Estrita de 2 Níveis e Limite de 3 Abas Principais:**
  - **Nível 1 (Navegação Primária da Tela):** **Tabs Padronizadas (`variant="underline"`)** com borda inferior ativa de 2px na cor primária. É a primeira opção e o padrão oficial da aplicação em todas as telas principais, configuradas com no máximo **3 abas** para ergonomia visual:
    - *Investimentos:* `Carteira`, `Aporte`, `Proventos` (com ferramentas no rodapé da Carteira).
    - *Insights:* `Diagnósticos`, `Recorrências`, `Projeção` (com planejamento de longo prazo integrado em Projeção).
    - *Configurações:* `Aparência`, `Interface`, `Dados`.
    - *Dívidas:* `Pagar`, `Receber`, `Financiamentos`.
    - *Relatórios:* `Mês`, `Ano`, `Custom`.
    - *Orçamentos / Categorias:* `Despesas`, `Rendas`.
    - *Lembretes:* `Pendentes`, `Lidas`.
  - **Nível 2 (Subdivisões Internas de Conteúdo):** **Exclusivamente Pills (`variant="pills"`)**. Usado *apenas* quando uma aba de Nível 1 possui sub-divisões internas de dados:
    - Em *Investimentos -> Aporte:* `Calculadora` | `Metas` | `Histórico`.
    - Em *Investimentos -> Proventos:* `Extrato` | `Calendário`.
    - Em *Relatórios -> Agregação:* `Categorias` | `Encargos` | `Formas` | `Dias`.
  - **Regra Anti-Aninhamento:** Proibido `pills` dentro de `pills` e proibido `underline` dentro de `underline`.
- **Rótulos Únicos & Tipografia Confortável:**
  - Todo rótulo de aba utiliza **1 única palavra ou termo conciso** (zero nomes compostos com `&`, `e` ou preposições como *"Por..."*, *"Avisos &..."*, *"Conta &..."*).
  - Tipografia confortável e nítida padronizada em **`text-sm font-medium` (14px)** em todos os dispositivos.
- **Responsividade Inteligente:**
  - **Mobile (`< 640px`):** As abas tomam **100% da largura útil (`w-full`)** com divisão simétrica entre os botões (`flex-1 text-center`), garantindo toques confortáveis com o polegar (*thumb-friendly*), sem rolagem horizontal e sem cortes.
  - **Desktop (`≥ 640px`):** As abas ficam **alinhadas naturalmente à esquerda (`w-auto flex-initial sm:text-left`)**, ocupando apenas o espaço dos seus rótulos com espaçamento harmônico, sem se esticar artificialmente pela tela.
- **Ícones em Abas (Nível 1 vs Nível 2):**
  - **Nível 1 (`variant="underline"`):** Utilizam **ícones padronizados `lucide-react`** (`[&_svg]:size-3.5 sm:[&_svg]:size-4 shrink-0` com `aria-hidden="true"`), proporcionando reconhecimento visual imediato e refinamento estético em paridade entre todas as páginas.
  - **Nível 2 (`variant="pills"`):** **Sem ícones (apenas texto)**, mantendo os segmentos leves, compactos e livres de poluição visual.

### 14.18 Badges Estruturados e Escala Dimensional (`size="xs" | "sm" | "md"`)
- **Componente:** `src/components/ui/badge.tsx`.
- **Catálogo de Escala Oficial:**
  - `size="xs"` (10px): chips densos em tabelas, extratos e listas compactas (`px-1.5 py-0 text-[10px] font-medium leading-none`);
  - `size="sm"` (11px — Padrão): status de cards, cabeçalhos e diálogos (`px-2 py-0.5 text-[11px] font-medium`);
  - `size="md"` (12px): destaque em hero cards, banners e fechamentos contábeis (`px-2.5 py-1 text-xs font-semibold`).
- **Regra:** É expressamente proibido aplicar classes manuais ad-hoc de font-size e padding (`text-[10px] py-0 px-1.5`) diretamente nas telas.

### 14.19 Empty States Calmos & Foco Visual no Call-to-Action
- **Componente:** `src/components/ui/empty-state.tsx`.
- **Diretriz de Sobriedade:** Estados vazios adotam como padrão `tone="default"` (`text-muted-foreground`), transmitindo tranquilidade visual e guiando o olhar do usuário imediatamente para o botão de ação principal (*CTA*), onde a cor de destaque (*Accent / Primary*) reside com intencionalidade.

### 14.20 Anatomia de Formulários, Diálogos & Consistência de Superfícies
- **Campos de Formulário:** Rótulo em `text-xs font-semibold text-foreground`, helper text explicativo em `text-[11px] text-muted-foreground` e campos não-obrigatórios indicados pelo sufixo discreto `(opcional)` em `text-muted-foreground/80`.
- **Rodapés de Diálogos (`ModalFooter`):** Ordem unificada em 100% dos diálogos com Cancelar à esquerda e Confirmar à direita no desktop (`flex-row justify-end gap-2`), e empilhamento seguro no mobile (`flex-col-reverse gap-2`).
- **Superfície Canônica de Cards:** Cards de dados utilizam consistentemente a combinação `border-border/80 bg-surface shadow-xs`.

### 14.21 Gráficos Donut Padronizados, Arcos Arredondados e Normalização Geométrica
- **Componentes:** `src/components/modules/category-donut.tsx`, `src/components/modules/interactive-target-donut.tsx`, `src/components/modules/reports/report-donut-chart.tsx`.
- **Geometria de Arcos Pill & Zero Sobreposição:**
  - Fatias com valor $\le 0$ são ignoradas no SVG (não geram arcos fantasmas).
  - Todas as fatias ativas utilizam `strokeLinecap="round"` com compensação angular e gap limpo garantido de **5px** entre si.
  - Normalização geométrica (`computeVisualShares`): fatias de valor muito baixo recebem uma cota mínima visual ($\approx 5\%$) no anel, mantendo todas as fatias encorpadas e arredondadas sem agulhas ou deformações visuais.
- **Agrupamento de Cauda Longa (Top 6 + Outros):**
  - Quando houver mais de 7 itens (ex.: carteira de investimentos com 20+ ativos), o anel SVG renderiza os Top 6 maiores e consolida a cauda longa em uma única fatia elegante **`Outros (N)`**, evitando o efeito "colar de pontos".
  - A lista de legendas completa mantém todos os itens acessíveis e navegáveis.
- **Layout de Legendas em 2 Colunas (`grid-cols-1 sm:grid-cols-2`):**
  - Quando a lista possui mais de 4 itens, ela se organiza automaticamente em **2 colunas** no tablet e desktop, reduzindo a altura vertical pela metade.
- **Centro Dinâmico e Governança Tipográfica:**
  - O miolo do Donut alterna fluidamente entre `"TOTAL"` e a fatia ativa (ao passar o mouse ou clicar), com feedback tátil sensorial centralizado (`triggerSensory("selection")`).
  - O rótulo e o ponto indicador ficam alinhados em **linha única** com truncamento elegante no nome para preservar a simetria central.
  - Valores monetários são sempre 100% visíveis em linha (`whitespace-nowrap tabular-nums tracking-tight`) com auto-fit dinâmico, sem reticências (Regra 11).
- **Dimensionamento Responsivo Fluido:**
  - Escala progressiva do anel: `size-44` (mobile 176px) $\rightarrow$ `sm:size-48` (192px) $\rightarrow$ `md:size-52` (208px) $\rightarrow$ `lg:size-56` (224px) $\rightarrow$ `xl:size-60` (240px no desktop), centralizado verticalmente no card (`self-center md:items-center`).
