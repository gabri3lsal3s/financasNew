-- Migration: 0017_bank_statement_import.sql
-- Fase 34: Importação e Reconciliação Inteligente de Extratos Bancários (Conta Corrente / PIX / TED)
-- Adiciona rastreamento de statement_hash em incomes, índice para despesas à vista e RPC import_bank_transactions.

-- 1. Campos de rastreamento em incomes
ALTER TABLE incomes 
  ADD COLUMN IF NOT EXISTS statement_hash text,
  ADD COLUMN IF NOT EXISTS imported_from_statement boolean DEFAULT false;

-- 2. Índice único condicional para idempotência de receitas
CREATE UNIQUE INDEX IF NOT EXISTS idx_incomes_user_statement_hash 
  ON incomes (user_id, statement_hash) 
  WHERE statement_hash IS NOT NULL;

-- 3. Índice único condicional para idempotência de despesas de conta corrente / à vista
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_user_cash_statement_hash 
  ON expenses (user_id, statement_hash) 
  WHERE card_id IS NULL AND statement_hash IS NOT NULL;

-- 4. RPC Transacional para importação segura e atômica de despesas e receitas
CREATE OR REPLACE FUNCTION import_bank_transactions(
  p_expenses jsonb,
  p_incomes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_exp_inserted int := 0;
  v_exp_skipped int := 0;
  v_inc_inserted int := 0;
  v_inc_skipped int := 0;
  v_exp_id uuid;
  v_inc_id uuid;
  v_date date;
  v_val numeric;
  v_inc_category_id uuid;
  v_receive_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- 1. Processa Despesas (Saídas de Conta Corrente / PIX / Débito / Boleto)
  IF p_expenses IS NOT NULL AND jsonb_typeof(p_expenses) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_expenses)
    LOOP
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;

      IF v_date < '2026-01-01'::date THEN
        RAISE EXCEPTION 'Data de lançamento anterior a 2026-01-01: %', v_date;
      END IF;

      IF v_val <= 0 THEN
        RAISE EXCEPTION 'Valor de despesa deve ser estritamente positivo: %', v_val;
      END IF;

      INSERT INTO expenses (
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
        (v_item->>'category_id')::uuid,
        COALESCE(v_item->>'payment_method', 'cash'),
        v_val,
        v_val,
        COALESCE((v_item->>'report_weight')::numeric, 1.0),
        v_date,
        v_item->>'description',
        1,
        1,
        v_item->>'statement_hash',
        true
      )
      ON CONFLICT (user_id, statement_hash) WHERE card_id IS NULL AND statement_hash IS NOT NULL
      DO NOTHING
      RETURNING id INTO v_exp_id;

      IF v_exp_id IS NOT NULL THEN
        v_exp_inserted := v_exp_inserted + 1;
      ELSE
        v_exp_skipped := v_exp_skipped + 1;
      END IF;
    END LOOP;
  END IF;

  -- 2. Processa Receitas (Entradas de Conta Corrente / Salário / PIX / TED)
  IF p_incomes IS NOT NULL AND jsonb_typeof(p_incomes) = 'array' THEN
    -- Categoria de receita padrão do usuário se não informada
    SELECT id INTO v_inc_category_id
    FROM categories
    WHERE user_id = v_user_id AND type = 'income'
    ORDER BY is_reserved DESC, created_at ASC
    LIMIT 1;

    IF v_inc_category_id IS NULL THEN
      INSERT INTO categories (user_id, type, name, is_reserved)
      VALUES (v_user_id, 'income', 'Outros', true)
      RETURNING id INTO v_inc_category_id;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_incomes)
    LOOP
      v_date := (v_item->>'date')::date;
      v_val := (v_item->>'value')::numeric;

      IF v_date < '2026-01-01'::date THEN
        RAISE EXCEPTION 'Data de lançamento anterior a 2026-01-01: %', v_date;
      END IF;

      IF v_val <= 0 THEN
        RAISE EXCEPTION 'Valor de receita deve ser estritamente positivo: %', v_val;
      END IF;

      v_receive_type := CASE 
        WHEN lower(COALESCE(v_item->>'receive_type', '')) IN ('pix') THEN 'pix'
        WHEN lower(COALESCE(v_item->>'receive_type', '')) IN ('ted', 'doc', 'transfer', 'transferencia', 'transferência') THEN 'transfer'
        WHEN lower(COALESCE(v_item->>'receive_type', '')) IN ('cash', 'dinheiro') THEN 'cash'
        ELSE 'other'
      END;

      INSERT INTO incomes (
        user_id,
        category_id,
        value,
        date,
        description,
        receive_type,
        report_weight,
        statement_hash,
        imported_from_statement
      ) VALUES (
        v_user_id,
        COALESCE((v_item->>'category_id')::uuid, v_inc_category_id),
        v_val,
        v_date,
        v_item->>'description',
        v_receive_type,
        1.0,
        v_item->>'statement_hash',
        true
      )
      ON CONFLICT (user_id, statement_hash) WHERE statement_hash IS NOT NULL
      DO NOTHING
      RETURNING id INTO v_inc_id;

      IF v_inc_id IS NOT NULL THEN
        v_inc_inserted := v_inc_inserted + 1;
      ELSE
        v_inc_skipped := v_inc_skipped + 1;
      END IF;
    END LOOP;
  END IF;

  -- 3. Auditoria única
  INSERT INTO audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'bank_account',
    v_user_id::text,
    'IMPORT_BANK_STATEMENT_BATCH',
    jsonb_build_object(
      'expenses_inserted', v_exp_inserted,
      'expenses_skipped', v_exp_skipped,
      'incomes_inserted', v_inc_inserted,
      'incomes_skipped', v_inc_skipped,
      'total_expenses_received', COALESCE(jsonb_array_length(p_expenses), 0),
      'total_incomes_received', COALESCE(jsonb_array_length(p_incomes), 0)
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
