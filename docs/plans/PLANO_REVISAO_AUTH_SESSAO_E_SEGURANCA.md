# PLANO DE IMPLEMENTAÇÃO: REVISÃO INTEGRAL DE AUTENTICAÇÃO, SESSÃO, SEGURANÇA E PROTEÇÃO DE DADOS

> **Documento Canônico:** `docs/plans/PLANO_REVISAO_AUTH_SESSAO_E_SEGURANCA.md` (acessível também via atalho `planos/PLANO_REVISAO_AUTH_SESSAO_E_SEGURANCA.md`)  
> **Modo de Execução:** Sequencial por Fases com Checklist e Portões de Qualidade (Quality Gates) Estritos.  
> **Status do Repositório:** Limpo (zero alterações de código em aberto antes do início).  
> **Aplicação:** Áxis Finance (Web, PWA e Android Pro).

---

## 1. Diretrizes Estratégicas & Decisões Consolidadas

1. **Blindagem contra Account Takeover**:
   - É **mandatório** exigir a **Senha Atual** do usuário autenticado antes de salvar qualquer nova senha ou solicitar alteração de e-mail na aba Minha Conta (`AccountTab`).
   - A reautenticação (`signInWithPassword` com a senha atual) deve ocorrer antes da chamada de mutação de credenciais no Supabase Auth.
2. **Sincronização Cadastral Bidirecional (PostgreSQL & Supabase Auth)**:
   - A tabela `public.profiles` espelha o e-mail do usuário cadastrado em `auth.users`.
   - É **mandatória** a criação de uma trigger PostgreSQL `AFTER UPDATE OF email ON auth.users` para sincronizar automaticamente `public.profiles.email`, eliminando inconsistências no painel administrativo `/admin`, suporte e relatórios.
3. **Resolução Universal de URLs de Retorno para Web & Mobile (Capacitor)**:
   - Proibido utilizar `${window.location.origin}` diretamente em `emailRedirectTo` e `redirectTo`, pois em ambientes nativos móveis o origin resolve como `capacitor://localhost` ou `http://localhost`, inutilizando os links recebidos no cliente de e-mail do smartphone.
   - Todo link transacional de e-mail deve passar pelo helper central [`getPublicAppUrl`](file:///home/gabrielsales/meus_apps/financasnew/src/lib/env.ts), apontando para a URL pública oficial do aplicativo (`https://axisfinance.app`).
4. **Proteção Anti-Bot & Anti-Força Bruta Real (Cloudflare Turnstile)**:
   - O widget `<Turnstile />` deve capturar o token de verificação e repassá-lo ativamente nos payloads de `signInWithEmail`, `signUpWithEmail` e `resetPasswordForEmail`.
   - O cabeçalho CSP em `public/_headers` deve autorizar explicitamente `challenges.cloudflare.com`.
5. **Conformidade Avançada LGPD & Minimização de Dados (Privacy by Design)**:
   - A telemetria de monitoramento de erros (Sentry) não deve enviar o endereço de e-mail em texto claro (`setObservabilityUser`), utilizando estritamente o identificador opaco anônimo (`id: user.id`).
   - A exportação de dados completos em JSON/CSV (`ExportDataHub`) passa a exigir confirmação de segurança (biometria ou senha).
   - O encerramento de sessão (`useSignOut` / `resetAppState`) deve desconectar todos os canais de WebSocket Realtime e purgar os buffers de comprovantes bancários em memória (`clearRecentReceipts()`).
6. **Proteção contra Inatividade na Web (Idle Session Timeout)**:
   - Usuários navegando em computadores desktop/laptops têm sua sessão protegida por um detector passivo de inatividade que encerra a sessão com segurança após 20 minutos de ausência de interação física.

---

## 2. Estrutura Canônica de Portões de Qualidade (Quality Gates)

Ao final de cada fase, antes de avançar para a seguinte, é obrigatório executar o checklist do **Portão de Qualidade**:

```bash
# 1. Verificação de Tipagem Estrita TypeScript (zero 'any', zero '@ts-ignore')
npm run typecheck

# 2. Verificação de Linter e Regras de Governança (zero emojis, zero controles nativos)
npm run lint

# 3. Execução dos Testes Automatizados da Fase
npm run test -- <caminho_dos_testes_afetados>

# 4. Commit Semântico e Push para Sincronização
git add .
git commit -m "<tipo>(<escopo>): <mensagem descritiva padronizada>"
git push origin main
```

---

## FASE 1: Blindagem dos Fluxos de Entrada (Login & Cadastro) e Proteção Anti-Bot Real

**Objetivo:** Autorizar o Cloudflare Turnstile no CSP, repassar o token de verificação anti-bot nos formulários de login e cadastro, adicionar confirmação de senha na criação de conta, normalizar e-mails e corrigir URLs de redirecionamento para Web e Android.

### Checklist de Tarefas da Fase 1

- [x] **Tarefa 1.1: Atualização do CSP em `public/_headers` para Cloudflare Turnstile**
  - **Arquivo:** `public/_headers`
  - **O que verificar/ajustar:**
    - Localizar a diretiva `Content-Security-Policy` (linha ~2).
    - Adicionar `https://challenges.cloudflare.com` em `script-src` e criar/ajustar `frame-src 'self' https://challenges.cloudflare.com`.
    - Garantir que `connect-src` inclua `https://challenges.cloudflare.com`.
    - Atualizar o teste de segurança de headers: `src/tests/security-headers.test.ts`.

- [x] **Tarefa 1.2: Criação do Helper Universal de URL Pública (`getPublicAppUrl`)**
  - **Arquivo:** `src/lib/env.ts` (ou `src/services/app-url.ts`)
  - **O que verificar/ajustar:**
    - Implementar a função pura:
      ```ts
      export function getPublicAppUrl(path = ""): string {
        const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL ?? "").trim();
        const base = publicSiteUrl || (typeof window !== "undefined" && window.location.origin.startsWith("http") && !window.location.origin.includes("localhost") ? window.location.origin : "https://axisfinance.app");
        const cleanBase = base.replace(/\/+$/, "");
        const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
        return `${cleanBase}${cleanPath}`;
      }
      ```
    - Criar teste colocalizado `src/services/app-url.test.ts` cobrindo cenários Web, Mobile e fallback.

- [x] **Tarefa 1.3: Normalização de E-mail e Sanitização Defensiva de Strings**
  - **Arquivo:** `src/domain/validation/sanitization.ts`
  - **O que verificar/ajustar:**
    - Exportar a função:
      ```ts
      export function normalizeEmail(email: string): string {
        if (typeof email !== "string") return "";
        return email.trim().toLowerCase();
      }
      ```
    - Atualizar `src/domain/validation/sanitization.test.ts` com testes para e-mails com espaços, maiúsculas e caracteres especiais válidos.

- [x] **Tarefa 1.4: Integração do `captchaToken` em `src/data/auth.ts`**
  - **Arquivo:** `src/data/auth.ts`
  - **O que verificar/ajustar:**
    - Atualizar a assinatura de `signInWithEmail`:
      ```ts
      export async function signInWithEmail(email: string, password: string, captchaToken?: string): Promise<void> {
        const normalized = normalizeEmail(email);
        const { error } = await getSupabase().auth.signInWithPassword({
          email: normalized,
          password,
          options: captchaToken ? { captchaToken } : undefined,
        });
        if (error) {
          const classified = classifyError(error);
          throw new AppError(classified.kind, classified.message, error);
        }
      }
      ```
    - Atualizar a assinatura de `signUpWithEmail`:
      ```ts
      export async function signUpWithEmail(
        email: string,
        password: string,
        name?: string,
        inviteCode?: string,
        captchaToken?: string,
      ): Promise<SignUpResult> {
        const normalized = normalizeEmail(email);
        const cleanName = name ? sanitizeString(name) : "";
        const cleanInvite = inviteCode ? sanitizeString(inviteCode).toUpperCase() : "";
        const { data, error } = await getSupabase().auth.signUp({
          email: normalized,
          password,
          options: {
            data: {
              name: cleanName,
              invite_code: cleanInvite,
            },
            emailRedirectTo: getPublicAppUrl("/entrar"),
            captchaToken: captchaToken || undefined,
          },
        });
        if (error) {
          const classified = classifyError(error);
          throw new AppError(classified.kind, classified.message, error);
        }
        if (
          data.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          throw new AppError("user-already-exists", MESSAGES["user-already-exists"], data.user);
        }
        return { needsEmailConfirmation: data.session === null };
      }
      ```
    - Atualizar testes em `src/data/auth.test.ts`.

- [x] **Tarefa 1.5: Adicionar Campo "Confirmar Senha" e Validação em `RegisterPage`**
  - **Arquivo:** `src/features/auth/pages/register-page.tsx`
  - **O que verificar/ajustar:**
    - Declarar estado `const [confirmPassword, setConfirmPassword] = useState("");`.
    - No `handleSubmit`, validar antes do envio:
      ```ts
      if (password !== confirmPassword) {
        setError("As senhas digitadas não coincidem.");
        triggerSensory("destructive");
        return;
      }
      ```
    - Inserir o campo `<PasswordInput id="register-confirm-password" />` após o campo de senha.
    - Capturar o token via `onVerify={(tok) => setCaptchaToken(tok)}` no `<Turnstile />`.
    - Passar o token para `signUpWithEmail(email, password, name, inviteCode, captchaToken)`.
    - Atualizar `src/features/auth/pages/register-page.test.tsx`.

- [x] **Tarefa 1.6: Captura do Token Turnstile em `LoginPage`**
  - **Arquivo:** `src/features/auth/pages/login-page.tsx`
  - **O que verificar/ajustar:**
    - Declarar `const [captchaToken, setCaptchaToken] = useState<string | null>(null);`.
    - No componente `<Turnstile onVerify={setCaptchaToken} />`, vincular o token.
    - No `handleSubmit`, passar o `captchaToken` para `signInWithEmail(email, password, captchaToken ?? undefined)`.
    - Atualizar `src/features/auth/pages/login-page.test.tsx`.

### Portão de Qualidade da Fase 1
- [x] Executar: `npm run typecheck`
- [x] Executar: `npm run lint`
- [x] Executar: `npx vitest run src/tests/security-headers.test.ts src/domain/validation/sanitization.test.ts src/data/auth.test.ts src/features/auth/pages/login-page.test.tsx src/features/auth/pages/register-page.test.tsx`
- [x] **Commit & Push da Fase 1:**
  ```bash
  git add public/_headers src/lib/env.ts src/services/app-url.ts src/services/app-url.test.ts src/domain/validation/sanitization.ts src/domain/validation/sanitization.test.ts src/data/auth.ts src/data/auth.test.ts src/features/auth/pages/login-page.tsx src/features/auth/pages/login-page.test.tsx src/features/auth/pages/register-page.tsx src/features/auth/pages/register-page.test.tsx
  git commit -m "feat(auth): reforca login e cadastro com confirmacao de senha captcha e normalizacao de dados"
  git push origin main
  ```

---

## FASE 2: Recuperação e Redefinição Segura de Senha (Forgot & Reset Password)

**Objetivo:** Blindar o fluxo de recuperação e redefinição de credenciais contra abuso de envio em massa, garantir redirecionamento funcional no mobile, higienizar tokens da barra de navegação pós-consumo e invalidar sessões ativas paralelas.

### Checklist de Tarefas da Fase 2

- [ ] **Tarefa 2.1: URL Pública Universal e Anti-Enumeração em `ForgotPasswordPage`**
  - **Arquivos:** `src/data/auth.ts`, `src/features/auth/pages/forgot-password-page.tsx`
  - **O que verificar/ajustar:**
    - Em `resetPasswordForEmail` (`src/data/auth.ts`), utilizar `redirectTo: getPublicAppUrl("/redefinir-senha")` e normalizar com `normalizeEmail(email)`.
    - Suportar repasse de `captchaToken` nas opções de `resetPasswordForEmail`.
    - Em `ForgotPasswordPage`:
      - Declarar estado `const [captchaToken, setCaptchaToken] = useState<string | null>(null);`.
      - Adicionar cooldown de 60 segundos após cada envio para impedir floods de requisições.
      - Garantir que a mensagem de sucesso seja neutra e institucional: *"Se o endereço estiver cadastrado, você receberá um link de redefinição em instantes."*.
    - Atualizar `src/features/auth/pages/forgot-password-page.test.tsx`.

- [ ] **Tarefa 2.2: Higienização de Tokens da URL e Invalidação Pós-Reset (`ResetPasswordPage`)**
  - **Arquivo:** `src/features/auth/pages/reset-password-page.tsx`
  - **O que verificar/ajustar:**
    - Ao capturar o evento `PASSWORD_RECOVERY` ou ao inicializar com hash/query de recuperação, higienizar imediatamente o histórico do browser:
      ```ts
      if (typeof window !== "undefined" && (window.location.hash || window.location.search)) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      ```
    - Após invocar `updateUserPassword(newPassword)`, invalidar outras sessões ativas no Supabase para proteção contra dispositivos roubados ou sessões órfãs:
      ```ts
      try {
        const supabase = getSupabase();
        await supabase.auth.signOut({ scope: "others" });
      } catch {
        // fail-safe
      }
      ```
    - Atualizar `src/features/auth/pages/reset-password-page.test.tsx`.

### Portão de Qualidade da Fase 2
- [ ] Executar: `npm run typecheck`
- [ ] Executar: `npm run lint`
- [ ] Executar: `npx vitest run src/features/auth/pages/forgot-password-page.test.tsx src/features/auth/pages/reset-password-page.test.tsx`
- [ ] **Commit & Push da Fase 2:**
  ```bash
  git add src/data/auth.ts src/features/auth/pages/forgot-password-page.tsx src/features/auth/pages/forgot-password-page.test.tsx src/features/auth/pages/reset-password-page.tsx src/features/auth/pages/reset-password-page.test.tsx
  git commit -m "feat(auth): blinda recuperacao e redefinicao de senha com limpeza de url e anti-enumeracao"
  git push origin main
  ```

---

## FASE 3: Alteração Segura de Senha e Proteção contra Account Takeover (Minha Conta)

**Objetivo:** Eliminar a vulnerabilidade crítica de sequestro de conta (Account Takeover) na aba de configurações, exigindo obrigatoriamente a comprovação da senha atual antes de salvar qualquer nova senha.

### Checklist de Tarefas da Fase 3

- [ ] **Tarefa 3.1: Implementação da Reautenticação Prévia em `src/data/auth.ts`**
  - **Arquivo:** `src/data/auth.ts`
  - **O que verificar/ajustar:**
    - Criar e exportar a função de validação de senha:
      ```ts
      export async function verifyCurrentPassword(password: string): Promise<boolean> {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
          throw new AppError("session-expired", MESSAGES["session-expired"]);
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        });
        return !error;
      }
      ```
    - Criar a função orquestrada `changeUserPassword(currentPassword: string, newPassword: string): Promise<void>`:
      ```ts
      export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
        const isValid = await verifyCurrentPassword(currentPassword);
        if (!isValid) {
          throw new AppError("invalid-credentials", "A senha atual informada está incorreta.");
        }
        await updateUserPassword(newPassword);
      }
      ```
    - Atualizar testes em `src/data/auth.test.ts`.

- [ ] **Tarefa 3.2: Formulário de Senha com Campo "Senha Atual" em `AccountTab`**
  - **Arquivo:** `src/features/settings/components/tabs/account-tab.tsx`
  - **O que verificar/ajustar:**
    - Declarar estado `const [currentPassword, setCurrentPassword] = useState("");`.
    - No formulário do Card 2 (Segurança & Senha), incluir o campo de Senha Atual:
      ```tsx
      <div className="space-y-1.5">
        <label htmlFor="account-current-password" className="text-xs font-semibold text-foreground">
          Senha atual
        </label>
        <PasswordInput
          id="account-current-password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            if (passwordError) setPasswordError(null);
          }}
          placeholder="Digite sua senha atual"
          className="h-10 text-sm rounded-xl"
        />
      </div>
      ```
    - Estruturar os campos em grid responsivo (`grid grid-cols-1 sm:grid-cols-2 gap-3.5`).
    - No `handleUpdatePassword`, invocar `changeUserPassword(currentPassword, newPassword)`.
    - Limpar os três campos de senha após salvar com sucesso e emitir feedback sensorial e toast de sucesso.
    - Atualizar `src/features/settings/components/tabs/account-tab.test.tsx`.

### Portão de Qualidade da Fase 3
- [ ] Executar: `npm run typecheck`
- [ ] Executar: `npm run lint`
- [ ] Executar: `npx vitest run src/data/auth.test.ts src/features/settings/components/tabs/account-tab.test.tsx`
- [ ] **Commit & Push da Fase 3:**
  ```bash
  git add src/data/auth.ts src/data/auth.test.ts src/features/settings/components/tabs/account-tab.tsx src/features/settings/components/tabs/account-tab.test.tsx
  git commit -m "security(auth): exige senha atual na alteracao de credenciais prevenindo account takeover"
  git push origin main
  ```

---

## FASE 4: Fluxo de Alteração de E-mail e Sincronização Automática com `public.profiles`

**Objetivo:** Permitir que o usuário solicite a troca de e-mail com reautenticação prévia, confirmação por link duplo e sincronização imediata no banco de dados via trigger PostgreSQL entre `auth.users` e `public.profiles`.

### Checklist de Tarefas da Fase 4

- [ ] **Tarefa 4.1: Criação da Migração PostgreSQL para Sincronização de E-mail**
  - **Arquivo:** `supabase/migrations/20260101000064_sync_profile_email_on_auth_change.sql`
  - **O que verificar/ajustar:**
    - Criar o arquivo de migração contendo a trigger de atualização atômica:
      ```sql
      -- ================================================================
      -- 0064_sync_profile_email_on_auth_change.sql
      -- Sincronização automática de e-mail entre auth.users e public.profiles
      -- ================================================================

      create or replace function public.handle_user_email_updated()
      returns trigger
      language plpgsql
      security definer
      set search_path = public, pg_temp
      as $$
      begin
        if old.email is distinct from new.email then
          update public.profiles
          set email = new.email
          where id = new.id;
        end if;
        return new;
      end;
      $$;

      comment on function public.handle_user_email_updated() is
        'Sincroniza automaticamente a coluna email de public.profiles quando o e-mail for atualizado e confirmado em auth.users.';

      drop trigger if exists on_auth_user_email_updated on auth.users;
      create trigger on_auth_user_email_updated
        after update of email on auth.users
        for each row
        execute function public.handle_user_email_updated();
      ```

- [ ] **Tarefa 4.2: Implementação da Função `requestUserEmailChange` em `src/data/auth.ts`**
  - **Arquivo:** `src/data/auth.ts`
  - **O que verificar/ajustar:**
    - Implementar a função com normalização e reautenticação:
      ```ts
      export async function requestUserEmailChange(currentPassword: string, newEmail: string): Promise<void> {
        const normalized = normalizeEmail(newEmail);
        const isValid = await verifyCurrentPassword(currentPassword);
        if (!isValid) {
          throw new AppError("invalid-credentials", "A senha atual informada está incorreta.");
        }
        const { error } = await getSupabase().auth.updateUser(
          { email: normalized },
          { emailRedirectTo: getPublicAppUrl("/configuracoes?tab=conta") },
        );
        if (error) {
          const classified = classifyError(error);
          throw new AppError(classified.kind, classified.message, error);
        }
      }
      ```
    - Atualizar testes em `src/data/auth.test.ts`.

- [ ] **Tarefa 4.3: Diálogo Modal de Alteração de E-mail em `AccountTab`**
  - **Arquivo:** `src/features/settings/components/tabs/account-tab.tsx`
  - **O que verificar/ajustar:**
    - No Card 1 (Dados Pessoais), adicionar botão *"Alterar e-mail"* ao lado do badge de verificado.
    - Implementar modal `<Modal>` com `size="md"` contendo:
      - Campo de Novo E-mail.
      - Campo de Senha Atual para autenticar a solicitação.
      - Aviso explicativo sobre envio de links de confirmação.
      - Botões Cancelar e Confirmar.
    - Tratar estados de loading, erro e toast de sucesso informando que o link foi enviado ao novo e-mail.
    - Atualizar `src/features/settings/components/tabs/account-tab.test.tsx`.

### Portão de Qualidade da Fase 4
- [ ] Executar: `npm run typecheck`
- [ ] Executar: `npm run lint`
- [ ] Executar: `npx vitest run src/data/auth.test.ts src/features/settings/components/tabs/account-tab.test.tsx`
- [ ] **Commit & Push da Fase 4:**
  ```bash
  git add supabase/migrations/20260101000064_sync_profile_email_on_auth_change.sql src/data/auth.ts src/data/auth.test.ts src/features/settings/components/tabs/account-tab.tsx src/features/settings/components/tabs/account-tab.test.tsx
  git commit -m "feat(auth): disponibiliza fluxo de alteracao de e-mail com reautenticacao e trigger no banco"
  git push origin main
  ```

---

## FASE 5: Governança de Sessão, Desconexão Completa (Logout) e Isolamento de Memória

**Objetivo:** Garantir encerramento absoluto de conexões (WebSockets Realtime, caches em memória, storage transitório e buffers de OCR), habilitar PKCE estrito no cliente Supabase e fornecer saída de emergência no AppLock nativo.

### Checklist de Tarefas da Fase 5

- [ ] **Tarefa 5.1: Expansão do Gateway de Limpeza de Sessão (`resetAppState`)**
  - **Arquivos:** `src/services/auth-cleanup.ts`, `src/services/native/suggestions-store.ts`
  - **O que verificar/ajustar:**
    - Desconectar ativamente todos os canais de Realtime do Supabase:
      ```ts
      try {
        const supabase = getSupabase();
        void supabase.removeAllChannels();
      } catch {
        // no-op em ambientes de teste
      }
      ```
    - Purgar o buffer volátil de comprovantes bancários chamando `clearRecentReceipts()`.
    - Limpar registros temporários em `sessionStorage` que possam conter resíduos de checkout ou parâmetros transitórios.
    - Atualizar testes em `src/services/auth-cleanup.test.ts`.

- [ ] **Tarefa 5.2: Ativação Estrita de PKCE no Cliente Supabase**
  - **Arquivo:** `src/data/client.ts`
  - **O que verificar/ajustar:**
    - Configurar explicitamente `flowType: "pkce"` nas opções de autenticação do `createClient`:
      ```ts
      client = createClient<Database, "public">(url, anonKey, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }) as Supabase;
      ```

- [ ] **Tarefa 5.3: Aprimoramento do Escudo do AppLock Mobile com Opção de Desconexão de Emergência**
  - **Arquivo:** `src/app/app-lock-overlay.tsx`
  - **O que verificar/ajustar:**
    - Adicionar na tela de bloqueio biométrico um botão discreto *"Sair da conta e entrar com senha"*, permitindo que o usuário encerre a sessão caso o sensor biométrico do smartphone apresente falha de hardware.
    - Atualizar `src/app/app-lock-overlay.test.tsx`.

### Portão de Qualidade da Fase 5
- [ ] Executar: `npm run typecheck`
- [ ] Executar: `npm run lint`
- [ ] Executar: `npx vitest run src/services/auth-cleanup.test.ts src/hooks/use-sign-out.test.ts src/app/app-lock-overlay.test.tsx`
- [ ] **Commit & Push da Fase 5:**
  ```bash
  git add src/services/auth-cleanup.ts src/services/auth-cleanup.test.ts src/data/client.ts src/app/app-lock-overlay.tsx src/app/app-lock-overlay.test.tsx
  git commit -m "security(session): habilita pkce estrito desconecta realtime no logout e limpa memoria de comprovantes"
  git push origin main
  ```

---

## FASE 6: Proteção contra Inatividade na Web (Idle Session Timeout) e Throttling contra Força Bruta

**Objetivo:** Proteger usuários que acessam o sistema via navegadores desktop/laptops contra exposição por inatividade prolongada e mitigar ataques repetitivos de força bruta local com backoff exponencial.

### Checklist de Tarefas da Fase 6

- [ ] **Tarefa 6.1: Implementação do Hook de Inatividade Web (`useIdleSessionTimeout`)**
  - **Arquivo:** `src/hooks/use-idle-session-timeout.ts`
  - **O que verificar/ajustar:**
    - Criar hook que escuta eventos de atividade do usuário (`pointerdown`, `keydown`, `touchstart`, `scroll`) de forma não obstrutiva e passiva (`{ passive: true }`).
    - Configurar tempo limite seguro de inatividade de 20 minutos (inativo na web).
    - Quando o tempo expirar em ambiente Web com usuário logado:
      - Desconecta suavemente invocando `signOut()` com notificação discreta: *"Sessão encerrada por inatividade para sua proteção."*
    - Desabilitar o timeout quando o app estiver em modo de demonstração (`isDemoActive`) ou executando em ambiente nativo Android (onde o `AppLock` com biometria já cumpre este papel).
    - Integrar o hook no shell de rotas autenticadas em `src/app/router.tsx`.
    - Criar testes colocalizados `src/hooks/use-idle-session-timeout.test.ts`.

- [ ] **Tarefa 6.2: Mecanismo de Backoff Exponencial no Cliente contra Força Bruta**
  - **Arquivo:** `src/features/auth/pages/login-page.tsx`
  - **O que verificar/ajustar:**
    - Controlar o número de falhas consecutivas de autenticação na sessão ativa.
    - Se o usuário falhar 3 vezes seguidas: impor atraso/bloqueio temporário de 15 segundos no botão Entrar com contador visual regressivo.
    - Se falhar 5 vezes seguidas: impor atraso de 60 segundos com aviso de proteção ativa.
    - Resetar as contagens em caso de login bem-sucedido.
    - Atualizar testes em `login-page.test.tsx`.

### Portão de Qualidade da Fase 6
- [ ] Executar: `npm run typecheck`
- [ ] Executar: `npm run lint`
- [ ] Executar: `npx vitest run src/hooks/use-idle-session-timeout.test.ts src/features/auth/pages/login-page.test.tsx`
- [ ] **Commit & Push da Fase 6:**
  ```bash
  git add src/hooks/use-idle-session-timeout.ts src/hooks/use-idle-session-timeout.test.ts src/app/router.tsx src/features/auth/pages/login-page.tsx src/features/auth/pages/login-page.test.tsx
  git commit -m "security(web): adiciona timeout de inatividade para web e backoff exponencial contra forca bruta"
  git push origin main
  ```

---

## FASE 7: Privacidade Avançada (LGPD), Minimização de PII em Telemetria e Proteção de Backup

**Objetivo:** Elevar a conformidade com a LGPD e privacidade por design, eliminando e-mails em texto claro da telemetria de erros (Sentry), higienizando URLs de requisição e adicionando trava de segurança para download de backup financeiro.

### Checklist de Tarefas da Fase 7

- [ ] **Tarefa 7.1: Minimização e Anonimização de PII na Telemetria de Erros (`setObservabilityUser`)**
  - **Arquivo:** `src/services/observability.ts`
  - **O que verificar/ajustar:**
    - Modificar `setObservabilityUser` para enviar exclusivamente o identificador anônimo (`id: user.id`), eliminando o envio do e-mail do usuário em texto claro para servidores externos do Sentry:
      ```ts
      export async function setObservabilityUser(user: { id: string; email?: string | null } | null): Promise<void> {
        if (!sentryDsn()) return;
        await initObservability();
        const Sentry = await import("@sentry/react");
        if (user === null) {
          Sentry.setUser(null);
          return;
        }
        // LGPD Privacy by Design: correlaciona apenas por UUID opaco sem expor e-mail pessoal
        Sentry.setUser({ id: user.id });
      }
      ```
    - No hook `beforeSend` do Sentry, incluir a higienização de URLs de requisição (`event.request?.url` e `event.request?.query_string`) via `scrubSensitiveData`.
    - Atualizar testes em `src/services/observability.test.ts`.

- [ ] **Tarefa 7.2: Trava de Confirmação de Segurança para Download de Backup Completo**
  - **Arquivos:** `src/components/modules/export-data-hub.tsx`, `src/features/settings/components/tabs/security-tab.tsx`
  - **O que verificar/ajustar:**
    - Antes de iniciar a geração e download do arquivo JSON de backup completo com todas as transações da vida financeira do usuário, exibir modal de confirmação de segurança.
    - Em ambiente nativo móvel: solicitar confirmação biométrica rápida via `authenticateWithBiometrics("Confirme sua identidade para exportar seus dados financeiros")`.
    - Na Web: exibir modal com confirmação explícita de download seguro.
    - Atualizar testes em `src/components/modules/export-data-hub.test.tsx`.

- [ ] **Tarefa 7.3: Auditoria do Procedimento de Expurgo em Cascata LGPD (`delete_current_user_account`)**
  - **Arquivo:** `supabase/migrations/20260101000061_delete_user_account_rpc.sql`
  - **O que verificar/ajustar:**
    - Confirmar que todas as tabelas recentes (`support_tickets`, `support_ticket_replies`, etc.) possuem `on delete cascade` ou remoção explícita, garantindo que o Direito ao Esquecimento (Art. 18, VI da LGPD) opere de forma atômica e 100% limpa.

### Portão de Qualidade da Fase 7
- [ ] Executar: `npm run typecheck`
- [ ] Executar: `npm run lint`
- [ ] Executar: `npx vitest run src/services/observability.test.ts src/components/modules/export-data-hub.test.tsx`
- [ ] **Commit & Push da Fase 7:**
  ```bash
  git add src/services/observability.ts src/services/observability.test.ts src/components/modules/export-data-hub.tsx src/components/modules/export-data-hub.test.tsx
  git commit -m "privacy(lgpd): minimiza telemetria no sentry e adiciona trava de seguranca para exportacao de backup"
  git push origin main
  ```

---

## FASE 8: Auditoria Integrada, Revisão Documental, Build do APK & Notificação Executiva via ARGOS (Telegram)

**Objetivo:** Executar auditoria de regressão transversal completa, validar todos os fluxos de auth/segurança, atualizar os documentos de governança, compilar os artefatos de produção Web e APK Android, realizar commit/push final e despachar relatório executivo formal ao fundador via Bot ARGOS com parecer de migração Supabase.

### Checklist de Tarefas da Fase 8

- [ ] **Tarefa 8.1: Varredura de Qualidade Transversal e Correção de Fragilidades Residuais**
  - Executar: `npm run typecheck` (zero erros de tipagem TypeScript estrita).
  - Executar: `npm run lint` (zero erros de lint, emojis ou controles nativos não padronizados).
  - Executar suíte completa de testes: `npm run test`.
  - **Ação corretiva imediata:** Caso qualquer teste falhe ou surja regressão de interface em mobile/desktop, aplicar a correção no código e retestar até aprovação integral (100% verde).

- [ ] **Tarefa 8.2: Atualização dos Documentos de Governança & Arquitetura**
  - Atualizar `docs/operations/SECURITY_GOVERNANCE.md` documentando a política de reautenticação obrigatória com senha atual, PKCE estrito, timeout de inatividade e minimização de PII na telemetria.
  - Atualizar `docs/architecture/ESPECIFICACAO_TECNICA.md` registrando as novas diretrizes do fluxo de auth, cadastro e alteração de e-mail.
  - Atualizar `docs/roadmap/ROADMAP.md` e o presente plano marcando todos os itens como concluídos.

- [ ] **Tarefa 8.3: Compilação Web de Produção e Sincronização Capacitor**
  - Compilar o bundle web:
    ```bash
    npm run build
    ```
    - Conferir integridade dos assets e inexistência de chunks órfãos em `dist/`.
  - Sincronizar assets e plugins no container nativo:
    ```bash
    npx cap sync android
    ```

- [ ] **Tarefa 8.4: Compilação dos APKs Android de Produção (Debug & Release Assinado)**
  - Executar script oficial de automação:
    ```bash
    ./scripts/build-apk.sh
    ```
  - Verificar:
    - Geração do APK assinado em `dist-apk/guia-financeiro-release.apk` e `dist-apk/axis-pro.apk`.
    - Geração do manifesto de versão e hashes SHA-256 em `dist-apk/version.json` e `public/releases/version.json`.

- [ ] **Tarefa 8.5: Commit e Push Final da Homologação**
  - Executar:
    ```bash
    git add .
    git commit -m "chore(release): homologa revisao integral de auth seguranca privacidade e geracao de apk release"
    git push origin main
    ```

- [ ] **Tarefa 8.6: Despacho do Relatório Executivo ao Fundador via Bot ARGOS (Telegram)**
  - Disparar mensagem formatada ao canal do fundador via API do Telegram ou script `scripts/notify-telegram.ts`.
  - **Conteúdo Mandatório do Relatório ARGOS:**
    1. **Identificação:** `[ARGOS] Relatório Executivo — Revisão Integral de Autenticação, Segurança & Privacidade LGPD`.
    2. **Status Geral:** Concluído com sucesso (100% verde em todos os 8 Quality Gates).
    3. **Resumo das Entregas Consolidadas:**
       - Blindagem contra Account Takeover: exigência obrigatória de Senha Atual antes de alterar credenciais.
       - Fluxo de Alteração de E-mail com reautenticação prévia e modal seguro no app.
       - Confirmação de senha na tela de cadastro e Turnstile anti-bot real integrado aos endpoints.
       - Correção universal de links de e-mail para Web e Android (`getPublicAppUrl`).
       - PKCE estrito e desconexão total de canais Realtime no logout.
       - Limpeza de buffer de comprovantes bancários na memória pós-desconexão.
       - Timeout de inatividade de 20 minutos na Web para prevenção contra acessos físicos indevidos.
       - Minimização estrita de PII na telemetria Sentry (apenas UUID opaco sem e-mail).
       - Trava de confirmação de segurança para download de backup financeiro completo.
       - Build Web e APK Release Android assinados e prontos para produção.
    4. **Métricas de Validação Técnica:**
       - Typecheck: 100% OK.
       - Lint: 100% OK (sem emojis, sem controles nativos).
       - Testes Unitários & Integração: 100% aprovados.
       - Build Web & APK Release Android: Compilados com sucesso.
    5. **Parecer Formal sobre Migrações no Supabase:**
       - **PARECER:** **1 NOVA MIGRAÇÃO PREPARADA:** `20260101000064_sync_profile_email_on_auth_change.sql`.
       - *Justificativa técnica*: Cria a trigger `on_auth_user_email_updated` em `auth.users` para garantir que `public.profiles.email` seja sincronizado automaticamente sempre que o usuário confirmar a alteração do seu e-mail, mantendo a base 100% íntegra sem qualquer downtime.
  - **Exemplo de Comando de Despacho (via `scripts/notify-telegram.ts` ou curl):**
    ```bash
    npx tsx scripts/notify-telegram.ts --type deploy --msg "<b>ARGOS: Relatório Executivo — Revisão de Autenticação, Segurança &amp; Privacidade</b>%0A%0A<b>Status:</b> Concluído com 100% de Aprovação nos 8 Quality Gates.%0A%0A<b>Principais Entregas:</b>%0A• Exigência de senha atual na troca de senha (proteção contra Account Takeover)%0A• Novo fluxo de alteração de e-mail com reautenticação e diálogo seguro%0A• Campo de confirmação de senha no cadastro e Turnstile anti-bot%0A• Resolução de URLs públicas para e-mails mobile (getPublicAppUrl)%0A• PKCE estrito e desconexão total de canais Realtime no logout%0A• Timeout de inatividade de 20 minutos na Web%0A• Minimização de dados no Sentry (apenas UUID anônimo)%0A• Trava de segurança para download de backup financeiro%0A• Build Web e APK Android release compilados com sucesso%0A%0A<b>Parecer Supabase:</b> 1 nova migração preparada (20260101000064_sync_profile_email_on_auth_change.sql) para sincronização automática de e-mail entre auth.users e profiles." --force
    ```

### Portão de Qualidade Final da Fase 8
- [ ] 100% da suíte de testes passando sem erros.
- [ ] Bundle web e APK Android release gerados e validados com SHA-256 e `version.json`.
- [ ] Documentação técnica e de segurança atualizada.
- [ ] Notificação Telegram entregue pelo bot ARGOS com o relatório executivo e parecer formal Supabase.
- [ ] Repositório sincronizado no GitHub (`git push origin main`).
