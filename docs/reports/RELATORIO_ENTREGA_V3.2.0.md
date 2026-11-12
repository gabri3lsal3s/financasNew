# Relatório de Entrega — Axir v3.2.0 (Build 56)

- **Data:** 2026-11-12
- **Classificação:** Fluxo Completo (funcionalidades, refatorações e auditoria de congruência)
- **Branch:** `main`

---

## 1. Escopo concluído

### Tema adaptativo por horário

- Motor puro `src/domain/theme/theme-resolver.ts` (`light`, `dark`, `oled`, `system`, `schedule`) com `resolveTheme`, `isDaytime` e `parseTimeToMinutes` testados.
- `ThemeProvider` com variante escura preferida, agenda dia/noite, relógio reativo e resolução determinística.
- Script anti-flash do `index.html` alinhado às mesmas regras.
- `VisualIdentityCard` com seleção de variante escura (Abissal Teal x OLED) e horários de início do dia/noite.
- Persistência em `user_preferences.custom_settings` e migration `20260101000113_theme_schedule_and_preferences.sql`.

### Distribuição unificada do aplicativo

- Novo `AppDownloadModal` (PWA + guia iOS + APK Android Pro) no menu "Mais opções".
- Detecção de plataforma para ocultar opções inválidas (APK nativo / PWA iOS).

### Consolidação e modularização

- Configurações em 6 abas canônicas, com aliases de deep-link e remoção de abas legadas.
- Remoção das páginas administrativas legadas em favor do console modular `/admin/*`.
- Extração de `useOverviewData`, `useReportsData`, `BudgetsLimitsTab`/`BudgetsGoalsTab`/`BudgetsCategoriesTab` e dos feeds de fatura de cartões.
- `PageShell` sob demanda e chunks vendor dedicados para `cmdk` e `react-day-picker`.

### Landing page, SEO e descoberta por IA

- Navegação reordenada (Recursos, Simulador, Plataformas, Ferramentas, Preços, FAQ) e scroll-spy sincronizado.
- Publicação de `llms.txt`, `llms-full.txt`, `ai-catalog.json` e `.well-known/ai-catalog.json`.
- `robots.txt`, `sitemap.xml`, `_headers` e JSON-LD (SoftwareApplication, Organization, FAQPage) atualizados.

### Correções de integridade

- `getActiveUserMfaFactor` volta a falhar de forma segura (`null`) quando a listagem de fatores falha.
- Limpeza de fatores MFA não verificados e classificação dedicada de erros MFA.
- `usePendingSimulation` remontado no `RequireAuth`, restaurando a transferência de simulações públicas pós-cadastro.
- Cooldown de 30 dias em alertas de meta, preservando marcos extraordinários.
- Remoção de estado/UI mortos da Home (Zero Guilt) e de componente legado da landing.

---

## 2. Quality gates executados

| Verificação | Resultado |
|---|---|
| TypeScript (`tsc -b`) | 0 erros |
| ESLint (`eslint .`) | 0 erros / 0 warnings |
| Vitest completo | 620 arquivos / 6.024 testes aprovados |
| `npm run verify` (domínio) | 162 arquivos / 2.591 testes aprovados |
| Playwright E2E (desktop + mobile) | 8/8 testes aprovados |
| Build de produção Vite + PWA | Sucesso (sem warnings de dynamic import) |
| APK de release assinado | Gerado via `npm run build:apk` |

---

## 3. Artefatos

- `dist-apk/guia-financeiro-release.apk` (release assinado)
- `dist-apk/guia-financeiro-debug.apk`
- `public/releases/version.json` (v3.2.0 / versionCode 56)

---

## 4. Pendências externas (fora do código)

- Apontamento DNS de `axir.com.br` no Cloudflare Pages.
- Atualização de `Site URL` e `Redirect URLs` no dashboard do Supabase.
- Publicação de `/.well-known/assetlinks.json` com a impressão SHA-256 do keystore de release.
- Upload do APK para o Cloudflare R2 (`npm run upload:apk`), caso as credenciais não estejam disponíveis no ambiente local.
