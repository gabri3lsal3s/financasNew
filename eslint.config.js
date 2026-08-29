import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Regra local: bloqueia emojis e caracteres Unicode decorativos (✓ ▲ ● 🎉 …)
 * em strings de código (UI e domínio). Regra do DESIGN_SYSTEM §11: toda
 * representação gráfica usa ícones lucide-react padronizados — nunca emoji.
 */
const noDecorativeUnicode = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Bloqueia emojis e caracteres Unicode decorativos em strings de código (DESIGN_SYSTEM §11).",
    },
    messages: {
      decorative:
        "Emoji ou caractere Unicode decorativo em string — use ícones lucide-react padronizados (DESIGN_SYSTEM §11, AGENTS.md §4.8).",
    },
    schema: [],
  },
  create(context) {
    // Faixas decorativas BMP (sem flag u): setas (←…), símbolos técnicos
    // (⌚…), formas geométricas (■▲●), dingbats (✓✗), símbolos diversos.
    // Emojis (BMP e astrais, incluindo sequências ZWJ/VS16) via propriedade
    // Unicode — sem colocar ZWJ/variation selector na classe (evita a regra
    // core `no-misleading-character-class`).
    const decorativeBmp = /[\u2190-\u21ff\u2300-\u23ff\u25a0-\u27bf\u2b00-\u2bff]/;
    const hasEmoji = /\p{Extended_Pictographic}/u;

    const check = (node, value) => {
      if (typeof value === "string" && (decorativeBmp.test(value) || hasEmoji.test(value))) {
        context.report({ node, messageId: "decorative" });
      }
    };

    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) check(quasi, quasi.value.raw);
      },
    };
  },
};

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "public/pwa/icons", "**/.venv/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      local: { rules: { "no-decorative-unicode": noDecorativeUnicode } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // Strings de UI/domínio em produção (exclui testes e config): emojis e
    // caracteres Unicode decorativos são bloqueados (DESIGN_SYSTEM §11).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/__tests__/**", "src/tmp/**"],
    rules: {
      "local/no-decorative-unicode": "error",
    },
  },
  {
    files: ["*.config.{js,ts}", "scripts/**/*.{js,mjs}", ".github/**"],
    languageOptions: { globals: globals.node },
  },
  eslintConfigPrettier,
);
