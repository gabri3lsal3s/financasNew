-- ---------------------------------------------------------------------------
-- 20260101000100_force_rls_critical_tables.sql
-- Plano 17 - Fase 2: Defesa em Profundidade no Banco de Dados
-- Ativação de FORCE ROW LEVEL SECURITY em tabelas financeiras e patrimoniais críticas (G-07)
-- Garante que até mesmo conexões sob role de table owner cumpram as políticas RLS.
-- ---------------------------------------------------------------------------

alter table public.expenses force row level security;
alter table public.incomes force row level security;
alter table public.credit_cards force row level security;
alter table public.debts force row level security;
alter table public.portfolio_transactions force row level security;
alter table public.portfolio_assets force row level security;
