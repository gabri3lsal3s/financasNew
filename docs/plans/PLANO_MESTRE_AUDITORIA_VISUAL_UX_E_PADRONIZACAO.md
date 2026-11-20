# PLANO MESTRE DE AUDITORIA VISUAL, UI/UX E PADRONIZAÇÃO ARQUITETURAL

> **Documento Canônico de Governança, Engenharia de Design System e Auditoria de Interface**  
> **Status:** Ativo / Fase 0 Concluída, Blindada e 100% Validada  
> **Versão:** 7.0 (Tratado Operacional Completo: 20 Dimensões Canônicas + 9 Partes Balanceadas + Ciclo de Vida dos Relatórios)  
> **Arquivo:** `docs/plans/PLANO_MESTRE_AUDITORIA_VISUAL_UX_E_PADRONIZACAO.md`  
> **Escopo:** 100% da camada de interface do Axir (Todas as 22 Features, 35+ Rotas, 860+ Arquivos)  
> **Diretório Oficial de Relatórios:** `docs/reports/auditoria-visual/`  
> **Meta Final:** Emissão de 9 Relatórios Fragmentados + Plano Mestre de Implementação e Correção

---

## 1. VISÃO GERAL & OBJETIVOS ESTRATÉGICOS

Este Plano Mestre rege a auditoria técnica mais abrangente já executada no **Axir**. Seu propósito é transformar a interface do produto em um padrão de referência de classe mundial em finanças pessoais e inteligência patrimonial, eliminando desvios ergonômicos, assimetrias visuais, poluição cognitiva e códigos duplicados.

### Os 5 Pilares Estratégicos:
1. **Padronização Visual Absoluta:** Unificar alturas, superfícies, sombras, raios de borda, tipografia e espaçamentos em uma régua rítmica coesa baseada em tokens.
2. **Matriz Oficial da Cor de Destaque & Pirâmide de Botões:** Definir com precisão matemática quais elementos herdam e quais são proibidos de herdar o acento customizável do usuário, e estruturar a hierarquia de botões em 5 níveis de peso visual.
3. **Componentização Atômica & Princípio DRY Estrito:** Garantir que elementos repetidos 2+ vezes sejam extraídos para componentes reutilizáveis, pequenos (teto de 150 a 250 linhas) e altamente especializados, permitindo manutenções rápidas na raiz sem duplicar JSX.
4. **Ergonomia Móvel e Conforto de Uso:** Erradicar o "efeito visor estreito" (*viewport squeeze*), cortes secos de cabeçalhos, botões que rolam fora do alcance, desalinhamentos em grids (*staircase effect*) e conflitos com o teclado virtual e a safe area do iOS.
5. **Acessibilidade, Privacidade e Desempenho 60/120fps:** Garantir conformidade WCAG AA (foco visível unificado, botões de ícone com descrição acessível), blindagem do escudo de privacidade contra vazamento de dados e animações leves (*zero layout reflow*).

---

## 2. MATRIZ OFICIAL DE HERANÇA DA COR DE DESTAQUE (`primary` / `data-accent`)

O Axir permite ao usuário escolher sua cor de destaque preferida nas Configurações de Aparência (`data-accent="teal|gold|sapphire|violet|rose|mono"`). Essa seleção muta dinamicamente as variáveis `--primary`, `--primary-strong` e `--ring`. 

Para garantir congruência e evitar aberrações cromáticas (ex.: receitas ficarem vermelhas quando o acento for `rose`, ou o botão de fechar sumir em `mono`), estabelecemos a **Matriz Oficial de Herança**:

```
┌────────────────────────────────────────────────────────────────────────┐
│              MATRIZ DE HERANÇA DA COR DE DESTAQUE (ACCENT)             │
├────────────────────────────────────────────────────────────────────────┤
│ ONDE É OBRIGATÓRIO HERDAR A COR DE DESTAQUE                            │
│  1. Botão CTA Primário Sólido (`variant="solid"`): bg-primary-strong   │
│  2. Botão de Destaque Secundário (`variant="default"`): bg-primary/10  │
│  3. Links interativos e âncoras de ação rápida (text-primary-strong)   │
│  4. Aba ativa (Tabs): borda inferior border-primary ou bg-primary/15   │
│  5. Item ativo na navegação lateral (Sidebar) e móvel (BottomNav)      │
│  6. Controles checados/ativos: Switch, Checkbox, RadioGroup            │
│  7. Chips de filtro ativos e ChoiceCard selecionado                    │
│  8. Anel de foco acessível (:focus-visible:ring-ring)                  │
│  9. Borda ativa de campos em digitação (focus:border-primary)          │
│ 10. Alça deslizante (pill handle) no topo de modais mobile             │
│ 11. Círculo do passo ativo em Steppers e Wizards                       │
├────────────────────────────────────────────────────────────────────────┤
│ ONDE É EXPRESSAMENTE PROIBIDO HERDAR A COR DE DESTAQUE                 │
│  1. Dados e Valores Monetários Financeiros:                            │
│     - Receitas / Saldo Positivo: SEMPRE token fixo --positive (Teal)   │
│     - Despesas / Saldo Negativo: SEMPRE token fixo --negative (Coral)  │
│     - Metas / Atenção / Prazos: SEMPRE token fixo --warning (Âmbar)    │
│     - Inadimplência / Estouro: SEMPRE token fixo --critical (Vermelho) │
│     - Investimentos / Aportes: SEMPRE token fixo --portfolio (Azul)    │
│  2. Badges de Status Financeiro:                                       │
│     - Pago (positive), Aberto (muted), Atrasado (critical)             │
│     - PROIBIDO usar variant="default" (accent) em status financeiro    │
│  3. Ícones Descritivos Estáticos (Regra 13 Nível 1):                   │
│     - Ícones em cabeçalhos de cards comuns usam text-muted-foreground  │
│  4. Superfícies e Fundos de Tela:                                      │
│     - Fundo é sempre --surface ou --background (nunca bg-primary)      │
│  5. Paleta de Categorias de Orçamento (--cat-1 a --cat-10)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. PIRÂMIDE DE HIERARQUIA VISUAL E PADRONIZAÇÃO DE BOTÕES (`<Button />`)

Padronizamos o uso de botões em uma pirâmide rigorosa de 5 níveis de peso visual, eliminando disputas óticas e hesitação do usuário:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PIRÂMIDE DE HIERARQUIA VISUAL DE BOTÕES              │
├────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 1: CTA Primário Sólido (`variant="solid"`)                       │
│          - bg-primary-strong text-primary-foreground                   │
│          - Teto estrito: 1 único botão por viewport                    │
│          - Papel: Concluir, Salvar, Confirmar Aporte, Finalizar        │
│                                                                        │
│ NÍVEL 2: Destaque Secundário Tinted (`variant="default"`)              │
│          - bg-primary/10 border-primary/25 text-primary-strong         │
│          - Papel: Ações contextuais de destaque secundário na tela     │
│                                                                        │
│ NÍVEL 3: Neutro Estrutural (`variant="outline"`)                       │
│          - border-border bg-surface text-foreground                    │
│          - Papel: Cancelar, Voltar, Exportar, Fechar secundário        │
│                                                                        │
│ NÍVEL 4: Baixo Peso / Minimalista (`variant="ghost"`)                  │
│          - 100% transparente com hover suave text-foreground           │
│          - Papel: Botão fechar (X), ações em linhas de tabela, abas    │
│                                                                        │
│ NÍVEL 5: Ação Destrutiva Isolada (`variant="destructive"`)             │
│          - bg-critical/10 border-critical/40 text-critical-strong      │
│          - Papel: Excluir, Deletar, Resetar, Desvincular               │
└────────────────────────────────────────────────────────────────────────┘
```

### Regras de Combinação e Ergonomia de Rodapés:
1. **Em Diálogos e Modais de Formulário:**
   - Desktop: Cancelar (`variant="outline"`) à esquerda, Salvar/Confirmar (`variant="solid"`) à direita (`sm:justify-end`).
   - Mobile: Par de 2 botões em grid simétrico `grid grid-cols-2 gap-2` (Cancelar à esquerda, Confirmar à direita).
2. **Em Modais com Ação Destrutiva (prop `destructiveAction`):**
   - Desktop: Excluir (`variant="destructive"`) alinhado à extrema esquerda (`mr-auto`), Cancelar (`variant="outline"`) e Salvar (`variant="solid"`) à direita.
   - Mobile: Cancelar e Salvar no grid horizontal superior, e Excluir isolado abaixo (`order-last w-full mt-2`), prevenindo toques acidentais e colunas desiguais.
3. **Proibição de Disputa Primária:** É proibido renderizar dois botões `variant="solid"` na mesma seção. Apenas uma ação deve ser o foco primário.

---

## 4. CONSOLIDAÇÃO CANÔNICA DAS 20 DIMENSÕES DE AUDITORIA

Avaliamos e adicionamos apenas regras leves, de alto retorno e zero sobrecarga de engenharia. A régua de avaliação passa a contar com **20 Dimensões Canônicas**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   AS 20 DIMENSÕES TÉCNICAS DA AUDITORIA                │
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
│ 15. Acessibilidade A11y, Foco Visível Canônico e Botões de Ícone       │
│ 16. Estados Tríplices (Loading, Error, Empty) & Defesa de Forms        │
│ 17. Semáforo Cognitivo Padronizado em Badges de Status                 │
│ 18. Feedback de Cópia (Clipboard Micro-UX) & Zero CLS em Imagens       │
│ 19. Blindagem do Escudo de Privacidade (Zero Vazamento em .num)        │
│ 20. Anatomia de Navegação Temporal (Mês / Ano / Período)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4.1 Detalhamento Operacional das 20 Dimensões

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

#### Dimensão 15: Acessibilidade A11y, Foco Visível Canônico e Botões de Ícone
- **Anel de Foco Unificado (WCAG 2.4.7):** Todo elemento focável utiliza obrigatoriamente `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`. É proibido aplicar cores arbitrárias de ring (`ring-primary/40`, `ring-positive/30`).
- **Botões de Ícone com Descrição Acessível Obrigatória:** Todo `<Button size="icon">` deve conter obrigatoriamente `aria-label="..."` e `title="..."`, ou um nó filho `<span className="sr-only">...</span>`. Ícones decorativos em botões com texto devem possuir `aria-hidden="true"`.
- **Régua de Contraste Tipográfico:** Textos secundários devem atingir no mínimo relação de contraste de 4.5:1 (WCAG AA).

#### Dimensão 16: Estados Tríplices (Loading, Error, Empty) & Defesa de Forms
- **Telas e Cards com 3 Estados Obrigatórios:** Loading com skeleton espelhado (Zero CLS), ErrorState canônico com retry, EmptyState calmo.
- **Defesa contra Descarte Acidental em Formulários:** Formulários densos em modais ($\ge 3$ campos) com dados preenchidos (`isDirty`) devem prevenir fechamento acidental por clique externo no backdrop (`onPointerDownOutside={(e) => e.preventDefault()}`).
- **Performance de Animações (Zero Layout Reflow):** Transições interativas devem utilizar propriedades aceleradas por GPU (`transform`, `opacity`), evitando `transition-[width,height,margin]`.

#### Dimensão 17: Semáforo Cognitivo Padronizado em Badges de Status
- **Pago / Concluído / Positivo:** `variant="positive"` (`bg-positive/12 text-positive-strong`).
- **Atenção / Próximo / Prazo Curto:** `variant="warning"` (`bg-warning/15 text-warning-strong`).
- **Atrasado / Excedido / Rejeitado:** `variant="critical"` (`bg-critical/12 text-critical-strong`).
- **Neutro / Aberto / Pendente:** `variant="muted"` (`bg-muted text-muted-foreground`).
- **Proibição Expressa:** Nunca utilizar `variant="default"` (que herda a cor de destaque da marca) para status financeiro.

#### Dimensão 18: Feedback de Cópia (Clipboard Micro-UX) & Zero CLS em Imagens
- **Micro-feedback de Cópia:** Todo botão de cópia deve alternar temporariamente o ícone de `Copy` para `Check` por 1.8 segundos com micro-feedback tátil `sensory.selection()`.
- **Zero CLS em Imagens e Avatares:** Bandeiras de cartão, logos e avatares assíncronos possuem dimensões geométricas pré-reservadas (`size-7`, `size-8`, etc.) com contêiner neutro para evitar saltos visuais.
- **Alívio de Filtros CSS no Mobile (60fps Lisos):** Barras fixas e modais móveis adotam teto de `backdrop-blur-xs` ou `backdrop-blur-sm` (4px a 8px) com alta opacidade (`bg-surface/95`), eliminando superaquecimento ou dreno de bateria.

#### Dimensão 19: Blindagem do Escudo de Privacidade (Zero Vazamento em .num)
- **Princípio da Proteção Ativa:** O modo privacidade ofusca valores através do seletor CSS `html[data-privacy="masked"] .num, html[data-privacy="masked"] .privacy-mask`.
- **Proibição de Strings Financeiras Cruas:** É expressamente proibido renderizar valores monetários ou patrimoniais como strings literais sem o componente `<MoneyText />` ou sem a classe `.num`. Qualquer número monetário sem essa proteção vaza dados visíveis mesmo quando o usuário ativa o Modo Privacidade em locais públicos.

#### Dimensão 20: Anatomia Canônica de Navegação Temporal (Mês / Ano / Período)
- **Seletor de Competência Padronizado:** Seletores de mês (`MonthPicker`) e ano (`YearPicker`) devem utilizar navegação simétrica com botões de ícone compactos (`size="sm"`), setas `ChevronLeft` e `ChevronRight` de traço único, label centralizado legível em caixa alta discreta e atalho para o mês vigente ("Mês Atual"), sem o uso de controles `<select>` nativos.
- **Datas em Timezone Local (Regra AGENTS.md §5):** Proibido utilizar `toISOString()` para manipulação ou exibição de datas de competência, prevenindo deslocamento indevido de fuso horário UTC (bug do dia anterior).

---

### 4.2 Matriz Canônica de Raio de Borda (Border Radius)

| Nível Arquitetural | Token / Classe | Valor Pixels | Onde Deve Ser Aplicado | Proibições Expressas |
|---|---|---|---|---|
| **App Shell & Modais** | `rounded-2xl` | 20px / 1.25rem | Diálogos centralizados desktop, topo do Bottom Sheet mobile, banners herói de topo | Proibido usar `rounded-lg` em modais ou `rounded-3xl` arbitrário |
| **Cards de Dados (L1)** | `rounded-2xl` | 16px–20px | Cards de métricas, cards de fatura, cards de ativos, contêiner de tabelas | Proibido misturar `rounded-xl` e `rounded-2xl` na mesma fileira de cards |
| **Sub-blocos & Insets (L2)** | `rounded-xl` | 12px / 0.75rem | Agrupamentos internos de formulários, cards de parcelas dentro de modal | Proibido aplicar `rounded-2xl` dentro de cards que já são `rounded-2xl` |
| **Controles & Inputs** | `rounded-lg` | 8px / 0.5rem | Inputs, MoneyInput, Select, botões, DatePicker | Proibido inputs com borda 100% redonda (pill) ou cantos retos (0px) |
| **Badges & Tags** | `rounded-pill` / `rounded-full` | 999px | Badges de status, chips de seleção, avatares, pílulas de navegação | Proibido badges retangulares sem raio |

---

## 5. O CRONOGRAMA REBALANCEADO DAS 9 PARTES DA AUDITORIA

Com a separação equilibrada, todas as partes possuem carga homogênea de arquivos e foco claro:

| Parte | Domínio de Auditoria | Features e Escopo Auditado | Relatório Gerado |
|---|---|---|---|
| **Parte 1** | **Fundação, Tokens, Primitivos de UI e App Shell** | `src/styles/*`, `src/components/ui/*`, `src/components/layout/*`, `src/app/app-lock-overlay.tsx` | `docs/reports/auditoria-visual/PARTE_1_FUNDACAO_TOKENS_PRIMITIVOS_E_SHELL.md` |
| **Parte 2** | **Módulos Compartilhados de Domínio e Gráficos SVG** | `src/components/modules/*`, motores SVG em `src/domain/charts/` | `docs/reports/auditoria-visual/PARTE_2_MODULOS_COMPARTILHADOS_E_GRAFICOS.md` |
| **Parte 3** | **Núcleo Transacional & Cartões de Crédito** | `src/features/transactions/*` (incluindo `share-target-page`), `src/features/cards/*` | `docs/reports/auditoria-visual/PARTE_3_NUCLEO_TRANSACIONAL_E_CARTOES.md` |
| **Parte 4** | **Orçamentos, Dívidas, Financiamentos, Metas e Lembretes** | `src/features/budgets/*`, `src/features/debts/*`, `src/features/goals/*`, `src/features/reminders/*` | `docs/reports/auditoria-visual/PARTE_4_ORCAMENTOS_DIVIDAS_E_METAS.md` |
| **Parte 5** | **Inteligência Patrimonial, Aportes & Relatórios** | `src/features/investments/*`, `src/features/reports/*` (incluindo Tear Sheet e exportação A4) | `docs/reports/auditoria-visual/PARTE_5_PATRIMONIO_APORTES_E_RELATORIOS.md` |
| **Parte 6** | **Visão Geral (Home / Dashboard), Insights & Tools** | `src/features/overview/*`, `src/features/insights/*`, `src/features/tools/*` (simuladores abertos) | `docs/reports/auditoria-visual/PARTE_6_HOME_DASHBOARD_E_INSIGHTS.md` |
| **Parte 7** | **Módulos Colaborativos & Links Públicos Compartilhados** | `src/features/family/*`, `src/features/trips/*`, `src/features/public-share/*` | `docs/reports/auditoria-visual/PARTE_7_MODULOS_COLABORATIVOS_E_PUBLICOS.md` |
| **Parte 8** | **Configurações, Faturamento (Asaas) e Onboarding** | `src/features/settings/*`, `src/features/subscription/*`, `src/features/onboarding/*`, `src/features/demo-tour/*` | `docs/reports/auditoria-visual/PARTE_8_CONFIGURACOES_ASSINATURAS_E_ONBOARDING.md` |
| **Parte 9** | **Casca Pública, Autenticação, Legal e Painel Admin** | `src/features/landing/*`, `src/features/auth/*`, `src/features/legal/*`, `src/features/admin/*` | `docs/reports/auditoria-visual/PARTE_9_LANDING_AUTH_LEGAL_E_ADMIN.md` |

---

## 6. PROTOCOLO OPERACIONAL & CICLO DE VIDA DE CADA PARTE

Para garantir execução cirúrgica, cada uma das 9 partes cumprirá rigorosamente o seguinte ciclo de vida em 4 passos:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CICLO DE VIDA OPERACIONAL DE CADA PARTE              │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Varredura Heurística Automatizada (Terminal / Scripts)              │
│    Execução dos 11 comandos de detecção de anomalias na pasta-alvo.    │
│                                                                        │
│ 2. Inspeção Manual Código a Código (Auditoria Humana Aprofundada)      │
│    Verificação de cada arquivo contra as 20 Dimensões Canônicas.       │
│                                                                        │
│ 3. Emissão do Relatório Técnico Fragmentado (.md)                      │
│    Gravação em docs/reports/auditoria-visual/PARTE_X_...md             │
│                                                                        │
│ 4. Apresentação Executiva & Portão de Bloqueio                         │
│    Apresentação do resumo ao usuário e parada obrigatória aguardando   │
│    aprovação formal antes de iniciar a próxima parte.                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Comandos de Varredura Automatizada da Parte:
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

# 8. Rastrear botões de ícone sem aria-label ou title
python3 -c '...detect_missing_icon_aria...'

# 9. Rastrear anéis de foco arbitrários (fora do ring-ring)
grep -rnE "focus-visible:ring-(primary|positive|warning|critical)" <pasta>

# 10. Rastrear z-index soltos fora dos tokens
grep -rnE "\bz-[0-9]{2,3}\b|\bz-\[[^\]]+\]" <pasta>

# 11. Rastrear arquivos com mais de 250 linhas
find <pasta> -type f -name "*.tsx" -exec wc -l {} + | awk '$1 > 250'
```

---

## 7. MODELO OFICIAL DO RELATÓRIO DE CADA PARTE

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

## 8. O PLANO FINAL: CONSOLIDAÇÃO NO PLANO MESTRE DE EXECUÇÃO

Concluídas as 9 partes da auditoria e emitidos todos os 9 relatórios em `docs/reports/auditoria-visual/`, criaremos o documento executivo:

`docs/plans/PLANO_MESTRE_REFATORACAO_E_PADRONIZACAO_VISUAL.md`

Este documento integrará todas as correções catalogadas, organizadas em **4 Ondas de Refatoração Segura**:
- **Onda 1:** Ajustes na Fundação, Tokens e Primitivos Canônicos (`<Modal />`, `<Button />`, `<MoneyText />`).
- **Onda 2:** Refatoração do Núcleo Transacional e Cartões de Crédito.
- **Onda 3:** Refatoração de Patrimônio, Aportes, Metas e Relatórios A4.
- **Onda 4:** Refatoração de Home, Módulos Colaborativos, Cascas Externas e Limpeza de Código Morto.

Cada onda conterá passos atômicos, validação com `npm run verify` e testes de regressão visual, garantindo execução tranquila e 100% livre de quebras para o usuário final.
