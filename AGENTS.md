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
| `RECONSTRUCAO.md` | Spec funcional original (fonte histórica) |
| `ESPECIFICACAO_TECNICA.md` | **Spec executável**: regras de negócio, schema, UI/UX, decisões D1–D12 |
| `docs/ARCHITECTURE.md` | Camadas, dependências, convenções, estratégia de estado |
| `docs/PROJECT_STRUCTURE.md` | **Árvore de pastas e onde criar cada arquivo** |
| `docs/DESIGN_SYSTEM.md` | Identidade visual e design tokens (`src/styles/tokens.css`) |
| `docs/PWA_GUIDELINES.md` | Requisitos PWA (manifest, service worker, instalação) |
| `docs/ROADMAP.md` | **Plano de execução canônico** — fases, ordem e Definition of Done |
| `docs/DEPLOYMENT.md` | Guia de deploy (Vercel + Supabase), env vars e checklist de prontidão |

**Antes de implementar qualquer funcionalidade, consulte a seção correspondente do `ESPECIFICACAO_TECNICA.md` e a estrutura do `docs/ARCHITECTURE.md`.**

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
13. **HIERARQUIA BALANCEADA DE ÍCONES EM CARDS & CABEÇALHOS (regra obrigatória):** todo ícone em cards, KPIs, seções (`CardTitle`/`CardHeader`) e formulários deve seguir estritamente a matriz de hierarquia semântica:
    - **Informativo / Estrutural / Cabeçalhos:** tom neutro suave (`text-muted-foreground`) no padrão *icon-only* (`size-4` / 16px). É **proibido** aplicar `text-primary` arbitrariamente em ícones descritivos estáticos para evitar fadiga visual e sobrecarga da cor de destaque (*accent fatigue*).
    - **Fluxo Financeiro Direto:** semântica financeira pura (`text-positive-strong` para receitas/saldo positivo, `text-negative-strong` para despesas/saldo negativo, `text-portfolio` para aportes/carteira).
    - **Risco / Atenção:** `text-warning-strong` (atenção/desvio) ou `text-critical-strong` (atraso/estouro).
    - **Acento Primário (`primary`):** reservado estritamente para elementos interativos ativos (botões CTA, abas ativas, switches ligados, anéis de foco).
    - **Zero caixas decorativas soltas:** o padrão *icon-only* limpo é a regra canônica; contêineres/botões (`bg-surface-hover size-7/size-8`) são exclusivos para elementos com ação de clique direta.
14. **BADGES ESTRITOS E EMPTY STATES CALMOS (regra obrigatória):** Badges utilizam exclusivamente variantes padronizadas do primitivo (`size="xs" | "sm" | "md"`), sendo **proibido** injetar classes manuais de micro-padding e font-size ad-hoc (`text-[9px]`, `text-[10px]`, `py-0 px-1`). `EmptyState` adota tom neutro calmo por padrão (`tone="default"` / `text-muted-foreground`), mantendo o acento de destaque (*Accent*) reservado exclusivamente ao botão de ação (*CTA*).
15. **ANATOMIA CANÔNICA DE FORMULÁRIOS E DIÁLOGOS (regra obrigatória):** Rótulos de campos seguem estritamente a anatomia de `text-xs font-semibold text-foreground` com helper text `text-[11px] text-muted-foreground` e indicador discreto `(opcional)`. Todos os diálogos utilizam layout unificado de rodapé com Cancelar à esquerda e Confirmar à direita no desktop, e empilhamento seguro no mobile (`flex-col-reverse`).
16. **PADRÃO CANÔNICO DE SUPERFÍCIE E ELEVAÇÃO (regra obrigatória):** Cards de dados em todas as páginas utilizam a trinca canônica `border-border/80 bg-surface shadow-xs`, sendo proibido introduzir opacidades de borda divergentes (`border-border/60`) sem justificativa de design system.
17. **GOVERNANÇA SENSORIAL & ZERO DUPLOS DISPAROS (regra obrigatória):** Todo feedback tátil ou sonoro deve passar exclusivamente pelo **Gateway Central Sensorial** (`src/services/sensory.ts` / `triggerSensory`). É expressamente **proibido** chamar `triggerHaptic(...)` diretamente dentro de handlers `onClick` de botões (`<Button />`), evitando o defeito de duplos disparos simultâneos (*double-haptic*). É **proibido** emitir feedback tátil/sonoro durante a digitação em inputs (`MoneyInput`, `Input`, `Textarea`), em rolagem passiva ou no hover de desktop.

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
