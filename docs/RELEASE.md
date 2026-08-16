# 🚢 RELEASE.md — QA Final Multi-dispositivo & Corte de Release

> **Status:** v1.0 — F6.5 do ROADMAP. Checklist operacional para validar uma
> release de produção e executar o corte (tag → CI/CD → pós-deploy).
> Pré-requisito de deploy: `docs/DEPLOYMENT.md` (§3 deploy + §8 checklist de prontidão).

---

## 1. PRÉ-REQUISITOS DE AMBIENTE

- [x] **Deploy de produção funcional** (confirmado 2026-08-15): frontend no Vercel + Supabase remoto; migrations aplicadas, RLS ativo e env vars na Vercel.
- [ ] `VITE_SENTRY_DSN` definido na Vercel (opcional — sem ele o app funciona; com ele erros de produção + Web Vitals são reportados).
- [ ] Secrets de CI/CD configurados no GitHub (`VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`; `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID` para a edge function de cotações) — para o CI/CD automatizado.
- [ ] Edge function de cotações deployada + cron agendado (ver `DEPLOYMENT.md` §7.1) — status a confirmar.
- [ ] `npm test` verde na branch `main` (gates do CI/CD `deploy.yml`).

---

## 2. QA FUNCIONAL — MATRIZ DE FLUXOS CRÍTICOS

> Validar em **desktop (≥ 1024px) e mobile (< 640px)**, nos **3 temas** (light/dark/oled)
> e nos **6 acentos** (teal, emerald, gold, rose, sapphire, violet) quando aplicável.

| # | Fluxo | Desktop | Mobile | Observações |
|---|---|---|---|---|
| 1 | Login / cadastro / recuperação de senha | ☐ | ☐ | Erro de rede → gateway + "Tentar novamente" |
| 2 | Onboarding de primeiro uso (categorias → cartão → lançamento) | ☐ | ☐ | Some ao completar |
| 3 | Wizard de lançamento (4 passos, parcelamento, peso personalizado) | ☐ | ☐ | Botão de calculadora no header; FAB contextual |
| 4 | Listagem por mês (receitas/despesas, KPIs, fluxo diário) | ☐ | ☐ | Skeleton/EmptyState/erro; virtualização |
| 5 | Cartões: fatura, pagamento, estorno (renda [REFUND]) | ☐ | ☐ | Seleção automática de mês |
| 6 | Dívidas: quitação com lançamento, recebimento integrado | ☐ | ☐ | Status derivado correto |
| 7 | Orçamentos: limites, metas de renda, realocação (RPC) | ☐ | ☐ | Faixas 85/90/95/excedido |
| 8 | Insights: alertas, assinaturas, projeção, diagnósticos | ☐ | ☐ | Confiança + ignorar/confirmar |
| 9 | Relatórios: mês/custom ≤ 366d, merge de dívidas pagas | ☐ | ☐ | Comparativo |
| 10 | Carteira: posição (preço manual marcado), metas, calculadora de aporte | ☐ | ☐ | Barra de soma ≤ 100% |
| 11 | Busca global (Ctrl+K) com deep-link + highlight | ☐ | ☐ | — |
| 12 | Lembretes: lido/snooze(7d)/restaurar | ☐ | ☐ | Snooze expira |
| 13 | Exclusão 3 modos (single/all/subsequent) com cascata | ☐ | ☐ | ConfirmDialog |
| 14 | Calculadora: operações, parcelas, "Usar valor" no campo ativo | ☐ | ☐ | FAB contextual em modais/wizard |
| 15 | Modo privacidade (tecla P) — ofusca todos os valores | ☐ | ☐ | — |
| 16 | PWA: instalação, offline (App Shell), toast de atualização | ☐ | ☐ | `beforeinstallprompt` |

## 3. QA VISUAL & ACESSIBILIDADE

- [ ] Contraste AA nos 3 temas × 6 acentos (regras de `domain/accessibility` — 18 combinações, testes verdes).
- [ ] Sem overflow horizontal no mobile (salvaguarda global + `Modal max-h-[90dvh]`).
- [ ] Header/sidebar/bottom nav fixos com scroll interno; FAB não sobrepõe conteúdo.
- [ ] Zoom 200% e navegação por teclado (Tab/Enter/setas) sem perda de foco.
- [ ] `prefers-reduced-motion` / nível "Reduzida" desativa animações.
- [ ] Auditoria axe nas 10 telas P0 (suíte automatizada — executar `npm test`).
- [ ] Lighthouse mobile ≥ 90 em produção (performance/PWA/a11y).

## 4. DADOS & CONSISTÊNCIA

- [ ] Parcelamento: soma das parcelas = valor original (invariante D12) — incl. edição.
- [ ] Competência de fatura: dia ≥ closing → mês seguinte; overrides respeitados.
- [ ] Estorno gera renda `[REFUND]` somente-leitura; recebimento integrado reduz despesa no relatório.
- [ ] Exclusão em cascata: rollback total em falha (RPCs transacionais).
- [ ] Backfill de `profiles` (contas órfãs) sem duplicação (idempotente).
- [ ] Auditoria `audit_events` gravada nas escritas compostas; imutável.

---

## 5. CORTE DE RELEASE

1. **Congelar `main`:** sem merges fora do escopo da release (hotfixes críticos apenas).
2. **Verde nos gates:** `npm run typecheck && npm run lint && npm test && npm run build` (CI `deploy.yml` faz isso automaticamente no push).
3. **Tag semântica:**
   ```bash
   git tag -a v1.x.0 -m "Release v1.x.0"
   git push origin v1.x.0
   ```
4. **Deploy:** o push em `main` dispara `deploy.yml` — job `quality` (gates) → `deploy-vercel` (produção) → `deploy-supabase-functions` (edge `quotes`). Confira o status em GitHub Actions.
5. **Edge function de cotações (1ª vez):** `supabase functions deploy quotes --project-ref <ref>` com o service role no secret da função; agendar cron (DEPLOYMENT §7.1).
6. **Pós-deploy (DEPLOYMENT §3.3):** login/cadastro, onboarding, PWA instalável, Lighthouse.

## 6. ROLLBACK

- **Frontend:** Vercel → Deployments → ⋯ → "Rollback to Previous" (ou `vercel rollback`).
- **Edge function:** redeploy da versão anterior do código da função.
- **Banco:** migrations são versionadas e idempotentes (`on conflict do nothing`); dados de negócio nunca são destruídos por rollback de app — RPCs validam invariantes na escrita.
- **Comunicação:** notificar usuários via toast de atualização (PWA já anuncia nova versão).

---

## 7. REGISTRO DA RELEASE (template)

```markdown
## vX.Y.Z — <data>
### Novidades
- ...
### Correções
- ...
### Infra
- Edge function de cotações (F1.7) deployada com cron a cada 6h.
- ...
### Verificação
- [ ] 1092+ testes verdes · typecheck · lint · build
- [ ] QA multi-dispositivo (seção 2) aprovado em desktop + mobile, 3 temas
- [ ] Lighthouse ≥ 90
```
