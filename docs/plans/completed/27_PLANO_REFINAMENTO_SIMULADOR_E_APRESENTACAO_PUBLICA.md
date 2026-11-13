# 27 — Refinamento do Simulador de Carteira/Aportes e da Apresentação Pública

> **Status:** ✅ concluído e arquivado (v3.5.0) — ver §11
> **Classificação (AGENTS.md §10.5):** 🔵 Fluxo Completo (Feature/Plano)
> **Versão alvo:** 3.5.0 (MINOR) com bump 3.4.0 → 3.5.0 no fechamento
> **Quality gate previsto:** `npm run verify:full`
> **Escopo:** `src/features/landing/**` (seção `#simulador`, narrativas, showcase compartilhado, hero, pricing) + `src/domain/portfolio/**` (extração de motor puro)

---

## 1. Contexto e arquivos analisados

| Arquivo | Papel |
|---|---|
| `src/features/landing/components/minimal-wealth-simulator.tsx` | Card do simulador (3 controles + donut/curva + direcionamento + CTA) |
| `src/features/landing/components/fire-projection-curve.tsx` | Curva patrimonial interativa + 3 cards métricos |
| `src/domain/portfolio/simulation.ts` | Motor do rebalanceamento ilustrativo (classes) |
| `src/domain/portfolio/simulation-presets.ts` | Presets Dividendos / Global / Crescimento |
| `src/domain/portfolio/compound-interest.ts` | Motor de projeção FIRE já existente (centavos, testado) |
| `src/features/landing/components/product-narratives.tsx` | Eixos 1–4 + bloco de captura semântica |
| `src/features/landing/components/shared-finances-showcase.tsx` | Racha / Metas / Família / Viagem com Pix |
| `src/features/landing/components/hero-editorial.tsx`, `platform-comparison.tsx`, `tools-showcase.tsx`, `pricing-section.tsx`, `faq-section.tsx` | Restante da jornada pública |
| `src/services/excel-export.ts` | Exportação usada na promessa de "Dossiê Excel" |
| `src/components/ui/tabs.tsx`, `money-text.tsx`, `qr-code-canvas.tsx` | Primitivos que deveriam estar em uso |

Interpretação adotada do pedido: "eixos com compartilhamento e Pix" = **Eixo 4 — Finanças Compartilhadas & Pix** (`#financas-compartilhadas`), que hoje é o bloco mais "clicável" da página e serve de referência de tom para os demais.

---

## 2. Diagnóstico do card do simulador (`minimal-wealth-simulator.tsx`)

### 2.1 Responsividade e truncamento (P0)

| # | Achado | Evidência |
|---|---|---|
| R1 | Os 3 cards métricos usam `grid-cols-1 sm:grid-cols-3` **dentro** de uma coluna que só tem largura total em `lg`. Entre 640px e 1023px cada card fica com ~90px úteis e o valor estoura. | `fire-projection-curve.tsx` → grid dos 3 cards, `grid-cols-1 sm:grid-cols-3` |
| R2 | `MoneyText` renderiza **sempre** `whitespace-nowrap`. Sem largura mínima garantida, `R$ 2.898.185` e `R$ 9.661/m` são cortados pelo `overflow` do pai (print 3). | `money-text.tsx` (classe fixa `whitespace-nowrap`) + uso com `hideCents` em coluna estreita |
| R3 | O pill flutuante do gráfico fica em `left: clamp(20%, 80%)` e o contêiner tem `overflow-hidden`: no último ano o pill (valor + selo FIRE) é decepado na borda direita. | print 3: "R$ 2.898.185" + selo cortado |
| R4 | Três rótulos de eixo são desenhados na mesma linha de base (`Ano 0 (Hoje)`, `12 anos (Liberdade Financeira)`, `25 anos`). Em 500 wide o rótulo do meio colide/encosta nos demais. | print 3 |
| R5 | Cabeçalho do painel: título + tabs + badge em uma linha (`flex-col sm:flex-row`). Em ~540px o badge `Rentabilidade: 8% a.a.` encosta na borda e o `Pós-Aporte` comprime contra o título. | prints 2 e 3 |
| R6 | Card externo com `p-4 sm:p-8 lg:p-12` + `space-y-6 sm:space-y-8` + 3 controles + 2 colunas + rodapé: no mobile vira ~3.5 telas de rolagem para um simulador. | classe do `Card` |

**Correção proposta:** trocar o grid por `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` com `min-w-0` e escala `text-[15px] sm:text-base`, adotar container query (`@container`) para o painel gráfico, ancorar o pill em `max(12%, min(88%))` com `clamp` real e reposicionar os rótulos de eixo em duas faixas (marcos abaixo, escala em cima).

### 2.2 Densidade e duplicação (o "card bagunçado")

A mesma informação aparece **até três vezes** na mesma dobra:

- Patrimônio: `Patrimônio Atual: R$ 25.000` → botões `R$ 25k/100k/300k` → legenda `Posição atual acumulada`.
- Aporte: `Aporte Mensal: R$ 3.000` → botões → e novamente no título `Direcionamento Calculado para R$ 3.000:`.
- Alocação por classe: legenda do donut (`Meta: 40% · Atual: 32%`) **e** lista do direcionamento (`Atual: 28,0% · Meta: 40,0%`) **e** barra de progresso da legenda.
- Estratégia: `Perfil de Alocação: Dividendos` → badge `Geração de Renda` → eixos repetidos no donut.

**Correção proposta:** uma única fonte de leitura por conceito. Os controles ficam com label + valor (sem legenda redundante); o donut passa a ser **instrumento de exploração** (clique filtra a lista) e não uma segunda tabela; a coluna direita deixa de repetir percentuais já visíveis no donut, exibindo apenas **ação, valor e justificativa curta**.

### 2.3 Controles e botões desnecessários

Dentro de um único painel coexistem 4 mecanismos de navegação temporal:

1. duas setas `◀ ▶` (`setYearExplicit(year ± 1)`),
2. atalhos `Hoje (0a)` / `Meta (12a)` / `25a`,
3. scrub por arrasto no gráfico,
4. teclado (`ArrowLeft/Right/Home/End`).

Some-se a isso as tabs `Aporte | Curva Patrimonial`, o badge de rentabilidade e o CTA final. **Recomendação:** manter scrub + teclado + 2 marcos (`Hoje`, `Liberdade Financeira`) e remover as setas; mover `25a` para o próprio eixo. O CTA "Organizar Meus Investimentos" continua sendo o único botão primário do card.

### 2.4 Defeitos específicos da curva patrimonial

| # | Achado | Impacto |
|---|---|---|
| C1 | O cálculo é refeito **dentro do componente** (loop de 12 meses/mês), em floats, ignorando `src/domain/portfolio/compound-interest.ts`. Viola AGENTS §3 ("nunca cálculo de negócio em componente") e cria um segundo motor de projeção concorrente. | divergência matemática + manutenção dupla |
| C2 | A renda passiva usa a **regra dos 4%** (`balance * 0.04 / 12`), enquanto o motor de domínio usa `balance * taxa mensal` e o painel de aporte usa o **dividend yield por classe**. Resultado: três números diferentes para o mesmo patrimônio (§3.1). | contradição visível ao trocar de aba |
| C3 | `monthlyExpenses={Math.max(2500, Math.round((patrimonyBase * 0.04) / 12))}` — a expressão nunca supera 2500 para os presets atuais (25k→83, 100k→333, 300k→1.000): o `Math.max` é código morto e a meta FIRE fica **fixa em R$ 750.000** mesmo trocando o patrimônio. | a "meta personalizada" é fixa |
| C4 | Rentabilidade de 8% a.a. é **hardcoded** no badge e na prop, sem controle, sem fonte e sem explicabilidade (§33). | promessa sem lastro |
| C5 | Projeção de 25 anos em valores **nominais**, sem inflação nem idade do usuário; o rótulo "12 anos (Liberdade Financeira)" sugere um marco pessoal que não foi calculado a partir do custo de vida real. | expectativa irreal |
| C6 | `role="slider"` aplicado ao contêiner que **contém botões focáveis** (`◀ ▶`, marcos): widget composto inválido em ARIA. | a11y |
| C7 | O tooltip é `pointer-events-none` e desacoplado do ponto ativo (posição por percentual, não por coordenada). | leitura imprecisa |
| C8 | Sem alternativa não-visual do gráfico (a série não é exposta em texto/tabela) e sem `prefers-reduced-motion` no `NumberTicker`. | a11y |

### 2.5 Composição da carteira (donut)

| # | Achado |
|---|---|
| D1 | **Rótulo errado:** a legenda mostra `Meta: 40% · Atual: 32%`, mas 32% é o percentual **pós-aporte** (`finalPct`). O "Atual" real (28%) aparece na coluna da direita. Duas verdades sobre o mesmo número. |
| D2 | `subtitle` usa interpolação crua (`${...}%`), gerando `40% / 32%` (sem decimal) ao lado de `40,0% / 28,0%` na lista — formatação inconsistente (§28). |
| D3 | O centro mostra `TOTAL R$ 28.000 · 4 itens`: "itens" são **classes de ativo**, não itens; e o total é pós-aporte, sem qualificar. |
| D4 | Nome da aba "Aporte" para um gráfico de composição é ambíguo (parece o valor do aporte). |
| D5 | `AllocationDonut` já aceita `selectedKey`/`onSelectKey`/`onSliceClick`, mas nada é passado: a interatividade existe no primitivo e está desligada na landing. |
| D6 | Nenhum dos 4 círculos/legendas indica **o que fazer** com a classe sobre-alocada (Renda Fixa 37% vs meta 20%). |

### 2.6 Badges e micro-tipografia

- `Badge variant="positive"` usado para `Pós-Aporte` e para `Rentabilidade: 8% a.a.` — nenhum dos dois é "sucesso"; são estado e informação. Semântica de cor vira ruído.
- `font-mono` aplicado a badges de status (não monetários) — herança indevida da tipografia de números.
- Micro-tipografia fora da escala: `text-[9px]`, `text-[10px]` em 5 pontos do card (contraste e legibilidade abaixo do mínimo no mobile).
- `text-white` literal no marco `Meta (12a)`, fora dos tokens (DESIGN_SYSTEM §13).
- Ícone `TrendingUp` dentro de `p-2 rounded-lg bg-primary/20` (Nível 2 — *prominent badge*) aplicado a um card **comum** do simulador: viola §4.13 (ícones de nível 1 devem ser icon-only sem container).

---

## 3. Incongruências matemáticas e de negócio (P0)

### 3.1 Três "rendas passivas" para o mesmo dinheiro

Para patrimônio de R$ 25.000 + aporte de R$ 3.000 (preset Dividendos), na mesma tela:

| Origem | Fórmula | Valor |
|---|---|---|
| Aba "Aporte" (card destacado) | yield ponderado por classe sobre R$ 28.000 | **R$ 181/mês** |
| Aba "Curva Patrimonial" (ano 0) | regra dos 4% sobre R$ 25.000 | **R$ 83/mês** |
| Motor de domínio `compound-interest.ts` (ano 0) | `patrimônio × taxa mensal (8% a.a.)` | **R$ 161/mês** |

O usuário alterna entre as abas e o mesmo indicador cai mais da metade. **Correção:** uma única definição de renda passiva no card ("yield médio da carteira pós-aporte" = 7,77% → R$ 180/mês sobre R$ 28.000), exposta com gatilho de explicabilidade (§33) listando o yield de cada classe.

### 3.2 "Alocação balanceada" para uma classe 17 p.p. acima da meta

`Renda Fixa CDI — Alocação balanceada (37,0% / Meta: 20,0%) — Aguardar` (print 1).
Não está balanceada: está **sobre-alocada** e o motor de novos aportes não consegue corrigi-la sem venda. Rótulos corretos: `Na meta`, `Abaixo da meta (recebendo aporte)`, `Acima da meta (aguardando ajuste)`. "Aguardar" deve virar "Nenhum aporte — já acima da meta".

### 3.3 Meta FIRE fixa e despesas derivadas do patrimônio

Ver C3. Além disso, a meta de R$ 750.000 pressupõe R$ 2.500/mês de custo de vida — número que o usuário **nunca informou** e que não aparece em lugar nenhum da interface. Em um app cujo diferencial é o Caixa Real Seguro, essa meta deveria vir do custo de vida (ou de um controle explícito de "custo de vida desejado").

### 3.4 Projeção sem inflação e sem horizonte pessoal

R$ 2.898.185 em 25 anos sem inflação equivale a ~R$ 1,0 milhão em poder de compra a 4% a.a. de inflação. O copy atual ("Patrimônio Estimado") não sinaliza nominal vs. real. Sugestão: toggle `Nominal | Real (IPCA 4%)` — pequeno, honesto e altamente interativo.

### 3.5 Promessas da apresentação que não se sustentam no código

| Copy publicado | Realidade no código |
|---|---|
| "Dossiê Executivo completo em **Excel (.xlsx estruturado com 5 abas e fórmulas)** em 1 clique" (`product-narratives.tsx`, e "5 abas com fórmulas" no checklist) | `src/services/excel-export.ts` gera **XML Spreadsheet 2003** e baixa como `.xls` (`application/vnd.ms-excel`), com **5 abas fixas + 2 condicionais** e **nenhuma** `ss:Formula`. |
| "99% Confiança · OCR Local" | Métrica fabricada; o OCR local (Tesseract.js) existe, mas não há score de confiança de 99% exposto. |
| "extrai favorecido, valor e data em **menos de 2 segundos**" | Sem medição; o próprio módulo define `OCR_TIMEOUT_MS = 12000`. |
| "Excel (.xlsx)" no card de relatórios | Mesmo desalinhamento do serviço (`excel-export.ts` diz `.xml/.xls`). |
| "Zero DARF" (três ocorrências) | Verdadeiro apenas para o cenário "rebalanceamento sem venda"; soa como garantia fiscal. Recomendado: "sem girar patrimônio (e sem gerar DARF pela venda)". |

---

## 4. Conformidade com AGENTS.md / DESIGN_SYSTEM

| Regra | Violação encontrada | Correção |
|---|---|---|
| §3 (cálculo só em `domain/`) | projeção FIRE calculada no componente (C1) | extrair `projectPatrimony` para `domain/portfolio` e cobrir com Vitest |
| §4.1 / §4.9 (DRY de UI, Tabs do DS) | duas tablists artesanais (`minimal-wealth-simulator`, `shared-finances-showcase`) enquanto `components/ui/tabs.tsx` existe | migrar para `Tabs` (`variant="pills"`, `fullWidth` só com ≤3 itens) |
| §4.11 / §24 (valores sem truncação) | R1, R2 | grid + escala adaptativa + `min-w-0` |
| §4.13 (hierarquia de ícones) | `TrendingUp` com container em card comum; `ShieldCheck`/`CheckCircle2` em linhas | icon-only `size-4` neutro; container só em banner/alerta |
| §4.14 (badges estritos) | badges positivos sem semântica de sucesso, `text-[9px]/[10px]` ad hoc | variantes corretas + `size="xs"` |
| §4.16 (superfície canônica) | `border-border/60` em painel interno do simulador | padronizar `border-border/80` |
| §4.19 (carrossel/alturas) | caixa de renda passiva foge do padrão de CTA do carrossel (não se aplica diretamente, mas é o mesmo footprint) | — |
| §4.23 (título + badge) | cabeçalho do painel com título, tabs e badge na mesma linha (R5) | `flex-col` até `sm`, badge em linha própria |
| §4.28 (pt-BR canônico) | D2 (percentual sem decimal) | `formatPercent` em todo percentual |
| §4.32 (optimistic + undo) | nenhuma ação reversível no bloco de captura (o botão "Aprovar Despesa" é um `<div>` estático) | botão real + toast com "Desfazer" |
| §4.33 (explicabilidade de KPI composto) | renda passiva e "8% a.a." sem memória de cálculo | `EquationBreakdownPopover` |
| §9.3 (loading/vazio/erro) | simulador é determinístico (não se aplica), mas não há fallback de `IntersectionObserver`/`reduced motion` | respeitar `prefers-reduced-motion` |
| §3 (tipos) | `slices` com `subtitle` string interpolada manualmente | usar utilitários |

---

## 5. Interatividade proposta (priorizada por impacto)

### P0 — "Aprovar despesa" de mentira (bloco de captura semântica)

Em `product-narratives.tsx` o CTA "Aprovar Despesa (1 Toque)" é um `<div>` com classes de botão: não recebe foco, não responde a clique e não confirma nada. É o ponto exato citado pelo usuário.

**Proposta:** `Button` real → estado `approved` → `Badge positive` "Despesa aprovada" + linha do tempo "Lançada em Alimentação · Pix" + `pushToast({ title: "Despesa aprovada", action: { label: "Desfazer" } })` (AGENTS §32). Segundo toque volta ao estado inicial. Nada é persistido — é demo.

### P0 — Pix do showcase: payload e chave divergentes

`shared-finances-showcase.tsx` exibe a chave `financeiro.demo@exemplo.com` mas copia um payload Pix que contém `demo@exemplo.com`. Além disso, "Copiar Chave Pix" copia uma **chave**, enquanto o rótulo promete Pix Copia e Cola.

**Proposta:** um único `PIX_DEMO` (payload EMV + chave consistentes), `QRCodeCanvas` (primitivo já existente) ao lado do copia-e-cola, `pushToast` de confirmação em todas as 4 abas e estado "copiado" com `aria-live`.

### P1 — Donut e curva exploráveis

- Donut: `selectedKey` + `onSelectKey` → ao clicar na fatia, destacar a linha correspondente no direcionamento, esmaecer as demais e mostrar "faltam R$ X para a meta" (inclusive para classe acima da meta).
- Curva: hover/tap já funciona; adicionar (a) comparativo fantasma "sem aportes" na mesma escala, (b) marcadores de "juros > aporte" reaproveitando `interestExceedsContributionAt` do motor de domínio, (c) toggle `Nominal | Real`.

### P1 — Handoff da simulação para a conta

Existe `usePendingSimulation` + `domain/share/simulation-transport` (usado nas ferramentas públicas `/ferramentas/*`): a simulação é salva e **transferida automaticamente no primeiro login**. A landing não usa esse mecanismo — o CTA só leva ao trial.

**Proposta:** `Salvar simulação` / CTA que grava o cenário e, pós-signup, abre o Investments já com o aporte direcionado. É o maior ganho de conversão da página com código já disponível.

### P2 — Estado compartilhável e navegação

- Persistir `estratégia + patrimônio + aporte` na URL (`stateful-url` já existe) → simulação compartilhável via WhatsApp.
- Pills do hero: hoje `Racha com Pix` e `Modo Família` rolam para o **mesmo** âncora e o showcase sempre abre na aba `split`. Fazer a pill pré-selecionar a aba (ex.: `#financas-compartilhadas?tab=family`).
- `Nudge` dos controles: mostrar quanto cada preset muda o resultado ("+R$ 1.500/mês = +R$ 412 de renda passiva") no lugar da legenda estática.

---

## 6. Apresentação pública — inventário, ênfase e badges

### 6.1 Funcionalidades do app ausentes ou sub-representadas

| Módulo (`nav-items.tsx`) | Presença na landing |
|---|---|
| Início / Caixa Real | ✅ Eixo 1 |
| Transações | ✅ Captura semântica |
| Cartões | ✅ Eixo 2 |
| Contas & Dívidas (incl. **empréstimos**) | ⚠️ só "dívidas" genérico; empréstimos/refinanciamento nunca aparecem |
| Investimentos | ✅ Eixo 3 |
| Orçamentos | ⚠️ aparece só no mockup do hero e no "Modo Família" — nunca como módulo próprio (termômetro por categoria) |
| **Metas** (`src/features/goals`) | ❌ só existe como "Vaquinha" dentro das finanças compartilhadas; metas individuais com aporte mensal não são apresentadas |
| **Relatórios** | ❌ reduzido a "Dossiê Excel"; relatórios executivos, fechamento de mês e divisão patrimonial não aparecem |
| **Insights** | ❌ ausente (o app tem advisor/insights — diferencial de retenção) |
| **Lembretes / Radar de vencimentos** | ⚠️ citado no pricing, nunca demonstrado |
| Modo Viagem | ✅ Eixo 4 |
| Modo Família | ✅ Eixo 4 |
| **Modo Demonstração / Tour guiado** | ❌ ausente — é o principal removedor de fricção para primeiro contato e nem é mencionado |
| PWA / Android Pro | ✅ Plataformas |
| Simuladores públicos | ✅ Ferramentas |

### 6.2 Itens a **retirar** ou rebaixar (excesso de escopo percebido)

- "99% Confiança", "em menos de 2 segundos", "Dossiê com 5 abas e fórmulas": promessas não verificáveis (§3.5).
- "Mágica Semântica": tom não profissional; substituir por "Aprendizado de Comerciantes".
- "Máquina/Engine", "Safe-to-Spend", "Daily Budget", "FIRE", "Privacy Shield": 5 anglicismos/neologismos em uma única página. Manter no máximo **um** (Safe-to-Spend, por ser o conceito-âncora) e traduzir os demais.
- "Nunca mais seja pego de surpresa" / "Zero …" absolutos repetidos (5 ocorrências de "zero").
- Repetição literal do bullet de importação de faturas (PDF/OFX/CSV) duas vezes no Eixo 2 (parágrafo + bullet).
- Lista de 13 linhas na comparação de plataformas: reduzir a 6 e agrupar o resto em "e mais".

### 6.3 Hierarquia de ênfase (o que o olho vê primeiro)

Problemas atuais:
1. O headline promete "**Quatro** eixos coordenados", mas a seção renderiza **cinco** blocos (o 5º, "Captura Invisível", não tem número de eixo). Quebra de contrato narrativo.
2. Tudo tem pill/uppercase/badge: hero (2 pills + 1 badge + 3 selos), 4 eixos com pill cada, 3 selos de plataforma, 3 badges de ferramenta, 1 badge "Mais Escolhido", 1 "Oficial Recomendado", 1 "Sem Cartão". Sem gradiente de ênfase, nada se destaca.
3. "30 dias grátis" aparece **9 vezes na UI** (header, hero ×2, pricing ×4, FAQ, CTA banner — 12 ocorrências no código incluindo metadados) — repetição que dilui a mensagem.
4. Sinais de recomendação contraditórios: PWA é "Oficial Recomendado", mas a tabela dá capacidades extras ao Android Pro e o hero empurra o trial.

**Proposta de hierarquia em 3 níveis explícitos:** (1) *Diferencial* — Caixa Real Seguro; (2) *Provas* — captura sem fricção, cartões/faturas, aportes; (3) *Apoio* — compartilhado, relatórios, plataformas. Cada nível com um único tratamento visual; badges apenas para estado real, nunca para adjetivo.

### 6.4 Linguagem — guia de tom

| Hoje | Proposta |
|---|---|
| "Cálculo de Aporte em Tempo Real" + "Direcionamento Calculado para R$ 3.000:" | "Seu próximo aporte de R$ 3.000" (uma linha) |
| "Motor de Rebalanceamento Determinístico" | "Rebalanceamento sem vender ativos" |
| "Comprando na defasagem" | "Abaixo da meta — recebe aporte" |
| "Alocação balanceada (37,0% / Meta: 20,0%)" | "Acima da meta — sem aporte" |
| "Aguardar" | "Já acima da meta" |
| "Quantos itens" | "4 classes de ativo" |
| "Engine/Geração de Renda/Multiplicação de Capital" | descrições funcionais curtas |

Regra editorial: no máximo 2 linhas por bloco de apoio, zero advérbios de intensidade ("absoluto", "irrestrito", "completo", "exato") fora de claims verificáveis.

---

## 7. Plano de execução

### Fase 1 — Correções P0 (integridade e responsividade)

1. Extrair `projectPatrimony` (nominal/real, renda passiva única) para `src/domain/portfolio/projection.ts` + `projection.test.ts`; `FireProjectionCurve` passa a consumir o motor (remove C1/C2).
2. Unificar renda passiva do card (yield ponderado da carteira pós-aporte) e remover a regra dos 4% do painel FIRE, mantendo-a apenas dentro do motor de domínio quando explicitada.
3. Corrigir rótulos: `Atual` → `Pós-aporte` no donut; badges de estado por classe (`Na meta` / `Abaixo` / `Acima`); remover "itens".
4. Grid dos 3 cards métricos + escala tipográfica + `min-w-0` (R1/R2); pill do gráfico dentro da viewport (R3); rótulos de eixo em 2 faixas (R4).
5. Remover setas `◀ ▶`; manter scrub, teclado e 2 marcos.
6. Badges: variante correta + `size="xs"` + remover `text-[9px]/[10px]` e `text-white`.
7. "Aprovar Despesa" vira `Button` com confirmação + undo (P0 §5).
8. Alinhar copy do Excel à realidade (`.xls` XML Spreadsheet, sem "fórmulas") **ou** implementar `.xlsx` com fórmulas — decidir com o fundador; enquanto isso, corrigir o texto.

**DoD:** `npm run verify` verde; prints desktop/mobile de 375, 768 e 1280; nenhum `text-[9px]` no card; teste do motor de projeção cobrindo 0%, 8% e 12% a.a.

### Fase 2 — P1 (interatividade e clareza)

9. Migrar as duas tablists artesanais para `components/ui/tabs.tsx`.
10. Donut clicável → filtra/destaca o direcionamento (`selectedKey`).
11. Curva: comparativo "sem aportes", toggle `Nominal | Real`, marcador "juros ≥ aporte".
12. `EquationBreakdownPopover` na renda passiva e na rentabilidade (AGENTS §33).
13. Pix real no showcase (payload único + QR + toast) e handoff `usePendingSimulation` no CTA do simulador.
14. Retomar densidade: remover as três legendas redundantes dos controles; encurtar o rodapé legal para 1 linha + link.

**DoD:** `npm run verify:full`; teste de interação do donut e do botão de aprovação (`@testing-library`); screenshot comparativo antes/depois.

### Fase 3 — P2 (narrativa e cobertura de produto)

15. Reequilibrar eixos: 5 eixos nomeados (ou rebaixar o bloco de captura a sub-bloco do Eixo 1).
16. Adicionar prova de Metas, Relatórios e Insights (uma linha + mockup reaproveitado do padrão existente).
17. Apresentar o Modo Demonstração na hero ("ver com dados de exemplo") com `DemoTrackSelectModal`.
18. Reduzir a tabela de plataformas de 13 → 6 linhas; consolidar "30 dias grátis" em 3 menções.
19. Substituir claims não verificáveis e revisar o glossário de anglicismos.
20. Bump `3.4.0 → 3.5.0`, atualizar `ROADMAP.md`, arquivar este plano em `docs/plans/completed/`.

---

## 8. Não-escopo

- Persistência local de dados de negócio (Online First).
- Novo motor de rebalanceamento por ativo (§6 — apenas classes no simulador ilustrativo).
- Recomendação de investimento (Resoluções CVM 19/20) — o disclaimer atual permanece e deve ficar visível, porém em uma linha.
- Reescrever a seção de preços ou a lógica de trial.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Mudar a curva para o motor de domínio altera números publicados | Snapshot de teste com os presets atuais; comparar antes/depois e registrar no relatório de entrega |
| Unificar renda passiva pode reduzir o número "vendável" (181 → 180) | Nenhuma perda material; ganha-se consistência entre abas |
| Alterar copy de Excel pode exigir revisão de pricing | Tratar como item isolado na Fase 1 |
| `usePendingSimulation` acoplado ao fluxo de auth | Implementar atrás de flag e testar o caminho sem sessão |

## 10. Checklist de verificação final

- [x] `npm run verify` (typecheck + lint + vitest domínio) verde
- [x] `npm run verify:full` (Playwright smoke) verde
- [x] Simulador em 375px, 768px e 1280px sem overflow horizontal
- [x] Nenhum valor monetário truncado (375px, fontes 200%)
- [x] Navegação por teclado completa no gráfico e no donut
- [x] Uma única definição de renda passiva em todo o card
- [x] Zero claims não verificáveis na landing
- [x] `docs/roadmap/ROADMAP.md` e este plano atualizados/arquivados

---

## 11. Resultado da execução (v3.5.0)

### Fase 1 — entregue
- `src/domain/portfolio/projection.ts` (+ `projection.test.ts`, 10 casos) como motor puro da projeção patrimonial, exportado pelo barrel do domínio; `FireProjectionCurve` consome o motor (nenhum cálculo no componente).
- `resolveAllocationStatus` (+ testes) classifica cada classe em `on_target` / `below_target` / `above_target` (tolerância de 1 p.p.), usado no direcionamento.
- Renda passiva unificada no yield médio ponderado da carteira pós-aporte (7,8% a.a. no preset Dividendos) nas duas abas; a regra dos 4% permanece só em `calculateCriticalCapital` (domínio).
- Curva reescrita: eixo em duas faixas ("Hoje" / "25 anos"), pill clampada por medição (`ResizeObserver`), marcos "Hoje" e "Independência (12a)", cards `grid-cols-1 sm:grid-cols-3` com `p-3`, sem `text-[9px]`/`text-white`, ARIA de slider sem controles focáveis internos.
- Rótulos por classe: "Hoje X% · meta Y% — abaixo da meta" e "Acima da meta / Na meta · Sem aporte" (fim de "Aguardar" e "Comprando na defasagem").
- "Aprovar Despesa" virou `Button` real com confirmação e `pushToast({ action: Desfazer })` (AGENTS §32).

### Fase 2 — entregue
- As duas tablists artesanais migraram para `components/ui/tabs.tsx` (novo campo opcional `ariaLabel` no `TabItem` para nomes acessíveis descritivos).
- Donut clicável (`selectedKey`/`onSelectKey`): a classe escolhida destaca o card correspondente do direcionamento.
- Curva: série comparativa "Sem aportes" (tracejada), toggle "Valores reais" (inflação de 4% a.a.) e linha de ponto de inflexão ("juros ≥ aporte").
- Explicabilidade (§33): popover com o cálculo da renda passiva (rendimento por classe ÷ 12) e popover do badge de rentabilidade (8% a.a. ↔ 0,64% a.m.).
- Pix do showcase com payload único gerado por `generatePixBrCode` (`src/domain/pix`), QR renderizado por `QrCodeCanvas` e toast ao copiar/cobrar.
- Handoff pós-signup: o CTA do simulador grava `PendingRebalanceSimulation` via `storePendingSimulation` antes de navegar.
- Densidade: removidas as legendas redundantes dos controles, o parágrafo legal do rodapé virou uma linha e o direcionamento tem um único título ("Seu próximo aporte de R$ 3.000").

### Fase 3 — entregue
- 5º eixo nomeado ("Eixo 5 · Captura Invisível & OCR Local") e headline ajustada para "Cinco eixos".
- Prova de Metas, Relatórios e Insights em três cards curtos ao fim das narrativas.
- Tabela de plataformas de 13 → 6 linhas, com "E mais: …" resumindo o restante.
- "30 dias grátis" consolidado: hero (CTA), pricing (card de teste) e FAQ.
- Claims corrigidos: Dossiê em XML Spreadsheet (5 abas, sem promessa de fórmulas), remoção de "99% Confiança", "menos de 2 segundos", "em 3 segundos"; "Mágica Semântica" → "Aprendizado de Comerciantes"; anglicismos reduzidos a Safe-to-Spend (Daily Budget → Ritmo Diário, FIRE → Independência, Privacy Shield → Escudo de Privacidade).

### Pendência consciente
- **Item 17 (Modo Demonstração na hero) não executado:** `DemoTrackSelectModal` depende de `@/state/demo-mode` e do App Shell para rodar a trilha; montá-lo na landing quebraria o isolamento de bundle público (v3.3.0) e ofereceria um tour que não executa. Fica registrado como próximo passo: rota pública dedicada (`/demonstracao`) carregando o shell em modo demo sob demanda.
