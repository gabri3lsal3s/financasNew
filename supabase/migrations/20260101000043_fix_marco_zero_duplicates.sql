-- Migration: Limpeza de Marcos Zeros duplicados + constraint de unicidade por usuário
-- ============================================================================
-- CONTEXTO:
-- O bug no InitialPocketCostDialog (corrigido na sessão de 2026-09-04) permitia que cada
-- save criasse um novo registro de Marco Zero sem remover o anterior, acumulando
-- múltiplas entradas para o mesmo user_id, distorcendo a TIR (XIRR) negativamente.
--
-- REGRA DE NEGÓCIO:
-- Deve existir no máximo 1 Marco Zero ativo por usuário (asset_id IS NULL + notas contendo
-- "marco zero", "custo inicial" ou "histórico inicial").
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1: Limpeza dos registros duplicados de Marco Zero
-- Mantém apenas o mais recente (maior created_at) por user_id.
-- Seguro para executar em produção: deleta somente os excedentes de Marco Zero.
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM public.portfolio_contributions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      user_id,
      created_at,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY created_at DESC
      ) AS rn
    FROM public.portfolio_contributions
    WHERE
      asset_id IS NULL
      AND (
        LOWER(COALESCE(notes, '')) LIKE '%marco zero%'
        OR LOWER(COALESCE(notes, '')) LIKE '%custo inicial%'
        OR LOWER(COALESCE(notes, '')) LIKE '%histórico inicial%'
      )
  ) ranked
  WHERE rn > 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 2: Função RPC para upsert atômico de Marco Zero
-- Garante a invariante no servidor: no máximo 1 Marco Zero por usuário.
-- O cliente chama esta função em vez de criar diretamente no repositório.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_marco_zero(
  p_date    DATE,
  p_amount  NUMERIC,
  p_notes   TEXT DEFAULT 'Marco Zero do Bolso · Custo Histórico Inicial'
)
RETURNS public.portfolio_contributions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result  public.portfolio_contributions;
BEGIN
  -- Remove todos os marcos zeros anteriores do usuário
  DELETE FROM public.portfolio_contributions
  WHERE
    user_id  = v_user_id
    AND asset_id IS NULL
    AND (
      LOWER(COALESCE(notes, '')) LIKE '%marco zero%'
      OR LOWER(COALESCE(notes, '')) LIKE '%custo inicial%'
      OR LOWER(COALESCE(notes, '')) LIKE '%histórico inicial%'
    );

  -- Insere o novo registro calibrado
  INSERT INTO public.portfolio_contributions (user_id, asset_id, date, amount, notes)
  VALUES (v_user_id, NULL, p_date, p_amount, COALESCE(NULLIF(p_notes, ''), 'Marco Zero do Bolso · Custo Histórico Inicial'))
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Garante que apenas usuários autenticados podem chamar a função
REVOKE ALL ON FUNCTION public.upsert_marco_zero(DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_marco_zero(DATE, NUMERIC, TEXT) TO authenticated;
