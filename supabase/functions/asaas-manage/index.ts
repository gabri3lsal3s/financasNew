import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  cancelAsaasSubscription,
  updateAsaasSubscriptionCreditCard,
} from "../_shared/asaas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Sessão não informada" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Valida token JWT do usuário
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Sessão inválida ou expirada" }, 401);
    }

    const payload = await req.json();
    const { action, card } = payload;

    // Busca assinatura atual do usuário
    const { data: userSub } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!userSub) {
      return json({ error: "Assinatura não localizada" }, 404);
    }

    // 1. Cancelamento de assinatura
    if (action === "cancel") {
      if (userSub.asaas_subscription_id) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
        } catch (err: unknown) {
          console.warn("Aviso ao cancelar no Asaas:", err);
        }
      }

      await supabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("user_id", user.id);

      return json({ ok: true, message: "Assinatura cancelada com sucesso" });
    }

    // 2. Atualização de cartão de crédito
    if (action === "update-card") {
      if (!userSub.asaas_subscription_id) {
        return json({ error: "Usuário não possui assinatura com cartão recorrente ativa" }, 400);
      }

      if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
        return json({ error: "Dados do cartão incompletos" }, 400);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, cpf")
        .eq("id", user.id)
        .single();

      const customerName = profile?.name || user.email?.split("@")[0] || "Cliente";
      const customerEmail = profile?.email || user.email || "";
      const customerCpf = profile?.cpf || "";

      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

      await updateAsaasSubscriptionCreditCard(userSub.asaas_subscription_id, {
        creditCard: {
          holderName: card.holderName,
          number: card.number,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          ccv: card.ccv,
        },
        holderInfo: {
          name: customerName,
          email: customerEmail,
          cpfCnpj: customerCpf,
          postalCode: card.postalCode,
          addressNumber: card.addressNumber,
          phone: card.phone,
        },
        remoteIp: clientIp,
      });

      return json({ ok: true, message: "Cartão atualizado com sucesso" });
    }

    return json({ error: "Ação não suportada" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return json({ error: message }, 500);
  }
});
