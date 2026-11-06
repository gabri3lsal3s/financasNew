-- ---------------------------------------------------------------------------
-- 20260101000075_harden_signal_split_payment_rpc.sql
-- Módulo de Rachar Despesas: Hardening e Sanitização Estrita de signal_split_payment
-- Blindagem contra DoS (teto 50 sinais), limites de valores e nomes,
-- deduplicação inteligente (10 min) e tratamento de expiração/revogação.
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
  v_clean_token text;
  v_clean_participant_name text;
  v_clean_participant_id text;
  v_is_recent boolean;
begin
  -- 1. Sanitização e validações estritas de entrada
  v_clean_token := trim(p_token);
  v_clean_participant_name := trim(p_participant_name);
  v_clean_participant_id := nullif(trim(p_participant_id), '');

  -- Validação de Token: alfanumérico seguro com comprimento canônico (entre 6 e 64 caracteres)
  if v_clean_token is null
     or length(v_clean_token) not between 6 and 64
     or not (v_clean_token ~ '^[a-zA-Z0-9_-]+$') then
    raise exception 'Token de compartilhamento inválido.' using errcode = '22023';
  end if;

  -- Validação de Nome: obrigatório entre 1 e 80 caracteres após trim
  if v_clean_participant_name is null
     or not (length(v_clean_participant_name) between 1 and 80) then
    raise exception 'Nome do participante inválido. Deve conter entre 1 e 80 caracteres.' using errcode = '22023';
  end if;

  -- Validação de Valor: estritamente maior que 0 e com teto de segurança de R$ 10 milhões (1.000.000.000 centavos)
  if p_amount_cents is null
     or not (p_amount_cents > 0 and p_amount_cents <= 1000000000) then
    raise exception 'Valor de pagamento inválido. Deve ser maior que zero e até R$ 10.000.000,00.' using errcode = '22023';
  end if;

  -- 2. Localizar o compartilhamento público ativo
  select *
  into v_share
  from public.public_shares
  where token = v_clean_token
    and kind = 'split';

  if not found then
    raise exception 'Compartilhamento não encontrado.' using errcode = 'P0002';
  end if;

  -- Cláusulas defensivas: validação de revogação e expiração
  if v_share.is_revoked is true or not (v_share.is_revoked = false) then
    raise exception 'Este link de compartilhamento foi revogado.' using errcode = 'P0003';
  end if;

  if v_share.expires_at is not null and v_share.expires_at < now() then
    raise exception 'Este link de compartilhamento expirou.' using errcode = 'P0004';
  end if;

  v_payload := coalesce(v_share.payload, '{}'::jsonb);
  v_signals := coalesce(v_payload->'payment_signals', '[]'::jsonb);
  v_participants := coalesce(v_payload->'participants', '[]'::jsonb);

  -- 3. Deduplicação Inteligente (Idempotência Segura nos últimos 10 minutos)
  -- Se já houver um sinal pendente recente com o mesmo nome ou ID do participante registrado
  -- nos últimos 10 minutos, reutilizar o sinal existente retornando { "success": true, "deduplicated": true }
  if jsonb_array_length(v_signals) > 0 then
    for v_elem in select * from jsonb_array_elements(v_signals)
    loop
      if coalesce(v_elem->>'status', 'pending') = 'pending' then
        v_is_recent := false;
        if (v_elem->>'created_at') is not null then
          begin
            if ((v_elem->>'created_at')::timestamptz) >= (now() - interval '10 minutes') then
              v_is_recent := true;
            end if;
          exception when others then
            v_is_recent := false;
          end;
        end if;

        if v_is_recent then
          if (v_clean_participant_id is not null and (v_elem->>'participant_id') = v_clean_participant_id)
             or (lower(trim(coalesce(v_elem->>'participant_name', ''))) = lower(v_clean_participant_name)) then
            return jsonb_build_object(
              'success', true,
              'deduplicated', true,
              'signal_id', v_elem->>'id',
              'participant_matched', true
            );
          end if;
        end if;
      end if;
    end loop;
  end if;

  -- 4. Trava contra DoS: teto de no máximo 50 sinais registrados no array payment_signals
  if jsonb_array_length(v_signals) >= 50 then
    raise exception 'Limite de sinalizações atingido para este link' using errcode = '54000';
  end if;

  -- 5. Montar o novo objeto de sinalização
  v_signal_id := gen_random_uuid()::text;
  v_new_signal := jsonb_build_object(
    'id', v_signal_id,
    'participant_id', v_clean_participant_id,
    'participant_name', v_clean_participant_name,
    'amount_cents', p_amount_cents,
    'status', 'pending',
    'created_at', now()
  );

  -- 6. Se houver participantes cadastrados, atualizar has_payment_signal no participante correspondente
  if jsonb_array_length(v_participants) > 0 then
    for v_elem in select * from jsonb_array_elements(v_participants)
    loop
      if (v_clean_participant_id is not null and (v_elem->>'id') = v_clean_participant_id)
         or (v_clean_participant_id is null and lower(trim(coalesce(v_elem->>'name', ''))) = lower(v_clean_participant_name)) then
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

  -- 7. Adicionar a nova sinalização à lista de payment_signals e atualizar payload no banco
  v_signals := v_signals || jsonb_build_array(v_new_signal);

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

-- Permissão estrita: anônimos e autenticados podem sinalizar via token seguro
grant execute on function public.signal_split_payment(text, text, integer, text) to anon, authenticated, service_role;
