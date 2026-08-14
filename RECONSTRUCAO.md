# 🏗️ RECONSTRUCAO.md — Especificação de Reconstrução do Zero

> **Propósito:** especificar 100% da **lógica, regras de negócio e fluxos** que comporão o novo aplicativo de finanças pessoais — **Online First**, leve e ágil. Este documento NÃO contém: offline-first, motor B3/conciliação, análises quantitativas legadas, estrutura de UI/UX, nem modelagem de tabelas (o schema será recriado do zero conforme as novas necessidades).
>
> **Escopo do novo app:** Gestão Financeira Pessoal (receitas, despesas, cartões, dívidas, orçamentos) + Análise/Diagnóstico + Projeção/Corte de Gastos + **Investimentos reduzidos ao Sistema de Rebalanceamento de Carteira** (aportes, metas percentuais por ativo/classe e cálculo do valor a aportar).
>
> **⚠️ Nota (auditoria v1.0):** documento **histórico**. Decisões posteriores superam o escopo declarado aqui — ex.: **Storage via Cloudflare R2** (D11) e **edge function de cotações** (ambas listadas como "fora do escopo" abaixo). A fonte de verdade é o `ESPECIFICACAO_TECNICA.md`.

---

## 1. VISÃO GERAL E ARQUITETURA PRETENDIDA

### 1.1 Resumo

O novo aplicativo é uma aplicação web **100% Online First**: a nuvem é a única fonte da verdade, sem caches locais, filas de sincronização ou modo offline. Leitura e escrita sempre via API/banco remoto, com estados de carregamento/erro explícitos na interface.

**Princípios arquiteturais:**

- **Online First**: nenhuma persistência local de dados de negócio; toda mutação é síncrona com a nuvem (com tratamento de erro e retry manual).
- **Lógica pura e testável**: todo cálculo (parcelamento, competência de fatura, projeções, insights, rebalanceamento) vive em módulos de domínio sem dependência de UI — consumíveis por qualquer interface.
- **Estado centralizado**: hooks/providers expõem `data | loading | error | CRUD | refresh`; a UI nova apenas consome esses contratos.
- **Separação domínio × apresentação**: formatação monetária, status derivados e cores são serviços de apresentação; as regras de negócio nunca dependem deles.

### 1.2 Escopo

| Módulo | Incluído no novo app |
|---|---|
| Receitas e despesas (diárias, fixas, parceladas, recorrentes) | ✅ |
| Cartões de crédito (faturas, competência, pagamentos, estornos) | ✅ |
| Dívidas / contas a pagar e receber (com integração despesa × cobrança) | ✅ |
| Categorias, orçamentos mensais e metas de renda | ✅ |
| Análise e diagnóstico (médias, tendências, gargalos) | ✅ |
| Projeção de gastos e sugestões de corte | ✅ |
| Relatórios por dia/mês/ano e períodos customizados | ✅ |
| Busca global | ✅ |
| Lembretes e central de notificações in-app | ✅ |
| Rebalanceamento de carteira (metas e valor de aporte) | ✅ |

---

## 2. CORE DE FINANÇAS PESSOAIS (FLUXOS E REGRAS DE NEGÓCIO)

### 2.1 Receitas (Rendas)

- **Entrada**: valor, data, categoria de renda, tipo de recebimento (`cash | pix | transfer | other`), descrição opcional, peso de relatório (0–1, default 1).
- **Validações**:
  - Categoria e valor são obrigatórios.
  - Data mínima: **APP_START_DATE (2026-01-01)** — lançamentos anteriores são rejeitados na criação e edição.
  - Valor deve ser um número finito > 0.
- **Fluxo**: CRUD completo; listagem agrupada por mês; edição preserva todos os campos; exclusão é definitiva (sem cascata para outros registros).
- **Ordenação**: data descendente; empate por `created_at` descendente.
- **Classificação**: cada receita pertence a uma categoria de renda, o que permite análise de **concentração de renda** por fonte (ver 2.7).

### 2.2 Despesas

#### 2.2.1 Registro e classificação

- **Entrada**: valor, data, categoria de despesa, forma de pagamento (`cash | debit | credit_card | pix | transfer | other`), cartão (obrigatório quando forma = `credit_card`), descrição, parcelas (1–60), peso de relatório (0–1, default 1).
- **Validações**: categoria e valor obrigatórios; data ≥ APP_START_DATE; parcelas entre 1 e 60; cartão obrigatório se pagamento no crédito.
- **Ordenação**: data desc, depois `created_at` desc.

#### 2.2.2 Parcelamento (1–60x)

- Ao parcelar, gera uma despesa por mês a partir da data inicial; todas compartilham um **`installment_group_id`** (UUID gerado na criação) e recebem `installment_number` (1..N) e `installment_total`.
- **Divisão exata em centavos**: o resto da divisão `valor ÷ N` é distribuído nas **primeiras parcelas** (ex: R$ 100 ÷ 3 → 33,34 / 33,33 / 33,33). A soma das parcelas é sempre idêntica ao valor original.
- **Competência de fatura** (quando pago no cartão): calculada por parcela (ver 2.3.2), considerando a data de cada parcela e o closing day vigente daquele mês.
- **Exclusão em 3 modos**:
  - `single`: exclui apenas a parcela selecionada;
  - `all`: exclui todo o grupo de parcelas;
  - `subsequent`: exclui a parcela-alvo e todas as posteriores (pela `installment_number`).
  - Online, os IDs do grupo são buscados na nuvem antes de excluir.
  - **Efeito cascata**: despesas excluídas removem também **dívidas pendentes vinculadas** (`expense_id` no conjunto + status `pending`); dívidas pagas nunca são tocadas.

#### 2.2.3 Edição com troca de forma de pagamento

- Se a despesa passa a ser paga no cartão de crédito → recalcula/insere a **competência de fatura** (closing day do cartão + overrides mensais da competência).
- Se deixa de ser cartão → limpa o vínculo com cartão e a competência.

#### 2.2.4 Cobrança vinculada (dívida integrada à despesa)

- Ao criar uma despesa, o usuário pode **criar simultaneamente uma dívida a pagar vinculada** (cobrança) — útil para compras cujo pagamento será quitado em outra data.
- **Validações da cobrança**: valor obrigatório, > 0 e **≤ valor da despesa**; o valor padrão sincroniza com o valor da despesa.
- A cobrança herda o **grupo de parcelas** quando a despesa é parcelada (uma cobrança por parcela) e segue o padrão de descrição `Cobrança integrada à despesa: {descrição}`.
- A quitação dessa cobrança tem fluxo integrado (ver 2.4).

#### 2.2.5 Despesas fixas e recorrentes

- **Detecção de recorrência** (motor de insights, ver 2.7) identifica lançamentos que se repetem mensalmente, sem necessidade de cadastro formal de recorrência — o sistema aprende com o histórico.

### 2.3 Cartões de Crédito

#### 2.3.1 CRUD de cartões

- **Entrada**: nome, bandeira, limite total, dia de fechamento (`closing_day`, 1–31), dia de vencimento (`due_day`), cor, ativo/inativo (`is_active`).
- Desativar um cartão (`is_active=false`) não apaga o histórico; apenas o remove de seleção/fluxos ativos.

#### 2.3.2 Competência de fatura

- Regra base: `resolveBillCompetence(purchaseDate, closingDay)` — se o **dia da compra ≥ closing day**, a despesa entra na fatura do **mês seguinte**; senão, do mês atual.
- `clampDay` limita o closing day ao intervalo 1–31 (meses com menos dias usam o último dia).
- **Overrides mensais**: é possível fixar closing day/vencimento específicos por competência (ciclo mensal do cartão); o override **prevalece** sobre o closing day padrão.
- Despesas sem competência explícita têm a competência resolvida dinamicamente pela data.

#### 2.3.3 Fatura, pagamentos e estornos

- A fatura consolida: despesas do período (com peso de relatório aplicado, guardando o valor base para auditoria), pagamentos e estornos.
- **Estorno** = pagamento com **valor negativo** OU com nota iniciando em `[REFUND]`; sem competência explícita, a competência do estorno é resolvida pela data do pagamento.
- **Estorno gera renda automática**: ao registrar um estorno, o sistema **cria automaticamente uma receita** na categoria reservada **"Estorno"**, vinculada por nota `[REFUND]{id da renda}`. Essas rendas são **somente-leitura** nos fluxos normais de rendas (não podem ser editadas, excluídas nem re-categorizadas — a categoria "Estorno" é reservada; a manutenção é feita exclusivamente pela tela de cartões, com valor no relatório limitado a 0–valor do estorno).
- Pagamento de fatura: CRUD com competência; o total pago é abatido do total previsto.
- **Seleção do mês de fatura**: ao abrir a área de cartões, o mês inicial é resolvido automaticamente — usa o **mês atual se tiver pendências**; senão varre **para trás** (mês anterior em diante, até o APP_START_DATE) em busca do mês mais recente com pendências; se nenhum, tenta o **mês seguinte**; por fim, o mês atual. Deep-links (`?card=` ou `?month=` diferente do atual) sobrepõem a seleção.
- **Saldo aberto** de uma fatura = `max(0, total previsto − total pago)` (por competência; pagamento a maior nunca gera saldo negativo).
- **Lembrete de fatura**: alerta quando existe saldo aberto, classificado como `overdue` (vencida) ou `near_due` (dentro da janela configurada, default 3 dias antes do vencimento).

### 2.4 Dívidas / Contas a Pagar e Receber

- **Entrada**: nome, tipo (`payable` = a pagar | `receivable` = a receber), valor **≥ 0**, data de vencimento, status (`pending | paid`), vínculo opcional com uma despesa (herda o grupo de parcelas).
- **Status derivado** (nunca armazenado; calculado da data):
  - `paid` — marcada como quitada;
  - `overdue` — vencida e pendente;
  - `due_today` — vence hoje;
  - `due_soon` — vence em até 3 dias;
  - `pending` — demais pendentes.
- **Quitação de dívida a pagar**: ao pagar, o usuário escolhe entre **"Pagar e Cadastrar Despesa"** (cria automaticamente a despesa correspondente, registrando a saída no fluxo de caixa) ou **"Apenas Pagar"** (marca como paga sem afetar o fluxo).
- **Quitação de dívida a receber**: ao receber, o usuário escolhe entre **"Receber e Criar Renda"** (cria automaticamente a receita correspondente nas Finanças) ou **"Apenas Receber"** (marca como recebida sem afetar o fluxo).
- **Recebimento integrado (cobrança vinculada a despesa)**: quando o recebível está vinculado a uma despesa, quitar reduz **automaticamente o valor da despesa no relatório** (desconto do pagamento); o valor final no relatório permanece **editável** pelo usuário.
- **Ordenação**: `due_date` ascendente.
- **Efeitos em totais**:
  - Dívidas **pagas** dentro do período entram nos totais do período (recebíveis → rendas; pagáveis → despesas) em relatórios e visão consolidada — o merge usa o **mês do vencimento** da dívida.
  - Dívidas **pendentes** alimentam a **projeção de pendências** (ver 2.8); os totais de Contas consideram apenas pendentes com **vencimento no mês selecionado**.
- **Exclusão vinculada**: quando a dívida está vinculada a uma despesa parcelada, a exclusão herda os modos `single | all | subsequent` do grupo de parcelas.
- **Lembrete**: alertas com janela configurável (dias antes) e `overdue`.

### 2.5 Categorias, Orçamentos e Metas

#### 2.5.1 Categorias

- CRUD de categorias de **despesa** e de **renda**, com nome, ícone e cor.
- **Sugestão inteligente por nome**: ao digitar o nome, o sistema infere ícone/cor e até limite sugerido por regra de nome (moradia, alimentação, transporte, saúde, educação, lazer, compras, outros).
- **Exclusão com migração**: ao excluir uma categoria com lançamentos, o usuário pode **mover os lançamentos para outra categoria** antes da exclusão.

#### 2.5.2 Orçamentos (despesas)

- **Limite mensal por categoria**: um valor por `(categoria, mês)`; inserção com **upsert** pela chave composta; limpar o campo remove o limite.
- **Herdança de limite**: categoria sem limite definido no mês atual **herda o limite do mês anterior** (fallback para exibição/alerta).
- **Faixas de atenção** (sobre o % de uso do limite): ≥ 85% → Atenção; ≥ 90% → Alta; ≥ 95% → Crítica; > 100% → **Excedida** (entra em alerta com valor excedido).
- **KPIs**: total de limites do mês, % global usado (`min(100, despesas ÷ (totalLimites || rendas))`), cor de progresso (≥85% vermelho, ≥70% amarelo, senão verde).
- **Sugestão de limite baseada em % da renda**, por regra de nome de categoria (ex: moradia até 30%, alimentação até 15%, transporte até 10%…).
- **Recomendação de realocação automática**: escolhe a categoria com **maior excesso** e a com **maior folga**; valor transferido = `min(excesso, folga)` arredondado ao **múltiplo de 10** (mínimo R$ 10); aplica reduzindo o limite de origem (nunca abaixo de 0) e aumentando o de destino — com confirmação do usuário.
- **Alertas**: categoria estourou o limite → entra em lista de atenção e alimenta o motor de insights (2.7).

#### 2.5.3 Metas de renda

- **Expectativa mensal por categoria de renda**: valor esperado por `(categoria de renda, mês)`, usado para comparar realizado × esperado em relatórios e insights (déficit de receita).

### 2.6 Visão Consolidada (Dia / Mês / Ano)

- **KPIs fundamentais** (aplicando peso de relatório quando habilitado):
  - `totalRendas`, `totalDespesas`, `totalInvestimentos` (aportes líquidos do mês), `saldo`.
  - `saldo = rendas − despesas − investimentos`.
  - `savingsRate = saldo ÷ rendas` (taxa de poupança).
  - **Saldo líquido de Contas** = total a receber (pendentes do mês) − total a pagar (pendentes do mês) − total de faturas em aberto.
- **Fluxo diário**: barras empilhadas por dia (rendas / despesas / investimentos) dentro do período selecionado; comparativo com o período anterior (curva de referência).
- **Agrupamentos temporais**: listagens e totais por **dia**, **mês** e **ano**; navegação de mês/ano com clamp no APP_START_DATE.
- **Orçamentos**: progresso por categoria vs limite do mês, lista de atenção e **recomendação de realocação** (ver 2.5.2).
- **Limites de relatório**: máximo de 366 dias em períodos customizados.

### 2.7 Motor de Análise e Diagnóstico (Insights)

Entrada do motor (dados do mês atual + histórico): totais, savings rate, resumos por categoria (mês atual e anteriores), totais por dia da semana, limites estourados, renda por categoria, ritmo e projeção de gastos, saldo, lista de despesas (mês atual + 3 anteriores).

#### 2.7.1 Alertas críticos (ordem de prioridade)

1. Saldo negativo;
2. Ritmo de gastos > 5% acima do esperado;
3. Limites de orçamento estourados;
4. Burn rate > 85% da renda;
5. Déficit projetado para o fim do mês (dia ≥ 10 e fora do trilho);
6. Elogio automático quando poupança ≥ 20% da renda.

#### 2.7.2 Detecção de assinaturas

- **3 sinais** combinados: nome conhecido (lista de serviços de assinatura), categoria de assinatura, valor exato (tolerância ±5%).
- Classificação por árvore de decisão com **confiança 0.40–0.98**.
- **Tiers de corte**: `essential` (essencial — não sugere corte), `discretionary` (discricionária), `can_cut` (cortável); cada ocorrência reporta `savingsIfCut` (economia mensal se cortada).

#### 2.7.3 Detecção de recorrências (3 níveis)

- `subscription` — mesmo nome + valor/categoria estável;
- `recurring` — mesma descrição, valor com tolerância ±50%;
- `similar` — mesma categoria com total ±30%, com filtros: **categorias agregadoras excluídas** (supermercado, combustível, farmácia etc.), checagem de dispersão interna, e exigência de 2+ meses quando há 3+ meses de histórico.
- Parcelas (`installment_group_id`) são **filtradas** — parcelamento não é recorrência.

#### 2.7.4 Confiança e aprendizado do usuário

- **Confiança** = base + bônus não-linear por meses de histórico (2m:+0.05 … 5m:+0.28) − penalidade de variância (0.3× para subscription, 0.8× para recurring).
- **Aprendizado**: o usuário pode **ignorar / confirmar / restaurar** cada ocorrência; o feedback entra no cálculo (ocorrência ignorada deixa de contar).

#### 2.7.5 Desafios de economia e sugestões de limite

- **Desafios de economia**: por categoria de alto gasto (reduzir 10 / 20 / 30%) + desafio "30% em não essenciais"; **limite mínimo dinâmico** = `max(R$ 20, 0,5% da renda)`; no máximo 4 desafios simultâneos.
- **Sugestões de limite**:
  - Categoria estourou → sugere aumento de `max(excesso, 15% do limite)`;
  - Categoria com uso < 50% e folga > R$ 50 → sugere redução **mantendo 30% de margem**;
  - Máximo 3 sugestões por mês.

#### 2.7.6 Diagnósticos adicionais

- **Concentração de renda**: alerta quando uma única fonte representa > 60% da renda.
- **Tendência vs mês anterior**: variação considerada significativa quando > 15%.
- **Gastos de fim de semana**: alerta quando ratio fim de semana / dia útil > 1.5.
- **Saúde da poupança**: status por faixa (crítico / baixo / moderado / saudável / forte).
- **Compromisso com investimentos**: comparação com meta de 15–20% da renda.

### 2.8 Projeção e Prospecção de Gastos

- **Gasto disponível** (orçamento diário derivado):
  - `mensalDisponível = rendas − investimentos − despesas`.
  - Mês atual: `diário = max(0, mensalDisponível ÷ diasRestantes)` com `diasRestantes = diasNoMês − diaAtual + 1` (inclui o dia de hoje).
  - Mês futuro: `diário = max(0, (rendas − investimentos) ÷ diasNoMês)` (projeção sem despesas ainda).
  - Mês encerrado: sem valor diário (apenas resultado real).
- **Ritmo de gastos (spending pace)**: comparação do acumulado do mês com a fração esperada do mês; só ativa a partir do **8º dia** e quando a fração decorrida do mês ≥ 30% (evita alarme falso no início do mês).
- **Projeção de fim de mês**: no mês atual, exige **dia ≥ 3**; `burnRate = despesas ÷ diasDecorridos`; `projeção = burnRate × diasNoMês`; `superávit projetado = rendas − investimentos − projeção`; `noTrilho = superávit ≥ 0`. Mês passado → valores reais (noTrilho = saldo real ≥ 0); mês futuro → não aplicável.
- **Projeção de pendências**: dívidas pendentes (pagáveis/recebíveis) do período com projeção de saldo (`recebíveis − pagáveis`).
- **Corte de gastos**: o motor de insights (2.7) consolida assinaturas cortáveis, recorrências, desafios e realocação de limites em **sugestões de otimização** priorizadas por impacto financeiro.

### 2.9 Busca Global

- **Gatilho**: query com **≥ 2 caracteres**; busca simultaneamente em despesas, rendas, dívidas, cartões e categorias (despesa e renda).
- **Normalização**: remove acentos e converte para minúsculas antes do matching.
- **Scoring por tipo de match**: igual 100 / prefixo 85 / contém 60; match numérico 30; match de status (dívida) 40.
- **Bônus de recência logarítmico**: mês atual +25, 1–2 meses +20, 3–4 meses +15, 5–6 meses +10, 7–12 meses +5, 12+ meses +0 — registros antigos ainda aparecem se o score de match for alto.
- **Limites**: máx 5 resultados por tipo e 12 no total; ordenação global por score decrescente.
- **Deep-link**: cada resultado navega para o registro com **destaque visual** (highlight + scroll) e o mês correto do lançamento.

### 2.10 Lembretes e Central de Notificações

- **Consolidação**: reúne alertas de **faturas de cartão** (saldo aberto por competência: vencida/em breve) e **dívidas** (a pagar/a receber pendentes: vence em X dias/vencida).
- **Ações**: **marcar como lido** e **snooze** (adiar); o snooze **expira automaticamente** quando o item vence ou atrasa (o alerta volta).
- **Ordenação**: atrasados primeiro; depois por data de vencimento.
- **Ativação**: apenas quando a preferência de lembretes está habilitada; janelas configuráveis (dias antes para dívidas e para faturas).

---

## 3. MOTOR DE REBALANCEAMENTO DE CARTEIRA

> Escopo reduzido: **apenas** definição de metas, leitura da posição atual e cálculo do aporte de reequilíbrio. Sem motor quantamental, tiers, scoring ou análise fundamentalista.

### 3.1 Metas / Alocação Alvo

- **Meta por ativo**: `target_percentage` (0–100) por `(portfólio, ticker)`. Regra: a **soma de todas as metas individuais não pode exceder 100%** (validação no domínio e reforçada no banco).
- **Meta por classe/setor** (opcional): `(portfólio, tipo de grupo: class | sector, nome do grupo) → target_percentage`.
- Valores alvo representam **% do patrimônio total** da carteira (incluindo caixa/reserva).
- Edição em lote das metas com feedback visual de soma (barra de total ≤ 100%).

### 3.2 Leitura da Posição Atual

- **Livro-razão (ledger) simplificado** de transações:
  - Tipos de operação: `buy`, `sell`, `dividend`, `jcp`, `fii_yield`, `split`, `reverse_split`, `subscription`.
  - Custo médio por ativo: `custoTotal ÷ quantidade` (atualizado a cada compra; vendas reduzem proporcionalmente pelo custo médio).
  - Proventos (`dividend/jcp/fii_yield`) acumulam separadamente e **não alteram custo** nem posição.
  - Split soma cotas; reverse split subtrai cotas.
  - Tickers de caixa são tratados com valor 1:1 (quantidade = valor).
- **Caixa derivado do ledger**: o saldo de caixa da carteira é sempre derivado das transações — compras/subscrições debitam caixa; vendas e proventos creditam — garantindo consistência com a posição.
- **Valoração atual** por classe (simplificada):
  - Ativos de mercado (ações/FIIs/ETFs B3 e internacionais): cotação de mercado (ver Seção 5).
  - Renda fixa / Tesouro: valor atual manual ou valor aplicado (sem curva de indexador no novo escopo).
  - Caixa: valor direto.
- **Posição atual vs desejada** por ativo e por classe:
  - `valorAtual(pct) = valorAtual ÷ patrimônioTotal × 100`
  - `gapPct = targetPct − pctAtual`
  - `gapFinanceiro = gapPct% × patrimônioTotal` (valor em R$ necessário para alinhar).
- Conversão de moeda: ativos internacionais (tickers de 2–5 letras) são convertidos a BRL pela cotação `USDBRL=X` (fallback fixo 5,25 quando indisponível).

### 3.3 Algoritmo de Sugestão de Aporte (Rebalanceamento)

**Entrada**: valor do aporte, posições atuais, metas por ativo e por classe, travas setoriais.

**Passos** (`simulateSmartAporte` / `simulateRebalanceAporte`):

1. **Defasagem macro por classe**: identifica classes abaixo do target (classe com maior déficit relativo recebe prioridade).
2. **Filtro de elegibilidade**: ativos com meta definida, sem meta zerada, e com folga no limite absoluto.
3. **Ordenação**: ativos elegíveis ordenados pelo **gap financeiro** (maior déficit primeiro), respeitando a prioridade da classe.
4. **Distribuição**: aloca o aporte até cobrir cada gap (respeitando o limite absoluto de cada ativo = meta individual ou fração da meta da classe).
5. **Travas setoriais**: limites máximos de exposição por setor (`max_sector_acoes`, `max_sector_fiis`) impedem alocação que ultrapasse o teto do setor.
6. **Quantidades inteiras**: compras sugeridas em **quantidades inteiras** (preço unitário × quantidade ≤ valor alocado); o excedente permanece alocado no próximo ativo.
7. **Sobra**: valor não alocado (por teto, trava ou arredondamento) vai para **caixa/reserva**.
8. **Log de roteamento**: a sugestão gera um relatório completo — por ativo: valor alvo, valor atual, aporte sugerido, quantidade e preço; sobra final.

**Regras de consistência**:

- A soma dos aportes sugeridos nunca excede o valor do aporte informado.
- Ativo sem meta não recebe aporte.
- Aporte só é sugerido para ativos **abaixo** da meta (gap > 0).
- O rebalanceador pode operar em 2 modos: **por meta individual de ativo** ou **por meta de classe** (distribuindo o déficit da classe proporcionalmente entre seus ativos).

---

## 4. REGRAS DE NEGÓCIO, VALIDAÇÕES E CÁLCULOS ESSENCIAIS

### 4.1 Datas e calendário

- **APP_START_DATE = 2026-01-01**: criação/edição de despesas e rendas com data anterior é **bloqueada** (mensagem específica); navegação de mês é clampeada a `2026-01`.
- Datas tratadas em **timezone local** (nunca usar `toISOString` para ranges de mês); parsing com `new Date('YYYY-MM-DDT12:00:00')`/`T00:00:00` para evitar drift de fuso.
- Dia da semana com índice **Monday-first** (`(getDay()+6)%7`) para Sé a Dom em relatórios/insights.
- Último dia do mês detectado por "+1 dia muda de mês" (robusto a 30/31/fevereiro).
- Navegação de mês: mês seguinte = `+1 mês` (evita salto de fevereiro para abril).

### 4.2 Moeda e arredondamento

- Valores monetários: **2 casas decimais**; `report_weight`: 4 casas (0–1).
- **Divisão de parcelas em centavos** com resto distribuído nas primeiras parcelas (soma sempre igual ao original).
- **Peso de relatório derivado**: quando o usuário define um valor de relatório customizado (ex.: estornos), `peso = valorNoRelatório ÷ valorBase`, arredondado a **4 casas**.
- **Peso na fatura**: `amountExibido = base × peso` (2 casas) com **`base_amount` sempre preservado** para auditoria; pesos desabilitados → amount = base.
- Parsing monetário tolerante: `R$`, parênteses (negativos), sinais, "1.234,56" vs "1234.56", múltiplas vírgulas/pontos.
- Máscara de entrada monetária com `Intl.NumberFormat` pt-BR e `inputMode=numeric`.
- **Conversão USD**: ativos internacionais convertidos pela cotação `USDBRL=X`; fallback fixo **5,25**; moeda inferida pelo padrão do ticker (2–5 letras sem números = USD; B3/RF/cripto = BRL).
- Guardrail de **spike de preço > 50% em um dia** → mantém o último preço válido (proteção contra dados corrompidos de API).

### 4.3 Somatórios e derivações

- `saldo = rendas − despesas − investimentos`; `savingsRate = saldo ÷ rendas` (rendas = 0 → sem taxa).
- **Saldo líquido de Contas** = total a receber − total a pagar − total de faturas em aberto (2 casas), onde:
  - `faturaAberto(por cartão ativo) = max(0, previsto − pago)` — **nunca negativo**;
  - `totalPagar`/`totalReceber` somam apenas dívidas **pendentes com vencimento no mês selecionado**.
- Proventos de investimento (`dividend/jcp/fii_yield`) somam como **investimento negativo** no fluxo mensal; compras/subscrições somam positivo.
- Relatórios **somam dívidas pagas** ao total do período (recebíveis → rendas; pagáveis → despesas), pelo mês do vencimento; o saldo é recalculado.
- Somatório de transações do mês usa a **data da transação**.
- **Recebimento integrado**: quitar um recebível vinculado a uma despesa reduz o valor da despesa no relatório pelo valor recebido (resultado editável).
- Totais de fatura: previsto (peso aplicado, com valor base auditável) − pago = saldo aberto (clamp ≥ 0).
- Percentual de meta: soma das metas por ativo **não pode exceder 100%**.

### 4.4 Ordenações padrão

- Despesas e rendas: data desc, depois `created_at` desc.
- Dívidas: `due_date` asc.
- Dias da semana em relatórios: Segunda → Domingo.
- Listas por mês: navegação de mês a mês (mais recente primeiro).
- Alertas de notificação: atrasados primeiro, depois por vencimento.

### 4.5 Validações de formulário (mensagens pt-BR)

| Campo | Regra |
|---|---|
| Categoria (despesa/renda) | Obrigatória |
| Valor | Obrigatório, numérico finito > 0 |
| Data (despesa/renda) | ≥ APP_START_DATE (2026-01-01) |
| Parcelas | Inteiro entre 1 e 60 |
| Peso de relatório | Decimal 0–1 (default 1) |
| Cartão | Obrigatório se forma de pagamento = `credit_card` |
| Dívida — valor | ≥ 0 |
| Cobrança vinculada a despesa | Valor obrigatório, > 0 e ≤ valor da despesa |
| Meta de ativo | Percentual 0–100; soma ≤ 100% |
| Período customizado | Máx 366 dias |
| Dia de fechamento/vencimento | 1–31 (clamp) |

- **Estados de erro**: mensagens padronizadas pt-BR via gateway único (`getErrorMessage`); casos especiais: rate limit (aguarde alguns minutos), e-mail não confirmado, sessão expirada, rede indisponível (Online First → erro explícito com tentar novamente).

### 4.6 Estados vazios e limites de exibição

- Estados vazios dedicados: sem lançamentos no mês, sem categorias, sem metas de carteira, sem insights.
- Listagens com limites de itens por visualização (ex: top N por categoria em relatórios) e busca textual em drill-downs.

---

## 5. INTEGRAÇÕES & SERVIÇOS NECESSÁRIOS

> Apenas o essencial para um app Online First. Sem caches locais, filas ou sincronização.

| Serviço | Uso | Observações |
|---|---|---|
| **Supabase (BaaS)** | Autenticação (e-mail/senha, reset de senha, sessão), banco Postgres com RLS por usuário | Fonte única da verdade; todas as tabelas com políticas de segurança por dono (`auth.uid()`) |
| **Auth + Perfil** | Login, registro, recuperação de senha; perfil com nome/exibição | Fluxo opcional de aprovação de novos usuários (admin) caso o app mantenha multi-usuário |
| **Cotação de ativos (Yahoo Finance)** | Preço de mercado de ações/FIIs/ETFs B3 e internacionais **somente** para a valoração usada no rebalanceamento | Acesso via proxy CORS (cascata) com timeouts curtos; cache **em servidor** (tabela de preços) para não depender do cliente; fallback de preços estáticos; tickers: B3 com `.SA`, internacionais diretos, cripto com `-BRL` |
| **Notificações (opcional)** | Lembretes de vencimento de faturas e dívidas | Pode ser via push (edge function) ou in-app apenas — decisão do novo escopo |

**Fora do escopo**: Storage, Realtime (se não houver colaboração), Edge Functions de fechamento diário/TWR, chat IA, WebAuthn/biometria (reavaliar), SGS/VNA (sem curva de renda fixa).

---

## 6. ROADMAP DE RECONSTRUÇÃO DO ZERO

> Princípio: **infra → domínio → análise → investimentos → UI**. Cada fase entrega módulos puros e testáveis, prontos para qualquer interface.

### Fase 1 — Infraestrutura & Autenticação (Online First)

1. Setup do repositório novo: TypeScript estrito, CI (typecheck + lint + testes).
2. Cliente de dados único (Supabase) com módulo de env; estado de conexão/erro explícito.
3. Autenticação: login, registro, recuperação de senha, sessão, perfil (nome/email).
4. Contratos de domínio (tipos): Receita, Despesa, Cartão, Dívida, Categoria, Orçamento, Meta, Transação de Carteira.
5. **Schema novo** do banco (recriado do zero): tabelas de usuário, categorias, receitas, despesas (com grupo de parcelas e competência), cartões, ciclos mensais, dívidas, limites/expectativas, carteira (metas, transações, posições), com RLS por dono e constraints de integridade (soma de metas ≤ 100%, parcelas 1–60).

### Fase 2 — Core de Finanças Pessoais

6. CRUD de receitas e despesas com **parcelamento** (1–60x, divisão em centavos) e **competência de fatura** (closing day + overrides mensais).
7. Cartões: faturas, pagamentos, estornos (`[REFUND]`/negativo → renda automática na categoria reservada "Estorno"), seleção automática de mês em aberto, saldo aberto (clamp ≥ 0).
8. Dívidas: status derivado (atrasada / vence hoje / vence em breve), **cobrança vinculada** (criação junto da despesa, herança de parcelas), **quitação com criação de despesa/renda**, recebimento integrado (reduz valor da despesa no relatório), cascata de exclusão (dívidas pendentes vinculadas).
9. Categorias, **orçamentos mensais** (limite por categoria, herança do mês anterior, faixas de atenção 85/90/95%, sugestão por % da renda, **realocação automática**) e **metas de renda** (expectativa por categoria).
10. Visão consolidada dia/mês/ano: KPIs (rendas, despesas, investimentos, saldo, savings rate, saldo líquido de Contas), fluxo diário, comparativo com período anterior, pesos de relatório.
11. **Busca global** (scoring com recência, limites por tipo, deep-link com destaque).

### Fase 3 — Motor de Análise, Projeção & Corte de Gastos

12. **Motor de insights** (módulos puros): alertas críticos priorizados, assinaturas (3 sinais + tiers de corte), recorrências (3 níveis), confiança com aprendizado do usuário (ignorar/confirmar).
13. **Desafios e sugestões**: desafios de economia (10/20/30%), sugestões de limite (aumento/redução com margens), realocação de orçamento.
14. **Projeção**: gasto disponível diário (atual e projetado), ritmo de gastos (a partir do 8º dia / ≥30% do mês), projeção de fim de mês (burn rate, dia ≥ 3), projeção de pendências.
15. **Relatórios**: summaries mensais/anuais, agregação por categoria/forma de pagamento/dia da semana, períodos customizados (máx 366 dias), comparação com período anterior, merge de dívidas pagas.
16. **Central de lembretes/notificações**: consolidação de faturas e dívidas, marcar como lido, snooze com expiração ao vencer, ordenação atrasados primeiro.

### Fase 4 — Módulo de Rebalanceamento de Investimentos

17. Ledger simplificado de carteira (buy/sell/proventos/splits; custo médio; caixa derivado do ledger).
18. Valoração atual (mercado via cotação com fallback; RF/caixa por valor manual/direto; conversão USD).
19. Metas por ativo e por classe/setor com validação de soma ≤ 100% e travas setoriais.
20. **Calculadora de aporte**: algoritmo de rebalanceamento (defasagem por classe → gap financeiro → alocação → quantidades inteiras → sobra para caixa → log de roteamento).

### Fase 5 — Preparação para Integração com a Nova UI/UX

21. **Contratos de estado**: hooks/providers com retorno semântico (`data | loading | error | CRUD | refresh`) para cada domínio — consumíveis pela nova interface sem acoplamento.
22. **Dados derivados como funções puras**: KPIs, séries, pizzas, insights estruturados, projeções, sugestões de aporte.
23. **Serviços de apresentação**: formatação monetária, status de dívida, cores de categoria, máscaras — via tokens/constantes.
24. **Gateway de validação e erros**: mensagens pt-BR centralizadas, limites de domínio (data ≥ 2026-01-01, parcelas 1–60, pesos 0–1, soma de metas ≤ 100%).
25. **Prova de fidelidade**: suíte de testes espelhando cada regra desta especificação, garantindo que a reconstrução preserva o comportamento funcional.

---

### Anexo A — Glossário de termos de domínio

| Termo | Definição |
|---|---|
| `installment_group_id` | Identificador único do grupo de parcelas de uma despesa |
| `bill_competence` | Mês da fatura de cartão a que a despesa pertence |
| `closing_day` / `due_day` | Dia de fechamento / vencimento da fatura do cartão |
| `report_weight` | Peso (0–1) que a despesa/receita exerce nos relatórios |
| `APP_START_DATE` | Data mínima aceita para lançamentos (2026-01-01) |
| `cobrança vinculada` | Dívida a pagar criada junto de uma despesa (herda parcelas) |
| `target_percentage` | Percentual-alvo de um ativo/classe no patrimônio total |
| `gap_financeiro` | Valor em R$ necessário para alinhar a posição à meta |
| `burn rate` | Gasto médio diário usado na projeção de fim de mês |
| `gasto disponível` | Orçamento diário derivado = mensalDisponível ÷ dias restantes |
| `savingsRate` | Taxa de poupança = saldo ÷ rendas do período |
