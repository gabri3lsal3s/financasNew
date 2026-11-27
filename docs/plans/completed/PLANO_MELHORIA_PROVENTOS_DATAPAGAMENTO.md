# Plano de Melhoria — Proventos com Data de Pagamento, Provedor B3 Complementar e Conciliação Inteligente

> **Status:** `CONCLUÍDO` (26/11/2026 — Edge Function `quotes` implantada em `lnsfcajcfofgvpvabwbi`, `npm run verify`, `npm run build` e 67/67 testes direcionados aprovados)
> **Data:** 26/11/2026
> **Relacionado:** [PLANO_MOTOR_COTACOES_PROVENTOS.md](./PLANO_MOTOR_COTACOES_PROVENTOS.md) (Fatias S1–S6 concluídas)

---

## 1. Problema Observado e Diagnóstico Raiz

No fluxo atual, o usuário cadastrou manualmente recebimentos de `HGRU11` nas datas reais de pagamento (**`15/10`** e **`16/11`**), mas o identificador automático exibiu dois proventos pendentes com referência no **dia 30** (`30/09` e `30/10`) sem reconhecer os lançamentos já feitos.

A auditoria no código e nos provedores externos confirmou **4 causas encadeadas**:

1. **Brapi bloqueada em `401/403` cai integralmente no Yahoo:**
   - Em `supabase/functions/quotes/index.ts` (`fetchBrapiDividendsForTickers`), a requisição vai para `https://brapi.dev/api/quote/<tickers>?dividends=true`.
   - No plano gratuito da Brapi (ou sem `BRAPI_TOKEN` com escopo pago), `?dividends=true` só libera 4 tickers de teste (`PETR4`, `VALE3`, `MGLU3`, `ITUB4`) e retorna `401/403` para FIIs e demais ações (como `HGRU11`, `LVBI11`, `TAEE4`, `MDIA3`).
   - Ao receber `401/403`, o circuito Brapi abre (`brapiCircuitOpen = true`) e **100% dos ativos B3 caem no Yahoo Chart**.
   - Adicionalmente, na API v2 da Brapi, **Ações** (`/api/v2/stocks/dividends`) e **FIIs** (`/api/v2/fii/dividends`) possuem rotas separadas.
2. **Yahoo Chart não entrega `payment_date` nem tipo fiscal para B3:**
   - `parseYahooDividends` (`supabase/functions/_shared/quotes-core.ts`) recebe apenas *ex-date* e valor unitário.
   - Assim, `payment_date` fica `null`, `com_date` é calculada como o pregão anterior à *ex-date* (último pregão do mês em FIIs: **`30/09`** e **`30/10`**) e `is_type_uncertain` fica `true` (`"Alíquota a conferir (Yahoo)"`).
3. **Servidor (`process_user_dividends`) ignora eventos sem `payment_date` na deduplicação:**
   - `isFuzzyDuplicateManualDividend(corp.payment_date, ...)` retorna `matched: false` na primeira linha quando `payment_date` é `null`.
4. **Cliente (`useCorporateDividends`) compara `comDate` com tolerância de apenas 3 dias úteis:**
   - `use-corporate-dividends.ts` chama `isCorporateDividendDeduplicated({ payment_date: mapped.paymentDate ?? mapped.comDate }, ...)` com `maxBusinessDaysDiff = 3`.
   - Como FIIs pagam cerca de **10–11 dias úteis após a COM** (`30/09 → 15/10` e `30/10 → 16/11`), a diferença excede os 3 dias úteis e o sistema não reconhece os lançamentos manuais.

---

## 2. Análise de Provedores Complementares à Brapi (B3)

| Provedor | Cobertura B3 (Ações + FIIs) | Entrega `payment_date`, `com_date` e `type`? | Custo / Autenticação | Limitações / Riscos | Veredito |
|---|---|---|---|---|---|
| **1. B3 Proxy Oficial** (`sistemaswebb3-listados.b3.com.br`) | **Completa** (Ações via `listedCompaniesProxy` e FIIs via `fiiProxy`) | **Sim** (`cashDividends` com `lastDatePrior`, `paymentDate` e tipo) | **Gratuito**, sem API key (testado ao vivo com HTTP 200 JSON) | API interna do portal B3 (não versionada; FIIs exigem lookup por código/CNPJ em `fiiProxy`) | **Melhor fallback gratuito imediato** antes do Yahoo |
| **2. HG Brasil / HG Finance** (`api.hgbrasil.com/v2/finance/dividends`) | **Completa** (Ações, BDRs e FIIs: `B3:HGRU11`, `B3:TAEE4`) | **Sim** (`dividend`, `interest_on_equity`, `income` + data de corte e pagamento) | Chave (`key`) com tier gratuito limitado / planos pagos | Cota restrita no plano gratuito; exige cadastro de chave | **Ótima opção comercial secundária** (se houver chave em Secret) |
| **3. Dados de Mercado** (`api.dadosdemercado.com.br`) | **Completa** (Ações e FIIs B3) | **Sim** (rotas de proventos e `/v1/tickers/{ticker}/dy`) | Token gratuito inicial / planos pagos | Rate limit por minuto/mês no plano gratuito | Alternativa secundária nacional |
| **4. Brapi v2** (`/api/v2/stocks/dividends` + `/api/v2/fii/dividends`) | **Completa** (com rotas separadas Ação vs FII) | **Sim** (`approvedOn`, `lastDatePrior`, `paymentDate`, `rate`) | Plano **Startup** ou **Pro** (`BRAPI_TOKEN`) | Plano gratuito não cobre dividendos fora de 4 ações e 2 FIIs de teste | **Provedor primário ideal** se houver assinatura/token Startup+ |
| **5. Yahoo Finance Chart** (`v8/finance/chart?events=div`) | Alta | **Não** para B3 (sem `payment_date` e sem tipo Dividendo vs JCP) | Gratuito, sem token | Causa raiz dos eventos `"a definir"` e `"Alíquota a conferir"` | Manter apenas como **último recurso** (`raw_fallback`) |

### Estratégia Recomendada de Cascata (Resiliente e Econômica)
1. **Primário B3:** **Brapi** (ajustada para consultar ações e FIIs nas rotas corretas quando `BRAPI_TOKEN` tiver escopo, ou manter se já assinado).
2. **Secundário Estruturado B3 (Novo):** **B3 Proxy Oficial** (`sistemaswebb3-listados.b3.com.br`) + suporte opcional a **HG Finance** (caso `HGBR_FINANCE_KEY` esteja configurada nos Secrets do Supabase). Só cai aqui para os `uncoveredBrTickers` da Brapi.
3. **Último Recurso:** **Yahoo Chart** (`raw_fallback`), acionado apenas se nenhum provedor estruturado retornar o evento.

---

## 3. Frentes de Implementação

### Frente 1 — Provedor Estruturado B3 & Classificação de FIIs (`quotes/index.ts` + `quotes-core.ts`)
- **1.1. Adaptador B3 Oficial (`fetchB3OfficialDividendsForTicker`):**
  - Implementar parser puro em `supabase/functions/_shared/quotes-core.ts` para `GetListedSupplementCompany` (ações) e equivalente `fiiProxy` (FIIs), extraindo `com_date` (`lastDatePrior`), `payment_date` (`paymentDate`), `rate`, `type` (`DIVIDENDO` / `JCP` / `RENDIMENTO`) e `tax_rate_pct` (`0` ou `15`).
  - Integrar no `sync_corporate_dividends` de `supabase/functions/quotes/index.ts` para todos os `uncoveredBrTickers` antes de recorrer ao Yahoo Chart.
- **1.2. Adaptador Opcional HG Finance (`fetchHgBrasilDividendsForTickers`):**
  - Se `Deno.env.get("HGBR_FINANCE_KEY")` existir, consultar `https://api.hgbrasil.com/v2/finance/dividends?tickers=...&key=...` como reforço antes do B3 Proxy/Yahoo.
- **1.3. Ajuste Brapi v2 (Ações vs FIIs) + Tipagem de FIIs Curados:**
  - Separar tickers FII (`CURATED_TICKERS_CATALOG` / sufixo `11` curado) de ações ao consultar a Brapi v2.
  - Quando um FII/Fiagro curado receber `payment_date` de fonte estruturada, gravar `type = 'RENDIMENTO'`, `tax_rate_pct = 0`, `is_type_uncertain = false`.

---

### Frente 2 — Conciliação Automática pela `payment_date` no Servidor (`process_user_dividends`)
- **2.1. Substituir `isFuzzyDuplicateManualDividend` por `reconcilePartition1to1Edge`:**
  - Em `supabase/functions/quotes/index.ts` (`process_user_dividends`), trocar a deduplicação simples por `reconcilePartition1to1Edge`:
    - **Com `payment_date` conhecida:** compara estritamente pela **`payment_date ± 5` dias úteis** e valor dentro de `max(R$ 0,10, 1,5%)`.
    - **Com `payment_date === null`:** usa a janela típica pós-COM (`15` pregões BR para FIIs, `22` US, `35` dias corridos ações) para conciliar automaticamente vínculos 1:1 inequívocos (resolvendo o caso `HGRU11` `30/09 → 15/10` e `30/10 → 16/11`).
  - Ao encontrar correspondência inequívoca com `portfolio_dividends`, gravar `status = 'SETTLED'`, `settlement_origin = 'dedup'`, `settled_dividend_id = <manual_id>` e preservar o Caixa intacto.
- **2.2. Efetivação automática confortável na Data de Pagamento:**
  - Com `payment_date` preenchida e tipo validado, ao atingir `payment_date <= hoje` (se o usuário tiver liquidação automática ligada e não houver lançamento manual correspondente), `process_user_dividends` efetiva no extrato e no Caixa automaticamente.

---

### Frente 3 — Sugestões de Vínculo e UX "Mastigada" no Cliente
- **3.1. Substituir `isCorporateDividendDeduplicated(mapped.paymentDate ?? mapped.comDate)`:**
  - Em `src/state/queries/use-corporate-dividends.ts`, remover o fallback que trata `comDate` como `paymentDate` com ±3 dias úteis.
  - Executar `reconcileCorporateWithManualDividends` sobre os eventos abertos e o extrato manual:
    - Links **`aplicar`** (1:1 inequívoco) → considerados conciliados;
    - Links **`sugerir`** (ex.: `payment_date: null` vs manual em `15/10`, hipótese JCP `85%`, mensal `[MENSAL]`, empate) → expostos no item via `suggestedManualMatch`.
- **3.2. Card de Correspondência no `PendingDividendsDialog`:**
  - Quando `item.suggestedManualMatch` existir, mostrar na linha do modal:
    > *"Possível correspondência no extrato em DD/MM/AAAA (R$ XX,XX)"*
  - Botão **"Vincular (sem novo crédito)"** → chama `writeUserDividendEdge` / `apply_dividend_reconciliation_system` vinculando o evento ao lançamento manual existente (`SETTLED`, `dedup`) sem duplicar lançamento nem creditar Caixa.
  - Botão secundário **"Vincular e corrigir data"** caso o usuário queira alinhar a data manual à data oficial da fonte.
- **3.3. Clareza entre Data COM e Data de Pagamento:**
  - Em **Provisionados**: exibir `Direito na COM DD/MM (X cotas) · Pagamento previsto DD/MM`.
  - Quando `payment_date` for `null`: exibir `Data COM DD/MM · Pagamento a confirmar` (nunca induzir que o pagamento foi no dia da COM).

---

### Frente 4 — Matriz de Verificação e Critérios de Aceite
1. **Testes de domínio (`src/domain/portfolio/dividend-deduplication.test.ts`) e Edge (`src/tests/quotes-core.test.ts`):**
   - Parser B3 Proxy oficial (`lastDatePrior` + `paymentDate` + `DIVIDENDO`/`JCP`/`RENDIMENTO`).
   - Cenário `HGRU11`: `COM 30/09` e `COM 30/10` conciliando corretamente com lançamentos manuais `15/10` e `16/11` (tanto com `payment_date` preenchida quanto com `payment_date: null` na janela de 15 pregões), sem colisão entre meses consecutivos.
2. **Testes de componente (`src/features/investments/components/pending-dividends-dialog.test.tsx`):**
   - Exibição do card *"Possível correspondência no extrato"* e execução do vínculo em 1 clique sem novo crédito em Caixa.
3. **Validação em Produção:**
   - Executar `sync_corporate_dividends` + `process_user_dividends` e confirmar que `corporate_dividends` passou a gravar `payment_date` real e `trust_tier` estruturado para FIIs e ações B3 (`HGRU11`, `LVBI11`, `TAEE4`, etc.).
