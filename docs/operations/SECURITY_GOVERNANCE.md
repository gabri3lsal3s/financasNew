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
* **Proteção de PII de Contato (Telefone / WhatsApp — migração 000106):**
  * O número de telefone cadastrado no perfil (`public.profiles.phone`) possui `REVOKE SELECT (phone)` para `anon` e `authenticated`.
  * Nenhum endpoint REST público ou autenticado de cliente tem visibilidade sobre números de telefone de terceiros.
  * O acesso aos dados de contato por operadores da plataforma ocorre exclusivamente através da RPC com `SECURITY DEFINER` `public.admin_get_user_contact_details(p_user_id)`.
  * **Auditoria Compulsória:** A cada invocação da RPC por um administrador, um evento de auditoria imutável é gravado na tabela `public.audit_events` com ação `REVEAL_CONTACT_DETAILS`, registrando o ID do operador solicitante, o ID do usuário auditado e timestamp UTC em conformidade com a LGPD.

### 2.3 Edge Functions (billing, cotações, notificações e digests)
* **CORS allowlist:** Restrito exclusivamente a `axir.com.br`, `*.axir.com.br`, `financasnew.pages.dev`, `*.financasnew.pages.dev`, `ALLOWED_ORIGINS` configurados e esquemas locais/Capacitor — sem `Access-Control-Allow-Origin: *` em rotas sensíveis e sem permitir projetos arbitrários sob subdomínios de terceiros (`*.pages.dev` / `*.workers.dev`).
* **Proteção contra Side-Channel e Ataques de Temporização (Timing Attacks):** A função de utilidade criptográfica `timingSafeEqualString` (`supabase/functions/_shared/http.ts`) realiza pre-hashing das duas strings via SHA-256 gerando digests fixos de 32 bytes (256 bits) antes da comparação em tempo constante via XOR acumulativo. Isso elimina qualquer vazamento de informação por comprimento de string (*length leakage*) e anula a vulnerabilidade de *early-return*.
* **Proteção de Cron Jobs (`sunday-digest`):** A execução do digest semanal exige autenticação obrigatória via Bearer token validado contra `SUPABASE_SERVICE_ROLE_KEY` ou `CRON_SECRET`, impedindo exfiltração de dados transacionais e e-mails por chamadas públicas. A consulta a perfis referencia estritamente as colunas canônicas (`id, email, name`) em alinhamento ao schema do PostgreSQL.
* **Notificações de Suporte (`support-notify`):** Requisições com `payload.record` exigem validação de `x-webhook-secret` contra `WEBHOOK_SECRET` ou `SUPABASE_SERVICE_ROLE_KEY`, eliminando spoofing e spam na integração com Telegram.
* **Webhook Asaas:** `verify_jwt = false` + token `asaas-access-token` com comparação *timing-safe*; **sem** CORS de browser; tier resolvido estritamente pelo **catálogo determinístico de valores** (`asaas-plans.ts` com validação de `Number.isFinite` e `approxEqual`), impedindo bypass por valores nulos; sincronização automática de `asaas_subscription_id` para renovações recorrentes e registro de auditoria imutável em `audit_events`.
* **Checkout/manage Asaas:**
  * Validação prévia de CPF por **Módulo 11 oficial da Receita Federal** (`isValidCPF`) e checagem estrita de erro no update de perfil do Postgres;
  * Validação prévia de cartão de crédito via **Algoritmo de Luhn** (Mod 10) e checagem de data de expiração antes do despacho à API externa;
  * **Proteção Anti-Log PCI-DSS:** sanitização compulsória de payloads e mensagens de erro (`sanitizePaymentLog`), impedindo que números completos de cartão (PAN) ou códigos de segurança (CCV/CVV) apareçam em logs do runtime;
  * Exigem `SUPABASE_ANON_KEY` (fail-closed; **proibido** fallback para `service_role`); erros públicos genéricos;
  * Botões de teste e simulação de PIX restritos estritamente ao modo de desenvolvimento local (`import.meta.env.DEV`), eliminando exposição em produção.
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
  * O helper centralizado `src/services/app-url.ts` resolve links de autenticação (`/redefinir-senha`, `/entrar`, `/configuracoes`) e de compartilhamento (`/viagem`, `/r`, `/convite-familiar`, `/meta`):
    - **Navegador Web:** Adota dinamicamente a origem pública do domínio em acesso (`window.location.origin`), garantindo compatibilidade entre múltiplos ambientes e previews;
    - **APK Nativo Android:** Ignora origens internas locais (`https://localhost` e `capacitor://localhost`) e resolve deterministamente para o domínio oficial de produção **`https://axir.com.br`**.

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

### 4.3 Direito ao Esquecimento e Expurgo em Cascata Completo (Art. 18, VI LGPD)
* A exclusão de conta solicitada pelo titular é processada pela RPC transacional `delete_current_user_account()`.
* A exclusão ocorre de forma atômica em cascata topológica reversa (migrações 0061 e 0099), eliminando:
  * Histórico de viagens colaborativas (`trips`, `trip_members`, `trip_expenses`, `trip_expense_splits`, `trip_settlements`);
  * Orçamento e grupos familiares (`families`, `family_members`, `family_invites`, `family_settlements`);
  * Links e compartilhamentos públicos (`public_shares`);
  * Registros patrimoniais e operacionais (`expenses`, `incomes`, `credit_cards`, `debts`, `portfolio_transactions`, `portfolio_assets`, metas);
  * Preferências, perfis (`public.profiles`), chamados de suporte (`support_tickets`, `support_ticket_replies`) e eventos analíticos;
  * Conclusão atômica com encerramento e deleção do usuário em `auth.users`.

### 4.4 Mascaramento Canônico de PII (E-mail e CPF)
* A função SQL imutável `public.mask_email(text)` (migração 0099) mascara e-mails no padrão `g***s@dominio.com` em convites de família (`get_family_invite_preview`) e relatórios compartilhados, impedindo *data harvesting* por raspadores web.
* A função `public.mask_cpf(text)` garante mascaramento consistente do CPF (`***.***.789-**`).

---

## 5. DEFESA EM PROFUNDIDADE NO BANCO DE DADOS (POSTGRESQL & RLS)

### 5.1 `FORCE ROW LEVEL SECURITY` Seletivo
* Por padrão no PostgreSQL, comandos `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` não se aplicam ao proprietário da tabela (*table owner*).
* Para mitigar riscos decorrentes de migrações operacionais ou rotinas automatizadas que executem com privilégios de owner sem chave de isolamento de tenant, a migração `20260101000100_force_rls_critical_tables.sql` ativou `FORCE ROW LEVEL SECURITY` nas tabelas com dados financeiros críticos:
  * `public.expenses`
  * `public.incomes`
  * `public.credit_cards`
  * `public.debts`
  * `public.portfolio_transactions`
  * `public.portfolio_assets`
* Qualquer consulta SQL nessas tabelas obrigatoriamente satisfaz o filtro `auth.uid() = user_id`, sem exceções para o table owner.

### 5.2 Blindagem de Links Compartilhados (`public_shares`)
* A política `public_shares_select` foi revogada para a role `anon` e restrita exclusivamente ao proprietário autenticado (`auth.uid() = user_id`).
* O acesso de terceiros e convidados sem login é mediado **exclusivamente por RPCs com `SECURITY DEFINER` de retorno restrito** (`get_shared_family_budget`, `get_shared_goal_tracker`), impedindo dump em lote ou enumeração sequencial de links via API REST aberta.

### 5.3 Hardening de Viagens Colaborativas Desautenticadas
* A RPC `add_public_trip_expense` (migração 0099) exige parâmetro de senha (`p_passcode`) validado via algoritmo timing-safe com suporte a bcrypt `$2%` e texto claro.
* Impõe teto anti-DoS de no máximo 500 despesas por viagem, valor máximo defensivo de R$ 1.000.000,00 e descrição sanitizada com teto de 140 caracteres.

### 5.4 Particionamento Estrito de RLS em Viagens (`trip_expenses`)
* Anteriormente, a política `trip_expenses_write_policy` operava em modo `FOR ALL`, permitindo que qualquer convidado membro da viagem excluísse despesas de terceiros via requisição REST direta.
* A migração `20260101000102_harden_trip_expenses_delete_policy.sql` particionou a escrita em três políticas granulares:
  * `trip_expenses_insert_policy`: Inserção permitida a qualquer participante ativo da viagem (`is_trip_member` ou `is_trip_host`).
  * `trip_expenses_update_policy`: Edição restrita ao anfitrião ou ao titular que cadastrou/pagou a despesa.
  * `trip_expenses_delete_policy`: Exclusão via REST restrita estritamente ao anfitrião da viagem (`is_trip_host`) ou ao usuário pagador/criador (`auth.uid() = tm.user_id`). Convidados comuns têm o comando `DELETE` bloqueado no kernel do banco.

### 5.5 Auditoria Compulsória de RLS e Governança de Search Path (Migração 000111)
* **Auditoria de 100% das Tabelas (58 tabelas):** Suíte de testes automatizada (`src/tests/security-audit.test.ts`) valida continuamente a presença de `ENABLE ROW LEVEL SECURITY` em todas as 58 tabelas do banco de dados, falhando preventivamente caso qualquer tabela seja criada sem RLS.
* **Canonização de `search_path` em Funções Administrativas:** A função RPC de superadmin `admin_reset_user_mfa` foi canonizada com `set search_path = public, pg_temp`, eliminando schemas não controlados do caminho de resolução e prevenindo injeções de namespace (*schema shadowing*).
* **Defesa Adicional contra Contexto Nulo em Políticas de Escrita:** As políticas `broadcast_notifications_write` e `system_backups_admin_policy` (migração `20260101000111_security_hardening_audit.sql`) foram reforçadas com a cláusula explícita `and auth.uid() is not null`, garantindo que funções que dependem da identidade do operador nunca avaliem positivamente em estados anônimos transientes.

---

## 6. AUTENTICAÇÃO EM DUAS ETAPAS (2FA / TOTP) E CONTROLE DE SESSÕES

### 6.1 Suporte Nativo a TOTP via Supabase MFA
* Usuários podem elevar a segurança da conta ativando verificação em duas etapas via aplicativo autenticador RFC 6238 (Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden, Authy).
* O enrollment (`supabase.auth.mfa.enroll`) e verificação do primeiro fator (`supabase.auth.mfa.challengeAndVerify`) são gerenciados pelo modal canônico `<MfaModal />` (`src/features/settings/components/mfa-modal.tsx`).
* A renderização do QR Code utiliza gerador vetorial SVG local (`renderQrCodeSvg`), dispensando requisições a APIs de terceiros.

### 6.2 Interceptação Obrigatória de AAL2 na Tela de Login
* O cliente Supabase Auth emite tokens no nível de garantia de autenticação 1 (`aal1`) imediatamente após a conferência de e-mail e senha.
* O fluxo de login (`login-page.tsx`) inspeciona ativamente o nível de garantia via `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` tanto na montagem quanto após a autenticação por senha.
* Se a conta possuir um fator TOTP verificado e o nível requerido for `aal2` (`currentLevel === "aal1"` e `nextLevel === "aal2"`):
  * A navegação para o dashboard é interrompida.
  * A interface exibe a tela de desafio 2FA com campo de 6 dígitos numéricos e botões "Confirmar Acesso" e "Cancelar e voltar ao login" (que executa `signOut`).
  * A elevação para `aal2` só é concluída após resposta positiva de `supabase.auth.mfa.challengeAndVerify({ factorId, code })`.

### 6.3 Gestão de Dispositivos e Desconexão Remota
* O painel de conta (`AccountTab`) identifica o tipo de dispositivo atual (Web/Mobile/Desktop) e provê a ação *"Desconectar outros aparelhos"*.
* A desconexão remota utiliza `supabase.auth.signOut({ scope: "others" })`, invalidando imediatamente os refresh tokens emitidos para navegadores ou aparelhos secundários sem deslogar a sessão corrente do usuário.

---

## 7. AUDITORIA E HIGIENIZAÇÃO DE LOGS (`audit_events`)

A tabela `public.audit_events` é imutável por construção (políticas RLS de apenas `INSERT` e `SELECT` pelo dono, sem `UPDATE` ou `DELETE`).

Para evitar que erros de programação gravem segredos operacionais na auditoria:
1. **Trigger `public.sanitize_audit_payload()`:** Executada `BEFORE INSERT` em `audit_events`.
2. **Mascaramento:** Se existir a chave `cpf` no objeto JSONB, ela é automaticamente convertida para o formato mascarado (`mask_cpf`).
3. **Redação:** Chaves como `password`, `token`, `secret`, `api_key`, `asaas_api_key`, `access_token` e `cvv` têm seus valores substituídos por `"[REDACTED]"`.

---

## 8. HIGIENIZAÇÃO DE BUILDS FRONTEND

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

## 9. INGESTÃO SEGURA DE DOCUMENTOS E CABEÇALHOS DE BORDA

### 9.1 Validação e Limite de Upload em OCR (`receipt-extractor.ts`)
Para proteger o cliente e os motores de OCR contra ataques de negação de serviço (DoS por consumo de memória/OOM) e vetores de XSS via arquivos vetoriais:
* **Teto Estrito de Tamanho (`MAX_RECEIPT_FILE_SIZE_BYTES`):** Arquivos submetidos no diálogo de comprovantes têm teto máximo fixado em 15 MB. Arquivos maiores são rejeitados preventivamente na borda com toast informativo.
* **Bloqueio de SVGs e Executáveis:** O tipo MIME `image/svg+xml` é expressamente rejeitado, eliminando o vetor de scripts embutidos (`<script>` / SVG XSS).
* O processamento aceita exclusivamente formatos de imagem rasterizados (`image/jpeg`, `image/png`, `image/webp`) e documentos PDF (`application/pdf`).

### 9.2 Cabeçalhos HTTP de Segurança e Permissions-Policy (`_headers`)
No arquivo de cabeçalhos de borda do Cloudflare Pages (`public/_headers`), a diretiva `Permissions-Policy` desativa explicitamente APIs de hardware invasivas e tecnologias de rastreamento de terceiros:
```http
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), interest-cohort=()
```

---

## 10. CHECKLIST DE CONFORMIDADE PARA NOVAS FEATURES

Ao implementar novas telas, repositórios ou tabelas:
- [x] A nova tabela possui coluna `user_id uuid not null references public.profiles(id)`?
- [x] O RLS foi ativado (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)?
- [x] Tabelas patrimoniais críticas aplicam `FORCE ROW LEVEL SECURITY`?
- [x] Foram criadas políticas isoladas para `SELECT`, `INSERT`, `UPDATE` e `DELETE` baseadas em `auth.uid() = user_id`?
- [x] Nenhum dado de cartão de crédito além dos últimos 4 dígitos e da bandeira é persistido?
- [x] A tabela `public_shares` não permite leitura arbitrária por role anônima (`anon`) sem token pontual via RPC?
- [x] E-mails e CPFs de terceiros expostos em convites utilizam funções de mascaramento (`mask_email` / `mask_cpf`)?
- [x] A exclusão de dados respeita o expurgo topológico completo de `delete_current_user_account()`?
- [x] Nenhum log de dados sensíveis foi introduzido sem mascaramento?
- [x] Novas ações de alteração de credenciais exigem reautenticação atômica prévia (`verifyCurrentPassword`)?
- [x] Nenhuma informação de PII (e-mail, nome) é enviada em eventos de telemetria ou analytics?
- [x] Toda RPC pública desautenticada (`grant execute ... to anon`) possui blindagem contra DoS (teto de registros, deduplicação temporal, validação de token e sanitização estrita de payload)?
- [x] Toda Edge Function requer autenticação por Bearer token ou secret de webhook apropriado antes de expor dados operacionais?
- [x] A lista de CORS em Edge Functions restringe o acesso estritamente a origens autorizadas do projeto (`financasnew.pages.dev`)?
- [x] O fluxo de login intercepta `nextLevel === "aal2"` e exige código TOTP para contas com autenticação em duas etapas ativada?
- [x] Uploads de comprovantes validam o teto de tamanho (15 MB) e rejeitam SVGs?
- [x] O catálogo de planos valida estritamente o montante de PIX (`Number.isFinite` e `approxEqual`), impedindo ativações por valores nulos?
- [x] O checkout valida CPF por módulo 11 e cartões por algoritmo de Luhn e expiração antes do despacho à API?
- [x] Logs de pagamento sanitizam compulsóriamente números de cartão e CCV (`sanitizePaymentLog`) em conformidade com PCI-DSS?
- [x] Ações e webhooks do gateway financeiro sincronizam `subscriptionId` e registram trilha em `audit_events`?
- [x] Botões de teste e simulação de pagamento estão restritos ao ambiente de desenvolvimento (`import.meta.env.DEV`)?
- [x] Exportações Excel/XML e CSV sanitizam injeção de fórmulas DDE (`=`, `+`, `-`, `@`, `|`, `\t`, `\r`) e tratam espaços iniciais?
- [x] Políticas de RLS utilizam subquery escalar `(select auth.uid())` para caching de plano de execução (InitPlan)?
- [x] Aberturas de links externos via `window.open` incluem `noopener,noreferrer` contra tabnabbing?
- [x] Edge Functions com parâmetros de ticker validam regex estrito e impõem tetos defensivos de lote?

