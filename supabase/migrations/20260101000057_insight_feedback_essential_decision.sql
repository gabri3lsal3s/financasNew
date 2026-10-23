-- Atualização da restrição de integridade em insight_feedback para suportar
-- a decisão 'essential', permitindo marcar despesas recorrentes como essenciais,
-- sincronizando na nuvem e removendo-as de sugestões de corte ("Oportunidade de economia").

alter table public.insight_feedback
  drop constraint if exists insight_feedback_decision_check;

alter table public.insight_feedback
  add constraint insight_feedback_decision_check
  check (decision in ('ignore', 'confirm', 'already_cancelled', 'one_off', 'not_subscription', 'essential'));
