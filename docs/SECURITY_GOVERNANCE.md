# 🛡️ SECURITY_GOVERNANCE.md — Governança de Segurança e Proteção de Dados

> **Status:** v1.0 — Guia de Engenharia de Segurança, Criptografia, Privacidade e Proteção contra Vazamento de Dados no Áxis.
> **Docs de referência:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`ESPECIFICACAO_TECNICA.md`](../ESPECIFICACAO_TECNICA.md) · [`AGENTS.md`](../AGENTS.md).

---

## 1. INTRODUÇÃO E MODELO DE AMEAÇAS

O **Áxis** processa dados financeiros e transacionais sensíveis. A governança de segurança do projeto opera sob o modelo de **Defesa em Profundidade (*Defense in Depth*)**, estruturando proteções em camadas para eliminar pontos únicos de falha e garantir conformidade com a Lei Geral de Proteção de Dados (LGPD).

### 1.1 Vetores de Ameaça e Mitigações

| Vetor de Risco | Cenário de Ataque | Mitigação Arquitetural no Áxis |
|---|---|---|
| **Vazamento Lógico / API** | Invasor tenta acessar dados de outros usuários via API REST ou chamadas diretas. | **Row Level Security (RLS)** estrito em 100% das tabelas (`auth.uid() = user_id`) + RPCs com `SECURITY DEFINER` protegidas. |
| **Roubo Físico / Backups** | Despejo de snapshot, roubo de discos na nuvem (AWS KMS). | **Criptografia em Repouso (TDE)** com AES-256 nativa nos volumes e backups do Supabase. |
| **Interceptação em Trânsito** | Ataques *Man-in-the-Middle* na rede. | **TLS 1.3 / HTTPS** estrito com HSTS em todas as conexões (web e mobile). |
| **Vazamento via DevTools** | Inspeção de memória ou logs em computadores compartilhados. | **Remoção de logs de console e debugger** via minifier Oxc/Rolldown (`rolldownOptions.output.minify.compress`) no build de produção do Vite. |
| **Exposição em Auditoria** | Vazamento involuntário de senhas, chaves de API ou CPFs na trilha histórica. | **Trigger de sanitização automática** (`trg_sanitize_audit_events_payload`) antes da gravação em `audit_events`. |

---

## 2. DIRETRIZES DE CRIPTOGRAFIA & HASHING

### 2.1 O Papel do Argon2id
* **O que é:** Função de derivação de chave e *password hashing* unidirecional (*one-way*).
* **Uso exclusivo:** Proteção e hashing de credenciais de login no Supabase Auth (`auth.users`).
* **Inviabilidade para dados operacionais:** Por ser unidirecional (sem chave de descriptografia), **não deve ser usado para valores monetários, descrições ou datas**. Fazer isso destruiria agregações SQL (`SUM`, filtros por competência, relatórios) e causaria perda irreversível de dados se o usuário perdesse sua chave.

### 2.2 Criptografia Simétrica e Pseudonimização (LGPD)
* **Pseudonimização Estrutural:** As tabelas de transação (`expenses`, `incomes`, `portfolio_transactions`) **nunca** armazenam dados de identificação bancária completa, números inteiros de cartão de crédito (apenas os 4 últimos dígitos) ou nomes de titulares. Os dados pertencem unicamente a um `user_id (UUID)`. Mesmo um dump isolado não permite correlação direta com contas bancárias reais.
* **Proteção de PII (CPF):**
  * O CPF é limpo de caracteres não numéricos (`cleanCPF`) antes da persistência.
  * Validação estrita por módulo 11 da Receita Federal impede injeção de dados corrompidos ou strings maliciosas.
  * A função `public.mask_cpf(text)` e o utilitário `maskCPF()` garantem mascaramento no padrão `***.***.789-**` em telas e relatórios, prevenindo *shoulder surfing*.
  * **Controle de coluna (migração 0058):** `REVOKE SELECT (cpf)` de `anon`/`authenticated` — o PostgREST **não** devolve CPF ao bundle do cliente; leitura operacional fica restrita a `service_role` (Edge Asaas).

### 2.3 Edge Functions (billing & cotações)
* **CORS allowlist** (`ALLOWED_ORIGINS` + `*.pages.dev` + localhost/Capacitor) — sem `Access-Control-Allow-Origin: *` em rotas autenticadas.
* **Webhook Asaas:** `verify_jwt = false` + token `asaas-access-token` com comparação *timing-safe*; **sem** CORS de browser; tier resolvido só pelo **catálogo de valores** (`asaas-plans.ts`), nunca por heurística `value > 50`.
* **Checkout/manage:** exigem `SUPABASE_ANON_KEY` (fail-closed; **proibido** fallback para `service_role`); erros públicos genéricos.
* **`quotes`:** escrita no cache global (`user_id IS NULL`) **somente** com service role (cron); JWT de usuário só calcula/devolve cotações (cliente persiste override próprio).
* **Runtime Node:** engines/`NODE_VERSION` ≥ `22.23.4` | `24.22.1` | `26.12.1` (CVEs Brotli/TLS/`dns.resolve`, out/2026).

---

## 3. AUDITORIA E HIGIENIZAÇÃO DE LOGS (`audit_events`)

A tabela `public.audit_events` é imutável por construção (políticas RLS de apenas `INSERT` e `SELECT` pelo dono, sem `UPDATE` ou `DELETE`).

Para evitar que erros de programação gravem segredos operacionais na auditoria:
1. **Trigger `public.sanitize_audit_payload()`:** Executada `BEFORE INSERT` em `audit_events`.
2. **Mascaramento:** Se existir a chave `cpf` no objeto JSONB, ela é automaticamente convertida para o formato mascarado (`mask_cpf`).
3. **Redação:** Chaves como `password`, `token`, `secret`, `api_key`, `asaas_api_key`, `access_token` e `cvv` têm seus valores substituídos por `"[REDACTED]"`.

---

## 4. HIGIENIZAÇÃO DE BUILDS FRONTEND

O arquivo [`vite.config.ts`](../vite.config.ts) aplica remoção automática de saídas de depuração no **minifier Oxc (Vite 8 / Rolldown)**:

```ts
build: {
  rolldownOptions: {
    output: {
      minify: {
        compress: { dropConsole: true, dropDebugger: true },
      },
    },
  },
}
```

> Nota: em Vite 8, `esbuild.drop` é **ignorado** (transformadores Oxc). Use sempre `rolldownOptions.output.minify.compress`.

Isso garante que nenhum `console.log` de debug ou retorno bruto de APIs permaneça inspecionável no console de navegadores de usuários finais.

---

## 5. CHECKLIST DE CONFORMIDADE PARA NOVAS FEATURES

Ao implementar novas telas, repositórios ou tabelas:
- [x] A nova tabela possui coluna `user_id uuid not null references public.profiles(id)`?
- [x] O RLS foi ativado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)?
- [x] Foram criadas políticas isoladas para `SELECT`, `INSERT`, `UPDATE` e `DELETE` baseadas em `auth.uid() = user_id`?
- [x] Nenhum dado de cartão de crédito além dos últimos 4 dígitos e da bandeira é persistido?
- [x] Nenhum log de dados sensíveis foi introduzido sem mascaramento?
