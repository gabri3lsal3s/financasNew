import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // manifest próprio em public/pwa/manifest.webmanifest (PWA_GUIDELINES)
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // logo-full.png (lockup da marca, ~5 MB) é asset estático fora do runtime:
        // fica fora do precache para não estourar o limite do Workbox (2 MiB).
        globIgnores: ["**/brand/logo-full.png"],
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
        ],
      },
    }),
  ],
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 500,
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

          // Componentes de UI, primitivos Radix, ícones e utilitários de classes
          if (
            normalizedId.includes("/node_modules/@radix-ui/") ||
            normalizedId.includes("/node_modules/lucide-react/") ||
            normalizedId.includes("/node_modules/cmdk/") ||
            normalizedId.includes("/node_modules/react-day-picker/") ||
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
