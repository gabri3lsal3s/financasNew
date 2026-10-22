-- Atualização da restrição de integridade em insight_feedback para suportar
-- decisões de micro-feedback qualificado (§F23):
--   'already_cancelled' -> Já cancelei (celebra economia anual, remove dos fixos)
--   'one_off'           -> É despesa pontual (silencia no ciclo sem penalizar motor)
--   'not_subscription'  -> Não é assinatura (rebaixa probabilidade no classificador)
-- Mantendo compatibilidade com 'ignore' e 'confirm'.

alter table public.insight_feedback
  drop constraint if exists insight_feedback_decision_check;

alter table public.insight_feedback
  add constraint insight_feedback_decision_check
  check (decision in ('ignore', 'confirm', 'already_cancelled', 'one_off', 'not_subscription'));
