-- Migration: 20260101000168_session_bootstrap_rpc.sql
-- Consolida o bootstrap de sessão autenticada (profile, features, subscription e preferences)
-- em 1 única chamada RPC para eliminar waterfalls no login e cold start.

CREATE OR REPLACE FUNCTION public.get_my_session_bootstrap()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_features jsonb;
  v_subscription jsonb;
  v_preferences jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'email', p.email,
    'role', p.role,
    'status', p.status,
    'approved_at', p.approved_at,
    'approved_by', p.approved_by,
    'suspended_reason', p.suspended_reason,
    'created_at', p.created_at
  )
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_uid;

  v_features := public.get_my_features();
  v_subscription := public.get_my_subscription();

  SELECT to_jsonb(up.*)
  INTO v_preferences
  FROM public.user_preferences up
  WHERE up.user_id = v_uid;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'features', coalesce(v_features, '{}'::jsonb),
    'subscription', v_subscription,
    'preferences', v_preferences
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_session_bootstrap() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_session_bootstrap() TO authenticated;
