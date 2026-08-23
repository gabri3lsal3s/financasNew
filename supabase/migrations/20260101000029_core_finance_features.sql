-- ================================================================
-- Migration: 0029_core_finance_features.sql
-- Descrição: Registro das funcionalidades do Core Financeiro (Início, Transações e Cartões)
--            no catálogo de Feature Flags do sistema.
-- ================================================================

insert into public.system_features (key, name, description, is_globally_enabled, default_enabled_for_new_users)
values
  ('overview', 'Painel Início (Dashboard Executivo)', 'Acesso à visão consolidada, KPIs financeiros, ritmo de gastos e alertas.', true, true),
  ('transactions', 'Módulo de Transações & Lançamentos', 'Acesso ao extrato, criação e edição de receitas e despesas diárias.', true, true),
  ('cards', 'Módulo de Cartões de Crédito', 'Acesso à gestão de cartões, limites, faturas e parcelamentos.', true, true)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description;
