# Plano de Implementação Detalhado: Notificações Bancárias, Carteiras Digitais & Seleção de Categorias no Wizard Rápido

> **Status:** Documento de Planejamento e Especificação Técnica Consolidado (Revisão v4 - Checklist de Execução)  
> **Escopo:** Captura passiva no APK Android (Java nativo + TypeScript / Capacitor) + UX/UI do Wizard Rápido (`StepQuick`)  
> **Objetivo:** 
> 1. Garantir 100% de precisão na detecção e classificação de despesas e receitas;
> 2. Identificação correta de bancos emissores e suporte completo a carteiras digitais (Carteira Google e Samsung Pay/Wallet);
> 3. Resolução automática e vinculação correta do cartão de crédito no lançamento rápido;
> 4. Expandir a grade de categorias do Wizard Rápido com ordenação por frequência de uso e botão "Mais categorias" para acesso ao catálogo completo.

---

## 1. Painel Geral de Progresso (Checklist Consolidado)

| Fase | Descrição | Status | Tarefas Concluídas |
|---|---|:---:|:---:|
| **Fase 0** | Diagnóstico Aprofundado, Engenharia Reversa e Especificação Técnica | Concluído | 4 / 4 |
| **Fase 1** | Camada Nativa Android & Desbloqueio de Carteiras (Java / Manifest) | Pendente | 0 / 3 |
| **Fase 2** | Domínio TypeScript: Classificação Precisa de Despesas vs Rendas (`bank-parser.ts`) | Pendente | 0 / 4 |
| **Fase 3** | Inteligência de Carteiras, Resolução de Cartões & Deduplicação | Pendente | 0 / 4 |
| **Fase 4** | Experiência do Wizard Rápido: Categorias Frequentes e Acesso Completo (`StepQuick`) | Pendente | 0 / 4 |
| **Fase 5** | Matriz E2E dos 10 Maiores Bancos & Validação Final (DoD) | Pendente | 0 / 2 |

---

## 2. Visão Geral da Funcionalidade

A esteira de captura e lançamento rápido abrange três camadas integradas:
1. **Camada Nativa Android (Java):**
   - Interceptação de notificações em segundo plano via `NotificationListenerService` (`BankNotificationListenerService.java`).
   - Filtragem por pacotes autorizados, extração de quantia monetária e emissão imediata de push interativo com botões nativos (`BankNotificationActionReceiver.java`).
   - Ponte com a WebView através do plugin Capacitor (`BankNotificationPlugin.java`).
2. **Camada Web/Domínio (TypeScript/React):**
   - `bank-listener.ts`: orquestração do evento, controle de preferências e sincronização de pacotes.
   - `bank-parser.ts`: motor puro de NLP financeiro (resolução de banco, natureza de transação, valor, parcelas, dados de cartão e estabelecimento).
   - `card-resolution.ts`: resolução pura de cartão cadastrado pelo usuário através de tokens bancários e últimos 4 dígitos.
   - `suggestions-store.ts`: armazenamento local, deduplicação temporal e fusão inteligente de dados de carteira com o banco emissor.
   - `interactive-notifications.ts`: registro em segundo plano (*QuickAdd*) via RPC Supabase.
3. **Camada de Interface do Lançamento Rápido (`StepQuick`):**
   - Modo de conferência e lançamento em 1 toque aberto ao tocar em "Conferir e Salvar" no push ou pelo botão central da aplicação.
   - Seleção ágil de valor, tipo (despesa/renda), forma de pagamento, parcelas e categoria.

---

## 3. Diagnóstico Técnico Completo de Fragilidades e Gargalos

A auditoria aprofundada de ponta a ponta revelou **7 pontos críticos**:

### 3.1. Descarte Antecipado no Java (`BankNotificationListenerService.java`)
- **Filtro `hasFinancialSignal` Restrito:** A validação nativa foca em formatos clássicos ("compra de r$", "você recebeu", "pix enviado"). Notificações de despesas com vocabulários modernos ou curtos (muito comuns em aproximação NFC) são descartadas antes de qualquer processamento:
  - Termos ausentes: `"utilizado"`, `"cobrado"`, `"autorizada"`, `"aprovada"`, `"debitado"`, `"transação"`.
- **Formato Sintético da Carteira Google e Samsung Pay:**
  - Carteiras costumam emitir notificações no formato:  
    `"Google Pay · Padaria Estrela · R$ 35,50 com Nubank •••• 1234"` ou `"Samsung Pay: R$ 42,00 em Starbucks"`.
  - Como não contêm os termos estritos exigidos pelo Java, a notificação é descartada silenciosamente.
- **Pacotes Alternativos da Samsung:**
  - A Samsung unificou serviços sob a Samsung Wallet com novos pacotes (`com.samsung.android.app.spay`). Se a notificação vier desse pacote, o serviço descarta por não constar na lista padrão.

### 3.2. Viés de Renda e Falta de Dicionário de Despesa (`bank-parser.ts`)
- **`detectTransactionType` Sem Termos Explícitos de Despesa:**
  - A função avalia exaustivamente `incomeKeywords`, mas não possui uma lista de `expenseKeywords`. Qualquer texto que não contenha palavra de renda cai em `"expense"` por mero fallback (*else*).
  - Em casos ambíguos ou em apps como PicPay/Mercado Pago que usam frases como `"Você pagou R$ 50,00"` ou `"Pagamento aprovado"`, o token `"pagamento"` pode ser confundido com regras de pagamento de fatura ou gerar classificação errática.
- **`detectPaymentMethod` Forçando Cartão de Crédito:**
  - O termo `"crédito"` no texto aciona diretamente o método `credit_card`. Notificações legítimas de renda como `"Crédito em conta de R$ 1.500,00"` ou `"Salário creditado"` acabam classificadas erroneamente como compras no cartão de crédito.

### 3.3. Resolução Unilateral de Carteiras Digitais (`isBankMonitored` e `resolveBankName`)
- Quando a compra é feita por aproximação, o pacote Android pertence à carteira (`com.google.android.apps.walletnfcrel`), mas o cartão utilizado pertence a um banco emissor (ex.: Nubank, Itaú).
- Se o usuário selecionar apenas o "Nubank" para monitoramento e deixar a "Carteira Google" desmarcada nas preferências, o validador nativo e o `bank-listener.ts` descartam a notificação, pois testam apenas o pacote da carteira.
- Falta um resolvedor em duas vias: se a carteira for detectada, o sistema deve verificar se o **banco emissor do cartão** está na lista de monitorados do usuário.

### 3.4. Resolução de Cartão Quebrada no QuickAdd (`interactive-notifications.ts`)
- No método `quickAddTransaction`:
  ```ts
  const matchingCard = cards.find((card) => card.name.toLowerCase().includes(suggestion.bankName.toLowerCase())) || cards[0];
  ```
- **O Bug da Carteira Digital:** Quando a notificação vem da Carteira Google, `suggestion.bankName` é `"Carteira Google"`. O código busca um cartão com nome contendo "Carteira Google" (que nunca existe), e acaba selecionando **o primeiro cartão cadastrado do usuário (`cards[0]`)** por fallback, ignorando completamente o `issuerBank` (ex.: "Nubank") e os últimos 4 dígitos (`cardLastDigits`)!
- O sistema já possui um motor puro especializado em [`card-resolution.ts`](file:///home/gabrielsales/meus_apps/financasnew/src/domain/notifications/card-resolution.ts) (`resolveMatchingCreditCard`), mas o `quickAddTransaction` não estava utilizando esse motor.

### 3.5. Deduplicação Excessivamente Agressiva (`suggestions-store.ts`)
- A chave de deduplicação atual `source_bank_cents_date_merchant` não possui granularidade temporal.
- Se o usuário realizar **duas compras de mesmo valor no mesmo estabelecimento no mesmo dia** (ex.: duas passagens de metrô de R$ 5,00 ou dois cafés de R$ 12,00), a segunda notificação é descartada silenciosamente.
- A chave também não inclui a natureza da transação (`nature`), podendo colapsar uma entrada e uma saída de mesmo valor no mesmo dia.

### 3.6. Blacklist de "Agendados" Descartando Débitos Reais
- O regex `/\bagendad[ao]\b/i` é amplo demais. Frases como `"Débito agendado realizado com sucesso: R$ 85,00"` ou `"Pagamento agendado foi debitado da sua conta"` representam movimentações financeiras já consumadas, mas são descartadas pela blacklist semântica.

### 3.7. Bloqueio de Categorias no Wizard Rápido (`StepQuick.tsx`)
- Em `StepQuick.tsx` (L268):
  ```tsx
  {(categories ?? []).slice(0, 8).map((cat) => { ... })}
  ```
- **O Gargalo:** O componente aplica um `slice(0, 8)` rígido na lista estática de categorias retornada pelo banco de dados (que costuma vir em ordem alfabética ou de criação).
- **Consequências:**
  1. O usuário fica impedido de acessar categorias a partir da 9ª posição (ex.: "Educação", "Viagens", "Doações", "Assinaturas" ou categorias customizadas criadas pelo usuário);
  2. As 8 primeiras não refletem as categorias que o usuário mais utiliza na vida real;
  3. Não existe um botão "Mais" para expandir a lista ou abrir um seletor completo mantendo o fluxo rápido em tela única.

---

## 4. Arquitetura Alvo das Melhorias

```
[Notificação do Sistema Android]
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Camada Nativa Java (BankNotificationListenerService)    │
│    - Pacotes expandidos (Samsung Wallet, Google Wallet, etc.) │
│    - Filtro hasFinancialSignal ampliado com termos NFC/despesas│
│    - Extração monetária resiliente (R$, US$, USD, BRL)      │
│    - Push interativo imediato com botões [Confirmar] e [Ver]│
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Orquestração e Resolução de Carteiras (bank-listener.ts) │
│    - Resolução cruzada: pacote da carteira OU banco emissor │
│    - Rastreamento com motivo formal de rejeição em DEV     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Motor Puro de NLP Financeiro (bank-parser.ts)            │
│    - detectTransactionType simétrico (income vs expense)   │
│    - detectPaymentMethod contextual (desacopla "crédito")   │
│    - Blacklist refinada (permite débitos agendados reais)   │
│    - Limpeza de adquirentes e extração limpa de merchant    │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│ 4. Fila Reativa & QuickAdd│   │ 5. Wizard Rápido (StepQuick)│
│ - Chave bucket 5 min      │   │ - Ranqueamento por frequên- │
│ - card-resolution no push │   │   cia real (histórico)      │
│   (usa issuerBank/dígitos)│   │ - Top frequentes visíveis   │
│                           │   │ - Botão "Mais categorias"   │
│                           │   │   (abre grade/busca total)  │
└───────────────────────────┘   └─────────────────────────────┘
```

---

## 5. Checklist Detalhado de Implementação por Fases e Quality Gates

### FASE 0: Diagnóstico e Planejamento (CONCLUÍDA)
- [x] **0.1** Mapeamento e engenharia reversa do fluxo completo de notificações (Java, Capacitor e TS).
- [x] **0.2** Identificação da causa-raiz do não reconhecimento de despesas (`detectTransactionType` sem dicionário explícito e viés de renda).
- [x] **0.3** Identificação do descarte de Carteira Google e Samsung Pay (filtro Java `hasFinancialSignal` e resolução unilateral).
- [x] **0.4** Identificação da falha de atribuição de cartão no `quickAddTransaction` e bloqueio de categorias no `StepQuick.tsx`.

---

### FASE 1: Camada Nativa Android & Desbloqueio de Carteiras (PENDENTE)
**Foco:** Garantir que o serviço nativo Android capture todas as notificações reais de despesas, carteiras digitais (Google Wallet, Samsung Pay/Wallet) e fintechs sem descartá-las no filtro inicial.

- [ ] **1.1** Adicionar novos pacotes de carteiras e fintechs ao `AndroidManifest.xml` (queries) e `DEFAULT_MONITORED_PACKAGES` do Java:
  - `com.samsung.android.app.spay` (Samsung Wallet nova).
  - `com.google.android.apps.walletnfcrel` (Carteira Google).
  - Variantes de fintechs (Will Bank, Original, etc.).
- [ ] **1.2** Expandir o array de sinais no método `hasFinancialSignal` (`BankNotificationListenerService.java`):
  - Incluir: `"utilizado"`, `"cobrado"`, `"autorizada"`, `"aprovada"`, `"debitado"`, `"pagou"`, `"enviado"`, `"aproximação"`, `"nfc"`, `"transação"`.
  - Permitir notificações curtas com quantia monetária associadas a carteiras conhecidas.
- [ ] **1.3** Ajustar método `isIncome()` no `BankNotificationActionReceiver.java` para não classificar `"crédito à vista"` ou `"compra no crédito"` como renda.

> 🛡️ **PORTÃO DE QUALIDADE 1 (Quality Gate 1):**
> - [ ] Compilação do módulo Android (`./gradlew assembleDebug`) sem advertências ou erros.
> - [ ] Testes unitários do Java (`BankNotificationListenerServiceTest.java`) validados para Carteira Google e Samsung Pay.
> - [ ] Notificações mockadas de pagamentos por aproximação geram push interativo com ações [Adicionar Rápido] e [Conferir e Salvar].

---

### FASE 2: Domínio TypeScript — Classificação Precisa de Despesas vs Rendas (PENDENTE)
**Foco:** Eliminar o viés que favorece rendas e garantir que notificações de despesas e compras de qualquer banco sejam reconhecidas com alta precisão.

- [ ] **2.1** Implementar lista de `expenseKeywords` explícitas em `detectTransactionType` (`bank-parser.ts`):
  - `"compra aprovada"`, `"compra realizada"`, `"você pagou"`, `"voce pagou"`, `"pagamento realizado"`, `"pagamento de r$"`, `"pix enviado"`, `"transferência enviada"`, `"débito realizado"`, `"compra no crédito"`, `"compra no débito"`, `"valor debitado"`.
  - Adicionar pontuação determinística (*scoring*) para resolução de termos concorrentes.
- [ ] **2.2** Desambiguação de Forma de Pagamento (`detectPaymentMethod`):
  - Isolar o token `"crédito"`: quando acompanhado de contexto de recebimento ("crédito em conta", "creditado"), vincular a `pix` ou `transfer`.
  - Quando associado a carteira digital ou termos de aproximação, classificar como `credit_card` ou `debit`.
- [ ] **2.3** Refinamento da Blacklist Semântica:
  - Ajustar regex `\bagendad[ao]\b` para não descartar transações cuja liquidação já foi concluída (ex.: `"Débito agendado realizado de R$ 150,00"`).
- [ ] **2.4** Limpeza e Extração de Estabelecimentos (`extractMerchantOrRecipient`):
  - Evitar que nomes de carteiras (Google Pay, Samsung Pay) e fragmentos de cartão (ex.: "final 1234") sejam extraídos como nome do estabelecimento.

> 🛡️ **PORTÃO DE QUALIDADE 2 (Quality Gate 2):**
> - [ ] Suíte de testes unitários do `bank-parser.test.ts` 100% aprovada.
> - [ ] Pelo menos 25 novos casos de teste com despesas de Mercado Pago, PicPay, Inter, C6, Santander, Nubank e Itaú.
> - [ ] Zero falsos positivos em notificações de faturas fechadas e lembretes de crédito.

---

### FASE 3: Inteligência de Carteiras, Resolução de Cartões & Deduplicação (PENDENTE)
**Foco:** Resolver a vinculação entre Carteira Digital e Banco Emissor, aplicar o motor de resolução de cartões no QuickAdd e deduplicar sem perda de compras repetidas no mesmo dia.

- [ ] **3.1** Resolução Cruzada de Monitoramento (`isBankMonitored` em `bank-listener.ts`):
  - Se a notificação for de carteira digital, autorizar se a própria carteira **OU** o banco emissor do cartão (`issuerBank`) estiverem monitorados.
- [ ] **3.2** Integração do Motor de Cartões no QuickAdd (`interactive-notifications.ts`):
  - Substituir busca ingênua `card.name.includes(suggestion.bankName)` pelo motor `resolveMatchingCreditCard` de `card-resolution.ts`.
  - Vincular compras da Carteira Google ao cartão correto do usuário a partir de `issuerBank` e `cardLastDigits`.
- [ ] **3.3** Deduplicação com Janela Temporal de 5 Minutos (`suggestions-store.ts`):
  - Incluir bucket de 5 minutos na chave composta: `Math.floor((s.timestamp || 0) / (5 * 60 * 1000))`.
  - Incluir `nature` (`expense` vs `income`) na chave composta.
- [ ] **3.4** Rastreamento e Diagnóstico em Desenvolvimento:
  - Criar enum `ParseRejectReason` (`"blacklisted" | "not_monitored" | "no_financial_signal" | "no_amount" | "disabled"`) com logs defensivos em modo DEV.

> 🛡️ **PORTÃO DE QUALIDADE 3 (Quality Gate 3):**
> - [ ] Teste automatizado validando que 2 compras idênticas no mesmo dia com intervalo > 5 minutos são mantidas na fila.
> - [ ] Teste automatizado validando que compra na Carteira Google é capturada mesmo com apenas o banco do cartão selecionado nas preferências.
> - [ ] Teste automatizado do `quickAddTransaction` comprovando que o cartão correto é atribuído a partir de dados da Carteira Google/Samsung Pay.
> - [ ] Typecheck (`tsc --noEmit`) sem nenhum erro.

---

### FASE 4: Experiência do Wizard Rápido — Categorias Frequentes e Acesso Completo (PENDENTE)
**Foco:** Eliminar a barreira das 8 categorias fixas no `StepQuick.tsx`, ordenando as categorias principais pela frequência real de uso do usuário e adicionando o botão "Mais" para listar e buscar todas as demais categorias.

- [ ] **4.1** Ranqueamento de Categorias por Frequência de Uso:
  - Aproveitar o histórico preditivo do sistema (`usePredictionHistory`) ou contagem de transações recentes por `categoryId` para o tipo atual (`expense` ou `income`).
  - Ordenar as categorias mais utilizadas no topo da lista.
- [ ] **4.2** Estrutura Visual da Grade (Top Frequentes + Botão "Mais"):
  - Exibir na grade rápida principal as **Top 7 categorias mais frequentes**.
  - No 8º slot da grade, renderizar botão interativo "Mais categorias":
    ```tsx
    <button type="button" onClick={() => setShowAllCategories((prev) => !prev)}>
      <Plus className="size-4" aria-hidden="true" />
      <span>Mais categorias</span>
    </button>
    ```
  - Se a categoria sugerida pela notificação não estiver entre as 7 primeiras, mantê-la visível e selecionada.
- [ ] **4.3** Visualização das Demais Categorias (Expansão Fluida):
  - Ao tocar em "Mais categorias", expandir suavemente a grade para exibir as demais categorias disponíveis, com campo de filtro rápido para localização instantânea.
  - Rolagem confortável sem elementos nativos de controle (zero `<select>` nativo, Regra DRY #7).
- [ ] **4.4** Testes Unitários de Interface (`step-quick.test.tsx`):
  - Teste validando ordenação por frequência.
  - Teste simulando clique no botão "Mais" e verificando renderização das categorias restantes.
  - Teste garantindo exibição de categoria selecionada fora das Top 7.

> 🛡️ **PORTÃO DE QUALIDADE 4 (Quality Gate 4):**
> - [ ] Suíte de testes `step-quick.test.tsx` e `launch-wizard.test.tsx` 100% verde.
> - [ ] Navegação por teclado (`Tab`, `Enter`, `Espaço`) fluida e acessível na expansão de categorias.
> - [ ] Zero quebra de layout mobile (< 400px) e desktop (Regra DRY #10 e #12).

---

### FASE 5: Matriz E2E dos 10 Maiores Bancos & Validação Final (PENDENTE)
**Foco:** Consolidar testes end-to-end de alta fidelidade e validação integrada.

- [ ] **5.1** Expansão da Matriz E2E (`bank-e2e-matrix.test.ts`):
  - Incluir casos de teste reais de:
    - Carteira Google com Nubank, Itaú, Santander e C6 Bank.
    - Samsung Pay com cartões Bradesco, Inter e Banco do Brasil.
    - Compras e Pix enviados no Mercado Pago e PicPay.
- [ ] **5.2** Validação de Regras do Projeto (Governance Check):
  - Executar `npm run lint` para garantir zero emojis, cumprimento estrito de tipagem TypeScript e ausência de caracteres decorativos.
  - Conferência de integridade em `docs/PROJECT_STRUCTURE.md`.

> 🛡️ **PORTÃO DE QUALIDADE FINAL (Definition of Done):**
> - [ ] Toda a suíte de testes do projeto (`npm run test`) aprovada com 100% de sucesso.
> - [ ] Lint sem violações (`npm run lint`).
> - [ ] Geração de build limpa do APK (`npm run build`).

---

## 6. Mapeamento de Arquivos Impactados

| Arquivo | Camada | Motivo da Alteração |
|---|---|---|
| `android/app/src/main/AndroidManifest.xml` | Nativo Android | Adicionar queries de pacotes atualizados da Samsung Wallet e novas carteiras |
| `android/app/src/main/java/.../BankNotificationListenerService.java` | Nativo Java | Ampliar sinais financeiros para NFC, despesas modernas e pacotes permitidos |
| `android/app/src/main/java/.../BankNotificationActionReceiver.java` | Nativo Java | Desambiguar classificação de renda vs despesa em ações rápidas |
| `android/app/src/main/java/.../BankNotificationPlugin.java` | Nativo Java | Mapear variantes de pacotes de carteiras e instituições |
| `src/domain/notifications/bank-parser.ts` | Domínio TS | Implementar `expenseKeywords`, ajustar `detectPaymentMethod` e refinar blacklist |
| `src/domain/notifications/preferences.ts` | Domínio TS | Mapear novos pacotes e suportes a carteiras |
| `src/services/native/bank-listener.ts` | Serviço TS | Implementar resolução cruzada (carteira x banco emissor) e enum de rejeição |
| `src/services/native/suggestions-store.ts` | Serviço TS | Ajustar chave composta de deduplicação (bucket 5 min + nature) |
| `src/services/native/interactive-notifications.ts` | Serviço TS | Integrar `resolveMatchingCreditCard` para atribuir cartão correto via dados de carteira |
| `src/features/transactions/wizard/step-quick.tsx` | UI Feature | Implementar ordenação por frequência de uso e expansão com botão "Mais categorias" |
| `src/features/transactions/wizard/step-quick.test.tsx` | Testes UI | Testes de ordenação de categorias e clique no botão "Mais categorias" |
| `src/domain/notifications/bank-parser.test.ts` | Testes TS | Casos de teste de despesas de carteiras e bancos digitais |
| `src/domain/notifications/bank-e2e-matrix.test.ts` | Testes TS | Matriz E2E cobrindo Google Wallet, Samsung Pay e top 10 bancos |
