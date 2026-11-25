-- =============================================================================
-- Migration 0155: Commit Transacional Único de Conciliação de Fatura
-- =============================================================================
-- Implementa a Onda 1 (P0) do PLANO_REESTRUTURACAO_CANONICA_IMPORTACAO_FATURA:
--   1. Coluna `statement_hash` e índice único parcial em `public.card_payments`
--      para idempotência absoluta de estornos importados.
--   2. Índice único parcial de parcelas em `public.expenses`:
--      `(user_id, card_id, installment_group_id, installment_number)`
--      WHERE card_id IS NOT NULL AND installment_group_id IS NOT NULL.
--   3. RPC transacional `public.commit_statement_reconciliation`:
--      - Executa Blocos A..E em 1 única transação PostgreSQL;
--      - Protege fatura rolada (bloqueia escrita) vs quitada (bloqueia A/B/C);
--      - Exclusão cirúrgica estritamente por `id` (nunca cascadeia irmãs);
--      - Obriga `installment_group_id` em toda parcela > 1;
--      - Trata colisões em ambos os índices únicos parciais de forma idempotente;
--      - Pareia estornos com renda automática somente-leitura na categoria "Estorno".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Idempotência de estornos em public.card_payments
-- -----------------------------------------------------------------------------
ALTER TABLE public.card_payments
  ADD COLUMN IF NOT EXISTS statement_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_card_payments_user_card_statement_hash
  ON public.card_payments (user_id, card_id, statement_hash)
  WHERE statement_hash IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Índice único parcial de parcelas em public.expenses
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_user_card_installment_unique
  ON public.expenses (user_id, card_id, installment_group_id, installment_number)
  WHERE card_id IS NOT NULL AND installment_group_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. RPC: public.commit_statement_reconciliation
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.commit_statement_reconciliation(
  uuid, text, jsonb, jsonb, jsonb, jsonb, uuid[]
);

CREATE OR REPLACE FUNCTION public.commit_statement_reconciliation(
  p_card_id uuid,
  p_competence_month text,
  p_expenses jsonb DEFAULT '[]'::jsonb,
  p_link_adjustments jsonb DEFAULT '[]'::jsonb,
  p_competence_moves jsonb DEFAULT '[]'::jsonb,
  p_refunds jsonb DEFAULT '[]'::jsonb,
  p_delete_expense_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_card_scope text;
  v_fallback_cat_id uuid;
  v_reserved_charges_cat_id uuid;
  v_refund_cat_id uuid;

  v_inserted_count integer := 0;
  v_projected_count integer := 0;
  v_skipped_count integer := 0;
  v_adjusted_count integer := 0;
  v_moved_count integer := 0;
  v_refunds_count integer := 0;
  v_deleted_count integer := 0;

  v_expenses_arr jsonb := coalesce(p_expenses, '[]'::jsonb);
  v_adjustments_arr jsonb := coalesce(p_link_adjustments, '[]'::jsonb);
  v_moves_arr jsonb := coalesce(p_competence_moves, '[]'::jsonb);
  v_refunds_arr jsonb := coalesce(p_refunds, '[]'::jsonb);
  v_delete_ids uuid[] := coalesce(p_delete_expense_ids, '{}'::uuid[]);

  v_del_id uuid;
  v_del_exp record;
  v_item jsonb;
  v_exp_id uuid;
  v_exp_row record;
  v_new_val numeric;
  v_new_hash text;
  v_target_comp text;

  v_date date;
  v_val numeric;
  v_cat_id uuid;
  v_charge_kind text;
  v_inst_total integer;
  v_inst_num integer;
  v_inst_group_id uuid;
  v_report_weight numeric;
  v_bill_comp text;
  v_scope text;
  v_is_deductible boolean;
  v_is_projected boolean;
  v_inserted_expense_id uuid;

  v_ref_amount numeric;
  v_ref_date date;
  v_ref_comp text;
  v_ref_note text;
  v_ref_hash text;
  v_payment_id uuid;

  v_is_comp_locked boolean := false;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Validações de autenticação, acesso e contexto do cartão
  -- ---------------------------------------------------------------------------
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  END IF;

  IF NOT public.can_current_user_write_module('cards') THEN
    RAISE EXCEPTION 'Acesso negado: permissão de escrita em Cartões de Crédito requerida.';
  END IF;

  IF p_competence_month IS NULL OR p_competence_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Competência inválida (esperado YYYY-MM): %', coalesce(p_competence_month, '<null>');
  END IF;

  IF jsonb_typeof(v_expenses_arr) <> 'array'
     OR jsonb_typeof(v_adjustments_arr) <> 'array'
     OR jsonb_typeof(v_moves_arr) <> 'array'
     OR jsonb_typeof(v_refunds_arr) <> 'array' THEN
    RAISE EXCEPTION 'Payloads de conciliação devem ser arrays JSON válidos.';
  END IF;

  SELECT coalesce(scope, 'personal')
    INTO v_card_scope
    FROM public.credit_cards
   WHERE id = p_card_id AND user_id = v_user_id;

  IF v_card_scope IS NULL THEN
    RAISE EXCEPTION 'Cartão de crédito não encontrado ou não pertence ao usuário: %', p_card_id;
  END IF;

  -- D14: Fatura rolada/refinanciada bloqueia escrita na competência alvo
  IF EXISTS (
    SELECT 1
      FROM public.card_bill_rollovers r
     WHERE r.card_id = p_card_id
       AND r.user_id = v_user_id
       AND r.from_competence_month = p_competence_month
  ) THEN
    RAISE EXCEPTION 'Esta fatura já foi rolada/refinanciada e não permite importação.';
  END IF;

  -- ---------------------------------------------------------------------------
  -- BLOCO A: Exclusão estritamente cirúrgica por id (D9 / G11 / D14)
  -- ---------------------------------------------------------------------------
  FOREACH v_del_id IN ARRAY v_delete_ids
  LOOP
    IF v_del_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id, bill_competence
      INTO v_del_exp
      FROM public.expenses
     WHERE id = v_del_id
       AND user_id = v_user_id
       AND card_id = p_card_id;

    -- Retry idempotente de lote: se já foi removida, segue sem abortar
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_del_exp.bill_competence IS NOT NULL THEN
      v_is_comp_locked :=
        EXISTS (
          SELECT 1 FROM public.card_bill_rollovers r
           WHERE r.card_id = p_card_id
             AND r.user_id = v_user_id
             AND r.from_competence_month = v_del_exp.bill_competence
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.card_payments cp
             WHERE cp.card_id = p_card_id
               AND cp.user_id = v_user_id
               AND cp.competence_month = v_del_exp.bill_competence
          )
          AND public.get_card_bill_open_balance(p_card_id, v_del_exp.bill_competence) = 0
        );

      IF v_is_comp_locked THEN
        RAISE EXCEPTION 'Não é possível excluir despesas de uma fatura já quitada ou rolada.';
      END IF;
    END IF;

    -- Remove apenas dívidas pendentes vinculadas estritamente a esta despesa
    DELETE FROM public.debts
     WHERE user_id = v_user_id
       AND expense_id = v_del_id
       AND paid_at IS NULL;

    -- Exclusão estrita pelo ID único (jamais cascadeia parcelas irmãs)
    DELETE FROM public.expenses
     WHERE id = v_del_id
       AND user_id = v_user_id
       AND card_id = p_card_id;

    IF FOUND THEN
      v_deleted_count := v_deleted_count + 1;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- BLOCO B: Ajustes de valor com vínculo existente (G7 / G11 / D14)
  -- ---------------------------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_adjustments_arr)
  LOOP
    v_exp_id := nullif(v_item->>'expense_id', '')::uuid;
    v_new_val := (v_item->>'new_value')::numeric;
    v_new_hash := nullif(v_item->>'statement_hash', '');

    IF v_exp_id IS NULL THEN
      RAISE EXCEPTION 'expense_id obrigatório em p_link_adjustments.';
    END IF;

    IF v_new_val IS NULL OR v_new_val <= 0 THEN
      RAISE EXCEPTION 'Valor ajustado deve ser maior que zero: %', v_new_val;
    END IF;

    SELECT id, bill_competence
      INTO v_exp_row
      FROM public.expenses
     WHERE id = v_exp_id
       AND user_id = v_user_id
       AND card_id = p_card_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Despesa para ajuste não encontrada ou não pertence ao cartão: %', v_exp_id;
    END IF;

    IF v_exp_row.bill_competence IS NOT NULL THEN
      v_is_comp_locked :=
        EXISTS (
          SELECT 1 FROM public.card_bill_rollovers r
           WHERE r.card_id = p_card_id
             AND r.user_id = v_user_id
             AND r.from_competence_month = v_exp_row.bill_competence
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.card_payments cp
             WHERE cp.card_id = p_card_id
               AND cp.user_id = v_user_id
               AND cp.competence_month = v_exp_row.bill_competence
          )
          AND public.get_card_bill_open_balance(p_card_id, v_exp_row.bill_competence) = 0
        );

      IF v_is_comp_locked THEN
        RAISE EXCEPTION 'Não é possível ajustar valores de uma fatura já quitada ou rolada.';
      END IF;
    END IF;

    IF v_new_hash IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.expenses
       WHERE user_id = v_user_id
         AND card_id = p_card_id
         AND statement_hash = v_new_hash
         AND id <> v_exp_id
    ) THEN
      v_new_hash := NULL;
    END IF;

    UPDATE public.expenses
       SET value = v_new_val,
           base_amount = v_new_val,
           statement_hash = coalesce(v_new_hash, statement_hash)
     WHERE id = v_exp_id
       AND user_id = v_user_id
       AND card_id = p_card_id;

    v_adjusted_count := v_adjusted_count + 1;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- BLOCO C: Movimentação de competência vizinha (D2 / D14)
  -- ---------------------------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_moves_arr)
  LOOP
    v_exp_id := nullif(v_item->>'expense_id', '')::uuid;
    v_target_comp := coalesce(nullif(v_item->>'target_competence', ''), p_competence_month);
    v_new_hash := nullif(v_item->>'statement_hash', '');

    IF v_exp_id IS NULL THEN
      RAISE EXCEPTION 'expense_id obrigatório em p_competence_moves.';
    END IF;

    IF v_target_comp !~ '^\d{4}-\d{2}$' THEN
      RAISE EXCEPTION 'Competência destino inválida em p_competence_moves: %', v_target_comp;
    END IF;

    SELECT id, bill_competence
      INTO v_exp_row
      FROM public.expenses
     WHERE id = v_exp_id
       AND user_id = v_user_id
       AND card_id = p_card_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Despesa para movimentação não encontrada ou não pertence ao cartão: %', v_exp_id;
    END IF;

    -- Verifica bloqueio tanto na competência de origem quanto na de destino
    IF v_exp_row.bill_competence IS NOT NULL THEN
      v_is_comp_locked :=
        EXISTS (
          SELECT 1 FROM public.card_bill_rollovers r
           WHERE r.card_id = p_card_id
             AND r.user_id = v_user_id
             AND r.from_competence_month = v_exp_row.bill_competence
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.card_payments cp
             WHERE cp.card_id = p_card_id
               AND cp.user_id = v_user_id
               AND cp.competence_month = v_exp_row.bill_competence
          )
          AND public.get_card_bill_open_balance(p_card_id, v_exp_row.bill_competence) = 0
        );

      IF v_is_comp_locked THEN
        RAISE EXCEPTION 'Não é possível mover despesa de uma fatura de origem já quitada ou rolada.';
      END IF;
    END IF;

    v_is_comp_locked :=
      EXISTS (
        SELECT 1 FROM public.card_bill_rollovers r
         WHERE r.card_id = p_card_id
           AND r.user_id = v_user_id
           AND r.from_competence_month = v_target_comp
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.card_payments cp
           WHERE cp.card_id = p_card_id
             AND cp.user_id = v_user_id
             AND cp.competence_month = v_target_comp
        )
        AND public.get_card_bill_open_balance(p_card_id, v_target_comp) = 0
      );

    IF v_is_comp_locked THEN
      RAISE EXCEPTION 'Não é possível mover despesa para uma fatura destino já quitada ou rolada.';
    END IF;

    IF v_new_hash IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.expenses
       WHERE user_id = v_user_id
         AND card_id = p_card_id
         AND statement_hash = v_new_hash
         AND id <> v_exp_id
    ) THEN
      v_new_hash := NULL;
    END IF;

    UPDATE public.expenses
       SET bill_competence = v_target_comp,
           statement_hash = coalesce(v_new_hash, statement_hash)
     WHERE id = v_exp_id
       AND user_id = v_user_id
       AND card_id = p_card_id;

    v_moved_count := v_moved_count + 1;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- BLOCO D: Novas despesas + parcelas futuras projetadas (G9 / D12 / D14)
  -- ---------------------------------------------------------------------------
  IF jsonb_array_length(v_expenses_arr) > 0 THEN
    SELECT id INTO v_reserved_charges_cat_id
      FROM public.categories
     WHERE user_id = v_user_id
       AND type = 'expense'
       AND name = 'Tarifas e Encargos'
     LIMIT 1;

    SELECT id INTO v_fallback_cat_id
      FROM public.categories
     WHERE user_id = v_user_id
       AND type = 'expense'
     ORDER BY name ASC
     LIMIT 1;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_expenses_arr)
  LOOP
    v_date := (v_item->>'date')::date;
    v_val := (v_item->>'value')::numeric;

    IF v_date IS NULL OR v_date < DATE '2026-01-01' THEN
      RAISE EXCEPTION 'Data de lançamento inválida ou anterior a 2026-01-01: %', v_date;
    END IF;

    IF v_val IS NULL OR v_val <= 0 THEN
      RAISE EXCEPTION 'Valor de despesa deve ser estritamente positivo: %', v_val;
    END IF;

    v_inst_total := coalesce((v_item->>'installments_total')::integer, 1);
    v_inst_num := coalesce((v_item->>'installment_number')::integer, 1);

    IF v_inst_total < 1 OR v_inst_total > 60 THEN
      RAISE EXCEPTION 'Total de parcelas fora do limite (1..60): %', v_inst_total;
    END IF;

    IF v_inst_num < 1 OR v_inst_num > v_inst_total THEN
      RAISE EXCEPTION 'Número de parcela inválido (%/%).', v_inst_num, v_inst_total;
    END IF;

    -- Contrato obrigatório da constraint CHECK ((installments_total > 1) = (installment_group_id IS NOT NULL))
    IF v_inst_total > 1 THEN
      v_inst_group_id := coalesce(nullif(v_item->>'installment_group_id', '')::uuid, gen_random_uuid());
    ELSE
      v_inst_group_id := NULL;
    END IF;

    v_report_weight := coalesce((v_item->>'report_weight')::numeric, 1.0);
    IF v_report_weight < 0 OR v_report_weight > 1 THEN
      RAISE EXCEPTION 'report_weight fora do intervalo (0..1): %', v_report_weight;
    END IF;

    v_bill_comp := coalesce(nullif(v_item->>'bill_competence', ''), p_competence_month);
    IF v_bill_comp !~ '^\d{4}-\d{2}$' THEN
      RAISE EXCEPTION 'bill_competence inválida: %', v_bill_comp;
    END IF;

    -- Rejeita inserção em competência já rolada/refinanciada
    IF EXISTS (
      SELECT 1 FROM public.card_bill_rollovers r
       WHERE r.card_id = p_card_id
         AND r.user_id = v_user_id
         AND r.from_competence_month = v_bill_comp
    ) THEN
      RAISE EXCEPTION 'Não é possível importar lançamentos para a fatura já rolada (%).', v_bill_comp;
    END IF;

    v_charge_kind := coalesce(nullif(v_item->>'charge_kind', ''), 'regular');
    IF v_charge_kind NOT IN ('regular', 'interest', 'fine', 'tax', 'bank_fee') THEN
      v_charge_kind := 'regular';
    END IF;

    v_cat_id := nullif(v_item->>'category_id', '')::uuid;
    IF v_cat_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.categories
       WHERE id = v_cat_id
         AND user_id = v_user_id
         AND type = 'expense'
    ) THEN
      IF v_charge_kind <> 'regular' AND v_reserved_charges_cat_id IS NOT NULL THEN
        v_cat_id := v_reserved_charges_cat_id;
      ELSE
        v_cat_id := v_fallback_cat_id;
      END IF;
    END IF;

    IF v_cat_id IS NULL THEN
      RAISE EXCEPTION 'Nenhuma categoria de despesa disponível para associação.';
    END IF;

    v_scope := coalesce(
      nullif(v_item->>'scope', ''),
      CASE WHEN v_card_scope = 'business' THEN 'business' ELSE 'personal' END
    );
    IF v_scope NOT IN ('personal', 'business') THEN
      v_scope := 'personal';
    END IF;

    v_is_deductible := CASE
      WHEN v_scope = 'business' THEN coalesce((v_item->>'is_tax_deductible')::boolean, false)
      ELSE false
    END;

    v_is_projected := coalesce((v_item->>'is_projected')::boolean, false) OR (v_bill_comp <> p_competence_month);

    -- ON CONFLICT DO NOTHING sem alvo único trata colisão em ambos os índices únicos parciais:
    --   1. idx_expenses_user_card_statement_hash
    --   2. idx_expenses_user_card_installment_unique
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
      charge_kind,
      installments_total,
      installment_number,
      installment_group_id,
      statement_hash,
      imported_from_statement,
      scope,
      is_tax_deductible
    ) VALUES (
      v_user_id,
      p_card_id,
      v_cat_id,
      'credit_card',
      v_val,
      v_val,
      v_report_weight,
      v_date,
      v_bill_comp,
      coalesce(nullif(v_item->>'description', ''), 'Despesa importada'),
      v_charge_kind,
      v_inst_total,
      v_inst_num,
      v_inst_group_id,
      nullif(v_item->>'statement_hash', ''),
      true,
      v_scope,
      v_is_deductible
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_inserted_expense_id;

    IF v_inserted_expense_id IS NOT NULL THEN
      IF v_is_projected THEN
        v_projected_count := v_projected_count + 1;
      ELSE
        v_inserted_count := v_inserted_count + 1;
      END IF;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- BLOCO E: Estornos pareados com categoria reservada "Estorno" (D12 / G10)
  -- ---------------------------------------------------------------------------
  IF jsonb_array_length(v_refunds_arr) > 0 THEN
    SELECT id INTO v_refund_cat_id
      FROM public.categories
     WHERE user_id = v_user_id
       AND type = 'income'
       AND name = 'Estorno'
       AND is_reserved;

    IF v_refund_cat_id IS NULL THEN
      INSERT INTO public.categories (user_id, type, name, is_reserved)
      VALUES (v_user_id, 'income', 'Estorno', true)
      ON CONFLICT (user_id, type, name) DO UPDATE SET is_reserved = true
      RETURNING id INTO v_refund_cat_id;
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_refunds_arr)
  LOOP
    v_ref_amount := (v_item->>'amount')::numeric;
    v_ref_date := (v_item->>'date')::date;
    v_ref_comp := coalesce(nullif(v_item->>'competence_month', ''), p_competence_month);
    v_ref_note := nullif(v_item->>'note', '');
    v_ref_hash := nullif(v_item->>'statement_hash', '');

    IF v_ref_amount IS NULL OR v_ref_amount <= 0 THEN
      RAISE EXCEPTION 'Valor de estorno deve ser maior que zero: %', v_ref_amount;
    END IF;

    IF v_ref_date IS NULL OR v_ref_date < DATE '2026-01-01' THEN
      RAISE EXCEPTION 'Data de estorno inválida ou anterior a 2026-01-01: %', v_ref_date;
    END IF;

    IF v_ref_comp !~ '^\d{4}-\d{2}$' THEN
      RAISE EXCEPTION 'Competência de estorno inválida: %', v_ref_comp;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.card_bill_rollovers r
       WHERE r.card_id = p_card_id
         AND r.user_id = v_user_id
         AND r.from_competence_month = v_ref_comp
    ) THEN
      RAISE EXCEPTION 'Não é possível registrar estorno em fatura já rolada (%).', v_ref_comp;
    END IF;

    v_payment_id := NULL;
    INSERT INTO public.card_payments (
      user_id, card_id, competence_month, amount, date, note, is_refund, statement_hash
    ) VALUES (
      v_user_id, p_card_id, v_ref_comp, -v_ref_amount, v_ref_date, v_ref_note, true, v_ref_hash
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payment_id;

    IF v_payment_id IS NOT NULL THEN
      INSERT INTO public.incomes (
        user_id, value, date, category_id, receive_type, description, source_ref, report_weight
      ) VALUES (
        v_user_id,
        v_ref_amount,
        v_ref_date,
        v_refund_cat_id,
        'other',
        coalesce(v_ref_note, 'Estorno de cartão'),
        '[REFUND]' || v_payment_id::text,
        1
      );
      v_refunds_count := v_refunds_count + 1;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  -- ---------------------------------------------------------------------------
  -- Evento consolidado de auditoria
  -- ---------------------------------------------------------------------------
  INSERT INTO public.audit_events (user_id, entity_type, entity_id, action, payload)
  VALUES (
    v_user_id,
    'expenses',
    p_card_id::text,
    'commit_statement_reconciliation',
    jsonb_build_object(
      'card_id', p_card_id,
      'competence_month', p_competence_month,
      'card_scope', v_card_scope,
      'inserted_count', v_inserted_count,
      'projected_count', v_projected_count,
      'skipped_count', v_skipped_count,
      'adjusted_count', v_adjusted_count,
      'moved_count', v_moved_count,
      'refunds_count', v_refunds_count,
      'deleted_count', v_deleted_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', v_inserted_count,
    'projected_count', v_projected_count,
    'skipped_count', v_skipped_count,
    'adjusted_count', v_adjusted_count,
    'moved_count', v_moved_count,
    'refunds_count', v_refunds_count,
    'deleted_count', v_deleted_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_statement_reconciliation(
  uuid, text, jsonb, jsonb, jsonb, jsonb, uuid[]
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.commit_statement_reconciliation(
  uuid, text, jsonb, jsonb, jsonb, jsonb, uuid[]
) TO authenticated;
