-- ==============================================================================
-- Migração 0056: Correção e Blindagem dos RPCs de Importação de Extrato
-- ==============================================================================
-- Motivação:
-- A migração 0041 introduziu sobrecargas incorretas de `import_statement_expenses(uuid, jsonb)`
-- e `import_bank_transactions(jsonb)` com tipos inteiros, ausência de base_amount e retorno integer,
-- quebrando as chamadas do cliente e a idempotência anti-duplicação.
--
-- Esta migração:
-- 1. Remove com DROP FUNCTION as sobrecargas quebradas da migração 0041.
-- 2. Recria public.import_statement_expenses(uuid, text, jsonb) RETURNS jsonb com:
--    - Verificação de sessão (auth.uid()) e status ativo do usuário.
--    - Verificação de permissão modular de escrita ('cards').
--    - Validação de propriedade do cartão (credit_cards WHERE id = p_card_id AND user_id = auth.uid()).
--    - Tratamento defensivo de category_id com nullif e fallback seguro (evita invalid input syntax for type uuid: "").
--    - Tratamento numérico correto para valor decimal e base_amount.
--    - Inserção com bill_competence = p_competence_month.
--    - Idempotência ON CONFLICT (user_id, card_id, statement_hash) WHERE statement_hash IS NOT NULL DO NOTHING.
--    - Registro em audit_events e retorno do payload { success, inserted_count, skipped_count }.
-- 3. Recria public.import_bank_transactions(jsonb, jsonb) RETURNS jsonb com:
--    - Verificação de sessão (auth.uid()), status ativo e permissão modular ('transactions').
--    - Tratamento defensivo de categorias e valores com base_amount.
--    - Idempotência para despesas à vista e receitas.
--    - Registro em audit_events e retorno { success, expenses_inserted, expenses_skipped, incomes_inserted, incomes_skipped }.
-- ==============================================================================

-- 1. Remover sobrecargas incorretas da migração 0041
DROP FUNCTION IF EXISTS public.import_statement_expenses(uuid, jsonb);
DROP FUNCTION IF EXISTS public.import_bank_transactions(jsonb);

-- 2. Recriar public.import_statement_expenses canônico
CREATE OR REPLACE FUNCTION public.import_statement_expenses(
  p_card_id uuid,
  p_competence_month text,
  p_expenses jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_inserted_count integer := 0;
  v_skipped_count integer := 0;
  v_expense_id uuid;
  v_date date;
  v_val numeric;
  v_cat_id uuid;
  v_fallback_cat_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  IF NOT public.can_current_user_write_module('cards') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Cartões de Crédito requerida.';
  END IF;

  -- Valida posse do cartão
  IF NOT EXISTS (SELECT 1 FROM public.credit_cards WHERE id = p_card_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Cartão de crédito não encontrado ou não pertence ao usuário: %', p_card_id;
  END IF;

  -- Obtém categoria padrão de despesa do usuário como fallback resiliente
  SELECT id INTO v_fallback_cat_id
  FROM public.categories
  WHERE user_id = v_user_id AND type = 'expense'
  ORDER BY name ASC
  LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_expenses)
  LOOP
    v_date := (v_item->>'date')::date;
    v_val := (v_item->>'value')::numeric;

    IF v_date IS NULL OR v_date < '2026-01-01'::date THEN
      RAISE EXCEPTION 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
    END IF;

    IF v_val IS NULL OR v_val <= 0 THEN
      RAISE EXCEPTION 'Valor de despesa deve ser estritamente positivo: %', v_val;
    END IF;

    -- Tratamento defensivo de UUID (evita crash com strings vazias "")
    v_cat_id := NULLIF(v_item->>'category_id', '')::uuid;

    -- Se a categoria for nula ou não pertencer ao usuário, usa o fallback seguro
    IF v_cat_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.categories WHERE id = v_cat_id AND user_id = v_user_id
    ) THEN
      v_cat_id := v_fallback_cat_id;
    END IF;

    IF v_cat_id IS NULL THEN
      RAISE EXCEPTION 'Nenhuma categoria de despesa disponível para associação.';
    END IF;

    INSERT INTO public.expenses (
      user_id,
      card_id,
      category_id,
      payment_method,
      value,
      base_amount,
      report_weight,
      date,
      bill_competence,
      description,
      installments_total,
      installment_number,
      statement_hash,
      imported_from_statement
    ) VALUES (
      v_user_id,
      p_card_id,
      v_cat_id,
      'credit_card',
      v_val,
      v_val,
      COALESCE((v_item->>'report_weight')::numeric, 1.0),
      v_date,
      p_competence_month,
      COALESCE(v_item->>'description', 'Despesa importada'),
      COALESCE((v_item->>'installments_total')::integer, 1),
      COALESCE((v_item->>'installment_number')::integer, 1),
      NULLIF(v_item->>'statement_hash', ''),
      true
    )
    ON CONFLICT (user_id, card_id, statement_hash) WHERE statement_hash IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_expense_id;

    IF v_expense_id IS NOT NULL THEN
      v_inserted_count := v_inserted_count + 1;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'expenses',
    p_card_id::text,
    'import_statement',
    jsonb_build_object(
      'card_id', p_card_id,
      'competence_month', p_competence_month,
      'inserted_count', v_inserted_count,
      'skipped_count', v_skipped_count,
      'total_received', jsonb_array_length(p_expenses)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'skipped_count', v_skipped_count
  );
END;
$$;

-- 3. Recriar public.import_bank_transactions canônico
CREATE OR REPLACE FUNCTION public.import_bank_transactions(
  p_expenses jsonb,
  p_incomes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_exp_inserted int := 0;
  v_exp_skipped int := 0;
  v_inc_inserted int := 0;
  v_inc_skipped int := 0;
  v_id uuid;
  v_date date;
  v_val numeric;
  v_cat_id uuid;
  v_fallback_exp_cat_id uuid;
  v_fallback_inc_cat_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  IF NOT public.can_current_user_write_module('transactions') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Transações requerida.';
  END IF;

  -- Fallbacks defensivos
  SELECT id INTO v_fallback_exp_cat_id
  FROM public.categories
  WHERE user_id = v_user_id AND type = 'expense'
  ORDER BY name ASC LIMIT 1;

  SELECT id INTO v_fallback_inc_cat_id
  FROM public.categories
  WHERE user_id = v_user_id AND type = 'income'
  ORDER BY name ASC LIMIT 1;

  -- 1. Importar despesas à vista
  IF p_expenses IS NOT NULL AND jsonb_array_length(p_expenses) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_expenses)
    LOOP
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;

      IF v_date IS NULL OR v_date < '2026-01-01'::date THEN
        RAISE EXCEPTION 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
      END IF;

      IF v_val IS NULL OR v_val <= 0 THEN
        RAISE EXCEPTION 'Valor de despesa deve ser estritamente positivo: %', v_val;
      END IF;

      v_cat_id := NULLIF(v_item->>'category_id', '')::uuid;
      IF v_cat_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.categories WHERE id = v_cat_id AND user_id = v_user_id
      ) THEN
        v_cat_id := v_fallback_exp_cat_id;
      END IF;

      IF v_cat_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma categoria de despesa disponível para associação.';
      END IF;

      INSERT INTO public.expenses (
        user_id,
        category_id,
        payment_method,
        value,
        base_amount,
        report_weight,
        date,
        description,
        installments_total,
        installment_number,
        statement_hash,
        imported_from_statement
      ) VALUES (
        v_user_id,
        v_cat_id,
        COALESCE(NULLIF(v_item->>'payment_method', '')::public.payment_method, 'pix'),
        v_val,
        v_val,
        COALESCE((v_item->>'report_weight')::numeric, 1.0),
        v_date,
        COALESCE(v_item->>'description', 'Despesa importada'),
        1,
        1,
        NULLIF(v_item->>'statement_hash', ''),
        true
      )
      ON CONFLICT (user_id, statement_hash) WHERE card_id IS NULL AND statement_hash IS NOT NULL
      DO NOTHING
      RETURNING id INTO v_id;

      IF v_id IS NOT NULL THEN
        v_exp_inserted := v_exp_inserted + 1;
      ELSE
        v_exp_skipped := v_exp_skipped + 1;
      END IF;
    END LOOP;
  END IF;

  -- 2. Importar receitas à vista
  IF p_incomes IS NOT NULL AND jsonb_array_length(p_incomes) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_incomes)
    LOOP
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;

      IF v_date IS NULL OR v_date < '2026-01-01'::date THEN
        RAISE EXCEPTION 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
      END IF;

      IF v_val IS NULL OR v_val <= 0 THEN
        RAISE EXCEPTION 'Valor de receita deve ser estritamente positivo: %', v_val;
      END IF;

      v_cat_id := NULLIF(v_item->>'category_id', '')::uuid;
      IF v_cat_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.categories WHERE id = v_cat_id AND user_id = v_user_id
      ) THEN
        v_cat_id := v_fallback_inc_cat_id;
      END IF;

      IF v_cat_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma categoria de receita disponível para associação.';
      END IF;

      INSERT INTO public.incomes (
        user_id,
        category_id,
        receive_type,
        value,
        date,
        description,
        statement_hash,
        imported_from_statement
      ) VALUES (
        v_user_id,
        v_cat_id,
        COALESCE(NULLIF(v_item->>'receive_type', '')::public.receive_type, 'pix'),
        v_val,
        v_date,
        COALESCE(v_item->>'description', 'Receita importada'),
        NULLIF(v_item->>'statement_hash', ''),
        true
      )
      ON CONFLICT (user_id, statement_hash) WHERE statement_hash IS NOT NULL
      DO NOTHING
      RETURNING id INTO v_id;

      IF v_id IS NOT NULL THEN
        v_inc_inserted := v_inc_inserted + 1;
      ELSE
        v_inc_skipped := v_inc_skipped + 1;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'transactions',
    v_user_id::text,
    'import_bank_statement',
    jsonb_build_object(
      'expenses_inserted', v_exp_inserted,
      'expenses_skipped', v_exp_skipped,
      'incomes_inserted', v_inc_inserted,
      'incomes_skipped', v_inc_skipped
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'expenses_inserted', v_exp_inserted,
    'expenses_skipped', v_exp_skipped,
    'incomes_inserted', v_inc_inserted,
    'incomes_skipped', v_inc_skipped
  );
END;
$$;
