# 📱 PWA_GUIDELINES.md — Requisitos de Progressive Web App

> **Status:** v1.0 — O app é um **PWA moderno** (instalável em mobile/desktop).
> **Regra-mestra:** o app é **100% Online First** nos dados — o Service Worker **jamais cacheia dados de negócio ou respostas de API**. O PWA garante apenas o **carregamento instantâneo do App Shell** (casca visual) e de assets estáticos.
> Implementação recomendada: **vite-plugin-pwa** (gera manifest + service worker a partir de config, com Workbox).

---

## 1. ESTRUTURA DE ARQUIVOS PWA

```
public/
├── favicon.ico
└── pwa/
    ├── manifest.webmanifest          # Manifest (ver §2)
    ├── icons/                        # Ícones (ver §3)
    │   ├── icon-192.png
    │   ├── icon-512.png
    │   ├── maskable-512.png
    │   └── apple-touch-icon-180.png
    ├── screenshots/                  # UI de instalação enriquecida (Chrome)
    │   ├── desktop-1280x800.png
    │   └── mobile-720x1280.png
    └── offline.html                  # Fallback offline (App Shell mínimo)

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
  "name": "Finanças — Gestão Financeira Pessoal",
  "short_name": "Finanças",
  "description": "Gestão de gastos, orçamentos, relatórios, insights e rebalanceamento de carteira.",
  "lang": "pt-BR",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#FAFAF9",
  "theme_color": "#10B981",
  "categories": ["finance", "productivity"],
  "icons": [
    { "src": "/pwa/icons/icon-192.png",  "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa/icons/icon-512.png",  "sizes": "512x512", "type": "image/png" },
    { "src": "/pwa/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Lançar despesa", "url": "/transacoes?novo=despesa" },
    { "name": "Visão geral", "url": "/" }
  ]
}
```

**Campos obrigatórios:** `name`, `short_name`, `start_url`, `display: standalone`, `background_color`, `theme_color`, `icons` (192 + 512), `description`.

**Campos recomendados:** `id`, `scope`, `orientation: any` (o app funciona em retrato e paisagem), `lang: pt-BR`, `categories`, `shortcuts` (atalhos de ações frequentes — lançamento rápido, D10).

**Cores do manifesto (alinhadas ao DESIGN_SYSTEM):**
- `background_color`: `#FAFAF9` (light) — define o splash em Android.
- `theme_color`: suporta `media` para light/dark:
  ```json
  "theme_color": [
    { "color": "#FAFAF9", "media": "(prefers-color-scheme: light)" },
    { "color": "#0F172A", "media": "(prefers-color-scheme: dark)" }
  ]
  ```

---

## 3. ÍCONES

| Arquivo | Tamanho | Uso |
|---|---|---|
| `icon-192.png` | 192×192 | Manifest — instalável (requisito Chrome) |
| `icon-512.png` | 512×512 | Manifest — splash e lojas |
| `maskable-512.png` | 512×512 | Manifest (`purpose: maskable`) — recorte adaptativo |
| `apple-touch-icon-180.png` | 180×180 | iOS (add to home screen) |
| `favicon.ico` + `favicon-32.png/16.png` | 16/32 | Navegador |

**Requisitos dos ícones:**
- PNG, com fundo **não transparente** (192/512 e apple-touch).
- **Maskable:** o conteúdo essencial dentro dos **80% centrais** (zona segura de recorte); fundo preenchido com a cor da marca.
- Gerados a partir do logo da marca (identidade "Vital" — esmeralda sobre neutro), nas resoluções acima.

---

## 4. META TAGS E SPLASH

**`index.html`:**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="Gestão financeira pessoal e rebalanceamento de carteira." />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#FAFAF9" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0F172A" />
<link rel="manifest" href="/pwa/manifest.webmanifest" />
<link rel="icon" href="/pwa/icons/icon-192.png" sizes="192x192" />
<link rel="apple-touch-icon" href="/pwa/icons/apple-touch-icon-180.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Finanças" />
```

**Splash screens:**
- **Android:** o splash é automático (ícone + `background_color` do manifest) — manter `background_color` consistente com o tema para evitar "flash" branco.
- **iOS:** usar `apple-touch-startup-image` (tamanhos por device — opcional); sem isso, o iOS compõe da `apple-touch-icon` + fundo. Validar em device real.
- `viewport-fit=cover` garante respeito às "safe areas" (notch) no modo standalone.

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

## 6. INSTALAÇÃO E CICLO DE VIDA

**Critérios de instalação (Chrome):** HTTPS (localhost ok) · manifest com `name`/`short_name`/ícones 192+512 · SW com `fetch` handler · app aberto 2+ vezes com intervalo.

**Fluxo (`src/app/pwa.ts`):**
1. Registrar o SW no load (`registerType: 'autoUpdate'` → `skipWaiting` + `clientsClaim`).
2. Ouvir `beforeinstallprompt` → guardar o evento e **mostrar botão "Instalar app"** (em menu/rodapé, nunca popup intrusivo).
3. Ao clicar → `prompt()` → `appinstalled` → ocultar o botão.
4. **Atualização:** quando um novo SW é detectado, exibir **toast "Nova versão disponível — atualizar"** (o autoUpdate aplica na próxima abertura ou no clique).

**Do & Don't:**
- ✅ Prompt de instalação após interação do usuário (nunca no primeiro acesso).
- ✅ Toast de atualização não-blocking.
- ❌ Nunca interceptar navegação para cachear telas com dados (viola Online First).
- ❌ Nunca `cache-first` para endpoints dinâmicos.

---

## 7. CHECKLIST DE ACEITE (PWA)

- [ ] Lighthouse PWA ≥ 90 (instalável, offline no shell, HTTPS).
- [ ] Manifest válido (ícones 192/512/maskable; `display: standalone`).
- [ ] Instalação funciona em Android (Chrome) e desktop (Chrome/Edge); iOS via "Adicionar à tela de início".
- [ ] Abertura com rede lenta: shell instantâneo + skeletons nos dados.
- [ ] Abertura offline: shell carrega do cache e a UI exibe estado offline com retry; sem dados falsos.
- [ ] Atualização de versão: toast + recarga limpa sem perda de estado.
- [ ] Safe areas (notch) respeitadas no modo standalone (`viewport-fit=cover`).
- [ ] Tema do status bar coerente com light/dark/oled.
