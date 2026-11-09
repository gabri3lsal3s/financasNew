import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  cancelAsaasSubscription,
  refundAsaasPayment,
  updateAsaasSubscriptionCreditCard,
} from "../_shared/asaas.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
      .select("id, user_id, asaas_subscription_id, asaas_payment_id, starts_at, created_at, status, tier")
      .eq("user_id", user.id)
      .single();

    if (!userSub) {
      return jsonResponse(req, { error: "Assinatura não localizada" }, 404);
    }

    if (action === "cancel") {
      const referenceDateStr = userSub.starts_at || userSub.created_at;
      const startTime = referenceDateStr ? new Date(referenceDateStr).getTime() : 0;
      const isWithin7Days = startTime > 0 && Date.now() - startTime <= SEVEN_DAYS_MS;

      if (isWithin7Days) {
        // Regra dos 7 dias (CDC Art. 49): Reembolso integral + perda imediata do Pro
        let refundRequested = false;

        if (userSub.asaas_payment_id) {
          try {
            await refundAsaasPayment(
              userSub.asaas_payment_id,
              "Cancelamento e estorno nos primeiros 7 dias (CDC)",
            );
            refundRequested = true;
          } catch (err: unknown) {
            console.warn(
              "[asaas-manage] Aviso ao estornar cobrança no Asaas:",
              err instanceof Error ? err.message : err,
            );
          }
        }

        if (userSub.asaas_subscription_id) {
          try {
            await cancelAsaasSubscription(userSub.asaas_subscription_id);
          } catch (err: unknown) {
            console.warn(
              "[asaas-manage] Aviso ao cancelar assinatura no Asaas:",
              err instanceof Error ? err.message : err,
            );
          }
        }

        await supabase
          .from("user_subscriptions")
          .update({
            tier: "read_only",
            status: "canceled",
            cancel_at_period_end: false,
            current_period_end: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        return jsonResponse(req, {
          ok: true,
          refunded: true,
          message: refundRequested
            ? "Assinatura cancelada com sucesso. O estorno integral de 7 dias foi solicitado ao Asaas e seu acesso Pro foi encerrado."
            : "Assinatura cancelada com sucesso e acesso Pro encerrado dentro dos 7 dias.",
        });
      }

      // Mais de 7 dias: sem reembolso, cancela renovação futura e mantém Pro até o fim do período vigente
      if (userSub.asaas_subscription_id) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
        } catch (err: unknown) {
          console.warn(
            "[asaas-manage] Aviso ao cancelar renovação no Asaas:",
            err instanceof Error ? err.message : err,
          );
        }
      }

      await supabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("user_id", user.id);

      return jsonResponse(req, {
        ok: true,
        refunded: false,
        message:
          "Assinatura cancelada com sucesso. Seu acesso Pro continuará ativo até o final do período vigente.",
      });
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
