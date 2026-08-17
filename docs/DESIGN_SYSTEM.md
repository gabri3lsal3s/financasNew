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
| `--shadow-sm` | `0 1px 2px rgb(0 0 0/4%)` | Cards em estado padrão, linhas elevadas |
| `--shadow-md` | `0 2px 8px rgb(0 0 0/6%)` | Cards flutuantes, dropdowns |
| `--shadow-lg` | `0 8px 24px rgb(0 0 0/10%)` | Modais, command palette (⌘K) |
| `--shadow-kpi` | anel accent + glow suave | **KPI principal** por tela (1 no máx.) |

**Regras:** elevação por sombra, nunca por cor escura; dark/oled dependem mais de bordas do que de sombras (alpha maior); o **glow de KPI** é reservado a um único número-chave por tela (ex.: saldo do mês) — nunca vários.

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

---

## 10. MAPEAMENTO PARA O CÓDIGO

| Arquivo | Papel |
|---|---|
| `src/styles/tokens.css` | **Fonte única da verdade** — todos os tokens (3 temas + fallback de sistema) |
| `src/styles/globals.css` | Importa tokens; `@theme inline` (Tailwind v4) gera utilitários `bg-primary`, `text-negative`, `rounded-xl`, `shadow-kpi`, `font-mono`, `bg-cat-3`…; utilitários `.num` e `.display`; base (body, selection, focus) |
| `tailwind.config.ts` | **Somente se a Fase 0 usar Tailwind v3** — bloco completo no final de `globals.css` |
| `index.html` | Carregar Google Fonts: Inter (400/500/600/700), Sora (700/800), IBM Plex Mono (400/500/600) + `preconnect` |

**Fluxo de tema:** `ThemeProvider` (Fase 0) resolve `system → light|dark` e grava `data-theme` em `<html>`; preferência persistida em `user_preferences.theme`. O fallback `@media (prefers-color-scheme)` evita flash sem JS.

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

---

## 14. RECURSOS VISUAIS PREMIUM & MICRO-INTERAÇÕES

### 14.1 Number Ticker (Transição Numérica Animada)
- **Componente:** `src/components/ui/number-ticker.tsx` (primitivo).
- **Comportamento:** Ao alternar de mês ou atualizar valores de KPIs, os dígitos realizam interpolação suave em ~300ms via `requestAnimationFrame` em vez de um salto brusco.
- **Acessibilidade:** Mantém fonte mono (`IBM Plex Mono`) e `tabular-nums` com largura fixa; respeita estritamente `prefers-reduced-motion: reduce` (exibição imediata sem transição).

### 14.2 Feedback Háptico Tátil (Haptic Touch)
- **Serviço:** `src/services/haptics.ts`.
- **Intensidades padronizadas:**
  - `light` (8ms) → toques em botões de filtro, tabs e teclas da calculadora.
  - `medium` (14ms) → abertura do FAB central (`+ Novo`) e injeção de valor da calculadora.
  - `success` (dois pulsos: 10ms + 40ms pausa + 12ms) → conclusão de lançamentos e pagamentos.
  - `warning` / `error` (dois pulsos de 20ms) → exclusões e alertas críticos.
- **Compatibilidade:** Degradação graciosa (ignora silenciosamente se o navegador/hardware não suportar `navigator.vibrate`).

### 14.3 Gestos Mobile (Swipe-to-Action)
- **Hook & Integração:** `src/hooks/use-swipe-action.ts` integrado em `TransactionRow`.
- **Mecânica:** Deslizar linha para a esquerda revela atalhos rápidos com feedback visual suave e disparo háptico leve ao atingir o limiar de ativação (threshold de 72px).

### 14.4 Controle de Densidade (Compacto vs. Confortável)
- **Confortável (Padrão):** Linhas com altura de 48px a 52px (py 12px), ideal para uso tátil mobile.
- **Compacto:** Linhas com altura de 38px a 40px (py 8px), ideal para visualização densa de múltiplas linhas no desktop.
- **Persistência:** Gravado na preferência do usuário (`user_preferences` / `localStorage`).

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

### 14.11 Iconografia Sem Fundo ("Icon-Only") & Tokens Semânticos
- **Diretriz Global:** Todos os ícones da aplicação seguem o padrão *icon-only* limpo, sem containers visuais decorativos atrás (sem classes `bg-primary/10`, `rounded-full`, `rounded-lg`, `p-2` ou sombras/bordas ao redor do ícone).
- **Herança & Tokens Semânticos:** Ícones herdam a cor semântica do tema ativo (`text-primary`, `text-primary-strong`, `text-muted-foreground`, `text-positive-strong`, `text-critical-strong`, `text-portfolio`) ou cores diretas da categoria quando aplicável (`CategoryIcon`). Cores estáticas hardcoded (ex.: `text-blue-500`, `text-purple-600`) são expressamente proibidas.
- **Dimensões & Stroke Padronizados:** Ícones utilizam tamanhos da escala (`size-3.5`, `size-4`, `size-5`, `size-6` em empty states) com stroke uniforme (`lucide-react`), garantindo coerência visual e alinhamento impecável em todos os módulos e dispositivos.

### 14.12 Micro-Interações "Obsidian Glass" & Indicadores Reativos de Ação
- **Morphing Action Buttons (`InsightList`):** Em Assinaturas & Recorrências, a ação de ignorar ou confirmar é unificada em botões de ação que transmitem transição imediata de estado com micro-animação física (`animate-spring-pop`) e remoção de badges redundantes.
- **Checklist Interativo de Aportes (`AporteResult`):** As rotas de aporte sugeridas suportam marcação de execução em lote ("Pendente" ↔ "Feito") com contagem dinâmica de execução nos KPIs e disparo háptico imediato (`light` / `success`).
- **Barra de Progresso de Orçamento (`BudgetProgressBar` & `Progress`):** Indicador visual de progresso com transição CSS contínua (`transition-[width,background-color] duration-300`) e destaque tipográfico semântico (`text-critical`) para o estado "Excedido".
- **Controles Globais Responsivos (`PrivacyToggle`, `MonthPicker`):** Navegação mensal por slide suave com `animate-fade-slide-in` e alternância do modo privacidade com micro-rotação `animate-spring-pop` e disparo háptico calibrado.
- **Respeito a Níveis de Movimento:** Todas as animações são suprimidas ou simplificadas automaticamente nos modos `eco` e `reduced` via `data-motion` no root.

### 14.13 Interação Integral do Elemento (Whole-Element Interaction & Remoção de Lápis)
- **Diretriz de Usabilidade:** Eliminação de botões de edição redundantes ("lápis") em listas e cartões de domínio (Categorias, Dívidas, Orçamentos, Posições da Carteira, Lançamentos e Cartões de Crédito). O próprio container ou linha torna-se o acionador primário da edição.
- **Hierarquia Visual Limpa:** Telas ficam despoluídas e minimalistas, aumentando a área útil de toque (*touch target*) no mobile e a ergonomia no desktop.
- **Acessibilidade Estrita & Prevenção de Controles Aninhados (WCAG / axe):**
  - O elemento interativo principal possui semântica de botão (`<button>` ou `<div role="button">` com `tabIndex={0}`, `aria-label` descritivo e suporte a `Enter`/`Space`).
  - Ações secundárias (ex.: botão "Quitar", exclusão) são organizadas como elementos irmãos (*siblings*) dentro do layout flex, prevenindo violações de *nested-interactive controls*.
- **Feedback Tátil & Visual:** Cada clique de edição dispara `triggerHaptic("light")` e aplica estados visuais de `cursor-pointer`, `hover:bg-surface-hover/60` e `active:scale-[0.99]`.

