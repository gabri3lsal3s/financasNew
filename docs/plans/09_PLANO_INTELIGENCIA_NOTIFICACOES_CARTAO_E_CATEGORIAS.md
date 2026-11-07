# 09 — Plano de Implementação: Inteligência Adaptativa Multi-Bancos, Resolução Universal de Pagamentos & Paginação no Lançamento Rápido

> **Status:** Documento de Planejamento e Especificação Técnica Canônica (Revisão v3 — Matriz Universal de Pagamentos, Neobancos, Carteiras, Contas Globais e Desambiguação Contextual)  
> **Escopo:** Camada Nativa Android (Java) + Motor Puro de NLP Financeiro & Resolução Universal de Métodos (TypeScript) + Memória Adaptativa Contínua + Schema Supabase (`credit_cards`) + UX do Wizard Rápido (`StepQuick`)  
> **Objetivo:** 
> 1. Capacitar o aplicativo a **identificar com precisão absoluta múltiplos métodos de pagamento** (`Cartão de Crédito`, `Débito`, `Pix`, `Transferência TED/DOC`, `Boleto / Contas de Consumo / Débito Automático` e `Saque em Dinheiro`), eliminando generalizações ou classificações erráticas;
> 2. Suportar nativamente a diversidade de formatos de notificação dos **6 grandes ecossistemas financeiros** do Brasil (Bancos Tradicionais, Neobancos/Fintechs, Carteiras Digitais/Super Apps, Contas Globais/Câmbio, Corretoras de Investimento e Cooperativas/Adquirentes);
> 3. Resolver de forma determinística cenários com **4 últimos dígitos opcionais** no cadastro de cartões, eliminando a dependência do nome fantasia atribuído pelo usuário;
> 4. Implementar a **Cascata de Desempate de Cartões e Contas em 6 Níveis**, cobrindo desde notificações detalhadas até notificações lacônicas;
> 5. Incorporar **previsão contextual multidimensional 5D** (Horário × Faixa de Valor/Ticket Médio × Dia da Semana × Canal/Origem);
> 6. Estruturar **inspeção simultânea e cruzada de Título e Corpo** com funil hierárquico descendente de precisão de descrições e higienização comercial;
> 7. Expandir o Lançamento Rápido com **paginação fluida de categorias** e **ordenação inteligente por frequência real de uso**, garantindo acesso a 100% do catálogo em menos de 3 segundos.

---

## 1. Painel Geral de Progresso (Checklist Consolidado)

| Fase | Descrição | Status | Tarefas Concluídas |
|---|---|:---:|:---:|
| **Fase 1** | Schema de Cartões & Identificação por 4 Dígitos (Supabase / Data / UI) | Pronto para Execução | 0 / 4 |
| **Fase 2** | Camada Nativa Android: Correção de Regex Monetária & Push Interativo (Java) | Pronto para Execução | 0 / 3 |
| **Fase 3** | Motor de Desambiguação Universal de Métodos de Pagamento (`payment-method-resolver.ts`) | Pronto para Execução | 0 / 5 |
| **Fase 4** | NLP Financeiro Multi-Ecossistema, Inspeção Título/Corpo & Funil de Descrição (`bank-parser.ts`) | Pronto para Execução | 0 / 5 |
| **Fase 5** | Cascata de Desempate de Cartões em 6 Níveis & Vínculo com Instituição (`card-resolution.ts`) | Pronto para Execução | 0 / 5 |
| **Fase 6** | Memória Adaptativa Contínua & Previsão Contextual 5D (`merchant-learning.ts`, `predictions`) | Pronto para Execução | 0 / 4 |
| **Fase 7** | Experiência do Lançamento Rápido: Paginação e Ranking por Frequência (`StepQuick.tsx`) | Pronto para Execução | 0 / 4 |
| **Fase 8** | Matriz E2E Multi-Banco com 19 Cenários Reais, Portões de Qualidade & DoD | Pronto para Execução | 0 / 4 |
| **Fase 9** | Motor Especializado de Rendas, Auto-Depósitos & Deduplicação de Push (`bank-parser.ts`, `BankNotificationActionReceiver.java`) | Pronto para Execução | 0 / 5 |

---

## 2. Os 6 Grandes Ecossistemas Financeiros Suportados

Diferentes bancos e aplicativos estruturam suas mensagens de push de formas totalmente heterogêneas. O sistema foi desenhado para normalizar todos os padrões da indústria:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. BANCOS TRADICIONAIS (Itaú, Bradesco, Santander, Banco do Brasil, Caixa) │
│    - Padrão delimitado por vírgula ou hífen ("R$ 32,50, LOJA, Cartao final")│
│    - Notificações de Boletos, DDA, Saques em Caixa Eletrônico e Débito Auto │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. NEOBANCOS & FINTECHS (Nubank, Inter, C6 Bank, Neon, Next, Will, Cora)    │
│    - Notificações dinâmicas de Pix (recebido com nome do pagador / enviado) │
│    - Distinção explícita entre "Compra no crédito" e "Compra no débito"     │
│    - Cartões virtuais temporários e parcelamento no app                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. CARTEIRAS DIGITAIS & SUPER APPS (Google Wallet, Samsung Pay, MP, PicPay) │
│    - Estabelecimento / Nome da Loja no TÍTULO ("PAGUE MENOS 1094")          │
│    - Corpo sintético apenas com valor e cartão ("R$ 13,55 com Nomad ••7756")│
│    - Pagamentos por aproximação NFC, QR Code Pix e recargas de celular      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. CONTAS GLOBAIS & CÂMBIO MULTIMOEDA (Nomad, Wise, Avenue, Inter Global)   │
│    - Notificações em moeda estrangeira ("Purchase of $ 15.00 at Starbucks") │
│    - Notificações de Câmbio / Conversão ("Você converteu R$ X em US$ Y")    │
│    - Cartões de débito internacional sem menção a parcelas                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. CORRETORAS DE INVESTIMENTO (BTG Pactual, XP, Rico, Binance)              │
│    - Cartões de alta renda com Investback/Cashback (XP Infinite, BTG Black) │
│    - Proventos / Dividendos creditados ("Recebeu proventos de R$ X")        │
│    - Ordens executadas e aplicações em títulos (CDB / Tesouro / Fundos)     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. COOPERATIVAS & ADQUIRENTES (Sicoob, Sicredi, Safra, Stone/Ton, PagBank)  │
│    - Notificações de recebimento de vendas em maquininhas                   │
│    - Boletos de cooperativas e liquidações de DDA                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Matriz Universal de Resolução de Métodos de Pagamento

Para impedir categoricamente que métodos de pagamento sejam confundidos (como o caso real em que uma compra no cartão Nomad virou Pix), o sistema adota regras estritas de desambiguação:

| Método de Pagamento | Sinais Inequívocos e Tokens Obrigatórios | Desambiguação / Regras de Exclusão Estritas | Categoria Canônica Típica |
|---|---|---|---|
| **Cartão de Crédito (`credit_card`)** | `"crédito"`, `"no crédito"`, `"crédito à vista"`, `"parcelado"`, `\d+x\b`, `"infinite"`, `"black"`, `"platinum"`, `"itaucard"`, `"ourocard"`, `"cartão virtual"`, Carteira Google/Samsung Pay com cartão de crédito. | **Proibição:** Se contiver `"crédito em conta"` ou `"creditado na conta"` $\rightarrow$ Trata-se de Renda/TED/Pix, NUNCA Cartão de Crédito! | Conforme o estabelecimento |
| **Cartão de Débito (`debit`)** | `"débito"`, `"no débito"`, `"cartão de débito"`, `"compra no débito"`, Contas Globais (Nomad/Wise) em compras cotidianas sem indicação de crédito. | **Proibição:** Se contiver `"débito automático"` de contas de consumo $\rightarrow$ Método é `other` (Concessionária)! | Conforme o estabelecimento |
| **Pix Recebido / Auto-Depósito (`pix` / Renda)** | `"você depositou"`, `"depositou"`, `"depósito via pix"`, `"seu dinheiro já está disponível"`, `"já está disponível"`, `"adicionou dinheiro"`, `"você recebeu um pix"`, `"pix recebido"`, `"transferência recebida"`. | **Regra Absoluta:** Transação é **Renda (`nature: "income"`)**, NUNCA Despesa! Proibido categorizar como Supermercado ou fallback de gastos. | `Transferências Recebidas` / `Depósitos` / `Rendimentos` |
| **Pix Enviado / Compra Pix (`pix` / Despesa)** | `"você enviou um pix"`, `"pix enviado"`, `"pagamento via pix"`, `"copia e cola"`, `"qr code pix"`, `"você pagou com pix"`. | **Proibição:** Se contiver `"depositou"`, `"já está disponível"` ou `"recebeu"` $\rightarrow$ É Renda! Se contiver tokens de cartão (`••\d{4}`, `"crédito"`), é Cartão de Crédito. | Conforme favorecido / memória |
| **Transferência TED/DOC (`transfer`)** | `"ted"`, `"doc"`, `"transferência entre contas"`, `"transferência recebida"`, `"transferência enviada"`, `"depósito em conta"`, `"depósito recebido"`. | Distingue transferência entre contas próprias de transferências a terceiros. Se recebida/depósito, classifica como Renda. | Outros / Salário / Ajustes |
| **Boleto & Contas de Consumo (`other`)** | `"boleto"`, `"boleto pago"`, `"código de barras"`, `"débito automático"`, `"conta de luz"`, `"conta de água"`, `"enel"`, `"sabesp"`, `"comgas"`, `"claro"`, `"vivo"`, `"tim"`, `"tributo"`, `"ipva"`, `"iptu"`, `"darf"`. | Se for débito automático de concessionária, a categoria é fixada em `gastos_fixos` ou `moradia`. | `gastos_fixos` / `moradia` |
| **Saque em Dinheiro (`cash`)** | `"saque"`, `"saque realizado"`, `"retirada"`, `"terminal banco24horas"`, `"saque caixa eletrônico"`, `"banco 24 horas"`, `"em espécie"`. | Saque não é despesa de compra de produto; é conversão de saldo de conta para dinheiro em espécie. | `outros` / Dinheiro |

---

## 4. Cascata de Desempate de Cartões em 6 Níveis

Para atender a todos os cenários (notificações com 4 dígitos, notificações sem dígitos, cartões com apelidos, usuários com múltiplos cartões do mesmo banco e notificações lacônicas):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Nível 1: Match Exato por 4 Últimos Dígitos Cadastrados (100% Determinístico) │
│ - O cartão possui last_four_digits = "7756" e a notificação traz "••7756"   │
│ - Sobrepõe qualquer apelido dado pelo usuário ("Meu Cartão de Viagem")       │
│ - Desempata instantaneamente múltiplos cartões do mesmo banco (físico/virtual)│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Se não houver dígitos na notificação ou cartão)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Nível 2: Memória do Estabelecimento (Merchant Learning Engine)              │
│ - O usuário já fez compra anterior na "Pague Menos" e selecionou o cartão X │
│ - A memória adaptativa recupera e pré-seleciona o cartão X para aquela loja │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Se for um estabelecimento inédito)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Nível 3: Memória da Instituição / Pacote de Origem (Bank-to-Card Mapping)   │
│ - A notificação veio do app do banco (ex.: com.nomadfinancial ou Bradesco)  │
│ - O usuário já associou anteriormente o cartão Y às notificações desse app  │
│ - Se o usuário só possui 1 cartão ativo daquele banco, o vínculo é direto!  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Se não houver vínculo prévio)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Nível 4: Casamento Semântico de Emissor e Bandeira no Nome Cadastrado       │
│ - Busca termos do banco emissor ("Nomad", "Nubank", "Itaú") ou bandeira      │
│   ("Visa", "Mastercard", "Elo", "Amex") dentro do nome do cartão cadastrado  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Se o nome do cartão for um apelido genérico)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Nível 5: Previsão Contextual por Horário & Faixa de Valor (Ticket Médio)    │
│ - Cartão mais utilizado historicamente pelo usuário naquele horário/dia     │
│ - Ex.: Cartão corporativo em dias úteis / Cartão pessoal em fins de semana  │
│ - Ex.: Cartão de compras cotidianas para valores < R$ 100                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Se não houver histórico suficiente)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Nível 6: Fallback Seguro e Transparente                                     │
│ - Cartão com maior volume de uso recente ou primeiro cartão ativo           │
│ - Destaque visual suave no Wizard para conferência do usuário               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Fases de Execução e Tarefas Detalhadas

### FASE 1: Schema de Cartões & Identificação por 4 Dígitos (Supabase / Data / UI)

- [ ] **Tarefa 1.1 — Migração de Banco de Dados Supabase (`credit_cards`)**
  - Criar migração SQL adicionando a coluna `last_four_digits VARCHAR(4)` na tabela `credit_cards`.
  - Adicionar constraint segura: `CHECK (last_four_digits IS NULL OR last_four_digits ~ '^[0-9]{4}$')`.
  - Atualizar tipos TypeScript em `src/types/schema.ts` (`CreditCard` e payloads de inserção/atualização).
  - Atualizar repositório em `src/data/repositories/credit-cards.ts`.

- [ ] **Tarefa 1.2 — Validação Zod Sanitizada no Cadastro de Cartões**
  - Atualizar o schema zod `creditCardSchema` permitindo 4 dígitos numéricos opcionais.
  - Sanitização automática: remove espaços, traços e caracteres não numéricos antes de persistir.

- [ ] **Tarefa 1.3 — Campo no Diálogo de Criação/Edição de Cartões**
  - Adicionar campo "Últimos 4 dígitos (opcional)" em `credit-card-form-dialog.tsx`.
  - Input estilizado com o Design System, máscara `0000` e helper text: *"Facilita o reconhecimento automático em notificações e carteiras digitais."*

- [ ] **Tarefa 1.4 — Exibição na Carteira e Cartão Virtual (`CreditCard3D`)**
  - Atualizar o componente visual [`CreditCard3D`](file:///home/gabrielsales/meus_apps/financasnew/src/components/modules/credit-card-3d.tsx).
  - Renderizar no rodapé do cartão virtual: `•••• 7756` (quando informado) ou máscara genérica `•••• ••••`.

---

### FASE 2: Camada Nativa Android: Correção de Regex Monetária & Push Interativo (Java)

- [ ] **Tarefa 2.1 — Correção da Regex Monetária em `BankNotificationListenerService.java`**
  - Reformular `AMOUNT_PATTERN`:
    - Exigir centavos obrigatórios para valores que antecedem moeda (`\d+[.,]\d{2}\s*(?:R\$|US\$|...)`), eliminando o casamento espúrio de filiais (`1094 R$`).
    - Priorizar captura do padrão com moeda prefixada (`R$\s*\d+(?:[.,]\d{2})?`).
  - Adicionar testes unitários em `BankNotificationListenerServiceTest.java`.

- [ ] **Tarefa 2.2 — Higienização do Título e Corpo do Push Nativo**
  - Em `postInteractivePush`, assegurar que o título use o valor monetário correto e o corpo exiba o nome do estabelecimento higienizado quando disponível.
  - Exemplo: `Transação detectada · R$ 13,55` com corpo `Pague Menos • Nomad Infinite`.

- [ ] **Tarefa 2.3 — Transporte Fiel de Título, Corpo e Pacote no Intent de Revisão**
  - Garantir que `reviewIntent` repasse `packageName`, `title`, `text` e `timestamp` originais intactos para a `MainActivity`.

---

### FASE 3: Motor de Desambiguação Universal de Métodos de Pagamento (`payment-method-resolver.ts`)

- [ ] **Tarefa 3.1 — Criação do Motor Puro `payment-method-resolver.ts`**
  - Implementar função pura `resolvePaymentMethod(text: string, title: string, packageName?: string): PaymentMethod`.
  - Mapeamento determinístico cobrindo: `credit_card`, `debit`, `pix`, `transfer`, `cash` e `other`.

- [ ] **Tarefa 3.2 — Regras Estritas de Desambiguação de "Crédito" e "Débito"**
  - Se contiver `"crédito em conta"` ou `"creditado na conta"` $\rightarrow$ Renda/Transferência, nunca Cartão de Crédito.
  - Se contiver `"débito automático"` de concessionária/conta de consumo $\rightarrow$ Método `other`.
  - Se contiver `"compra no débito"` ou `"cartão de débito"` $\rightarrow$ Método `debit`.

- [ ] **Tarefa 3.3 — Identificação de Boletos, Concessionárias & Tributos**
  - Reconhecer menções a contas de água, luz, gás, telefone, internet, IPVA, IPTU, DARF e boletos pagos como `other` com categoria automática `gastos_fixos` ou `moradia`.

- [ ] **Tarefa 3.4 — Identificação de Saques em Espécie (Caixa Eletrônico / Banco24Horas)**
  - Reconhecer transações de saque como método `cash` (Dinheiro) com rótulo semântico `"Saque em Dinheiro"`.

- [ ] **Tarefa 3.5 — Testes Unitários de Desambiguação de Métodos**
  - Criar `payment-method-resolver.test.ts` cobrindo 30+ variações textuais de todos os métodos.

---

### FASE 4: NLP Financeiro Multi-Ecossistema, Inspeção Título/Corpo & Funil de Descrição (`bank-parser.ts`)

- [ ] **Tarefa 4.1 — Desbloqueio Automático de Carteiras Digitais como Despesas no Cartão**
  - Mapear pacotes de carteiras (`com.google.android.apps.walletnfcrel`, `com.samsung.android.spay`, `com.samsung.android.app.spay`).
  - Tratar notificações de carteiras com valor como despesa de cartão imediata em `detectTransactionType`, dispensando palavras-chave.

- [ ] **Tarefa 4.2 — Inspeção Cruzada de Título e Corpo na Extração de Estabelecimento**
  - Refatorar `extractMerchantOrRecipient` para inspecionar tanto o título quanto o corpo da notificação.
  - Em carteiras digitais e notificações bancárias onde o título não é o nome da instituição, adotar o título como candidato primário a estabelecimento.

- [ ] **Tarefa 4.3 — Higienizador de Filiais, Lojas e Matrizes Comerciais**
  - Criar função pura de limpeza em `merchant-catalog.ts` (`cleanBranchAndStoreSuffixes`):
    - Remove números de filial isolados (ex.: `"PAGUE MENOS 1094"` ➔ `"PAGUE MENOS"`).
    - Remove siglas de automação: `"MTZ"`, `"MATRIZ"`, `"FILIAL"`, `"LJ 01"`, `"LOJA 12"`, `"SHOPPING"`.
    - Normaliza espaçamentos e Title Case.

- [ ] **Tarefa 4.4 — Funil Hierárquico Descendente de Descrição**
  - Implementar funil de precisão em 4 etapas no `bank-parser.ts`:
    1. **Nível 1 (Marca Identificada):** Nome canônico ou memorizado (ex.: `"Pague Menos"`).
    2. **Nível 2 (Ramo Comercial):** Nome higienizado com palavra-chave de ramo (ex.: `"Drogaria Pacheco"`).
    3. **Nível 3 (Contextual por Categoria Inferida):** Rótulo semântico limpo derivado da categoria (ex.: `"Farmácia / Saúde"`, `"Transporte"`).
    4. **Nível 4 (Fallback Seguro por Método):** `"Compra no Cartão (Nomad Infinite)"`, `"Pagamento no Débito"`, `"Boleto Pago"`, etc.
  - **Trava Anti-Falso Pix:** Proibir categoricamente que compras com tokens de cartão ou carteiras recebam o rótulo `"Pix Enviado"`.

- [ ] **Tarefa 4.5 — Suporte a Moedas Estrangeiras e Contas Globais (Nomad / Wise / Avenue)**
  - Extrair metadados cambiais de compras internacionais em USD, EUR ou GBP (valor original em moeda estrangeira, IOF e taxa de câmbio).

---

### FASE 5: Cascata de Desempate de Cartões em 6 Níveis & Vínculo com Instituição (`card-resolution.ts`)

- [ ] **Tarefa 5.1 — Implementação dos Níveis 1 a 3 da Cascata de Desempate**
  - **Nível 1:** Match exato por `last_four_digits` cadastrado no cartão.
  - **Nível 2:** Match por cartão preferencial memorizado para o estabelecimento (`preferredCardId` do Merchant Learning).
  - **Nível 3:** Match por instituição de origem: se o app emissor é conhecido e o usuário possui apenas 1 cartão daquele banco, vincula diretamente; se possui múltiplos, consulta a associação memorizada para aquele pacote bancário.

- [ ] **Tarefa 5.2 — Implementação dos Níveis 4 a 6 da Cascata de Desempate**
  - **Nível 4:** Match semântico por emissor/bandeira dentro do nome do cartão.
  - **Nível 5:** Desempate contextual por horário e faixa de valor (ticket médio do cartão).
  - **Nível 6:** Fallback transparente para o cartão mais utilizado recentemente.

- [ ] **Tarefa 5.3 — Registro de Memória Instituição ➔ Cartão**
  - Quando o usuário confirma uma transação de um pacote bancário específico escolhendo um cartão, salvar a associação `packageName ➔ cardId` na memória adaptativa.

- [ ] **Tarefa 5.4 — Desempate Multi-Cartão do Mesmo Banco (Físico vs Virtual)**
  - Testes unitários comprovando que dois cartões do mesmo banco (ex.: Nomad Físico `7756` e Nomad Virtual `1234`) são diferenciados perfeitamente pelos dígitos finais ou pela preferência memorizada do estabelecimento.

- [ ] **Tarefa 5.5 — Suporte a Notificações sem Menção a Cartão**
  - Para notificações lacônicas (ex.: `"Compra de R$ 50,00 aprovada"`), aplicar a memória do estabelecimento ou o cartão preferencial do banco emissor.

---

### FASE 6: Memória Adaptativa Contínua & Previsão Contextual 5D (`merchant-learning.ts`, `predictions`)

- [ ] **Tarefa 6.1 — Motor de Previsão Contextual 5D por Horário e Faixa de Valor**
  - Implementar em `domain/predictions`:
    - Janela de Almoço (11h30 às 14h30) e Jantar (19h00 às 22h00) $\rightarrow$ maior propensão para Alimentação.
    - Faixa de valor pequeno (R$ 5 a R$ 45) $\rightarrow$ propensão para Farmácia, Café, Padaria ou Transporte.
    - Faixa de combustível típica (R$ 100 a R$ 250) $\rightarrow$ propensão para Gasolina / Transporte.
    - Dia da semana (segunda a sexta vs fim de semana) na ponderação de hábitos.

- [ ] **Tarefa 6.2 — Feedback Loop Automático no Lançamento Rápido**
  - Conectar a submissão no `launch-wizard.tsx` ao `recordTransactionLearning`:
    - Grava o estabelecimento higienizado, categoria escolhida e cartão selecionado.
    - Se a notificação trouxe 4 dígitos, associa ao cartão selecionado (`cardDigitsMapping`).
    - Se a notificação veio de um app bancário, associa o cartão ao pacote (`bankCardMapping`).

- [ ] **Tarefa 6.3 — Expansão do Catálogo Canônico com Principais Redes Nacionais**
  - Enriquecer `CANONICAL_MERCHANT_CATALOG` com as principais redes de farmácias (Pague Menos, Drogasil, Droga Raia, Panvel, Araújo, Ultrafarma, Pacheco, São Paulo) e maquininhas (PagBank, Stone, Cielo, Rede).

- [ ] **Tarefa 6.4 — Sugestão Inteligente de Descrição Baseada no Ramo**
  - Quando não houver marca conhecida nem memória, gerar sugestões dinâmicas elegantes com base na categoria e horário (ex.: *"Almoço"*, *"Farmácia"*, *"Combustível"*).

---

### FASE 7: Experiência do Lançamento Rápido: Paginação e Ranking por Frequência (`StepQuick.tsx`)

- [ ] **Tarefa 7.1 — Algoritmo de Ranking de Categorias por Frequência Real Histórica**
  - Implementar `rankCategoriesByFrequency(categories, predictionEntries)`:
    - Pondera a quantidade de lançamentos históricos de cada categoria no histórico (`prediction.entries`).
    - Ordena decrescentemente: as categorias mais utilizadas no topo da Página 1; categorias sem histórico ordenadas alfabeticamente nas páginas finais.

- [ ] **Tarefa 7.2 — Paginação Fluida da Grade no Lançamento Rápido**
  - Substituir o `.slice(0, 8)` por paginação com `pageSize = 8` (2 linhas de 4 no desktop / 2 linhas de 3 ou 4 no mobile).
  - Barra de navegação tátil compacta abaixo da grade:
    - Botão anterior (`ChevronLeft`).
    - Indicador de página (`Página X de Y` com dots indicadores).
    - Botão seguinte (`ChevronRight`).
  - Feedback tátil sensorial suave (`triggerSensory("selection")`).

- [ ] **Tarefa 7.3 — Auto-Posicionamento na Página da Categoria Inferida**
  - Se a notificação pré-selecionar uma categoria que está na Página 2 ou 3 (ex.: Saúde), inicializar automaticamente na página correspondente com o item destacado.

- [ ] **Tarefa 7.4 — Acessibilidade e Governança Visual Estrita**
  - Navegação 100% por teclado (`Tab`, setas, `Enter`/`Space`).
  - Zero emojis em textos, tooltips ou botões (Regra #8 do AGENTS.md).
  - Atributos `aria-label`, `aria-pressed` e `aria-current="page"`.

---

### FASE 8: Matriz E2E Multi-Banco com 16 Cenários Reais, Portões de Qualidade & DoD

- [ ] **Tarefa 8.1 — Bateria de Testes Unitários de NLP e Desempate**
  - Testes em `bank-parser.test.ts` e `payment-method-resolver.test.ts` cobrindo todos os 16 cenários da matriz E2E.
  - Testes em `card-resolution.test.ts` validando a cascata completa de desempate em 6 níveis.

- [ ] **Tarefa 8.2 — Testes de Componente e Regressão do Lançamento Rápido**
  - Testes em `step-quick.test.tsx` e `launch-wizard.test.tsx`:
    - Paginação de categorias e auto-posicionamento na página correta.
    - Ordenação por frequência histórica real.
    - Auto-preenchimento derivado da memória adaptativa.

- [ ] **Tarefa 8.3 — Homologação Integrada (Typecheck, Lint e Build)**
  - Execução de `npm run typecheck` com zero erros.
  - Execução de `npm run lint` com conformidade anti-emojis.
  - Execução da suíte completa de testes: `npm run test:run`.

- [ ] **Tarefa 8.4 — Atualização de Documentação Canônica**
  - Atualizar `docs/architecture/ESPECIFICACAO_TECNICA.md` e `docs/architecture/ARCHITECTURE.md` registrando a nova cascata de desempate de cartões, a memória adaptativa de instituições e o resolvedor universal de métodos de pagamento.

---

### FASE 9: Motor Especializado de Rendas, Auto-Depósitos, Funil de Descrições de Receita & Deduplicação de Push (`bank-parser.ts`, `BankNotificationActionReceiver.java`)

- [ ] **Tarefa 9.1 — Expansão Lexical de Rendas & Auto-Depósitos no NLP (`bank-parser.ts` & `BankNotificationActionReceiver.java`)**
  - Refatorar `detectTransactionType` em `bank-parser.ts` e `isIncome` em `BankNotificationActionReceiver.java`:
    - Incorporar termos e padrões de auto-depósito e carteiras digitais: `"você depositou"`, `"depositou"`, `"depósito via pix"`, `"seu dinheiro já está disponível"`, `"já está disponível"`, `"dinheiro disponível"`, `"adicionou dinheiro"`, `"saldo adicionado"`, `"dinheiro em conta"`, `"valor recebido"`.
    - **Trava de Precedência Anti-Falso Pix de Despesa:** Se o texto contiver tokens de entrada (`"depositou"`, `"adicionou"`, `"recebeu"`), **é terminantemente proibido** acionar a regra genérica de despesa de `"pix"` ou `"via pix"`.

- [ ] **Tarefa 9.2 — Funil Semântico Descendente de Descrição de Rendas & Depósitos (`bank-parser.ts`)**
  - Eliminar o rótulo errôneo `"Pix Enviado"` para entradas e auto-transferências, estruturando um funil de precisão em 5 níveis para `nature: "income"`:
    1. **Nível 1 (Auto-Depósito / Mesma Titularidade):** Quando a notificação contiver `"você depositou"`, `"adicionou dinheiro"`, `"dinheiro já está disponível"` ou o remetente for o próprio usuário ➔ Sugestão limpa e objetiva: `"Depósito via Pix (Mercado Pago)"`, `"Depósito em Conta (Inter)"` ou `"Aporte em Conta (PicPay)"`. NUNCA `"Pix Enviado"`.
    2. **Nível 2 (Transferência Recebida de Terceiros com Nome do Pagador):** Extração do pagador/remetente ➔ Formato padronizado: `"Pix Recebido: Nome"` ou `"Transferência Recebida: Nome"`.
    3. **Nível 3 (Salário / Folha de Pagamento / Empregador):** Menção a proventos de trabalho ➔ Formato: `"Salário (Empresa)"` ou `"Folha de Pagamento"`.
    4. **Nível 4 (Rendimentos Financeiros / Dividendos / JCP / Estorno):** ➔ Formato: `"Rendimento de Saldo (Mercado Pago)"`, `"Proventos (Ticker)"` ou `"Estorno / Reembolso (Estabelecimento)"`.
    5. **Nível 5 (Fallback Seguro de Renda):** `"Recebimento via Pix (Banco)"` ou `"Recebimento em Conta (Banco)"`.

- [ ] **Tarefa 9.3 — Motor Semântico de Categorização de Rendas (`income-category-resolver.ts`)**
  - Implementar resolvedor de categorias dedicado exclusivamente para transações de natureza `income`:
    - Mapear termos de auto-depósito / Pix de mesma titularidade para categorias de receita do usuário como `"Transferências Recebidas"`, `"Depósitos / Aportes"` ou `"Ajustes de Saldo"`.
    - Mapear salários para `"Salário"` e proventos/juros para `"Rendimentos"`.
    - **Trava Anti-Supermercado:** Em transações de renda, o fallback seguro **nunca** pode consultar o catálogo de despesas (`categories[0]` de despesa); deve selecionar a categoria de receita neutra correspondente (`"Outros"`, `"Rendas Diversas"` ou primeira categoria de receita ativa do usuário).

- [ ] **Tarefa 9.4 — Eliminação Definitiva da Duplicação de Notificações (Canal Único & Idempotência)**
  - Resolver a concorrência entre emissores de push no Android:
    - O feedback de confirmação nativa (`BankNotificationActionReceiver.postUndoNotification` em Java) e o feedback disparado pelo Capacitor (`interactive-notifications.ts` `notifyQuickAddSuccess`) estavam gerando notificações simultâneas no painel do Android.
    - Padronizar canal único de feedback nativo: em ambiente nativo Android, o `BankNotificationActionReceiver` gerencia a notificação com ação `[Desfazer]`, enquanto o runtime web/Capacitor silencia a emissão de notificação local repetida (`scheduleInteractiveBankNotification` / `notifyQuickAddSuccess`), limitando-se a registrar a transação no banco.
    - Implementar trava de idempotência temporal de 5 minutos por hash de payload (`packageName + title + amount + 5m_window`) impedindo que o mesmo evento bancário seja reprocessado em cold start / buffer flush.

- [ ] **Tarefa 9.5 — Bateria de Testes Unitários de Rendas, Descrições & Anti-Duplicação**
  - Adicionar testes em `bank-parser.test.ts` cobrindo Mercado Pago, PicPay, Nubank Caixinhas, Inter e C6 Bank em operações de depósito e rendimento.
  - Testar descrições geradas para provar que `"Você depositou R$ 3.244,24 via Pix e o valor já está rendendo na sua conta."` resulta em `description: "Depósito via Pix (Mercado Pago)"` e `nature: "income"`.
  - Adicionar testes em `BankNotificationActionReceiverTest.java` validando `isIncome()` para auto-depósitos e rendas.
  - Adicionar testes de deduplicação e trava de idempotência em `interactive-notifications.test.ts`.

---

## 6. Matriz Expandida de Cenários de Teste E2E Multi-Banco (19 Cenários Reais)

| # | Ecossistema / App | Título da Notificação | Texto da Notificação | Método Esperado | Cartão / Conta | Categoria Esperada | Descrição Sugerida |
|---|---|---|---|:---:|---|---|---|
| **C1** | Carteira Google | `PAGUE MENOS 1094` | `R$ 13,55 com Nomad Infinite ••7756` | `credit_card` | Cartão final 7756 | Saúde | "Pague Menos" |
| **C2** | Nomad (Crédito) | `Pague menos 1094 mtz` | `Compra de R$ 13,55 no crédito realizada com sucesso.` | `credit_card` | Cartão Nomad | Saúde | "Pague Menos" |
| **C3** | Nomad (USD) | `Nomad` | `Purchase of $ 15.00 at Starbucks Store 4432 approved` | `debit` | Cartão Nomad Internacional | Alimentação | "Starbucks" |
| **C4** | Carteira Google | `POSTO IPIRANGA 05` | `R$ 150,00 com XP Infinite ••1234` | `credit_card` | Cartão final 1234 | Gasolina | "Posto Ipiranga" |
| **C5** | Nubank (Débito) | `Compra no débito` | `Você pagou R$ 22,00 no débito em Padaria Bela Vista` | `debit` | Conta / Cartão Débito Nu | Alimentação | "Padaria Bela Vista" |
| **C6** | Nubank (Virtual) | `Compra aprovada` | `Compra de R$ 42,90 na Droga Raia no cartão virtual` | `credit_card` | Nubank Virtual | Saúde | "Droga Raia" |
| **C7** | Itaú (Cartão) | `Itaucard` | `Compra aprovada no cartão final 4321 - RESTAURANTE FOGAO R$ 58,00` | `credit_card` | Cartão final 4321 | Alimentação | "Restaurante Fogão" |
| **C8** | Bradesco (Lacônica)| `Bradesco Cartões` | `Compra aprovada R$ 85,00 no seu cartão de crédito` | `credit_card` | Cartão Bradesco Memorizado | Hábitos / Outros | "Compra no Crédito (Bradesco)" |
| **C9** | Santander (Vírgula) | `Santander Way` | `R$ 35,00, UBER *TRIP, Cartao final 9988` | `credit_card` | Cartão final 9988 | Transporte | "Uber" |
| **C10**| Inter (Pix Enviado)| `Pix enviado` | `Você enviou um Pix de R$ 80,00 para Marcos Silva` | `pix` | Sem Cartão | Conforme histórico | "Pix: Marcos Silva" |
| **C11**| Inter (Pix Recebido)| `Pix recebido` | `Você recebeu um Pix de Gabriel Sales no valor de R$ 250,00` | `pix` (Renda) | Sem Cartão | Rendimentos / Outros | "Pix Recebido: Gabriel Sales" |
| **C12**| Banco do Brasil (TED) | `Transferência` | `TED enviada no valor de R$ 1.200,00 para Imobiliária Aliança` | `transfer` | Conta BB | Moradia | "Transferência: Imobiliária Aliança" |
| **C13**| C6 Bank (Boleto) | `Boleto pago` | `Pagamento do boleto Enel Distribuição R$ 145,20 realizado` | `other` | Conta C6 | Gastos Fixos | "Boleto: Enel Distribuição" |
| **C14**| Caixa (Débito Auto)| `Débito em conta` | `Débito automático efetuado Sabesp R$ 82,30` | `other` | Conta Caixa | Gastos Fixos | "Débito Automático: Sabesp" |
| **C15**| Banco24Horas (Saque)| `Banco do Brasil` | `Saque realizado no terminal Banco24Horas no valor de R$ 200,00` | `cash` | Conta BB | Dinheiro / Outros | "Saque em Dinheiro" |
| **C16**| Mercado Pago (QR Code)| `Mercado Pago` | `Você pagou R$ 38,00 com saldo da conta em Mercado Central via QR` | `other`/Saldo | Saldo Mercado Pago | Compras / Alimentação | "Mercado Central" |
| **C17**| Mercado Pago (Auto-Pix / Depósito)| `Seu dinheiro já está disponível` | `Você depositou R$ 3.244,24 via Pix e o valor já está rendendo na sua conta.` | `pix` (Renda) | Sem Cartão | Transferências Recebidas / Depósitos | "Depósito via Pix (Mercado Pago)" |
| **C18**| PicPay (Adicionar Dinheiro)| `Dinheiro na conta!` | `Você adicionou R$ 500,00 via Pix à sua carteira.` | `pix` (Renda) | Sem Cartão | Transferências Recebidas / Depósitos | "Depósito via Pix (PicPay)" |
| **C19**| Nubank (Transferência Própria)| `Transferência recebida` | `Você recebeu uma transferência de R$ 1.000,00 de Gabriel Sales.` | `pix` (Renda) | Sem Cartão | Transferências Recebidas | "Pix Recebido: Gabriel Sales" |

---

## 7. Portões de Qualidade (Quality Gates) e Definition of Done (DoD)

Para que a implementação seja considerada concluída e pronta para entrega:

1. **Gate 1 — Integridade de Dados e Segurança:**
   - Coluna `last_four_digits` criada com constraint segura no Postgres (`CHECK ~ '^[0-9]{4}$'`).
   - Zero exposição de dados sensíveis (apenas 4 últimos dígitos).
   - Tipagem TypeScript estrita com zero erros em `tsc --noEmit`.

2. **Gate 2 — Robustez de Resolução de Cartões, Rendas, Descrições e Anti-Regressão:**
   - 100% dos 19 cenários da matriz E2E aprovados em testes automatizados.
   - Zero ocorrências de falsos positivos de Pix para compras no cartão.
   - Zero ocorrências de falsas despesas para notificações de depósitos, auto-pix e rendas (`depositou`, `dinheiro já está disponível`, `adicionou dinheiro`).
   - Zero ocorrências de descrições espúrias como `"Pix Enviado"` para auto-depósitos ou transferências recebidas.
   - Zero notificações push duplicadas no Android (garantia de canal único de confirmação e idempotência de 5 minutos).
   - Zero distorções de valores monetários causados por números de loja/filial.

3. **Gate 3 — Eficiência e Ergonomia no Lançamento Rápido:**
   - Acesso a 100% das categorias cadastradas através da paginação tátil em menos de 3 segundos.
   - Categorias mais utilizadas sempre visíveis na Página 1.
   - Auto-posicionamento da página quando a categoria for inferida.

4. **Gate 4 — Governança Visual e Produção:**
   - Zero emojis no produto ou mensagens (Regra #8 do AGENTS.md).
   - Zero controles nativos crus (Regra #7 do AGENTS.md).
   - Build do Vite (`npm run build`) e sincronização Android (`npx cap sync android`) limpos e sem warnings.
