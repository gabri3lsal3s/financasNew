# PLANO MESTRE DE IMPLEMENTAÇÃO & GOVERNANÇA INTEGRAL — FASE 41 (ROADMAP v3.9.0)
## SISTEMA DE RANQUEAMENTO POR NOTAS, STATUS DE ALOCAÇÃO (QUARENTENA), GATILHOS PROATIVOS & REBALANCEAMENTO INTELIGENTE HOLÍSTICO INTEGRADO AO MOTOR CANÔNICO (PLANO 40)
### Consolidação Arquitetural: Adoção de Meta Única por Carteira, Descomissionamento de Cenários Múltiplos e Rascunho Efêmero com Ações Rápidas Neutras

> **Status:** 📋 Planejado, Auditado, Otimizado e Pronto para Execução  
> **Versão de Lançamento:** `v3.9.0`  
> **Data:** 17/11/2026 (Revisão 3 — Auditoria Estratégica de Metas, Descomissionamento de Presets, Transição Não-Destrutiva & Ergonomia Holística)  
> **Módulos Afetados:** `src/domain/portfolio/`, `src/types/`, `src/data/`, `src/state/`, `src/components/modules/`, `src/features/investments/`, `src/features/overview/`, `src/features/reports/`, `src/domain/export/`, `supabase/migrations/`  
> **Documentos Normativos de Referência:** `AGENTS.md` (Regras 1 a 28), `FINANCIAL_MATH_SPEC.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `ESPECIFICACAO_TECNICA.md`, `40_PLANO_UNIFICACAO_CANONICA_MOTOR_CALCULOS_E_RELATORIOS_INVESTIMENTOS.md`

---

## 1. RESUMO EXECUTIVO, MOTIVAÇÃO ARQUITETURAL & AUDITORIA DE METAS

O rebalanceamento de carteira é o núcleo estratégico da gestão patrimonial de longo prazo. No entanto, os métodos legados baseados em **percentuais manuais fixos por ativo individual** (ex.: arbitrar rigidamente se uma ação deve ter $3,2\%$ ou $3,8\%$, mantendo a soma de dezenas de posições em $100,0\%$) impõem atrito diário desnecessário ao investidor:

1. **Fadiga de Micro-Gestão e Bloqueios de Soma 100%:** A cada nova compra ou encerramento de posição, o investidor é forçado a reajustar dezenas de números para satisfazer a constraint de validação, gerando erros de bloqueio transacional (`Soma excede 100%`).
2. **Equiponderação Ingênua (1/N) como Fallback:** Sem tempo para calcular percentuais micro, o investidor cai no fallback ingênuo de $1/N$, tratando ativos excelentes com notas máximas de governança igual a ativos arriscados ou em deterioração.
3. **Ausência da Quarentena Formal:** Na disciplina de *Value Investing* e *Buy & Hold*, quando os fundamentos de uma empresa pioram, a conduta correta é congelar novos aportes (Quarentena) sem vender no desespero. O modelo legado não tinha uma flag nativa para isso, obrigando a manipulação manual de percentuais.
4. **Passividade do Aplicativo:** O aplicativo não provocava o investidor quando um ativo sofria uma queda severa, perdia a consistência de dividendos ou completava meses sem revisão da tese.
5. **Incongruência e Complexidade Artificial de Cenários Múltiplos (Auditado):** O modelo anterior possuía uma barra superior (`PresetSelectorBar`) com persistência de múltiplos cenários alternativos no banco (`allocation_presets`) e modelos pré-definidos do sistema (`SYSTEM_PRESET_TEMPLATES`). A auditoria técnica identificou que essa funcionalidade gerava ilusão de ótica (o cenário escolhido preenchia campos na tela de metas, mas era sumariamente ignorado pelo motor de aporte, que sempre calculava sobre a meta oficial), poluía o topo da tela com mais de 120px de controles redundantes e incentivava modelos ingênuos de mercado dividindo percentuais cegamente entre ativos desconhecidos.

---

### 1.1. Auditoria da Decisão: Meta Única Oficial vs. Múltiplos Cenários Salvos

Submetida à análise de viabilidade, a hipótese de **eliminar a seleção de cenários e adotar uma única definição de classes, setores e metas por carteira** revelou fragilidades legítimas que foram devidamente mapeadas e mitigadas por salvaguardas arquiteturais elegantes:

| Fragilidade Mapeada da Meta Única | Causa Raiz / Risco Real | Salvaguarda Arquitetural Integrada (Fase 41) |
|---|---|---|
| **Perda do Ambiente de Testes (*Sandbox / What-If*)** | Medo do usuário de alterar percentuais para simular e sobrescrever irreversivelmente sua alocação oficial. | **Rascunho Local com Descarte em 1 Toque (`draftState`):** Todas as edições ocorrem em rascunho de memória. Um botão discreto e acessível *"Descartar alterações"* restaura os valores gravados no banco instantaneamente, sem persistir dezenas de cenários órfãos no banco. |
| **Desacoplamento Estratégico (Meta Terminal vs. Tática)** | Dificuldade de conciliar onde o investidor quer chegar em 5 anos com a alocação que guia o aporte deste mês. | **Governança em 3 Níveis:** A meta de longo prazo vive na proporção macro de Classes e meso de Setores. O ajuste tático do mês é absorvido fluidamente pelas **Notas (0 a 10) e Quarentenas** dos ativos, sem exigir edição da estrutura macro. |
| **Síndrome da Página em Branco no Onboarding (*Cold Start*)** | Usuário iniciante sem saber quais percentuais definir para suas classes e setores no primeiro contato. | **Ações Rápidas Neutras Baseadas na Posição Real:** Sem impor templates opinativos de terceiros ("Ray Dalio" / "Dividendos"), o sistema oferece utilitários de 1 clique: *"Espelhar Distribuição Atual da Carteira"* (`mirrorCurrentPositionTargets`), *"Equiponderar Setor (Nota 8 Padrão)"* e *"Normalizar para 100%"*. |
| **Desconexão Funcional entre Metas e Aporte** | O cenário selecionado nas Metas não era o que o Aporte executava, gerando frustração. | **Paridade Canônica 1:1:** Como só existe UMA definição de metas por carteira, o que o usuário calibra na tela de metas é estritamente o que a aba de Aporte consome, eliminando qualquer dissonância cognitiva. |
| **Manutenção de Código Morto e Tabela Supabase** | Custos com `allocation_presets`, RPCs, schemas Zod, repositórios e testes para uma feature sem uso real. | **Descomissionamento Limpo:** Exclusão da tabela `allocation_presets` e dos componentes `PresetSelectorBar` e `SavePresetDialog`, reduzindo o bundle, simplificando o banco e limpando o topo da interface. |

---

### 1.2. A Solução Canônica da Fase 41: Hierarquia em 3 Níveis

A Fase 41 introduz a **Governança de Alocação Hierárquica em 3 Níveis**, unindo o rigor percentual macro à simplicidade cognitiva de **Notas e Status de Alocação** no micro:

```
[ NÍVEL 1: MACRO ] ── Classes de Ativos (% do Patrimônio Total)
                      Ex.: Ações 40% | FIIs 30% | Renda Fixa 20% | Internacional 10%
                      (Persistido em group_targets · Validação estrita: Soma = 100%)
                           │
[ NÍVEL 2: MESO  ] ── Setores / Segmentos (% Relativo dentro da Classe)
                      Ex.: Elétricas 30% | Bancos 25% | Saneamento 25% | Seguros 20%
                      (Persistido em group_targets · Validação estrita: Soma = 100% da classe)
                           │
[ NÍVEL 3: MICRO ] ── Ativos: Notas (0 a 10) + Status Operacional + Checklist de Tese
                      Ex.: ITUB4 (Nota 10, Aportar) | BBAS3 (Nota 8, Aportar) | SANB11 (Quarentena)
                      (Persistido diretamente em portfolio_assets · Metas derivadas em O(1) puro!)
```

---

## 2. INTEGRAÇÃO HOLÍSTICA COM TODO O ECOSSISTEMA DO APLICATIVO

A Fase 41 conecta o rebalanceamento de forma transversal e simbiótica com as principais funcionalidades do produto:

```mermaid
flowchart TD
    subgraph Core_Engine["Motor Canônico de Investimentos (Plano 40)"]
        CE["canonical-engine.ts<br/>(Custódia O(1), Preço Médio, PnL Não Realizado)"]
        CR["canonical-returns.ts<br/>(Retorno Total %, YoC, Modified Dietz)"]
        CN["canonical-normalizer.ts<br/>(Taxa PTAX Oficial, Resgate Proporcional de RF)"]
    end

    subgraph Governance_Engine["Governança por Notas & Gatilhos (Plano 41)"]
        AL["allocation.ts<br/>(Derivação de Pesos por Notas & Quarentenas)"]
        GE["asset-governance-insights.ts<br/>(Gatilhos Proativos de Auditoria & PQS)"]
        AP["aporte.ts<br/>(Roteador Hierárquico de Lotes de Compra)"]
    end

    subgraph App_Integrations["Superfícies & Integrações Transversais"]
        OV["Overview / Home<br/>(SurplusAporteBanner & QuickAporteCard)"]
        DIV["Proventos B3<br/>(ReinvestDividendsBanner & Caixa Disponível)"]
        FAM["Modo Família<br/>(Governança & Notas de Ativos Compartilhados)"]
        REP["Relatórios Executivos A4 & Excel<br/>(Badge de Quarentena, PQS & Dossiê Patrimonial)"]
        EXP["Backup, Restore & LGPD<br/>(Persistência Não-Destrutiva dos Campos de Tese)"]
    end

    CE & CR & CN --> AL & GE & AP
    OV -->|Injeção Direta de Superávit Mensal| AP
    DIV -->|Aporte Composto: Dinheiro Novo + Proventos em Caixa| AP
    GE -->|Alertas no Carrossel & Radar de Revisão| OV
    AL -->|Dossiê de Qualidade PQS & Quarentenas| REP
    AL -->|Suporte a Ativos Compartilhados| FAM
    AL & GE -->|Sincronização no JSON/Excel| EXP
    AP -->|Execução Atômica de Ordens (RPC)| CE
```

### 2.1. Integração com a Home / Dashboard (`OverviewPage`)
- **Superávit Mensal $\rightarrow$ Aporte Inteligente (`SurplusAporteBanner`):** Quando o fluxo financeiro do mês gera sobra de caixa (`surplusCents > 0`), o clique em *"Simular Aporte"* injeta o valor diretamente no simulador ponderado por notas, canalizando a sobra para os ativos de Nota alta mais defasados.
- **Detector de Lote Mínimo:** Se a sobra for inferior ao preço unitário da cota mais cara da fila, o motor sugere realocar no ativo secundário de nota alta com cota menor ou acumular na reserva de caixa.
- **Card de Radar no Carrossel (`DashboardAlertsCarousel`):** Alerta consolidado na tela inicial quando houver ativos com revisão de tese pendente há mais de 180 dias.

### 2.2. Integração com Proventos B3 & Ciclo de Reinvestimento (`ProventosTab`)
- **Aporte Composto (Dinheiro Novo + Saldo em Caixa):** Na tela de Aporte, o toggle *"Incluir saldo de proventos em caixa"* permite somar o dinheiro da corretora ao dinheiro novo do bolso em uma única simulação, otimizando corretagens e limpando saldos ociosos.
- **Isolamento de Ativos em Quarentena:** Proventos gerados por um ativo em quarentena são canalizados para o caixa geral e reinvestidos exclusivamente nos ativos saudáveis de Nota 10 ou 8.

### 2.3. Integração com o Relatório Executivo A4 / PDF & Exportação Excel (`reports`)
- **Dossiê de Qualidade e Governança:** O relatório executivo oficial em PDF e a planilha Excel passam a conter as colunas de **Nota (0–10)**, **Status de Alocação** (`Aportar`, `Manter`, `Quarentena`, `Saída`) e a data da última revisão.
- **Card de PQS (Portfolio Quality Score):** O topo do relatório exibe o índice consolidado de qualidade da carteira ponderado pelo patrimônio.

### 2.4. Integração com o Modo Família (`useFamilyMode`)
- Ativos compartilhados com a família (`is_family === true`) exibem as notas e justificativas para ambos os membros, permitindo alinhamento na tomada de decisão sobre quarentenas e teses.

### 2.5. Integração com Backup, Restore & LGPD (`src/domain/export/`)
- Inclusão formal de `score`, `allocation_status`, `score_criteria`, `last_reviewed_at`, `review_frequency_months` e `thesis_summary` em `src/domain/export/backup.ts` e `deduplication.ts`, garantindo que restaurações de backup preservem 100% das avaliações do usuário.

---

## 3. MATRIZ CANÔNICA DE FRAGILIDADES, RISCOS & SALVAGUARDAS (S1 A S26)

Mapeamento integral de todas as fragilidades teóricas e práticas, com suas respectivas salvaguardas de engenharia inegociáveis:

| # | Fragilidade / Risco Mapeado | Impacto Técnico | Salvaguarda de Engenharia Inegociável |
|---|---|---|---|
| **S1** | **Cold Start / Ativo sem Nota** | Usuário possui ativos antigos ou cria ativo sem nota (`score = null`). Risco de exclusão inadvertida. | **Fallback Neutro Dinâmico:** Ativo sem nota assume **Nota 5 (Neutro)** nos cálculos, exibindo badge visual de *"Avaliação pendente"* com atalho em 1 toque. |
| **S2** | **Divisão por Zero em Setor em Quarentena** | Todos os ativos do setor recebem Nota 0 ou Quarentena ($\sum \text{Nota} = 0$). Risco de erro fatal de divisão por zero. | **Transbordamento Transversal de Sobras:** Se $\sum \text{Nota}_{\text{elegíveis}} = 0$, o orçamento do setor é **100% transferido para os outros setores deficitários da classe**, catalogando o motivo em `skippedAssets: "quarantine"`. |
| **S3** | **Quarentena com Aporte Zero Garantido** | Erros de arredondamento alocarem centavos para um ativo problemático. | **Invariante de Bloqueio Estrito:** Se `allocation_status === "quarantine"` ou `"exit"`, o motor força `targetPercentage = 0`, `allocatedBRL = 0` e `quantity = 0`. |
| **S4** | **Superconcentração por Notas Discrepantes** | Setor com dois ativos: Nota 10 e Nota 1 (proporção 91% vs 9%). | **Previsibilidade Visual & Teto Prudencial:** Exibição da coluna *"Meta Calculada"* em tempo real. Trava prudencial configurável de teto máximo de $75\%$ em ativos individuais do setor. |
| **S5** | **Classes sem Divisão Setorial Rígida** | Renda Fixa ou Criptoativos onde os ativos não possuem setores industriais ou pertencem ao setor "Geral". | **Ponderação Direta na Classe:** O motor avalia o escopo hierárquico: se a classe não possui setores cadastrados, a proporção por notas é calculada diretamente sobre o teto da classe. Caixa permanece isento de notas (gerenciado por alocação percentual fixa). |
| **S6** | **Avalanche de Alertas / Fadiga Cognitiva** | Usuário com 30 ativos que completam o ciclo de 6 meses simultaneamente, inundando o app com 30 cards. | **Agrupamento Inteligente no Carrossel:** O motor gera no máximo **1 card consolidado** de revisão no carrossel: *"X ativos com revisão pendente"* com ação de *"Revisar em Lote"*. |
| **S7** | **Retrocompatibilidade de Dados Legados** | Usuários com metas antigas gravadas na tabela `allocation_targets`. | **Transição Não-Destrutiva:** Novos campos são persistidos em `portfolio_assets`. O motor dá prioridade para as notas calculadas, mas mantém o modo percentual legado caso o usuário desmarque a governança por notas. |
| **S8** | **Resíduos de Cotas Inteiras na B3** | Em ações nacionais, compras são obrigatoriamente de cotas inteiras. Sobras financeiras ficariam presas no ativo sem ser utilizadas. | **Recirculação Cascata de Resíduos:** A sobra de compra de um ativo tenta atender o próximo ativo elegível do setor; a sobra do setor tenta atender o próximo setor da classe; o resíduo final retorna para a reserva de caixa. |
| **S9** | **Viés Emocional (Preço vs. Fundamentos)** | O investidor rebaixa uma empresa sólida apenas porque ela caiu de preço (pânico momentâneo) ou dá nota 10 porque subiu rápido (euforia). | **Checklist Fundamentalista Desviesador:** O diálogo de avaliação oferece critérios objetivos (lucros históricos, dívida/EBITDA, governança), orientando o usuário a separar oscilação de cotação de qualidade do negócio. |
| **S10** | **Heterogeneidade de Critérios por Classe** | Avaliar um Fundo Imobiliário com perguntas de Ações (ex.: perguntar sobre EBITDA para um FII de tijolo). | **Matriz Polimórfica de Checklist:** O formulário de critérios adapta suas perguntas automaticamente conforme o arquétipo do ativo (Ações, FIIs, Renda Fixa, Cripto). |
| **S11** | **Estratégia de Saída e Desinvestimento Gradual** | Um ativo perde fundamentos de forma definitiva e o usuário deseja zerar a posição. | **Status "Desinvestimento (Exit)":** Não recebe nenhum centavo de aporte e, caso o usuário utilize o simulador de rebalanceamento com venda, o ativo é listado como prioritário para alienação dentro da faixa de isenção fiscal de R$ 20.000 da B3. |
| **S12** | **Histórico de Tese & Diário de Bordo** | O usuário não se lembra por que atribuiu nota 6 ou colocou a empresa em quarentena há 4 meses. | **Rastreabilidade de Revisões:** Cada alteração de nota permite gravar uma justificativa (`thesis_summary`), criando uma trilha de auditoria pessoal contra arrependimentos. |
| **S13** | **Zero Concorrência Visual & Ergonomia Móvel** | Modais de notas esmagando controles ou abrindo teclado virtual no mobile. | **Conformidade Estrita com Regras 18 e 20 do `AGENTS.md`:** Zero `autoFocus`, inputs numéricos com tamanho mínimo de 16px para prevenir auto-zoom no iOS, e layout adaptativo em gaveta (*Bottom Sheet*) no mobile. |
| **S14** | **Preservação de Desempenho $O(1)$** | O cálculo de notas não pode degradar a performance de abertura da Home ou da carteira. | **Cálculo de Pesos Linear $O(N)$ em Memória:** A derivação das metas a partir das notas ocorre puramente no cliente via funções puras memoizadas, sem subqueries adicionais ao banco. |
| **S15** | **Ativos Multimoeda (USD / Cripto)** | Distorções cambiais ao tentar somar ativos em dólar sem conversão no gap de alocação. | **Conversão Cambial Homogênea:** O motor converte cotações em USD pela PTAX oficial apurada pelo Plano 40 (`USDBRL=X`), calculando frações de até 4 casas para Stocks e 8 casas para Cripto. |
| **S16** | **Equiponderação Rápida para Iniciantes** | Atrito de preenchimento inicial para carteiras com muitos ativos. | **Ação 1-Toque "Equiponderar Setor":** Botão que atribui Nota 8 padrão para todos os membros do setor, permitindo usufruir do aporte inteligente imediatamente sem esforço. |
| **S17** | **Incompatibilidade com o Modo Família** | Cônjuge sem visibilidade das teses ou permissões conflitantes de edição. | **Governança Familiar Compartilhada:** Leitura liberada para membros da família com permissão e edição restrita ao proprietário ou cotitulares autorizados. |
| **S18** | **Integridade em Backups e Exportações** | Perda de notas e teses após restauração de backup via JSON. | **Cobertura Integral no Módulo de Exportação:** Atualização de `backup.ts` e `deduplication.ts` para persistir e restaurar integralmente os 6 novos campos. |
| **S19** | **Margem de Segurança Integrada (Modo Smart Aporte)** | Dois ativos com Nota 10, mas um com 30% de desconto frente ao Custo Médio e Preço Teto Bazin. | **Multiplicador Opcional de Oportunidade:** O usuário pode alternar entre distribuição puramente por notas ou ponderação mista (Nota $\times$ Margem de Segurança). |
| **S20** | **Proventos em Quarentena Isolados** | Dividendos de empresas em quarentena sendo reinvestidos no próprio ativo problemático. | **Canalização para o Caixa Geral:** Proventos de ativos em quarentena caem na conta corrente da corretora e são direcionados para os ativos saudáveis. |
| **S21** | **Métrica Global de Qualidade Patrimonial (PQS)** | O investidor não sabe se a carteira como um todo está melhorando ou piorando qualitativamente. | **Portfolio Quality Score (0 a 10):** Cálculo da média ponderada das notas pelo patrimônio real de cada ativo, exibida no topo dos relatórios executivos. |
| **S22** | **DRY Estrito com Ferramentas Públicas** | Duplicação de fórmulas entre a ferramenta pública de simulação e a área autenticada. | **Compartilhamento de Funções Puras:** A página pública `/ferramentas/rebalanceamento` passa a importar a mesma função pura `deriveAssetWeightsFromScores` de `src/domain/portfolio/`. |
| **S23** | **Descomissionamento Seguro de Presets e Limpeza de Código Morto** | Manter a barra de cenários (`PresetSelectorBar`) em conflito com o novo modelo hierárquico por notas. | **Remoção Integral de Cenários Múltiplos:** Excluir `PresetSelectorBar`, `SavePresetDialog`, a tabela `allocation_presets` e seus hooks. A tela de Metas passa a gerenciar diretamente a Meta Oficial da Carteira sem intermediários. |
| **S24** | **Rascunho Local Resiliente (Draft State & Discard)** | O investidor mexer nos valores de classes/setores para testar e não conseguir voltar ao valor original. | **Botão "Descartar Alterações":** Se houver deltas entre o rascunho de tela e os valores salvos em `group_targets`, surge o botão contextual *"Descartar alterações"*, restaurando as metas gravadas em 1 toque com haptic sensorial. |
| **S25** | **Mitigação de Página em Branco sem Presets Opinativos** | Usuário novo sem saber como iniciar a calibragem de classes e setores. | **Ação "Espelhar Posição Atual":** Utiliza `mirrorCurrentPositionTargets` para preencher as metas com base no patrimônio real já custodiado, dando um ponto de partida perfeito sem impor regras teóricas de mercado. |
| **S26** | **Consistência 1:1 entre Metas e Motor de Aporte** | Expectativa frustrada de simular em um cenário na aba de Metas e o Aporte calcular com base em outro. | **Canal Único de Execução:** Como a carteira possui estritamente UMA meta oficial, a tela de Aporte e a tela de Metas compartilham exatamente as mesmas queries e fórmulas canônicas. |

---

## 4. MODELAGEM MATEMÁTICA CANÔNICA DE PONDERAÇÃO & PQS

### 4.1. Equação do Peso do Ativo no Setor
Seja um setor $S$ com $n$ ativos cadastrados. Para cada ativo $i \in S$, definimos a **Nota Elegível** $\sigma_i$:
$$\sigma_i = \begin{cases} 
0, & \text{se } \text{status}_i \in \{\text{quarantine}, \text{exit}\} \text{ ou } \text{score}_i = 0 \\
\text{score}_i, & \text{se } \text{status}_i = \text{active} \text{ e } \text{score}_i \in [1, 10] \\
5, & \text{se } \text{status}_i = \text{active} \text{ e } \text{score}_i \text{ for nulo (fallback neutro)} \\
0, & \text{se } \text{status}_i = \text{neutral} \text{ (mantém posição, sem novos aportes)}
\end{cases}$$

O **Peso Relativo do Ativo no Setor** ($w_{i \in S}$) é dado por:
$$w_{i \in S} = \begin{cases}
0, & \text{se } \sum_{k \in S} \sigma_k = 0 \\
\frac{\sigma_i}{\sum_{k \in S} \sigma_k}, & \text{se } \sum_{k \in S} \sigma_k > 0
\end{cases}$$

Onde $\sum_{i \in S} w_{i \in S} = 1,0$ (quando $\sum \sigma_k > 0$).

---

### 4.2. Equação da Meta Efetiva Global nos 3 Níveis
A meta percentual do ativo em relação ao **patrimônio total da carteira** ($T_i$) é derivada por encadeamento:

$$T_i = \text{Target}_{\text{Classe}} \times \text{Target}_{\text{Setor na Classe}} \times w_{i \in S}$$

*Caso especial (Salvaguarda S5):* Se a classe não possuir divisão setorial (ex.: Renda Fixa ou Criptoativos), a equação colapsa diretamente para:
$$T_i = \text{Target}_{\text{Classe}} \times w_{i \in \text{Classe}}$$

---

### 4.3. Portfolio Quality Score (PQS) — Índice de Qualidade da Carteira
O **PQS** mede a nota média da carteira ponderada pelo patrimônio real alocado em cada ativo, fornecendo uma métrica institucional de saúde patrimonial (escala 0 a 10):

$$\text{PQS} = \frac{\sum_{i=1}^{N} (\text{score}_i \times V_{\text{atual}, i})}{V_{\text{total ativos}}}$$

- $\text{PQS} \ge 8,5$: Carteira de Excelência (Grau de Investimento Primário).
- $7,0 \le \text{PQS} < 8,5$: Carteira Equilibrada.
- $\text{PQS} < 7,0$: Alerta de Concentração em Ativos de Baixa Convicção.

---

## 5. ESPECIFICAÇÃO TÉCNICA DOS MÓDULOS, BANCO & CONTRATOS DE DADOS

### 5.1. Migração Supabase (`20260101000125_portfolio_asset_scoring_and_governance.sql`)
```sql
-- Fase 41: Governança por Notas, Status de Quarentena e Diário de Bordo
alter table public.portfolio_assets
  add column if not exists score smallint check (score >= 0 and score <= 10),
  add column if not exists allocation_status text not null default 'active'
    check (allocation_status in ('active', 'neutral', 'quarantine', 'exit')),
  add column if not exists score_criteria jsonb default '{}'::jsonb,
  add column if not exists last_reviewed_at timestamptz default now(),
  add column if not exists review_frequency_months smallint not null default 6,
  add column if not exists thesis_summary text;

create index if not exists idx_portfolio_assets_review_status
  on public.portfolio_assets (user_id, last_reviewed_at, allocation_status);

-- Descomissionamento seguro de allocation_presets (se a tabela existir)
drop table if exists public.allocation_presets cascade;

notify pgrst, 'reload schema';
```

---

### 5.2. Contratos de Tipagem (`src/types/schema.ts`)
```typescript
export type AssetAllocationStatus = "active" | "neutral" | "quarantine" | "exit";

export type AssetScoreCriteria = {
  consistent_profits?: boolean;
  low_debt?: boolean;
  good_governance?: boolean;
  competitive_moat?: boolean;
  dividends_or_roe?: boolean;
  quality_properties?: boolean;
  low_vacancy?: boolean;
  reputable_management?: boolean;
  attractive_p_vp?: boolean;
  credit_safety?: boolean;
  liquidity_match?: boolean;
  custom_notes?: string;
};

export type PortfolioAsset = {
  // campos existentes...
  score?: number | null;
  allocation_status?: AssetAllocationStatus;
  score_criteria?: AssetScoreCriteria | null;
  last_reviewed_at?: string | null;
  review_frequency_months?: number;
  thesis_summary?: string | null;
};
```

---

## 6. ESTRUTURA DE FASES, ETAPAS & PORTÕES DE QUALIDADE (ROADMAP EXECUTIVO)

---

### FASE 1: CAMADA DE DADOS, SCHEMA SUPABASE & DESCOMISSIONAMENTO DE PRESETS

**Objetivo:** Estabelecer a infraestrutura de banco de dados, tipagem estrita, persistência de notas/teses e remoção segura da tabela legada `allocation_presets`.

#### Etapa 1.1: Migração do Banco de Dados (`supabase/migrations/`)
- [ ] Criar migração `20260101000125_portfolio_asset_scoring_and_governance.sql`.
- [ ] Adicionar colunas `score`, `allocation_status`, `score_criteria`, `last_reviewed_at`, `review_frequency_months` e `thesis_summary` em `portfolio_assets`.
- [ ] Criar índice B-Tree composto `idx_portfolio_assets_review_status (user_id, last_reviewed_at, allocation_status)`.
- [ ] Executar drop de `allocation_presets` de forma não-destrutiva.
- [ ] Executar recarga de schema PostgREST (`notify pgrst, 'reload schema'`).

#### Etapa 1.2: Contratos de Tipagem (`src/types/schema.ts` e `src/types/database.ts`)
- [ ] Adicionar tipos `AssetAllocationStatus` e `AssetScoreCriteria` em `src/types/schema.ts`.
- [ ] Atualizar o tipo `PortfolioAsset` em `src/types/schema.ts` e `src/types/database.ts`.
- [ ] Remover tipos legados de `AllocationPreset`, `PresetAssetTarget`, `PresetClassTarget`.

#### Etapa 1.3: Repositórios, Mutações & Limpeza de Código Morto (`src/data/` e `src/state/`)
- [ ] Garantir que `updatePortfolioAsset` em `src/data/repositories/portfolio.ts` suporte os novos campos.
- [ ] Atualizar o hook `useUpdatePortfolioAsset` com invalidação atômica via `invalidatePortfolioSuite` e feedback sensorial.
- [ ] Excluir `src/data/repositories/allocation-presets.ts` e `allocation-presets.test.ts`.
- [ ] Excluir hooks `useAllocationPresets`, `useCreateAllocationPreset`, `useUpdateAllocationPreset` e `useDeleteAllocationPreset` de `src/state/`.

#### 🚪 Portão de Qualidade 1 (Fim da Fase 1)
- [ ] `npm run typecheck` passando com 0 erros após a remoção dos tipos de preset.
- [ ] Migração aplicada com sucesso no schema cache.
- [ ] Teste unitário de repositório validando gravação e recuperação dos novos campos.

---

### FASE 2: DOMÍNIO MATEMÁTICO PURO — PONDERAÇÃO, QUARENTENAS & TRANSBORDO

**Objetivo:** Construir as funções puras em `src/domain/portfolio/` para transformar notas em pesos, isolar quarentenas, garantir conservação de recursos e limpar templates ingênuos.

#### Etapa 2.1: Função Pura de Derivação de Pesos (`src/domain/portfolio/allocation.ts`)
- [ ] Implementar `deriveAssetWeightsFromScores`:
  - Bloqueio estrito de quarentenas e status de saída (Salvaguarda S3).
  - Fallback gracioso para ativos sem nota (Salvaguarda S1).
  - Transbordamento seguro para setores com todas as notas zeradas (Salvaguarda S2).
  - Normalização para soma rigorosa de 1,0 ($100\%$).
- [ ] Implementar `calculateEffectiveAssetTargets`: encadeamento dos 3 níveis com suporte a classes sem setores (Salvaguarda S5).
- [ ] Implementar `calculatePortfolioQualityScore(assets)`: cálculo do índice PQS (Salvaguarda S21).
- [ ] Preservar e otimizar `mirrorCurrentPositionTargets`: preenchimento neutro em 1 clique (Salvaguarda S25).

#### Etapa 2.2: Limpeza do Módulo de Presets (`src/domain/portfolio/presets.ts`)
- [ ] Excluir `src/domain/portfolio/presets.ts` e `presets.test.ts` (ou converter para utilitário puro de espelhamento de posição).
- [ ] Remover templates de mercado opinativos (`SYSTEM_PRESET_TEMPLATES`), eliminando divisões ingênuas de $1/N$.

#### Etapa 2.3: Integração com o Motor de Simulação de Aporte (`src/domain/portfolio/aporte.ts`)
- [ ] Integrar cálculo de metas derivadas por nota em `simulateCombinedAporte`.
- [ ] Catalogar ativos ignorados no diagnóstico (`skippedAssets`) com `reason: "quarantine"`.
- [ ] Implementar recirculação em cascata de resíduos de cotas da B3 (Salvaguarda S8).
- [ ] Suporte nativo a ativos em USD e Cripto com precisão fracionária (Salvaguarda S15).

#### Etapa 2.4: Bateria de Testes Unitários de Domínio (`allocation.test.ts` e `aporte.test.ts`)
- [ ] Testar cálculo de pesos com notas 10, 8 e 6.
- [ ] Testar exclusão rigorosa de quarentena (recebimento de R$ 0,00).
- [ ] Testar transbordamento transversal em setor 100% em quarentena.
- [ ] Testar conservação estrita de recursos ($DoD$: total alocado $\le$ aporte informado).

#### 🚪 Portão de Qualidade 2 (Fim da Fase 2)
- [ ] `vitest run src/domain/portfolio/allocation.test.ts` 100% aprovado.
- [ ] `vitest run src/domain/portfolio/aporte.test.ts` 100% aprovado.
- [ ] Zero dependências de React ou Supabase no domínio puro.

---

### FASE 3: MOTOR DE GATILHOS PROATIVOS & AUDITORIA DE TESES

**Objetivo:** Criar o motor puro de diagnósticos da carteira, monitorando cadência de tempo, drawdowns e oportunidades em sinergia com o Plano 40.

#### Etapa 3.1: Motor Puro de Diagnóstico (`src/domain/portfolio/asset-governance-insights.ts`)
- [ ] Implementar `generateAssetGovernanceInsights`:
  - Gatilho 1: Revisão Periódica Vencida ($> 180$ dias).
  - Gatilho 2: Acompanhamento de Quarentena ($> 90$ dias).
  - Gatilho 3: Oportunidade com Desconto (Nota $\ge 8$ e queda $\ge 20\%$ frente ao PM).
  - Gatilho 4: Risco de Hiperconcentração de Ativo com Nota Baixa ($\le 4$).
- [ ] Implementar consolidação para agrupamento contra fadiga de alertas (Salvaguarda S6).

#### Etapa 3.2: Hook de Consulta Reativo (`src/state/queries/`)
- [ ] Criar hook `useAssetGovernanceInsights` alimentado pela posição consolidada de `usePortfolioPosition`.
- [ ] Memoizar resultados para desempenho $O(1)$.

#### Etapa 3.3: Bateria de Testes de Domínio dos Gatilhos (`asset-governance-insights.test.ts`)
- [ ] Testar todos os cenários de disparo com datas civis e drawdowns simulados.
- [ ] Testar agrupamento consolidado em carteiras volumosas.

#### 🚪 Portão de Qualidade 3 (Fim da Fase 3)
- [ ] `vitest run src/domain/portfolio/asset-governance-insights.test.ts` 100% verde.
- [ ] Zero alertas de lint ou warnings do React Compiler.

---

### FASE 4: INTEGRAÇÕES HOLÍSTICAS DE ECOSSISTEMA & TRANSIÇÃO NÃO-DESTRUTIVA

**Objetivo:** Conectar a governança por notas ao restante do aplicativo (Home/Dashboard, Proventos B3, Modo Família, Relatórios e Backups).

#### Etapa 4.1: Integração com a Home / Overview (`OverviewPage`)
- [ ] Conectar o `SurplusAporteBanner` à aba de aportes com injeção automática de superávit.
- [ ] Integrar alertas consolidados de revisão no `DashboardAlertsCarousel`.

#### Etapa 4.2: Integração com Proventos B3 (`ProventosTab`)
- [ ] Permitir injeção de saldo em caixa de proventos no simulador de aporte (Aporte Composto).
- [ ] Garantir que ativos em quarentena não recebam reinvestimento de proventos.

#### Etapa 4.3: Integração com Relatórios Executivos A4 & Excel (`reports`)
- [ ] Adicionar colunas de Nota, Status de Quarentena e índice PQS na tabela do `portfolio-executive-report.tsx`.
- [ ] Adicionar colunas correspondentes no exportador Excel (`excel-export`).

#### Etapa 4.4: Integração com o Modo Família (`useFamilyMode`)
- [ ] Exibir notas e teses para membros autorizados em ativos compartilhados (`is_family === true`).

#### Etapa 4.5: Integração com Backup e Restore (`src/domain/export/`)
- [ ] Atualizar `backup.ts` e `deduplication.ts` para persistir e restaurar os 6 novos campos de governança.

#### 🚪 Portão de Qualidade 4 (Fim da Fase 4)
- [ ] Teste de backup e restauração (`backup.test.ts`) validando integridade das notas.
- [ ] Relatório executivo A4 renderizando sem quebras de layout.

---

### FASE 5: CAMADA DE UI/UX, COMPONENTES DE AVALIAÇÃO & TELAS INTEGRADAS

**Objetivo:** Construir as interfaces de avaliação, remover componentes obsoletos de cenários e modernizar as telas de Metas, Aporte e Ficha do Ativo, seguindo com rigor as Regras 1 a 28 do `AGENTS.md`.

#### Etapa 5.1: Descomissionamento de Componentes de Cenário
- [ ] Excluir `src/components/modules/preset-selector-bar.tsx`.
- [ ] Excluir `src/components/modules/save-preset-dialog.tsx`.
- [ ] Limpar exportações de `src/components/modules/index.ts`.

#### Etapa 5.2: Diálogo de Avaliação de Tese (`AssetScoreEvaluationDialog`)
- [ ] Criar `src/features/investments/components/asset-score-evaluation-dialog.tsx`:
  - Primitivo `<Modal />` tamanho `size="lg"` responsivo (Regra 18).
  - Seletor tátil de Nota (0 a 10) com escala semântica colorida.
  - Segmented control para Status: `Aportar` / `Manter` / `Quarentena` / `Saída`.
  - Checklist polimórfico adaptativo por classe de ativo (Salvaguarda S10).
  - Campo de texto para resumo da tese de investimento (`thesis_summary`).
  - Ausência estrita de `autoFocus` declarativo (Regra 20).

#### Etapa 5.3: Modernização da Tela de Metas (`TargetsTab` e `TargetAssetsCard`)
- [ ] Em `targets-tab.tsx`:
  - Remover `PresetSelectorBar` e `SavePresetDialog`.
  - Inserir barra superior limpa com resumo da meta oficial, índice PQS consolidado e ações rápidas:
    - *"Espelhar posição atual"* (`mirrorCurrentPositionTargets`);
    - *"Normalizar 100%"*;
    - *"Descartar alterações"* (visível apenas quando houver rascunho pendente — Salvaguarda S24);
    - *"Salvar Metas"*.
- [ ] Em `target-assets-card.tsx`:
  - Substituir a digitação de `%` manual pelo modo de **Governança por Notas**:
  - Exibição de ativos agrupados por setor.
  - Seletores rápidos de Nota e Badges de Status (`Aportar`, `Manter`, `Quarentena`).
  - Coluna didática exibindo a "Meta Calculada no Setor" em tempo real.
  - Botão de ação rápida abrindo o diálogo de avaliação de tese.
  - Botão de 1-toque *"Equiponderar Setor"* para iniciantes (Salvaguarda S16).

#### Etapa 5.4: Integração na Ficha do Ativo (`AssetDetailSheet`)
- [ ] Adicionar card dedicado de **"Tese & Nota do Ativo"**:
  - Exibição destacada da Nota, Status e tempo desde a última revisão.
  - Alerta contextual quando a revisão estiver pendente há $> 180$ dias.
  - Botão *"Revisar Tese & Nota"*.

#### Etapa 5.5: Carrossel de Insights da Carteira (`PortfolioInsightsCarousel`)
- [ ] Adicionar slides governamentais no carrossel:
  - Slide de *"Revisão de Tese Pendente"*.
  - Slide de *"Acompanhamento de Quarentena"*.
  - Slide de *"Oportunidade com Desconto"*.
  - Dimensões e tokens em conformidade estrita com a Regra 19 do `AGENTS.md`.

#### Etapa 5.6: Atualização da Aba de Aporte (`AporteTab`)
- [ ] Conectar a simulação de aporte ao novo motor baseado em notas.
- [ ] Exibir claramente os ativos poupados por quarentena no log de diagnóstico.

#### 🚪 Portão de Qualidade 5 (Fim da Fase 5)
- [ ] Testes de componentes de UI (`*.test.tsx`) 100% aprovados.
- [ ] Conformidade total de acessibilidade (`aria-label`, contraste e navegação por teclado).
- [ ] `npm run lint` com 0 erros e 0 warnings.

---

### FASE 6: AUDITORIA DE PONTA A PONTA, VALIDAÇÃO INTEGRAL & HOMOLOGAÇÃO

**Objetivo:** Executar testes de regressão de ponta a ponta, validar em dispositivos reais (desktop e mobile) e homologar o release v3.9.0.

#### Etapa 6.1: Bateria Completa de Testes Automatizados
- [ ] Rodar suíte completa de testes de domínio de investimentos:
  `npm run test -- src/domain/portfolio/`
- [ ] Rodar suíte completa de componentes de investimentos:
  `npm run test -- src/features/investments/`
- [ ] Validar ausência de regressões no motor canônico do Plano 40:
  `npm run test -- src/domain/portfolio/canonical-*.test.ts`
- [ ] Executar checagem estrita de tipos: `npm run typecheck`.

#### Etapa 6.2: Validação Manual em Dispositivos & Cenários Extremos
- [ ] **Cenário 1 (Onboarding & Meta Única):** Cadastro de notas para novos ativos e verificação do cálculo em tempo real sem a presença de barras de presets obsoletas.
- [ ] **Cenário 2 (Rascunho & Descarte):** Alteração de valores em rascunho, validação do botão *"Descartar alterações"* e verificação do rollback imediato para os dados do banco.
- [ ] **Cenário 3 (Quarentena):** Simulação de aporte de R$ 10.000 com ativo em quarentena: verificar que o ativo recebe R$ 0,00 e o dinheiro é distribuído para os saudáveis.
- [ ] **Cenário 4 (Setor 100% Quarentena):** Verificação de transbordamento transversal seguro para os demais setores.
- [ ] **Cenário 5 (Mobile iOS / Android):** Abertura do diálogo de tese em smartphone, verificando que o teclado não provoca zoom in e a alça de arrasto da gaveta responde suavemente.

#### Etapa 6.3: Documentação e Fechamento de Versão
- [ ] Atualizar `docs/roadmap/ROADMAP.md` registrando a entrega da Fase 41 (v3.9.0).
- [ ] Atualizar `docs/architecture/ESPECIFICACAO_TECNICA.md` consolidando a especificação do rebalanceamento por notas, quarentenas e a remoção dos cenários múltiplos.

#### 🚪 Portão de Qualidade Final (Homologação v3.9.0)
- [ ] `npm run typecheck` com 0 erros.
- [ ] `npm run lint` com 0 erros e 0 warnings.
- [ ] `npm run test` com 100% de sucesso em toda a suíte.
- [ ] `npm run build` gerando bundle de produção sem avisos.
- [ ] **Ação Git:** Commit semântico final e tag de versão:  
  `git commit -m "feat(portfolio): implementar sistema holistico de notas, quarentenas e meta unica oficial de carteira (Fase 41)"`
