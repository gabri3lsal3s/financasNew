# 🎨 DESIGN_SYSTEM.md — Identidade Visual & Design Tokens

> **Status:** v1.0 — Identidade aprovada: **"Vital · Verde + Terminal"** (combinação das propostas A+B).
> Base acolhedora de bem-estar financeiro (esmeralda) + precisão técnica de leitura de números (mono/tabular).
> Tema padrão: **segue o sistema** · Densidade: **equilibrada** · Cores de categoria: **paleta restrita e sóbria**.
> **Tokens implementados em:** `src/styles/tokens.css` (fonte única) + `src/styles/globals.css` (mapeamento Tailwind v4).

---

## 1. PRINCÍPIOS DA IDENTIDADE

1. **Calma e controle** — o app transmite "seu dinheiro sob controle", nunca "mercado de risco". Verde esmeralda como âncora emocional.
2. **Números são protagonistas** — valores, taxas e percentuais usam **IBM Plex Mono com tabular-nums**: alinhamento perfeito em tabelas, leitura rápida em dashboards.
3. **Semântica financeira imediata** — verde = entra dinheiro, vermelho = sai dinheiro, âmbar = atenção, vermelho forte = crítico, azul = investimentos/rebalanceamento. Nunca variar esses significados.
4. **Sobriedade nas categorias** — paleta restrita e dessaturada: cor ajuda a reconhecer, não compete com os dados.
5. **Tudo é token** — nenhuma cor/fonte/raio/sombra hard-coded em componente; qualquer alteração em `tokens.css` propaga para o app inteiro (DRY).

---

## 2. CORES — TOKENS

### 2.1 Marca e neutros

| Token | Light | Dark | OLED | Uso |
|---|---|---|---|---|
| `--background` | `60 9% 98%` `#FAFAF9` | `222 47% 11%` `#0F172A` | `0 0% 0%` `#000` | Fundo de tela |
| `--surface` | `0 0% 100%` `#FFF` | `217 33% 17%` `#1E293B` | `0 0% 4%` `#0A0A0A` | Cards, modais, tabelas |
| `--surface-hover` | `24 6% 95%` | `216 30% 21%` | `0 0% 9%` | Hover de linhas/cards |
| `--surface-active` | `24 6% 92%` | `216 29% 25%` | `0 0% 13%` | Estado pressionado |
| `--border` | `24 6% 90%` `#E7E5E4` | `215 28% 27%` `#334155` | `0 0% 14%` | Bordas e divisores |
| `--input` | `24 5% 83%` | `215 24% 32%` | `0 0% 18%` | Bordas de campos |
| `--muted` | `24 6% 95%` | `218 34% 15%` | `0 0% 7%` | Skeletons, backgrounds suaves |
| `--foreground` | `24 10% 10%` `#1C1917` | `210 40% 98%` `#F8FAFC` | `0 0% 98%` | Texto principal |
| `--muted-foreground` | `25 5% 32%` `#57534E` | `215 20% 65%` `#94A3B8` | `0 0% 50%` | Texto secundário, rótulos |
| `--overlay` | `0 0% 0% / 40%` | `0 0% 0% / 60%` | `0 0% 0% / 70%` | Escurecimento de modais/palette (glass §8) |
| `--scrollbar-thumb` / `--scrollbar-track` | `24 6% 78%` / `60 9% 95%` | `215 24% 35%` / `222 47% 13%` | `0 0% 24%` / `0 0% 4%` | Scrollbars via tokens (§13) |

### 2.2 Marca — primárias e accent

| Token | Light | Dark | OLED | Uso |
|---|---|---|---|---|
| `--primary` | `160 84% 39%` `#10B981` | `160 84% 52%` `#34D399` | igual dark | Acentos, ícones, estados ativos, gráficos, fills `primary/10` |
| `--primary-strong` | `158 64% 29%` `#047857` | `160 84% 52%` | igual dark | **Botões sólidos e links de texto** (contraste AA) |
| `--primary-foreground` | `0 0% 100%` | `160 84% 9%` `#022C22` | igual dark | Texto sobre `primary-strong` |
| `--secondary` | `175 84% 32%` `#0D9488` | `172 66% 50%` `#2DD4BF` | igual dark | Elementos secundários (chips, realce) |
| `--accent` / `--portfolio` | `199 89% 48%` `#0EA5E9` | `199 89% 60%` `#38BDF8` | igual dark | **Investimentos / rebalanceamento**, foco de KPIs |
| `--ring` | `160 84% 39%` | `160 84% 52%` | igual dark | Anel de foco (`:focus-visible`) |

> **Regra de contraste (AA):** em Light, texto pequeno **não** usa `--primary` (2.5:1) — usa `--primary-strong` (6:1). `--primary` fica para elementos gráficos grandes e estados. Em Dark, `--primary` já é claro e o foreground escuro garante 8:1.

### 2.3 Semânticas financeiras

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--positive` / `--positive-strong` | `#10B981` / `#047857` | `#34D399` | **Receitas, rendas, saldo positivo, poupança** |
| `--negative` / `--negative-strong` | `#F43F5E` / `#BE123C` | `#FB7185` | **Despesas, saídas, saldo negativo** |
| `--warning` / `--warning-strong` | `#F59E0B` / `#B45309` | `#FBBF24` | Atenção (≥85% do limite), alertas leves |
| `--critical` / `--critical-strong` | `#EF4444` / `#B91C1C` | `#F87171` | Orçamento excedido, atraso, erro destrutivo |
| `--portfolio` | `#0EA5E9` | `#38BDF8` | Rebalanceamento, gap de meta, aportes |

**Regras de uso:**
- **Texto pequeno** → variante `-strong` (Light). **Gráficos, ícones, badges, fills** → variante base.
- Verde/vermelho **nunca** são usados para aprovação/erro genérico de formulário — isso é papel de `--primary`/`--critical`; as semânticas financeiras são exclusivas de dinheiro.
- Badge de status de dívida: `overdue` → critical · `due_today` → warning · `due_soon` → warning claro · `paid` → positive · `pending` → muted.

### 2.4 Categorias — paleta restrita e sóbria (10 cores)

| Token | Light | Dark/OLED | Token | Light | Dark/OLED |
|---|---|---|---|---|---|
| `--cat-1` aço | `215 20% 48%` | `215 20% 58%` | `--cat-6` malva | `320 18% 48%` | `320 18% 58%` |
| `--cat-2` sálvia | `150 25% 44%` | `150 25% 54%` | `--cat-7` jeans | `215 42% 48%` | `215 42% 58%` |
| `--cat-3` oliva | `85 22% 44%` | `85 22% 54%` | `--cat-8` ameixa | `265 22% 50%` | `265 22% 60%` |
| `--cat-4` areia | `35 28% 48%` | `35 28% 58%` | `--cat-9` pinho | `190 30% 44%` | `190 30% 54%` |
| `--cat-5` terracota | `15 32% 50%` | `15 32% 60%` | `--cat-10` grafite | `0 0% 40%` | `0 0% 55%` |

**Regras:** cores dessaturadas (saturação ≤ 42%) para não competir com os dados; cada categoria recebe uma cor da escala (associação por nome na sugestão inteligente); em gráficos de pizza, usar a mesma cor do ícone/badge da categoria.

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

**OLED refinado (F5.2):** sobre o true black `#000`, bordas são a principal pista de elevação — `--border` 14% e `--input` 18% garantem definição sem acender pixels; hover/pressed mais perceptíveis (`9%`/`13%`); `--muted-foreground` 50% assegura AA (5.3:1) para texto secundário; `--overlay` 70% escurece o conteúdo atrás de modais sem perder o preto puro; scrollbar com polegar `24%` discreto.

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

---

## 8. TRANSPARÊNCIA / GLASSMORPHISM

- **Uso permitido (sutil):** header sticky com `backdrop-blur` (8–12px) + fundo `surface/80` (light) ou `surface/70` (dark); command palette ⌘K; modais sobre conteúdo.
- **Proibido:** glass em cards de dados (prejudica legibilidade), múltiplas camadas de blur empilhadas.
- Transparências de cor sempre via token: `bg-primary/10`, `bg-negative/10` etc.

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
| `<input type="date">` | `DatePicker` (pt-BR, com tokens) |
| `<input type="file">` | `Dropzone` (upload via `services/storage` — R2) |
| `<input type="range">` | `Slider` |
| `alert()` / `confirm()` / `prompt()` | `ConfirmDialog` / `Modal` + `Toast` |
| `<dialog>` | `Modal` (componente do app) |
| `<details>/<summary>` | `Accordion` |
| Scrollbars padrão | Estilizadas via tokens (scrollbar-width/color) |

**Exceção permitida:** inputs de texto base (`<input type="text">`, textarea) — desde que **sempre encapsulados** em primitivos do app (`Input`, `MoneyInput`, `Textarea`), nunca usados crus em telas.

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
