# 🚢 RELEASE.md — QA Final Multi-dispositivo & Corte de Release

> **Status:** v1.0 — F6.5 do ROADMAP. Checklist operacional para validar uma
> release de produção e executar o corte (tag → CI/CD → pós-deploy).
> Pré-requisito de deploy: `docs/DEPLOYMENT.md` (§3 deploy + §8 checklist de prontidão).

---

## 1. PRÉ-REQUISITOS DE AMBIENTE

- [x] **Deploy de produção funcional** (Cloudflare Pages + Supabase remoto): frontend no Cloudflare Pages; migrations aplicadas, RLS ativo e env vars configuradas no painel da Cloudflare.
- [ ] `VITE_SENTRY_DSN` definido no Cloudflare Pages (opcional — sem ele o app funciona; com ele erros de produção + Web Vitals são reportados).
- [ ] Edge function de cotações deployada + cron agendado (ver `DEPLOYMENT.md` §7.1) — status a confirmar.
- [ ] Quality gate local verde (`npm run typecheck && npm run lint && npm test && npm run build`).

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
| 9 | Relatórios: mês/ano/custom ≤ 366d, merge de dívidas pagas | ☐ | ☐ | Comparativo; fechamento completo (mês/ano/custom) com impressão multi-página (PrintSheet) |
| 10 | Carteira: posição (preço manual marcado), metas, calculadora de aporte | ☐ | ☐ | Barra de soma ≤ 100% |
| 11 | Busca global (Ctrl+K) com deep-link + highlight | ☐ | ☐ | — |
| 12 | Lembretes: lido/snooze(7d)/restaurar | ☐ | ☐ | Snooze expira |
| 13 | Exclusão 3 modos (single/all/subsequent) com cascata | ☐ | ☐ | ConfirmDialog |
| 14 | Calculadora: operações, parcelas, "Usar valor" no campo ativo | ☐ | ☐ | FAB contextual em modais/wizard |
| 15 | Modo privacidade (tecla P) — ofusca todos os valores | ☐ | ☐ | — |
| 16 | PWA: instalação, offline (App Shell), toast de atualização | ☐ | ☐ | `beforeinstallprompt` |

### 2.1 MATRIZ DE GESTOS E MOBILE UX (F20 — iOS Safari & Chrome Android)

| Cenário de Gesto | Comportamento Esperado | iOS Safari | Chrome Android | Cobertura Automatizada |
|---|---|---|---|---|
| **Thumb Drift (Scroll Vertical Rápido)** | Scroll vertical nativo livre; axis-lock ±30° bloqueia falso positivo horizontal | [x] Aprovado | [x] Aprovado | `use-swipe-navigation.test.ts` (descarte por dy > dx) |
| **Coexistência com Swipe-to-Action** | Arrastar despesa para excluir/editar (`.swipeable-item`) NÃO aciona troca de abas | [x] Aprovado | [x] Aprovado | `use-swipe-navigation.test.ts` (`.swipeable-item` ignorado) |
| **Edge Inset do SO (Voltar/Avançar Nativo)** | Gestos a ≤12px das bordas do display não interferem com o gesto nativo de navegação | [x] Aprovado | [x] Aprovado | `use-swipe-navigation.test.ts` (zonas de borda x ≤ 12px e x ≥ width - 12px) |
| **Bordas das Abas (Primeira/Última)** | Rubber-banding elástico suave com fator de amortecimento e sem transição fantasma | [x] Aprovado | [x] Aprovado | `swipe.test.ts` (`boundaryResistance` + spring-back) |
| **Gráficos com Scrub & Modais** | Elementos interativos (`[data-swipe-nav-ignore]`, `input`, `[role="dialog"]`) isolados | [x] Aprovado | [x] Aprovado | `use-swipe-navigation.test.ts` (ignore selectors) |

### 2.2 MATRIZ DE PERFORMANCE, CODE-SPLITTING & RENDERIZAÇÃO 3D (F23)

| Cenário de Performance & Visual | Comportamento Esperado | Desktop (≥ 1024px) | Mobile (< 640px) | Cobertura Automatizada |
|---|---|---|---|---|
| **Cartão de Crédito 3D em CSS Puro** | Renderização via CSS 3D Transforms (`perspective`, `rotateX/Y`, `translateZ`) sem WebGL/Three.js; feedback tátil e inclinação suave sem jank | [x] Aprovado (3 temas) | [x] Aprovado (3 temas) | `visual-qa-multi-theme.test.tsx` (Fase 23, light/dark/oled) |
| **Code-Splitting da Rota `/cartoes`** | Chunk de cartões isolado e carregado sob demanda; sem impacto no bundle inicial da Home | [x] Aprovado | [x] Aprovado | `routes.tsx` + `pageLoaders` |
| **Pre-fetching no Idle (`useRoutePrefetch`)** | Rotas primárias carregadas via `requestIdleCallback` (fallback 1s) sem bloquear primeira renderização | [x] Aprovado | [x] Aprovado | `use-route-prefetch.test.ts` |
| **Política de Cache TanStack Query** | `STALE_TIMES` diferenciados por volatilidade (estático 5m, analítico 60s, transacional 30s) e `gcTime` de 30m | [x] Aprovado | [x] Aprovado | `cache-policy.ts` |
| **Alvos de Toque e Tipografia Tabular** | Valores monetários com `<NumberTicker />` tabular-nums sem layout shifts; alvos de toque ≥ 44px | [x] Aprovado | [x] Aprovado | `visual-qa-multi-theme.test.tsx` + `accessibility-audit.test.tsx` |

### 2.3 MATRIZ DE PLANEJAMENTO FINANCEIRO, RESERVA & SIMULADOR FIRE (F24)

| Cenário de Planejamento & Projeção | Comportamento Esperado | Desktop (≥ 1024px) | Mobile (< 640px) | Cobertura Automatizada |
|---|---|---|---|---|
| **Termômetro da Reserva (`EmergencyThermometer`)** | Diagnóstico de autonomia em meses/dias, marcos de 3, 6 e 12 meses, faixas de saúde semânticas e painel expansível de premissas | [x] Aprovado (3 temas) | [x] Aprovado (3 temas) | `visual-qa-multi-theme.test.tsx` (Fase 24) + `emergency-thermometer.test.tsx` |
| **Fechamento Projetado & Caixa (`ProjectionTab`)** | Ritmo diário de gastos, pendências do período com grid adaptativo, desafios inteligentes de economia e cortes sugeridos | [x] Aprovado (3 temas) | [x] Aprovado (3 temas) | `visual-qa-multi-theme.test.tsx` (Fase 24) |
| **Simulador de Independência FIRE (`FireProjectionCurve`)** | Curva SVG suave (Catmull-Rom), regra determinística dos 4% (25x despesas anuais), linha de meta patrimonial e scrub interativo | [x] Aprovado (3 temas) | [x] Aprovado (3 temas) | `visual-qa-multi-theme.test.tsx` (Fase 24) |
| **Valores Financeiros e Acessibilidade** | Zero reticências em moedas (`MoneyText` tabular-nums), heading order `h1` → `h2` estrito, contraste AA nos 3 temas | [x] Aprovado (3 temas) | [x] Aprovado (3 temas) | `accessibility-audit.test.tsx` |

## 3. QA VISUAL & ACESSIBILIDADE

- [x] Contraste AA nos 3 temas × 6 acentos (regras de `domain/accessibility` — 18 combinações, testes verdes em `visual-qa-multi-theme.test.tsx`).
- [x] Sem overflow horizontal no mobile (salvaguarda global + `Modal max-h-[90dvh]`).
- [x] Header/sidebar/bottom nav fixos com scroll interno; FAB não sobrepõe conteúdo.
- [x] Zoom 200% e navegação por teclado (Tab/Enter/setas) sem perda de foco.
- [x] `prefers-reduced-motion` / nível "Reduzida" desativa animações.
- [x] Auditoria axe nas 10 telas P0 (suíte automatizada — `accessibility-audit.test.tsx` 100% verde).
- [ ] Lighthouse mobile ≥ 90 em produção (performance/PWA/a11y — validação manual pós-deploy).

## 4. DADOS & CONSISTÊNCIA

- [x] Parcelamento: soma das parcelas = valor original (invariante D12) — incl. edição (`parcelar.test.ts`).
- [x] Competência de fatura: dia ≥ closing → mês seguinte; overrides respeitados (`competence/index.test.ts` e `cards/index.test.ts`).
- [x] Estorno gera renda `[REFUND]` somente-leitura; recebimento integrado reduz despesa no relatório (`card-payments.test.ts` e `cards/index.ts`).
- [x] Exclusão em cascata: rollback total em falha (RPCs transacionais cobertas em `cross-tenant-penetration.test.ts`).
- [x] Backfill de `profiles` (contas órfãs) sem duplicação (idempotente nas migrations).
- [x] Auditoria `audit_events` gravada nas escritas compostas; imutável (`security-audit.test.ts`).

---

## 5. CORTE DE RELEASE

1. **Congelar `main`:** sem merges fora do escopo da release (hotfixes críticos apenas).
2. **Verde nos gates locais:** `npm run typecheck && npm run lint && npm test && npm run build` (garantindo build sem erros antes do push).
3. **Tag semântica:**
   ```bash
   git tag -a v1.x.0 -m "Release v1.x.0"
   git push origin v1.x.0
   ```
4. **Deploy:** o push em `main` dispara automaticamente o build & deploy nativo do Cloudflare Pages (Git Integration). Acompanhe o status e logs em **Cloudflare Dashboard → Workers & Pages → financasNew**.
5. **Edge function de cotações (1ª vez ou quando alterada):** `npm run quotes:deploy` ou `supabase functions deploy quotes --project-ref <ref>` com o service role no secret da função; agendar cron (`npm run quotes:cron` / DEPLOYMENT §7.1).
6. **Pós-deploy (DEPLOYMENT §3.3):** login/cadastro, onboarding, PWA instalável, Lighthouse.

## 6. ROLLBACK

- **Frontend:** Cloudflare Dashboard → Workers & Pages → financasNew → Deployments → ⋯ → "Rollback to this deployment".
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
- [ ] 1135+ testes verdes · typecheck · lint · build
- [ ] QA multi-dispositivo (seção 2) aprovado em desktop + mobile, 3 temas
- [ ] Lighthouse ≥ 90
```
