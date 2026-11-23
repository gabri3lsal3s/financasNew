# Plano Mestre de Arquitetura, Execução e Auditoria — Motor Determinístico de Pix, Pipeline Resiliente de Comprovantes/Extratos & Micro-IA Híbrida (FinOps)

> **Documento Vivo de Governança e Execução (`Fluxo Completo — Feature / Plano`, `AGENTS.md`)**
> - **Status Geral:** `CONCLUÍDO — AGUARDANDO VALIDAÇÃO FINAL (PORTÃO E)`
> - **Fase Ativa:** `Fase E Concluída (Portão E)`
> - **Data de Criação:** `2026-11-23`
> - **Última Atualização:** `2026-11-23`
> - **Ordem de Execução:** `Fase A` → `[Portão A]` → `Fase B` → `[Portão B]` → `Fase C` → `[Portão C]` → `Fase D` → `[Portão D]` → `Fase E` → `[Portão E]`

---

## 0. PROTOCOLO OPERACIONAL DO AGENTE (MANUTENÇÃO OBRIGATÓRIA DESTE PLANO)

Todo agente de IA (ou humano) que executar qualquer fase deste plano **DEVE** seguir estritamente este protocolo:

1. **Leitura Prévia Obrigatória:** Antes de editar qualquer arquivo de código, releia a seção da fase ativa e os **Contratos entre Fases (§2)** neste documento.
2. **Atualização Honesta de Checklists:** Só marque um item `- [x]` após implementá-lo e validá-lo com testes. Nunca marque antecipadamente.
3. **Execução do Quality Gate da Fase:** Ao concluir o código de uma fase, execute `npm run verify` (`typecheck` + `lint` + `vitest run src/domain/`), os testes específicos da fase e `npm run build` (quando aplicável), e **preencha a linha correspondente no Diário de Execução (§5)** com as evidências reais.
4. **Gate Obrigatório de Aprovação (STOP):** Ao concluir uma fase e atualizar este arquivo `.md`, **PARE imediatamente** e aguarde o comando explícito de **Go / No-Go** do usuário antes de iniciar a fase seguinte.

---

## 1. RESUMO FORENSE & MAPA DE ARQUIVOS REAIS (MEMÓRIA PERSISTENTE)

### 1.1 Causas Raiz Diagnosticadas no Código Real

| # | Subsistema | Bug / Fragilidade Real Encontrada | Localização Exata no Código |
|---|---|---|---|
| **1** | **Pix EMVCo (Falso Negativo)** | Exigência `candidate.valueCents <= 0` descarta códigos Pix Copia e Cola estáticos/dinâmicos válidos sem Tag `54`. | `src/hooks/use-pix-clipboard-detector.ts` (L60), `src/features/transactions/wizard/use-receipt-autofill.ts` (L162, L171) |
| **2** | **Pix EMVCo (Quebras & CRC)** | `parsePixEMVPayload` não remove `\r\n` internos (corrompendo o offset TLV), não valida o GUI `br.gov.bcb.pix` na Tag `26..51` e não valida o checksum matemático **CRC16-CCITT (Tag `6304`)**. | `src/domain/notifications/pix-emv-parser.ts` (L65–L93) |
| **3** | **Pix Clipboard (Falso Positivo)** | `detectPixKey` captura qualquer e-mail/telefone/11 ou 14 dígitos sem Módulo 11; `parsePixFreeText` combina chave perdida + decimal en-US sem cifrão (`45.00`); fallback `parseGenericReceipt` no clipboard captura textos comuns com números. | `src/domain/notifications/pix-text-parser.ts` (L32–L169, L313), `src/domain/notifications/pix-clipboard.ts` (L82) |
| **4** | **Clipboard Multiplataforma** | `dismissedTextsRef` é volátil (`useRef`), causando re-disparo infinito; `window.focus` no Android dispara spam de toast nativo *"colou da área de transferência"*; `AttachReceiptDialog` chama `navigator.clipboard.readText()` direto (ignora Capacitor). | `src/hooks/use-pix-clipboard-detector.ts` (L32, L97), `src/components/modules/attach-receipt-dialog.tsx` (L99–L100) |
| **5** | **Parse Monetário (`45,00` → `45000`)** | (a) `fixFracturedMonetaryAmounts` funde números adjacentes (`"Item 1 45,00"` → `"145,00"`); (b) `parseBRLToCents` remove cegamente `.` de `"R$ 45.00"` (virando `450000` centavos); (c) valores de PDV com 3 decimais (`45,000`) sem `R$` colado são lidos como milhar. | `src/domain/notifications/ocr-cleaner.ts` (L203), `src/domain/money/parse.ts` (L15), `src/domain/notifications/bank-parser.ts` (L104) |
| **6** | **Seleção de Valor (Múltiplos Números)** | `parsePixReceipt`, `parseBankSlipReceipt` e `parseWireTransferReceipt` chamam `extractCentsFromText(rawText)`, que retorna o **primeiro** número com `R$` do topo (capturando saldo em conta, tarifa ou valor nominal em vez de `Valor Pago / Líquido`). | `src/domain/notifications/pix-receipt-parser.ts` (L167), `bank-slip-parser.ts` (L226), `wire-transfer-parser.ts` (L115) |
| **7** | **Beneficiário / Contraparte** | Regexes de `pix-receipt-parser.ts` exigem `"Nome:"` ou `":"` na mesma linha, falhando em layouts modernos (Nubank/Inter/PicPay/BTG: `Destino\nFULANO`) e caindo em `extractMerchantOrRecipient` (`prepRegex`), que captura nomes de banco ou frases genéricas. | `src/domain/notifications/pix-receipt-parser.ts` (L197–L225), `src/domain/notifications/bank-parser.ts` (L1484) |
| **8** | **Direção Receita vs. Despesa** | `detectPixTransactionNature` inclui rótulos neutros (`para:`, `destinatário:`, `dados do recebedor`) na `expenseRegex`, forçando Pix Recebido a virar despesa; `parseWireTransferReceipt` e `parseGenericReceipt` têm `nature: "expense"` hardcoded; nenhum parser cruza o titular logado (`profiles.name`). | `src/domain/notifications/bank-parser.ts` (L1740–L1760), `wire-transfer-parser.ts` (L146), `universal-receipt-parser.ts` (L160) |
| **9** | **Dark Mode OCR & PDF** | (a) `preprocessImageForOcr` aplica binarização global de Otsu em prints digitais e Dark Mode, destruindo anti-aliasing; (b) Android converte PDF digital em Bitmap para rodar ML Kit OCR em vez de extrair texto via `unpdf` primeiro; (c) Web falha com `empty_text` em PDF escaneado sem renderizar página; (d) `sha256` é calculado após `<canvas>` e nunca usado em cache. | `src/services/native/web-ocr.ts` (L130–L165), `src/services/native/receipt-extractor.ts` (L78–L133), `src/services/receipt-resolution.ts` (L444–L449) |

### 1.2 Mapa de Arquivos Reais Envolvidos

* **Domínio Puro (`src/domain/`):**
  * `src/domain/money/parse.ts` — parser monetário canônico (`parseBrazilianCurrencyToCents`)
  * `src/domain/validation/cpf.ts`, `src/domain/validation/cnpj.ts` (novo), `src/domain/validation/index.ts`
  * `src/domain/notifications/ocr-cleaner.ts`
  * `src/domain/notifications/pix-emv-parser.ts`
  * `src/domain/notifications/pix-text-parser.ts`
  * `src/domain/notifications/pix-clipboard.ts`
  * `src/domain/notifications/receipt-types.ts`
  * `src/domain/notifications/bank-parser.ts`
  * `src/domain/notifications/pix-receipt-parser.ts`
  * `src/domain/notifications/bank-slip-parser.ts`
  * `src/domain/notifications/wire-transfer-parser.ts`
  * `src/domain/notifications/universal-receipt-parser.ts`
  * `src/domain/notifications/receipt-amount-scorer.ts` (novo — scorer soberano único DRY)
  * `src/domain/notifications/document-multiplicity.ts` (novo — detector comprovante único vs. extrato multi-lançamento)
* **Serviços & Adaptadores (`src/services/`):**
  * `src/services/clipboard.ts`
  * `src/services/pix-clipboard-store.ts` (novo — store singleton com hash FNV-1a síncrono e TTL 24h)
  * `src/services/native/web-ocr.ts`
  * `src/services/native/receipt-extractor.ts`
  * `src/services/receipt-resolution.ts`
  * `src/services/ai-assistant.ts` (novo na Fase D — cliente HTTP fino com timeout 5,5s, kill-switch e mascaramento LGPD)
* **Hooks, UI & Telas (`src/hooks/`, `src/components/`, `src/features/`):**
  * `src/hooks/use-pix-clipboard-detector.ts`
  * `src/components/modules/dashboard-pix-clipboard-card.tsx`
  * `src/components/modules/attach-receipt-dialog.tsx`
  * `src/features/transactions/wizard/launch-wizard.tsx`
  * `src/features/transactions/wizard/launch-wizard-header.tsx`
  * `src/features/transactions/wizard/use-receipt-autofill.ts`
  * `src/features/transactions/wizard/wizard-mappers.ts`
  * `src/features/transactions/wizard/step-quick.tsx`
  * `src/features/transactions/pages/share-target-page.tsx`
  * `src/features/cards/components/statement-import-helpers.ts`
  * `src/features/cards/components/use-statement-import.ts`
* **Backend Supabase (`supabase/` — Fases D e E):**
  * `supabase/migrations/20260101000145_ai_extraction_quotas_and_cache.sql` (novo na Fase D — sequencial após `000144_default_family_mode_enabled_for_new_users.sql` já existente)
  * `supabase/functions/ai-financial-assistant/index.ts` (novo na Fase D, expandido na Fase E)
  * `supabase/functions/_shared/ai-schemas.ts` (novo na Fase D — schemas Zod + hard caps + validação whitelist)

---

## 2. INVARIANTES INEGOCIÁVEIS, GOVERNANÇA & CONTRATOS ENTRE FASES

### 2.1 Invariantes de Governança (`AGENTS.md` + 5 Travas Finais)

1. **Blindagem Matemática Absoluta (`FINANCIAL_MATH_SPEC.md`):** A IA **nunca** calcula saldos, totais de fatura, juros, rentabilidade, preço médio ou rebalanceamento. Seu papel é estritamente a **interpretação de entrada não estruturada** (extração/classificação), sempre sujeita à pós-validação determinística local (`zod` + centavos inteiros).
2. **Zero `autoFocus` em Modais (`AGENTS.md` §4 Regra 20):** Ao abrir o `LaunchWizard` (com ou sem valor), é **estritamente proibido** focar o `MoneyInput` programaticamente ou abrir o teclado virtual. Para destaque visual sutil de campo vazio ou de confiança baixa, usar exclusivamente classes reais já presentes no Design System (`ring-2 ring-primary/30 border-primary/60` ou `border-warning/60 ring-1 ring-warning/25`, usando tokens de `src/styles/globals.css`). **Proibido inventar classes CSS inexistentes** (ex.: `animate-pulse-once` não existe no Tailwind/globals).
3. **Detector Passivo Estrito na Home:** A leitura automática de clipboard na Home (`OverviewPage`) dispara **exclusivamente** para `PIX_BRCODE` (EMVCo com `br.gov.bcb.pix` e CRC16-CCITT válidos, com ou sem Tag `54`). `PIX_KEY` e `PIX_RECEIPT` só entram sob ação explícita do usuário (botão `"Colar Pix"` ou `Ctrl+V` no modal).
4. **Trava 1 — Hash FNV-1a Síncrono no Clipboard Store:** O cache de hashes dispensados/lançados (`dismissed_clipboard_hashes` no `user-storage`, máx. 30 itens, TTL 24h) usa **FNV-1a 32-bit síncrono** (`fnv1aHash(normalizedText)`), eliminando `async/await` desnecessário em operações síncronas de UI (`dismissDetectedPix`). Nunca salvar texto bruto do clipboard no `localStorage`.
5. **Trava 2 — `ShareTargetPage` Seguro:** Auto-cadastro imediato via `autoRegisterReceipt` com banner `"Desfazer (5s)"` ocorre **somente** quando `confidence === "high"` **E** `isSameTitularity !== true`. Em qualquer outro caso (`medium`, `low` ou `isSameTitularity === true`), redireciona para revisão rápida no `LaunchWizard` (`buildReviewRoute(parsed)`).
6. **Trava 3 — Hard Cap de Payload na Edge Function (Fase D):** Antes de acionar o Gemini, a Edge Function valida/trunca estritamente:
   * Imagem comprimida (base64 decodificada): `<= 500 KB` (alvo cliente: lado maior `1024px`, JPEG/WebP `0.72` ≈ 65–110 KB);
   * Texto de comprovante único: `<= 8.000` caracteres;
   * Texto de fatura PDF (`statement_pdf_rows`): `<= 25.000` caracteres;
   * Lote de categorização (`categorize_batch`): máximo `40` descrições por chamada (cada descrição `<= 120` chars).
7. **Trava 4 — Cota Atômica, Anti-Flood & Débito Pós-Validação (Fase D):**
   * Pré-checagem de cota + deduplicação de requisições concorrentes por `sha256` (`inFlightBySha256`) **diretamente no cliente** (`src/services/ai-assistant.ts`), sem depender de estado em memória entre isolates stateless da Edge Function;
   * Consulta ao cache `(user_id, sha256)` **antes** de qualquer checagem ou consumo de cota (Cache Hit = 0 créditos);
   * Incremento atômico via RPC Postgres (`increment_user_ai_quota_atomic` usando `INSERT ... ON CONFLICT (user_id, period_month) DO UPDATE`) executado **somente após** `zod.safeParse()` confirmar resposta válida (`ok: true`). Erros HTTP 429/500, timeouts ou JSON malformado **nunca debitam cota**.
8. **Trava 5 — Privacidade LGPD & Whitelist Estrita (`categorize_batch` — Fase E):**
   * Em texto enviado à IA: mascarar CPFs completos (`000.000.000-00` / 11 dígitos válidos) e números de conta/agência antes de sair do cliente;
   * No banco Supabase (`receipt_extractions_cache`): armazenar apenas `(user_id, sha256, mode, extracted_json, created_at)` — **jamais persistir imagem nem texto bruto**;
   * No modo `categorize_batch`: enviar apenas descrições higienizadas (`cleanDescription`) + lista `{ id, name }` de categorias do usuário (nunca valores monetários, datas ou dados de cartão). Validar via Zod que **todo `categoryId` retornado pertence estritamente ao `Set` de IDs enviados**.
9. **Zero Regressão & Isolamento de Bundle:**
   * Todos os 18 casos reais de `src/domain/notifications/comprovantes-real-matrix.test.ts` + toda a suíte `src/domain/` permanecem 100% verdes;
   * **Zero SDK de IA no frontend** (`fetch` nativo para a Edge Function); `unpdf` e `tesseract.js` mantidos 100% sob `import()` dinâmico para preservar o limite de precache do Workbox PWA (`3 MiB`).
   * Zero emojis / caracteres Unicode decorativos (`local/no-decorative-unicode`); zero controles nativos (`AGENTS.md` §4 Regra 7).

---

### 2.2 Contratos de Tipos Compartilhados Entre Fases (Anti-Retrabalho)

Os contratos abaixo nascem nas **Fases A e B** e são consumidos sem quebra pelas **Fases C, D e E**:

```ts
// 1. Contrato do Detector de Clipboard (Fase A -> consumido na Fase C)
export type ClipboardPixKind = "PIX_BRCODE" | "PIX_KEY" | "PIX_RECEIPT" | "NONE";

export interface ClipboardParsedCandidate {
  kind: ClipboardPixKind;
  valueCents: number; // >= 0 (0 é VÁLIDO para PIX_BRCODE sem Tag 54 e para PIX_KEY)
  description: string;
  merchant?: string;
  recipientName?: string;
  pixKey?: string;
  pixKeyType?: PixKeyType;
  txId?: string;
  city?: string;
  taxId?: string;
  nature: "expense" | "income";
  paymentMethod: "pix" | "credit_card" | "debit_card" | "boleto" | "other";
  confidence: "high" | "medium" | "low";
  date?: string;
  rawText?: string;
}

// 2. Contexto do Titular Logado (Fase B -> consumido nas Fases C e D)
// Nota: `profiles` no Supabase expõe `name` e `email` (ver src/data/repositories/access.ts).
// `userCpf` é opcional (para eventual expansão futura sem quebrar o contrato).
export interface ReceiptUserContext {
  userFullName?: string | null;
  userCpf?: string | null;
}

// 3. Extensão Retrocompatível de UniversalReceiptData (Fase B -> consumida nas Fases C e D)
export type ConfidenceLevel = "high" | "medium" | "low";

export interface ReceiptFieldConfidence {
  amount: ConfidenceLevel;
  counterparty: ConfidenceLevel;
  nature: ConfidenceLevel;
  date: ConfidenceLevel;
}

// Campos opcionais adicionados a UniversalReceiptData e ParsedBankTransaction:
// confidence?: ConfidenceLevel;
// confidenceScore?: number; // 0.0 a 1.0 (limiar de disparo da Micro-IA: < 0.85)
// fieldConfidence?: ReceiptFieldConfidence;
// isSameTitularity?: boolean;
// extractionSource?: "local_deterministic" | "cache_local" | "cache_remote" | "ai_text" | "ai_vision";

// 4. Assinatura Retrocompatível de parseUniversalReceipt (Fase B)
export function parseUniversalReceipt(
  rawText: string,
  isManualUpload?: boolean,
  userContext?: ReceiptUserContext,
): UniversalReceiptData | null;

// 5. Classificador de Multiplicidade de Documento (Fase B -> consumido nas Fases C e E)
export type DocumentMultiplicity = "single_receipt" | "multi_statement" | "unknown";

// 6. Status Expandido de ScanReceiptFileResult (Fase B -> consumido nas Fases C e D)
export type ReceiptScanStatus =
  | "success"
  | "multi_statement"
  | "file_too_large"
  | "unsupported_format"
  | "empty_text"
  | "unrecognized"
  | "error";
```

---

### 2.3 Contrato de Resiliência & Modelo FinOps de Cotas (Fases D e E)

| Estado de Exceção | Comportamento Técnico (Backend + Cliente) | Experiência de UI |
|---|---|---|
| **1. Cota IA Esgotada (Dia/Mês)** | Edge Function retorna `HTTP 200` com `{ ok: false, reason: "quota_exceeded", fallbackToLocal: true, quotaResetAt }`. Cliente entrega resultado determinístico local sem bloquear. Cache Hit por `sha256` nunca consome cota. | Invisível se o parser local resolveu. Se foto ilegível no local, aviso calmo informando a data de renovação da cota e sugerindo preenchimento manual ou PDF digital. |
| **2. Usuário `read_only` (Trial Expirado)** | Cliente bloqueia via `useMutationGuard({ moduleKey: "transactions" })`. Edge Function valida JWT + `user_subscriptions` / `profiles.status` (Fail-Closed → `403 Forbidden`). | Abre `UpgradeDialog` padrão antes de qualquer upload/chamada. |
| **3. Offline ou Rede Lenta (Timeout)** | Se `!navigator.onLine`, pula IA em `0 ms`. Online: `AbortController` de **5,5s** no cliente e timeout de **4,5s** no `fetch` da Edge Function para o Gemini. | Entrega fallback determinístico local sem erro fatal e sem travar spinner. |
| **4. Falha Externa (429 / 500 / JSON Inválido)** | `try/catch` + `zod.safeParse()`. Não debita cota. Retorna `{ ok: false, reason: "upstream_unavailable", fallbackToLocal: true }`. | Transparente: cliente usa o resultado determinístico local já pronto. |
| **5. Kill-Switch (`AI_EXTRACTION_ENABLED=false`)** | Duplo desligamento: feature flag `ai_extraction` / env var `AI_EXTRACTION_ENABLED` na Edge Function. Retorna `fallbackToLocal: true` imediatamente. | App opera 100% no Cenário 1 (Determinístico Local) sem quebrar nenhuma tela. |

#### Contabilidade de Cotas em 2 Baldes Independentes (Reset 00:00 BRT `America/Sao_Paulo`)

| Balde | Operações Cobertas | Trial (30d) | Plano Pro (Mensal/Anual) | Custo Máximo no Teto Pro (`gemini-2.5-flash-lite`) |
|---|---|---|---|---|
| **Balde 1: `receipt_calls`** | Comprovante unitário (apenas quando `confidenceScore < 0.85`) | 15 / mês (máx. 5/dia) | 100 / mês (máx. 15/dia) | ~R\$ 0,016 / mês |
| **Balde 2: `batch_calls`** | Fatura PDF desalinhada (`statement_pdf_rows`) ou Auto-Categorização em lote (`categorize_batch`, até 40 itens) | 5 / mês (máx. 2/dia) | 20 / mês (máx. 5/dia) | ~R\$ 0,024 / mês |
| **Total Máximo (Worst-Case)** | 100% dos dois baldes estourados no mesmo mês | — | — | **~R$ 0,04 / mês** (média real esperada: **~R$ 0,004 / usuário/mês**) |

---

### 2.4 Matriz de Paridade Multiplataforma (Desktop, PWA e Mobile Android)

| Capacidade | Web Desktop | PWA Instalado | App Mobile (Android Capacitor) |
|---|---|---|---|
| **Leitura Passiva de Pix na Home (`PIX_BRCODE`)** | Chrome/Edge se `clipboard-read === "granted"`. Silencioso no Safari/Firefox. | Idem ao browser hospedeiro + dedup FNV-1a 24h. | Exclusivamente via `App.addListener("appStateChange")` (`isActive: true`) + cooldown 10s + dedup FNV-1a 24h (elimina spam de toast Android 12+). |
| **Botão "Colar Pix" + `Ctrl+V` no Modal** | Sempre visível no Wizard + `onPaste` (funciona em 100% dos browsers incl. Safari/Firefox). | Sempre visível + área de colagem rápida no iOS. | Usa `readClipboardText()` via `@capacitor/clipboard` sob toque explícito. |
| **Colar Print de Tela (`Ctrl+V` Imagem)** | Suportado via `onPaste` (`clipboardData.files`) no `AttachReceiptDialog` e `LaunchWizard`. | Suportado em Desktop PWA / tablets. | Anexo via galeria/câmera ou colagem de imagem. |
| **PDF Digital (Camada de Texto)** | `unpdf` (`extractText`) em `< 30 ms`. | `unpdf` em `< 30 ms`. | **Unificado:** `unpdf` primeiro no JS (`< 30 ms`), evitando OCR desnecessário em PDF digital! |
| **PDF Escaneado (`unpdf < 40 chars`)** | `unpdf` (`extractImages` / `getDocumentProxy` → `<canvas>`) → OCR/Visão. | Mesmo pipeline `<canvas>`. | Fallback automático para `ReceiptOcrHelper.java` (`PdfRenderer` + ML Kit offline). |
| **Print Dark Mode & Foto Térmica** | Inversão suave de Dark Mode sem Otsu destrutivo para prints + Tesseract / Fallback IA. | Mesmo pipeline + câmera nativa (`capture="environment"`). | Google ML Kit offline (`< 200 ms`, correção EXIF) + Fallback IA (texto limpo ou JPEG 1024px). |
| **Share Target Nativo** | N/A | Web Share Target (`/share-target`). | `MainActivity.java` (`Intent.ACTION_SEND`) com Trava 2 (`high` + `!isSameTitularity` → auto-cadastro; senão revisão no Wizard). |

---

## 3. PLANO DETALHADO POR MICRO-FASE (CHECKLISTS EXECUTÁVEIS)

### FASE A — Core Determinístico Puro: Moeda, EMVCo + CRC16, Chaves Pix & Golden Dataset

* **Objetivo:** Blindar 100% da matemática de parsing monetário e do motor de detecção de Pix em funções puras (`src/domain/`), zerando falsos negativos (Pix sem Tag `54` / quebras de linha) e falsos positivos (textos comuns / números soltos / `45,00` → `45000`).
* **Fora de Escopo nesta Fase:** UI, hooks React, OCR, PDF, Supabase e IA.
* **Arquivos Alvo:**
  * `src/domain/money/parse.ts` + `src/domain/money/parse.test.ts`
  * `src/domain/validation/cnpj.ts` (novo) + `src/domain/validation/cnpj.test.ts` + `src/domain/validation/index.ts`
  * `src/domain/notifications/ocr-cleaner.ts` + `src/domain/notifications/ocr-cleaner.test.ts`
  * `src/domain/notifications/pix-emv-parser.ts` + `src/domain/notifications/pix-emv-parser.test.ts`
  * `src/domain/notifications/pix-text-parser.ts` + `src/domain/notifications/pix-text-parser.test.ts`
  * `src/domain/notifications/pix-clipboard.ts` + `src/domain/notifications/pix-clipboard.test.ts`

#### Checklist Técnico — Fase A
- [x] **A.1** Implementar `parseBrazilianCurrencyToCents(input: string, options?: { allowNegative?: boolean }): number | null` em `src/domain/money/parse.ts` usando aritmética inteira pura (`whole * 100 + frac`), cobrindo: `R$ 45,00`, `45,00`, `1.450,00`, `0,50`, `R$ 45.00`, `45.00`, `1,450.00`, `R$ 45 , 00`, `R$ 1.200`, 3 decimais de PDV (`45,000` → `4500`) e tratamento explícito de sinal negativo (`-R$ 45,00`, `R$ -45,00`, `(45,00)`, `45,00-` quando `allowNegative: true`, rejeitando quando `false`). Corrigir `parseBRLToCents` para delegar/respeitar ponto decimal de 2 dígitos (`45.00` jamais vira `450000`).
- [x] **A.2** Implementar `cleanCNPJ`, `formatCNPJ` e `isValidCNPJ` (Módulo 11 oficial da Receita Federal) em `src/domain/validation/cnpj.ts` e exportar no barrel `src/domain/validation/index.ts`.
- [x] **A.3** Corrigir `fixFracturedMonetaryAmounts` em `src/domain/notifications/ocr-cleaner.ts` (L203): remover a fusão cega `/(?<=\b\d{1,4})\s+(?=\d+,\d{2}\b)/g` para que `"Item 1 45,00"`, `"Qtd 2 45,00"` e `"2026 45,00"` nunca fundam o número anterior ao valor monetário.
- [x] **A.4** Refatorar `src/domain/notifications/pix-emv-parser.ts`:
  - Implementar `computeEMVCRC16(payload: string): string` e `validateEMVCRC16(payload: string): boolean` (polinômio `0x1021`, init `0xFFFF`, validando Tag `6304` **sobre bytes UTF-8 via `new TextEncoder().encode(...)`**, reutilizando `calculatePixCrc16` de `@/domain/pix`, e percorrendo comprimentos TLV também em bytes UTF-8 para não reprovar códigos com acentos nas Tags 59/60);
  - Sanitizar `\r\n` internos injetados por apps de mensagem antes do parse TLV;
  - Procurar GUI `br.gov.bcb.pix` (case-insensitive) nas tags `26`..`51`, extraindo subtags `01` (chave), `02` (descrição) e `25` (URL dinâmica);
  - Suportar integralmente códigos válidos com ou sem Tag `54` (`amountCents >= 0`), retornando `city` (Tag `60`) e `txId` (Tag `62.05`).
- [x] **A.5** Refatorar `src/domain/notifications/pix-text-parser.ts` e `src/domain/notifications/pix-clipboard.ts`:
  - Adotar tipos discriminados `PIX_BRCODE | PIX_KEY | PIX_RECEIPT | NONE` (mantendo mapeamento/compatibilidade limpa);
  - Validar estritamente chaves isoladas (`PIX_KEY`): CPF via `isValidCPF`, CNPJ via `isValidCNPJ`, EVP via UUID v4 estrito, E-mail na string inteira (ou rótulo curto `<= 80 chars`), Telefone com DDD Anatel válido + `9` + 8 dígitos;
  - Garantir `valueCents === 0` para toda `PIX_KEY` isolada;
  - Remover captura de decimais en-US sem cifrão (`45.00`) em textos soltos e remover fallback `parseGenericReceipt` no clipboard (aceitar `PIX_RECEIPT` apenas com marcadores formais inequívocos de comprovante bancário).
- [x] **A.6** Criar e rodar o **Golden Dataset da Fase A** (Vitest) cobrindo: EMVCo estático com valor, estático sem valor, dinâmico com URL, EMVCo com `\r\n`, EMVCo com CRC adulterado; falsos positivos (WhatsApp com telefone + R$, e-mail comercial, rastreio 11/14 dígitos, URL com `v2.50`); chaves válidas vs. inválidas; e todos os casos extremos de `parseBrazilianCurrencyToCents`.

#### Quality Gate — Fase A
- [x] `npm run typecheck` — 0 erros
- [x] `npm run lint` — 0 erros (0 erros/0 warnings em `src/`; 9 warnings pré-existentes de `react-refresh/only-export-components` em `scripts/sample-reports-entry.tsx`)
- [x] `npx vitest run src/domain/money/ src/domain/validation/ src/domain/notifications/` — 100% verde (36/36 arquivos, 626/626 testes, incluindo 18/18 de `comprovantes-real-matrix.test.ts` e 85/85 de `bank-e2e-matrix.test.ts`)

---

### FASE B — Motor Determinístico de Comprovantes v2, PDF Escaneado, Dark Mode OCR & Cache Local SHA-256

* **Objetivo:** Resolver 100% dos bugs de extração local de comprovantes (valor soberano, beneficiário multilinha, direção Receita vs. Despesa com titular logado, mesma titularidade, multiplicidade de documento, Dark Mode OCR, PDF digital no Android e PDF escaneado na Web) + ativar cache local por `sha256` sobre o arquivo bruto.
* **Fora de Escopo nesta Fase:** Mudanças visuais no `LaunchWizard`/`OverviewPage`, Supabase e Edge Functions de IA.
* **Arquivos Alvo:**
  * `src/domain/notifications/receipt-types.ts`
  * `src/domain/notifications/receipt-amount-scorer.ts` (novo) + `*.test.ts`
  * `src/domain/notifications/document-multiplicity.ts` (novo) + `*.test.ts`
  * `src/domain/notifications/bank-parser.ts`
  * `src/domain/notifications/pix-receipt-parser.ts`
  * `src/domain/notifications/bank-slip-parser.ts`
  * `src/domain/notifications/wire-transfer-parser.ts`
  * `src/domain/notifications/universal-receipt-parser.ts`
  * `src/services/native/web-ocr.ts` + `src/services/native/web-ocr.test.ts`
  * `src/services/native/receipt-extractor.ts` + `src/services/native/receipt-extractor.test.ts`
  * `src/services/receipt-resolution.ts` + `src/services/receipt-resolution.test.ts`

#### Checklist Técnico — Fase B
- [x] **B.1** Estender `UniversalReceiptData` e `ParsedBankTransaction` com os campos retrocompatíveis `confidence`, `confidenceScore`, `fieldConfidence`, `isSameTitularity` e `extractionSource`.
- [x] **B.2** Criar `extractSovereignReceiptAmountCents` em `src/domain/notifications/receipt-amount-scorer.ts` (desqualificando `Saldo`, `Limite`, `Troco`, `Tributos`, `Desconto`, `Tarifa`, `Juros/Multa` e pontuando `Valor Pago / Líquido / Total a Pagar / Valor do Pix` acima de `Valor do Documento / Subtotal`), reutilizando `parseBrazilianCurrencyToCents`, e plugar em `pix-receipt-parser.ts`, `bank-slip-parser.ts`, `wire-transfer-parser.ts` e `universal-receipt-parser.ts`.
- [x] **B.3** Refatorar `pix-receipt-parser.ts` e `wire-transfer-parser.ts` para:
  - Extrair Pagador e Recebedor de blocos multilinha sem `"Nome:"` (Nubank, Inter, PicPay, Mercado Pago, BTG);
  - Filtrar nomes de bancos/instituições e palavras de sistema como falso beneficiário;
  - Permitir `nature: "income"` em TED/transferências recebidas.
- [x] **B.4** Corrigir `detectPixTransactionNature` em `src/domain/notifications/bank-parser.ts` (remover `"para:"`, `"destinatário:"`, `"beneficiário:"`, `"favorecido:"`, `"dados do recebedor"` da `expenseRegex`) e implementar resolução de titularidade por `ReceiptUserContext` (`userFullName` / `userCpf` inclusive mascarado) em `parseUniversalReceipt(rawText, isManualUpload, userContext?)`:
  - Ao cruzar `profiles.name`, exigir match de **pelo menos 2 tokens significativos** quando o perfil tiver nome composto (evitando colisão entre homônimos de primeiro nome);
  - `Recebedor ≈ Usuário` & `Pagador ≠ Usuário` → `nature = "income"`, contraparte = `Pagador`;
  - `Pagador ≈ Usuário` & `Recebedor ≠ Usuário` → `nature = "expense"`, contraparte = `Recebedor`;
  - `Pagador ≈ Usuário` & `Recebedor ≈ Usuário` → `isSameTitularity = true`;
  - Calcular `confidenceScore` (0..1) e `fieldConfidence` por campo.
- [x] **B.5** Implementar `detectDocumentMultiplicity(text)` em `src/domain/notifications/document-multiplicity.ts` diferenciando comprovante único (incluindo cupom fiscal com vários itens) de extrato/fatura multi-lançamento (`>= 3` linhas datadas distintas).
- [x] **B.6** Unificar extração de PDF em `src/services/native/receipt-extractor.ts`:
  - Tentar `unpdf` (`extractText`) primeiro tanto na Web quanto no Android;
  - Se `text.length < 40` (PDF escaneado), na Web extrair imagem via `unpdf` (`extractImages` / `getDocumentProxy` → `<canvas>`) e passar ao OCR; no Android delegar ao `ReceiptOcrHelper.java` (`PdfRenderer` + ML Kit).
- [x] **B.7** Aprimorar `preprocessImageForOcr` em `src/services/native/web-ocr.ts`: detectar prints de tela digitais e Dark Mode (`meanGray < 110`), aplicando inversão suave em escala de cinza sem binarização dura de Otsu em screenshots digitais (preservando Otsu apenas para fotos de cupons térmicos).
- [x] **B.8** Refatorar `resolveAndScanReceiptFile` em `src/services/receipt-resolution.ts`:
  - Calcular `sha256` sobre o **`file` original bruto** antes do `<canvas>`;
  - Implementar cache local por `sha256` (escopado por usuário, TTL 7 dias, sem guardar imagem nem texto bruto — apenas `ResolvedReceiptResult` estruturado);
  - Propagar `userContext` e retornar `status: "multi_statement"` quando aplicável.
- [x] **B.9** Adicionar testes unitários de regressão para múltiplos valores (saldo + desconto + valor pago), blocos Nubank/Inter sem `"Nome:"`, cruzamento de titular (enviado vs. recebido vs. mesma titularidade), Dark Mode canvas e multiplicidade.

#### Quality Gate — Fase B
- [x] `npm run verify` (`typecheck` + `lint` + `vitest run src/domain/`) — 100% verde (0 erros `tsc -b`; 0 erros / 0 warnings em `src/` no `eslint .`, 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`; 227/227 arquivos e 3.220/3.220 testes em `src/domain/`)
- [x] `npx vitest run src/services/receipt-resolution.test.ts src/services/native/` — 100% verde (25/25 arquivos, 255/255 testes)
- [x] Zero regressão nos 18 casos de `comprovantes-real-matrix.test.ts` (18/18) e em `bank-e2e-matrix.test.ts` (85/85)

---

### FASE C — UX Multiplataforma, Orquestrador de Clipboard & Ergonomia no Wizard / ShareTarget

* **Objetivo:** Entregar a experiência confortável, previsível e sem ruído nas 3 plataformas (Web Desktop, PWA e App Mobile Android), respeitando integralmente zero `autoFocus`, Trava 1 (FNV-1a), Trava 2 (`ShareTargetPage` seguro) e `Ctrl+V` de print/texto.
* **Fora de Escopo nesta Fase:** Backend Supabase, migrations e chamada de Micro-IA.
* **Arquivos Alvo:**
  * `src/services/pix-clipboard-store.ts` (novo) + `*.test.ts`
  * `src/hooks/use-pix-clipboard-detector.ts` + `*.test.ts`
  * `src/components/modules/dashboard-pix-clipboard-card.tsx` + `*.test.tsx`
  * `src/components/modules/attach-receipt-dialog.tsx` + `*.test.tsx`
  * `src/features/transactions/wizard/launch-wizard.tsx`
  * `src/features/transactions/wizard/launch-wizard-header.tsx`
  * `src/features/transactions/wizard/use-receipt-autofill.ts`
  * `src/features/transactions/wizard/wizard-mappers.ts`
  * `src/features/transactions/wizard/step-quick.tsx`
  * `src/features/transactions/pages/share-target-page.tsx`

#### Checklist Técnico — Fase C
- [x] **C.1** Criar `src/services/pix-clipboard-store.ts` com hash síncrono **FNV-1a** (Trava 1), persistência de `dismissed_clipboard_hashes` no `user-storage` (máx. 30 itens, TTL 24h) e store singleton (`useSyncExternalStore`).
- [x] **C.2** Refatorar `src/hooks/use-pix-clipboard-detector.ts`:
  - Leitura passiva na Home disparando **exclusivamente** para `kind === "PIX_BRCODE"` (com ou sem Tag `54`);
  - No Android nativo (`isNativePlatform()`), substituir `window.focus` por `App.addListener("appStateChange", ({ isActive }) => ...)` com cooldown mínimo de `10s`;
  - Na Web/PWA, respeitar `canReadClipboardSilently()` sem disparar popups;
  - Registrar hash FNV-1a ao dispensar ou ao lançar.
- [x] **C.3** Atualizar `DashboardPixClipboardCard` para exibir elegantemente tanto `PIX_BRCODE` com valor quanto `PIX_BRCODE` sem valor (`"Valor em aberto · Toque para informar o valor e lançar"`).
- [x] **C.4** Atualizar `LaunchWizard` (`launch-wizard.tsx`, `launch-wizard-header.tsx`, `use-receipt-autofill.ts`, `wizard-types.ts`, `wizard-mappers.ts`, `quick-description-field.tsx`, `step-quick.tsx`, `launch-wizard-modals.tsx`):
  - Passar `userContext = { userFullName: profile?.name ?? user?.user_metadata?.name }` para o pipeline de comprovantes;
  - Deixar botão `"Colar Pix"` sempre acessível no header do Wizard (modo rápido e Passo 1), reconhecendo `PIX_BRCODE`, `PIX_KEY` e `PIX_RECEIPT`;
  - Para `valueCents === 0` (`PIX_BRCODE` sem valor ou `PIX_KEY`), aplicar destaque visual sutil no `MoneyInput` com classes reais do Design System (`ring-2 ring-primary/30 border-primary/60`), **com zero `autoFocus`**;
  - Exibir banner/badges sutis de confiança (`"Conferir"` em campos `medium`/`low` e aviso informativo quando `isSameTitularity === true`);
  - Habilitar `onPaste` (`Ctrl+V` / `Cmd+V` de imagem de print ou texto) no `LaunchWizard` e no `AttachReceiptDialog`.
- [x] **C.5** Corrigir `AttachReceiptDialog`:
  - Trocar `navigator.clipboard.readText()` direto por `readClipboardText()` (`src/services/clipboard.ts`);
  - Tratar `status === "multi_statement"` orientando/direcionando para a importação em lote de fatura/extrato.
- [x] **C.6** Aplicar **Trava 2** em `src/features/transactions/pages/share-target-page.tsx`: auto-cadastrar via `autoRegisterReceipt` apenas quando `confidence === "high"` e `!isSameTitularity`; caso contrário, redirecionar para conferência rápida no `LaunchWizard` (`buildReviewRoute(parsed)`).

#### Quality Gate — Fase C
- [x] `npm run verify` — 100% verde (`tsc -b` 0 erros; `eslint .` 0 erros / 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`; `src/domain/` 227/227 arquivos e 3.220/3.220 testes)
- [x] Testes de componentes (`pix-clipboard-store.test.ts`, `use-pix-clipboard-detector.test.ts`, `dashboard-pix-clipboard-card.test.tsx`, `attach-receipt-dialog.test.tsx`, `launch-wizard.test.tsx`, `share-target-page.test.tsx`, `overview-page.test.tsx`) — 100% verde (7/7 arquivos, 123/123 testes)
- [x] `npm run build` — build de produção limpo (`pdfjs` em chunk dinâmico separado, precache PWA preservado)
- [x] Checagem explícita: zero `autoFocus`, zero emojis, zero `<input>`/`<select>` crus nos arquivos de produção da Fase C

---

### FASE D — Infraestrutura de Micro-IA Híbrida (`gemini-2.5-flash-lite`), FinOps, Cotas & Kill-Switch

* **Objetivo:** Adicionar a camada opcional de Micro-IA para os ~5–10% de comprovantes difíceis (`confidenceScore < 0.85` ou foto/PDF escaneado onde o OCR local falhou), com cache LGPD por `sha256`, cota atômica em 2 baldes, hard caps de payload, timeout estrito e kill-switch global.
* **Fora de Escopo nesta Fase:** Plugues em `StatementImportDialog` (reservados para a Fase E).
* **Arquivos Alvo:**
  * `supabase/migrations/20260101000145_ai_extraction_quotas_and_cache.sql` (novo — ajuste sequencial após `000144` pré-existente)
  * `supabase/functions/_shared/ai-schemas.ts` (novo) + `src/tests/ai-schemas.test.ts`
  * `supabase/functions/ai-financial-assistant/{index.ts,deno.json}` (novos)
  * `src/services/ai-assistant.ts` (novo) + `src/services/ai-assistant.test.ts`
  * `src/services/receipt-resolution.ts` + `src/services/receipt-resolution.test.ts` (integração do fallback seletivo)
  * `src/types/schema.ts`, `src/components/modules/attach-receipt-dialog.tsx`, `src/features/transactions/wizard/{use-receipt-autofill.ts,launch-wizard-modals.tsx,launch-wizard.tsx}`
  * `supabase/config.toml`, `supabase/.env.example`, `package.json` (incluir `ai-financial-assistant` no script `deploy:functions`)

#### Checklist Técnico — Fase D
- [x] **D.1** Criar migration `20260101000145_ai_extraction_quotas_and_cache.sql`:
  - Tabela `public.user_ai_quotas` (`user_id`, `period_month`, `period_day`, `receipt_calls_month`, `receipt_calls_day`, `batch_calls_month`, `batch_calls_day`, `updated_at`) com `FORCE ROW LEVEL SECURITY`;
  - Tabela `public.receipt_extractions_cache` (`user_id`, `sha256`, `mode`, `extracted_json`, `created_at` — **sem imagem nem texto bruto**) com `UNIQUE (user_id, sha256, mode)` e `FORCE ROW LEVEL SECURITY`;
  - RPC atômica `public.increment_user_ai_quota_atomic(p_user_id, p_bucket, p_period_month, p_period_day)` (`SECURITY DEFINER`, `service_role` only, `ON CONFLICT (user_id, period_month) DO UPDATE`) — quando `user_ai_quotas.period_day <> p_period_day`, resetar **ambos** os contadores diários (`1` no balde acionado, `0` no outro balde) e atualizar `period_day = p_period_day` (**Trava 4**);
  - Feature flag `ai_extraction` no catálogo de features do sistema (+ `"ai_extraction"` em `SYSTEM_FEATURE_KEYS`).
- [x] **D.2** Criar `supabase/functions/_shared/ai-schemas.ts`:
  - Schemas Zod estritos de entrada e saída para `mode: "single_receipt"` (já prevendo `"statement_pdf_rows"` e `"categorize_batch"` para a Fase E);
  - Validadores de **Hard Cap de Payload (Trava 3)**: imagem `<= 500 KB`, texto comprovante `<= 8.000` chars, texto fatura `<= 25.000` chars, batch `<= 40` itens;
  - Helper `maskSensitivePiiForAi(text)` para mascarar CPFs completos e contas antes de enviar ao modelo.
- [x] **D.3** Criar Edge Function `supabase/functions/ai-financial-assistant/index.ts` reutilizando `_shared/http.ts`:
  - Kill-switch `Deno.env.get("AI_EXTRACTION_ENABLED") !== "true"` → `{ ok: false, reason: "disabled", fallbackToLocal: true }`;
  - Autenticação JWT + checagem Fail-Closed de assinatura ativa (`!isReadOnly`, `status === "active"`) → `403` se bloqueado;
  - Cache Hit em `receipt_extractions_cache` por `(user_id, sha256, mode)` **antes** de checar/consumir cota;
  - Pré-checagem de cota por plano (`trial`: 15/mês, 5/dia; `pro`/`lifetime`: 100/mês, 15/dia no Balde 1), considerando o uso diário como `0` se `period_day !== todayBrt`;
  - Chamada HTTP nativa (sem SDK pesado) para `gemini-2.5-flash-lite` com `responseMimeType: "application/json"`, `responseSchema` rígido e timeout de `4.500 ms`;
  - Validação da resposta com `zod.safeParse()` → somente se `ok: true`, grava em `receipt_extractions_cache` e chama `increment_user_ai_quota_atomic`.
- [x] **D.4** Criar `src/services/ai-assistant.ts` (zero SDK externo, `AbortController` de `5.500 ms`, deduplicação de requisições concorrentes via `inFlightBySha256` diretamente no cliente, compressão `1024px @ 0.72` para visão quando necessário, envio de texto mascarado quando ML Kit/`unpdf` já extraiu texto).
- [x] **D.5** Conectar fallback seletivo em `src/services/receipt-resolution.ts`:
  - Acionar apenas se `localConfidence < 0.85` (ou `empty_text` / `unrecognized` em imagem/PDF), `navigator.onLine === true`, `!isReadOnlyMode` e feature flag ativa;
  - Garantir degradação 100% silenciosa para o resultado local em qualquer erro/timeout/cota esgotada.
- [x] **D.6** Criar testes unitários simulando os 6 estados de exceção (cota esgotada, `read_only`, offline, timeout 5,5s, HTTP 429/500/JSON inválido, kill-switch desligado).

#### Quality Gate — Fase D
- [x] `npm run verify` — 100% verde (`tsc -b` 0 erros; `eslint .` 0 erros / 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`; `src/domain/` 227/227 arquivos e 3.220/3.220 testes)
- [x] Testes de `_shared/ai-schemas.ts` (`src/tests/ai-schemas.test.ts`), `src/services/ai-assistant.test.ts` (todos os 6 estados de resiliência + Lock + LGPD), `src/services/receipt-resolution.test.ts`, `attach-receipt-dialog.test.tsx` e `launch-wizard.test.tsx` — 100% verde (5/5 arquivos, 81/81 testes)
- [x] `npm run build` — build limpo sem aumento relevante no bundle principal (`vendor-zod` +1,73 kB, `modules` +13 kB, `receipt-extractor` isolado dinamicamente em 230,13 kB, `pdfjs` separado em 1.612,57 kB, precache PWA 190 entries / 8.207,43 KiB)

---

### FASE E — Plugues Sutis de Reuso da Micro-IA (Grupo A: Auto-Categorização Batch & Fatura PDF Multi-Coluna)

* **Objetivo:** Reaproveitar a Edge Function `ai-financial-assistant` e o Balde 2 (`batch_calls`) para eliminar o atrito manual na importação de faturas de cartão (`StatementImportDialog`), mantendo 100% de blindagem matemática e invisibilidade na UX.
* **Fora de Escopo nesta Fase:** Notas de Corretagem B3 (Grupo B), Busca Global `intents.ts` e `SmartAdvisor` (Grupo C — proibidos para IA).
* **Arquivos Alvo:**
  * `supabase/functions/_shared/ai-schemas.ts` + `supabase/functions/ai-financial-assistant/index.ts` (habilitados modos `"categorize_batch"` e `"statement_pdf_rows"`)
  * `src/services/ai-assistant.ts` + `src/services/ai-assistant.test.ts` + `src/tests/ai-schemas.test.ts`
  * `src/features/cards/components/{statement-import-helpers.ts,use-statement-import.ts,statement-import-dialog.tsx,statement-import-dialog.test.tsx,cards-page-modals.tsx}`
  * `src/features/cards/hooks/use-cards-page-state.ts` + `src/features/cards/pages/cards-page.tsx`

#### Checklist Técnico — Fase E
- [x] **E.1** Implementar modo `"categorize_batch"` na Edge Function `ai-financial-assistant`:
  - Consome Balde 2 (`batch_calls`: Trial 5/mês, Pro 20/mês);
  - **Trava 5 (Privacidade & Whitelist):** aceita apenas `descriptions: string[]` (máx. 40, higienizadas via `sanitizeBatchDescriptionForAi`) e `categories: { id: string; name: string }[]` (nunca valores, datas ou dados de cartão); valida via Zod que todo `categoryId` retornado existe no `Set` de categorias enviadas.
- [x] **E.2** Integrar Camada 4 silenciosa em `src/features/cards/components/use-statement-import.ts`:
  - Após `runStatementReconciliation`, verifica Camada 1–2 local (`MerchantLearningMemory`) e coleta apenas os itens `unmatched_new` sem histórico que caíram na categoria fallback padrão;
  - Se houver itens desconhecidos e o usuário estiver online + elegível, chama `categorizeDescriptionsBatchWithAi` em background (com timeout 5,5s e fallback silencioso, protegendo edições manuais concorrentes);
  - Aplica `friendlyName` (preservando `statementHash` determinístico) e `selectedCategoryId` sugeridos e retroalimenta `autoLearnExpenseCategory` (`MerchantLearningMemory`), garantindo custo R\$ 0,00 nos meses seguintes.
- [x] **E.3** Implementar modo `"statement_pdf_rows"` na Edge Function e plugar como fallback automático em `src/features/cards/components/statement-import-helpers.ts` (`parseStatementWithPdfAiFallback`) quando um PDF de fatura multi-coluna falhar no `parseTextToRows` determinístico (enviando texto mascarado `<= 25.000` chars e recebendo `RawParsedRow[]` para os motores determinísticos `buildTransactionsFromRows` e `reconcileStatementTransactions` conciliarem).
- [x] **E.4** Adicionar testes cobrindo whitelist estrita de `categoryId`, ausência de dados sensíveis no payload de batch, fallback offline/sem cota e fallback PDF multi-coluna do `StatementImportDialog`.

#### Quality Gate — Fase E
- [x] `npm run verify` — 100% verde (`tsc -b` 0 erros; `eslint .` 0 erros / 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`; `src/domain/` 229/229 arquivos e 3.244/3.244 testes)
- [x] Testes de `src/domain/reconciliation/` (incluídos em `src/domain/`), `ai-schemas.test.ts`, `ai-assistant.test.ts`, `statement-import-dialog.test.tsx`, `cards-page.test.tsx` e `cards-page-demo.test.tsx` — 100% verde (5/5 arquivos, 53/53 testes)
- [x] `npm run build` — build de produção limpo (`pdfjs` em chunk dinâmico de 1.612,57 kB, PWA precache 190 entries / 8.217,19 KiB)

---

## 4. GOLDEN DATASET DE TESTES OBRIGATÓRIOS

| Grupo | Casos de Teste Obrigatórios | Expectativa Canônica |
|---|---|---|
| **G1. Pix EMVCo** | Estático com valor (`Tag 54 = "45.00"`); Estático sem valor (sem `Tag 54`); Dinâmico com URL (`Tag 26.25`); EMVCo com `\r\n` internos; EMVCo com 1 byte adulterado (CRC inválido). | Válidos retornam `PIX_BRCODE` com `valueCents` exato (`4500` ou `0`) e `recipientName`; CRC inválido retorna `null`. |
| **G2. Falsos Positivos Clipboard** | WhatsApp com telefone + `R$ 50,00`; e-mail comercial com `45.00`; rastreio 11/14 dígitos com DV inválido; link `https://site.com/v2.50`; texto solto `"45,00"`. | Todos retornam `null` / `NONE` no detector passivo. |
| **G3. Chaves Pix Isoladas** | CPF válido (Módulo 11) vs. inválido; CNPJ válido (Módulo 11) vs. inválido; UUID v4 EVP válido vs. string hifenizada; e-mail isolado; celular `+55 (11) 98765-4321`. | Válidos retornam `PIX_KEY` com `valueCents === 0`; inválidos retornam `null`. |
| **G4. Parse Monetário** | `"R$ 45,00"`, `"45,00"`, `"R$ 1.450,00"`, `"0,50"`, `"R$ 45.00"`, `"45.00"`, `"1,450.00"`, `"R$ 45 , 00"`, `"Item 1 45,00"`, `"Qtd 2 45,00"`, `"1,000 x R$ 45,000"`. | `4500`, `4500`, `145000`, `50`, `4500`, `4500`, `145000`, `4500`, `4500`, `4500`, `4500` (jamais `45000`, `14500` ou `450000`). |
| **G5. Comprovantes & Titularidade** | Boleto/Pix com `Saldo: R$ 3.500,00`, `Valor documento: R$ 100,00`, `Desconto: R$ 15,00`, `Valor Pago: R$ 85,00`; Nubank/Inter sem `"Nome:"` (`Destino\nMARIA\nOrigem\nGABRIEL`) com usuário `Gabriel` (expense) vs. `Maria` (income) vs. mesma titularidade (`isSameTitularity: true`); PDF com 12 linhas datadas (`multi_statement`). | Seleciona `8500`; classifica direção e contraparte corretamente pelo titular; detecta mesma titularidade e multi-lançamento. |
| **G6. Resiliência & Segurança IA** | Cota esgotada; `read_only`; offline; timeout 5,5s; HTTP 429/500/JSON malformado; kill-switch `false`; `categorize_batch` com `categoryId` inventado (rejeitado pela whitelist); CPF mascarado antes do envio. | Zero erro fatal, zero débito em falha, fallback local íntegro e PII mascarada. |

---

## 5. DIÁRIO DE EXECUÇÃO & REGISTRO DE QUALITY GATES (LEDGER)

| Fase | Status | Data | Arquivos Alterados / Criados | Resultado Verify / Tests / Build | Desvios / Observações | Aprovação (Go/No-Go) |
|---|---|---|---|---|---|---|
| **Pré-Impl.** | `CONCLUÍDA` | 2026-11-23 | `planos/PLANO_MESTRE_PIX_COMPROVANTES_IA.md` | N/A (Somente documentação; zero código tocado) | Contratos entre fases e 5 Travas Finais consolidados. | Aprovado |
| **Fase A** | `PORTÃO A` | 2026-11-23 | `src/domain/money/{parse,index,parse.test}.ts`, `src/domain/validation/{cnpj,index,cnpj.test}.ts`, `src/domain/pix/pix-key-validation.ts`, `src/domain/notifications/{ocr-cleaner,pix-emv-parser,pix-text-parser,pix-clipboard}{,.test}.ts`, `bank-parser.test.ts`, `src/components/modules/dashboard-pix-clipboard-card.test.tsx`, `planos/PLANO_MESTRE_PIX_COMPROVANTES_IA.md` | `tsc -b` 0 erros; `eslint .` 0 erros (9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`); Vitest (`money/`, `validation/`, `notifications/`): 36/36 arquivos, 626/626 testes (`comprovantes-real-matrix` 18/18, `bank-e2e-matrix` 85/85) | `src/domain/pix/` (61/61), `fidelity.test.ts` (62/62) e `dashboard-pix-clipboard-card.test.tsx` (4/4) também verdes. Observação esperada: `use-pix-clipboard-detector.test.ts` tem 2 falhas até atualização da Fase C. | Aguardando Go Fase B |
| **Fase B** | `PORTÃO B` | 2026-11-23 | `src/domain/notifications/{receipt-types,bank-parser,receipt-amount-scorer,document-multiplicity,pix-receipt-parser,bank-slip-parser,wire-transfer-parser,universal-receipt-parser,index}.ts`, `src/domain/notifications/{receipt-amount-scorer,document-multiplicity,pix-receipt-parser,wire-transfer-parser,universal-receipt-parser}.test.ts`, `src/services/{receipt-resolution,native/web-ocr,native/receipt-extractor}{,.test}.ts`, `planos/PLANO_MESTRE_PIX_COMPROVANTES_IA.md` | `npm run verify`: `tsc -b` 0 erros, `eslint .` 0 erros (9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`), `src/domain/` 227/227 arquivos, 3.220/3.220 testes (`comprovantes-real-matrix` 18/18, `bank-e2e-matrix` 85/85); `src/services/receipt-resolution.test.ts` + `src/services/native/`: 25/25 arquivos, 255/255 testes. | `attach-receipt-dialog.test.tsx` (9/9) verde; `launch-wizard.test.tsx` (37/38) tem 1 falha esperada no detector passivo até Fase C. Ajuste de `PDFDocumentProxy` via `pdf.cleanup()` + `pdf.loadingTask?.destroy()`. | Aguardando Go Fase C |
| **Fase C** | `PORTÃO C` | 2026-11-23 | `src/domain/notifications/pix-receipt-parser.ts`, `src/services/pix-clipboard-store{,.test}.ts`, `src/hooks/use-pix-clipboard-detector{,.test}.ts`, `src/features/overview/components/overview-dashboard-content.tsx`, `src/components/modules/dashboard-pix-clipboard-card{,.test}.tsx`, `src/components/modules/attach-receipt-dialog{,.test}.tsx`, `src/features/transactions/wizard/{wizard-types.ts,wizard-mappers.ts,launch-wizard-header.tsx,use-receipt-autofill.ts,quick-description-field.tsx,step-quick.tsx,launch-wizard-modals.tsx,launch-wizard.tsx,launch-wizard.test.tsx}`, `src/features/transactions/pages/share-target-page{,.test}.tsx`, `planos/PLANO_MESTRE_PIX_COMPROVANTES_IA.md` | `npm run verify`: `tsc -b` 0 erros, `eslint .` 0 erros (9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`), `src/domain/` 227/227 arquivos (3.220/3.220 testes); UI/Hooks/Stores Fase C (`pix-clipboard-store`, `use-pix-clipboard-detector`, `dashboard-pix-clipboard-card`, `attach-receipt-dialog`, `launch-wizard`, `share-target-page`, `overview-page`): 7/7 arquivos (123/123 testes); `npm run build` limpo (`pdfjs` em chunk dinâmico de 1.612,57 kB, PWA precache 189 entries / 8.189,94 KiB). | `grep` nos arquivos de produção da Fase C confirmou zero `autoFocus`, zero `<input>`/`<select>`/`<dialog>`/`<details>` crus e zero emojis. Adicionado também fallback single-line de beneficiário em `pix-receipt-parser.ts` para texto compartilhado do Web Share Target. | Aguardando Go Fase D |
| **Fase D** | `PORTÃO D` | 2026-11-23 | `supabase/migrations/20260101000145_ai_extraction_quotas_and_cache.sql`, `supabase/functions/_shared/ai-schemas.ts`, `supabase/functions/ai-financial-assistant/{index.ts,deno.json}`, `supabase/config.toml`, `supabase/.env.example`, `package.json`, `src/types/schema.ts`, `src/services/{ai-assistant,receipt-resolution}{,.test}.ts`, `src/tests/ai-schemas.test.ts`, `src/components/modules/attach-receipt-dialog.tsx`, `src/features/transactions/wizard/{use-receipt-autofill.ts,launch-wizard-modals.tsx,launch-wizard.tsx}`, `planos/PLANO_MESTRE_PIX_COMPROVANTES_IA.md` | `npm run verify`: `tsc -b` 0 erros, `eslint .` 0 erros (9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`), `src/domain/` 227/227 arquivos (3.220/3.220 testes); Fase D/Integração (`ai-schemas`, `ai-assistant`, `receipt-resolution`, `attach-receipt-dialog`, `launch-wizard`): 5/5 arquivos (81/81 testes); `npm run build` limpo (2,41s, precache PWA 190 entries / 8.207,43 KiB, `pdfjs` dinâmico em 1.612,57 kB). | Numeração da migration ajustada para `000145` pois `000144_default_family_mode_enabled_for_new_users.sql` já existia. Deno CLI não instalado localmente (`ai-financial-assistant` validada por `eslint .`, testes compartilhados em `ai-schemas.test.ts` e revisão de contrato). | Aguardando Go Fase E |
| **Fase E** | `CONCLUÍDA` | 2026-11-23 | `supabase/functions/_shared/ai-schemas.ts`, `supabase/functions/ai-financial-assistant/index.ts`, `src/services/ai-assistant{,.test}.ts`, `src/tests/ai-schemas.test.ts`, `src/features/cards/hooks/use-cards-page-state.ts`, `src/features/cards/pages/cards-page.tsx`, `src/features/cards/components/{cards-page-modals.tsx,statement-import-dialog.tsx,statement-import-dialog.test.tsx,statement-import-helpers.ts,use-statement-import.ts}`, `planos/PLANO_MESTRE_PIX_COMPROVANTES_IA.md` | Verificado pós-edição final: `npm run verify` (`tsc -b` 0 erros, `eslint .` 0 erros / 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`, `src/domain/` 229/229 arquivos / 3.244/3.244 testes no tree com WIP local), Fase E UI/Serviços (`ai-schemas`, `ai-assistant`, `statement-import-dialog`, `cards-page`, `cards-page-demo`): 5/5 arquivos (53/53 testes), `npm run build` limpo (`pdfjs` dinâmico em 1.612,57 kB, PWA precache 190 entries / 8.217,19 KiB). | `type-sniffer.ts` exige cabeçalho em CSVs de linha única com palavra reservada ou dígitos na descrição (`LOJA XPTZ 9981`); preservado `statementHash` original ao aplicar `friendlyName` pela Camada 4 para não quebrar deduplicação determinística futura. | APROVADO / RELEASE v3.18.0 |
| **Hardening & Release `v3.18.0`** | `CONCLUÍDA` | 2026-11-23 | `supabase/functions/_shared/ai-schemas.ts`, `supabase/functions/ai-financial-assistant/index.ts`, `src/services/{ai-assistant,receipt-resolution,pix-clipboard-store}{,.test}.ts`, `src/features/cards/components/{use-statement-import.ts,statement-upload-step.tsx,statement-import-dialog.tsx}`, `src/domain/notifications/{pix-emv-parser.ts,document-multiplicity.ts,document-multiplicity.test.ts}`, `src/tests/ai-schemas.test.ts`, `supabase/migrations/20260101000145_ai_extraction_quotas_and_cache.sql`, `package.json`, `docs/platforms/DEPLOYMENT.md`, `docs/plans/PLANO_MESTRE_PIX_COMPROVANTES_IA.md` | Validado em worktree limpo da `v3.18.0`: `npm run verify` (`tsc -b` 0 erros, `eslint .` 0 erros / 9 warnings pré-existentes em `scripts/sample-reports-entry.tsx`, `src/domain/` 227/227 arquivos / 3.221/3.221 testes em 73,38s); suíte integração A–E (12/12 arquivos, 151/151 testes em 30,32s); `npm run build` limpo em 2,59s (`pdfjs` dinâmico 1.612,57 kB, PWA precache 190 entries / 8.214,42 KiB). | Blindagens aplicadas: TTL por modo no cache Supabase (`30d`/`14d`) + remoção de cercas Markdown + `maxIndex`/unicidade no batch + `maxOutputTokens` `1.536`/`4.096`; downscale Vision `768px @ 0.60` + invalidação por nome de categoria; guarda `Never-Degrade` + herança de data; feedback `isReadingFile` no upload de fatura + cleanup unmount + deduplicação `autoLearnExpenseCategory`; distinção `fatura do cartão` vs `pagamento de fatura`; `COMMENT ON TABLE` na migration `000145`. | Aprovado (`v3.18.0`) |
