# Dossiê Executivo de Auditoria Forense e Contra-Prova

> **Sistema:** Axir — Gestão Financeira Pessoal & Carteira de Investimentos  
> **Identificador Único:** `AUDIT-MWN19EDI`  
> **Data / Hora de Emissão:** 2026-11-19T04:11:25.062Z  
> **Ambiente de Execução:** `synthetic`  
> **Duração Total da Auditoria:** 18.97ms  
> **Confiabilidade Global (Score):** **100%** (39/39 asserções íntegras)

---

## 1. Resumo Executivo por Módulo de Negócio

| Módulo Auditado | Confiabilidade | Aprovadas | Falhas | Total de Regras | Status Forense |
|---|:---:|:---:|:---:|:---:|:---:|
| Investimentos & Custódia | **100%** | 7 | 0 | 7 | `APROVADO` |
| Inteligência & SmartAdvisor | **100%** | 3 | 0 | 3 | `APROVADO` |
| Cartões & Faturas | **100%** | 2 | 0 | 2 | `APROVADO` |
| Contratos de Crédito (Price/SAC) | **100%** | 2 | 0 | 2 | `APROVADO` |
| Dívidas & Quitações | **100%** | 1 | 0 | 1 | `APROVADO` |
| Modo Viagem & Racha | **100%** | 2 | 0 | 2 | `APROVADO` |
| Orçamento Familiar | **100%** | 1 | 0 | 1 | `APROVADO` |
| Orçamentos & Provisões | **100%** | 2 | 0 | 2 | `APROVADO` |
| Cash Gap & Pistas de Liquidez | **100%** | 1 | 0 | 1 | `APROVADO` |
| Módulos Auxiliares (Pix, Backup, Cripto) | **100%** | 2 | 0 | 2 | `APROVADO` |
| Ciclo de Vida & Transições de Estado | **100%** | 16 | 0 | 16 | `APROVADO` |

---

## 2. Invariantes com Divergência Forense

> [!NOTE] Nenhuma divergência contábil ou financeira detectada. Todas as 39 regras matemáticas operam com precisão de um centavo (R$ 0,01) e zero arredondamentos intermediários.

---

## 3. Detalhamento de Auditoria por Persona Teórica

### 3.1. Investidor Consolidado (Caso BR-20261118-6445) (`persona-investor-6445`)

- **Descrição do Cenário de Estresse:** Reproduz a carteira real multimoeda de 26 ativos, 6 ETFs em USD com PTAX histórica, R$ 1.794,47 em proventos e 26 competências mensais.
- **Desempenho em Memória:** 0.76ms
- **Resultado:** **4/4** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-PORT-01` | Partida Dobrada e Balanço Econômico | `1977.25` | `1977.25` | 0 |
| `OK` | `INV-PORT-02` | Custódia Total (Ativos + Caixa) | `17503.68` | `17503.68` | 0 |
| `OK` | `INV-PORT-03` | Custo com PTAX Histórica (USD ETFs) | `Diferente de CustoUSD * PTAX_atual (preservação cambial)` | `Custo histórico preservado` | 0 |
| `OK` | `INV-PORT-05` | Metas 100% e Soma de Gaps R$ 0,00 | `100` | `100` | 0 |


### 3.2. Estresse Temporal & Continuidade de Séries (`persona-temporal-stress`)

- **Descrição do Cenário de Estresse:** Testa ausência de dados em agosto/2026, fluxos com ponderação diária Wi e resgate extremo de 98% para blindagem de TWR/TIR.
- **Desempenho em Memória:** 0.1ms
- **Resultado:** **1/1** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-PORT-04` | Continuidade de Espinha Temporal (Mês em Branco) | `5` | `5` | 0 |


### 3.3. Cartões, Parcelas & Empréstimos (`persona-cards-loans`)

- **Descrição do Cenário de Estresse:** Testa partição exata de centavos em dízimas periódicas, regra de corte de fatura, estorno de compras, crédito rotativo e CDC art. 52.
- **Desempenho em Memória:** 1.18ms
- **Resultado:** **4/4** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-CARD-01` | Conservação Estrita de Centavos em Parcelamentos | `1110000` | `1110000` | 0 |
| `OK` | `INV-CARD-02` | Corte de Competência de Fatura (Closing Day) | `2026-10 | 2026-11` | `2026-10 | 2026-11` | 0 |
| `OK` | `INV-LOAN-01` | Desconto a Valor Presente em Quitação Antecipada (CDC art. 52) | `Valor pago < Original (2995452 cts)` | `Valor pago = 2682505 cts (desconto = 312947 cts)` | 0 |
| `OK` | `INV-LOAN-02` | Saldo Devedor Final Rigorosamente R$ 0,00 | `Saldo final SAC = 0 e Price = 0` | `Saldo final SAC = 0 cts e Price = 0 cts` | 0 |


### 3.4. Modo Viagem & Racha de Despesas (`persona-trips-split`)

- **Descrição do Cenário de Estresse:** Testa racha com 4 participantes, divisões desiguais, conversão cambial (EUR/USD para BRL), acertos via Pix e invariante de soma zero.
- **Desempenho em Memória:** 0.99ms
- **Resultado:** **2/2** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-TRIP-01` | Conservação Contábil de Soma Zero | `0` | `0` | 0 |
| `OK` | `INV-TRIP-02` | Liquidação Ótima Min-Cash-Flow | `<= 3 transferências` | `3 transferências geradas` | 0 |


### 3.5. Orçamento Familiar & Provisões (`persona-family-budget`)

- **Descrição do Cenário de Estresse:** Testa divisão proporcional à renda (60/40), regra 50/30/20, provisões carimbadas com 1/12 e envelopes orçamentários.
- **Desempenho em Memória:** 0.21ms
- **Resultado:** **3/3** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-FAM-01` | Rateio Proporcional à Renda & Conservação | `Soma das partes === Valor da despesa` | `Conservação estrita de 100%` | 0 |
| `OK` | `INV-BUD-01` | Fechamento da Matriz Orçamentária 50/30/20 | `1500000` | `1500000` | 0 |
| `OK` | `INV-BUD-02` | Provisão Anual 1/12 (IPVA/IPTU) | `1/12 do alvo anual para cada provisão` | `Alinhamento exato de 1/12` | 0 |


### 3.6. Casos Limite & Divisão por Zero (`persona-boundary-zero`)

- **Descrição do Cenário de Estresse:** Testa usuário recém-criado com saldo zero, proteção contra NaN em Sharpe/volatilidade, timestamp 29/02/2028 23:59:59 e cripto de 8 decimais.
- **Desempenho em Memória:** 0.29ms
- **Resultado:** **3/3** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-BND-01` | Blindagem contra Divisão por Zero (Sharpe/Volatilidade) | `Valores numéricos finitos (0.00), null seguro e não-NaN` | `volEmpty=0, volSingle=0, sharpe=null` | 0 |
| `OK` | `INV-BND-02` | Imutabilidade de Timestamp Local em Ano Bissexto | `2028-02-29` | `2028-02-29` | 0 |
| `OK` | `INV-BND-03` | Precisão Numérica de 8 Decimais em Criptoativos | `666` | `666` | 0 |


### 3.7. Bateria de Estresse de Insights (100 Eventos) (`persona-insights-stress`)

- **Descrição do Cenário de Estresse:** Testa 100 eventos simultâneos, ordenação por criticidade, cooldown de 30 dias de dispensas, radar de fatura >= 90% e provisão anual 1/12.
- **Desempenho em Memória:** 0.36ms
- **Resultado:** **3/3** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-INS-01` | Ordenação Estrita por Severidade (SmartAdvisor) | `critical >= warning >= info >= success` | `Ordenação hierárquica respeitada` | 0 |
| `OK` | `INV-INS-02` | Cooldown de 30 Dias em Dispensas de Insights | `Tópicos 0 e 1 ativos no cooldown; tópico 2 liberado` | `Filtro temporal de cooldown íntegro` | 0 |
| `OK` | `INV-INS-03` | Radar Preventivo de Limite de Cartão (>= 90%) | `Alerta preventivo ativado para uso >= 90%` | `Uso = 93% (Alerta acionado)` | 0 |


### 3.8. Módulos Avançados & Auxiliares (`persona-advanced-modules`)

- **Descrição do Cenário de Estresse:** Testa Pix EMV com CRC-16 BACEN, runway D+0/D+1, comparador Bola de Neve vs Avalanche e hash de integridade SHA-256.
- **Desempenho em Memória:** 1.26ms
- **Resultado:** **3/3** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-AUX-01` | Checksum CRC-16 BACEN do Pix BR Code | `3600` | `3600` | 0 |
| `OK` | `INV-AUX-02` | Pista de Liquidez Imediata (Reserva D+0/D+1) | `6` | `6` | 0 |
| `OK` | `INV-AUX-03` | Otimização Financeira da Quitação Avalanche | `Juros Avalanche <= Juros Bola de Neve` | `Avalanche: 1266570 cts vs Neve: 1423910 cts (Economia = 157340 cts)` | 0 |


### 3.9. Ciclo de Vida & Transições de Estado (`persona-lifecycle-forensics`)

- **Descrição do Cenário de Estresse:** Certificação das 16 invariantes de ciclo de vida cobrindo os 8 pilares da aplicação Axir.
- **Desempenho em Memória:** 7.17ms
- **Resultado:** **16/16** asserções aprovadas (0 falhas)

| Status | ID | Invariante Auditado | Esperado | Encontrado | Divergência |
|:---:|---|---|---|---|:---:|
| `OK` | `INV-LFC-01` | Blindagem Hermetica de Feature Gates em Contas Free | `false (bloqueio estrito)` | `false (bloqueio estrito)` | 0 |
| `OK` | `INV-LFC-02` | Idempotencia Estrita de Transicao de Assinatura | `14388` | `14388` | 0 |
| `OK` | `INV-LFC-03` | Conformidade do Direito de Arrependimento (CDC Art. 49) | `14388` | `14388` | 0 |
| `OK` | `INV-LFC-04` | Invariante Anti-Orfandade na Exclusao de Categorias | `0` | `0` | 0 |
| `OK` | `INV-LFC-05` | Congruencia Estrita com CATEGORY_ICON_MAP e Isencao de Emojis | `0` | `0` | 0 |
| `OK` | `INV-LFC-06` | Conservacao de Centavos na Exclusao Parcial de Parcelamentos | `66666` | `66666` | 0 |
| `OK` | `INV-LFC-07` | Desconto a Valor Presente em Amortizacoes (CDC Art. 52 § 2º) | `totalPresentValuePaidCents < totalOriginalAmountCents` | `Desconto de 59348 centavos aplicado.` | 0 |
| `OK` | `INV-LFC-08` | Limite Legal de Multa por Impontualidade no Rotativo (CDC Art. 52 § 1º) | `5000` | `5000` | 0 |
| `OK` | `INV-LFC-09` | Conservacao Patrimonial em Splits e Reverse Splits | `3500` | `3500` | 0 |
| `OK` | `INV-LFC-10` | Estabilidade de Preco Medio Pos-Alienacao Parcial | `20` | `20` | 0 |
| `OK` | `INV-LFC-11` | Isencao de IRPF em Vendas de Acoes ate R$ 20.000,00/mes | `0` | `0` | 0 |
| `OK` | `INV-LFC-12` | Reversibilidade Temporal Estrita de Operacoes (Rollback / Estorno) | `1000000` | `1000000` | 0 |
| `OK` | `INV-LFC-13` | Fechamento Proporcional da Renda no Orcamento Familiar | `355555` | `355555` | 0 |
| `OK` | `INV-LFC-14` | Invariante de Reducao Otima do Min-Cash-Flow em Viagens | `<= 4 transferencias` | `3 transferencias` | 0 |
| `OK` | `INV-LFC-15` | Imunidade a Duplicacao de Insights durante Cooldown | `dia8=suprimido, dia35=liberado` | `dia8=suprimido, dia35=liberado` | 0 |
| `OK` | `INV-LFC-16` | Integridade Criptografica SHA-256 e Nao-Colisao de Backups | `valido=true, adulterado=false` | `valido=true, adulterado=false` | 0 |


---

## 4. Dossiê Forense de Ciclo de Vida e Transições de Estado

Esta seção comprova o funcionamento determinístico e a integridade de transição de estado ao longo de 8 jornadas completas de usuário cobrindo os 8 pilares da aplicação em modo headless puro (0 DOM, 0 rede).

**Métricas Globais de Ciclo de Vida:**
- **Jornadas Auditadas:** 8/8
- **Passos Consecutivos Validados:** **56/56** (100% íntegros)
- **Tolerância a Efeitos Colaterais:** Zero poluição em tabelas de produção do Supabase

| ID da Jornada | Pilar de Negócio | Nome da Jornada | Status | Passos Aprovados | Latência |
|---|---|---|:---:|:---:|:---:|
| `JRN-AUTH-01` | `auth` | Ciclo Completo de Autenticação, Onboarding & Governança | `APROVADO` | 7/7 | 0.24ms |
| `JRN-SUBS-01` | `subscription` | Ciclo de Assinatura, Checkout Pix, CDC 49 & Feature Gates | `APROVADO` | 7/7 | 0.29ms |
| `JRN-CAT-01` | `categories` | Taxonomia, Hierarquia Pai/Filho & Reconciliação de Órfãos | `APROVADO` | 7/7 | 0.24ms |
| `JRN-CARD-01` | `transactions` | Lançamento Multi-Passos, Parcelamentos 60x & Quitação CDC 52 | `APROVADO` | 7/7 | 1.02ms |
| `JRN-INV-01` | `portfolio` | Eventos Corporativos, Splits, Apuração Fiscal & Renda Fixa | `APROVADO` | 7/7 | 0.23ms |
| `JRN-FAM-01` | `goals_budgets` | Orçamento Base Zero, Provisões Anuais & Convite Familiar Modular | `APROVADO` | 7/7 | 1.96ms |
| `JRN-TRIP-01` | `trips` | Viagem em Grupo, Câmbio Internacional & Racha Min-Cash-Flow | `APROVADO` | 7/7 | 0.47ms |
| `JRN-DATA-01` | `insights` | Insights SmartAdvisor, Snooze Qualificado & Backup Snapshot | `APROVADO` | 7/7 | 0.22ms |

### 4.1. Passo a Passo Analítico das Jornadas de Ciclo de Vida

#### JRN-AUTH-01 — Ciclo Completo de Autenticação, Onboarding & Governança (auth)
- **Passo 1 [OK]:** Cadastro Inicial (Signup) e Criação de Perfil (0.05ms)  
  _Conta novo.investidor@axir.app criada com tier trial e papel user._
- **Passo 2 [OK]:** Moderação Administrativa e Liberação de Acesso (0.01ms)  
  _Conta liberada para fluxo de primeiro acesso._
- **Passo 3 [OK]:** Boas-Vindas & Setup de Perfil e Renda Mensal (0.01ms)  
  _Renda mensal cadastrada em R$ 15.000,00 (1500000 cts)._
- **Passo 4 [OK]:** Injeção e Conformidade do Catálogo Inicial de Categorias (0.04ms)  
  _8 categorias canônicas injetadas com 100% de ícones válidos em CATEGORY_ICON_MAP._
- **Passo 5 [OK]:** Registro de PIN de Segurança Numérico de 4 a 6 Dígitos (0.03ms)  
  _PIN validado e persistido com hash criptográfico._
- **Passo 6 [OK]:** Validação de Complexidade Estrita para Troca de Senha (0.03ms)  
  _Requisitos de comprimento, caracteres maiúsculos, numéricos e especiais atendidos._
- **Passo 7 [OK]:** Salvaguarda de Acesso Operacional (RequireAdminSession) (0.01ms)  
  _Acesso a /admin rigorosamente bloqueado para role=user e concedido para superadmin._

#### JRN-SUBS-01 — Ciclo de Assinatura, Checkout Pix, CDC 49 & Feature Gates (subscription)
- **Passo 1 [OK]:** Ativação e Cálculo Determinístico do Período Trial (14 dias) (0.07ms)  
  _Trial ativado de 2026-11-01 até 2026-11-15._
- **Passo 2 [OK]:** Geração e Verificação de Checksum CRC-16 BACEN do Pix Copia e Cola (0.1ms)  
  _Payload EMV gerado com CRC-16 7CDB validado com sucesso._
- **Passo 3 [OK]:** Confirmação de Pagamento e Ativação do Plano Pro Mensal (0.03ms)  
  _Plano Pro Mensal ativado com competência válida até 2026-12-10._
- **Passo 4 [OK]:** Auditoria de Direito de Arrependimento de 7 Dias (CDC Art. 49) (0.01ms)  
  _Reembolso integral de 100% comprovado: R$ 29,90 (2990 cts)._
- **Passo 5 [OK]:** Cancelamento Voluntário Pós-CDC com Retenção até o Fim da Competência (0.01ms)  
  _Zero reembolso e vigência dos recursos Pro mantida até o encerramento do ciclo pago._
- **Passo 6 [OK]:** Downgrade para Modo Somente Leitura com Preservação Integral de Histórico (0.03ms)  
  _100% dos ativos e lançamentos preservados intactos após encerramento da assinatura._
- **Passo 7 [OK]:** Comprovação de Feature Gates sem Vazamento de Dados no Plano Read-Only (0ms)  
  _Criação de novos ativos e viagens bloqueada para tier read_only sem degradar leitura._

#### JRN-CAT-01 — Taxonomia, Hierarquia Pai/Filho & Reconciliação de Órfãos (categories)
- **Passo 1 [OK]:** Criação de Hierarquia de Taxonomia (Categoria Pai e Subcategoria Filha) (0.06ms)  
  _Categoria pai 'Habitação & Moradia' e filha 'Taxa Condominial' estruturadas._
- **Passo 2 [OK]:** Validação Estrita de Ícones em CATEGORY_ICON_MAP e Isenção de Emojis (0.02ms)  
  _Ícones Home e Building2 homologados na escala Lucide sem caracteres decorativos._
- **Passo 3 [OK]:** Mutação Segura de Atributos (Nome e Paleta de Cores) (0.06ms)  
  _Atributos atualizados preservando integridade de identificador e chave estrangeira._
- **Passo 4 [OK]:** Vinculação de Despesas Recorrentes à Subcategoria Filha (0.03ms)  
  _2 transações (R$ 1.300,00 total) atreladas à subcategoria filha._
- **Passo 5 [OK]:** Bloqueio Estrito de Exclusão de Categoria com Transações sem Realocação (0.01ms)  
  _Exclusão interrompida preventivamente para evitar geração de lançamentos órfãos._
- **Passo 6 [OK]:** Exclusão Atômica com Realocação de Transações para o Pai (0.02ms)  
  _Subcategoria removida e todas as despesas reatribuídas com sucesso à categoria pai._
- **Passo 7 [OK]:** Salvaguarda de Órfãos e Auditoria de Chaves Estrangeiras (0.02ms)  
  _Zero transações com category_id inválido ou nulo no estado consolidado._

#### JRN-CARD-01 — Lançamento Multi-Passos, Parcelamentos 60x & Quitação CDC 52 (transactions)
- **Passo 1 [OK]:** Cadastro de Cartão de Crédito com Dia de Fechamento (closing_day = 10) (0.04ms)  
  _Cartão Platinum configurado com R$ 20.000,00 de limite e fechamento dia 10._
- **Passo 2 [OK]:** Corte de Fatura: Compra no Dia 09 Alocada na Fatura de Maio (Mês Atual) (0.39ms)  
  _1ª parcela em 2026-05 e 12ª parcela em 2027-04._
- **Passo 3 [OK]:** Corte de Fatura: Compra no Dia 10 Projetada para Junho (Mês Subsequente) (0.09ms)  
  _Fatura fechada no dia 10: 1ª parcela jogada para 2026-06 e última para 2026-12._
- **Passo 4 [OK]:** Conservação Exata de Centavos em Parcelamento de Dízima Periódica (0.02ms)  
  _Soma das 7 parcelas = R$ 1.000,00 (100000 cts). Parcela 1: R$ 142,90; Parcelas 2..7: R$ 142,85._
- **Passo 5 [OK]:** Pagamento Parcial de Fatura & Cômputo de Crédito Rotativo (0.03ms)  
  _Fatura de R$ 442,90 paga parcialmente em R$ 300,00; saldo rotativo = R$ 142,90._
- **Passo 6 [OK]:** Contrato de Empréstimo em 24x com Cronograma Price Amortizado a Zero (0.13ms)  
  _Cronograma de 24 meses Price atinge saldo devedor de R$ 0,00 na última parcela._
- **Passo 7 [OK]:** Quitação Antecipada Extraordinária com Abatimento Proporcional (CDC 52 § 2º) (0.29ms)  
  _6 parcelas finais liquidadas: valor nominal = R$ 3172.29; pago = R$ 2335.17; desconto = R$ 837.12._

#### JRN-INV-01 — Eventos Corporativos, Splits, Apuração Fiscal & Renda Fixa (portfolio)
- **Passo 1 [OK]:** Aporte Inicial de Ações com Débito Sincronizado do Saldo em Caixa (0.06ms)  
  _100 PETR4 @ R$ 30,00; Caixa reduzido de R$ 50.000,00 para R$ 47000.00._
- **Passo 2 [OK]:** Aporte Adicional com Recálculo Ponderado de Preço Médio (0.04ms)  
  _Posição consolidada: 200 cotas com PM ponderado em R$ 35,00 (Custo total: R$ 7.000,00)._
- **Passo 3 [OK]:** Desdobramento (Split 1:2) com Conservação Exata do Custo Total (0.01ms)  
  _Cotas desdobradas de 200 para 400; PM ajustado para R$ 17,50; Custo Total conservado em R$ 7.000,00._
- **Passo 4 [OK]:** Venda Parcial de Ações com Apuração de Ganho e Isenção Fiscal (<= R$ 20k) (0.02ms)  
  _Venda de R$ 2.500,00 (Lucro R$ 750,00) isenta de DARF. 300 cotas remanescentes preservam PM de R$ 17,50._
- **Passo 5 [OK]:** Alienação de FII sem Isenção com Retenção Obrigatória de DARF 20% (0.02ms)  
  _Venda de 20 cotas com ganho de R$ 400,00 gerando DARF devida de R$ 80,00 (alíquota legal de 20%)._
- **Passo 6 [OK]:** Cômputo de Renda Fixa Privada e Tabela Regressiva de IR (20%) (0ms)  
  _Resgate de R$ 10.000 com rendimento de R$ 600,00 e retenção de IR de R$ 120,00 (líquido R$ 10.480,00)._
- **Passo 7 [OK]:** Estorno de Atividade e Restauração de Custódia Anterior (0.04ms)  
  _Cotas de FII restauradas integralmente para 50 unidades após cancelamento da operação._

#### JRN-FAM-01 — Orçamento Base Zero, Provisões Anuais & Convite Familiar Modular (goals_budgets)
- **Passo 1 [OK]:** Definição de Teto Orçamentário Mensal (Alimentação: R$ 1.500,00) (0.06ms)  
  _Teto de R$ 1.500,00 estabelecido para competência de Novembro/2026._
- **Passo 2 [OK]:** Cálculo de Pace Alert (Ritmo de Gastos Proporcional ao Dia do Mês) (0ms)  
  _Dia 10/30 (33% decorrido) com 60% consumido: desvio de ritmo preventivo detectado._
- **Passo 3 [OK]:** Detecção e Alerta de Extrapolação Orçamentária (> 100%) (0ms)  
  _Gasto de R$ 1.600,00 superou teto em R$ 100,00 (106,7% do limite mensal)._
- **Passo 4 [OK]:** Planejamento e Amortização Mensal de Provisão Anual (1/12) (0.04ms)  
  _Provisão de R$ 3.600,00 amortizada em R$ 300,00/mês; R$ 1.200,00 acumulados em 4 meses._
- **Passo 5 [OK]:** Criação de Convite para Grupo Familiar com Escopo Modular Restrito (1.7ms)  
  _Convite gerado com investments=none e trips=write com sucesso._
- **Passo 6 [OK]:** Sanitização de XSS e Caracteres Nulos no Formulário de Convite Familiar (0.12ms)  
  _Tags HTML e caracteres nulos expurgados com sucesso pelo schema Zod._
- **Passo 7 [OK]:** Salvaguarda de Isolamento: Acesso a Investimentos Restrito ao Titular (0ms)  
  _Comprovada vedação absoluta de dados patrimoniais para membros com investments=none._

#### JRN-TRIP-01 — Viagem em Grupo, Câmbio Internacional & Racha Min-Cash-Flow (trips)
- **Passo 1 [OK]:** Criação de Viagem Internacional em Grupo com Moeda USD e Câmbio R$ 5,20 (0.05ms)  
  _Viagem 'Férias Orlando & Parques' cadastrada em USD com cotação base de R$ 5,20._
- **Passo 2 [OK]:** Inclusão e Configuração de 4 Participantes com Chaves Pix (0.05ms)  
  _Host e 3 convidados vinculados com sucesso ao grupo de despesas._
- **Passo 3 [OK]:** Despesa em Moeda Estrangeira com Conversão Cambial Rigorosa (US$ 600 -> R$ 3.120) (0.07ms)  
  _Cota individual de R$ 780,00 (78.000 cts) atribuída igualmente a cada participante._
- **Passo 4 [OK]:** Registro de Despesa com Divisão Customizada com Soma Exata de Cotas (0.02ms)  
  _R$ 800,00 alocados de forma ponderada (250 / 250 / 150 / 150) sem sobras de centavos._
- **Passo 5 [OK]:** Cálculo dos Balanços Líquidos Individuais de Todos os Participantes (0.23ms)  
  _Host: +R$ 2.090,00 | Lucas: -R$ 230,00 | Mariana: -R$ 930,00 | Beatriz: -R$ 930,00._
- **Passo 6 [OK]:** Minimização de Fluxo via Algoritmo Greedy Min-Cash-Flow (3 Pix Totais) (0.01ms)  
  _3 transferências Pix simplificadas liquidam 100% das obrigações do grupo sem triangulações._
- **Passo 7 [OK]:** Auditoria da Invariante de Conservação Zero-Sum da Viagem (Soma = 0) (0.01ms)  
  _Soma de todos os saldos líquidos = rigorosamente R$ 0,00 (0 cts)._

#### JRN-DATA-01 — Insights SmartAdvisor, Snooze Qualificado & Backup Snapshot (insights)
- **Passo 1 [OK]:** Disparo e Emissão de Eventos pelo Motor de Inteligência SmartAdvisor (0.01ms)  
  _4 alertas sintetizados cobrindo risco de caixa, desvio de ritmo, trial e sucesso._
- **Passo 2 [OK]:** Ordenação Hierárquica Estrita por Severidade (critical > warning > info > success) (0.02ms)  
  _Alerta crítico de iliquidez posicionado no topo da fila prioritária._
- **Passo 3 [OK]:** Dispensa Qualificada de Insight com Decisão Estruturada (QualifiedDismissPopover) (0.02ms)  
  _Insight 'ins-pace-alert' dispensado com justificativa de gasto intencional._
- **Passo 4 [OK]:** Supressão Preventiva de Ruído e Aplicação de Cooldown de 30 Dias (0.03ms)  
  _Insight dispensado removido da visualização do usuário durante o período de cooldown._
- **Passo 5 [OK]:** Exportação de Snapshot Integral de Dados em Estrutura JSON Canônica (0.03ms)  
  _Arquivo de backup JSON gerado com 1425 bytes e formato canônico v3.13.0._
- **Passo 6 [OK]:** Auditoria de Integridade Referencial das Entidades do Backup (0.02ms)  
  _100% dos relacionamentos entre transações e categorias validados sem inconsistências._
- **Passo 7 [OK]:** Gravação de Evento Forense Imutável no Registro de Auditoria (0.06ms)  
  _Evento BACKUP_EXPORTED gravado no log histórico sem possibilidade de alteração._

---

## 5. Matriz de Fuzzing e Resiliência de Schemas Zod

Todos os schemas de borda e mutação foram submetidos à suíte de estresse e injeção adversarial da `FuzzingEngine`.

| Schema Auditado | Tipo de Vetor Testado | Injeção Adversarial | Comportamento Esperado | Resultado Forense |
|---|---|---|---|:---:|
| `createTransactionSchema` | Overflow Monetário | R$ 999.999.999.999,00 | Rejeição por estouro de teto | `PROTEGIDO` |
| `createTransactionSchema` | SQL Injection / XSS | `Robert'); DROP TABLE--` | Sanitização e validação Zod | `PROTEGIDO` |
| `createCategorySchema` | Homóglifos Unicode | Caracteres decorativos não-ASCII | Bloqueio de emojis / ESLint | `PROTEGIDO` |
| `splitAmountSchema` | Resto de Dízima Periódica | R$ 100,00 em 3x (resto 1 centavo) | Conservação exata da soma | `PROTEGIDO` |
| `earlyAmortizationSchema` | Juros Vincendos | Amortização antecipada CDC 52 | Desconto racional obrigatório | `PROTEGIDO` |
| `stockSplitSchema` | Divisão por Zero / Negativo | Ratio <= 0 ou NaN | Rejeição imediata sem crash | `PROTEGIDO` |
| `backupEnvelopeSchema` | Hash SHA-256 Adulterado | Mutação de 1 byte no payload | Rejeição por violação de integridade | `PROTEGIDO` |

---

## 6. Declaração de Conformidade Quantitativa

O Laboratório Forense de Auditoria Sintética e Contínua comprova que os motores de cálculo do aplicativo Axir respeitam rigorosamente:
1. **Partida Dobrada e Balanço Patrimonial:** Conservação estrita de patrimônio, caixa residual e reconciliação com o extrato.
2. **Moeda em Centavos Inteiros:** Blindagem contra dízimas periódicas no parcelamento e rateio proporcional familiar.
3. **Imutabilidade Cambial:** Preservação de PTAX histórica por lote em ativos internacionais cotados em USD.
4. **Continuidade de Séries Temporais:** Preservação da espinha mensal contínua (inclusive meses sem movimentação).
5. **Divisão por Zero:** Resiliência e retorno seguro nulo/finito em cenários de saldo zero, início de histórico e variância zero.
6. **Conformidade CDC e Fiscal:** Aplicação compulsória de isenção de IRPF em vendas de ações até R$ 20.000,00 (Lei 9.250/95), direito de reflexão de 7 dias (CDC art. 49), expurgo de juros em liquidação antecipada (CDC art. 52 § 2º) e limite de 2% em multas moratórias (CDC art. 52 § 1º).
7. **Isolamento Modular Absoluto:** Zero mutações ou poluição de dados nas tabelas de produção do Supabase.

*Documento gerado automaticamente pelo Núcleo Forense do Axir.*
