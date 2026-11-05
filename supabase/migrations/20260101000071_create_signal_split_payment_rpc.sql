-- ---------------------------------------------------------------------------
-- 20260101000071_create_signal_split_payment_rpc.sql
-- Módulo de Rachar Despesas: Sinalização de Pagamento e Sugestões de Abatimento
-- Permite que convidados sinalizem pagamentos pelo link /r/:token com segurança
-- ---------------------------------------------------------------------------

create or replace function public.signal_split_payment(
  p_token text,
  p_participant_name text,
  p_amount_cents integer,
  p_participant_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share record;
  v_payload jsonb;
  v_signals jsonb;
  v_participants jsonb;
  v_updated_participants jsonb := '[]'::jsonb;
  v_new_signal jsonb;
  v_elem jsonb;
  v_participant_matched boolean := false;
  v_signal_id text;
begin
  -- 1. Validar e localizar o compartilhamento ativo
  select *
  into v_share
  from public.public_shares
  where token = p_token
    and kind = 'split'
    and is_revoked = false
    and (expires_at is null or expires_at > now());

  if not found then
    raise exception 'Compartilhamento não encontrado ou expirado.' using errcode = 'P0002';
  end if;

  v_payload := coalesce(v_share.payload, '{}'::jsonb);
  v_signals := coalesce(v_payload->'payment_signals', '[]'::jsonb);
  v_participants := coalesce(v_payload->'participants', '[]'::jsonb);
  v_signal_id := gen_random_uuid()::text;

  -- 2. Montar o objeto de sinalização
  v_new_signal := jsonb_build_object(
    'id', v_signal_id,
    'participant_id', p_participant_id,
    'participant_name', trim(p_participant_name),
    'amount_cents', p_amount_cents,
    'status', 'pending',
    'created_at', now()
  );

  -- 3. Se houver participantes cadastrados, atualizar has_payment_signal no participante correspondente
  if jsonb_array_length(v_participants) > 0 then
    for v_elem in select * from jsonb_array_elements(v_participants)
    loop
      if (p_participant_id is not null and (v_elem->>'id') = p_participant_id)
         or (p_participant_id is null and lower(trim(v_elem->>'name')) = lower(trim(p_participant_name))) then
        v_elem := v_elem || jsonb_build_object(
          'has_payment_signal', true,
          'payment_signaled_at', now()
        );
        v_participant_matched := true;
      end if;
      v_updated_participants := v_updated_participants || jsonb_build_array(v_elem);
    end loop;
  else
    v_updated_participants := v_participants;
  end if;

  -- 4. Adicionar a nova sinalização à lista de payment_signals
  v_signals := v_signals || jsonb_build_array(v_new_signal);

  -- 5. Atualizar o payload no banco
  v_payload := v_payload || jsonb_build_object(
    'payment_signals', v_signals,
    'participants', v_updated_participants
  );

  update public.public_shares
  set payload = v_payload,
      updated_at = now()
  where id = v_share.id;

  return jsonb_build_object(
    'success', true,
    'signal_id', v_signal_id,
    'participant_matched', v_participant_matched
  );
end;
$$;

grant execute on function public.signal_split_payment(text, text, integer, text) to anon, authenticated, service_role;


-- Função para o anfitrião descartar/ignorar uma sinalização de pagamento
create or replace function public.dismiss_split_payment_signal(
  p_share_id uuid,
  p_signal_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_share record;
  v_payload jsonb;
  v_signals jsonb;
  v_updated_signals jsonb := '[]'::jsonb;
  v_participants jsonb;
  v_updated_participants jsonb := '[]'::jsonb;
  v_elem jsonb;
  v_target_participant_id text := null;
  v_target_participant_name text := null;
begin
  -- 1. Validar propriedade do anfitrião
  select *
  into v_share
  from public.public_shares
  where id = p_share_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Compartilhamento não encontrado ou acesso não autorizado.' using errcode = 'P0002';
  end if;

  v_payload := coalesce(v_share.payload, '{}'::jsonb);
  v_signals := coalesce(v_payload->'payment_signals', '[]'::jsonb);
  v_participants := coalesce(v_payload->'participants', '[]'::jsonb);

  -- 2. Atualizar o status do sinal para 'dismissed'
  for v_elem in select * from jsonb_array_elements(v_signals)
  loop
    if (v_elem->>'id') = p_signal_id then
      v_target_participant_id := v_elem->>'participant_id';
      v_target_participant_name := v_elem->>'participant_name';
      v_elem := v_elem || jsonb_build_object(
        'status', 'dismissed',
        'dismissed_at', now()
      );
    end if;
    v_updated_signals := v_updated_signals || jsonb_build_array(v_elem);
  end loop;

  -- 3. Se participante correspondente tiver has_payment_signal, desmarcar
  if jsonb_array_length(v_participants) > 0 then
    for v_elem in select * from jsonb_array_elements(v_participants)
    loop
      if (v_target_participant_id is not null and (v_elem->>'id') = v_target_participant_id)
         or (v_target_participant_id is null and v_target_participant_name is not null and lower(trim(v_elem->>'name')) = lower(trim(v_target_participant_name))) then
        v_elem := v_elem || jsonb_build_object(
          'has_payment_signal', false
        );
      end if;
      v_updated_participants := v_updated_participants || jsonb_build_array(v_elem);
    end loop;
  else
    v_updated_participants := v_participants;
  end if;

  v_payload := v_payload || jsonb_build_object(
    'payment_signals', v_updated_signals,
    'participants', v_updated_participants
  );

  update public.public_shares
  set payload = v_payload,
      updated_at = now()
  where id = v_share.id;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.dismiss_split_payment_signal(uuid, text) to authenticated, service_role;
