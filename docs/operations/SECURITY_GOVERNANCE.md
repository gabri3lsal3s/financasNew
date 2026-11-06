# 🛡️ SECURITY_GOVERNANCE.md — Governança de Segurança e Proteção de Dados

> **Status:** v2.0 — Guia Canônico de Engenharia de Segurança, Autenticação, Sessão, Criptografia, Privacidade e Proteção contra Vazamento de Dados no Áxis.
> **Docs de referência:** [`ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) · [`ESPECIFICACAO_TECNICA.md`](../architecture/ESPECIFICACAO_TECNICA.md) · [`AGENTS.md`](../../AGENTS.md).

---

## 1. INTRODUÇÃO E MODELO DE AMEAÇAS

O **Áxis** processa dados financeiros e transacionais sensíveis. A governança de segurança do projeto opera sob o modelo de **Defesa em Profundidade (*Defense in Depth*)**, estruturando proteções em camadas para eliminar pontos únicos de falha e garantir conformidade integral com a Lei Geral de Proteção de Dados (LGPD).

### 1.1 Vetores de Ameaça e Mitigações

| Vetor de Risco | Cenário de Ataque | Mitigação Arquitetural no Áxis |
|---|---|---|
| **Vazamento Lógico / API** | Invasor tenta acessar dados de outros usuários via API REST ou chamadas diretas. | **Row Level Security (RLS)** estrito em 100% das tabelas (`auth.uid() = user_id`) + RPCs com `SECURITY DEFINER` protegidas. |
| **Roubo Físico / Backups** | Despejo de snapshot, roubo de discos na nuvem (AWS KMS). | **Criptografia em Repouso (TDE)** com AES-256 nativa nos volumes e backups do Supabase. |
| **Interceptação em Trânsito** | Ataques *Man-in-the-Middle* na rede. | **TLS 1.3 / HTTPS** estrito com HSTS em todas as conexões (web e mobile). |
| **Sequestro de Conta (*Account Takeover*)** | Invasor com acesso temporário ao terminal tenta trocar senha ou e-mail. | **Reautenticação obrigatória com Senha Atual** (`verifyCurrentPassword`) antes de qualquer alteração de credencial. |
| **Interceptação OAuth / PKCE** | Interceptação de código de autorização em redirects abertos. | **PKCE Estrito** (`flowType: "pkce"`) no cliente Supabase Auth, sem segredos client-side. |
| **Terminal Desatendido na Web** | Usuário deixa navegador aberto em computador compartilhado/público. | **Timeout de Inatividade Web de 20 minutos** (`useIdleSessionTimeout`) com desconexão automática suave. |
| **Ataque de Força Bruta Local** | Automação repetitiva de tentativas de login na interface. | **Cloudflare Turnstile** anti-bot real + **Backoff Exponencial no Cliente** (3 falhas: 15s; 5 falhas: 60s). |
| **Resíduos em Memória Pós-Logout** | WebSockets ativos escutando dados ou comprovantes em cache volátil. | **Teardown atômico** (`resetAppState`): fecha canais Realtime (`removeAllChannels()`) e purga buffers de OCR (`clearRecentReceipts()`). |
| **Falha de Sensor Biométrico Mobile** | Usuário impedido de acessar o app por sensor biométrico danificado. | **Saída de Emergência no AppLock** permitindo deslogar e reautenticar com senha. |
| **Vazamento de PII em Telemetria** | E-mails e dados de usuário expostos em plataformas de monitoramento de erros. | **Minimização de PII no Sentry**: envio exclusivo de UUID opaco (`id: user.id`), URLs e query strings sanitizadas (`scrubSensitiveData`). |
| **Exfiltração de Backup Financeiro** | Download indevido de histórico completo por clique acidental ou invasão rápida. | **Trava de Confirmação de Segurança**: validação biométrica nativa ou modal de confirmação explícita na Web. |
| **Vazamento via DevTools** | Inspeção de memória ou logs em computadores compartilhados. | **Remoção de logs de console e debugger** via minifier Oxc/Rolldown (`rolldownOptions.output.minify.compress`) no build de produção do Vite. |
| **Exposição em Auditoria** | Vazamento involuntário de senhas, chaves de API ou CPFs na trilha histórica. | **Trigger de sanitização automática** (`trg_sanitize_audit_events_payload`) antes da gravação em `audit_events`. |
| **DoS em RPCs Públicas Desautenticadas** | Ataques repetitivos de inundação para saturar colunas JSONB e causar negação de serviço. | **Hardening de RPCs Públicas** (`signal_split_payment`): teto de 50 sinais pendentes por link, deduplicação em janela de 10 min, validação de tokens hexadecimais (64 chars), limites estritos de caracteres (1–80) e teto monetário defensivo (R$ 10 mi). |

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

## 3. GOVERNANÇA DE AUTENTICAÇÃO, SESSÃO E CONTROLE DE ACESSO

### 3.1 Reautenticação Obrigatória contra Account Takeover
Toda alteração de dados de autenticação sensíveis exige reautenticação atômica prévia comprovando a posse da senha atual pelo operador:
* **Alteração de Senha (`changeUserPassword`):**
  * O usuário informa: Senha Atual, Nova Senha e Confirmação da Nova Senha.
  * `verifyCurrentPassword(currentPassword)` reautentica no Supabase Auth via `signInWithPassword` antes de disparar `supabase.auth.updateUser({ password })`.
  * Se a senha atual for inválida, lança `AppError("invalid-credentials", "A senha atual informada está incorreta.")` sem alterar a conta.
* **Alteração de E-mail (`requestUserEmailChange`):**
  * Modal seguro em `AccountTab` exige a Senha Atual para solicitar o novo e-mail.
  * O Supabase Auth envia links de confirmação com `emailRedirectTo: getPublicAppUrl("/configuracoes?tab=conta")`.
  * A trigger PostgreSQL `on_auth_user_email_updated` em `auth.users` (migração 0064) sincroniza automaticamente a coluna `email` de `public.profiles` após a confirmação atômica do usuário.

### 3.2 PKCE Estrito e Resolução Universal de Redirecionamentos
* **PKCE Mandatório:** O cliente Supabase (`src/data/client.ts`) é instanciado explicitamente com `flowType: "pkce"`, garantindo geração e troca de `code_verifier` e `code_challenge` para mitigação de interceptação de tokens em SPAs e PWAs.
* **Resolução Universal via `getPublicAppUrl`:**
  * No ecossistema híbrido (Web Cloudflare Pages + APK Nativo Capacitor Android), a origem do aplicativo no mobile é `capacitor://localhost`. Enviar esse esquema em links de e-mail tornaria os links inoperantes em clientes de e-mail de desktop ou browsers externos.
  * O helper centralizado `src/services/app-url.ts` resolve links de autenticação (`/redefinir-senha`, `/entrar`, `/configuracoes`) para a URL pública canônica configurada (`VITE_PUBLIC_APP_URL` ou `window.location.origin`), assegurando funcionamento universal.

### 3.3 Teardown Atômico no Logout (`resetAppState`) e Isolamento de Memória
A desconexão de usuário (`signOut`) executa uma rotina profunda de limpeza de estado para evitar vazamentos de contexto (*cross-session leakage*):
1. **Desconexão de WebSockets Realtime:** Chamada explícita a `supabase.removeAllChannels()` encerrando subscrições ativas no servidor e desalocando listeners de rede.
2. **Purga de Buffer Volátil de Comprovantes (OCR):** Execução de `clearRecentReceipts()`, limpando imagens em base64 e metadados de comprovantes bancários mantidos temporariamente em memória.
3. **Limpeza de Armazenamento Local Transitório:** Purgamento de chaves temporárias de fluxo em `sessionStorage` e remoção do identificador ativo em `localStorage` (`financas_active_user_id`).
4. **Purga de Caches de Dados:** `queryClient.clear()` expurga todas as queries em memória do TanStack Query.

### 3.4 Proteção contra Inatividade Web e Throttling contra Força Bruta
* **Timeout de Inatividade Web (`useIdleSessionTimeout`):**
  * Em sessões web (desktop/mobile browser), o hook escuta passivamente eventos de interação do usuário (`pointerdown`, `keydown`, `touchstart`, `scroll`).
  * Após 20 minutos sem interação, executa logout automático e redireciona para a tela de login com toast informativo: *"Sessão encerrada por inatividade para sua proteção."*
  * O timeout permanece inativo quando o app roda em ambiente nativo Android (onde o bloqueio biométrico `AppLock` cumpre este papel) ou quando em modo demonstração (`isDemoActive`).
* **Throttling e Backoff Exponencial no Login:**
  * O formulário de login (`login-page.tsx`) contabiliza falhas consecutivas de autenticação local:
    * 3 falhas seguidas: bloqueio temporário do botão Entrar por 15 segundos regressivos com cronômetro na UI.
    * 5 falhas seguidas: bloqueio por 60 segundos com aviso de proteção ativada.
    * Login bem-sucedido zera o contador imediatamente.
  * O Cloudflare Turnstile anti-bot atua em paralelo como desafio criptográfico de borda antes do envio da requisição.

### 3.5 Escudo do AppLock Nativo e Desconexão de Emergência
* Em dispositivos Android, o `AppLockOverlay` protege a tela contra visualização indevida via Biometria Nativa / Credencial do Sistema operacional.
* **Saída de Emergência:** Caso o sensor biométrico do smartphone apresente defeito físico, sujeira ou recusa de leitura, a tela de bloqueio disponibiliza a ação discreta *"Sair da conta e entrar com senha"*, permitindo que o usuário encerre a sessão local sem necessidade de reinstalar o aplicativo.

---

## 4. PRIVACIDADE AVANÇADA (LGPD) & MINIMIZAÇÃO DE PII

### 4.1 Minimização de PII na Telemetria de Erros (Sentry)
Em cumprimento ao princípio de Minimização de Dados da LGPD (Art. 6º, III):
* **Identificador Opaco:** A função `setObservabilityUser` em `src/services/observability.ts` transmite exclusivamente o identificador opaco `{ id: user.id }`. E-mails, nomes ou qualquer dado pessoal identificável nunca são enviados aos servidores de telemetria.
* **Sanitização de URLs e Payloads:** No hook `beforeSend` do Sentry, `event.request.url` e `event.request.query_string` são higienizados por `scrubSensitiveData`, mascarando tokens, hashes e parâmetros transitórios.

### 4.2 Trava de Confirmação de Segurança para Download de Backup
* O download do arquivo JSON completo com todo o histórico patrimonial e transacional do usuário (`ExportDataHub`) possui proteção ativa contra cliques não intencionais:
  * **No APK Nativo Android:** Exige autenticação biométrica do dispositivo via `authenticateWithBiometrics("Confirme sua identidade para exportar seus dados financeiros")`.
  * **Na Web:** Exibe diálogo modal com confirmação explícita de download de dados sensíveis.

### 4.3 Direito ao Esquecimento e Expurgo em Cascata (Art. 18, VI LGPD)
* A exclusão de conta solicitada pelo titular é processada pela RPC transacional `delete_current_user_account()`.
* A exclusão ocorre de forma atômica em cascata, eliminando registros de `public.profiles`, preferências, despesas, rendas, cartões, dívidas, metas de carteira, chamados de suporte (`support_tickets`, `support_ticket_replies`) e eventos analíticos, concluindo com o encerramento do registro em `auth.users`.

---

## 5. AUDITORIA E HIGIENIZAÇÃO DE LOGS (`audit_events`)

A tabela `public.audit_events` é imutável por construção (políticas RLS de apenas `INSERT` e `SELECT` pelo dono, sem `UPDATE` ou `DELETE`).

Para evitar que erros de programação gravem segredos operacionais na auditoria:
1. **Trigger `public.sanitize_audit_payload()`:** Executada `BEFORE INSERT` em `audit_events`.
2. **Mascaramento:** Se existir a chave `cpf` no objeto JSONB, ela é automaticamente convertida para o formato mascarado (`mask_cpf`).
3. **Redação:** Chaves como `password`, `token`, `secret`, `api_key`, `asaas_api_key`, `access_token` e `cvv` têm seus valores substituídos por `"[REDACTED]"`.

---

## 6. HIGIENIZAÇÃO DE BUILDS FRONTEND

O arquivo [`vite.config.ts`](../../vite.config.ts) aplica remoção automática de saídas de depuração no **minifier Oxc (Vite 8 / Rolldown)**:

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

## 7. CHECKLIST DE CONFORMIDADE PARA NOVAS FEATURES

Ao implementar novas telas, repositórios ou tabelas:
- [x] A nova tabela possui coluna `user_id uuid not null references public.profiles(id)`?
- [x] O RLS foi ativado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)?
- [x] Foram criadas políticas isoladas para `SELECT`, `INSERT`, `UPDATE` e `DELETE` baseadas em `auth.uid() = user_id`?
- [x] Nenhum dado de cartão de crédito além dos últimos 4 dígitos e da bandeira é persistido?
- [x] Nenhum log de dados sensíveis foi introduzido sem mascaramento?
- [x] Novas ações de alteração de credenciais exigem reautenticação atômica prévia (`verifyCurrentPassword`)?
- [x] Nenhuma informação de PII (e-mail, nome) é enviada em eventos de telemetria ou analytics?
- [x] Toda RPC pública desautenticada (`grant execute ... to anon`) possui blindagem contra DoS (teto de registros, deduplicação temporal, validação de token e sanitização estrita de payload)?
