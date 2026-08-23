-- ----------------------------------------------------------------
-- Migração 20260101000025: Cenários & Pré-definições de Metas de Alocação (Presets)
-- ----------------------------------------------------------------
--
-- Permite ao usuário salvar múltiplos cenários estratégicos de metas
-- para ativos e classes de investimentos, podendo alternar e simular
-- diferentes carteiras sem perder a configuração oficial.
-- ----------------------------------------------------------------

create table if not exists public.allocation_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  asset_targets jsonb not null default '[]'::jsonb,
  class_targets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allocation_presets_user_name_key unique (user_id, name)
);

-- RLS
alter table public.allocation_presets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'allocation_presets'
      and policyname = 'allocation_presets_all_own'
  ) then
    create policy "allocation_presets_all_own"
      on public.allocation_presets
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Função genérica de atualização de timestamp se não existir
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger de updated_at
drop trigger if exists trg_allocation_presets_updated_at on public.allocation_presets;
create trigger trg_allocation_presets_updated_at
  before update on public.allocation_presets
  for each row execute function public.update_updated_at();

-- Índices de busca por usuário
create index if not exists idx_allocation_presets_user_id
  on public.allocation_presets (user_id, created_at desc);
