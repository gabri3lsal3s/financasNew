# Relatório de SEO e Performance — Axir v3.3.0

- **Data:** 2026-11-12
- **Classificação:** Fluxo Completo (SEO, arquitetura de entrada e navegação agêntica)
- **Fonte:** `docs/diagnostics/auditoria_SEO.md`

## Entregas

### Metadados e indexação

- Título descritivo e `meta robots` indexável no `index.html`.
- Canonical absoluto, `hreflang` `pt-BR`/`x-default` e links `alternate` para `llms.txt` e catálogo ARD.
- OpenGraph e Twitter Card com URL absoluta, tipo, dimensões e texto alternativo.
- `useDocumentMeta` atualiza título, descrição, canonical, OG, Twitter e robots por rota:
  - `/` e aliases de apresentação;
  - `/planos`, `/precos`, `/vendas`;
  - `/ferramentas` e os três simuladores;
  - `/termos` e `/privacidade` (via `LegalPageShell`).
- Sitemap reduzido a URLs canônicas; robots bloqueia áreas autenticadas, checkout e links com token.

### Navegação agêntica

- `llms.txt` e `llms-full.txt` com resumo, recursos, ferramentas, privacidade, limites e documentação estendida.
- `ai-catalog.json` e `.well-known/ai-catalog.json` reescritos no schema **ARD 1.0**:
  - `specVersion`, `host` com `did:web`, `entries` com URN `urn:air:*`, `type`, `url`, `description`, `tags`, `capabilities` e `representativeQueries`.
- Validação dos dois arquivos contra o JSON Schema oficial (`ards-project/ard-spec`): **válidos**.
- `_headers` com COOP/CORP, Content-Type para `.txt`/`.json`/manifest e cache adequado.

### Caminho crítico e performance

- Fontes não bloqueantes: preload + ativação pelo bundle (o `onload` inline era bloqueado pela CSP e impedia a aplicação das fontes).
- `modulePreload: false` removeu o preload de 25 chunks de rotas lazy no `index.html`.
- `RootEntry` entrega a landing sem montar guards/stores/prefetch; App Shell autenticado é lazy.
- `AppProviders` mínimo; contexto de conta movido para `AuthenticatedProviders`.
- Imports profundos substituíram barrels pesados na landing, auth e ErrorBoundary.
- **Resultado medido:** JS transferido da landing caiu de ~787 KB para ~465 KB (-41%) em preview de produção, viewport iPhone 13, sem erros de console e sem overflow horizontal.

### Acessibilidade

- Menu mobile com alvos de 48px; pílulas e links da hero com 44px.
- Estados ativos da navegação com `text-primary-strong` (AA).
- Abas legais mobile com altura mínima de 44px.

## Verificações

- `tsc -b`: 0 erros.
- ESLint: 0 erros/0 warnings.
- Vitest: suíte completa (resultado no fechamento do lote).
- Playwright E2E: desktop + mobile.
- Build Vite/PWA: sucesso.
- Navegador headless: fontes aplicadas, metadados corretos, `canonical` e OG absolutos.

## Limitações

- As metas de campo do PageSpeed (LCP < 1,8 s e TBT < 150 ms) exigem medição pós-deploy com dados reais; não foram declaradas como atingidas.
- O `public/releases/version.json` permanece em 3.2.0/56 porque o manifest se refere ao último APK assinado; a versão web é 3.3.0.
