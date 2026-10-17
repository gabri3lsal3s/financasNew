# 📱 PWA_GUIDELINES.md — Requisitos de Progressive Web App

> **Status:** v1.6 — O app é um **PWA moderno** (instalável em mobile/desktop).
> **F5.6 & F83 implementados:** prompt de instalação (`beforeinstallprompt`), atualização automática com toast, auditoria automatizada de instalabilidade, estratégia Stale-While-Revalidate para imagens estáticas com expiração de 30 dias e monitoramento reativo de conectividade (`useNetworkStatus`).
> **v1.6 (2026-10-17):** **(1) Ciclo de Vida Atômico e Invalidação Integral de Cache** — ativação de `cleanupOutdatedCaches: true` no Workbox (`vite.config.ts`), isolamento de assets de marca (`pwa-brand-assets` com estratégia NetworkFirst e fallback offline) e rotina defensiva `purgeLegacyCaches()` em `src/app/pwa.ts`; **(2) Transição de Versão Sincronizada (Zero Mismatch)** — fluxo `applyPWAUpdate()` com disparo `{ type: "SKIP_WAITING" }`, sincronização com `controllerchange` em `navigator.serviceWorker` (com timeout defensivo de 4 segundos) e toast visual com transição atômica; **(3) Versionamento de Ícones para WebAPK Android** — query params determinísticos (`?v=2`) nas URLs dos ícones em `manifest.webmanifest` e `index.html`, sincronizados via `scripts/generate-icons.mjs`; **(4) Políticas Estritas de Borda** — cabeçalhos `_headers` calibrados para Cloudflare Pages (Service Worker e manifests com `max-age=0, must-revalidate`; chunks `/assets/*` com `immutable`).
> **v1.5 (2026-10-16):** **(1) Experiência PWA Avançada no iOS Safari** — detecção de dispositivos Apple iOS (`isIOS`) e abertura do modal guiado `IosPwaInstallDialog` com passo a passo ilustrado ("Compartilhar > Adicionar à Tela de Início"); **(2) Atalho Unificado de Instalação nas Configurações** — `InstallAppButton` operando em variantes `banner` (menu "Mais") e `card` (aba de Personalização/Aparência em `AppearanceTab`); **(3) Snapshot Estável Reativo** — `usePWAInstall()` alimentado por snapshot memoizado compatível com React Compiler via `useSyncExternalStore`.
> **v1.4 (2026-09-02):** **(1) RuntimeCaching Stale-While-Revalidate para Imagens Estáticas** — no `vite.config.ts`, cache otimizado com limite de 60 entradas e expiração de 30 dias para PNG, JPG, SVG, WEBP e ICO; **(2) Monitoramento Reativo de Conectividade** — serviço `src/services/network-status.ts` e hook `useNetworkStatus()` via `useSyncExternalStore`; **(3) Auditoria Automatizada Estendida** — `pwa-audit.test.ts` validando presença da casca offline e das regras do Workbox.
> **v1.3 (2026-08-17):** **(1) HTML Splash Screen Minimalista em Fundo Branco** — `<div id="app-splash">` inline no `index.html` e no manifest com fundo branco sólido (`#FFFFFF`), ícone centralizado de 144px sem texto, animação de pulso sutil; some instantaneamente via `#root:not(:empty)`; **(2) Sincronização Dinâmica da Barra de Título** — sincronização em tempo real de `<meta name="theme-color">` no bootstrap (`index.html`) e no `ThemeProvider`, com suporte a `.app-region-drag` e `.app-region-no-drag` no header do `PageShell`; **(3) Estratégia Híbrida de Ícones PWA** — ícones `purpose: "any"` transparentes (desktop, iOS e launchers modernos) e ícones `purpose: "maskable"` com fundo branco (`#FFFFFF`, safe zone 80%) para dispositivos com recorte adaptativo; **(4) `offline.html` redesenhado** — Inter, ícone 96px, botão discreto no tom do design system, suporte aos 3 temas, fade-in.
> **Regra-mestra:** o app é **100% Online First** nos dados — o Service Worker **jamais cacheia dados de negócio ou respostas de API**. O PWA garante apenas o **carregamento instantâneo do App Shell** (casca visual) e de assets estáticos.
> Implementação recomendada: **vite-plugin-pwa** (gera manifest + service worker a partir de config, com Workbox).

---

## 1. ESTRUTURA DE ARQUIVOS PWA

```
public/
├── favicon.ico                       # Multi-resolução (16, 32, 48) transparente
├── favicon.svg                       # Favicon vetorial/SVG transparente
├── brand/                            # Assets oficiais da marca (ver §3)
│   ├── logo.png (512x512)
│   ├── logo-192.png / logo-128.png / logo-64.png / logo-32.png
│   ├── favicon-32.png / favicon-16.png / favicon.svg
│   └── logo-full.png
└── pwa/
    ├── manifest.webmanifest          # Manifest (ver §2)
    ├── icons/                        # Ícones PWA transparentes (icon-only) + maskable
    │   ├── icon-192.png (transparente, purpose: "any")
    │   ├── icon-512.png (transparente, purpose: "any")
    │   ├── maskable-192.png (fundo branco, safe zone 80%, purpose: "maskable")
    │   ├── maskable-512.png (fundo branco, safe zone 80%, purpose: "maskable")
    │   └── apple-touch-icon-180.png (transparente, 180x180)
    ├── screenshots/                  # UI de instalação enriquecida (Chrome)
    │   ├── desktop-1280x800.png
    │   └── mobile-720x1280.png
    └── offline.html                  # Fallback offline (App Shell mínimo com logo)

src/
└── app/
    └── pwa.ts                        # Registro do SW + fluxo de instalação
```

- Manifest e ícones ficam em `public/pwa/` (servidos na raiz como `/pwa/…`).
- O Service Worker é **gerado no build** (vite-plugin-pwa) — nunca versionar `sw.js` na mão.

---

## 2. MANIFEST (`manifest.webmanifest`)

Referência completa (ajustar nomes à marca final):

```json
{
  "id": "/",
  "name": "Guia Financeiro — Gestão Financeira Pessoal",
  "short_name": "Guia Financeiro",
  "description": "Gestão de gastos, orçamentos, relatórios, insights e rebalanceamento de carteira.",
  "lang": "pt-BR",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FFFFFF",
  "theme_color": [
    { "color": "#F4F7F9", "media": "(prefers-color-scheme: light)" },
    { "color": "#0C1923", "media": "(prefers-color-scheme: dark)" }
  ],
  "categories": ["finance", "productivity"],
  "icons": [
    { "src": "/pwa/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/pwa/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/pwa/icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/pwa/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Lançar despesa", "url": "/transacoes?novo=despesa" },
    { "name": "Visão geral", "url": "/" }
  ]
}
```

**Campos obrigatórios:** `name`, `short_name`, `start_url`, `display: standalone`, `background_color`, `theme_color`, `icons` (192 + 512 com `purpose: any` e `purpose: maskable`), `description`.

**Campos recomendados:** `id`, `scope`, `orientation: portrait` (respeita o padrão vertical e o bloqueio de rotação do dispositivo móvel), `lang: pt-BR`, `categories`, `shortcuts` (atalhos de ações frequentes — lançamento rápido, D10).

**Bloqueio estrito de orientação (portrait only):**
1. **Manifest** — `orientation: portrait` + `display: standalone` (PWA instalado: o sistema respeita a trava e não rotaciona);
2. **JS** — `src/services/orientation-lock.ts` chama `screen.orientation.lock("portrait-primary")` / `lock("portrait")` no bootstrap e no primeiro gesto do usuário (pointerdown/touchstart/click), além de reaplicar em `visibilitychange` e `fullscreenchange` (no-op silencioso onde não suportado).

**Arquivos:** `src/services/orientation-lock.ts` (+ testes em `src/services/orientation-lock.test.ts`).

**Cores do manifesto (alinhadas ao DESIGN_SYSTEM — identidade "Guia Financeiro", F10):**
- `background_color`: `#0C1923` — fundo do splash nativo (Android/iOS) no tom Abissal dark; elimina o flash branco para usuários de tema escuro. Em light o HTML splash cobre imediatamente.
- `theme_color`: suporta `media` para light/dark:
  ```json
  "theme_color": [
    { "color": "#F4F7F9", "media": "(prefers-color-scheme: light)" },
    { "color": "#0C1923", "media": "(prefers-color-scheme: dark)" }
  ]
  ```
- `display_override`: `["window-controls-overlay", "standalone"]` — ativa a **Window Controls Overlay** (WCO) em Chrome/Edge, permitindo pintar a barra de título da janela do PWA com o tema do app (ver §4.1). Fallback `standalone` para browsers sem suporte a WCO.

---

## 3. ÍCONES

| Arquivo | Tamanho | Propósito | Uso |
|---|---|---|---|
| `icon-192.png` | 192×192 | `purpose: "any"` | Manifest — padrão icon-only com **fundo 100% transparente** |
| `icon-512.png` | 512×512 | `purpose: "any"` | Manifest — padrão icon-only com **fundo 100% transparente** |
| `maskable-192.png` | 192×192 | `purpose: "maskable"` | Manifest — recorte adaptativo Android (safe zone 80% em fundo branco) |
| `maskable-512.png` | 512×512 | `purpose: "maskable"` | Manifest — recorte adaptativo Android (safe zone 80% em fundo branco) |
| `apple-touch-icon-180.png` | 180×180 | — | iOS (add to home screen) |
| `favicon.svg` | Vetorial/Scalable | — | Navegadores modernos (renderização nítida transparente) |
| `favicon.ico` + `favicon-32.png/16.png` | 16/32/48 | — | Navegador legado e abas |

**Requisitos dos ícones:**
- **Ícone Padrão PWA (Icon-Only / `purpose: "any"`):** PNG com **fundo 100% transparente**, sem caixa de fundo branca ou preta, permitindo visual livre e moderno no desktop (Windows, macOS, Linux, ChromeOS) e mobile.
- **Maskable (`purpose: "maskable"`):** Conteúdo essencial dentro dos **80% centrais** (zona segura de recorte) com fundo preenchido uniforme `#FFFFFF`, garantindo que launchers adaptativos (Android One UI, Pixel Launcher, MIUI) apliquem suas máscaras sem cortar o logotipo.
- Gerados pelo script `scripts/generate-icons.mjs` (`npm run icons`) a partir dos assets oficiais em `public/brand/`.

---

## 4. META TAGS E SPLASH

**`index.html`:**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="Gestão financeira pessoal e rebalanceamento de carteira." />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F4F7F9" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
<link rel="manifest" href="/pwa/manifest.webmanifest" />
<link rel="icon" href="/pwa/icons/icon-192.png" sizes="192x192" />
<link rel="apple-touch-icon" href="/pwa/icons/apple-touch-icon-180.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Guia Financeiro" />
```

**Splash screens:**
- **Prevenção de Forced Dark Quebrado:** `<meta name="color-scheme" content="light dark" />` e CSS `color-scheme: light/dark` sinalizam aos motores de Auto Dark Mode (Chromium/Samsung Internet/Brave) que o app possui seus próprios temas nativos, desativando a inversão algorítmica destrutiva. O tema escuro padrão do sistema/forced-dark resolve para **OLED** (`#000000`).
- **Android:** o splash é automático (ícone + `background_color` do manifest) — `background_color: #0C1923` (Abissal) minimiza o flash ao abrir em tema escuro; em light, o HTML splash cobre o fundo imediatamente.
- **HTML Splash Screen (`index.html`):** a `<div id="app-splash">` renderiza imediatamente dentro do `#root` antes do React montar, exibindo o ícone do app em 144px com animação pulse sutil. O fundo sincroniza imediatamente ao tema ativo do usuário (`light` #F4F7F9, `dark` #0C1923, `oled` #000000) recuperado síncronamente do storage. Some automaticamente via CSS `#root:not(:empty) #app-splash { opacity: 0 }` assim que o React monta qualquer conteúdo. Animações desativadas em `prefers-reduced-motion: reduce` e `data-motion="reduced"`/`"eco"`.
- **iOS:** `apple-touch-startup-image` (tamanhos por device — opcional); sem isso, o iOS compõe da `apple-touch-icon` + fundo. Validar em device real.
- `viewport-fit=cover` garante respeito às "safe areas" (notch) no modo standalone.

---

## 4.1 WINDOW CONTROLS OVERLAY (WCO)

> Suportado em **Chrome e Edge** para PWAs instalados. Não afeta o comportamento no browser comum.

**O que é:** a WCO permite ao app "pintar" a área da barra de título da janela nativa do OS, substituindo o título genérico + ícone pelo design do próprio app.

**Ativação:** `display_override: ["window-controls-overlay", "standalone"]` no manifest — o browser testa as opções em ordem; se suportar WCO usa-a, senão cai em `standalone`.

**Implementação no `index.html`:**
- `<div id="app-titlebar">` posicionada com `position: fixed` e dimensionada pelas variáveis de ambiente CSS:
  ```css
  left: env(titlebar-area-x, 0);
  top: env(titlebar-area-y, 0);
  width: env(titlebar-area-width, 100%);
  height: env(titlebar-area-height, 33px);
  ```
- Toda a área é `-webkit-app-region: drag` (mover a janela ao arrastar).
- Sem ícone, sem texto — apenas a cor de fundo no tom do tema ativo + borda inferior:

  | Tema | Fundo | Borda |
  |---|---|---|
  | Light | `#F4F7F9` | `#D7E1E6` |
  | Dark | `#0C1923` | `#23384A` |
  | OLED | `#000000` | `#2E2E2E` |

- Valores hard-coded (mesmos dos tokens) para funcionar **antes** do Tailwind/React — sem flash de cor incorreta.
- Seleção de tema via `[data-theme]` que o script inline aplica antes do render.
- O `#root` recebe `padding-top: env(titlebar-area-height, 33px)` para o conteúdo não ficar obscurecido pela barra.
- A `<div>` tem `display: none` por padrão; só aparece dentro de `@media (display-mode: window-controls-overlay)`.

**Para ver o efeito:** desinstale e reinstale o PWA (o manifest atualizado é lido na reinstalação). Chrome → menu `⋮` → "Instalar Guia Financeiro".

---

## 5. SERVICE WORKER — ESTRATÉGIAS DE CACHE

> Implementação com `vite-plugin-pwa` + Workbox. **Regra absoluta: nenhuma rota de API (Supabase, RPCs, cotações) entra em runtimeCaching — dados de negócio nunca são cacheados no cliente.**

| Recurso | Estratégia | Justificativa |
|---|---|---|
| App Shell (HTML + JS/CSS do build, com hash) | **Precache** (cache-first, imutáveis) | Carregamento instantâneo da casca visual (`cleanupOutdatedCaches: true`) |
| Fontes (Google Fonts) e imagens estáticas | **Stale-while-revalidate** (cache 1 ano / 30 dias) | Rápido e sempre atualizável |
| Ícones PWA e assets de marca (`/pwa/icons/*`, `/brand/*`) | **NetworkFirst** (`pwa-brand-assets`, timeout 3s) | Revalidação de rede imediata com fallback para cache offline |
| **API (Supabase, RPC, cotações)** | **Network only** — fora do SW | Online First: dados sempre da nuvem; erro explícito + retry manual |
| Navegação (rotas client-side) | `navigateFallback: /index.html` (App Shell precached) | Refresh/deep-links sempre carregam a casca; offline tratado na própria UI |

**App Shell (definição):** layout, navegação (sidebar/bottom tabs), primitivos de UI e a página offline — o que torna a abertura instantânea. Os **dados** das telas continuam carregando via API com **skeletons** (regra de loading do DESIGN_SYSTEM).

**Estado offline (na prática):** o `navigateFallback` serve o **App Shell** (index.html precached) para qualquer navegação — com rede, os dados carregam normalmente; **sem rede, a casca renderiza e as queries falham com erro explícito + "Tentar novamente"** (Online First — nunca dados fantasmas). O arquivo `public/pwa/offline.html` permanece como página estática de emergência (acesso direto), mantendo o padrão visual da marca.

---

## 6. INSTALAÇÃO E CICLO DE VIDA (IMPLEMENTADO — F5.6 & TAREFA 4.6)

**Critérios de instalação (Chrome):** HTTPS (localhost ok) · manifest com `name`/`short_name`/ícones 192+512 versionados (`?v=2`) · SW com `fetch` handler · app aberto 2+ vezes com intervalo.
**Critérios de instalação (iOS / Safari):** Safari no iOS/iPadOS · fora do modo standalone · exibição guiada de "Compartilhar > Adicionar à Tela de Início".

**Fluxo implementado:**

1. **Registro do SW (`src/app/pwa.ts`):** `registerSW({ immediate: true, onNeedReload, onRegisterError })` — o callback de atualização retornado (`updateSW(true)`) é preservado no módulo.
2. **Atualização Atômica Sincronizada com Toast:** quando um novo Service Worker é detectado, a store externa é notificada via `notifyPWAUpdate()`. O `PWAUpdateToast` exibe "Nova versão disponível". Ao clicar em **"Atualizar"**, executa-se o fluxo atômico `applyPWAUpdate()`:
   - Dispara `{ type: "SKIP_WAITING" }` para a registration ativa;
   - Escuta e aguarda o evento `controllerchange` em `navigator.serviceWorker` (com timeout defensivo de 4 segundos via `waitForControllerChange(4000)`);
   - Transita visualmente para o estado "Atualizando para a nova versão..." (desabilitando cliques adicionais);
   - Executa purga explícita de caches obsoletos (`purgeLegacyCaches()`);
   - Dispara `window.location.reload()` somente após confirmação de que o novo SW assumiu o controle de todos os clientes ativos (`clientsClaim`).
3. **Instalação no Chromium (`beforeinstallprompt`):** o `pwa.ts` escuta o evento (com `preventDefault()`, exigência do Chromium), guarda o prompt e notifica a store (`subscribePWAInstall`/`getPWAInstallSnapshot`). O hook `usePWAInstall` (useSyncExternalStore) alimenta o **`InstallAppButton`** — **nunca popup intrusivo** (regra: após interação, no menu "Mais" ou na aba de Configurações).
4. **Instalação no iOS Safari (`IosPwaInstallDialog`):** como o Safari no iOS não suporta `beforeinstallprompt`, utilitários em `src/app/pwa.ts` (`isIOS()`, `getIsIOSInstallCandidate()`) detectam iPhones e iPads fora do modo standalone. Ao clicar em "Como instalar no iOS", o diálogo canônico `IosPwaInstallDialog` (`src/components/modules/ios-pwa-install-dialog.tsx`) exibe as 3 etapas ilustradas com ícones padronizados (sem emojis).
5. **Atalhos Unificados no App:** o `InstallAppButton` está disponível no menu "Mais" (`variant="banner"`) e na aba de Configurações/Personalização (`variant="card"` em `AppearanceTab`). Em ambientes instalados (standalone) ou app nativo (Capacitor), oculta-se ou exibe o badge de confirmação ("Instalado").
6. **Splash/iOS:** meta tags no `index.html` (theme-color por tema, `apple-mobile-web-app-*`, apple-touch-icon, `viewport-fit=cover` para safe areas) + manifest com `theme_color` por `media` — auditados por teste (`tests/pwa-audit.test.ts`).

**Do & Don't:**
- ✅ Prompt de instalação após interação do usuário (nunca no primeiro acesso; botão no menu ou card em configurações).
- ✅ Guia ilustrado passo a passo no iOS Safari com ícones do Design System e zero emojis.
- ✅ Toast de atualização não-blocking e sem reload automático (o usuário decide).
- ❌ Nunca interceptar navegação para cachear telas com dados (viola Online First).
- ❌ Nunca `cache-first` para endpoints dinâmicos.

**Arquivos:** `src/app/pwa.ts` (registro + stores) · `src/hooks/use-pwa-install.ts` · `src/components/modules/pwa-update-toast.tsx` · `src/components/modules/install-app-button.tsx` · `src/components/modules/ios-pwa-install-dialog.tsx` · `src/features/settings/components/tabs/appearance-tab.tsx` · `src/components/ui/toast.tsx` · testes em `src/tests/pwa.test.tsx`, `src/components/modules/ios-pwa-install-dialog.test.tsx` e `src/tests/pwa-audit.test.ts`.

---

## 7. CHECKLIST DE ACEITE (PWA)

**Auditoria automatizada (CI — `src/tests/pwa-audit.test.ts`):** manifest válido (campos + ícones 192/512/maskable) · ícones em disco · meta tags PWA/iOS + safe areas · fluxo do SW (autoUpdate + onNeedReload + beforeinstallprompt).

**Auditoria manual (Lighthouse — exige app servido em HTTPS):** rodar `npm run build` + servir `dist/` (ex.: `npx serve dist`) e executar o Lighthouse (Chrome DevTools → Lighthouse → category PWA/Progressive Web App). Com o Lighthouse v10+ a categoria PWA foi absorvida; validar os checks de **instalabilidade** (manifest, SW, HTTPS) e **PWA otimizado** (offline no shell, redirects de HTTP→HTTPS).

- [ ] Lighthouse instalável: manifest válido + SW com fetch + HTTPS.
- [ ] Manifest válido (ícones 192/512/maskable; `display: standalone`).
- [ ] Instalação funciona em Android (Chrome) e desktop (Chrome/Edge); iOS via "Adicionar à tela de início" (botão "Instalar app" no menu "Mais").
- [ ] Abertura com rede lenta: shell instantâneo + skeletons nos dados.
- [ ] Abertura offline: shell carrega do cache e a UI exibe estado offline com retry; sem dados falsos.
- [ ] Atualização de versão: toast "Nova versão disponível" + "Atualizar" recarrega sem perda de estado.
- [ ] Safe areas (notch) respeitadas no modo standalone (`viewport-fit=cover`).
- [ ] Tema do status bar coerente com light/dark/oled.
- [ ] Rotação bloqueada em retrato (manifest + `screen.orientation.lock`).
