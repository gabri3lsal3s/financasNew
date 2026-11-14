# Plano Mestre de Correções, Refatorações e Auditoria — Axir

> **Status da Fase 0 (Meta-Auditoria & Calibração):** CONCLUÍDA COM SUCESSO.  
> Todas as Fases (1 a 9) foram auditadas contra a base de código real (`src/`, `supabase/migrations/`, `package.json`, `index.html`), documentações normativas (`AGENTS.md`, `ARCHITECTURE.md`, `FINANCIAL_MATH_SPEC.md`, `DESIGN_SYSTEM.md`) e regras de segurança (RLS, Supabase Auth, LGPD).  
> Os caminhos de arquivos em cada **Passo 0** foram substituídos pelos caminhos exatos do repositório, acompanhados de diagnósticos de causa-raiz e critérios de aceite blindados.

---

## Visão Geral e Ordem de Execução

| Fase | Área / Módulo | Tipo de Tarefa | Prioridade | Status | Objetivo Principal |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fase 0** | **Meta-Auditoria & Calibração do Plano** | **Auditoria & Otimização** | **Pré-requisito** | **Concluída** | Confrontar este plano com a documentação e o código real do Axir, identificar fragilidades e adequar todas as fases às regras internas do app. |
| **Fase 1** | Autenticação (2FA) & Rotas | Correção Crítica | P0 | **Concluída** | Corrigir exclusão de 2FA por senha, vazamento de sessão entre contas e redirect inicial para perfil Investimentos. |
| **Fase 2** | Carteira de Investimentos | Correção Crítica | P0 | **Concluída** | Impedir exclusão de ativo/transação ao editar vínculo com caixa e corrigir abate pelo valor de venda no saldo atual. |
| **Fase 3** | Rachas de Despesa & Link Público | Correção Crítica | P0 | **Concluída** | Eliminar card duplicado de parcela (`Despesa 2/2`) e liberar leitura pública do link Pix por RPC `get_public_share_by_token` em outros dispositivos. |
| **Fase 4** | Branding, Splash & Skeletons | Refatoração UI/UX | P1 | **Concluída** | Remover logos antigos, criar Splash Screen minimalista sem barra e aplicar Skeletons próprios por página. |
| **Fase 5** | Home, Pix Detectado & Clipboard (PWA + APK) | Correção + Feature | P1 | **Concluída** | Instalar e integrar `@capacitor/clipboard`, tirar Pix Detectado do carrossel e criar onboarding de permissões não intrusivo. |
| **Fase 6** | Carrossel Home (App Android Pro) | Regra de Negócio | P2 | **Concluída** | Exibir card "Baixar App Pro" apenas para contas Pro, persistir fechamento permanente em `user_preferences.custom_settings` e manter nos menus fixos. |
| **Fase 7** | Landing Page (Card Simulador) | Refatoração UI/UX | P2 | **Concluída** | Refatorar card simulador (`minimal-wealth-simulator.tsx`), mantendo o Donut, eliminando colunas espremidas e unificando listas duplicadas. |
| **Fase 8** | Tour Guiado (Spotlights & Contexto) | Correção UI/UX | P1 | **Concluída** | Corrigir seletores quebrados, spotlights ausentes/deslocados e sincronização de telas/modais nos 9 passos catalogados. |
| **Fase 9** | Rebalanceamento de Carteira | Auditoria & Arquitetura | P1 | **Concluída** | Diagnosticar motores de cálculo conflitantes e propor nova arquitetura de metas e output (Visão Macro vs. Detalhada) **sem alterar código**. |

---

## Fase 0: Relatório Consolidado de Diagnóstico & Calibração

### 1. Diagnóstico Geral de Conformidade e Riscos de Regressão

Durante a auditoria da base de código e documentação normativa (`AGENTS.md`, `FINANCIAL_MATH_SPEC.md`, `DESIGN_SYSTEM.md`), foram identificadas as seguintes causas-raízes e vulnerabilidades nas premissas das fases:

1. **Fase 1 (2FA e Roteamento):**
   - *Causa-raiz do loop na desativação:* Em `mfa-modal.tsx`, o handler `handleDeactivateMfa` não invoca `onClose()` ao concluir com sucesso, deixando o modal aberto no estado de ativação. Além disso, no Supabase Auth, o método `supabase.auth.mfa.unenroll` exige elevação de garantia para `AAL2`. Quando o usuário valida apenas a senha da conta, o token de sessão permanece em `AAL1`, gerando rejeição pelo backend se não houver elevação ou RPC dedicada.
   - *Causa-raiz do vazamento de estado no Login:* O hook `useAuth` e a store mantêm `pendingMfaFactor` e `mfaRequired` ativos após validações parciais ou cancelamentos; ao trocar de conta, esses dados residuais não são limpos no desmonte ou na troca de e-mail.
   - *Causa-raiz do roteamento de Investimentos:* O guard de navegação (`nav-items.tsx`) já possui a regra de negócio `hasFinance = hasFeature("transactions") || hasFeature("cards") || hasFeature("debts") || hasFeature("budgets")`. Porém, `router.tsx` e `overview-page.tsx` não realizam a verificação desse predicado na rota `/`, forçando o usuário "Apenas Investimentos" a carregar o Dashboard de finanças.

2. **Fase 2 (Carteira & Caixa):**
   - *Causa-raiz da exclusão ao editar aporte:* Em `transaction-form-dialog.tsx`, ao trocar a origem de Bolso (`pocket`) para Caixa (`cash`), o código executa `deleteContrib.mutateAsync(existingContribution)`. No entanto, em `use-portfolio-contribution-mutations.ts`, `useDeletePortfolioContribution` possui um efeito colateral em cascata que chama `deletePortfolioTransactionsMatching({ asset_id, date, types: ["buy"] })` e `reconcileAssetCustody(assetId, linkedTx)`. Ou seja: excluir o registro de aporte exclui compulsoriamente a transação de compra vinculada e zera a custódia do ativo na carteira! A edição da transação deve apenas desvincular ou deletar a linha de aporte sem acionar a deleção da transação de compra.
   - *Causa-raiz do abatimento de venda:* Em `use-portfolio-order-mutations.ts` e `transaction-form-dialog.tsx`, em ativos de valor total / renda fixa sem metadados diários, o resgate executa `remainingGrossBalance = Math.max(0, effectiveAppliedCost - orderAmount); remainingCost = remainingGrossBalance;`. Isso subtrai o valor bruto da venda (que inclui lucro/juros) diretamente do custo de aquisição. Deve-se aplicar amortização proporcional do custo médio e abater o saldo bruto de mercado pelo valor da ordem.

3. **Fase 3 (Rachas & Link Público):**
   - *Causa-raiz do card duplicado:* Em `active-splits-card.tsx`, a query busca `orphanRachaDebts` filtrando dívidas do tipo `receivable`. Quando um racha é parcelado (ex.: 2 parcelas), a parcela filha `Despesa (2/2)` gera uma dívida própria que não possui o `public_share` inicial anexado ao seu ID específico, fazendo o componente interpretá-la erroneamente como um racha órfão pendente e exibir o segundo card com botão "Gerar Link Pix".
   - *Causa-raiz do link público inacessível:* Na migração `20260101000099_harden_security_and_lgpd_cascade.sql`, a política RLS `public_shares_select` foi blindada para permitir `SELECT` apenas para `authenticated` onde `(select auth.uid()) = user_id`. Foi concedido acesso anônimo para outras entidades via RPCs `SECURITY DEFINER` (`get_shared_family_budget` e `get_shared_goal_tracker`), mas esqueceu-se de criar a RPC equivalente `get_public_share_by_token(token)`. A consulta direta do cliente (`getSupabase().from("public_shares").select("*").eq("token", token)`) é sumariamente bloqueada pelo Postgres para usuários não logados ou de outras contas.

4. **Fase 4 (Splash Screen & Skeletons):**
   - *Causa-raiz do loading:* `src/app/router.tsx` utiliza `<LoadingScreen statusText="Preparando painel financeiro…" />` como fallback de `<AuthenticatedRoot />`. O componente `LoadingScreen` possui uma barra de progresso simulada com etapas fixas (`DEFAULT_STAGES`). Além disso, o `RouteSuspenseFallback` utiliza um layout genérico de cards que não respeita a estrutura real de Extrato, Investimentos, Orçamentos ou Configurações.

5. **Fase 5 (Clipboard & Permissões PWA / APK):**
   - *Causa-raiz do erro no APK:* O pacote `@capacitor/clipboard` **não está instalado** em `package.json`. O serviço `src/services/clipboard.ts` depende unicamente da Web API `navigator.clipboard.readText()`. No WebView do Android (Capacitor), essa chamada lança exceção ou rejeição, gerando o toast "Acesso à área de transferência restrito".
   - *Causa-raiz do Pix escondido:* Em `overview-page.tsx`, o card `DashboardPixClipboardCard` está dentro do array `alertItems` passado ao carrossel `DashboardAlertsCarousel`. Ele compete na paginação com alertas de ritmo, teto familiar e metas.

6. **Fase 6 (Card App Android Pro):**
   - *Causa-raiz do reaparecimento:* O estado `androidBannerDismissed` em `overview-page.tsx` é apenas um `useState(false)` local em memória React. Ao atualizar a página, ele é reiniciado. Além disso, a condição `isAndroidEligible` verifica apenas se o dispositivo é Android, sem checar se a conta é Pro (`subscription.isPro`).

7. **Fase 7 (Simulador Landing Page):**
   - *Causa-raiz dos botões cortados e listas duplicadas:* O componente `minimal-wealth-simulator.tsx` possui `grid-cols-1 md:grid-cols-3` apertado no cabeçalho e renderiza a lista de 4 classes duas vezes: primeiro nas barras de alocação e logo abaixo dentro do container "Seu próximo aporte de R$ 3.000".

8. **Fase 8 (Tour Guiado):**
   - *Causa-raiz dos desalinhamentos:* Os passos em `tour-steps.ts` contêm seletores DOM que deixaram de existir ou ficam ocultos no mobile (ex: `data-tour="header-privacy-theme"` que é suprimido dinamicamente no `page-shell.tsx` quando há notificações ativas). Os passos de Orçamento apontam todos para o container mestre `[data-tour="budget-summary"]`.

9. **Fase 9 (Rebalanceamento):**
   - O rebalanceamento está dividido entre a aba `targets-tab.tsx` (configuração em 3 cards: Classes, Setores e Ativos), `aporte-tab.tsx` (cálculo de sugestão de aporte via `src/domain/portfolio/aporte.ts`) e o simulador aberto `rebalance-simulator-page.tsx`.

---

## Protocolo Global de Execução (Fases 1 a 9)

Qualquer alteração de código deve respeitar rigorosamente as seguintes diretrizes de governança:
1. **TypeScript Estrito:** Proibido uso de `any` ou `@ts-ignore`. Contratos em `src/types/` e esquemas validados com Zod.
2. **Funções Puras no Domínio:** Todo cálculo financeiro deve viver em `src/domain/` como função pura e possuir teste unitário colocalizado (`*.test.ts`).
3. **Moeda em Centavos:** Valores monetários armazenados como inteiros (`cents`) nos motores internos e convertidos apenas na borda via `src/services/masks/`.
4. **Zero Emojis:** É proibido o uso de emojis em textos, toasts ou interfaces (regra local `local/no-decorative-unicode`). Utilizar ícones do `lucide-react` com `size-4` / `size-3.5` e `aria-hidden="true"`.
5. **Zero Elementos Nativos Crus:** Proibido usar `<select>`, `<dialog>`, `<input type="checkbox">` diretamente. Usar os componentes primitivos de `src/components/ui/`.
6. **Modais & Bottom Sheets:** Utilizar `<Modal />` ou `<ResponsiveDialog />` respeitando os tokens de tamanho canônicos (`sm`, `md`, `lg`, `xl`, `2xl`).
7. **Gateway Sensorial Único:** Feedback tátil deve passar exclusivamente por `triggerSensory(...)` em `src/services/sensory.ts`. Nunca invocar `triggerHaptic` diretamente em handlers de botões.

---

## Fase 1: Correções Críticas de Autenticação (2FA) e Roteamento [CONCLUÍDA]

### Status da Execução
- **Status:** CONCLUÍDA
- **Data:** 14/11/2026
- **Testes:** 82/82 testes passando (`mfa-modal.test.tsx`, `login-page.test.tsx`, `auth.test.ts`, `router.test.tsx`). Typecheck e Lint 100% limpos.
- **Implementações realizadas:**
  1. Cliente isolado sem persistência em `src/data/client.ts` (`createIsolatedSupabaseClient`) para que `verifyCurrentPassword` não rebaixe o token de AAL2 para AAL1.
  2. Fechamento imediato do modal (`onClose`) e invalidação do estado de autenticação (`refreshMfaState`) após desativação com sucesso em `mfa-modal.tsx`.
  3. Navegação imediata pós-validação de 2FA em `login-page.tsx`, descarte do query param `desafio=totp` e limpeza de estado em cancelamento.
  4. Rotina de limpeza centralizada `resetGlobalMfaState` invocada em `resetAppState` (`src/services/auth-cleanup.ts`) prevenindo vazamento de estado de MFA entre contas.
  5. Redirecionamento da rota raiz `/` para `/investments` para perfis "Apenas Investimentos" em `AuthenticatedRoot` (`src/app/authenticated-root.tsx`) e com guard de defesa em profundidade em `OverviewPage` (`src/features/overview/pages/overview-page.tsx`).

### Contexto e Problemas
* **Loop e falha na exclusão do 2FA:** Ao desativar o 2FA via senha, o sistema valida a senha, mas não conclui a desativação de forma transparente e não fecha o modal.
* **Bloqueio de login e vazamento de estado de sessão:** Estado de 2FA pendente e desafios de verificação persistem na memória e bloqueiam tentativas subsequentes ou vazam para outras contas.
* **Roteamento inicial para "Apenas Investimentos":** Usuários sem módulos de despesas caem na Home geral em vez de abrirem diretamente em `/investments`.

### Passo 0 — Arquivos Reais Mapeados
- **UI de Segurança e 2FA:** `src/features/settings/components/mfa-modal.tsx`, `src/features/settings/components/tabs/security-tab.tsx`.
- **Serviços e Repositórios Auth:** `src/data/auth.ts`, `src/hooks/use-auth.ts`, `src/state/auth-context.tsx`.
- **Páginas de Login e Auth Shell:** `src/features/auth/pages/login-page.tsx`, `src/features/auth/components/auth-shell.tsx`.
- **Roteador e Predicados de Acesso:** `src/app/router.tsx`, `src/app/require-auth.tsx`, `src/components/layout/nav-items.tsx`, `src/features/overview/pages/overview-page.tsx`.

### Tarefas Obrigatórias
1. **Desativação em Etapa Única do 2FA:**
   - Em `mfa-modal.tsx`, separar com clareza os fluxos: validação por Senha OU código TOTP.
   - Quando o usuário optar por validar com senha, executar a validação via `verifyCurrentPassword`. Se a chamada a `supabase.auth.mfa.unenroll` falhar por exigência de AAL2, implementar elevação de sessão ou invocar a RPC administrativa segura `unenroll_own_mfa_factor` passando verificação criptográfica da senha.
   - Ao concluir com sucesso a desativação, resetar os estados locais, emitir `triggerSensory("selection")`, exibir toast de sucesso e **fechar imediatamente o modal** (`onClose()`).
2. **Blindagem do Login e Limpeza de Estado entre Contas:**
   - Em `login-page.tsx` e `use-auth.ts`, garantir que, ao montar a tela de login, ao clicar em "Voltar" ou ao trocar o e-mail no formulário, todos os estados temporários (`pendingMfaFactor`, `mfaRequired`, códigos digitados e mensagens de erro) sejam limpos.
   - Resolver possíveis race conditions no `verifyMfaTotpCode` no login, aguardando o estabelecimento da sessão com AAL2 antes de acionar `navigate("/", { replace: true })`.
3. **Redirecionamento Automático para Perfil "Apenas Investimentos":**
   - Utilizar a regra canônica de `nav-items.tsx`: `hasFinance = hasFeature("transactions") || hasFeature("cards") || hasFeature("debts") || hasFeature("budgets")`.
   - Se `!hasFinance && hasFeature("investments")`, redirecionar automaticamente acessos à rota raiz `/` para `/investments`.
   - Adicionar guard na página `OverviewPage` para que redirecione imediatamente caso o usuário acesse `/` diretamente.

### Critérios de Aceite
- Desativar 2FA confirmando a senha conclui com sucesso, fecha o modal e retorna às Configurações de Segurança.
- Login com 2FA direciona diretamente ao app autenticado após informar o código de 6 dígitos.
- Fazer logout de uma conta com 2FA e logar em uma conta sem 2FA não exibe tela de desafio 2FA residual.
- Contas configuradas em "Apenas Investimentos" abrem automaticamente na Carteira de Investimentos (`/investments`).

---

## Fase 2: Integridade Financeira na Carteira de Investimentos [CONCLUÍDA]

### Status da Execução
- **Status:** CONCLUÍDA
- **Data:** 14/11/2026
- **Testes:** 18/18 testes de mutação de carteira passando (`use-portfolio-mutations.test.tsx`), Typecheck e Lint 100% limpos.
- **Implementações realizadas:**
  1. Suporte a `skipTransactionCascade: true` em `useDeletePortfolioContribution` (`src/state/mutations/portfolio/use-portfolio-contribution-mutations.ts`), desacoplando a exclusão de aporte da cascata destrutiva de transação de compra e custódia.
  2. Ao alternar origem de Bolso para Caixa na edição de compras em `src/features/investments/components/transaction-form-dialog.tsx`, o aporte antigo é removido com `skipTransactionCascade: true`, mantendo o histórico de compra e a posição intactos.
  3. Correção na amortização de ativos de valor total sem metadados diários em `src/state/mutations/portfolio/use-portfolio-order-mutations.ts` e `transaction-form-dialog.tsx`: resgates parciais agora calculam a proporção sobre o saldo bruto de mercado e amortizam proporcionalmente o custo aplicado remanescente.

### Contexto e Problemas
* **Exclusão acidental ao editar aporte:** Editar um ativo/transação para ativar "descontar do caixa" apaga a transação e zera o ativo da carteira devido à cascata indevida de deleção de aporte.
* **Cálculo de saldo atual na venda de ativo:** A baixa de ativos de valor total abate o valor de venda diretamente do custo aplicado em vez de atualizar proporcionalmente.

### Passo 0 — Arquivos Reais Mapeados
- **Diálogos de Edição e Criação de Ativos:** `src/features/investments/components/asset-form-dialog.tsx`, `src/features/investments/components/asset-edit-dialog.tsx`.
- **Formulário de Transações e Venda:** `src/features/investments/components/transaction-form-dialog.tsx`, `src/features/investments/components/quick-transaction-sheet.tsx`.
- **Mutations e Ledger da Carteira:** `src/state/mutations/portfolio/use-portfolio-contribution-mutations.ts`, `src/state/mutations/portfolio/use-portfolio-order-mutations.ts`, `src/state/mutations/portfolio/use-portfolio-asset-mutations.ts`.
- **Motores Matemáticos de Carteira:** `src/domain/portfolio/operations.ts`, `src/domain/portfolio/valuation.ts`, `src/domain/portfolio/summary.ts`, `src/state/queries/use-portfolio-position.ts`.

### Tarefas Obrigatórias
1. **Desacoplamento Seguro entre Aportes (`contributions`) e Transações (`transactions`):**
   - Em `use-portfolio-contribution-mutations.ts`, refatorar `useDeletePortfolioContribution` para aceitar um parâmetro booleano de controle (ex.: `skipTransactionCascade: true`).
   - Em `transaction-form-dialog.tsx`, ao alternar a modalidade de financiamento de "Bolso" para "Caixa" durante a edição de uma compra existente, deletar a contribuição antiga com `skipTransactionCascade: true`, atualizar o saldo do ativo `CAIXA` e preservar a transação original e a posição do ativo.
2. **Correção Matemática na Venda de Ativos (Proporcionalidade de Custo e Saldo):**
   - Em `use-portfolio-order-mutations.ts` e `transaction-form-dialog.tsx`:
     - Em ativos de **Valor Total / Renda Fixa**, para resgates parciais, calcular a proporção resgatada em relação ao saldo bruto de mercado (`proportion = orderAmount / grossBalance`). O novo custo de aquisição deve ser amortizado proporcionalmente (`newCost = currentCost * (1 - proportion)`), e o saldo bruto atualizado (`newGrossBalance = grossBalance - orderAmount`).
     - Em ativos de **Cotas / Preço Médio (Ações, FIIs, Cripto)**, manter o preço médio rigorosamente inalterado (`remainingAveragePrice = currentAveragePrice`), atualizar a quantidade em custódia e registrar a transação de venda com o ganho de capital correspondente.

### Critérios de Aceite
- Ao editar uma compra para marcar "descontar do caixa", o saldo do caixa é debitado e o ativo permanece íntegro com sua quantidade e histórico na carteira.
- Ao vender parcialmente um ativo com lucro, o saldo total da carteira diminui exatamente pelo valor bruto da venda, e a rentabilidade não realizada reflete com precisão a custódia remanescente.

---

## Fase 3: Correção da Duplicação de Rachas e Acesso Público ao Link

### Contexto e Problemas
* **Cards duplicados de racha ativo:** Criar um racha parcelado exibe o card mestre e cards órfãos de parcelas filhas (`Despesa 2/2`) com status "Link pendente".
* **Link público retorna "Racha não encontrado":** Dispositivos não autenticados não conseguem consultar o compartilhamento devido à falta de RPC pública com `SECURITY DEFINER`.

### Passo 0 — Arquivos Reais Mapeados
- **Vitrine de Rachas Ativos:** `src/features/transactions/components/active-splits-card.tsx`.
- **Página Pública de Visualização do Racha:** `src/features/public-share/pages/split-public-page.tsx`.
- **Repositório de Compartilhamento:** `src/data/repositories/public-shares.ts`, `src/state/queries/use-public-shares.ts`.
- **Migrations e RPCs de Banco:** `supabase/migrations/20260101000099_harden_security_and_lgpd_cascade.sql`, `supabase/migrations/20260101000075_harden_signal_split_payment_rpc.sql`.

### Tarefas Obrigatórias
1. **Unificação de Parcelas em `ActiveSplitsCard`:**
   - Em `active-splits-card.tsx`, ajustar o filtro de `orphanRachaDebts` para ignorar dívidas que representem parcelas subsequentes de despesas parceladas já consolidadas (`recurrence_group_id` ou vinculadas a despesas com `installment_number > 1`).
   - Cada racha registrado deve gerar apenas 1 card agregador na lista de Rachas Ativos.
2. **Criação da RPC Segura `get_public_share_by_token`:**
   - Criar uma nova migration SQL adicionando a função RPC `get_public_share_by_token(p_token text)` com `SECURITY DEFINER` e `set search_path = public, pg_temp`.
   - A função deve validar a higienização do token, verificar se não foi revogado (`is_revoked = false`) e se não está expirado (`expires_at > now()`), retornando o payload sanitized sem expor dados privados do criador.
   - Atualizar `getPublicShareByToken` em `src/data/repositories/public-shares.ts` para chamar `supabase.rpc("get_public_share_by_token", { p_token: token })`.

### Critérios de Aceite
- Criar um racha parcelado (ex.: 2x ou 3x) gera exatamente 1 card ativo na tela de Transações.
- Abrir o link do racha em aba anônima ou em outro dispositivo exibe os dados do racha e o QR Code Pix sem exigir login.

---

## Fase 4: Splash Screen, Identidade Visual (Logos) e Skeletons por Página

### Contexto e Problemas
* **Loading genérico:** Transições exibem barra de progresso simulada ou skeleton genérico reaproveitado.
* **Logos antigos:** Assets legados ainda constam no repositório.

### Passo 0 — Arquivos Reais Mapeados
- **Logotipos e Identidade:** `public/brand/`, `src/components/layout/logo-icon.tsx`, `src/components/layout/brand-logo.tsx`, `index.html`, `public/manifest.json`.
- **Splash Screen e Transição Inicial:** `index.html` (`#app-splash`), `src/components/layout/loading-screen.tsx`, `src/services/native/splash-screen.ts`, `src/main.tsx`.
- **Roteador e Skeletons:** `src/app/router.tsx` (`RouteSuspenseFallback`), `src/components/ui/skeleton.tsx`.

### Tarefas Obrigatórias
1. **Limpeza de Assets e Unificação de Marca:**
   - Varrer `public/brand/` e remover arquivos legados/descontinuados (como `axis-logo.png`).
   - Garantir que todos os componentes e metadados PWA apontem para o monograma oficial Axir (`/brand/logo-amber-*` e `/brand/logo-teal-*`).
2. **Splash Screen Minimalista e Fluida:**
   - Refatorar `LoadingScreen` em `src/components/layout/loading-screen.tsx` para remover barras de progresso simuladas e logs textuais dinâmicos.
   - Abertura com fundo sólido no tema ativo, símbolo oficial centralizado e animação suave via CSS, finalizando com fade-out rápido assim que o App Shell montar.
3. **Skeletons Fiéis e Dedicados por Rota:**
   - Criar skeletons específicos para as páginas chave:
     - `OverviewSkeleton` (Home): espelha o Hero de Caixa Real, Grid de KPIs, Carrossel de Alertas e Donut de categorias.
     - `InvestmentsSkeleton`: espelha o Grid de 4 KPIs, Card de Caixa e Tabela de Posições.
     - `TransactionsSkeleton`: espelha o filtro de busca, resumo mensal e lista agrupada por data.
     - `BudgetsSkeleton`: espelha cards de teto planejado e barras de categorias.
     - `ReportsSkeleton`: espelha cabeçalho executivo e tabela de DRE.
     - `SettingsSkeleton`: espelha layout de abas e cards de configuração.
   - Em `router.tsx`, mapear o fallback de cada rota para o seu respectivo skeleton dedicado.

### Critérios de Aceite
- Nenhuma referência ou asset descontinuado permanece no código.
- A abertura inicial do app não exibe barras de progresso simuladas.
- Navegar entre páginas internas exibe skeletons fiéis que evitam saltos visuais (layout shifts).

---

## Fase 5: Destaque para Pix Detectado e Correção do Clipboard (PWA + APK)

### Contexto e Problemas
* **Falha no APK Android WebView:** O WebView bloqueia `navigator.clipboard.readText()`, gerando o erro de acesso restrito.
* **Pix Detectado pouco visível:** O card de Pix copiado fica oculto entre os slides do carrossel.
* **Gestão de Permissões:** O app não possui onboarding proativo para clipboard e notificações.

### Passo 0 — Arquivos Reais Mapeados
- **Dependências e Configuração Nativa:** `package.json`, `capacitor.config.ts`.
- **Serviço de Clipboard:** `src/services/clipboard.ts`.
- **Detecção de Pix e Home:** `src/hooks/use-pix-clipboard-detector.ts`, `src/features/overview/pages/overview-page.tsx`, `src/components/modules/dashboard-pix-clipboard-card.tsx`.
- **Calculadora Flutuante:** `src/components/modules/floating-calculator.tsx`.

### Tarefas Obrigatórias
1. **Instalação e Integração de `@capacitor/clipboard`:**
   - Adicionar `@capacitor/clipboard` ao `package.json`.
   - Em `src/services/clipboard.ts`, checar `isNativePlatform()`. No APK nativo, utilizar `Clipboard.read()` da bridge Capacitor com delay seguro (~200ms após o foco da janela para Android 12+).
   - No PWA/Web, manter `navigator.clipboard.readText()` com tratamento preventivo.
2. **Destaque do Pix Detectado fora do Carrossel:**
   - Em `overview-page.tsx`, remover `DashboardPixClipboardCard` de dentro do array `alertItems` do carrossel.
   - Renderizar o card destacado logo acima do carrossel, com borda esmeralda sutil, botões diretos "Registrar Agora" e "Dispensar", garantindo visibilidade imediata.
3. **Onboarding Proativo de Permissões:**
   - Criar modal/card explicativo discreto na primeira entrada pós-login informando os benefícios de ativar notificações e área de transferência.
   - Se recusado, salvar `permissionPromptDismissed: true` no armazenamento local e não insistir.

### Critérios de Aceite
- Copiar um código Pix no Android e abrir o APK Axir detecta o valor sem disparar alerta de erro.
- O card de Pix Detectado aparece em destaque exclusivo no topo da Home.
- A solicitação inicial de permissões nunca reaparece caso o usuário a dispense.

---

## Fase 6: Regra de Exibição e Persistência do Card "Baixar App Android Pro"

### Contexto e Problemas
* **Card reaparece após fechar:** Ao clicar no `×`, o card volta na sessão seguinte.
* **Elegibilidade:** Usuários Free não devem ver o card promocional do app Android Pro.

### Passo 0 — Arquivos Reais Mapeados
- **Home e Carrossel:** `src/features/overview/pages/overview-page.tsx`, `src/components/modules/android-pro-banner.tsx`.
- **Preferências do Usuário:** `src/data/repositories/user-preferences.ts`, `src/state/mutations/use-user-preferences-mutations.ts`.
- **Acesso Permanente ao Download:** `src/features/settings/components/tabs/notifications/banking-assistant-card.tsx`, menu "Mais" / Configurações.

### Tarefas Obrigatórias
1. **Elegibilidade Exclusiva para Contas Pro:**
   - Em `overview-page.tsx`, condicionar a exibição do card a `subscription.isPro === true && isAndroidDevice() && !isNativePlatform()`. Contas Free nunca devem receber o card no carrossel.
2. **Persistência Permanente de Fechamento (`×`):**
   - Ao fechar o card ou clicar em baixar, persistir `hasDismissedAndroidProBanner: true` em `user_preferences.custom_settings`.
   - Sincronizar o estado para que o card nunca mais seja exibido na Home para essa conta.
3. **Preservação dos Pontos Fixos de Download:**
   - Garantir que o botão/card de download do APK Pro permaneça acessível em Configurações e no rodapé do menu Mais.

### Critérios de Aceite
- Usuários Free nunca veem o card "Baixar App Pro" na Home.
- Usuários Pro que fecham o card uma vez nunca mais o visualizam na Home, mesmo trocando de dispositivo.
- O download do App Pro continua disponível em Configurações.

---

## Fase 7: Refatoração Completa do Card Simulador Interativo (Landing Page)

### Contexto e Problemas
* **Controles espremidos:** 3 colunas apertadas truncam textos (`Dividen...`, `Cresci...`) e números (`R$ 100k`, `R$ 1.5k`).
* **Duplicação de classes:** As 4 classes aparecem na lista de progresso e são repetidas logo abaixo no bloco de próximo aporte.

### Passo 0 — Arquivos Reais Mapeados
- **Componente do Simulador:** `src/features/landing/components/minimal-wealth-simulator.tsx`.
- **Projeção Patrimonial e Presets:** `src/features/landing/components/fire-projection-curve.tsx`, `src/domain/portfolio/simulation-presets.ts`, `src/domain/portfolio/simulation.ts`.
- **Testes da Landing Page:** `src/features/landing/pages/landing-page.test.tsx`.

### Tarefas Obrigatórias
1. **Reestruturação dos Controles em 2 Linhas:**
   - Linha 1 (Estratégia): Segmented Control espaçoso com botões em pílula de largura total para *Dividendos*, *Global Tech* e *Crescimento*.
   - Linha 2 (Valores): Dois blocos proporcionais lado a lado para *Patrimônio Atual* (`R$ 25k`, `R$ 100k`, `R$ 300k`) e *Aporte Mensal* (`R$ 1,5k`, `R$ 3k`, `R$ 6k`), com tipografia `whitespace-nowrap tabular-nums`.
2. **Unificação da Lista de Ativos sob o Donut:**
   - Eliminar a seção duplicada "Seu próximo aporte de R$ 3.000".
   - Criar uma única lista integrada abaixo do gráfico Donut onde cada item exibe: indicador de cor + nome da classe, barra de progresso comparativa (% Pós-aporte vs. Meta %), valor em reais e badge de ação/aporte (ex.: `+ R$ 1.839 (61%)` em destaque esmeralda).

### Critérios de Aceite
- Nenhum texto ou valor numérico fica truncado ou com reticências no mobile.
- As 4 classes são listadas apenas uma vez abaixo do Donut, unificando status de alocação e sugestão de aporte.

---

## Fase 8: Revisão Completa do Tour Guiado (Spotlights & Contexto)

### Contexto e Problemas
* **Spotlights quebrados ou ausentes:** 9 passos mapeados possuem seletores inexistentes, má aplicação de máscara escura ou desalinhamento com a rota/modal ativa.

### Passo 0 — Arquivos Reais Mapeados
- **Catálogo de Passos do Tour:** `src/domain/demo-simulation/tour-steps.ts`, `src/domain/demo-simulation/tour-catalog.ts`.
- **Engine do Spotlight e Overlay:** `src/components/modules/demo-tour-spotlight.tsx`.
- **Cabeçalho e Shell:** `src/components/layout/page-shell.tsx`.
- **Telas dos Passos:** `src/features/overview/pages/overview-page.tsx`, `src/features/transactions/wizard/launch-wizard.tsx`, `src/features/budgets/pages/budgets-page.tsx`, `src/features/public-share/pages/split-public-page.tsx`.

### Tarefas Obrigatórias
1. **Robusteza do Spotlight Engine:**
   - Garantir espera da montagem da tela/modal antes de calcular `getBoundingClientRect()`.
   - Executar `scrollIntoView({ behavior: "smooth", block: "center" })` e posicionar o popover dinamicamente sem sobrepor o alvo.
2. **Correção dos 9 Passos Mapeados:**
   - *Passo 1 (Atalhos do Cabeçalho):* Apontar para os atalhos reais visíveis no mobile ou abrir o menu de Perfil/Configurações.
   - *Passo 2 (Lançamento Despesa/Renda):* Focar nas abas `Despesa` e `Renda` do modal `LaunchWizard` e alinhar a descrição.
   - *Passo 3 (Parcelamento):* Manter o modal aberto e focar no seletor de parcelas em vez de ir para o Extrato.
   - *Passos 4, 5 e 6 (Orçamento):* Desvincular do card geral superior; focar no primeiro card de categoria, na barra de progresso e no botão de editar limite.
   - *Passo 7 (Smart Advisor):* Direcionar para a Home (Dashboard) e destacar o card de insights.
   - *Passo 8 (Rachar Despesa):* Focar no bloco "Rachar c/ Amigos" na aba Detalhes do lançamento.
   - *Passo 9 (Chave Pix no Racha):* Focar no container do QR Code e chave Pix na tela do racha.

### Critérios de Aceite
- Todos os 9 passos abrem a tela/modal correta e aplicam spotlight nítido sobre o elemento em foco.
- O card explicativo não cobre o elemento destacado.

---

## Fase 9: Auditoria Técnica e Arquitetural do Rebalanceamento de Carteira

> **Modo Somente Leitura:** Esta fase não altera código; produz um relatório diagnóstico completo e propostas de arquitetura.

### Contexto e Problemas
* **Fragmentação:** Cálculos duplicados entre `aporte.ts`, `targets-tab.tsx` e `rebalance-simulator-page.tsx`.
* **Hierarchical Overload:** Fricção excessiva para fechar 100% simultaneamente em Classes, Setores e Ativos.
* **Microgestão:** Output rígido que não oferece visão estratégica macro (por classe/indexador) para investidores práticos.

### Passo 0 — Arquivos Reais Mapeados
- **Motores de Cálculo:** `src/domain/portfolio/aporte.ts`, `src/domain/portfolio/allocation.ts`, `src/domain/portfolio/class-breakdown.ts`, `src/domain/portfolio/simulation.ts`.
- **Páginas de Metas e Aporte:** `src/features/investments/pages/targets-tab.tsx`, `src/features/investments/pages/aporte-tab.tsx`.
- **Componentes de Alvos:** `src/features/investments/components/targets/target-classes-card.tsx`, `src/features/investments/components/targets/target-sectors-card.tsx`, `src/features/investments/components/targets/target-assets-card.tsx`.
- **Repositórios:** `src/data/repositories/allocation-targets.ts`, `src/data/repositories/category-targets.ts`.

### Entregáveis da Auditoria
1. **Inventário de Fórmulas e Discrepâncias:** Mapear divergências matemáticas entre telas.
2. **Proposta de Arquitetura To-Be:**
   - Single Source of Truth no motor `aporte.ts`.
   - Fluxo simplificado de metas com indicador de saldo livre e botão de auto-distribuição.
   - Visão Dual de Output: Visão Macro (por classe/indexador) vs. Visão Detalhada (ativo por ativo com filtro de valor mínimo).
