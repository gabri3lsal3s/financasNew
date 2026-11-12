# Plano de Otimização de Desempenho, SEO e Navegação Agêntica

Este plano detalha o diagnóstico técnico e as soluções para elevar as métricas do PageSpeed Insights, transformando o **Desempenho Mobile de 58 para 90+**, reduzindo o **LCP de 5,9s para < 1,8s** e o **TBT de 670ms para < 150ms**, além de alcançar **100 em SEO**, **100 em Acessibilidade/Boas Práticas** e **4/4 em Navegação Agêntica (WebMCP/AI-readiness)**.

---

## 1. Diagnóstico dos Gargalos Identificados no PageSpeed

| Métrica / Diagnóstico | Valor Atual (Mobile) | Causa Raiz Técnica | Meta Pós-Otimização |
|---|---|---|---|
| **Desempenho Geral** | **58 / 100** | Bloqueio de fontes, bundle inicial com App Shell desnecessário, execução longa de JS | **90+ / 100** |
| **LCP (Largest Contentful Paint)** | **5,9 s** (Crítico) | Google Fonts bloqueando renderização (730ms) + 1.5MB de JS bloqueando a thread antes da pintura | **< 1,8 s** |
| **TBT (Total Blocking Time)** | **670 ms** (Alto) | Thread principal ocupada 3,2s com parse/execução de dependências desnecessárias na home | **< 150 ms** |
| **JavaScript não usado** | **~513 KiB** | `PageShell` e `GlobalSearch` importados estaticamente no roteador, arrastando todo o estado privado | **Eliminado na Home** |
| **Entrega de imagens** | **91 KiB desperdiçados** | Splash screen usando PNGs de 22 KiB quando existem WebP de 8 KiB prontos | **WebP (< 10 KiB)** |
| **Navegação Agêntica** | **2 / 4** | Ausência de `llms.txt` e `ai-catalog.json` (SPA retornava o `index.html` em fallback) | **4 / 4 (100%)** |
| **Acessibilidade** | **93 / 100** | Áreas de toque pequenas no mobile (< 48px), contrastes em textos secundários | **100 / 100** |
| **Boas Práticas** | **92 / 100** | Falta de cabeçalho `COOP` (Cross-Origin-Opener-Policy) no `_headers` | **100 / 100** |

---

## 2. Proposta de Mudanças

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARQUITETURA DE OTIMIZAÇÃO                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. CRITICAL RENDERING PATH (index.html)                                     │
│    • Google Fonts: font-display=swap + carregamento assíncrono não-bloqueante│
│    • Imagens da Splash: substituição direta de PNG (22KB) por WebP (8KB)   │
│    • Canonical URL estrita: <link rel="canonical" href="https://axir.com.br/"/> │
│    • Schema.org expandido: SoftwareApplication + Organization + FAQPage     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. DESACOPLAMENTO DO APP SHELL (router.tsx & code splitting)                │
│    • Rota "/" pública direta (LandingPage pura, sem instanciar RequireAuth) │
│    • Lazy loading de PageShell: evita que o visitante baixe cmdk e queries  │
│    • Importações diretas sem passar pelo barrel agressivo de layout         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. ENGENHARIA DE BUNDLE (vite.config.ts)                                    │
│    • Isolamento de vendor-picker (react-day-picker) e vendor-search (cmdk)  │
│    • modulePreload refinado para evitar waterfalls em conexões 4G lentas    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. NAVEGAÇÃO AGÊNTICA & SEO (public/llms.txt & ai-catalog.json)             │
│    • llms.txt conforme especificação llmstxt.org                            │
│    • ai-catalog.json e .well-known/ai-catalog.json estruturados             │
│    • Headers HTTP: COOP, Content-Type correto para .txt e .json             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detalhamento dos Componentes

### Componente 1: Caminho Crítico de Renderização & Head (`index.html`)

#### [MODIFY] [index.html](file:///home/gabrielsales/meus_apps/financasnew/index.html)
- **Desbloquear Renderização de Fontes:**
  Alterar o `<link rel="stylesheet">` das fontes Google Fonts para modelo assíncrono com preload e fallback:
  ```html
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Sora:wght@700;800&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'" />
  <noscript>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Sora:wght@700;800&display=swap" />
  </noscript>
  ```
  Isso elimina os **730 ms** de bloqueio de renderização no mobile.
- **Substituição de Imagens na Splash Screen:**
  Mudar `src="/brand/logo-teal-light-192.png"` para `src="/brand/logo-teal-light-192.webp"` e `.dark-192.webp`.
  No script inline da splash, usar os `.webp` para a variante Pro. Economia de **91 KiB** imediata.
- **Animações Compostas na Splash:**
  Adicionar `will-change: transform, opacity;` no CSS `.app-splash-icon` para evitar reflows durante a animação de pulso.
- **Canonical Tag:**
  Adicionar `<link rel="canonical" href="https://axir.com.br/" />`.
- **Dados Estruturados Schema.org:**
  Expandir o JSON-LD existente com:
  1. `Organization`: nome, url, logo, description, sameAs.
  2. `FAQPage`: principais perguntas da landing page para habilitar Rich Snippets de FAQ diretamente na página de resultados do Google.

---

### Componente 2: Otimização de Chunks e Roteador (`src/app/router.tsx` & `vite.config.ts`)

#### [MODIFY] [src/app/router.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/app/router.tsx)
- **Isolar a Rota Raiz `/` do `RequireAuth`:**
  Atualmente, a rota `/` é interceptada dentro de `RequireAuth`, o que força a montagem de listeners e traz referências ao App Shell.
  Declarar a rota `/` no topo de `<Routes>`:
  Se o usuário não tiver token no localStorage, renderiza diretamente `<LandingPage />` sem passar por hooks autenticados.
- **Lazy Loading de `PageShell` e `LoadingScreen`:**
  Substituir a importação estática `import { LoadingScreen, PageShell } from "@/components/layout"` por importação lazy/direta:
  ```tsx
  const PageShell = lazy(() => import("@/components/layout/page-shell").then(m => ({ default: m.PageShell })));
  ```
  Isso remove centenas de KiB do bundle inicial da landing page, poupando a thread principal e atacando diretamente a auditoria de **513 KiB de JavaScript não usado**.

#### [MODIFY] [vite.config.ts](file:///home/gabrielsales/meus_apps/financasnew/vite.config.ts)
- **Desmembrar `vendor-ui`:**
  Separar `cmdk` e `react-day-picker` de `vendor-ui` em chunks isolados ou permitir que sejam carregados apenas sob demanda quando seus respectivos modais/páginas forem abertos.
- **Habilitar `modulePreload` de Forma Inteligente:**
  Habilitar `modulePreload` para pré-carregar os chunks estritamente necessários sem criar gargalos sequenciais.

---

### Componente 3: Navegação Agêntica e Arquivos de IA

#### [NEW] [public/llms.txt](file:///home/gabrielsales/meus_apps/financasnew/public/llms.txt)
- Implementar o padrão canônico llmstxt.org contendo:
  - Título e subtítulo do produto Axir
  - Resumo de propósito (Online First, cartões, dívidas, rebalanceamento determinístico de carteira)
  - Links para páginas e ferramentas gratuitas abertas (`/ferramentas`, `/ferramentas/simulador-dividas`, `/ferramentas/rebalanceamento`, `/ferramentas/juros-compostos`)
  - Informações de conformidade (LGPD, sem venda de dados)
  - Link para `llms-full.txt`

#### [NEW] [public/llms-full.txt](file:///home/gabrielsales/meus_apps/financasnew/public/llms-full.txt)
- Documentação expandida detalhando como os cálculos funcionam (ex: Daily Budget, Motor de Aporte sem venda de ativos, metodologia de cálculo de juros).

#### [NEW] [public/ai-catalog.json](file:///home/gabrielsales/meus_apps/financasnew/public/ai-catalog.json) e [public/.well-known/ai-catalog.json](file:///home/gabrielsales/meus_apps/financasnew/public/.well-known/ai-catalog.json)
- Especificação formal válida de catálogo para agentes inteligentes (WebMCP), contendo ferramentas declaradas, endpoints públicos e metadados requeridos pelo Lighthouse 13.6.

#### [MODIFY] [public/_headers](file:///home/gabrielsales/meus_apps/financasnew/public/_headers)
- Adicionar Content-Type explícito para `/llms.txt` (`text/plain; charset=utf-8`) e `/ai-catalog.json` (`application/json; charset=utf-8`).
- Adicionar `Cross-Origin-Opener-Policy: same-origin-allow-popups` (resolve a recomendação de COOP do Lighthouse).
- Adicionar `Cross-Origin-Resource-Policy: same-origin`.

---

### Componente 4: Acessibilidade e SEO na Landing Page

#### [MODIFY] [src/features/landing/components/landing-header.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/landing-header.tsx)
- Garantir que botões mobile (Menu hambúrguer, ThemeToggle) e links de navegação possuam área de toque de no mínimo 48x48px (`min-h-12 min-w-12` ou padding estendido).
- Adicionar `aria-label` descritivos em botões de ação que repetem o texto "Começar", "Acessar" ou "Planos".

#### [MODIFY] [src/features/landing/components/hero-editorial.tsx](file:///home/gabrielsales/meus_apps/financasnew/src/features/landing/components/hero-editorial.tsx)
- Ajustar as pílulas de destaque ("Racha com Pix", "Modo Família") para terem área de toque ergonômica mínima no mobile.
- Ajustar contraste de texto suave em telas claras para atingir proporção mínima de 4.5:1.

#### [MODIFY] [public/sitemap.xml](file:///home/gabrielsales/meus_apps/financasnew/public/sitemap.xml)
- Adicionar `<lastmod>` atualizado para todas as URLs públicas e de ferramentas.

---

## 4. Plano de Verificação

### Testes Automatizados
- Executar `npm run typecheck` para garantir conformidade estrita de tipagem.
- Executar `npm run lint` para garantir zero violações de regras ESLint (incluindo `local/no-decorative-unicode`).
- Executar `npm run test` (Vitest) para garantir que nenhum teste de domínio ou UI seja quebrado.
- Executar `npx vite build` e auditar os tamanhos dos chunks gerados, verificando que o bundle inicial da landing page reduziu significativamente seu tamanho.

### Verificação Manual e Comparativa
- Iniciar `npm run preview` e verificar que a Splash Screen desaparece sem sobressaltos e com imagens WebP nítidas.
- Testar a navegação da Landing Page no mobile e desktop, confirmando que todos os botões e links funcionam suavemente.
- Inspecionar a rede no Chrome DevTools com limitação "Slow 4G" para validar a eliminação do bloqueio de renderização e queda brutal do TBT.
