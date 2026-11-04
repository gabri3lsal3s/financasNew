/**
 * scripts/notify-telegram.ts
 *
 * Script de despacho operacional e programável para o Bot do Telegram.
 * Respeita estritamente as preferências salvas em public.admin_telegram_settings.
 *
 * Uso:
 *   npx tsx scripts/notify-telegram.ts --type git --msg "feat: commit message"
 *   npx tsx scripts/notify-telegram.ts --type deploy --msg "Deploy v2.84 concluído com sucesso"
 *   npx tsx scripts/notify-telegram.ts --type analytics --msg "Resumo semanal: 45 novas transações"
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Carrega variáveis locais de ambiente
function loadEnv(): void {
  const envPaths = [".env.local", ".env"];
  for (const p of envPaths) {
    const fullPath = path.resolve(process.cwd(), p);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

type NotificationCategory = "support" | "git" | "deploy" | "analytics" | "new_user";

interface CliArgs {
  type: NotificationCategory;
  message: string;
  force: boolean;
}

function parseArgs(): CliArgs {
  const raw = process.argv.slice(2);
  let type: NotificationCategory = "git";
  let message = "";
  let force = false;

  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "--type" && raw[i + 1]) {
      type = raw[i + 1] as NotificationCategory;
      i++;
    } else if (raw[i] === "--msg" && raw[i + 1]) {
      message = raw[i + 1];
      i++;
    } else if (raw[i] === "--force") {
      force = true;
    }
  }

  return { type, message, force };
}

async function isCategoryEnabled(category: NotificationCategory): Promise<boolean> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Se não houver credenciais de banco, permite por padrão
    return true;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data } = await supabase
      .from("admin_telegram_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    if (!data) return true;

    if (data.silent_mode) {
      console.log("[telegram] Notificação ignorada: Modo Silencioso está ativado no painel admin.");
      return false;
    }

    switch (category) {
      case "support":
        return Boolean(data.notify_support);
      case "git":
        return Boolean(data.notify_git);
      case "deploy":
        return Boolean(data.notify_deploys);
      case "analytics":
        return Boolean(data.notify_analytics);
      case "new_user":
        return Boolean(data.notify_new_users);
      default:
        return true;
    }
  } catch (err) {
    console.warn("[telegram] Aviso ao verificar configurações no banco:", err);
    return true;
  }
}

function getPrefix(category: NotificationCategory): string {
  switch (category) {
    case "support":
      return "<b>[SUPORTE]</b>";
    case "git":
      return "<b>[GIT / COMMIT]</b>";
    case "deploy":
      return "<b>[DEPLOY &amp; RELEASE]</b>";
    case "analytics":
      return "<b>[TELEMETRIA &amp; USO]</b>";
    case "new_user":
      return "<b>[NOVO CLIENTE]</b>";
    default:
      return "<b>[ÁXIS NOTIFICAÇÃO]</b>";
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não definidos no ambiente. Notificação ignorada.");
    process.exit(0);
  }

  if (!args.message) {
    console.error("Erro: Mensagem não fornecida. Use --msg 'sua mensagem'");
    process.exit(1);
  }

  if (!args.force) {
    const enabled = await isCategoryEnabled(args.type);
    if (!enabled) {
      console.log(`[telegram] Canal '${args.type}' está desativado no painel administrativo. Disparo cancelado.`);
      process.exit(0);
    }
  }

  const prefix = getPrefix(args.type);
  const formattedHtml = `${prefix}\n\n${args.message}\n\n<i>Áxis Finance DevBot • ${new Date().toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</i>`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formattedHtml,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (response.ok) {
    console.log(`[telegram] Mensagem enviada com sucesso para o canal [${args.type}]!`);
  } else {
    const errText = await response.text();
    console.error(`[telegram] Falha ao enviar para o Telegram (HTTP ${response.status}):`, errText);
  }
}

main().catch((err) => {
  console.error("[telegram] Erro de execução:", err);
  process.exit(0); // Fail-open para não quebrar pipelines
});
