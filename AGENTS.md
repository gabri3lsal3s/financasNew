# AGENTS.md — Regras de Governança da Workspace

> Estas regras vinculam **qualquer agente de IA** (e humanos) trabalhando neste repositório.
> **Leia este arquivo e os documentos de referência ANTES de escrever código.**

---

## 1. SOBRE O PROJETO

Aplicativo **web 100% Online First** de **gestão financeira pessoal** (receitas, despesas, cartões, dívidas, orçamentos, relatórios, insights e projeção) + **motor simplificado de rebalanceamento de carteira** (metas e valor de aporte).

- **Stack:** React 18+ (Vite) · TypeScript estrito · Tailwind CSS · shadcn/ui · TanStack Query · Supabase (Postgres + RLS + Auth).
- **Idioma do produto e dos docs:** pt-BR.

## 2. DOCUMENTOS OBRIGATÓRIOS

| Arquivo | Papel |
|---|---|
| `docs/architecture/ESPECIFICACAO_TECNICA.md` | **Spec executável**: regras de negócio, schema, UI/UX, decisões D1–D12 |
| `docs/architecture/RECONSTRUCAO.md` | Spec funcional original (fonte histórica) |
| `docs/architecture/ARCHITECTURE.md` | Camadas, dependências, convenções, estratégia de estado |
| `docs/architecture/PROJECT_STRUCTURE.md` | **Árvore de pastas e onde criar cada arquivo** |
| `docs/architecture/FINANCIAL_MATH_SPEC.md` | Especificação canônica de engenharia e precisão matemática financeira |
| `docs/design/DESIGN_SYSTEM.md` | Identidade visual e design tokens (`src/styles/tokens.css`) |
| `docs/roadmap/ROADMAP.md` | **Plano de execução canônico** — fases, ordem e Definition of Done |
| `docs/operations/FOUNDER_RUNBOOK.md` | Manual de operação do fundador: suporte Telegram, admin, faturamento e incidentes |
| `docs/operations/SECURITY_GOVERNANCE.md` | Governança de segurança, criptografia, proteção de PII e conformidade LGPD |
| `docs/platforms/PWA_GUIDELINES.md` | Requisitos PWA (manifest, service worker, instalação) |
| `docs/platforms/NATIVE_DISTRIBUTION_GUIDE.md` | Diretrizes de compilação, keystores e distribuição Android Pro |
| `docs/platforms/DEPLOYMENT.md` | Guia de deploy (Cloudflare Pages + Supabase), env vars e checklist de prontidão |

**Antes de implementar qualquer funcionalidade, consulte a seção correspondente do `docs/architecture/ESPECIFICACAO_TECNICA.md` e a estrutura do `docs/architecture/ARCHITECTURE.md`.**

---

## 3. PADRÕES DE CÓDIGO

- **TypeScript estrito** sempre: sem `any`, sem `@ts-ignore`; usar `unknown` + narrowing.
- **Tipagem forte:** contratos de domínio em `src/types`; payloads de borda (API/formulários) validados com **zod**.
- **Funções puras para cálculos:** toda regra financeira (parcelamento, competência de fatura, status de dívida, projeções, insights, ledger, rebalanceamento) vive em `src/domain/` como **função pura, sem import de UI/Supabase** — obrigatoriamente com teste (Vitest, colocalizado `*.test.ts`).
- **Moeda em centavos (inteiro)** dentro dos motores de cálculo; conversão apenas nas bordas.
- **Parcelamento e derivados em lote:** calcular em `domain/` (TS) e enviar as linhas ao RPC; o servidor **valida invariantes** (soma = valor original, parcelas 1–60, datas ≥ APP_START_DATE). Proibido duplicar a lógica de divisão em SQL.
- **Naming:** arquivos kebab-case; componentes PascalCase; hooks `useX`; exports nomeados (sem default); barrel `index.ts` por pasta; imports com alias `@/`.
- **Nunca** colocar cálculo de negócio em componente, hook de UI ou tela.
- **Dependências de camada:** telas (`features/`) podem usar funções puras de `domain/` para derivações locais de exibição; **`src/data/` só é importado por `src/state/`**; componentes de `components/` nunca tocam dados (`data/`/`state/`).

## 4. REGRA DRY ESTRITA PARA UI (REGRAS DE OURO)

A IA **está proibida de recriar marcações JSX/HTML ou estilos duplicados** entre páginas. Se um elemento visual já existe ou pode ser reaproveitado:

1. **DEVE usar/extender o componente existente** (`components/ui` para primitivos, `components/modules` para elementos de domínio).
2. **Variações** são feitas por **props/variants** (`cva` no padrão shadcn) do mesmo componente.
3. **Comportamento substancialmente diferente** → criar **componente derivado explícito** em `modules/` ou `features/`; **proibido** acoplar condicionais complexas dentro do componente base.
4. Elemento usado em **2+ lugares** deve ser **extraído** para a pasta de componentes compartilhados — nunca duplicado.
5. `components/modules` **não tocam dados**: recebem props tipadas e formatam via `src/services/`; não fazem fetch nem importam `src/data/`.
6. Se uma tela precisar de um elemento que não existe, **pare e extraia** o componente antes de escrever a tela.
7. **ZERO elementos nativos de controle** (regra obrigatória): é proibido usar `<select>`, `<input type="checkbox|radio|date|file|range">`, `<dialog>`, `<details>/<summary>`, `alert()/confirm()/prompt()` e scrollbars padrão diretamente nas telas. **Todo controle vira um primitivo próprio** em `components/ui/` (Select, Checkbox, RadioGroup, DatePicker, Slider, Dropzone, Modal/ConfirmDialog, Toast, Accordion…), estilizado com os tokens do DESIGN_SYSTEM (§13). Inputs de texto só via primitivos encapsulados (`Input`, `MoneyInput`, `Textarea`) — **nunca crus nas telas**.
8. **ZERO emojis no produto** (regra obrigatória): é proibido usar emojis/emoticons (🎉 👍 ✅ ⚠️ 😀 …) em qualquer texto exibido ao usuário (UI, empty states, alertas, mensagens, toasts) e em mensagens de domínio/erro. **Toda representação gráfica usa ícones `lucide-react` padronizados** (ver `CATEGORY_ICON_MAP` e o padrão de ícones do DESIGN_SYSTEM §11) com `aria-hidden` e tamanhos da escala (`size-3`/`size-4`/`size-5`), mantendo o visual harmônico — sem ícones soltos/duplicados e sem caracteres Unicode decorativos (✓, ▲, ●…) em textos.
   - **Checagem automática:** a regra ESLint local `local/no-decorative-unicode` (`eslint.config.js`) bloqueia emojis e caracteres decorativos em strings de `src/` (produção; testes e configs ficam de fora) — `npm run lint` falha se houver violação. Nunca contornar com `eslint-disable` para emoji; se um caso legítimo surgir (ex.: caractere necessário em teste), conversar antes.
9. **ABAS FLUIDAS COM SCROLL DESOBSTRUÍDO (regra obrigatória):** no componente `Tabs`, a variante padrão (`fullWidth={false}`) deve sempre usar `shrink-0 flex-initial min-w-fit px-3 py-2`, garantindo largura legível para o texto/ícone e ativando a rolagem horizontal suave no mobile (`overflow-x-auto no-scrollbar scroll-smooth`). É proibido usar `flex-1 min-w-0` em listas de abas com $\ge 4$ itens, evitando esmagamento e sobreposição de botões. A prop `fullWidth={true}` (`flex-1 min-w-0`) é restrita exclusivamente a conjuntos curtos de $\le 3$ itens (ex.: "Entradas / Saídas").
10. **GRIDS MOBILE-FIRST E SEM ESMAGAMENTO (regra obrigatória):** todo grid de métricas ou dados financeiros com $\ge 3$ colunas deve iniciar em `grid-cols-1` ou `grid-cols-2` no mobile (`grid-cols-1 sm:grid-cols-3` ou `grid-cols-2 sm:grid-cols-3 / sm:grid-cols-4`). É proibido o uso de `grid-cols-3` rígido sem prefixo responsivo para dados monetários.
11. **ZERO RETICÊNCIAS EM VALORES MONETÁRIOS (regra obrigatória):** é proibido aplicar `truncate` direto em elementos que renderizam valores monetários ou contadores primários. Todo valor financeiro deve utilizar `<MoneyText />` ou tipografia adaptativa com auto-fit proporcional (`tabular-nums tracking-tight whitespace-nowrap`), garantindo visibilidade integral de centavos e dígitos mesmo em valores $\ge 7$ dígitos.
12. **CABEÇALHOS DE CARDS COMPOSTOS ADAPTATIVOS (regra obrigatória):** cabeçalhos de cards que combinem título com badges de status e botões de ação devem utilizar layout flexível adaptativo (`flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between`), impedindo compressão de títulos ou colisões com botões em larguras de tela $< 400\text{px}$.
13. **HIERARQUIA BALANCEADA DE ÍCONES EM CARDS, CABEÇALHOS & ALERTAS (regra obrigatória):** a interface adota uma hierarquia estrita em dois níveis para garantir escaneabilidade e evitar fadiga visual (*accent fatigue*) ou falsas affordances:
    - **Nível 1 — Ícones Sóbrios Padronizados (*Icon-Only*, sem container):** exclusivo para cabeçalhos de cards comuns de dados (`CardTitle`/`CardHeader`), fichas de ativos, formulários, diálogos e títulos de seções regulares.
      * **Anatomia:** padrão *icon-only* limpo (`size-4` / 16px) em tom neutro suave (`text-muted-foreground`) ou semântica financeira direta pura (`text-positive-strong` para receitas/saldo positivo, `text-negative-strong` para despesas/saldo negativo, `text-portfolio` para aportes/carteira).
      * **Proibição expressa:** é **proibido** criar caixas decorativas soltas (`<span>`/`<div>` com `size-7/size-8/size-9`, `bg-*/10`, `border`) ao redor de ícones em cabeçalhos de cards comuns (evitando que pareçam botões desabilitados ou concorram com badges de status) e é **proibido** aplicar `text-primary` arbitrariamente em ícones descritivos estáticos.
    - **Nível 2 — Ícones de Destaque Padronizados (*Prominent Badge Icons*, com container):** restrito exclusivamente aos contextos onde o destaque cognitivo imediato é indispensável para a tomada de decisão ou escaneamento rápido do usuário:
      * **Banners de Alerta e Carrossel da Home (`DashboardAlertsCarousel` / `CashGapAlert`, `PaceAlert`, `TrialEndingBanner`, `AndroidProBanner`):** casca canônica unificada `flex size-9 shrink-0 items-center justify-center rounded-xl border` com ícone interno `size-4.5`. Cores:
        - *Risco/Crítico:* `bg-critical/10 border-critical/20 text-critical-strong`
        - *Atenção/Prazo:* `bg-warning/15 border-warning/20 text-warning-strong`
        - *Sucesso/Economia:* `bg-positive/10 border-positive/20 text-positive-strong`
        - *Patrimônio/Aporte:* `bg-portfolio/10 border-portfolio/20 text-portfolio`
        - *Informativo/App:* `bg-primary/10 border-primary/20 text-primary-strong`
      * **Linhas de Seleção Semântica Interativa (`QualifiedDismissPopover`):** casca compacta `flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-lg border` com ícone `size-3.5` e cores de semáforo cognitivo.
      * **Heróis Editoriais e Telas de Estado Geral (`LoginPage`, `PendingApprovalPage`, Sucesso de Campanha):** casca ampla `flex size-12 sm:size-14 items-center justify-center rounded-2xl border` com ícone `size-6` a `size-7`.
14. **BADGES ESTRITOS E EMPTY STATES CALMOS (regra obrigatória):** Badges utilizam exclusivamente variantes padronizadas do primitivo (`size="xs" | "sm" | "md"`), sendo **proibido** injetar classes manuais de micro-padding e font-size ad-hoc (`text-[9px]`, `text-[10px]`, `py-0 px-1`). `EmptyState` adota tom neutro calmo por padrão (`tone="default"` / `text-muted-foreground`), mantendo o acento de destaque (*Accent*) reservado exclusivamente ao botão de ação (*CTA*).
15. **ANATOMIA CANÔNICA DE FORMULÁRIOS E DIÁLOGOS (regra obrigatória):** Rótulos de campos seguem estritamente a anatomia de `text-xs font-semibold text-foreground` com helper text `text-[11px] text-muted-foreground` e indicador discreto `(opcional)`. Todos os diálogos utilizam layout unificado de rodapé com Cancelar à esquerda e Confirmar à direita no desktop (`sm:justify-end`). No mobile, pares de 2 botões utilizam layout horizontal compacto simétrico (`grid grid-cols-2 gap-2`), reservando o empilhamento vertical (`flex-col-reverse`) exclusivamente para rodapés com 3 ou mais botões.
16. **PADRÃO CANÔNICO DE SUPERFÍCIE E ELEVAÇÃO (regra obrigatória):** Cards de dados em todas as páginas utilizam a trinca canônica `border-border/80 bg-surface shadow-xs`, sendo proibido introduzir opacidades de borda divergentes (`border-border/60`) sem justificativa de design system.
17. **GOVERNANÇA SENSORIAL & ZERO DUPLOS DISPAROS (regra obrigatória):** Todo feedback tátil ou sonoro deve passar exclusivamente pelo **Gateway Central Sensorial** (`src/services/sensory.ts` / `triggerSensory`). É expressamente **proibido** chamar `triggerHaptic(...)` diretamente dentro de handlers `onClick` de botões (`<Button />`), evitando o defeito de duplos disparos simultâneos (*double-haptic*). É **proibido** emitir feedback tátil/sonoro durante a digitação em inputs (`MoneyInput`, `Input`, `Textarea`), em rolagem passiva ou no hover de desktop.
18. **GOVERNANÇA DE MODAIS & DIÁLOGOS NO DESKTOP E MOBILE (regra obrigatória):** Todo modal/diálogo do sistema utiliza o primitivo `<Modal />` ou `<ResponsiveDialog />` respeitando estritamente a matriz de larguras e layout responsivo:
    - **Centralização a partir de Tablet (`md:` / 768px):** a transformação em diálogo centralizado (`md:inset-x-auto md:top-1/2...`) ocorre a partir de `md:`, reservando a gaveta inferior (*Bottom Sheet* deslizante com arrasto) exclusivamente para telas de smartphones (`< 768px`).
    - **Ergonomia Móvel & Cabeçalho Fluido (Plano 08):** no mobile (`< md`), modais utilizam barra de controle minimalista de topo (`h-10` / 40px) com alça centralizada e ações contextuais à direita. É expressamente **proibido** fixar cabeçalhos estáticos descritivos de grande porte no topo do mobile: o título editorial e a descrição fluem naturalmente integrados ao scroll no topo do corpo rolável, liberando mais de 120px a 150px de viewport livre. Ao rolar além de 32px, um micro-título reativo discreto assume o topo acompanhado de alívio adaptativo anti-corte seco (`bg-surface/95 backdrop-blur-xs border-border/80 shadow-xs`), eliminando cortes bruscos de cards e tabelas. No desktop (`md:`), o cabeçalho clássico permanece sticky no topo com zero duplicação de nós no DOM.
    - **Escala Canônica de Larguras (`size`):**
      * `sm` (`md:max-w-md` = 448px): exclusivo para confirmações, alertas curtos e perfil compacto.
      * `md` (`md:max-w-lg` = 512px): formulários simples (metas, limites, categorias enxutas).
      * `lg` (`md:max-w-2xl` = 672px): detalhes de transações, categorias ricas, operações rápidas.
      * `xl` (`md:max-w-4xl` = 896px): assistentes (wizards), cadastros densos de ativos, cartões com preview virtual e contratos de empréstimo.
      * `2xl` (`md:max-w-5xl lg:max-w-6xl` = 1024px–1152px): fichas de ativos, extratos, conciliação e importação de faturas/extratos bancários.
      * `3xl` (`md:max-w-7xl` = 1280px): relatórios executivos e auditorias completas.
    - **Grids de Formulários no Desktop:** formulários compostos dentro de modais com $\ge 3$ campos devem distribuir os pares de inputs em grid responsivo (`grid grid-cols-1 sm:grid-cols-2 gap-3.5`), sendo proibido criar túneis verticais de coluna única estreita com rolagem desnecessária no desktop.
    - **Zero Modais com `max-w-*` arbitrários em `className`:** a definição de largura máxima é feita exclusivamente pela prop tipada `size` do `Modal`/`ResponsiveDialog`, evitando conflitos de especificidade na cascata CSS.
19. **UNIFORMIDADE E ALTURA TOTAL EM CARROSSEL DE ALERTAS (regra obrigatória):** Todo card ou banner exibido dentro do carrossel da Home (`DashboardAlertsCarousel` / `alertItems`) deve preencher 100% da altura da trilha flex (`w-full h-full min-h-[104px] sm:min-h-[72px] flex-1`) e adotar a anatomia canônica unificada: casca externa flexível com distribuição adaptativa (`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4`), padding canônico compacto e confortável `p-3.5 sm:p-4` (preservando o footprint vertical enxuto da Home), raio de borda `rounded-2xl`, sombra `shadow-xs`, botão CTA com tamanho `size="sm"` (`h-8`) e alinhamento responsivo `self-stretch sm:self-center mt-auto sm:mt-0`. O bloco textual adota teto estrito de 2 linhas (Linha 1: Título com `truncate` + Badge `size="xs"`; Linha 2: Descrição objetiva em 1 linha com `truncate` ou `line-clamp-1`). É proibido renderizar fitas de chips secundários dentro do carrossel, cards com alturas intrínsecas desiguais, paddings divergentes (`p-4 sm:p-5`), raios divergentes (`rounded-xl`) ou botões `size="xs"` soltos no carrossel, prevenindo saltos de layout vertical (*layout jumps*) e quebras estéticas durante a rotação.
20. **ZERO AUTO-FOCUS E ERGONOMIA DE ENTRADAS NO MOBILE (regra obrigatória):**
    - **Proibição estrita de `autoFocus` declarativo:** é expressamente **proibido** utilizar a propriedade `autoFocus` (ou `autoFocus={true}`) em qualquer elemento de formulário (`<Input />`, `<MoneyInput />`, `<NumericInput />`, `<PercentInput />`, `<Textarea />`) dentro de modais, diálogos ou telas comuns. O foco e a abertura do teclado virtual em smartphones e tablets devem ser sempre uma ação deliberada de toque pelo usuário, prevenindo saltos de viewport (*layout jumps*) e a perda do contexto visual da janela.
    - **Prevenção de Auto-Zoom no iOS WebKit:** todo campo interativo de digitação (`Input`, `MoneyInput`, `NumericInput`, `Textarea`) deve possuir tamanho mínimo de fonte de 16px no mobile (`text-base` ou `text-base sm:text-sm`), impedindo que o motor do iOS Safari realize zoom in automático e desequilibre a centralização do modal.
    - **Proteção contra fechamento acidental por Portais:** no contêiner do `<Modal />`, handlers de ponteiro externo (`onPointerDownOutside` e `onInteractOutside`) devem proteger portais flutuantes do Radix (`[data-radix-popper-content-wrapper]`, `[data-radix-select-content]`, `[data-radix-popover-content]`), impedindo que a seleção de datas, cores ou opções feche involuntariamente o modal principal.

## 5. RESILIÊNCIA E TRATAMENTO DE ERROS


- **Gateway único de erros** (`src/services/errors.ts`, `getErrorMessage`): mensagens pt-BR padronizadas. Proibido espalhar strings de erro soltas.
- **Validação nas bordas:** entrada de API e formulários validados com zod (cliente) + constraints/RPCs (servidor).
- **Toda tela com 3 estados:** loading (**Skeleton**, não spinner genérico), vazio (**EmptyState** dedicado), erro (via gateway + ação "Tentar novamente").
- **Falha de rede (Online First):** erro explícito com retry manual — nunca silenciar.
- **Escritas compostas** (2+ registros numa ação) devem usar **RPC transacional** (`src/data/rpc.ts`); proibido orquestrar multi-escrita sequencial no cliente. O servidor **valida invariantes** dos dados recebidos (constraints/checks) — nunca confiar cegamente no cliente.
- **Datas em timezone local** — nunca `toISOString()` para ranges de mês.

## 6. NÃO VIOLAÇÃO DE ESCOPO

- **Proibido** reintroduzir motores legados: integração B3, conciliação bancária pesada, parsers de extrato, análise quantamental/tiers/scoring de ativos.
- **Proibido** alterar regras de negócio definidas no `ESPECIFICACAO_TECNICA.md` sem instrução explícita do usuário.
- **Proibido** adicionar persistência local/offline de dados de negócio (o app é Online First).
- Escopo do investimento: **apenas** metas, leitura de posição e cálculo de aporte (rebalanceamento).
- Dúvida de escopo ou regra → perguntar antes de implementar.

## 7. CRIAÇÃO DE ARQUIVOS E PASTAS

- **Todo arquivo novo deve pertencer a um diretório já definido** em `docs/PROJECT_STRUCTURE.md`. Antes de criar, localize onde ele se encaixa na árvore (tabela de decisão §6).
- **Proibido** criar pastas genéricas (`utils/`, `helpers/`, `commons/`, `misc/`, `shared/`) ou arquivos soltos na raiz do projeto sem autorização explícita.
- **Proibido** criar novos diretórios de topo (`src/*` novo, novo segmento em `public/`) sem autorização — e sempre atualizar `docs/PROJECT_STRUCTURE.md` junto.
- Componente reutilizado em 2+ telas → `components/ui` (primitivo) ou `components/modules` (domínio); nunca duplicar JSX (ver §4).
- Feature nova → `src/features/<nome>/` seguindo o padrão interno do `PROJECT_STRUCTURE.md` §5 (`pages/` + `components/` + `hooks/` + `index.ts`).
- Arquivos PWA (manifest, ícones, offline) → `public/pwa/` conforme `docs/PWA_GUIDELINES.md`.
- Toda pasta com barrel `index.ts` e exports nomeados (sem `export default`).

## 8. GOVERNANÇA DA DOCUMENTAÇÃO (`docs/`)

- **Padronização de nomes:** arquivos em `docs/` usam `UPPER_SNAKE_CASE.md` (`ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `PWA_GUIDELINES.md`, …).
- **Regra de atualização contínua:** nenhuma mudança estrutural de código (novo diretório, mudança de camada, feature major, novo serviço) pode ser concluída **sem atualizar o documento correspondente** em `docs/` — e `AGENTS.md` quando aplicável.
- Antes de implementar, consulte: `PROJECT_STRUCTURE.md` (onde) · `ARCHITECTURE.md` (como) · `ESPECIFICACAO_TECNICA.md` (regras) · `DESIGN_SYSTEM.md` (visual) · `PWA_GUIDELINES.md` (se envolver PWA).

## 9. FLUXO DE TRABALHO E VERIFICAÇÃO

1. Antes de terminar uma tarefa: rodar **typecheck** (`tsc --noEmit`), **lint** e **testes** relevantes — corrigir até ficar verde.
2. Testes obrigatórios para: regras de `domain/` (cálculos), RPCs transacionais (rollback) e validações de borda.
3. Alterações de UI: conferir em **desktop e mobile**, nos temas afetados, com os estados loading/vazio/erro.
4. Mensagens, textos e labels em **pt-BR**, via constantes/gateway — sem strings soltas duplicadas.
5. Seguir a árvore e as regras de `docs/PROJECT_STRUCTURE.md`; não criar arquivos fora dela sem justificativa e sem atualizar a documentação (§8).
6. Commits pequenos e descritivos; não commitar secrets ou `.env`.
