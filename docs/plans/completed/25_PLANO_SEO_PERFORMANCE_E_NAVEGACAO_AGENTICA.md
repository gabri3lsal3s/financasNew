# Plano 25 — SEO, Performance de Entrada e Navegação Agêntica

- **Status:** Concluído
- **Versão:** v3.3.0
- **Fonte:** `docs/diagnostics/auditoria_SEO.md`
- **Data:** 2026-11-12

## Escopo executado

1. **Caminho crítico**
   - Fontes Google não bloqueantes com ativação via bundle (removido `onload` inline bloqueado pela CSP).
   - Splash em WebP com dimensões explícitas, `will-change` e `prefers-reduced-motion`.
   - `modulePreload: false` para impedir o preload global de todos os chunks lazy.
2. **Desacoplamento do App Shell**
   - `RootEntry` síncrono na raiz; landing sem guards/stores/prefetch.
   - `AuthenticatedRoot` + `RequireAuth` + guards + `PageShell` + `OverviewPage` sob demanda.
   - `AppProviders` mínimo e `AuthenticatedProviders` para contexto de conta.
   - Imports profundos em landing/auth para eliminar barrels pesados.
3. **SEO técnico**
   - Título/descrição/robots/author/canonical/hreflang.
   - OG/Twitter com URLs absolutas, tipo, dimensões e `alt`.
   - JSON-LD já existente mantido (SoftwareApplication, Organization, FAQPage).
   - `useDocumentMeta` por rota em landing, planos, ferramentas, termos e privacidade.
4. **Navegação agêntica**
   - `llms.txt` e `llms-full.txt` revisados (H1, resumo, links, limites, catálogo).
   - `ai-catalog.json` e `.well-known/ai-catalog.json` no schema ARD 1.0, validados por JSON Schema.
5. **Indexação**
   - Sitemap somente com URLs canônicas.
   - Robots bloqueando auth, checkout, painel e compartilhamentos com token.
6. **Acessibilidade**
   - Alvos de toque 48px no menu mobile e 44px nas pílulas/links da hero.
   - Estados ativos com `text-primary-strong` (contraste AA).

## Verificação

- `tsc -b` e ESLint: 0 erros.
- Suíte Vitest completa e E2E Playwright.
- Build Vite/PWA sem warnings de dynamic import.
- Navegador headless mobile: sem overflow horizontal, sem erros de console, fontes Inter aplicadas, metadados corretos.
- JS transferido da landing: **~787 KB → ~465 KB** (medição local, viewport iPhone 13, preview de produção).

## Fora do escopo / limitações

- Métricas de campo do PageSpeed/Lighthouse (LCP/TBT reais) dependem de deploy e dados de campo; não foram declaradas como atingidas.
- O restante do grafo compartilhado (`vendor-react`, `vendor-backend`, `utils`) permanece no bundle público por necessidade de sessão/tema.
