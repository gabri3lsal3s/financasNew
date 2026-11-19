# Laboratório Forense de Auditoria Quantitativa, Sintética e Contínua (Full-App Lifecycle & State Transition Forensics)

> **Status:** Ativo e Homologado (Portões 0 a 10 Concluídos) · **Ambiente:** Híbrido (CLI + Painel Admin) · **Versão:** 2.0.0 · **Conformidade:** AGENTS.md, FINANCIAL_MATH_SPEC.md, LGPD, CDC (Art. 49 e 52)

---

## 1. Visão Geral e Propósito

O **Laboratório Forense de Auditoria Quantitativa e de Ciclo de Vida** do Axir é uma infraestrutura de grau institucional projetada para certificar, comprovar matematicamente e auditar de forma contínua a exatidão numérica, contratual e de segurança em cada tela, modal, formulário, fluxo de usuário e mutação de dados do sistema.

Operando de maneira **híbrida** — via linha de comando no terminal (`npm run audit:forensics`) e via tela administrativa no navegador (`/admin/laboratorio-forense`) —, o laboratório submete o ecossistema financeiro do produto a uma suíte exaustiva de testes de estresse em memória, cobrindo os 8 pilares da aplicação:

1. **Autenticação, Onboarding & Governança de Usuários (`auth`):**
   - Criação de conta, login, recuperação de senha, estado de aprovação pendente (`PendingApprovalPage`) e guarda de rota de administradores (`RequireAdminSession`).
   - Setup inicial de perfil, wizard de boas-vindas e injeção do catálogo inicial com 8 categorias canônicas aderentes a `CATEGORY_ICON_MAP` e isenção de emojis.
2. **Assinaturas, Checkout & Monetização (`subscription`):**
   - Ciclo de vida de planos (Free, Pro Mensal, Pro Anual, Founder), ciclo de degustação (Trial) e vigência determinística.
   - Checkout Pix (código EMV copia-e-cola com CRC-16 BACEN) e Cartão de Crédito.
   - Conformidade com o direito legal de arrependimento (CDC Art. 49) com 100% de estorno nos primeiros 7 dias e blindagem estrita de *Feature Gates* em contas Free.
3. **Categorias, Taxonomia & Configurações (`categories`):**
   - Criação, edição e exclusão de categorias; integridade da hierarquia pai/filho; validação estrita de ícones contra o `CATEGORY_ICON_MAP`.
   - Invariante anti-orfandade: bloqueio de exclusão sem categoria de destino e reconciliação atômica de transações vinculadas.
4. **Lançamentos, Transações, Cartões & Dívidas (`transactions`, `cards`, `loans`, `debts`):**
   - Lançamentos multi-passos com parcelamentos de até 60x, conservação estrita de centavos (`splitCents`) e corte por data de fechamento da fatura.
   - Empréstimos e financiamentos: amortização antecipada com desconto a valor presente pelo CDC art. 52 § 2º (expurgo de juros vincendos) e limite legal de multa moratória no rotativo $\le 2\%$ (CDC art. 52 § 1º).
5. **Investimentos & Eventos de Custódia (`portfolio`):**
   - Aportes com recálculo ponderado de Preço Médio e débito sincronizado em Caixa.
   - Desdobramentos (*splits*) e grupamentos (*reverse splits*) com conservação exata do custo total ($Q \times PM$).
   - Venda parcial com apuração de ganho de capital, retenção de IR e preservação do Preço Médio das cotas remanescentes.
   - Isenção legal de IRPF em vendas de ações no mercado à vista até R$ 20.000,00 no mês (Lei 9.250/95 art. 22).
   - Reversibilidade temporal estrita: estorno de transações passadas via rollback de snapshot com restauração exata de cotas e caixa.
6. **Metas Financeiras, Orçamento Base Zero & Família (`budgets`, `family`):**
   - Alocação 50/30/20, provisões anuais 1/12 ao mês e rateio proporcional à renda (ex: 60%/40%) com conservação de centavos.
   - Convite modular de parceiro com permissões granulares por módulo (`none`, `read`, `write`, `admin`).
7. **Modo Viagem & Rateio de Despesas (`trips`):**
   - Orçamento compartilhado multi-moeda (BRL, USD, EUR) e conversão cambial.
   - Algoritmo ótimo de simplificação de dívidas (*Min-Cash-Flow*), garantindo fechamento em no máximo $N - 1$ transferências.
8. **Inteligência, DRE, Exportações & Resiliência DRP (`insights`, `export`, `backup`):**
   - SmartAdvisor com triagem por severidade e silenciamento de alertas com descarte qualificado por 30 dias (imunidade a ruído).
   - Backup e restauração com verificação criptográfica de hash SHA-256 e prevenção compulsória de adulteração de dados.

---

## 2. Diretrizes Arquiteturais Inegociáveis

1. **Isolamento Modular Absoluto:** Todo o código do laboratório reside exclusivamente no diretório `src/features/admin/forensics/`, desacoplado do código de produção dos usuários comuns.
2. **Núcleo Isomórfico & Headless (Zero Dependência de DOM):** As personas teóricas, o motor de transições de estado (`HeadlessStateStore` e `HeadlessTransactionRouter`), as jornadas de ciclo de vida e os validadores operam em TypeScript puro em memória volátil, sem navegadores pesados ou chamadas de rede.
3. **Impacto Zero no Pacote do Usuário (0 Bytes):**
   - A rota administrativa `/admin/laboratorio-forense` é carregada sob demanda (*lazy-loaded*) no chunk isolado `admin-forensics-page-*.js`.
   - O chunk administrativo e as ferramentas de auditoria são **expressamente excluídos** do manifesto de pré-cache do Service Worker PWA (`sw.js` via Workbox), garantindo zero bytes adicionais baixados pelos clientes.
4. **Proteção Estrita de Acesso Admin:** O acesso à rota visual exige autenticação administrativa rigorosa via `RequireAdminSession` (verificação no token JWT) e controle de permissões de operadores.
5. **Execução Limpa (Zero DB Writes):** As simulações operam 100% em memória volátil sobre os motores de domínio (`src/domain/`), sem inserir, atualizar ou apagar registros nas tabelas de produção do Supabase.
6. **Precisão Numérica de Grau Bancário:** Valores monetários operam internamente como números inteiros de centavos (`*Cents`), e taxas/pesos operam com precisão total de ponto flutuante de 64 bits (IEEE 754), sendo proibidos arredondamentos intermediários prematuros ao longo do pipeline.
7. **Padrão Estrito de Código (AGENTS.md):** TypeScript estrito (sem `any`, sem `@ts-ignore`), tipografia numérica tabular (`tabular-nums tracking-tight whitespace-nowrap`) e ZERO emojis no produto e nos relatórios.

---

## 3. Catálogo das 8 Golden User Journeys (Ciclo de Vida)

O laboratório executa 8 jornadas determinísticas completas cobrindo os 8 pilares da aplicação em $< 100\text{ms}$ no total:

| ID da Jornada | Pilar | Nome da Jornada | Passos | Escopo Forense |
|---|---|---|:---:|---|
| `JRN-AUTH-01` | `auth` | Autenticação, Onboarding & Governança | 7 | Registro, login, aprovação pendente, role admin, wizard de boas-vindas, perfil de investidor e injeção de categorias de fábrica com ícones válidos em `CATEGORY_ICON_MAP`. |
| `JRN-SUBS-01` | `subscription` | Assinatura, Checkout Pix, CDC 49 & Feature Gates | 7 | Seleção de plano Pro Anual, trial residual, checkout Pix com EMV e CRC-16, ativação de webhook idempotente, estorno CDC Art. 49 nos primeiros 7 dias e bloqueio de features Pro em contas Free. |
| `JRN-CAT-01` | `categories` | Taxonomia, Hierarquia & Reconciliação de Órfãos | 7 | Criação de categoria pai/filho, validação de ícones, edição de metadados, lançamento associado, bloqueio de exclusão órfã e realocação atômica obrigatória. |
| `JRN-CARD-01` | `transactions` | Lançamento Multi-Passos, Parcelamentos 60x & Quitação CDC 52 | 7 | Wizard de transações, parcelamento 60x com divisão exata de centavos, corte de competência de fatura, pagamento parcial, refinanciamento rotativo com multa legal $\le 2\%$ e amortização antecipada CDC 52 § 2º. |
| `JRN-INV-01` | `portfolio` | Eventos Corporativos, Splits, Apuração Fiscal & Renda Fixa | 7 | Aporte com recalculo de PM e débito em caixa, split de ações ($Q \times PM$ conservado), venda parcial com apuração de ganho, isenção DARF R$ 20k/mês, calibração de Renda Fixa e estorno retroativo. |
| `JRN-FAM-01` | `goals_budgets` | Orçamento Base Zero, Provisões Anuais & Convite Familiar Modular | 7 | Configuração de envelopes 50/30/20, limites por categoria, provisões anuais com parcelamento contábil 1/12, consumo carimbado, rateio proporcional 60/40 e convite modular com RBAC granular. |
| `JRN-TRIP-01` | `trips` | Viagem em Grupo, Câmbio Internacional & Racha Min-Cash-Flow | 7 | Abertura de viagem, convite de membros, despesas em moeda estrangeira (USD/EUR) com PTAX, rateios customizados, simplificação ótima de dívidas em $\le N - 1$ transferências e quitação via Pix. |
| `JRN-DATA-01` | `insights` | Insights SmartAdvisor, Snooze Qualificado & Backup Snapshot | 7 | Disparo de alertas analíticos, ordenação por severidade, silenciamento qualificado por 30 dias (cooldown), geração de backup com hash SHA-256 e restauração com validação de integridade. |

---

## 4. Motor de Invariantes Matemáticas e Contábeis (39 Asserções)

O orquestrador do laboratório executa **39 asserções contábeis e lógicas rigorosas**, divididas em 23 asserções estruturais e 16 asserções de ciclo de vida e conformidade legal:

### Invariantes Estruturais (INV-PORT, INV-CARD, INV-LOAN, INV-TRIP, INV-FAM, INV-BUD, INV-RISK, INV-INS, INV-AUX)
- `[INV-PORT-01]` Partida Dobrada e Balanço Econômico Consolidado
- `[INV-PORT-02]` Custódia Total (Ativos + Saldo de Caixa)
- `[INV-PORT-03]` Custo com PTAX Histórica em Ativos Internacionais USD
- `[INV-PORT-04]` Fechamento Algebricamente Nulo de Metas de Rebalanceamento
- `[INV-PORT-05]` Continuidade de Séries Temporais sem Buracos Cronológicos (Ago/2026)
- `[INV-CARD-01]` Conservação Estrita de Centavos em Parcelamentos
- `[INV-CARD-02]` Corte de Competência de Fatura (*Closing Day*)
- `[INV-LOAN-01]` Desconto a Valor Presente em Quitação Antecipada (CDC art. 52 § 2º)
- `[INV-LOAN-02]` Zeragem Estrita de Saldo Devedor Final em Financiamentos (SAC/Price)
- `[INV-TRIP-01]` Conservação Contábil de Soma Zero em Racha de Viagem
- `[INV-TRIP-02]` Simplificação de Dívidas (*Min-Cash-Flow*) com Quitação Integral
- `[INV-FAM-01]` Rateio Proporcional à Renda (60/40) e Conservação de Centavos
- `[INV-BUD-01]` Fechamento da Matriz Orçamentária 50/30/20 (Soma = 100%)
- `[INV-BUD-02]` Provisões Anuais com Acúmulo Contábil de 1/12 ao Mês
- `[INV-RISK-01]` Proteção contra Divisão por Zero em Risco e Benchmarks (Sharpe/Volatilidade)
- `[INV-RISK-02]` Preservação Temporal de Anos Bissextos (29/02/2028)
- `[INV-RISK-03]` Precisão de 8 Decimais em Criptoativos (Satoshi)
- `[INV-INS-01]` Ordenação Estrita por Severidade no SmartAdvisor
- `[INV-INS-02]` Cooldown de 30 Dias em Dispensas de Insights
- `[INV-INS-03]` Radar Preventivo de Limite de Cartão de Crédito ($\ge 90\%$)
- `[INV-AUX-01]` Checksum CRC-16 BACEN do Pix BR Code (Polinômio 0x1021)
- `[INV-AUX-02]` Pista de Liquidez Imediata (Reserva D+0/D+1)
- `[INV-AUX-03]` Otimização Financeira da Quitação de Dívidas (Avalanche vs Bola de Neve)

### Invariantes de Ciclo de Vida & Transições (INV-LFC-01 a INV-LFC-16)
- `[INV-LFC-01]` Blindagem Hermética de Feature Gates em Contas Free
- `[INV-LFC-02]` Idempotência Estrita de Transição de Assinatura (Reenvio de Webhooks)
- `[INV-LFC-03]` Conformidade do Direito de Arrependimento de Compra (CDC Art. 49)
- `[INV-LFC-04]` Invariante Anti-Orfandade na Exclusão de Categorias
- `[INV-LFC-05]` Congruência Estrita com `CATEGORY_ICON_MAP` e Isenção de Emojis
- `[INV-LFC-06]` Conservação de Centavos na Exclusão Parcial de Parcelamentos
- `[INV-LFC-07]` Desconto Racional a Valor Presente em Amortizações (CDC Art. 52 § 2º)
- `[INV-LFC-08]` Limite Legal de Multa por Impontualidade no Rotativo (CDC Art. 52 § 1º)
- `[INV-LFC-09]` Conservação Patrimonial em Splits e Reverse Splits ($Q \times PM$ invariante)
- `[INV-LFC-10]` Estabilidade de Preço Médio Pós-Alienação Parcial
- `[INV-LFC-11]` Isenção de IRPF em Vendas de Ações até R$ 20.000,00/mês (Lei 9.250/95)
- `[INV-LFC-12]` Reversibilidade Temporal Estrita de Operações (Rollback / Estorno)
- `[INV-LFC-13]` Fechamento Proporcional da Renda no Orçamento Familiar
- `[INV-LFC-14]` Invariante de Redução Ótima do Min-Cash-Flow em Viagens ($\le N - 1$)
- `[INV-LFC-15]` Imunidade a Duplicação de Insights durante Cooldown de 30 Dias
- `[INV-LFC-16]` Integridade Criptográfica SHA-256 e Não-Colisão de Backups

---

## 5. Exportadores Duplos de Contra-Prova

### 5.1. Dossiê Executivo em Markdown (`reports/forensics-audit-dossier.md`)
Relatório completo e auditável gerado em menos de 25ms contendo:
- Metadados completos da execução (ID único, timestamp ISO, ambiente, duração em ms, score global).
- Tabela de confiabilidade consolidada por módulo de negócio (11 módulos).
- Detalhamento de todas as 39 asserções de invariantes contábeis e de governança.
- Seção analítica das 8 jornadas sintéticas de ciclo de vida com passo a passo executivo.
- Matriz de estresse de fuzzing comprovando resiliência dos schemas Zod contra injeção e transbordamento numérico.
- Declaração formal de conformidade contábil, financeira e jurídica (CDC e Receita Federal).

### 5.2. Planilha de Contra-Prova em Excel (`reports/forensics-contra-prova.xls`)
Arquivo gerado no padrão XML SpreadsheetML (compatível com Microsoft Excel, LibreOffice Calc, Apple Numbers e Google Sheets) com **fórmulas nativas do Excel** e **8 abas temáticas**:
1. **Resumo Executivo:** Scores por módulo com status condicional (`StatusPass`/`StatusFail`).
2. **Contra-Prova Investimentos:** Custo calculado pelo Axir comparado à fórmula nativa `=RC[-3]*RC[-2]` e delta `=ABS(...)`.
3. **Contra-Prova Parcelas:** Conservação de centavos com a fórmula de soma nativa `=RC[-3]`.
4. **Contra-Prova Racha:** Soma zero de saldos líquidos em viagens com a fórmula `=SUM(R2C:R[-1]C)`.
5. **Contra-Prova Ciclo de Vida:** Matriz das 8 jornadas com status, total de passos, passos aprovados e latência.
6. **Contra-Prova Fiscal e CDC:** Comprovação da isenção de R$ 20k (Lei 9.250/95), arrependimento CDC Art. 49, amortização antecipada CDC Art. 52 § 2º e teto de 2% do rotativo CDC Art. 52 § 1º.
7. **Contra-Prova Fuzzing:** Registro de 7 classes de vetores de estresse contra os schemas Zod da aplicação.
8. **Todas Invariantes:** Listagem exaustiva das 39 asserções com valor esperado, encontrado e status forense.

---

## 6. Painel Visual Administrativo (`/admin/laboratorio-forense`)

A interface administrativa (`ForensicsDashboard`) dispõe de navegação fluida por abas:

1. **Visão Geral & Scores:**
   - KPIs de Alto Nível: Confiabilidade Geral (100%), Asserções Aprovadas (39), Divergências Críticas (0), Duração (< 35ms).
   - Grade adaptativa de módulos com status de aprovação.
   - Botões de exportação imediata com download instantâneo do Dossiê Markdown e da Planilha de Contra-Prova.
2. **Invariantes Forenses:**
   - Catálogo das 39 asserções com pesquisa em tempo real, filtros por módulo e por status.
3. **Ciclo de Vida & Transições (`ForensicsJourneysInspector`):**
   - Seletor visual das 8 Golden User Journeys.
   - Inspeção analítica passo a passo dos 56 passos sequenciais de transição de estado.
   - Indicadores de duração por passo e garantia visual de zero escrita no Supabase.
4. **Personas Teóricas:**
   - Disparo individualizado de personas teóricas e inspeção de parâmetros de estresse.
5. **Snapshot Real (Modo Somente Leitura):**
   - Auditoria de dados reais de usuários com anonimização mandatória de dados pessoais (LGPD).

---

## 7. Instruções de Execução

### Execução via Terminal (CLI)
```bash
npm run audit:forensics
```

### Execução via Testes Automatizados (Vitest)
```bash
npx vitest run src/features/admin/forensics/
```

### Acesso via Navegador (Web)
1. Inicie a aplicação (`npm run dev`).
2. Acesse `/admin/laboratorio-forense` autenticado como operador administrativo.
3. Clique em **Disparar Auditoria** para atualizar os diagnósticos e inspecione as abas temáticas.
