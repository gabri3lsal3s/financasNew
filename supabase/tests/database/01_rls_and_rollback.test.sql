BEGIN;
SELECT plan(15);

-- ============================================================================
-- AUDITORIA PGTAP: ISOLAMENTO RLS E ROLLBACK DE RPCS TRANSACIONAIS
-- ============================================================================

-- 1. Verificação de Habilitação do Row Level Security (RLS)
SELECT ok(
    (SELECT bool_and(relrowsecurity) 
     FROM pg_class c 
     JOIN pg_namespace n ON n.oid = c.relnamespace 
     WHERE n.nspname = 'public' 
       AND c.relkind = 'r' 
       AND c.relname IN ('expenses', 'incomes', 'credit_cards', 'debts', 'categories', 'budgets', 'profiles', 'audit_events')),
    'RLS deve estar habilitado em todas as tabelas de dados do usuário'
);

-- 2. Verificação de Presença de Políticas RLS nas Tabelas Primárias
SELECT policies_are(
    'public', 'expenses',
    ARRAY[
        'expenses_select_policy',
        'expenses_insert_policy',
        'expenses_update_policy',
        'expenses_delete_policy'
    ],
    'A tabela expenses deve conter políticas isoladas para todas as operações CRUD'
);

SELECT policies_are(
    'public', 'debts',
    ARRAY[
        'debts_select_policy',
        'debts_insert_policy',
        'debts_update_policy',
        'debts_delete_policy'
    ],
    'A tabela debts deve conter políticas isoladas para todas as operações CRUD'
);

-- 3. Verificação de Existência das RPCs Transacionais
SELECT has_function('public', 'create_expense_with_debt', 'A RPC transacional create_expense_with_debt deve existir');
SELECT has_function('public', 'delete_expense_installments', 'A RPC transacional delete_expense_installments deve existir');
SELECT has_function('public', 'pay_debt', 'A RPC transacional pay_debt deve existir');
SELECT has_function('public', 'receive_debt', 'A RPC transacional receive_debt deve existir');
SELECT has_function('public', 'import_bank_transactions', 'A RPC transacional import_bank_transactions deve existir');

-- ============================================================================
-- CENÁRIOS DE TESTE: ISOLAMENTO ENTRE TENANTS (RLS)
-- ============================================================================

-- Mock de usuários de teste
DO $$
DECLARE
    user_a_id uuid := 'aaaaaaaa-1111-4111-a111-111111111111'::uuid;
    user_b_id uuid := 'bbbbbbbb-2222-4222-b222-222222222222'::uuid;
BEGIN
    -- Limpa registros residuais de testes
    DELETE FROM public.expenses WHERE user_id IN (user_a_id, user_b_id);
    DELETE FROM public.debts WHERE user_id IN (user_a_id, user_b_id);
    DELETE FROM public.categories WHERE user_id IN (user_a_id, user_b_id);

    -- Insere categorias base
    INSERT INTO public.categories (id, user_id, name, type)
    VALUES ('11111111-1111-1111-1111-111111111111'::uuid, user_a_id, 'Alimentação A', 'expense');

    INSERT INTO public.categories (id, user_id, name, type)
    VALUES ('22222222-2222-2222-2222-222222222222'::uuid, user_b_id, 'Lazer B', 'expense');

    -- Insere dados do usuário A
    INSERT INTO public.expenses (id, user_id, category_id, value, date, description)
    VALUES ('33333333-3333-3333-3333-333333333333'::uuid, user_a_id, '11111111-1111-1111-1111-111111111111'::uuid, 15000, '2026-05-10', 'Almoço A');
END $$;

-- Simula sessão autenticada do Usuário B
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'bbbbbbbb-2222-4222-b222-222222222222';

-- O Usuário B não deve conseguir ler a despesa do Usuário A
SELECT is_empty(
    $$ SELECT * FROM public.expenses WHERE user_id = 'aaaaaaaa-1111-4111-a111-111111111111'::uuid $$,
    'Usuário B não tem permissão para visualizar despesas do Usuário A (RLS Select)'
);

-- O Usuário B não deve conseguir alterar a despesa do Usuário A
UPDATE public.expenses 
SET value = 99999 
WHERE id = '33333333-3333-3333-3333-333333333333'::uuid;

SELECT isnt(
    (SELECT value FROM public.expenses WHERE id = '33333333-3333-3333-3333-333333333333'::uuid),
    99999,
    'Usuário B não tem permissão para alterar despesas do Usuário A (RLS Update)'
);

-- ============================================================================
-- CENÁRIOS DE TESTE: ROLLBACK DE RPCs TRANSACIONAIS (ATOMICIDADE ACID)
-- ============================================================================

-- Simula sessão autenticada do Usuário A
SET LOCAL "request.jwt.claim.sub" = 'aaaaaaaa-1111-4111-a111-111111111111';

-- 1. Teste de Rollback em create_expense_with_debt
-- Tentativa de chamada com parâmetros inválidos (ex.: soma das parcelas divergente ou categoria inexistente)
-- deve lançar exceção e não deixar NENHUMA despesa ou dívida órfã inserida.
SELECT throws_ok(
    $$
    SELECT public.create_expense_with_debt(
        p_value := 20000,
        p_date := '2026-05-10'::date,
        p_category_id := '99999999-9999-9999-9999-999999999999'::uuid, -- Categoria inválida/inexistente
        p_installments := '[{"id": "44444444-4444-4444-4444-444444444444", "value": 20000, "date": "2026-05-10"}]'::jsonb,
        p_debt_name := 'Dívida Fantasma',
        p_debt_amount := 20000
    )
    $$,
    NULL,
    'create_expense_with_debt deve abortar com exceção quando parâmetros forem inválidos'
);

SELECT is_empty(
    $$ SELECT * FROM public.expenses WHERE id = '44444444-4444-4444-4444-444444444444'::uuid $$,
    'Rollback garantido: a parcela intermediária foi revertida integralmente da tabela expenses'
);

SELECT is_empty(
    $$ SELECT * FROM public.debts WHERE name = 'Dívida Fantasma' $$,
    'Rollback garantido: nenhuma dívida foi persistida na falha transacional'
);

-- 2. Teste de Fail-Closed para RPC anônima
SET LOCAL ROLE anon;
RESET "request.jwt.claim.sub";

SELECT throws_ok(
    $$
    SELECT public.create_expense_with_debt(
        p_value := 10000,
        p_date := '2026-05-10'::date,
        p_category_id := '11111111-1111-1111-1111-111111111111'::uuid,
        p_installments := '[{"id": "55555555-5555-5555-5555-555555555555", "value": 10000, "date": "2026-05-10"}]'::jsonb
    )
    $$,
    NULL,
    'Sessão anônima não autenticada deve ser rejeitada com exceção no topo da RPC'
);

SELECT is_empty(
    $$ SELECT * FROM public.expenses WHERE id = '55555555-5555-5555-5555-555555555555'::uuid $$,
    'Nenhum dado é gravado por chamadas não autenticadas'
);

SELECT * FROM finish();
ROLLBACK;
