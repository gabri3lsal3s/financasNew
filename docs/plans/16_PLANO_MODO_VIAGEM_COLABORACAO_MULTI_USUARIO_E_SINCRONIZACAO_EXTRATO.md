# PLANO DE IMPLEMENTAÇÃO 16 — MODO VIAGEM COLABORATIVO MULTI-USUÁRIO, SINCRONIZAÇÃO BIDIRECIONAL COM EXTRATO PESSOAL, REALTIME & LIQUIDAÇÃO REAL

> **Documento Canônico de Arquitetura, Engenharia de Dados e Governança de Software**  
> **Status:** Revisado, Refinado e Consolidado para Execução · Quality Gates QG1–QG5 Definidos  
> **Arquivo:** `planos/16_PLANO_MODO_VIAGEM_COLABORACAO_MULTI_USUARIO_E_SINCRONIZACAO_EXTRATO.md`  
> **Ordem de Implementação:** **16º (Evolução Colaborativa, Multi-Contas & Sincronização Contábil Total do Modo Viagem)**  
> **Módulos Afetados:** `supabase/migrations/`, `src/types/`, `src/domain/trips/`, `src/data/repositories/`, `src/data/rpc.ts`, `src/state/`, `src/hooks/`, `src/features/trips/`, `src/features/transactions/`, `src/features/public-share/`, `docs/`  
> **Governança:** TypeScript Estrito (Zero `any`/`@ts-ignore`) · RLS Hermético (D4 — Zero Data Bleed) · Moeda em Centavos Inteiros · Zero Controles Nativos Crus · Zero Emojis (`local/no-decorative-unicode`) · Portões de Qualidade (QG) por Fase  
> **Ambientes:** Web Desktop, Web PWA (iOS/Android) & Android Nativo (Capacitor Pro)  

---

## 1. SUMÁRIO EXECUTIVO: COMO ESTÁ HOJE vs. COMO VAI FUNCIONAR

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        ARQUITETURA COLABORATIVA INTEGRADA (PLANO 16)                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                   ┌────────────────────────────────┼────────────────────────────────┐
                   ▼                                ▼                                ▼
       ┌───────────────────────┐        ┌───────────────────────┐        ┌───────────────────────┐
       │      ANFITRIÃO        │        │   CONVIDADO C/ CONTA  │        │  CONVIDADO S/ CONTA   │
       │   (HOST TITULAR)      │        │   (CONEXÃO ÁXIS)      │        │     (LINK WEB)        │
       │                       │        │                       │        │                       │
       │ - Cria & modera viagem│        │ - Aceita vínculo 1-clique     │ - Link público         │
       │ - Gerencia membros    │        │ - Viagem no seu /viagens│      │ - Identidade 1º toque │
       │ - Debita do cartão/Pix│        │ - Debita do seu cartão│        │   (memorizada no nav) │
       │ - Painel de controle  │        │ - Cockpit contextual  │        │ - Lança em 5 segundos │
       │ - Baixa de reembolso  │        │ - Quita dívida com Pix│        │ - Sem risco de imputar│
       │   no extrato pessoal  │        │   e lança no extrato  │        │   despesa no Host     │
       └───────────┬───────────┘        └───────────┬───────────┘        └───────────┬───────────┘
                   │                                │                                │
                   └────────────────────────────────┼────────────────────────────────┘
                                                    ▼
                               ┌────────────────────────────────────────┐
                               │       LIVRO-RAZÃO DA VIAGEM (HUB)      │
                               │ - Cotas exatas com resíduo garantido   │
                               │ - Sincronização Realtime entre apps    │
                               │ - RLS com separação Host vs. Membro    │
                               │ - Permissão de edição do criador       │
                               └────────────────────┬───────────────────┘
                                                    ▼
                   ┌────────────────────────────────┴────────────────────────────────┐
                   ▼                                                                 ▼
       ┌───────────────────────┐                                         ┌───────────────────────┐
       │ SINCRONIZAÇÃO EM VIDA │                                         │ LIQUIDAÇÃO MATEMÁTICA │
       │   (EXTRATO ↔ VIAGEM)  │                                         │      REAL & ATIVA     │
       │                       │                                         │                       │
       │ - Criação bilateral   │                                         │ - Settlements abatem  │
       │ - Edição refletida    │                                         │   saldos pendentes    │
       │ - Exclusão mútua      │                                         │ - Devedor transfere   │
       │   guiada por modal    │                                         │   Pix e cria despesa  │
       │ - Opção de manter     │                                         │ - Credor confirma Pix │
       │   individualmente     │                                         │   e cria reembolso    │
       └───────────────────────┘                                         └───────────────────────┘
```

### 1.1 Diagnóstico do Estado Atual (Limitações do Plano 14 e 15)
1. **Isolamento de Contas:** Embora a tabela `trip_members` possua a coluna `user_id`, não existe fluxo de vínculo ou convite inter-contas. Apenas o anfitrião enxerga a viagem no seu próprio app (`/viagens`). Amigos que possuem conta no Áxis precisam usar o link público anônimo pelo navegador.
2. **Retrabalho Contábil Duplo:** Um participante com conta no Áxis precisa lançar a despesa na viagem pública e depois ir ao seu próprio aplicativo recadastrar o lançamento no extrato bancário para não perder o controle do cartão de crédito.
3. **Liquidação Fantasma (Falha Matemática de Abatimento):** O motor atual (`calculateMemberBalances`) computa saldos exclusivamente a partir de `expenses`. Registrar uma transferência em `trip_settlements` **não reduz o saldo devedor nem as transferências sugeridas**, fazendo com que o saldo continue estático mesmo após o pagamento!
4. **Assimetria no Fechamento ("Abater"):** No acerto de contas (`settlements`), o app oferece apenas o lançamento de **Receita** para quem *recebe* dinheiro (credor). Quem *paga* para quitar sua dívida devedora não possui integração para lançar a saída como Despesa em seu extrato, tendo que fazê-lo manualmente.
5. **Ciclo de Vida Desconectado (Exclusão & Edição):** Se uma despesa for excluída na viagem, a transação correspondente no extrato bancário pessoal permanece órfã. Se for excluída no extrato pessoal, a cota na viagem permanece inalterada, gerando divergências financeiras.
6. **Falha Cognitiva do Pagador Padrão no Link Público:** No link web (`/viagem/:token`), se um convidado sem conta não selecionar explicitamente quem pagou, o sistema imputa a despesa silenciosamente na conta do **Organizador/Host**, gerando confusão e cobranças indevidas no grupo.
7. **Ausência de Realtime Multi-Dispositivos:** Se 4 amigos estiverem em um restaurante e um lançar a conta de R$ 320, os outros 3 celulares continuam com a tela antiga até que façam refresh manual da página.

### 1.2 Estado Futuro Desejado (Com o Plano 16)
1. **Hub Colaborativo Multi-Contas:** Usuários com conta conectam-se à viagem com 1 clique (ou ao se cadastrar via link da viagem). A viagem aparece automaticamente na aba `/viagens` de todos os participantes.
2. **Motor de Abatimento Real:** `calculateMemberBalances` passa a incorporar os acertos registrados/confirmados em `settlements`. À medida que os Pix são realizados, os saldos devedores reduzem deterministicamente até zero.
3. **Sincronização Bidirecional Fluida (Extrato ↔ Viagem):**
   - Ao lançar na viagem, opção de debitar do cartão/Pix pessoal.
   - Ao lançar no extrato pessoal via wizard, opção de vincular à viagem ativa.
   - Ao editar valor/data, atualização sincronizada em ambas as pontas.
   - Ao excluir, modal decisório: *"Excluir de ambos"* ou *"Excluir apenas da viagem/extrato"*.
4. **Identidade Ativa no Link Público ("Quem é você nesta viagem?"):**
   - Identificação mandatória ou seleção inicial memorizada no navegador (`localStorage`).
   - Bloqueio estrito no formulário público contra envio com pagador vazio ou padrão silencioso no Host.
5. **Quitação Simétrica Total:**
   - Devedor clica em "Pagar Pix" e com 1 toque registra a despesa de acerto em sua conta corrente/Pix.
   - Credor confirma o recebimento e registra o reembolso em seu extrato pessoal.
6. **Cockpit Personalizado na `TripDetailsPage`:**
   - Cards contextuais dinâmicos informando exatamente o status pessoal daquele usuário logado (saldo líquido pessoal, atalhos de quitação, gastos no cartão próprio e ações permitidas para seu papel).
7. **Sincronização em Tempo Real (Supabase Realtime):**
   - Canal reativo atualizando as listas e saldos instantaneamente em todos os celulares do grupo a cada gasto ou Pix cadastrado.

---

## 2. MATRIZ DE FRAGILIDADES, RISCOS & SALVAGUARDAS ARQUITETURAIS

| # | Fragilidade Diagnosticada | Impacto no Usuário / Negócio | Salvaguarda Blindada de Engenharia |
|---|---|---|---|
| **F1** | **Usurpação de Membro no Grupo (Takeover por Link)** | Qualquer pessoa com o link do WhatsApp poderia clicar em "Sou o Lucas" e assumir a conta de outro amigo na viagem. | **Salvaguarda em Três Níveis:** (1) Apenas membros sem `user_id` vinculado podem ser reivindicados; (2) Se a viagem tiver `passcode`, este é exigido na RPC `claim_trip_member`; (3) O Anfitrião mantém controle total com o botão *"Desvincular Conta"*, podendo revogar qualquer vínculo equivocado a qualquer momento. |
| **F2** | **Atribuição Errada no Link Público (Gasto no Host)** | Convidado abre o modal na web, digita o valor e envia sem ver que estava marcado como "Pago pelo Host". | **Identidade Ativa Persistida + Bloqueio Estrito:** O visitante seleciona sua identidade no topo da página uma única vez (memorizada na sessão local). No diálogo `AddPublicTripExpenseDialog`, é proibido fallback silencioso: se não houver membro ativo, o seletor inicia com placeholder obrigatório e o botão Confirmar fica desabilitado (`disabled={!effectivePayerId}`). |
| **F3** | **Distorção no Orçamento Pessoal (Dupla Contabilidade)** | Membro paga R$ 600 no cartão pelo grupo. Seu extrato acusa R$ 600 gastos. Quando recebe os R$ 400 de volta, se lançar como receita bruta, seu faturamento anual fica falso. | **Cálculo de `report_weight` + Baixa Neutra:** A despesa no extrato recebe `report_weight` proporcional à sua cota real (`userShareCents / totalAmountCents`). O valor de R$ 600 permanece na fatura para bater com o banco, mas os relatórios computam apenas os R$ 200 dele. O ressarcimento de R$ 400 entra como Reembolso (peso 0% na receita). |
| **F4** | **Exclusão Inadvertida de Despesa Pessoal do Cartão** | Membro exclui um almoço na viagem e, sem querer, o app apaga a despesa do seu cartão de crédito pessoal, gerando furos na conciliação da fatura. | **Modal Decisório com Opções Explícitas:** Nunca apagar em cascata sem consentimento. O `TripExpenseDeleteDialog` apresenta duas opções claras: (A) *"Excluir da viagem e do meu extrato pessoal"*; (B) *"Excluir apenas da viagem (mantendo o gasto no meu extrato como despesa pessoal avulsa)"*. |
| **F5** | **Exclusão Inadvertida no Extrato Afetando a Viagem** | Usuário organiza suas finanças no extrato pessoal, apaga uma compra e, sem saber, remove a despesa da viagem dos amigos. | **Diálogo Contextual em `ExpenseDetailDialog`:** Se `expense.trip_id` existir, o modal de exclusão avisa: *"Esta despesa faz parte da viagem X"* e permite escolher entre excluir de ambos ou apenas desvincular do extrato mantendo o livro do grupo intacto. |
| **F6** | **Modo Viagem Desativado no Convidado Autenticado** | Amigo aceita o convite no app, mas seu toggle modular de viagem estava desligado (`tripModeEnabled: false`), caindo num EmptyState confuso de "Modo Viagem desativado". | **Ativação Automática Transacional:** A RPC `claim_trip_member` ou a mutation de aceite atualiza automaticamente `custom_settings.tripModeEnabled = true` nas preferências do usuário, garantindo entrada direta na tela de detalhes da viagem sem atritos. |
| **F7** | **Vandalismo de Despesas por Convidados** | Convidado autenticado altera ou apaga despesas lançadas por outro participante. | **RLS Granular por Autor:** Membros comuns só possuem permissão de alteração/exclusão em despesas onde `created_by_member_id` ou `paid_by_member_id` coincida com seu `member_id`. O anfitrião possui permissão administrativa ampla. |
| **F8** | **Acerto Parcial de Dívidas ("Paguei R$ 50 de R$ 100")** | O sistema trava se o amigo transferir apenas parte da dívida em dinheiro ou Pix. | **Liquidação com Valor Flexível:** A RPC `record_trip_settlement` permite registrar pagamentos parciais (`amount_cents <= balance`), recalculando o saldo restante automaticamente. |
| **F9** | **Exclusão de Membro com Transações Ativas** | Anfitrião remove um membro que já pagou despesas ou faz parte de rateios, quebrando o cálculo de compensação líquida. | **Trava de Integridade Referencial:** Ação bloqueada pelo banco (`on delete restrict`) e interface exibe alerta: *"Não é possível remover participante com lançamentos ativos. Reatribua as despesas ou zere as contas antes de excluí-lo."* |
| **F10** | **Cadastramento da Chave Pix Redundante** | Usuário que já tem Pix salvo no perfil do Áxis é forçado a digitar a chave novamente na viagem. | **Auto-População Inteligente:** Ao vincular a conta via `claim_trip_member`, a RPC puxa automaticamente a chave Pix cadastrada em `user_preferences` / `profile`. |
| **F11** | **A "Liquidação Fantasma" (Saldos Estáticos pós-Pix)** | Usuário registra que pagou o amigo via Pix, mas a tela continua dizendo que ele deve o valor integral. | **Incorporação de Settlements no Motor Matemático:** A função `calculateMemberBalances` passa a receber os settlements confirmados/pendentes: para cada acerto, credita o valor ao devedor e debita do credor, convergindo o saldo para R$ 0,00 e limpando as transferências sugeridas. |
| **F12** | **Descompasso de Telas no Restaurante (Sem Realtime)** | Múltiplos amigos lançando compras e transferindo Pix simultaneamente sem atualização das telas alheias. | **Canal Reativo Supabase Realtime (`trip:${tripId}`):** Invalidação automática dirigida por eventos para as tabelas `trip_expenses` e `trip_settlements`, atualizando todos os aparelhos conectados sem necessidade de refresh manual. |
| **F13** | **Falha de Resolução de Categorias no Extrato** | Usuário lança na viagem e manda sincronizar com o extrato, mas não possui a categoria "Viagem" cadastrada na sua conta. | **Resolução Inteligente com Fallback Seguro:** Busca categoria com nome "Viagem" ou "Viagens"; caso ausente, usa categoria compatível ("Outros" ou a primeira disponível), permitindo troca fluida no modal. |

---

## 3. ARQUITETURA DE BANCO DE DADOS (SUPABASE POSTGRES & RPCs)

### 3.1 Migration `20260101000098_trips_multi_user_collaboration_and_sync.sql`

```sql
-- ---------------------------------------------------------------------------
-- 20260101000098_trips_multi_user_collaboration_and_sync.sql
-- Evolução Colaborativa: Vínculo Multi-Contas, RLS Refinado e RPCs Transacionais
-- ---------------------------------------------------------------------------

-- 1. RPC: REIVINDICAR / VINCULAR CONTA DE MEMBRO (claim_trip_member)
create or replace function public.claim_trip_member(
  p_trip_token text,
  p_member_id uuid,
  p_passcode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip record;
  v_member record;
  v_user_pix text;
  v_user_pix_type text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Usuário precisa estar autenticado para vincular conta.';
  end if;

  -- 1. Busca e valida viagem
  select id, passcode_hash, status into v_trip
  from public.trips
  where public_token = p_trip_token;

  if not found then
    raise exception 'NOT_FOUND: Viagem não encontrada para o token informado.';
  end if;

  -- Validação de passcode se configurado
  if v_trip.passcode_hash is not null and v_trip.passcode_hash <> '' then
    if p_passcode is null or crypt(p_passcode, v_trip.passcode_hash) <> v_trip.passcode_hash then
      raise exception 'INVALID_PASSCODE: Código de acesso incorreto.';
    end if;
  end if;

  -- 2. Busca e valida membro
  select id, user_id, trip_id into v_member
  from public.trip_members
  where id = p_member_id and trip_id = v_trip.id;

  if not found then
    raise exception 'NOT_FOUND: Participante não encontrado nesta viagem.';
  end if;

  if v_member.user_id is not null and v_member.user_id <> v_user_id then
    raise exception 'ALREADY_CLAIMED: Este participante já está vinculado a outra conta.';
  end if;

  -- 3. Resgata chave Pix do perfil se disponível
  select 
    custom_settings->>'defaultPixKey',
    custom_settings->>'defaultPixKeyType'
  into v_user_pix, v_user_pix_type
  from public.user_preferences
  where user_id = v_user_id;

  -- 4. Atualiza vínculo do membro
  update public.trip_members
  set 
    user_id = v_user_id,
    pix_key = coalesce(pix_key, v_user_pix),
    pix_key_type = coalesce(pix_key_type, v_user_pix_type)
  where id = p_member_id;

  -- 5. Ativa Modo Viagem nas preferências do usuário
  update public.user_preferences
  set custom_settings = jsonb_set(
    coalesce(custom_settings, '{}'::jsonb),
    '{tripModeEnabled}',
    'true'::jsonb,
    true
  )
  where user_id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'trip_id', v_trip.id,
    'member_id', p_member_id,
    'user_id', v_user_id
  );
end;
$$;

-- 2. RPC: DESVINCULAR CONTA DE MEMBRO (unlink_trip_member)
create or replace function public.unlink_trip_member(
  p_trip_id uuid,
  p_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_host boolean;
  v_target_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Usuário não autenticado.';
  end if;

  -- Verifica se é o host ou o próprio membro
  v_is_host := public.is_trip_host(p_trip_id, v_user_id);
  
  select user_id into v_target_user_id
  from public.trip_members
  where id = p_member_id and trip_id = p_trip_id;

  if not found then
    raise exception 'NOT_FOUND: Membro não encontrado na viagem.';
  end if;

  if not v_is_host and v_target_user_id <> v_user_id then
    raise exception 'PERMISSION_DENIED: Apenas o anfitrião ou o próprio usuário podem desvincular a conta.';
  end if;

  update public.trip_members
  set user_id = null
  where id = p_member_id;

  return jsonb_build_object('success', true, 'member_id', p_member_id);
end;
$$;

-- 3. RPC: EXCLUSÃO SINCRONIZADA DE DESPESA (delete_trip_expense_sync)
create or replace function public.delete_trip_expense_sync(
  p_expense_id uuid,
  p_delete_personal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
  v_personal_id uuid;
  v_creator_user_id uuid;
  v_is_host boolean;
begin
  -- Busca despesa
  select 
    te.trip_id, 
    te.linked_personal_expense_id,
    tm.user_id
  into v_trip_id, v_personal_id, v_creator_user_id
  from public.trip_expenses te
  left join public.trip_members tm on tm.id = te.paid_by_member_id
  where te.id = p_expense_id;

  if not found then
    raise exception 'NOT_FOUND: Despesa de viagem não encontrada.';
  end if;

  v_is_host := public.is_trip_host(v_trip_id, v_user_id);

  if not v_is_host and (v_creator_user_id is null or v_creator_user_id <> v_user_id) then
    raise exception 'PERMISSION_DENIED: Sem permissão para excluir esta despesa.';
  end if;

  -- 1. Exclui a despesa pessoal se solicitado e se pertencer ao usuário
  if p_delete_personal and v_personal_id is not null then
    delete from public.expenses
    where id = v_personal_id and user_id = v_user_id;
  elsif v_personal_id is not null then
    -- Se não excluiu a despesa pessoal, desvincula o trip_id
    update public.expenses
    set trip_id = null
    where id = v_personal_id;
  end if;

  -- 2. Exclui da viagem (cascata remove splits)
  delete from public.trip_expenses
  where id = p_expense_id;

  return jsonb_build_object(
    'success', true,
    'deleted_trip_expense_id', p_expense_id,
    'deleted_personal_expense', p_delete_personal and v_personal_id is not null
  );
end;
$$;

-- 4. AJUSTE DE RLS PARA MEMBROS AUTENTICADOS (trip_members e trip_expenses)
drop policy if exists "trip_members_write_policy" on public.trip_members;
create policy "trip_members_write_policy" on public.trip_members
  for all to authenticated
  using (
    public.is_trip_host(trip_id, (select auth.uid()))
    or user_id = (select auth.uid())
  )
  with check (
    public.is_trip_host(trip_id, (select auth.uid()))
    or user_id = (select auth.uid())
  );
```

---

## 4. DETALHAMENTO DAS FASES DE IMPLEMENTAÇÃO & PORTÕES DE QUALIDADE

### FASE 1: FUNDAÇÃO DE BANCO, RPCS ATÔMICAS E MOTOR DE LIQUIDAÇÃO REAL
* **Etapa 1.1:** Criação da migration `20260101000098_trips_multi_user_collaboration_and_sync.sql` com as 3 RPCs transacionais e políticas RLS de membros.
* **Etapa 1.2:** Evolução matemática em `src/domain/trips/trip-math.ts`:
  - Atualização de `calculateMemberBalances(members, expenses, settlements)` para incorporar os acertos registrados/confirmados.
  - Para cada acerto de R$ X de A para B: `A` reduz seu saldo devedor em R$ X; `B` reduz seu crédito a receber em R$ X.
  - Testes unitários puros cobrindo abatimento gradual e resíduos em `trip-math.test.ts`.
* **Etapa 1.3:** Mapeamento tipado em `src/types/trips.ts` com inputs/outputs das RPCs e payloads de vinculação.
* **Etapa 1.4:** Implementação dos métodos em `src/data/rpc.ts`:
  - `claimTripMemberRpc({ token, memberId, passcode })`
  - `unlinkTripMemberRpc({ tripId, memberId })`
  - `deleteTripExpenseSyncRpc({ expenseId, deletePersonal })`
* **Etapa 1.5:** Atualização do repositório `src/data/repositories/trips.ts` integrando fallback seguro e tratamento no gateway `classifyError`.
* **Etapa 1.6:** Testes unitários de repositório em `src/data/repositories/trips.test.ts`.

> **🏁 PORTÃO DE QUALIDADE 1 (QG1):**
> - `npm run typecheck` sem qualquer apontamento de tipo ou `any`.
> - Testes de repositório e de matemática pura no Vitest passando 100%.
> - Invariante de liquidação comprovada: pagamentos abatem os saldos até zero.
> - RLS validado: participante não-host não pode excluir despesa de terceiro nem editar membros alheios.

---

### FASE 2: IDENTIDADE ATIVA NO LINK PÚBLICO & ONBOARDING CONVERSIVO
* **Etapa 2.1:** Hook de persistência `usePublicTripGuestIdentity` em `src/features/public-share/hooks/`:
  - Lê/escreve chave `axis_guest_member_${token}` no `localStorage`.
  - Provê `activeMemberId`, `setActiveMemberId`, `clearActiveMember`.
* **Etapa 2.2:** Componente `PublicTripIdentityBanner` em `src/features/public-share/components/`:
  - Exibe no topo de `/viagem/:token` a pergunta amigável: *"Quem é você nesta viagem?"* com cards dos membros.
  - Ao selecionar, exibe chip ativo *"Você é [Nome]"* com opção discreta de alterar.
  - Banner para usuários com conta ou convite para criar conta Áxis com sincronização.
* **Etapa 2.3:** Blindagem de `AddPublicTripExpenseDialog`:
  - Eliminação de fallback silencioso para o anfitrião (`host?.id`).
  - Se `activeMemberId` estiver ativo, o pagador é pré-selecionado como "Você ([Nome])".
  - Se não houver identidade ativa, o seletor obriga a escolha de quem pagou, travando o botão de envio enquanto vazio.
* **Etapa 2.4:** Fluxo de Aceite de Vínculo:
  - Se o visitante já estiver logado no navegador, botão em destaque: *"Vincular esta viagem ao meu aplicativo Áxis"*.
  - Ao clicar, executa `claimTripMemberRpc`, exibe toast de sucesso e redireciona para `/viagens/${tripId}` no app.

> **🏁 PORTÃO DE QUALIDADE 2 (QG2):**
> - Teste no Vitest em `add-public-trip-expense-dialog.test.tsx` comprovando que o formulário nunca submete com pagador nulo e nunca assume o host silenciosamente.
> - Responsividade mobile verificada sem esmagamento de botões.
> - Zero emojis em alertas ou toasts (`npm run lint`).

---

### FASE 3: SINCRONIZAÇÃO BIDIRECIONAL DO CICLO DE VIDA DA DESPESA
* **Etapa 3.1:** Diálogo de exclusão coordenada na Viagem (`TripExpenseDeleteDialog`):
  - Criado em `src/features/trips/components/trip-expense-delete-dialog.tsx`.
  - Acionado pelo botão de lixeira em `TripDetailsPage`.
  - Se houver `linked_personal_expense_id`: modal com 2 escolhas (*"Excluir da viagem e do meu extrato"* vs. *"Excluir apenas da viagem"*).
* **Etapa 3.2:** Diálogo de exclusão coordenada no Extrato (`ExpenseDetailDialog`):
  - Atualização em `src/features/transactions/components/expense-detail-dialog.tsx`.
  - Se `expense.trip_id` estiver preenchido, o `ConfirmDialog` detecta o vínculo e oferece exclusão conjunta ou desvinculação mantendo o registro na viagem.
* **Etapa 3.3:** Edição Sincronizada:
  - `EditTripExpenseDialog`: ao alterar valor ou data, se houver vínculo, atualiza a despesa pessoal e invalida o cache de extrato e cartões (`expensesKey`, `cardExpensesKey`).
  - `ExpenseDetailDialog`: ao salvar edição de despesa vinculada à viagem, atualiza `trip_expenses` e recalcula cotas.
* **Etapa 3.4:** Cadastro Cruzado no Assistente de Transações (`LaunchWizard`):
  - Em `src/features/transactions/wizard/launch-wizard.tsx`:
  - Ao selecionar uma viagem ativa no seletor de contexto, identifica automaticamente o `member_id` do usuário logado naquela viagem, evitando imputar no host.

> **🏁 PORTÃO DE QUALIDADE 3 (QG3):**
> - Teste de exclusão mútua no Vitest: remoção limpa sem registros órfãos.
> - Invalidação e atualização instantânea de cache visual sem F5.
> - Testes em `launch-wizard.test.tsx` e `expense-detail-dialog.test.tsx`.

---

### FASE 4: FECHAMENTO SIMÉTRICO E REALTIME ("ABATER")
* **Etapa 4.1:** Reformulação do `TripSettlementDialog`:
  - Em `src/features/trips/components/trip-settlement-dialog.tsx`:
  - **Ótica do Devedor (`netBalance < 0`):**
    * Lista de quem ele deve pagar com valor em centavos e chave Pix Copia e Cola.
    * Botão de Ação: *"Pagar Pix e Registrar no Meu Extrato"*.
    * Lança despesa no extrato pessoal (categoria Viagens, método Pix) e marca o acerto como registrado/concluído.
  - **Ótica do Credor (`netBalance > 0`):**
    * Lista de quem deve pagar a ele com botão de confirmação de recebimento.
    * Ao confirmar, mantém o botão de lançar receita de reembolso no extrato pessoal.
* **Etapa 4.2:** Inscrição em Tempo Real (Supabase Realtime):
  - Canal reativo no hook `useTripDetails` para invalidar a query da viagem instantaneamente ao detectar novos gastos ou acertos.
* **Etapa 4.3:** Resumo de Prestação de Contas (WhatsApp / Exportação):
  - Botão de compartilhamento formatado gerando texto limpo com status de quitação para o grupo.

> **🏁 PORTÃO DE QUALIDADE 4 (QG4):**
> - Invariante matemática de soma zero confirmada nos testes de liquidação.
> - Despesa de acerto lançada no extrato com `report_weight = 1` e método correto.
> - Atualização realtime testada entre duas instâncias.

---

### FASE 5: PERSONALIZAÇÃO CONTEXTUAL DA `TripDetailsPage`
* **Etapa 5.1:** Cockpit de Identidade e Saldo Pessoal (`TripPersonalContextCard`):
  - Criado em `src/features/trips/components/trip-personal-context-card.tsx`.
  - Renderizado no topo da página de detalhes:
    * Badge de Função: *"Organizador"* ou *"Participante Conectado"*.
    * Saldo Pessoal Líquido em destaque com `<MoneyText />` (Verde para a receber, Âmbar para a pagar, Neutro para zerado).
    * Mini-métricas: Total gasto do seu bolso vs. sua cota real consumida.
    * Atalho com filtro: *"Ver apenas meus gastos no cartão"*.
* **Etapa 5.2:** Governança Visual de Ações Administrativas:
  - Botões de perigo/gerenciamento ("Equilibrar Tudo", "Excluir Viagem", "Remover Membro") exibidos exclusivamente para o anfitrião (`isHost: true`).
  - Membro convidado visualiza: "Nova Despesa", "Meu Extrato na Viagem", "Minha Chave Pix" e "Desvincular Minha Conta".
* **Etapa 5.3:** Lista de Membros com Selo de Conexão:
  - Participantes com conta conectada exibem badge discreto com ícone de verificação.

> **🏁 PORTÃO DE QUALIDADE 5 (FINAL):**
> - `npm run test` 100% verde em toda a aplicação.
> - `npm run typecheck` sem erros.
> - `npm run lint` limpo, validando ausência de emojis e estilos ad-hoc.
> - Teste manual nos temas Claro e Escuro, Desktop e Mobile.

---

## 5. EXPERIÊNCIA DO USUÁRIO (UI/UX) & FLUXOS POR PERSONA

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FLUXO A: CONVIDADO SEM CONTA ACESSA O LINK PÚBLICO (/viagem/:token)                             │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Abre o link no navegador do celular (WhatsApp).                                               │
│ 2. Banner pergunta: "Quem é você nesta viagem?" -> Clica em "Lucas".                             │
│ 3. A página salva "Lucas" na memória local do navegador.                                         │
│ 4. O saldo do Lucas (quanto deve ou tem a receber) surge no topo.                                │
│ 5. Ao clicar em "Nova Despesa", o pagador já vem selecionado como "Lucas (Você)".                │
│ 6. Sem chance de atribuir a conta ao Organizador por engano.                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FLUXO B: CONVIDADO COM CONTA ÁXIS OU NOVO CADASTRO                                               │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Convidado com conta abre o link ou faz login através do banner da viagem.                     │
│ 2. Clica em "Vincular à minha conta Áxis" e confirma seu nome.                                   │
│ 3. A viagem passa a aparecer na aba /viagens do seu aplicativo nativo/web.                       │
│ 4. No app, ele vê o Cockpit Personalizado com seu saldo pessoal e gastos no cartão.              │
│ 5. Ao lançar despesas no app, pode marcar "Debitar do meu extrato bancário".                     │
│ 6. Ao final, quita o saldo com o botão "Pagar Pix e Lançar Despesa no Meu Extrato".              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FLUXO C: ANFITRIÃO (ORGANIZADOR DA VIAGEM)                                                       │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Cria a viagem, convida os amigos compartilhando o link público.                               │
│ 2. Acompanha em tempo real quem conectou a conta e quem está na web pública.                     │
│ 3. Mantém poderes de moderação (reatribuir pagador se alguém errou, desvincular conta, etc).     │
│ 4. Ao encerrar a viagem, gera o acerto de contas e recebe comprovantes Pix diretamente.          │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. DEFINITION OF DONE (DOD) & CRITÉRIOS DE ACEITE

1. **Multi-Contas Funcional:** Usuários logados conseguem se vincular à viagem e visualizá-la em `/viagens` e `/viagens/:id`.
2. **Abatimento Matemático Real:** Pagamentos registrados em settlements reduzem o saldo devedor na interface até R$ 0,00.
3. **Zero Imputação Silenciosa no Host:** Nenhum lançamento público é concluído sem pagador explicitamente definido.
4. **Sincronização de Exclusão:** Excluir despesa vinculada abre modal de escolha dupla, sem quebrar extrato nem livro do grupo.
5. **Fechamento Simétrico:** Devedor registra saída no extrato com 1 clique; credor registra reembolso com 1 clique.
6. **Cockpit Contextual Ativo:** Usuário autenticado enxerga seu saldo individual e seus gastos destacados no topo da viagem.
7. **Sincronização em Tempo Real:** Atualizações refletem nos demais aparelhos conectados via canal Realtime.
8. **Integridade de Governança:** Testes automatizados verdes, TypeScript estrito, zero emojis e zero controles nativos.
