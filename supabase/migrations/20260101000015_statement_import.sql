-- Migration: 0015_statement_import.sql
-- Fase 30: Importação e Reconciliação Inteligente de Faturas de Cartão
-- Adiciona rastreamento de statement_hash em expenses e RPC transacional import_statement_expenses.

-- 1. Campos de rastreamento em expenses
ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS statement_hash text,
  ADD COLUMN IF NOT EXISTS imported_from_statement boolean DEFAULT false;

-- 2. Índice único condicional para idempotência absoluta por usuário e cartão
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_user_card_statement_hash 
  ON expenses (user_id, card_id, statement_hash) 
  WHERE statement_hash IS NOT NULL;

-- 3. RPC Transacional para importação segura em lote com validação de invariantes
CREATE OR REPLACE FUNCTION import_statement_expenses(
  p_card_id uuid,
  p_competence_month text,
  p_expenses jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_inserted_count int := 0;
  v_skipped_count int := 0;
  v_expense_id uuid;
  v_date date;
  v_val numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM credit_cards WHERE id = p_card_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Cartão não encontrado ou não pertence ao usuário.';
  END IF;

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
      (v_item->>'category_id')::uuid,
      'credit_card',
      v_val,
      v_val,
      COALESCE((v_item->>'report_weight')::numeric, 1.0),
      v_date,
      p_competence_month,
      v_item->>'description',
      COALESCE((v_item->>'installments_total')::int, 1),
      COALESCE((v_item->>'installment_number')::int, 1),
      v_item->>'statement_hash',
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

  INSERT INTO audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'credit_card',
    p_card_id::text,
    'IMPORT_STATEMENT_BATCH',
    jsonb_build_object(
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
