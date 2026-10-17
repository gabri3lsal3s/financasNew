-- Migration 000047: RLS Audit Cleanup (Tarefa 5.1)
-- Erradica policies residuais identificadas na auditoria completa de RLS.
-- As tabelas loans e cash_checkpoints receberam hardening em 000041, mas
-- policies legadas com nomes divergentes (loans_all_own e cash_checkpoints_owner_policy)
-- permaneceram ativas no schema.

drop policy if exists "loans_all_own" on public.loans;
drop policy if exists "cash_checkpoints_owner_policy" on public.cash_checkpoints;
