import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  cancelAsaasSubscription,
  updateAsaasSubscriptionCreditCard,
} from "../_shared/asaas.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método não permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Sessão não informada" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
      return safeErrorResponse(req, 500, "Serviço de assinatura indisponível.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(req, { error: "Sessão inválida ou expirada" }, 401);
    }

    const payload = await req.json();
    const { action, card } = payload;

    const { data: userSub } = await supabase
      .from("user_subscriptions")
      .select("id, user_id, asaas_subscription_id, status")
      .eq("user_id", user.id)
      .single();

    if (!userSub) {
      return jsonResponse(req, { error: "Assinatura não localizada" }, 404);
    }

    if (action === "cancel") {
      if (userSub.asaas_subscription_id) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
        } catch (err: unknown) {
          console.warn(
            "Aviso ao cancelar no Asaas:",
            err instanceof Error ? err.message : "erro desconhecido",
          );
        }
      }

      await supabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("user_id", user.id);

      return jsonResponse(req, { ok: true, message: "Assinatura cancelada com sucesso" });
    }

    if (action === "update-card") {
      if (!userSub.asaas_subscription_id) {
        return jsonResponse(
          req,
          { error: "Usuário não possui assinatura com cartão recorrente ativa" },
          400,
        );
      }

      if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
        return jsonResponse(req, { error: "Dados do cartão incompletos" }, 400);
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

      return jsonResponse(req, { ok: true, message: "Cartão atualizado com sucesso" });
    }

    return jsonResponse(req, { error: "Ação não suportada" }, 400);
  } catch (err: unknown) {
    return safeErrorResponse(req, 500, "Falha ao gerenciar assinatura. Tente novamente.", err);
  }
});
