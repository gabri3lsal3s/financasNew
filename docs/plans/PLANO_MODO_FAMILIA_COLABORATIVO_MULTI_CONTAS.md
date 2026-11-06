# PLANO DE IMPLEMENTAÇÃO — MODO FAMÍLIA COLABORATIVO MULTI-CONTAS & HUB ANALÍTICO DEDICADO

> **Documento Canônico de Arquitetura, Engenharia de Dados e Governança de Software**  
> **Status:** Proposto / Consolidado, Otimizado e Pronto para Execução Futura · Quality Gates QG1–QG5 Definidos  
> **Módulos Afetados:** `supabase/migrations/`, `src/types/`, `src/domain/family/`, `src/data/repositories/`, `src/data/rpc.ts`, `src/state/`, `src/hooks/`, `src/features/family/`, `src/features/transactions/`, `src/features/settings/`, `src/components/layout/`, `docs/`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · Funções Puras no Domínio · Moeda em Centavos Inteiros (`FINANCIAL_MATH_SPEC.md`) · Zero Controles Nativos Crus · Zero Emojis (`local/no-decorative-unicode`) · Portões de Qualidade (QG) por Fase  
> **Data:** Novembro de 2026 · **Ambientes:** Web Desktop, Web PWA (iOS/Android) & Android Nativo (Capacitor Pro)  

---

## 1. SUMÁRIO EXECUTIVO & ARQUITETURA DE VALOR

Este plano estabelece a separação definitiva entre a **vida financeira pessoal** e o **orçamento compartilhado da casa**, criando um **Hub Familiar Dedicado (`/familia`)** e mantendo a página de Lançamentos (`/transacoes`) 100% individual, rápida e desobstruída.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      ECOSSISTEMA SEPARADO: PESSOAL vs. HUB FAMILIAR DEDICADO                      │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                  │
            ┌─────────────────────────────────────┴─────────────────────────────────────┐
            ▼                                                                           ▼
┌─────────────────────────────────────────┐                         ┌─────────────────────────────────────────┐
│     EXTRATO PESSOAL (/transacoes)       │                         │       HUB FAMILIAR DEDICADO (/familia)  │
│  - 100% dos lançamentos do indivíduo    │                         │  - Visível apenas quando ativado        │
│  - Saldo real que saiu do seu bolso     │                         │  - Teto da Casa & Orçamento Conjunto    │
│  - Zero mistura de despesas do parceiro │                         │  - Gráfico Comparativo: Quem Pagou Mais │
│  - Suas contas bancárias e cartões      │                         │  - Quem Recebeu Mais (Receitas da Casa) │
│  - Suas categorias pessoais             │                         │  - Ranking: Maiores e Menores Gastos    │
└─────────────────────────────────────────┘                         │  - Condensação Inteligente de Sinônimos │
                                                                    │    (ex: "Alimentação / Comida")         │
                                                                    │  - Compensação Justa via Pix em 1 Toque │
                                                                    └─────────────────────────────────────────┘
```

### Decisões Arquiteturais Fundamentais
1. **Extrato Pessoal 100% Individual (`/transacoes`):** Nenhuma despesa do parceiro aparece no extrato diário padrão. Lançamentos continuam sendo estritamente da conta do usuário logado.
2. **Página Dedicada `/familia` (Hub Familiar):** Uma rota autônoma e nobre, acessível pelo menu lateral e navegação móvel apenas quando o usuário possui uma família ativa configurada.
3. **Condensação Inteligente de Categorias (*Category Clustering*):** Motor analítico puro em `src/domain/family/category-clustering.ts` que agrupa variações de grafia e sinônimos (ex.: *"Alimentação"*, *"alimentação"* e *"Comida"* $\rightarrow$ *"Alimentação / Comida"*) nos gráficos da família, **sem alterar uma única vírgula nas categorias pessoais do banco**.
4. **Isolamento de Banco e Zero Clonagem:** Nenhuma categoria é criada ou copiada na conta do parceiro. O que a tela familiar exibe é uma projeção de leitura consolidada.

---

## 2. MATRIZ DE FRAGILIDADES, INCONGRUÊNCIAS & SALVAGUARDAS BLINDADAS

| # | Fragilidade Diagnosticada | Incongruência Potencial no App | Salvaguarda Blindada de Engenharia |
|---|---|---|---|
| **F1** | **Poluição do Extrato Pessoal (Data Bleed)** | Misturar despesas do parceiro no extrato principal geraria confusão sobre quanto o usuário realmente gastou do próprio saldo. | **Segregação Física de Telas:** `/transacoes` exibe exclusivamente lançamentos onde `user_id = auth.uid()`. A consolidação familiar reside 100% na página dedicada `/familia`. |
| **F2** | **Fragmentação de Categorias nos Gráficos da Família** | Usuário A usar "Mercado" e Usuário B usar "Supermercado", gerando duas barras separadas no gráfico da casa. | **Motor Puro de Normalização & Sinônimos (`category-clustering.ts`):** Normaliza caixa/acentos e agrupa sinônimos canônicos em buckets unificados (ex.: "Supermercado / Mercado"), consolidando os totais perfeitamente. |
| **F3** | **Category Blindness (Categorias Customizadas)** | O parceiro criar uma categoria e ela não existir no app do titular. | **Projeção Enriquecida via JOIN:** A RPC `get_family_consolidation` retorna `category_name`, `category_icon` e `category_color` no JSON de leitura, sem criar nada na tabela `categories` do parceiro. |
| **F4** | **Vazamento de Privacidade Bancária** | Expor detalhes de contas, agências bancárias ou nomes de cartões de crédito pessoais entre os parceiros. | **Sanitização de Projeção:** A RPC omite `account_id`, `card_id` e metadados bancários. Apenas *Descrição, Categoria, Data, Valor em centavos e Nome do autor* são trafegados. |
| **F5** | **Mutação Cruzada Destrutiva** | Um parceiro alterar ou excluir uma transação paga pelo outro. | **Imutabilidade Cruzada por RLS:** Políticas de `UPDATE` e `DELETE` no Postgres bloqueiam mutações onde `user_id != auth.uid()`. Se o parceiro abrir uma compra que não é sua, o modal renderiza em modo estritamente leitura. |
| **F6** | **Navegação Fantasma (Menu Poluído)** | Mostrar o item "Família" no menu para usuários solteiros ou que não usam o recurso. | **Visibilidade Condicional na Navegação:** O item `/familia` só é injetado em `navItems` se o usuário possuir o Modo Familiar ativo nas preferências ou fizer parte de uma família ativa. |
| **F7** | **Arredondamento de Centavos Ímpares** | Dividir R$ 100,01 entre 2 quebraria a precisão monetária de inteiros. | **Invariante Matemática de Desempate (`FINANCIAL_MATH_SPEC.md`):** O centavo residual é atribuído ao membro com maior valor pago ou ao titular: $\text{Parte}_A + \text{Parte}_B = \text{Total}$. |
| **F8** | **Duplicação de Recorrências da Casa** | Ambos cadastrarem a mesma conta mensal (ex.: Internet ou Aluguel) como familiar. | **Atribuição ao Pagador Efetivo:** Apenas quem tem o débito em conta cadastra a recorrência. Ao se materializar no mês com `is_family = true`, ela surge na visão da família automaticamente. |
| **F9** | **Dissolução sem Trauma (Zero Perda de Dados)** | Rompimento da família provocar exclusão em cascata de despesas. | **Preservação de Registros Pessoais:** O desligamento (`leave_family`) desassocia o `family_members`, mas mantém todas as despesas salvas nos extratos de seus respectivos autores. |
| **F10**| **Múltiplos Vínculos Conflitantes** | Usuário tentar participar de duas famílias ao mesmo tempo. | **Restrição de Família Ativa Única:** Constraint única no banco (`idx_family_members_single_family`) impedindo múltiplos vínculos por conta. |

---

## 3. ARQUITETURA DE BANCO DE DADOS (SUPABASE POSTGRES & RLS)

### 3.1 Modelo Relacional
```sql
-- 1. Unidades Familiares
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nossa Família',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  monthly_ceiling_cents bigint not null default 0,
  split_ratio_mode text not null default 'equal' check (split_ratio_mode in ('equal', 'income_proportional', 'custom')),
  custom_owner_percentage int default 50 check (custom_owner_percentage between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Membros da Família
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create unique index if not exists idx_family_members_single_family 
  on public.family_members(user_id);

-- 3. Convites Seguros com Token de Uso Único
create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. Associação de Transações à Família
alter table public.expenses 
  add column if not exists family_id uuid references public.families(id) on delete set null;

alter table public.incomes 
  add column if not exists family_id uuid references public.families(id) on delete set null;

create index if not exists idx_expenses_family_date 
  on public.expenses(family_id, date) 
  where is_family = true;

create index if not exists idx_incomes_family_date 
  on public.incomes(family_id, date) 
  where is_family = true;
```

### 3.2 RLS Hermético
- **Leitura (`SELECT`):** Usuário vê suas próprias linhas OU linhas com `is_family = true` da sua família ativa.
- **Mutação (`INSERT`, `UPDATE`, `DELETE`):** Restrita a `auth.uid() = user_id`.

---

## 4. DOMÍNIO PURO & MATEMÁTICA ANALÍTICA (`src/domain/family/`)

Todos os cálculos operam com funções puras em **centavos inteiros**:

### 4.1 Módulos de Domínio
1. `src/domain/family/category-clustering.ts`:
   - `clusterFamilyCategories(items: RawFamilyItem[]): ClusteredCategoryReport`
   - Normaliza strings (minúsculas, sem acentos, sem espaços extras).
   - Tabela canônica de sinônimos conhecidos:
     - `alimentacao`, `comida`, `refeicao`, `mercado`, `supermercado` $\rightarrow$ *"Alimentação / Mercado"*
     - `transporte`, `uber`, `combustivel`, `gasolina` $\rightarrow$ *"Transporte / Combustível"*
     - `saude`, `farmacia`, `medicamentos` $\rightarrow$ *"Saúde / Farmácia"*
     - `lazer`, `entretenimento`, `cinema` $\rightarrow$ *"Lazer / Entretenimento"*
   - Se duas categorias caírem no mesmo grupo, seus valores em centavos são somados em uma única barra consolidada no gráfico.
2. `src/domain/family/reconciliation.ts`:
   - Apura o total gasto e total recebido pela casa, calculando a fatia exata de cada membro.
3. `src/domain/family/settlement.ts`:
   - Determina a compensação de fechamento de mês com critério de desempate de centavos inteiros.

---

## 5. EXPERIÊNCIA DO USUÁRIO NA PÁGINA DEDICADA (`/familia`)

A rota `/familia` adota a trinca canônica de superfície (`border-border/80 bg-surface shadow-xs`) e design tokens oficiais:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ORÇAMENTO FAMILIAR                                                      [Novembro de 2026 ▼]    │
│  Família Sales · 2 Membros Conectados (Gabriel & Mariana)                  [Ajustes da Família]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  [CARD 1: TETO DA CASA]                       [CARD 2: EQUILÍBRIO DO MÊS]                        │
│  R$ 5.840,00 gastos de R$ 7.000,00 (83%)       Gabriel pagou R$ 3.400,00 (58%)                   │
│  [========= Barra Suave ========  ]           Mariana pagou R$ 2.440,00 (42%)                   │
│  Restante: R$ 1.160,00                        Acerto: Mariana transfere R$ 480 para Gabriel [Pix]│
│                                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  [GRÁFICO COMPARATIVO: GASTOS & RECEITAS]      [RANKING DE CONSUMO POR CATEGORIA]                │
│  - Gabriel: R$ 3.400 gastos · R$ 7.000 renda   1. Alimentação / Mercado: R$ 2.150,00 (Maior)     │
│  - Mariana: R$ 2.440 gastos · R$ 5.500 renda   2. Moradia & Contas:      R$ 1.800,00             │
│  - Saldo Líquido da Casa: + R$ 6.260,00        3. Transporte:            R$   620,00             │
│                                                4. Lazer:                 R$   310,00 (Menor)     │
│                                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  [EXTRATO DA CASA COM FILTROS FLUIDOS]                                                           │
│  [ Todas da Casa ]   [ Pagas por Gabriel ]   [ Pagas por Mariana ]                               │
│                                                                                                  │
│  • 05/11 · Supermercado Pão de Açúcar       - R$ 420,00   [Alimentação]   [Badge: Mariana]       │
│  • 04/11 · Conta de Energia (Enel)         - R$ 280,00   [Moradia]       [Badge: Gabriel]       │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. FASES DO PLANO DE IMPLEMENTAÇÃO & PORTÕES DE QUALIDADE

```
[FASE 1: INFRAESTRUTURA POSTGRES, RLS & RPCS]
├── Migração SQL: families, family_members, family_invites e family_id
├── RLS hermético: leitura autorizada para membros e mutação restrita ao autor
├── RPC get_family_consolidation trazendo despesas, receitas e categorias enriquecidas
└── Quality Gate QG1: Testes de isolamento de banco e blindagem contra mutação cruzada

[FASE 2: DOMÍNIO PURO & MATEMÁTICA ANALÍTICA]
├── src/domain/family/category-clustering.ts (clustering e condensação de sinônimos)
├── src/domain/family/reconciliation.ts (somas e fatias em centavos)
├── src/domain/family/settlement.ts (compensação justa com desempate de centavos)
└── Quality Gate QG2: 100% de testes unitários no Vitest cobrindo sinônimos e matemática

[FASE 3: REPOSITÓRIOS, ESTADO & NAVEGAÇÃO CONDICIONAL]
├── src/data/repositories/families.ts & hooks TanStack Query
├── Injeção condicional da rota /familia no AppSidebar e MobileNav
└── Quality Gate QG3: Typecheck estrito aprovado sem any e menu reativo

[FASE 4: FLUXO DE CONVITE & ONBOARDING DO PARCEIRO]
├── Rota pública /convite-familiar/:token com integração de autenticação
├── Card de gestão da família em Configurações
└── Quality Gate QG4: Validação ponta a ponta do convite em janela anônima

[FASE 5: PÁGINA DEDICADA /familia & HOMOLOGAÇÃO]
├── Construção da página /familia com cards de métricas, gráficos e ranking condensado
├── Extrato filtrável da casa com badges de autor
├── Limpeza de /transacoes (100% pessoal, sem abas concorrentes)
└── Quality Gate QG5: Lint aprovado (zero emojis, zero controles crus), build de produção e docs
```

---

## 7. GARANTIA DE ISOLAMENTO DE ESCOPO, ZERO REPLICAÇÃO E ZERO PERDA DE DADOS

1. **Categorias Pessoais Intocadas:** O clustering de categorias ocorre 100% em memória no cliente durante a renderização do gráfico da família. Nenhuma categoria é criada, renomeada ou alterada no banco de dados de nenhum dos usuários.
2. **Extrato Pessoal Preservado:** `/transacoes` permanece intocado, refletindo estritamente as movimentações individuais do usuário logado.
3. **Zero Perda de Dados:** Despesas e receitas continuam nas contas de seus respectivos autores (`user_id`). A associação familiar é puramente relacional e reversível a qualquer momento.
