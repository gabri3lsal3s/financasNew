# PLANO DE IMPLEMENTAÇÃO — REFINAMENTO DA CAPTURA DE COMPROVANTES (FOTO, PDF E IMAGEM), PARCELAMENTO & RESOLUÇÃO DE CARTÕES

> **Documento Canônico de Arquitetura e Engenharia**  
> **Status:** 100% Concluído (Fases 1 a 5) · Quality Gates QG1–QG Final Aprovados  
> **Módulos Afetados:** `src/domain/notifications/`, `src/services/native/`, `src/services/merchant-learning.ts`, `src/components/modules/`, `src/features/transactions/wizard/`, `docs/`  
> **Governança:** Custo Zero de Infraestrutura (Google ML Kit nativo on-device + `unpdf` e `tesseract.js` dinâmico sob demanda na Web) · TypeScript Estrito · Funções Puras no Domínio · Moeda em Centavos · Zero Emojis · Portões de Qualidade (QG) por Fase  
> **Data:** Outubro de 2026 · **Ambiente:** Android Nativo (Capacitor) & Web PWA  

---

## 1. SUMÁRIO EXECUTIVO & ARQUITETURA DE VALOR

A captura de comprovantes (via foto pela câmera, upload de imagem PNG/JPG/WebP ou anexo de PDF digital) é a principal via de **fricção mínima** para lançamento de despesas e rendas quando a notificação bancária passiva não ocorre (ex.: compras com maquininha sem push no celular, pagamentos de boletos, cupons fiscais e transferências manuais).

Este plano estabelece a modernização e refinamento profundo dessa funcionalidade para atingir 4 objetivos essenciais:
1. **Universalidade de Formatos e Plataformas**: Extração de texto no **Android Nativo** (ML Kit Text Recognition) e no **Web/PWA** (PDFs digitais com `unpdf` e imagens/fotos com `tesseract.js` sob demanda via *dynamic import*, sem inchar o bundle inicial).
2. **Compreensão Multimodal de Comprovantes**: Superação da limitação histórica centrada em Pix, suportando comprovantes de **Maquininhas de Cartão (Slips Cielo, Rede, Stone, PagBank, SafraPay, etc.)**, **Boletos Bancários/Tributos**, **Cupons Fiscais (NFC-e / SAT / DANFE)** e **Transferências TED/DOC**.
3. **Tratamento Preciso de Parcelamento**: Identificação robusta de compras e rendas parceladas (`3x de R$ 50,00`, `PARC: 03`, `R$ 300 em 3x`), distinguindo compras a prazo totais de parcelas isoladas, calculando competências e resíduos de centavos com precisão matemática.
4. **Resolução de Cartões e Memória Contínua**: Associação automática do cartão de crédito cadastrado ativo mais aderente (por últimos 4 dígitos, bandeira, emissor ou preferência aprendida) e persistência de um mapa adaptativo de dígitos (`cardDigitsMap`) e preferências por estabelecimento, garantindo que o sistema aprenda com o comportamento do usuário e acerte nas capturas seguintes.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          PIPELINE DE CAPTURA E PROCESSAMENTO UNIVERSAL                                │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
       [AMBIENTE ANDROID NATIVO]                                             [AMBIENTE WEB / PWA]
       Google ML Kit Text Recognition                                        PDF: unpdf (Digital Streams)
       (Local on-device, thin <800 KB)                                       Imagem: tesseract.js (Dynamic Import)
                 │                                                                     │
                 └──────────────────────────────────┬──────────────────────────────────┘
                                                    ▼
                                   [CAMADA 1: NORMALIZAÇÃO ÓPTICA]
                                   Limpeza de artefatos, correção de ruídos (O vs 0, l vs 1)
                                   e unificação de separadores monetários (R$)
                                                    │
                                                    ▼
                                 [CAMADA 2: MOTOR UNIVERSAL DE DOMÍNIO]
                        ┌───────────────────────────┴───────────────────────────┐
                        ▼                                                       ▼
             [CLASSIFICAÇÃO DO TIPO]                                [EXTRATOR DE PARCELAMENTO]
             - Pix (Enviado / Recebido / Agendado)                  - Multiplicador (3x de R$ 50)
             - Slip Maquininha (Crédito / Débito)                   - Total parcelado (R$ 300 em 3x)
             - Boleto / Concessionária / Tributo                    - POS/Maquininha (PARC: 03)
             - Cupom Fiscal / NFC-e / DANFE                         - Parcela isolada (02/10)
             - TED / DOC / Transferência
                        │                                                       │
                        └───────────────────────────┬───────────────────────────┘
                                                    ▼
                                 [CAMADA 3: RESOLUÇÃO E MEMÓRIA DE CARTÃO]
                                 1. Match por Dígitos Aprendidos (cardDigitsMap)
                                 2. Match por 4 Dígitos no Nome do Cartão
                                 3. Match por Emissor / Banco + Desempate por Bandeira
                                 4. Fallback por Cartão Preferencial do Estabelecimento
                                                    │
                                                    ▼
                                      [CAMADA 4: CONSUMO NA UI]
                 ┌──────────────────────────────────┴──────────────────────────────────┐
                 ▼                                                                     ▼
        [LAUNCH WIZARD RÁPIDO]                                                [AUTO-CADASTRO DIRETO]
        - Pré-preenchimento instantâneo                                       - Efetivação transacional
        - Categoria, Cartão e Parcelas                                        - Vincula cardId e competência
        - Feedback visual com badges do tipo                                  - Dispara aprendizado contínuo
```

---

## 2. MATRIZ DE AUDITORIA DE FRAGILIDADES & SALVAGUARDAS BLINDADAS

| # | Fragilidade Diagnosticada | Causa Raiz no Código Legado | Solução de Engenharia Blindada | Status |
|---|---|---|---|---|
| **F1** | Imagens e fotos no Web/PWA falham 100% | `receipt-extractor.ts` retornava string vazia `""` para imagens no navegador. | Implementado `web-ocr.ts` usando `tesseract.js` carregado sob demanda (*dynamic import* `await import(...)`), mantendo o bundle inicial inalterado. | **Concluído** |
| **F2** | PDFs no Web/PWA falham na maioria dos bancos | Regex ingênua procurava strings Latin1 `Tj` no buffer cru; não decodificava streams zlib. | Substituída a leitura regex pelo extrator digital `unpdf`, já integrado em `receipt-extractor.ts`. | **Concluído** |
| **F3** | Monocultura de Pix no parser | `AttachReceiptDialog` aciona exclusivamente `parsePixShareText`, forçando `paymentMethod: "pix"`. | Implementado `universal-receipt-parser.ts` com sub-parsers especializados para Cartões (POS), Boletos, NFC-e e TED. | **Concluído** |
| **F4** | Formatos comuns de maquininhas ignorados | Extrator de parcelamento ignorava `PARC: 03`, `3x de R$ 50,00` e espaços entre número e `x`. | Desenvolvido `installment-extractor.ts` puro, cobrindo regexes tolerantes a espaços, variações de caixa e marcações POS. | **Concluído** |
| **F5** | Despesas parceladas corrompidas no auto-cadastro | `autoRegisterReceipt` hardcoda `cardId: null` e `paymentMethod: "pix"`. | Respeitado o `cardId` resolvido e a competência de fatura calculada via `closing_day` do cartão no `buildExpenseInstallments`. | **Concluído** |
| **F6** | Resolução de cartão ignorada no LaunchWizard | Linha 413 de `launch-wizard.tsx` usa `.find(name.includes(bankName))`, ignorando `resolveBestMatchingCard`. | Integrado `resolveBestMatchingCard` no `handleReceiptParsed`, transmitindo `cardLastDigits`, `bankName`, `issuerBank` e `cardBrand`. | **Concluído** |
| **F7** | Desempate impossível entre múltiplos cartões do mesmo banco | Comprovantes térmicos trazem apenas `**** 1234` e a bandeira, sem o nome do cartão. | Criada memória `cardDigitsMapping` (`1234 -> cardId`), permitindo que a confirmação do usuário ensine o sistema. | **Concluído** |
| **F8** | Memória do usuário limitada à categoria | `MerchantLearningRecord` salva apenas `friendlyName` e `categorySlug`. | Estendido o registro com `preferredPaymentMethod` e `preferredCardId`, alimentados ao salvar a transação. | **Concluído** |
| **F9** | Ruídos de OCR quebrando valores monetários | Caracteres `O` lidos como `0`, `l` como `1`, ou vírgula trocada por ponto em tickets térmicos. | Implementado normalizador óptico puro `ocr-cleaner.ts` executado antes do parsing semântico. | **Concluído** |
| **F10**| Dialog de anexo não informa o que foi lido | O usuário vê apenas mensagem genérica ou erro sem saber qual tipo de comprovante foi detectado. | Card de preview no diálogo indicando o tipo identificado (Pix, Cartão de Crédito 3x, Boleto) antes de fechar. | **Concluído** |
| **F11**| Risco de overhead no bundle web | Adicionar OCR pesado no bundle inicial aumentaria o tempo de carregamento da aplicação. | Módulo `tesseract.js` sob demanda (*dynamic import*) em `web-ocr.ts`. | **Concluído** |
| **F12**| Rendas parceladas sem tratamento | Comprovantes de vendas ou serviços parcelados recebidos pelo usuário viravam despesa ou valor truncado. | Suporte a `nature: "income"` com parcelamento via `buildIncomeInstallments` integrado. | **Concluído** |

---

## 3. CHECKLIST EXECUTIVO EM 5 FASES

### Legenda de Status
- `[x]` **Concluído**: Implementado, tipado, testado com Vitest e aprovado em Quality Gate.
- `[ ]` **Pendente**: Roteiro pronto com especificação detalhada para implementação manual pelo desenvolvedor.

---

### FASE 1: Extração de Texto Web (PDF e Imagens) & Normalização Óptica
> **Status:** 100% Concluída · Quality Gate 1 Aprovado (2026-10-29)

- [x] **Tarefa 1.1: Normalizador Puro de Ruídos Ópticos (`src/domain/notifications/ocr-cleaner.ts`)**
  - [x] Função pura `cleanOcrText(rawText: string)` implementada sem dependências de DOM/React.
  - [x] Remoção defensiva de caracteres de controle invisíveis (`stripControlCharacters`) sem violar a regra ESLint `no-control-regex`.
  - [x] Normalização de trocas ópticas de caracteres em valores monetários (`R$ 1O,OO` $\rightarrow$ `R$ 10,00`, `l` vs `1`).
  - [x] Padronização de datas brasileiras (`DD/MM/AAAA` ou `DD-MM-AAAA`) e expansão de anos de 2 dígitos.
  - [x] Normalização de caracteres em sequências de CNPJ/CPF (`/OOO1-` $\rightarrow$ `/0001-`).
  - [x] Testes unitários colocalizados em `src/domain/notifications/ocr-cleaner.test.ts` (9/9 testes aprovados).

- [x] **Tarefa 1.2: Extração Resiliente de PDF na Web com `unpdf` (`src/services/native/receipt-extractor.ts`)**
  - [x] Integração de `extractText` da biblioteca `unpdf` (já presente em `package.json`).
  - [x] Decodificação de streams digitais compactadas zlib/FlateDecode e ToUnicode mappings.
  - [x] Fallback defensivo para o decodificador Latin1 `extractTextFromPdfArrayBuffer` em caso de exceção.

- [x] **Tarefa 1.3: Módulo de OCR Web Sob Demanda com `tesseract.js` (`src/services/native/web-ocr.ts`)**
  - [x] Instalação de `tesseract.js` no `package.json`.
  - [x] Implementação de `extractTextFromImageWeb(file)` com *dynamic import* sob demanda (`await import("tesseract.js")`).
  - [x] Configuração de idioma português (`por`) com tipagem estrita de `TerminableWorker`.
  - [x] Timeout de segurança de 12 segundos contra travamentos em dispositivos móveis.
  - [x] Liberação garantida do worker no bloco `finally` para prevenção de vazamento de memória RAM.

- [x] **Tarefa 1.4: Orquestrador da Extração com Fallback Transparente (`src/services/native/receipt-extractor.ts`)**
  - [x] Pipeline unificado: Nativo (ML Kit) $\rightarrow$ Web PDF (`unpdf`) $\rightarrow$ Web Imagem (`web-ocr.ts`) $\rightarrow$ Texto Puro.
  - [x] Execução obrigatória de `cleanOcrText` sobre o texto final extraído.
  - [x] Testes de integração em `src/components/modules/attach-receipt-dialog.test.tsx` (3/3 testes aprovados).

> [!TIP]
> **Quality Gate 1 (QG1) — APROVADO**:
> - Testes unitários de `ocr-cleaner.test.ts` e `attach-receipt-dialog.test.tsx` 100% verdes.
> - `npm run typecheck` (`tsc -b`) sem erros de tipagem.
> - `npm run lint` (`eslint .`) sem nenhuma violação.

---

### FASE 2: Motor Universal de Domínio e Parcelamento Robusto
> **Status:** 100% Concluída · Quality Gate 2 Aprovado (2026-10-29)

- [x] **Tarefa 2.1: Contratos e Tipagem Unificada (`src/domain/notifications/receipt-types.ts`)**
  - [x] Definição de `ReceiptKind = "pix" | "card_slip" | "bank_slip_payment" | "invoice_danfe" | "wire_transfer" | "generic"`.
  - [x] Estrutura completa de `ParsedInstallmentData` (`count`, `installmentAmountCents`, `totalAmountCents`, `currentInstallment`, `isNewFinancedPurchase`).
  - [x] Interface consolidada `UniversalReceiptData` com adquirente, autorização, bandeira, últimos 4 dígitos e data ISO.
  - [x] Exportação no barrel `src/domain/notifications/index.ts`.

- [x] **Tarefa 2.2: Extrator Universal de Parcelamento (`src/domain/notifications/installment-extractor.ts`)**
  - [x] Função pura `extractDetailedInstallments(text: string, referenceAmountCents: number | null)`:
    - [x] Padrão 1: Multiplicador com valor de parcela (`em 3x de R$ 50,00`, `3 x 120,50`).
    - [x] Padrão 2: Total com quantidade de parcelas (`R$ 300,00 em 3x`).
    - [x] Padrão 3: Padrão de Maquininhas POS (`PARC: 04`, `QTDE PARCELAS: 10`, `PARCELADO LOJA`).
    - [x] Padrão 4: Parcela isolada de controle contínuo (`Parcela 02/10 de R$ 45,00`, `PARC 03 DE 12`).
    - [x] Limite estrito de 2 a 60 parcelas com centavos inteiros.
  - [x] Testes unitários colocalizados em `src/domain/notifications/installment-extractor.test.ts` (9/9 testes aprovados).

- [x] **Tarefa 2.3: Sub-parser de Comprovantes de Maquininha POS/TEF (`src/domain/notifications/card-slip-parser.ts`)**
  - [x] Reconhecimento de adquirentes: Cielo, Rede, Stone, PagBank/PagSeguro, Getnet, SafraPay, Mercado Pago, Vero.
  - [x] Detecção de modalidade: Crédito à Vista, Crédito Parcelado Loja, Débito.
  - [x] Extração de bandeira (Visa, Mastercard, Elo, Amex, Hipercard) e últimos 4 dígitos (`**** 1234` ou `FINAL 1234`).
  - [x] Extração de estabelecimento comercial higienizado de adquirentes e código de autorização/NSU.
  - [x] Testes unitários colocalizados em `src/domain/notifications/card-slip-parser.test.ts` (6/6 testes aprovados).

- [x] **Tarefa 2.4: Sub-parsers Especializados Restantes (`src/domain/notifications/`)**
  - [x] **`pix-receipt-parser.ts` (Comprovantes Pix)**:
    - Extrair a lógica de comprovante Pix de `bank-parser.ts` para um módulo dedicado puro.
    - Retornar `UniversalReceiptData` com `kind: "pix"`, favorecido/pagador, chave Pix, EndToEndId/TXID e status (efetivado vs agendado).
    - Criar `pix-receipt-parser.test.ts`.
  - [x] **`bank-slip-parser.ts` (Boletos Bancários e Tributos)**:
    - Identificar termos: `COMPROVANTE DE PAGAMENTO DE BOLETO / TITULO / CONVENIO / TRIBUTO / DARF / GPS`.
    - Extrair beneficiário/cedente, pagador/sacado, valor cobrado, valor pago, data de vencimento e data de pagamento.
    - Extrair código de barras ou linha digitável quando presente.
    - Criar `bank-slip-parser.test.ts`.
  - [x] **`danfe-nfc-parser.ts` (Cupons Fiscais Eletrônicos NFC-e / SAT)**:
    - Identificar termos: `DANFE NFC-e`, `DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR`, `EXTRATO SAT`.
    - Extrair emitente, CNPJ, valor total a pagar e forma de pagamento (crédito, débito, dinheiro, Pix).
    - Criar `danfe-nfc-parser.test.ts`.
  - [x] **`wire-transfer-parser.ts` (Transferências TED / DOC / Entre Contas)**:
    - Identificar comprovantes de transferências bancárias tradicionais com banco de origem, agência, conta, favorecido e valor.
    - Criar `wire-transfer-parser.test.ts`.

- [x] **Tarefa 2.5: Orquestrador Universal de Comprovantes (`src/domain/notifications/universal-receipt-parser.ts`)**
  - [x] Implementar a função pura `parseUniversalReceipt(rawText: string): UniversalReceiptData | null`:
    1. Executar `cleanOcrText(rawText)`.
    2. Detecção determinística de assinaturas para eleger o sub-parser com maior confiança:
       - Se contiver marcadores de boleto (`código de barras`, `linha digitável`, `pagamento de título`) $\rightarrow$ `parseBankSlipReceipt`.
       - Se contiver marcadores de slip POS (`cielo`, `stone`, `via cliente`, `parc:`, `crédito à vista`) $\rightarrow$ `parseCardSlipReceipt`.
       - Se contiver marcadores de cupom fiscal (`danfe`, `nfc-e`, `extrato sat`) $\rightarrow$ `parseDanfeNfcReceipt`.
       - Se contiver marcadores Pix (`pix`, `endtoendid`, `chave pix`, `000201`) $\rightarrow$ `parsePixReceipt`.
       - Se contiver marcadores de TED/DOC $\rightarrow$ `parseWireTransferReceipt`.
    3. Acoplamento automático do extrator de parcelamento (`extractDetailedInstallments`).
    4. Fallback semântico para recibos não estruturados.
  - [x] Criar testes unitários em `src/domain/notifications/universal-receipt-parser.test.ts` cobrindo 20+ amostras reais de comprovantes.
  - [x] Exportar no barrel `src/domain/notifications/index.ts`.

> [!TIP]
> **Quality Gate 2 (QG2) — Critérios de Aprovação**:
> - Todos os sub-parsers (`card-slip`, `pix`, `bank-slip`, `danfe-nfc`, `wire-transfer`) testados individualmente.
> - `universal-receipt-parser.test.ts` com 100% de aprovação.
> - Invariantes matemáticas de parcelamento estritas (soma das parcelas = total original, sem perda de centavos).
> - `npm run typecheck` e `npm run lint` sem erros.

---

### FASE 3: Resolução Avançada e Memória Contínua de Cartões
> **Status:** 100% Concluída · Quality Gate 3 Aprovado (2026-10-29)

- [x] **Tarefa 3.1: Expansão do Motor de Memória (`src/domain/notifications/merchant-memory.ts`)**
  - [x] Adicionar campos opcionais em `RecordMerchantLearningParams` e `MerchantLearningRecord`:
    - `preferredPaymentMethod?: PaymentMethod`
    - `preferredCardId?: string`
  - [x] Criar a estrutura e funções puras do mapa de dígitos de cartão:
    - `export type CardDigitsMapping = Record<string, string>;` (ex: `{"4821": "card-itau-uuid", "3341": "card-stone-uuid"}`).
    - `recordCardDigitsLearning(digits: string, cardId: string, current: CardDigitsMapping): CardDigitsMapping`
    - `lookupCardByDigits(digits: string, mapping: CardDigitsMapping): string | undefined`
    - `forgetCardDigitsLearning(cardId: string, current: CardDigitsMapping): CardDigitsMapping`
  - [x] Criar testes unitários colocalizados em `src/domain/notifications/merchant-memory.test.ts`.

- [x] **Tarefa 3.2: Refinamento de `resolveBestMatchingCard` (`src/domain/notifications/card-resolution.ts`)**
  - [x] Adicionar campos em `CardResolutionParams`:
    - `cardDigitsMapping?: CardDigitsMapping`
    - `preferredCardId?: string`
  - [x] Implementar a hierarquia de resolução em 5 etapas estritas:
    1. **1ª Prioridade (Dígitos Aprendidos)**: se `cardLastDigits` constar no `cardDigitsMapping`, retorna o cartão correspondente imediatamente.
    2. **2ª Prioridade (Dígitos no Nome do Cartão)**: busca cartões cadastrados cujo nome contenha os 4 dígitos informados.
    3. **3ª Prioridade (Emissor/Banco + Desempate por Bandeira)**: cruza aliases de banco (`Nubank`, `Itaú`, `C6`, `Bradesco`, `XP`, `Rico`) e desempata por bandeira (`Visa`, `Mastercard`, `Elo`).
    4. **4ª Prioridade (Cartão Preferencial do Estabelecimento)**: se houver `preferredCardId` memorizado para aquele estabelecimento, seleciona esse cartão.
    5. **5ª Prioridade (Fallback Seguro)**: se o usuário tiver exatamente 1 cartão de crédito ativo cadastrado, seleciona-o como sugestão padrão.
  - [x] Atualizar e expandir testes unitários em `src/domain/notifications/card-resolution.test.ts`.

- [x] **Tarefa 3.3: Sincronização e Persistência do Aprendizado (`src/services/merchant-learning.ts`)**
  - [x] Armazenar o `cardDigitsMapping` no `localStorage` isolado por usuário (`card_digits_memory_${userId}`).
  - [x] Sincronizar na nuvem no Supabase via `user_preferences.custom_settings.cardDigitsMapping`.
  - [x] Criar hook reativo `useCardDigitsMapping()` e função `recordCardDigitFeedback(digits: string, cardId: string)`.
  - [x] Implementar helper unificado de feedback:
    `recordTransactionLearning(params: { merchant: string; categoryId: string; paymentMethod: PaymentMethod; cardId?: string; cardLastDigits?: string; taxId?: string })`.
  - [x] Testes unitários em `src/services/merchant-learning.test.tsx`.

> [!TIP]
> **Quality Gate 3 (QG3) — Critérios de Aprovação**:
> - Teste provando que a seleção de um cartão com final `4821` pelo usuário na primeira compra ensina o sistema a selecionar automaticamente esse mesmo cartão em novas capturas contendo `**** 4821`.
> - Teste provando que um estabelecimento habitual sem dígitos de cartão herda o `preferredCardId` memorizado.
> - `npm run typecheck` e `npm run lint` sem erros.

---

### FASE 4: Integração de UI no Dialog, Wizard e Share Target
> **Status:** 100% Concluída · Quality Gate 4 Aprovado (2026-10-29)

- [x] **Tarefa 4.1: Modernização do `AttachReceiptDialog` (`src/components/modules/attach-receipt-dialog.tsx`)**
  - [x] Integrar `extractReceiptTextFromFile` com `parseUniversalReceipt`.
  - [x] Integrar resolução de identidade do estabelecimento em 3 camadas via `resolveMerchantIdentity`.
  - [x] Resolver o cartão cadastrado ativo via `resolveBestMatchingCard` utilizando os cartões do usuário e o `cardDigitsMapping`.
  - [x] Adicionar indicador visual de feedback rico informando o tipo de comprovante identificado (ex.: *"Comprovante de Cartão de Crédito (3x)"*, *"Comprovante Pix"*, *"Boleto Bancário"*).
  - [x] Atualizar testes de componente em `src/components/modules/attach-receipt-dialog.test.tsx`.

- [x] **Tarefa 4.2: Integração e Auto-Preenchimento no `LaunchWizard` (`src/features/transactions/wizard/launch-wizard.tsx`)**
  - [x] No handler `handleReceiptParsed(parsed: UniversalReceiptData)`:
    - Preencher: `type: parsed.nature`, `valueCents: parsed.amountCents`, `description: parsed.description`, `date: parsed.date`, `paymentMethod: parsed.paymentMethod`.
    - Se houver parcelamento (`parsed.installments?.count > 1`), definir `state.installments = parsed.installments.count`.
    - Resolver o cartão cadastrado com precisão através de `resolveBestMatchingCard` passando `cardLastDigits`, `bankName`, `issuerBank` e `cardBrand`.
    - Resolver a categoria via `resolveMerchantIdentity` e `matchCategoryBySlug`.
    - Se for despesa no crédito parcelada, aplicar o `closing_day` do cartão selecionado no cálculo de competências.
  - [x] No `handleSubmit` do `LaunchWizard`:
    - Disparar `recordTransactionLearning` ao salvar a transação, persistindo o aprendizado de estabelecimento, categoria, método de pagamento, cartão e dígitos.
  - [x] Atualizar testes em `src/features/transactions/wizard/launch-wizard.test.tsx`.

- [x] **Tarefa 4.3: Blindagem do Auto-Cadastro e Share Target (`src/services/native/auto-register-banner.ts` e `share-target-page.tsx`)**
  - [x] No `autoRegisterReceipt` (`auto-register-banner.ts`):
    - Eliminar hardcodes de `cardId: null` e `paymentMethod: "pix"`.
    - Atribuir o `paymentMethod` real e o `cardId` resolvido.
    - Se for despesa parcelada no cartão, aplicar o `closing_day` do cartão correspondente no `buildExpenseInstallments`.
    - Se for renda parcelada, acionar `buildIncomeInstallments`.
    - Personalizar mensagens de Toasts e Banner de acordo com o tipo real de operação (ex.: *"Cartão de Crédito de R$ 150,00 (3x) para Padaria Estrela cadastrado!"*).

> [!TIP]
> **Quality Gate 4 (QG4) — Critérios de Aprovação**:
> - Teste de interação de ponta a ponta no `LaunchWizard` recebendo comprovante de cartão parcelado e pré-preenchendo todos os 3 steps.
> - Teste de auto-cadastro com comprovante de cartão parcelado gerando parcelas vinculadas ao cartão cadastrado.
> - `npm run typecheck` e `npm run lint` sem erros.

---

### FASE 5: Matriz de Testes E2E, Typecheck e Governança
> **Status:** 100% Concluída · Quality Gate Final (QG Final) Aprovado (2026-10-29)

- [x] **Tarefa 5.1: Matriz de Testes E2E de Comprovantes Reais (`src/domain/notifications/receipt-e2e-matrix.test.ts`)**
  - [x] Criar suíte completa testando amostras reais de:
    - [x] Pix enviado Nubank e Itaú.
    - [x] Pix recebido Inter e Mercado Pago.
    - [x] Pix agendado Bradesco.
    - [x] Slip Cielo Crédito 3x com final 4821 e adquirente.
    - [x] Slip Stone Mastercard Débito à vista.
    - [x] Slip PagBank Elo Crédito 10x.
    - [x] Comprovante de Pagamento de Boleto Santander / Concessionária.
    - [x] Cupom Fiscal Eletrônico NFC-e com pagamento em Cartão de Crédito.
    - [x] Transferência TED Banco do Brasil para Caixa.

- [x] **Tarefa 5.2: Validação de Qualidade Integral do Repositório**
  - [x] Checagem estrita de tipos: `npm run typecheck`.
  - [x] Linter com regra anti-emojis: `npm run lint`.
  - [x] Toda a suíte de testes: `npm run test:run`.

- [x] **Tarefa 5.3: Revisão do que Já Foi Feito e Verificação Completa de Integridade do App**
  - [x] Revisão aprofundada de todas as funcionalidades recuperadas (Fases 1 a 5) comparando com a especificação original.
  - [x] Verificação ponta a ponta dos fluxos de comprovante:
    - [x] `AttachReceiptDialog` (captura, preview, inferência de dados e vinculação de cartões/categorias).
    - [x] `LaunchWizard` (auto-preenchimento dos steps, suporte a despesas e rendas parceladas).
    - [x] Auto-registro em background e banner PWA (`auto-registered-banner.tsx` e `share-target-page.tsx`).
    - [x] Memória de dígitos e aprendizado contínuo (`cardDigitsMapping` local e Supabase).
  - [x] Auditoria de integridade do app:
    - [x] Build de produção (`npm run build`).
    - [x] Validação estrita de ausência de regressões no ecossistema completo do app.

- [x] **Tarefa 5.4: Documentação Técnica de Arquitetura (`docs/ARCHITECTURE.md`)**
  - [x] Sincronizar a Seção 14 de `docs/ARCHITECTURE.md` registrando a conclusão das fases.

> [!TIP]
> **Quality Gate Final (QG Final) — APROVADO**:
> - 100% dos testes unitários e de integração passando.
> - Zero violações de linting (sem emojis e sem `@ts-ignore`).
> - Zero erros de tipagem estrita no TypeScript.
> - Documentação de arquitetura sincronizada e atualizada.

---

## 4. DEFINITION OF DONE (DoD)

A funcionalidade será considerada concluída e pronta para produção apenas quando satisfizer cumulativamente:

1. **Zero Regressões**: Toda a base de testes pré-existente continua verde.
2. **Nativo + Web Cobertos**: Extração de comprovantes opera tanto no app Android instalado quanto em navegadores desktop e móveis (PWA).
3. **Multi-Comprovante Homologado**: Pelo menos 5 tipos de comprovantes distintos (Pix, Maquininha, Boleto, Cupom Fiscal, TED) parseados com sucesso.
4. **Precisão de Centavos em Parcelas**: Parcelamento com resíduo alocado estritamente na primeira parcela e competências alinhadas ao `closing_day` do cartão.
5. **Memória de Cartão Funcional**: Associação determinística entre os últimos 4 dígitos do cartão e o cartão cadastrado persistida no cliente e na nuvem.
6. **Conformidade com o Design System**: Zero emojis na interface, uso exclusivo de ícones `lucide-react`, responsividade mobile-first e padrões de cores semânticas.
