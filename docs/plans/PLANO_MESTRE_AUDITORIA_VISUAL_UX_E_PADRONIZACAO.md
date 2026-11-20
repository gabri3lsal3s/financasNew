# PLANO MESTRE DE AUDITORIA VISUAL, UI/UX E PADRONIZAÇÃO ARQUITETURAL

> **Documento Canônico de Governança, Engenharia de Design System e Auditoria de Interface**  
> **Status:** Ativo / Fase 0 Aprimorada, Blindada e Consolidada  
> **Versão:** 2.0 (Revisão Técnica Profunda)  
> **Arquivo:** `docs/plans/PLANO_MESTRE_AUDITORIA_VISUAL_UX_E_PADRONIZACAO.md`  
> **Escopo:** 100% da camada de interface do Axir (`src/styles/`, `src/components/`, `src/features/`, `src/pages/`, `src/app/`)  
> **Diretório Oficial de Relatórios:** `docs/reports/auditoria-visual/`  
> **Meta Final:** Emissão de 7 Relatórios Fragmentados + Plano Mestre de Implementação e Correção

---

## 1. VISÃO GERAL & OBJETIVOS ESTRATÉGICOS

Este Plano Mestre rege a auditoria técnica mais abrangente já executada no **Axir**. Seu propósito é transformar a interface do produto em um padrão de referência de classe mundial em finanças pessoais e inteligência patrimonial, eliminando desvios ergonômicos, assimetrias visuais, poluição cognitiva e códigos duplicados.

### Os 5 Pilares de Excelência Deste Plano:
1. **Padronização Visual Absoluta:** Unificar alturas, superfícies, sombras, raios de borda, tipografia e espaçamentos em uma régua rítmica coesa baseada em tokens.
2. **Componentização Atômica & Princípio DRY Estrito:** Garantir que elementos repetidos 2+ vezes sejam extraídos para componentes reutilizáveis, pequenos (teto de 150 a 250 linhas) e altamente especializados, permitindo manutenções rápidas na raiz sem duplicar JSX.
3. **Ergonomia Móvel e Conforto de Uso:** Erradicar o "efeito visor estreito" (*viewport squeeze*), cortes secos de cabeçalhos, botões que rolam fora do alcance, desalinhamentos em grids (*staircase effect*) e conflitos com o teclado virtual e a safe area do iOS.
4. **Governança de Temas e Integridade Cromática:** Blindar o sistema contra aberrações cromáticas em todas as 18 combinações de temas (`light`, `dark`, `oled`) e acentos (`teal`, `gold`, `sapphire`, `violet`, `rose`, `mono`), garantindo que cores semânticas financeiras (receita, despesa, aporte) jamais sejam confundidas com a cor de destaque da marca.
5. **Expurgo Sistemático de Código Morto:** Mapear e eliminar componentes zumbis, variantes não utilizadas, estilos CSS obsoletos e redundâncias arquiteturais.

---

## 2. FASE 0: CONSOLIDAÇÃO CANÔNICA DAS REGRAS DE DESIGN & UI/UX

Todas as regras descritas no `AGENTS.md`, `DESIGN_RULES.md` e `DESIGN_SYSTEM.md` foram integradas e aprofundadas com critérios geométricos avançados. A auditoria fragmentada utilizará as **14 Dimensões de Avaliação Técnica** a seguir como régua inflexível:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   AS 14 DIMENSÕES TÉCNICAS DA AUDITORIA                │
├────────────────────────────────────────────────────────────────────────┤
│ 01. Governança Canônica de Modais & Drawers (Primitivo Único)          │
│ 02. Matriz de Temas e Cor de Destaque (18 Combinações Sem Conflito)    │
│ 03. Ergonomia Tipográfica, Truncamento e Blindagem Numérica            │
│ 04. Alinhamento Geométrico em Grids (Fim do "Efeito Escada")           │
│ 05. Invariância de Altura de Controles e Touch Targets                 │
│ 06. Alinhamento Numérico e Colunas em Tabelas (text-right Sagrado)     │
│ 07. Alinhamento Óptico de Ícones e Prevenção de Deformação             │
│ 08. Hierarquia de Superfícies em 3 Níveis (L0, L1, L2 - Zero Ruído)    │
│ 09. Sobriedade Visual e Redução de Carga Cognitiva                     │
│ 10. Responsividade, Viewport Contido (100vw) e Breakpoints             │
│ 11. Ergonomia Mobile, Safe Areas e Prevenção de Teclado                │
│ 12. Hierarquia Centralizada de Z-Index (Tokens de 10 a 70)             │
│ 13. Governança Sensorial, Tátil e Acessibilidade de Movimento          │
│ 14. Componentização Atômica, DRY Estrito e Expurgo de Código Morto     │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2.1 Detalhamento Técnico das 14 Dimensões

#### Dimensão 01: Governança Canônica de Modais & Drawers
- **Primitivo Único Obrigatório:** Todo modal ou gaveta do sistema utiliza o primitivo canônico `src/components/ui/modal.tsx` (ou o alias `ResponsiveDialog`). É proibido recriar drawers ou modais usando `fixed inset-0` manuais (caso de `LandingMobileDrawer` e `AdminMobileDrawer`, que devem ser convertidos ou padronizados).
- **Rodapé Canônico Fixado (Pinned Footer):** Botões de ação do rodapé devem ser passados **exclusivamente via prop `footer`** (ou `destructiveAction`). É terminantemente proibido colocar `<ModalFooter>` como filho direto dentro do `children`, prevenindo que os botões rolem com o conteúdo no mobile.
- **Isolamento Estrito de Scroll (Regra 26):** Proibido adicionar classes de rolagem (`overflow-y-auto`, `overflow-y-scroll`, `max-h-[*vh]`) dentro do `children`. Toda rolagem vertical pertence unicamente ao contêiner interno gerenciado pelo modal (`scrollRef`).
- **Tamanhos Canônicos:** Definição de largura feita estritamente pela prop `size` (`sm` = 448px, `md` = 512px, `lg` = 672px, `xl` = 896px, `2xl` = 1024-1152px, `3xl` = 1280px). Proibido injetar `max-w-*` arbitrários em `className`.
- **Cabeçalho Fluido & Micro-título (Plano 08):** No mobile, o cabeçalho descritivo rola com o conteúdo. Ao passar de 32px de rolagem, a barra superior minimalista ativa o micro-título com alívio adaptativo (`backdrop-blur-xs shadow-xs`), eliminando cortes bruscos.

#### Dimensão 02: Matriz de Temas e Cor de Destaque
- **Papel da Cor de Destaque (`--primary` / `--primary-strong`):** A cor de destaque alterável pelo usuário (`data-accent`) é reservada para **ações interativas do usuário** (botões CTA primários, links, tabs ativas, foco `ring-ring`, checkboxes e radios checados, chips selecionados).
- **Proibição em Semânticas Financeiras:** Proibido utilizar `text-primary`, `bg-primary` ou `border-primary` para representar valores monetários de saldo positivo, receitas, lucros ou aportes. Valores financeiros usam estritamente tokens semânticos imutáveis: `--positive` (receita/saldo), `--negative` (despesa), `--warning` (atenção/limite), `--critical` (atraso/estouro), `--portfolio` (investimentos).
- **Papel do Token Ouro (`--accent`):** Fixo em Ouro Âmbar (`#DDA726`), reservado para brilho de KPIs (`shadow-kpi`), anel da marca Axir e badges de planos Pro/VIP.
- **Neutralidade de Ícones Estáticos (Regra 13):** Ícones descritivos estáticos em cabeçalhos de cards e seções usam obrigatoriamente tom neutro suave (`text-muted-foreground`), sendo proibido aplicar `text-primary` arbitrariamente.
- **Blindagem no Tema OLED e Acento Mono:** No OLED (`#000000`), superfícies devem preservar relevo (`#0D0D0D` e bordas `#2E2E2E`); no acento `mono`, o `--primary` (preto no claro, branco no escuro) deve manter contraste e affordance com bordas ou anéis de foco nítidos.

#### Dimensão 03: Tipografia, Truncamento e Números
- **Zero Reticências em Dinheiro (Regra 11):** Valores monetários e taxas percentuais nunca podem ser cortados com `truncate` ou `text-ellipsis`. Devem utilizar `<MoneyText />` ou auto-fit com `tabular-nums tracking-tight whitespace-nowrap`.
- **Quebra Controlada em Títulos (Regra 23):** Títulos de cartões, contas e transações utilizam `line-clamp-2 break-words` com largura mínima garantida no contêiner (`min-w-0`), prevenindo palavras amassadas ou quebras de uma única letra.
- **Auto-fit de Badges:** Badges com texto longo utilizam `max-w-full truncate inline-block` com `title` acessível.
- **Desênfase Sutil de Centavos (M6):** Em KPIs gigantes (variante `hero` de `<MoneyText />`), os centavos `,00` devem usar `text-[0.82em] opacity-80 font-normal` mantendo `tabular-nums`, ganhando 12% de folga horizontal.

#### Dimensão 04: Alinhamento em Grids e Fim do "Efeito Escada"
- **Casca Flexível Total:** Todo card dentro de CSS Grid (`grid-cols-*`) adota `h-full flex flex-col`.
- **Miolo Expansível (`flex-1`):** A seção intermediária do card recebe `flex-1`, empurrando botões de ação e rodapés para a base (`mt-auto`), alinhando perfeitamente todos os botões de uma mesma fileira horizontal.
- **Reserva de Altura de Título:** Cabeçalhos de cards vizinhos adotam altura mínima padronizada (`min-h-[2.75rem]` ou similar), impedindo que títulos com 2 linhas desloquem para baixo o valor monetário principal.

#### Dimensão 05: Invariância de Altura de Controles e Touch Targets
- **Escala Canônica de Alturas:**
  - `sm`: `h-8` (32px) para tabelas densas, filtros em linha e barras de ferramentas secundárias.
  - `default`: `h-10` (40px) para formulários regulares, inputs, selects e botões principais.
  - `lg`: `h-11` a `h-12` (44px a 48px) para wizards e formulários móveis rápidos.
- **Proibição de Mistura na Mesma Linha:** Controles adjacentes (`flex items-center gap-2`) devem compartilhar a mesma classe de altura.
- **Touch Target Mínimo de 44px (W3C A11y):** Botões visuais menores que 44px no mobile utilizam compensação tátil (`after:absolute after:-inset-1.5` ou padding de toque).

#### Dimensão 06: Alinhamento Numérico em Tabelas
- **Regra Sagrada do `text-right`:** Valores monetários, percentuais e contadores numéricos em tabelas e listas devem ser rigorosamente alinhados à direita (`text-right`), acompanhados de seus respectivos cabeçalhos (`th` também em `text-right`).
- **Algarismos Mono-espaçados Obrigatórios:** Obrigatório o uso de `tabular-nums` ou classe `.num` em todas as colunas numéricas para alinhamento perfeito de vírgulas e centavos na vertical.

#### Dimensão 07: Alinhamento Óptico de Ícones
- **`shrink-0` Obrigatório:** Todo ícone inline em contêiner flex deve possuir `shrink-0` para impedir deformação elíptica.
- **Pareamento Escalar Ícone-Texto:**
  - `text-[11px]` e `text-xs` → ícone `size-3.5` (14px).
  - `text-sm` → ícone `size-4` (16px).
  - `text-base` e títulos `text-lg` → ícone `size-4.5` ou `size-5` (18px a 20px).
  - Heróis editoriais → ícones `size-6` a `size-8`.
- **Centralização Vertical Óptica:** `flex items-center` com texto em `leading-none` para perfeito alinhamento com a altura-x.

#### Dimensão 08: Hierarquia de Superfícies em 3 Camadas (L0/L1/L2)
- **L0 (Fundo Geral):** `bg-background` sem bordas.
- **L1 (Cards Primários):** `bg-surface border border-border/80 rounded-2xl shadow-xs`.
- **L2 (Agrupamentos Internos / Sub-blocos):** `bg-surface-raised border border-border/60 rounded-xl` sem sombra.
- **Proibição de Bordas Duplas:** Tabelas ou listas inseridas em cards L1 não devem ter borda externa adicional; usam apenas divisores sutis (`divide-y divide-border/60`).

#### Dimensão 09: Sobriedade Visual e Calma Cognitiva
- **Teto de 1 Badge por Card:** Máximo de 1 badge de status por card de métrica.
- **1 CTA Sólido por Tela:** Apenas um botão com preenchimento sólido primário (`variant="solid"` ou `variant="default"`) visível por viewport; ações secundárias adotam `variant="outline"` ou `variant="ghost"`.
- **Zero Cópias Redundantes:** Remoção de subtítulos que apenas repetem o título do campo.

#### Dimensão 10: Responsividade e Viewport Contido (100vw)
- **Contenção 100vw:** `html` e `body` com `overflow-x: clip`. Breakpoint de menus horizontais em `lg:` (1024px), mantendo gaveta compacta no tablet (`md:`).
- **Abas Fluidas (Regra 9):** Abas com $\ge 4$ itens usam `shrink-0 min-w-fit px-3` com rolagem horizontal suave (`no-scrollbar`).
- **Grids Adaptativos (Regra 10):** Grids de métricas iniciam em `grid-cols-1` ou `grid-cols-2` no mobile, nunca `grid-cols-3` rígido.

#### Dimensão 11: Ergonomia Mobile, Safe Areas e Teclado
- **Zona de Exclusão Inferior (Regra 27):** Contêiner rolável de páginas com `pb-28 sm:pb-32` para não sobrepor o `BackToTop` ou a `BottomNav`.
- **Prevenção de Zoom no iOS:** Inputs de texto com fonte mínima de 16px no mobile (`text-base sm:text-sm`).
- **Zero `autoFocus` (Regra 20):** Proibido `autoFocus` declarativo em formulários para evitar saltos de tela e abertura intrusiva de teclado.

#### Dimensão 12: Hierarquia de Z-Index
- Aderência estrita à régua centralizada de `tokens.css`:
  - `Base (10)` → `Sticky/Dropdown (20)` → `BottomNav (30)` → `Sidebar (40)` → `Modal (50)` → `Floating Tools (60)` → `Toast (70)`.
  - Proibição de classes soltas (`z-30`, `z-40`, `z-50`, `z-[999]`).

#### Dimensão 13: Governança Sensorial e Feedback
- Gateway único centralizado: todo feedback tátil passa por `triggerSensory` de `src/services/sensory.ts`. Proibido chamar `triggerHaptic` diretamente no `onClick` de botões (evitando duplo disparo).
- Respeito estrito a `data-motion="reduced"` e `data-motion="eco"` (desativação de ripples e animações elásticas).
- Silêncio de toasts em ações auto-evidentes (M7).

#### Dimensão 14: Componentização Atômica & Código Morto (DRY)
- **Teto de Linhas por Arquivo:** Componentes de interface devem manter teto saudável entre **150 e 250 linhas**. Arquivos que ultrapassam esse limite devem ser decompostos em subcomponentes atômicos colocalizados em subpastas dedicadas da feature (ex.: `features/cards/components/parts/`).
- **Princípio DRY Absoluto:** Todo padrão visual ou marcação JSX repetida em 2 ou mais locais deve ser extraído para `components/ui/` (primitivo) ou `components/modules/` (domínio).
- **Mapeamento de Código Morto:** Rastreamento sistemático de componentes não importados, variantes zumbis e utilitários obsoletos para remoção no Plano de Execução.

---

### 2.2 Matriz Canônica de Raio de Borda (Border Radius)

| Nível Arquitetural | Token / Classe | Valor Pixels | Onde Deve Ser Aplicado | Proibições Expressas |
|---|---|---|---|---|
| **App Shell & Modais** | `rounded-2xl` | 20px / 1.25rem | Diálogos centralizados desktop, topo do Bottom Sheet mobile, banners herói de topo | Proibido usar `rounded-lg` em modais ou `rounded-3xl` arbitrário |
| **Cards de Dados (L1)** | `rounded-2xl` | 16px–20px | Cards de métricas, cards de fatura, cards de ativos, contêiner de tabelas | Proibido misturar `rounded-xl` e `rounded-2xl` na mesma fileira de cards |
| **Sub-blocos & Insets (L2)** | `rounded-xl` | 12px / 0.75rem | Agrupamentos internos de formulários, cards de parcelas dentro de modal | Proibido aplicar `rounded-2xl` dentro de cards que já são `rounded-2xl` |
| **Controles & Inputs** | `rounded-lg` | 8px / 0.5rem | Inputs, MoneyInput, Select, botões, DatePicker | Proibido inputs com borda 100% redonda (pill) ou cantos retos (0px) |
| **Badges & Tags** | `rounded-pill` / `rounded-full` | 999px | Badges de status, chips de seleção, avatares, pílulas de navegação | Proibido badges retangulares sem raio |

---

### 2.3 Matriz de Intenção e Variantes de Botões (`<Button />`)

| Variante | Estilo Visual | Papel no Sistema | Onde É Permitido | Onde É Proibido |
|---|---|---|---|---|
| `solid` | `bg-primary-strong text-primary-foreground` | **CTA Primário Único de Conclusão** | Botão principal de "Salvar" no modal, "Concluir Lançamento", "Confirmar Aporte" | Proibido ter 2 botões `solid` na mesma viewport |
| `default` | `bg-primary/10 border-primary/25 text-primary-strong` | Destaque secundário com tom suave | Botões de ação em cabeçalhos de card, atalhos de filtro, links de ação rápida | Proibido usar como botão de cancelamento |
| `outline` | `border-border bg-surface text-foreground` | Ação secundária neutra | Botão "Cancelar" em diálogos, "Voltar", "Exportar Relatório" | Proibido usar quando a ação for destrutiva |
| `ghost` | Transparente com hover suave | Ação de baixo peso visual | Botão fechar (`X`), ícones de tabela, navegação em abas, links discretos | Proibido usar como único botão de submissão de formulário |
| `destructive` | `bg-critical/10 border-critical/40 text-critical-strong` | Ação destrutiva ou remoção | "Excluir Conta", "Remover Cartão", "Excluir Transação" | Proibido usar em cancelamentos simples |

---

### 2.4 Matriz de Defesa contra Casos Extremos de Conteúdo (Edge Cases)

| Cenário Extremo | Comportamento Proibido (Bug Visual) | Comportamento Canônico Obrigatório |
|---|---|---|
| **Valor Monetário Astronômico** (ex: `R$ 14.850.230,45`) | Truncar com `...` escondendo centavos ou empurrar botões vizinhos para fora da tela | Tipografia adaptativa com auto-fit (`text-base sm:text-lg lg:text-xl`), `tabular-nums whitespace-nowrap` e desênfase de centavos (`M6`) |
| **Nome de Transação / Ativo Gigante** (ex: 50+ caracteres) | Estourar a largura do card em 1 linha ou quebrar uma única letra na linha de baixo | `line-clamp-2 break-words` com contêiner pai `min-w-0 flex-1`, garantindo leitura íntegra em até 2 linhas |
| **Tela Super-Estreita (iPhone SE / Galaxy Fold 320px–375px)** | Esmagamento de botões de rodapé ou corte de ações à direita | Grid `grid-cols-2 gap-2` em rodapés de 2 botões; rolagem horizontal suave (`overflow-x-auto`) em abas e filtros |
| **Teclado Virtual Aberto no Mobile** | Cabeçalho e rodapé fixos esmagam o formulário para uma fresta de 50px | Cabeçalho móvel integrado ao scroll livre; inputs com scroll automático garantido |
| **Conta Virgem (Zero Dados Registrados)** | Home cheia de cards vazios com `R$ 0,00` e gráficos zerados (*cold-start anxiety*) | Renderização acolhedora do `<VirginAccountHero />` com 3 ações claras de partida |

---

## 3. ARQUITETURA DE COMPONENTIZAÇÃO ATÔMICA & DECOMPOSIÇÃO DRY

Para que as futuras refatorações sejam sustentáveis e o código permaneça limpo, estabelecemos as diretrizes de decomposição:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DIRETRIZ DE ARQUITETURA DE COMPONENTES               │
└────────────────────────────────────────────────────────────────────────┘

    src/components/ui/                Primitivos puros e agnósticos
    ├── modal.tsx                     (Apenas tokens CSS e eventos Radix)
    ├── button.tsx                    Zero regras de negócio / Zero dados
    └── money-text.tsx

    src/components/modules/           Componentes compartilhados de domínio
    ├── transaction-row.tsx           (Recebem dados tipados por props)
    ├── cash-kpi-card.tsx             Zero fetch direto / Formatação via services
    └── position-table.tsx

    src/features/<nome>/              Componentes especialistas de tela
    ├── pages/                        Orquestradores de estado e mutações
    └── components/                   Decompostos em arquivos atômicos (<200 linhas)
        └── asset-detail/             Subpasta colocalizada para partes do componente
            ├── asset-hero-summary.tsx
            ├── asset-position-metrics-grid.tsx
            └── asset-allocation-card.tsx
```

### Regras de Ouro da Decomposição:
1. **Regra dos 250 Linhas:** Se um componente ultrapassar 250 linhas, ele DEVE ser dividido em sub-blocos lógicos colocados em uma subpasta com o mesmo nome (ex.: `features/transactions/components/split/`).
2. **Componentes sem Acesso Direto a Dados:** Componentes em `src/components/modules/` não fazem chamadas a `src/data/` nem executam queries do Supabase diretamente. Eles recebem propriedades tipadas e usam formatadores de `src/services/`.
3. **Limpeza Sistemática de Código Zumbi:** Ao refatorar componentes, qualquer arquivo que perca suas referências ou exportação morta deve ser imediatamente listado para remoção.

---

## 4. O CRONOGRAMA DAS 7 PARTES DA AUDITORIA

A execução da auditoria foi particionada para cobrir o aplicativo de ponta a ponta. Cada parte gerará um relatório técnico `.md` independente no diretório `docs/reports/auditoria-visual/`:

| Parte | Domínio de Auditoria | Arquivos Auditados | Relatório Gerado |
|---|---|---|---|
| **Parte 1** | **Fundação, Tokens, Primitivos de UI e App Shell** | `src/styles/*`, `src/components/ui/*`, `src/components/layout/*` | `docs/reports/auditoria-visual/PARTE_1_FUNDACAO_TOKENS_PRIMITIVOS_E_SHELL.md` |
| **Parte 2** | **Módulos Compartilhados de Domínio e Gráficos SVG** | `src/components/modules/*`, motores SVG em `src/domain/charts/` | `docs/reports/auditoria-visual/PARTE_2_MODULOS_COMPARTILHADOS_E_GRAFICOS.md` |
| **Parte 3** | **Núcleo Transacional & Cartões de Crédito** | `src/features/transactions/*`, `src/features/cards/*` | `docs/reports/auditoria-visual/PARTE_3_NUCLEO_TRANSACIONAL_E_CARTOES.md` |
| **Parte 4** | **Orçamentos, Dívidas, Financiamentos & Metas** | `src/features/budgets/*`, `src/features/debts/*`, `src/features/goals/*` | `docs/reports/auditoria-visual/PARTE_4_ORCAMENTOS_DIVIDAS_E_METAS.md` |
| **Parte 5** | **Inteligência Patrimonial, Aportes & Relatórios** | `src/features/investments/*`, `src/features/reports/*` | `docs/reports/auditoria-visual/PARTE_5_PATRIMONIO_APORTES_E_RELATORIOS.md` |
| **Parte 6** | **Visão Geral (Home / Dashboard), Insights & Tools** | `src/features/overview/*`, `src/features/insights/*`, `src/features/tools/*` | `docs/reports/auditoria-visual/PARTE_6_HOME_DASHBOARD_E_INSIGHTS.md` |
| **Parte 7** | **Colaboração, Cascas Externas, Admin & Onboarding** | `family`, `trips`, `public-share`, `settings`, `admin`, `landing`, `auth` | `docs/reports/auditoria-visual/PARTE_7_COLABORACAO_ADMIN_AUTH_E_LANDING.md` |

---

## 5. PROTOCOLO DE VARREDURA AUTOMATIZADA DE CADA PARTE

Cada uma das 7 partes da auditoria executará um script automatizado de heurísticas com comandos específicos para identificar anomalias antes da análise visual humana:

```bash
# 1. Rastrear ModalFooter aninhado no children
python3 -c '...detect_nested_modal_footers...'

# 2. Rastrear classes max-w-* em modais
grep -rn "className=" <pasta> | grep -E "max-w-"

# 3. Rastrear overflow-y-auto em componentes que vivem dentro de modais
grep -rn "overflow-y-auto" <pasta>

# 4. Rastrear invasão de text-primary / bg-primary em dados financeiros
grep -rnE "text-primary|bg-primary" <pasta>

# 5. Rastrear cores hexadecimais ou utilitários hardcoded de cor
grep -rnE "(text|bg)-(slate|zinc|gray|blue|emerald|amber|rose)-[0-9]{2,3}" <pasta>

# 6. Rastrear truncate em valores monetários e financeiros
grep -rn "truncate" <pasta> | grep -iE "cents|money|format|saldo|total|r\$"

# 7. Rastrear chamadas de formatação monetária sem tabular-nums / MoneyText
python3 -c '...detect_unformatted_currency...'

# 8. Rastrear z-index soltos fora dos tokens
grep -rnE "\bz-[0-9]{2,3}\b|\bz-\[[^\]]+\]" <pasta>

# 9. Rastrear botões sem shrink-0 ao lado de textos em flex
grep -rn "<[A-Z][a-zA-Z]* className=" <pasta> | grep -v "shrink-0"

# 10. Rastrear arquivos com mais de 250 linhas
find <pasta> -type f -name "*.tsx" -exec wc -l {} + | awk '$1 > 250'
```

---

## 6. MODELO OFICIAL DO RELATÓRIO DE CADA PARTE

Cada relatório técnico em `docs/reports/auditoria-visual/` seguirá rigorosamente a seguinte estrutura analítica:

```markdown
# RELATÓRIO DE AUDITORIA TÉCNICA — PARTE [X]: [NOME DO DOMÍNIO]

## 1. SUMÁRIO EXECUTIVO DA PARTE
- Total de Arquivos Inspecionados: [Qtd]
- Total de Inconformidades Catalogadas: [Qtd]
- Distribuição por Severidade: [Crítica: X | Alta: Y | Média: Z | Baixa: W]
- Índice de Conformidade com o Design System: [X%]

## 2. INVENTÁRIO COMPLETO DE ANOMALIAS
| # | Arquivo e Linha | Componente Afetado | Dimensão Violada | Descrição da Incongruência | Ação de Correção Recomendada | Severidade |
|---|---|---|---|---|---|---|
| 1 | `caminho/arquivo.tsx#L42` | `NomeComponente` | Dimensão X | Descrição do problema visual/técnico | Código sugerido de refatoração | Alta |

## 3. DIAGNÓSTICO DOS PONTOS CRÍTICOS
(Análise aprofundada de quebras de layout, cortes no mobile, conflitos de cor e acessibilidade)

## 4. MAPA DE COMPONENTES A DECOMPOSTOS & CÓDIGO MORTO IDENTIFICADO
- Arquivos com > 250 linhas sugeridos para quebra atômica.
- Componentes, variantes ou estilos não utilizados identificados para deleção.

## 5. TESTES CRUZADOS DE TEMAS & RESOLUÇÕES
- Validação em Light, Dark, OLED, data-accent="rose" e data-accent="mono".
- Validação em Mobile (360px, 390px), Tablet (768px) e Desktop (1280px+).
```

---

## 7. O PLANO FINAL: CONSOLIDAÇÃO NO PLANO MESTRE DE EXECUÇÃO

Concluídas as 7 partes da auditoria e emitidos todos os 7 relatórios em `docs/reports/auditoria-visual/`, criaremos o documento executivo:

`docs/plans/PLANO_MESTRE_REFATORACAO_E_PADRONIZACAO_VISUAL.md`

Este documento integrará todas as correções catalogadas, organizadas em **4 Ondas de Refatoração Segura**:
- **Onda 1:** Ajustes na Fundação, Tokens e Primitivos Canônicos (`<Modal />`, `<Button />`, `<MoneyText />`).
- **Onda 2:** Refatoração do Núcleo Transacional e Cartões de Crédito.
- **Onda 3:** Refatoração de Patrimônio, Aportes, Metas e Relatórios A4.
- **Onda 4:** Refatoração de Home, Módulos Colaborativos, Cascas Externas e Limpeza de Código Morto.

Cada onda conterá passos atômicos, validação com `npm run verify` e testes de regressão visual, garantindo execução tranquila e 100% livre de quebras para o usuário final.
