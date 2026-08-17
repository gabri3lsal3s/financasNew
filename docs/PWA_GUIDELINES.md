# 📱 PWA_GUIDELINES.md — Requisitos de Progressive Web App

> **Status:** v1.3 — O app é um **PWA moderno** (instalável em mobile/desktop).
> **F5.6 implementado:** prompt de instalação (`beforeinstallprompt`), atualização automática com toast e auditoria automatizada de instalabilidade — ver §6.
> **v1.3 (2026-08-17):** **(1) HTML Splash Screen com Azul Petróleo** — `<div id="app-splash">` inline no `index.html` com fundo Azul Petróleo Abissal (`#0C1923`), ícone ampliado de 144px sem texto, animação pulse + barra de progresso teal; some automaticamente via `#root:not(:empty)`; **(2) Sincronização Dinâmica da Barra de Título** — sincronização em tempo real de `<meta name="theme-color">` no bootstrap (`index.html`) e no `ThemeProvider`, com suporte a `.app-region-drag` e `.app-region-no-drag` no header do `PageShell`; **(3) Estratégia Híbrida de Ícones PWA** — ícones `purpose: "any"` transparentes (desktop, iOS e launchers modernos) e ícones `purpose: "maskable"` com fundo branco (`#FFFFFF`, safe zone 80%) para dispositivos com recorte adaptativo; **(4) `offline.html` redesenhado** — Inter, ícone 96px, botão discreto no tom do design system, suporte aos 3 temas, fade-in.
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
- Gerados pelo script `scripts/generate-icons.mjs` (`npm run icons`) a partir da marca "Guia Financeiro" (`identidadeVisual/foto-sem-fundo.png`).

---

## 4. META TAGS E SPLASH

**`index.html`:**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="Gestão financeira pessoal e rebalanceamento de carteira." />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F4F7F9" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0C1923" />
<link rel="manifest" href="/pwa/manifest.webmanifest" />
<link rel="icon" href="/pwa/icons/icon-192.png" sizes="192x192" />
<link rel="apple-touch-icon" href="/pwa/icons/apple-touch-icon-180.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Guia Financeiro" />
```

**Splash screens:**
- **Android:** o splash é automático (ícone + `background_color` do manifest) — `background_color: #0C1923` (Abissal) minimiza o flash ao abrir em tema escuro; em light, o HTML splash cobre o fundo imediatamente.
- **HTML Splash Screen (`index.html`):** a `<div id="app-splash">` renderiza imediatamente dentro do `#root` antes do React montar, exibindo o ícone do app em 120px com animação pulse e barra de progresso teal. Usa os mesmos valores dos tokens dos 3 temas via seletores `[data-theme]` (aplicados pelo script inline antes do render — sem flash). Some automaticamente via CSS `#root:not(:empty) #app-splash { opacity: 0 }` assim que o React monta qualquer conteúdo. Animações desativadas em `prefers-reduced-motion: reduce` e `data-motion="reduced"`/`"eco"`.
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
| App Shell (HTML + JS/CSS do build, com hash) | **Precache** (cache-first, imutáveis) | Carregamento instantâneo da casca visual |
| Fontes (Google Fonts) e imagens estáticas | **Stale-while-revalidate** (cache 1 ano) | Rápido e sempre atualizável |
| Ícones PWA | **Cache-first** | Assets imutáveis |
| **API (Supabase, RPC, cotações)** | **Network only** — fora do SW | Online First: dados sempre da nuvem; erro explícito + retry manual |
| Navegação (rotas client-side) | `navigateFallback: /index.html` (App Shell precached) | Refresh/deep-links sempre carregam a casca; offline tratado na própria UI |

**App Shell (definição):** layout, navegação (sidebar/bottom tabs), primitivos de UI e a página offline — o que torna a abertura instantânea. Os **dados** das telas continuam carregando via API com **skeletons** (regra de loading do DESIGN_SYSTEM).

**Estado offline (na prática):** o `navigateFallback` serve o **App Shell** (index.html precached) para qualquer navegação — com rede, os dados carregam normalmente; **sem rede, a casca renderiza e as queries falham com erro explícito + "Tentar novamente"** (Online First — nunca dados fantasmas). O arquivo `public/pwa/offline.html` permanece como página estática de emergência (acesso direto), mantendo o padrão visual da marca.

---

## 6. INSTALAÇÃO E CICLO DE VIDA (IMPLEMENTADO — F5.6)

**Critérios de instalação (Chrome):** HTTPS (localhost ok) · manifest com `name`/`short_name`/ícones 192+512 · SW com `fetch` handler · app aberto 2+ vezes com intervalo.

**Fluxo implementado:**

1. **Registro do SW (`src/app/pwa.ts`):** `registerSW({ immediate: true, onNeedReload, onRegisterError })` — `registerType: 'autoUpdate'` (o SW gerado no build tem `skipWaiting` + `clientsClaim`).
2. **Atualização automática com toast:** com `autoUpdate`, quando um SW novo ativa, o plugin chamaria `onNeedReload` e recarregaria a página; **interceptamos** com o callback e notificamos a store externa (`notifyPWAUpdate`/`consumePWAUpdate`). O `PWAUpdateToast` (global, montado no `Toaster` em `app/providers.tsx`) anuncia "Nova versão disponível" com a ação **"Atualizar"** (reload explícito — o usuário decide, sem perda de estado) ou pode fechar (o anúncio é consumido; uma nova versão re-anuncia). O toast usa `duration: Infinity` (não some sozinho até o usuário agir).
3. **Instalação (`beforeinstallprompt`):** o `pwa.ts` escuta o evento (com `preventDefault()`, exigência do Chromium), guarda o prompt e notifica a store (`subscribePWAInstall`/`getCanInstallPWA`). O hook `usePWAInstall` (useSyncExternalStore) alimenta o **`InstallAppButton`** no menu "Mais" — **nunca popup intrusivo** (regra: após interação, em menu/rodapé).
4. Ao clicar → `prompt()` → `userChoice` → o evento é de uso único (o botão some). O listener de `appinstalled` também oculta o botão, e `isStandalone()` (`display-mode: standalone` / `navigator.standalone` do iOS) impede o botão quando o app já roda instalado.
5. **Splash/iOS:** meta tags no `index.html` (theme-color por tema, `apple-mobile-web-app-*`, apple-touch-icon, `viewport-fit=cover` para safe areas) + manifest com `theme_color` por `media` — auditados por teste (`tests/pwa-audit.test.ts`).

**Do & Don't:**
- ✅ Prompt de instalação após interação do usuário (nunca no primeiro acesso; botão no menu).
- ✅ Toast de atualização não-blocking e sem reload automático (o usuário decide).
- ❌ Nunca interceptar navegação para cachear telas com dados (viola Online First).
- ❌ Nunca `cache-first` para endpoints dinâmicos.

**Arquivos:** `src/app/pwa.ts` (registro + stores) · `src/hooks/use-pwa-install.ts` · `src/components/modules/pwa-update-toast.tsx` · `src/components/modules/install-app-button.tsx` · `src/components/ui/toast.tsx` (prop `action` + Toaster corrigido) · testes em `src/tests/pwa.test.tsx` e `src/tests/pwa-audit.test.ts`.

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
