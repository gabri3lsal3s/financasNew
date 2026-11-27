-- ============================================================================
-- pgTAP: T01 — Contenção de Sessões, AAL2 e Registro de Revogação
-- Valida S02, S03 e S04 em instância descartável local.
-- ============================================================================
begin;
select plan(9);

-- 1. Usuário comum não pode chamar admin_revoke_user_sessions
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '11111111-1111-1111-1111-111111111111',
  'aal', 'aal2',
  'session_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
)::text, true);

select throws_ok(
  $$select public.admin_revoke_user_sessions('22222222-2222-2222-2222-222222222222')$$,
  '42501',
  null,
  'Usuário comum não pode revogar sessões via admin_revoke_user_sessions'
);

-- 2. is_admin() recusa JWT AAL1 mesmo para operador
reset role;
insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'op-t01@axir.test'),
  ('44444444-4444-4444-4444-444444444444', 'alvo-t01@axir.test'),
  ('55555555-5555-5555-5555-555555555555', 'outra-t01@axir.test')
on conflict (id) do nothing;

insert into public.profiles (id, name, email, role, status) values
  ('33333333-3333-3333-3333-333333333333', 'Operador T01', 'op-t01@axir.test', 'superadmin', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'Alvo T01', 'alvo-t01@axir.test', 'user', 'active'),
  ('55555555-5555-5555-5555-555555555555', 'Outra T01', 'outra-t01@axir.test', 'user', 'active')
on conflict (id) do update set role = excluded.role, status = excluded.status;

insert into auth.mfa_factors (id, user_id, factor_type, status, friendly_name, created_at, updated_at)
values ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'totp', 'verified', 'TOTP T01', now(), now())
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '33333333-3333-3333-3333-333333333333',
  'aal', 'aal1',
  'session_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
)::text, true);

select is(public.is_admin(), false, 'is_admin() recusa operador com AAL1');
select throws_ok(
  $$select public.admin_revoke_user_sessions('44444444-4444-4444-4444-444444444444')$$,
  '42501',
  null,
  'Operador AAL1 não pode revogar sessões'
);

-- 3. Múltiplas sessões da mesma conta no mesmo aparelho não sobrescrevem vínculo
select set_config('request.jwt.claims', json_build_object(
  'sub', '44444444-4444-4444-4444-444444444444',
  'aal', 'aal1',
  'session_id', 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
)::text, true);
select public.register_device_session('dev-shared-hw', 'Chrome', 'Chrome', 'Linux', null);

select set_config('request.jwt.claims', json_build_object(
  'sub', '44444444-4444-4444-4444-444444444444',
  'aal', 'aal1',
  'session_id', 'cccccccc-cccc-cccc-cccc-ccccccccccc2'
)::text, true);
select public.register_device_session('dev-shared-hw', 'Chrome', 'Chrome', 'Linux', null);

select is(
  (select count(*)::int from public.user_devices where user_id = '44444444-4444-4444-4444-444444444444' and device_id = 'dev-shared-hw'),
  2,
  'Duas sessões da mesma conta no mesmo aparelho permanecem distintas no inventário'
);

-- 4. Outra conta permanece intacta após revogação do alvo
select set_config('request.jwt.claims', json_build_object(
  'sub', '55555555-5555-5555-5555-555555555555',
  'aal', 'aal1',
  'session_id', 'dddddddd-dddd-dddd-dddd-ddddddddddd1'
)::text, true);
select public.register_device_session('dev-other', 'Firefox', 'Firefox', 'Linux', null);

-- 5. Operador AAL2 revoga sessões do alvo de forma idempotente e preserva outra conta
select set_config('request.jwt.claims', json_build_object(
  'sub', '33333333-3333-3333-3333-333333333333',
  'aal', 'aal2',
  'session_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
)::text, true);
select is(public.is_admin(), true, 'is_admin() aceita operador ativo com AAL2 e MFA verificado');
select ok(
  (public.admin_revoke_user_sessions('44444444-4444-4444-4444-444444444444') ->> 'success')::boolean,
  'admin_revoke_user_sessions executa com sucesso para operador AAL2'
);

-- 6. Sessão revogada do alvo é detectada e não pode ser reativada
select set_config('request.jwt.claims', json_build_object(
  'sub', '44444444-4444-4444-4444-444444444444',
  'aal', 'aal1',
  'session_id', 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
)::text, true);
select is(public.check_device_session_revoked('dev-shared-hw'), true, 'check_device_session_revoked detecta sessão revogada');
select throws_ok(
  $$select public.register_device_session('dev-shared-hw', 'Chrome', 'Chrome', 'Linux', null)$$,
  '42501',
  null,
  'register_device_session recusa reativar sessão revogada'
);

-- 7. Outra conta permanece não revogada
select set_config('request.jwt.claims', json_build_object(
  'sub', '55555555-5555-5555-5555-555555555555',
  'aal', 'aal1',
  'session_id', 'dddddddd-dddd-dddd-dddd-ddddddddddd1'
)::text, true);
select is(public.check_device_session_revoked('dev-other'), false, 'Revogação do alvo preserva sessões de outras contas');

select * from finish();
rollback;
