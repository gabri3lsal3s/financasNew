# 🏛️ PLANO MESTRE 21 — Refatoração do Módulo Administrativo, Login Exclusivo, Governança de Backups, Controle do APK Beta e Notificações Push

> **Status:** 📋 Proposto / Aguardando Execução  
> **Prioridade:** Alta (Reta Final de Fechamento de Release & Governança de Produção)  
> **Documentos de Referência:** [`AGENTS.md`](../../AGENTS.md) · [`SECURITY_GOVERNANCE.md`](../operations/SECURITY_GOVERNANCE.md) · [`FOUNDER_RUNBOOK.md`](../operations/FOUNDER_RUNBOOK.md) · [`ESPECIFICACAO_TECNICA.md`](../architecture/ESPECIFICACAO_TECNICA.md)

---

## 1. VISÃO GERAL & OBJETIVOS ESTRATÉGICOS

Este plano estabelece a reformulação completa do **Módulo Administrativo do Áxis Finance**, transformando a administração em um **Console Operacional Dedicado ("Áxis Command Center")**, isolado do fluxo de finanças pessoais do cliente comum. 

### Principais Pilares da Entrega:
1. **Portal de Login Administrativo Isolado (`/admin/login`):** Tela exclusiva de login com autenticação restrita, proteção agressiva contra força bruta, desafio anti-bot Cloudflare Turnstile, exigência de 2FA/TOTP e bloqueio imediato (*fail-closed*) de contas sem privilégios administrativos.
2. **Shell Administrativo Exclusivo (`AdminShell`):** Layout corporativo próprio desacoplado do `PageShell`, sem calculadoras flutuantes, barras de navegação de finanças pessoais ou menus comuns.
3. **Controle de Acesso ao APK Nativo (Beta Fechado para Free e Pro):** Capacidade administrativa em tempo real de habilitar ou desabilitar o acesso ao aplicativo Android nativo (APK) para contas do modo Free e/ou Pro, exibindo tela explicativa com redirecionamento para o Web/PWA quando bloqueado.
4. **Criptografia e Proteção de Dados de Clientes no BD (LGPD):** Criptografia de dados de identificação e contato (Telefone/WhatsApp, CPF, dados sensíveis) no banco de dados com acesso autenticado exclusivo para operadores autorizados via RPC auditada e mascaramento canônico.
5. **Sistema de Broadcast & Notificações Push:** Central de notificações permitindo disparar comunicados e avisos diretamente pelo app para todos os clientes, segmentados por plano (Free/Pro) ou selecionando usuários específicos, com rastreamento de leitura.
6. **Central de Backups da Plataforma & Continuidade de Negócios (DRP):** Gestão de snapshots do banco de dados, geração manual/agendada, cálculo criptográfico de hash de integridade SHA-256, histórico auditável de backups e guia operacional de recuperação de desastres.

---

## 2. ARQUITETURA DE ROTAS E MÓDULOS

```
                               ┌─────────────────────────┐
                               │     ROTEADOR GLOBAL     │
                               └────────────┬────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
       ┌───────────────────────────┐                 ┌───────────────────────────┐
       │     PORTAL DO CLIENTE     │                 │   ÁXIS ADMIN CONSOLE      │
       │   (/, /transacoes, etc.)  │                 │        (/admin/*)         │
       ├───────────────────────────┤                 ├───────────────────────────┤
       │ • Login: /entrar          │                 │ • Login: /admin/login     │
       │ • Shell: PageShell        │                 │ • Shell: AdminShell       │
       │ • Finanças Pessoais       │                 │ • Painel de Governança    │
       │ • Menu Mobile & BottomNav │                 │ • Sidebar Executiva       │
       │ • Calculadora Flutuante   │                 │ • Telemetria de Produção  │
       └───────────────────────────┘                 └───────────────────────────┘
```

### 2.1 Mapeamento de Rotas Administrativas

| Rota | Componente | Descrição / Permissão |
|---|---|---|
| `/admin/login` | `AdminLoginPage` | Portal exclusivo de login do administrador com credenciais dedicadas. |
| `/admin` | `Navigate to="/admin/dashboard"` | Redirecionamento canônico da raiz do painel administrativo. |
| `/admin/dashboard` | `AdminDashboardPage` | Visão Geral, telemetria de produção, métricas de negócio e status dos serviços. |
| `/admin/usuarios` | `AdminUsersPage` | Gestão 360° de usuários, CRM, permissões modulares e dados de contato criptografados. |
| `/admin/faturamento` | `AdminBillingPage` | Assinaturas Asaas, recebíveis, inadimplência e logs de webhook. |
| `/admin/chamados` | `AdminTicketsPage` | Central de Helpdesk, chamados de suporte, notas internas e SLA de atendimento. |
| `/admin/convites` | `AdminInvitesPage` | Gestão de tokens de convite, cotas, validade e allowlist. |
| `/admin/notificacoes` | `AdminNotificationsPage` | Disparo de mensagens push e avisos in-app (em massa ou direcionados). |
| `/admin/seguranca` | `AdminSecurityPage` | Trilha de auditoria imutável (`audit_events`) e console DPO / LGPD. |
| `/admin/backups` | `AdminBackupsPage` | Central de backups do banco, snapshots sob demanda, validação SHA-256 e DRP. |
| `/admin/configuracoes` | `AdminSettingsPage` | Feature flags, kill-switches globais, controle do APK e modo manutenção. |

---

## 3. FASES DE IMPLEMENTAÇÃO E TAREFAS DETALHADAS

### FASE 1 — Infraestrutura de Dados, Criptografia e Políticas (Backend)
- [ ] **Tarefa 1.1:** Criar migration PostgreSQL para o controle de acesso ao APK Nativo:
  - Adicionar as chaves de feature global `apk_access_free` e `apk_access_pro` na tabela `system_features`.
- [ ] **Tarefa 1.2:** Estruturar a criptografia e armazenamento seguro de dados de contato (LGPD):
  - Adicionar colunas `phone` (telefone/WhatsApp de contato) e metadados de contato em `public.profiles`.
  - Criar RPC `admin_get_user_contact_details(p_user_id uuid)` restrita a `role in ('admin', 'superadmin')` com registro imutável em `audit_events` a cada visualização de dados não mascarados (princípio do Menor Privilégio e Auditoria LGPD).
- [ ] **Tarefa 1.3:** Criar estrutura do Sistema de Notificações Push & Broadcast:
  - Tabela `public.admin_broadcast_notifications`: `id`, `title`, `message`, `type`, `action_url`, `target_audience`, `target_user_ids`, `created_by`, `created_at`.
  - Tabela `public.user_notification_reads`: `id`, `user_id`, `notification_id`, `read_at`, `dismissed_at`.
  - RPCs transacionais: `admin_send_broadcast_notification` e `mark_broadcast_as_read`.
- [ ] **Tarefa 1.4:** Criar estrutura para o Histórico de Backups e Snapshots:
  - Tabela `public.system_backups`: `id`, `created_at`, `created_by`, `backup_type`, `table_count`, `record_count`, `file_size_bytes`, `checksum_sha256`, `status`, `notes`.
  - RPC `admin_log_system_backup` para registro seguro de snapshots.

---

### FASE 2 — Login Exclusivo e Shell Administrativo Dedicado (Frontend)
- [ ] **Tarefa 2.1:** Implementar tela de login dedicada `src/features/admin/pages/admin-login-page.tsx`:
  - Interface com visual sóbrio ("Áxis Command Center");
  - Throttling progressivo (backoff exponencial após 3 e 5 tentativas);
  - Desafio Cloudflare Turnstile anti-bot real;
  - Validação atômica pós-login: se o perfil não tiver papel `admin` ou `superadmin`, desconecta imediatamente e exibe alerta de autorização negada.
- [ ] **Tarefa 2.2:** Criar o componente de guarda de rota `RequireAdminSession`:
  - Bloqueia renderização de qualquer rota `/admin/*`;
  - Redireciona usuários desautenticados ou com papel comum diretamente para `/admin/login`.
- [ ] **Tarefa 2.3:** Construir o layout dedicado `AdminShell` (`src/features/admin/layouts/admin-shell.tsx`):
  - Sidebar executiva com navegação estruturada pelas 8 áreas operacionais;
  - Header administrativo contendo:
    * Status dos serviços (Supabase, Asaas, Telegram, Integridade do Banco);
    * Botão de Pânico / Kill-Switch rápido;
    * Identificador do operador com crachá de função;
    * Botão "Sair do Painel Admin" (logout exclusivo).

---

### FASE 3 — Controle do APK Beta (Modos Free e Pro) & Bloqueio Amigável
- [ ] **Tarefa 3.1:** Implementar no painel administrativo (`AdminSettingsPage`) os controles de liberação do APK:
  - Switches para "Permitir APK Android — Usuários Pro" e "Permitir APK Android — Usuários Free";
  - Campo para definir mensagem explicativa da versão beta.
- [ ] **Tarefa 3.2:** Integrar a checagem no aplicativo cliente:
  - No componente de inicialização nativa ou tela de bloqueio, verificar se o app está rodando em APK (`isNativePlatform()`).
  - Se a feature flag estiver desabilitada para o plano do usuário, apresentar o diálogo modal elegante `ApkBetaRestrictedModal`:
    * Informa que o APK Nativo está em homologação fechada;
    * Disponibiliza botão direto para acessar o aplicativo via Web/PWA no navegador móvel;
    * Mantém opção de logout ou contato com suporte.

---

### FASE 4 — Gestão 360° de Usuários, Contato Criptografado e CRM
- [ ] **Tarefa 4.1:** Refatorar a página `AdminUsersPage`:
  - Tabela com densidade otimizada, busca instantânea e paginação eficiente;
  - Filtros avançados combinados (Status, Plano, Role, 2FA Ativo).
- [ ] **Tarefa 4.2:** Desenvolver a Gaveta Lateral de Detalhes do Usuário (`UserDetailDrawer`):
  - Visualização unificada dos dados do cliente;
  - Campo seguro para visualização de Telefone/WhatsApp com botão "Revelar Dado Protegido" (dispara auditoria LGPD) e atalho direto para iniciar conversa no WhatsApp;
  - Gestão de plano (Asaas), extensão de trial e overrides de módulos em abas organizadas;
  - Ações de segurança: forçar reset de senha, derrubar sessões ativas e exclusão definitiva conforme LGPD.

---

### FASE 5 — Central de Notificações Push & Avisos In-App
- [ ] **Tarefa 5.1:** Criar a tela `AdminNotificationsPage`:
  - Formulário de disparo com pré-visualização em tempo real do aviso (como aparecerá no celular do cliente);
  - Seletor de audiência: "Todos", "Apenas Assinantes Pro", "Apenas Free/Trial", ou "Clientes Selecionados";
  - Tabela de histórico de notificações disparadas com contadores de alcance e leitura.
- [ ] **Tarefa 5.2:** Integrar a recepção das notificações no app cliente:
  - Adicionar as notificações administrativas ao `NotificationsPopover` e sininho do app;
  - Suporte a disparo de notificação local/push no APK via Capacitor quando o app receber um novo broadcast.

---

### FASE 6 — Central de Backups, Integridade SHA-256 e DRP
- [ ] **Tarefa 6.1:** Desenvolver a página `AdminBackupsPage`:
  - Cartão de status do último backup (data, quantidade de registros, tamanho e hash);
  - Botão "Gerar Snapshot Imediato" para exportação administrativa consolidada;
  - Tabela com histórico de backups efetuados e status de retenção;
  - Verificador de Integridade (validação de hash SHA-256);
  - Manual DRP (Disaster Recovery Plan) interativo com instruções de restauração de contingência.
- [ ] **Tarefa 6.2:** Criar script/serviço para snapshot dos dados consolidados:
  - Exportação estruturada e higienizada em formato JSON versionado com checksum criptográfico.

---

### FASE 7 — Faturamento, Helpdesk, Auditoria e LGPD DPO Console
- [ ] **Tarefa 7.1:** Estruturar `AdminBillingPage`:
  - Painel de métricas financeiras SaaS (MRR, inadimplência e conversão);
  - Monitoramento de eventos do webhook Asaas e estorno rápido de 7 dias (CDC Art. 49).
- [ ] **Tarefa 7.2:** Refatorar `AdminTicketsPage`:
  - Fila de chamados com alerta de SLA (> 15 min);
  - Modal de resposta integrado com envio de aviso direto para o cliente.
- [ ] **Tarefa 7.3:** Estruturar `AdminSecurityPage`:
  - Trilha de auditoria avançada com filtros por operador, ação e data;
  - Console DPO com registro de solicitações de titulares da LGPD (Portabilidade e Direito ao Esquecimento).

---

## 4. QUALITY GATES (PORTÕES DE QUALIDADE OBRIGATÓRIOS)

Para assegurar 100% de estabilidade e zero regressão no sistema:

| Quality Gate | Descrição / Critério de Aceite |
|---|---|
| **QG1 — Typecheck Estrito** | `npm run typecheck` (`tsc --noEmit`) executado com 0 erros e sem uso de `any` ou `@ts-ignore`. |
| **QG2 — Linting & Regras de Ouro** | `npm run lint` 100% verde; zero elementos HTML nativos soltos; zero emojis no código de produção (`local/no-decorative-unicode`). |
| **QG3 — Suíte de Testes Automatizados** | Todos os testes existentes (~2.300+) passando + testes unitários e de integração para os novos componentes, hooks e guards administrativos. |
| **QG4 — Blindagem de Acesso (Fail-Closed)** | Teste comprovando que usuários comuns ou anônimos recebem 403 / redirecionamento imediato ao tentar acessar qualquer rota `/admin/*`. |
| **QG5 — Proteção de Dados LGPD** | Teste comprovando que a consulta de dados de contato sensíveis gera evento imutável em `audit_events`. |
| **QG6 — Build de Produção** | `npm run build` executado com sucesso e chunks de código administrativos devidamente isolados via lazy loading. |

---

## 5. DEFINITION OF DONE (DoD)

- [ ] Todas as 7 fases concluídas com código testado e tipado;
- [ ] Documentação operacional atualizada (`FOUNDER_RUNBOOK.md` e `SECURITY_GOVERNANCE.md`);
- [ ] Todos os 6 Quality Gates aprovados com relatório de execução.
