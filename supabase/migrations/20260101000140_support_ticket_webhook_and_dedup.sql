-- Migration 0140: Redundancia garantida via Database Webhook em support_tickets e deduplicacao atomica de alertas no Telegram

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS telegram_notified_at timestamptz DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.protect_support_ticket_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_role text := coalesce(auth.role(), '');
BEGIN
  IF v_auth_role = 'service_role'
     OR public.is_admin()
     OR (
       v_uid IS NULL
       AND session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
       AND v_auth_role NOT IN ('authenticated', 'anon')
     ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'open'::public.support_ticket_status;
    NEW.admin_notes := NULL;
    NEW.admin_reply := NULL;
    NEW.admin_replied_at := NULL;
    NEW.admin_id := NULL;
    NEW.telegram_notified_at := NULL;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE': usuario final nao altera colunas administrativas nem transfere ownership
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Acesso negado: não é permitido alterar o titular do chamado.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
     OR NEW.admin_replied_at IS DISTINCT FROM OLD.admin_replied_at
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.telegram_notified_at IS DISTINCT FROM OLD.telegram_notified_at
     OR (
       NEW.admin_id IS DISTINCT FROM OLD.admin_id
       AND NOT (NEW.admin_id IS NULL AND OLD.admin_id = v_uid)
     ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar campos de atendimento do chamado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_support_ticket_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  IF coalesce(trim(NEW.message), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
    INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'webhook_secret'
   LIMIT 1;

  SELECT decrypted_secret
    INTO v_url
    FROM vault.decrypted_secrets
   WHERE name = 'support_notify_url'
   LIMIT 1;

  IF coalesce(trim(v_secret), '') = '' OR coalesce(trim(v_url), '') = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'support_tickets',
        'schema', 'public',
        'record', to_jsonb(NEW)
      ),
      timeout_milliseconds := 10000
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING '[support_ticket_webhook] %', sqlerrm;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_support_ticket_webhook() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_support_ticket_webhook ON public.support_tickets;
CREATE TRIGGER trg_notify_support_ticket_webhook
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_support_ticket_webhook();
