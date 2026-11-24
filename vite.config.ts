import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(
  fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || "3.14.0"),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // manifest próprio em public/pwa/manifest.webmanifest (PWA_GUIDELINES)
      workbox: {
        cleanupOutdatedCaches: true,
        importScripts: ["/sw-push.js"],
        // Precache estrito do App Shell essencial: reduz drasticamente o tempo de instalação
        // do novo Service Worker em cada deploy (de ~200 arquivos para ~8 arquivos críticos).
        // Chunks de rotas lazy (com hash imutável) e imagens são cacheados sob demanda via runtimeCaching.
        globPatterns: [
          "index.html",
          "offline.html",
          "pwa/offline.html",
          "assets/index-*.{js,css}",
          "assets/vendor-react-*.js",
          "assets/vendor-ui-*.js",
          "assets/vendor-backend-*.js",
        ],
        // logo-full.png (lockup da marca, ~5 MB) e chunks pesados sob demanda ficam fora do precache.
        globIgnores: [
          "**/brand/logo-full.png",
          "**/pdfjs-*",
          "**/vendor-sentry-*",
          "**/admin-*",
          "**/sw-push.js",
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // SPA: rotas client-side sempre carregam o App Shell do cache (instante);
        // o estado offline é tratado na própria UI (erros explícitos + retry).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Ícones PWA e assets de marca oficiais: isolados com revalidação de rede imediata (NetworkFirst)
          {
            urlPattern: /\/(?:pwa\/icons|brand)\/.*\.(?:png|webp|svg|ico)$/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "pwa-brand-assets",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-images",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Chunks pesados sob demanda (PDF/OCR/Sentry/Admin): cacheados apenas em tempo de execução
          {
            urlPattern: /\/assets\/(?:pdfjs|vendor-sentry|admin-).*\.js$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "on-demand-chunks",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Chunks de rotas lazy com hash imutável gerados pelo Vite: cacheados sob demanda (CacheFirst)
          {
            urlPattern: /\/assets\/.*\.(?:js|css)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "app-chunks",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // O preload automático do Vite/Rolldown injetava no index.html TODAS as
    // dependências de rotas lazy (layout, state, skeleton, picker, cmdk...),
    // baixando ~1 MB antes da landing pintar. Os imports dinâmicos já carregam
    // seus chunks sob demanda; manter o preload global anulava o code splitting.
    modulePreload: false,
    chunkSizeWarningLimit: 1700,
    // Vite 8 (Oxc/Rolldown): drop de console/debugger no minifier — esbuild.drop é ignorado.
    rolldownOptions: {
      output: {
        minify: {
          compress: { dropConsole: true, dropDebugger: true },
        },
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("/node_modules/")) {
            return;
          }

          // Sentry isolado em chunk próprio para não inflar vendor-react
          if (normalizedId.includes("/node_modules/@sentry/")) {
            return "vendor-sentry";
          }

          // Core do React, React DOM, Scheduler e Roteador oficial
          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/react-router/") ||
            normalizedId.includes("/node_modules/@remix-run/router/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }

          // Busca global / paleta de comandos isolada sob demanda
          if (normalizedId.includes("/node_modules/cmdk/")) {
            return "vendor-cmdk";
          }

          // Seletor de data e calendário isolado sob demanda
          if (normalizedId.includes("/node_modules/react-day-picker/")) {
            return "vendor-picker";
          }

          // Componentes de UI básicos, primitivos Radix, ícones e utilitários de classes
          if (
            normalizedId.includes("/node_modules/@radix-ui/") ||
            normalizedId.includes("/node_modules/lucide-react/") ||
            normalizedId.includes("/node_modules/class-variance-authority/") ||
            normalizedId.includes("/node_modules/clsx/") ||
            normalizedId.includes("/node_modules/tailwind-merge/")
          ) {
            return "vendor-ui";
          }

          // Backend, cliente Supabase e TanStack Query
          if (
            normalizedId.includes("/node_modules/@supabase/") ||
            normalizedId.includes("/node_modules/@tanstack/react-query/") ||
            normalizedId.includes("/node_modules/@tanstack/query-core/")
          ) {
            return "vendor-backend";
          }

          // Capacitor e plugins de hardware/dispositivo nativo
          if (
            normalizedId.includes("/node_modules/@capacitor/") ||
            normalizedId.includes("/node_modules/@capacitor-community/") ||
            normalizedId.includes("/node_modules/@aparajita/capacitor-biometric-auth/")
          ) {
            return "vendor-native";
          }

          // Manipulação de datas e calendários
          if (normalizedId.includes("/node_modules/date-fns/")) {
            return "vendor-date";
          }

          // Validação de esquemas e contratos de borda
          if (normalizedId.includes("/node_modules/zod/")) {
            return "vendor-zod";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 10000,
    css: true,
  },
});
