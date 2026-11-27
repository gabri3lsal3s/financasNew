import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

const pkg = JSON.parse(
  fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);

/** Use o grafo real do shell para que uma atualização funcione ainda que
 * o navegador não tenha visitado a landing com os novos hashes. */
function precachePublicShell(patterns: string[]): Plugin {
  return {
    name: "axir-precache-public-shell",
    apply: "build",
    generateBundle(_, bundle) {
      const files = new Set<string>();
      const visit = (fileName: string) => {
        const chunk = bundle[fileName];
        if (chunk?.type !== "chunk" || files.has(fileName)) return;
        files.add(fileName);
        chunk.imports.forEach(visit);
      };

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        const isLanding = chunk.facadeModuleId?.replaceAll("\\", "/")
          .endsWith("/features/landing/pages/landing-page.tsx");
        if (chunk.isEntry || isLanding) visit(chunk.fileName);
      }
      patterns.push(...files);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = (env.VITE_SUPABASE_URL || "").trim();
  const precachePatterns = ["index.html", "offline.html", "pwa/offline.html", "assets/index-*.css"];

  return {
  server: supabaseUrl
    ? {
        proxy: {
          "/__supabase_functions": {
            target: supabaseUrl,
            changeOrigin: true,
            rewrite: (reqPath) =>
              reqPath.replace(/^\/__supabase_functions/, "/functions/v1"),
          },
        },
      }
    : undefined,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || "3.14.0"),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    precachePublicShell(precachePatterns),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false, // manifest próprio em public/pwa/manifest.webmanifest (PWA_GUIDELINES)
      workbox: {
        cleanupOutdatedCaches: true,
        importScripts: ["/sw-push.js"],
        // Precache do HTML, contingência e dependências estáticas do shell público.
        // Chunks de conta e prévias lazy entram em cache quando usados.
        globPatterns: precachePatterns,
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
        navigateFallbackDenylist: [
          /^\/(?:api|assets|brand|pwa|releases|\.well-known)\//,
          /^\/(?:robots\.txt|sitemap\.xml|llms(?:-full)?\.txt|ai-catalog\.json)(?:\?|$)/,
        ],
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
    // O HTML comum pode antecipar apenas o React, usado por todas as rotas.
    // Antecipe dependências da landing somente quando o import for solicitado.
    modulePreload: {
      resolveDependencies: (fileName, deps, { hostType }) => {
        if (hostType === "html") return deps.filter((name) => /(^|\/)vendor-react-/.test(name));
        return /^assets\/landing-page-/.test(fileName) ? deps : [];
      },
    },
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

          // Deixe o Rolldown agrupar UI, backend, busca e plugins nativos pelo
          // grafo de uso. Agrupar Radix com Lucide puxava a paleta no boot público.
          // Consolida os pequenos chunks de ícones sem acoplar Radix ou cmdk.
          if (normalizedId.includes("/node_modules/lucide-react/")) {
            return "vendor-icons";
          }

          // Manipulação de datas e calendários
          if (
            normalizedId.includes("/node_modules/date-fns/") ||
            normalizedId.includes("/node_modules/react-day-picker/")
          ) {
            return "vendor-date";
          }

          // Encoder de QR Code isolado para não vazar no boot
          if (normalizedId.includes("/node_modules/uqr/")) {
            return "vendor-qr";
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
  };
});
