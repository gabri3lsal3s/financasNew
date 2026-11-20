# PLANO MESTRE DE AUDITORIA VISUAL, UI/UX E PADRONIZAÇÃO ARQUITETURAL

> **Documento Canônico de Governança, Engenharia de Design System e Auditoria de Interface**  
> **Status:** Ativo / Fase 0 Aprovada e Consolidada  
> **Arquivo:** `docs/plans/PLANO_MESTRE_AUDITORIA_VISUAL_UX_E_PADRONIZACAO.md`  
> **Escopo:** 100% da camada de interface do Axir (`src/styles/`, `src/components/`, `src/features/`, `src/pages/`, `src/app/`)  
> **Diretório de Relatórios Fragmentados:** `docs/reports/auditoria-visual/`  
> **Meta Final:** Emissão de 7 Relatórios Técnicos + Plano Mestre de Refatoração e Padronização Visual

---

## 1. VISÃO GERAL & OBJETIVOS ESTRATÉGICOS

Este Plano Mestre rege a auditoria técnica mais abrangente já realizada no **Axir**. Seu propósito é transformar a interface do produto em um padrão de referência de classe mundial em finanças pessoais e inteligência patrimonial, eliminando desvios ergonômicos, assimetrias visuais, poluição cognitiva e códigos duplicados.

### Os 5 Pilares de Excelência Deste Plano:
1. **Padronização Visual Absoluta:** Unificar alturas, superfícies, sombras, raios de borda, tipografia e espaçamentos em uma régua rítmica coesa.
2. **Componentização Atômica & Princípio DRY Estrito:** Garantir que elementos repetidos 2+ vezes sejam extraídos para componentes reutilizáveis, pequenos (teto de 150 a 250 linhas) e altamente especializados, permitindo manutenções rápidas na raiz sem duplicar JSX.
3. **Ergonomia Móvel e Conforto de Uso:** Erradicar o "efeito visor estreito" (*viewport squeeze*), cortes secos de cabeçalhos, botões que rolam fora do alcance, desalinhamentos em grids (*staircase effect*) e conflitos com o teclado virtual e a safe area do iOS.
4. **Governança de Temas e Integridade Cromática:** Blindar o sistema contra aberrações cromáticas em todas as 18 combinações de temas (`light`, `dark`, `oled`) e acentos (`teal`, `gold`, `sapphire`, `violet`, `rose`, `mono`), garantindo que cores semânticas financeiras (receita, despesa, aporte) jamais sejam confundidas com a cor de destaque da marca.
5. **Expurgo de Código Morto e Arquivos Órfãos:** Mapear e eliminar componentes zumbis, variantes não utilizadas, estilos CSS obsoletos e redundâncias arquiteturais.

---

## 2. FASE 0: CONSOLIDAÇÃO CANÔNICA DAS REGRAS DE DESIGN & UI/UX

Todas as regras descritas no `AGENTS.md`, `DESIGN_RULES.md` e `DESIGN_SYSTEM.md` foram unificadas e enriquecidas com critérios geométricos avançados. A auditoria fragmentada utilizará as **14 Dimensões de Avaliação Técnica** a seguir como régua inflexível:

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

### 2.1 Detalhamento Operacional das Regras por Dimensão

#### Dimensão 01: Governança de Modais e Drawers
- **Primitivo Único Obrigatório:** Todo modal ou gaveta do sistema utiliza o primitivo canônico `src/components/ui/modal.tsx` (ou o alias `ResponsiveDialog`). É proibido recriar drawers ou modais usando `fixed inset-0` manuais (caso de `LandingMobileDrawer` e `AdminMobileDrawer`, que devem ser convertidos ou padronizados).
- **Rodapé Canônico Fixado (Pinned Footer):** Botões de ação do rodapé devem ser passados **exclusivamente via prop `footer`** (ou `destructiveAction`). É terminantemente proibido colocar `<ModalFooter>` como filho direto dentro do `children`, prevenindo que os botões rolem com o conteúdo no mobile.
- **Isolamento Estrito de Scroll (Regra 26):** Proibido adicionar classes de rolagem (`overflow-y-auto`, `overflow-y-scroll`, `max-h-[*vh]`) dentro do `children`. Toda rolagem vertical pertence unicamente ao contêiner interno gerenciado pelo modal.
- **Tamanhos Canônicos:** Definição de largura feita estritamente pela prop `size` (`sm` = 448px, `md` = 512px, `lg` = 672px, `xl` = 896px, `2xl` = 1024-1152px, `3xl` = 1280px). Proibido injetar `max-w-*` arbitrários em `className`.

#### Dimensão 02: Matriz de Temas e Cor de Destaque
- **Papel da Cor de Destaque (`--primary` / `--primary-strong`):** A cor de destaque alterável pelo usuário (`data-accent`) é reservada para **ações interativas do usuário** (botões CTA primários, links, tabs ativas, foco `ring-ring`, checkboxes e radios checados, chips selecionados).
- **Proibição em Semânticas Financeiras:** Proibido utilizar `text-primary`, `bg-primary` ou `border-primary` para representar valores monetários de saldo positivo, receitas, lucros ou aportes. Valores financeiros usam estritamente tokens semânticos imutáveis: `--positive` (receita/saldo), `--negative` (despesa), `--warning` (atenção/limite), `--critical` (atraso/estouro), `--portfolio` (investimentos).
- **Papel do Token Ouro (`--accent`):** Fixo em Ouro Âmbar (`#DDA726`), reservado para brilho de KPIs (`shadow-kpi`), anel da marca Axir e badges de planos Pro/VIP.
- **Neutralidade de Ícones Estáticos (Regra 13):** Ícones descritivos estáticos em cabeçalhos de cards e seções usam obrigatoriamente tom neutro suave (`text-muted-foreground`), sendo proibido aplicar `text-primary` arbitrariamente.

#### Dimensão 03: Tipografia, Truncamento e Números
- **Zero Reticências em Dinheiro (Regra 11):** Valores monetários e taxas percentuais nunca podem ser cortados com `truncate` ou `text-ellipsis`. Devem utilizar `<MoneyText />` ou auto-fit com `tabular-nums tracking-tight whitespace-nowrap`.
- **Quebra Controlada em Títulos (Regra 23):** Títulos de cartões, contas e transações utilizam `line-clamp-2 break-words` com largura mínima garantida no contêiner (`min-w-0`), prevenindo palavras amassadas ou quebras de uma única letra.
- **Auto-fit de Badges:** Badges com texto longo utilizam `max-w-full truncate inline-block` com `title` acessível.

#### Dimensão 04: Alinhamento em Grids e Fim do "Efeito Escada"
- **Casca Flexível Total:** Todo card dentro de CSS Grid (`grid-cols-*`) adota `h-full flex flex-col`.
- **Miolo Expansível (`flex-1`):** A seção intermediária do card recebe `flex-1`, empurrando botões de ação e rodapés para a base (`mt-auto`), alinhando perfeitamente todos os botões de uma mesma fileira horizontal.
- **Reserva de Altura de Título:** Cabeçalhos de cards vizinhos adotam altura mínima padronizada (`min-h-[2.75rem]` ou similar), impedindo que títulos com 2 linhas desloquem para baixo o valor monetário principal.

#### Dimensão 05: Invariância de Altura de Controles
- **Escala de Alturas de Controles:**
  - `sm`: `h-8` (32px) para tabelas densas e barras secundárias.
  - `default`: `h-10` (40px) para formulários regulares, inputs, selects e botões.
  - `lg`: `h-11` a `h-12` (44px a 48px) para wizards e formulários móveis rápidos.
- **Proibição de Mistura:** Controles que dividem a mesma linha horizontal (`flex items-center gap-2`) devem compartilhar a mesma classe de altura.
- **Touch Target Mínimo:** Área tátil de no mínimo $44 \times 44\text{px}$ no mobile (compensada via padding ou pseudo-elemento).

#### Dimensão 06: Alinhamento Numérico em Tabelas
- **Regra Sagrada do `text-right`:** Valores monetários, percentuais e contadores numéricos em tabelas e listas devem ser rigorosamente alinhados à direita (`text-right`), acompanhados de seus respectivos cabeçalhos (`th` também em `text-right`).
- **Algarismos Mono-espaçados:** Obrigatório o uso de `tabular-nums` ou classe `.num` em todas as colunas de dados para alinhamento perfeito de vírgulas e centavos na vertical.

#### Dimensão 07: Alinhamento Óptico de Ícones
- **`shrink-0` Obrigatório:** Todo ícone inline em contêiner flex deve possuir `shrink-0` para impedir deformação elíptica.
- **Pareamento Escalar:** Ícone `size-3.5` para `text-xs`, `size-4` para `text-sm`, `size-4.5` a `size-5` para `text-base` e títulos.
- **Centralização Vertical:** `flex items-center` com compensação de linha de base (`leading-none` no texto quando necessário).

#### Dimensão 08: Hierarquia de Superfícies em 3 Camadas (L0/L1/L2)
- **L0 (Fundo):** `bg-background` sem bordas.
- **L1 (Cards Primários):** `bg-surface border border-border/80 rounded-2xl shadow-xs`.
- **L2 (Agrupamentos Internos / Modais):** `bg-surface-raised border border-border/60 rounded-xl` sem sombra.
- **Proibição de Bordas Duplas:** Tabelas ou listas inseridas em cards L1 não devem ter borda externa adicional; usam apenas divisores sutis (`divide-y divide-border/60`).

#### Dimensão 09: Sobriedade Visual e Calma Cognitiva
- **Teto de 1 Badge por Card:** Máximo de 1 badge de status por card de métrica.
- **1 CTA Sólido por Tela:** Apenas um botão com preenchimento sólido primário (`variant="default"`) visível por viewport; ações secundárias adotam `variant="outline"` ou `variant="ghost"`.
- **Zero Cópias Redundantes:** Remoção de subtítulos que apenas repetem o título do campo.

#### Dimensão 10: Responsividade e Viewport
- **Contenção 100vw:** `html` e `body` com `overflow-x: clip`. Breakpoint de menus horizontais em `lg:` (1024px), mantendo gaveta compacta no tablet (`md:`).
- **Abas Fluidas (Regra 9):** Abas com $\ge 4$ itens usam `shrink-0 min-w-fit px-3` com rolagem horizontal suave (`no-scrollbar`).
- **Grids Adaptativos (Regra 10):** Grids de métricas iniciam em `grid-cols-1` ou `grid-cols-2` no mobile, nunca `grid-cols-3` rígido.

#### Dimensão 11: Ergonomia Mobile, Safe Areas e Teclado
- **Zona de Exclusão Inferior (Regra 27):** Contêiner rolável de páginas com `pb-28 sm:pb-32` para não sobrepor o `BackToTop` ou a `BottomNav`.
- **Prevenção de Zoom no iOS:** Inputs de texto com fonte mínima de 16px no mobile (`text-base sm:text-sm`).
- **Zero `autoFocus` (Regra 20):** Proibido `autoFocus` declarativo em formulários para evitar saltos de tela e abertura intrusiva de teclado.

#### Dimensão 12: Hierarquia de Z-Index
- Aderência estrita à régua: Base (10) → Dropdown/Sticky (20) → BottomNav (30) → Sidebar (40) → Modal (50) → Floating Tools (60) → Toast (70). Proibição de classes soltas (`z-30`, `z-40`, `z-50`, `z-[999]`).

#### Dimensão 13: Governança Sensorial e Feedback
- Gateway único centralizado: todo feedback tátil passa por `triggerSensory` de `src/services/sensory.ts`. Proibido chamar `triggerHaptic` diretamente no `onClick` de botões (evitando duplo disparo). Respeito estrito a `data-motion="reduced"` e `data-motion="eco"`.

#### Dimensão 14: Componentização Atômica & Código Morto (DRY)
- **Teto de Linhas por Arquivo:** Componentes de interface devem manter teto saudável entre **150 e 250 linhas**. Arquivos que ultrapassam esse limite devem ser decompostos em subcomponentes atômicos e colocalizados em subpastas dedicadas da feature (ex.: `features/cards/components/parts/`).
- **Princípio DRY Absoluto:** Todo padrão visual ou marcação JSX repetida em 2 ou mais locais deve ser extraído para `components/ui/` (primitivo) ou `components/modules/` (domínio).
- **Mapeamento de Código Morto:** Rastreamento sistemático de componentes não importados, variantes zumbis e utilitários obsoletos para remoção no Plano de Execução.

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

## 5. MODELO OFICIAL DO RELATÓRIO DE CADA PARTE

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

## 6. O PLANO FINAL: CONSOLIDAÇÃO NO PLANO MESTRE DE EXECUÇÃO

Concluídas as 7 partes da auditoria e emitidos todos os 7 relatórios em `docs/reports/auditoria-visual/`, criaremos o documento executivo:

`docs/plans/PLANO_MESTRE_REFATORACAO_E_PADRONIZACAO_VISUAL.md`

Este documento integrará todas as correções catalogadas, organizadas em **4 Ondas de Refatoração Segura**:
- **Onda 1:** Ajustes na Fundação, Tokens e Primitivos Canônicos (`<Modal />`, `<Button />`, `<MoneyText />`).
- **Onda 2:** Refatoração do Núcleo Transacional e Cartões de Crédito.
- **Onda 3:** Refatoração de Patrimônio, Aportes, Metas e Relatórios A4.
- **Onda 4:** Refatoração de Home, Módulos Colaborativos, Cascas Externas e Limpeza de Código Morto.

Cada onda conterá passos atômicos, validação com `npm run verify` e testes de regressão visual, garantindo execução tranquila e 100% livre de quebras para o usuário final.
