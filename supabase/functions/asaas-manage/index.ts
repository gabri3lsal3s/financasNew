import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  cancelAsaasSubscription,
  listAsaasCustomerPayments,
  refundAsaasPayment,
  updateAsaasSubscriptionCreditCard,
  updateAsaasSubscriptionCycle,
  isValidLuhn,
  isValidCardExpiry,
  sanitizePaymentLog,
} from "../_shared/asaas.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";
import { renderSubscriptionCanceledEmail } from "../_shared/email-templates.ts";

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
    const { action, card, targetPlan } = payload;

    const { data: userSub } = await supabase
      .from("user_subscriptions")
      .select("id, user_id, asaas_subscription_id, asaas_payment_id, asaas_customer_id, starts_at, billing_start_at, created_at, status, tier, current_period_end, trial_ends_at, trial_consumed_at, scheduled_plan_id, scheduled_first_charge_at, pending_plan_id")
      .eq("user_id", user.id)
      .single();

    if (!userSub) {
      return jsonResponse(req, { error: "Assinatura não localizada" }, 404);
    }

    // -------------------------------------------------------------------------
    // AÇÃO 1: AGENDAR TROCA DE PLANO (MENSAL <-> ANUAL NA PRÓXIMA RENOVAÇÃO)
    // -------------------------------------------------------------------------
    if (action === "schedule-plan-change") {
      if (!targetPlan || !["monthly", "annual"].includes(targetPlan)) {
        return jsonResponse(req, { error: "Plano de destino inválido." }, 400);
      }

      const targetPlanId = targetPlan === "annual" ? "pro_annual" : "pro_monthly";
      if (userSub.tier === targetPlanId) {
        return jsonResponse(req, { error: "Você já está no plano solicitado." }, 400);
      }

      if (!userSub.current_period_end) {
        return jsonResponse(req, { error: "Não foi possível identificar a data de renovação atual." }, 400);
      }

      if (userSub.asaas_subscription_id) {
        try {
          await updateAsaasSubscriptionCycle(userSub.asaas_subscription_id, {
            value: targetPlan === "annual" ? 143.88 : 19.99,
            cycle: targetPlan === "annual" ? "YEARLY" : "MONTHLY",
          });
        } catch (err: unknown) {
          console.warn("[asaas-manage] Aviso ao atualizar ciclo de cobrança no Asaas:", err);
        }
      }

      await supabase
        .from("user_subscriptions")
        .update({
          pending_plan_id: targetPlanId,
          pending_plan_effective_at: userSub.current_period_end,
        })
        .eq("user_id", user.id);

      await supabase.from("audit_events").insert({
        user_id: user.id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "plan_change_scheduled",
        payload: {
          from_plan: userSub.tier,
          to_plan: targetPlanId,
          effective_at: userSub.current_period_end,
        },
      });

      const formattedDate = new Date(userSub.current_period_end).toLocaleDateString("pt-BR");
      return jsonResponse(req, {
        ok: true,
        message: `Sua mudança para o ${targetPlan === "annual" ? "Plano Pro Anual" : "Plano Pro Mensal"} foi agendada para ${formattedDate}. Até lá, seu plano atual continuará ativo.`,
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 2: CANCELAR TROCA DE PLANO AGENDADA
    // -------------------------------------------------------------------------
    if (action === "cancel-scheduled-plan-change") {
      if (!userSub.pending_plan_id) {
        return jsonResponse(req, { error: "Não há nenhuma troca de plano agendada." }, 400);
      }

      if (userSub.asaas_subscription_id) {
        try {
          const currentIsAnnual = userSub.tier === "pro_annual";
          await updateAsaasSubscriptionCycle(userSub.asaas_subscription_id, {
            value: currentIsAnnual ? 143.88 : 19.99,
            cycle: currentIsAnnual ? "YEARLY" : "MONTHLY",
          });
        } catch (err: unknown) {
          console.warn("[asaas-manage] Aviso ao reverter ciclo de cobrança no Asaas:", err);
        }
      }

      await supabase
        .from("user_subscriptions")
        .update({
          pending_plan_id: null,
          pending_plan_effective_at: null,
        })
        .eq("user_id", user.id);

      await supabase.from("audit_events").insert({
        user_id: user.id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "plan_change_canceled",
        payload: { canceled_target_plan: userSub.pending_plan_id },
      });

      return jsonResponse(req, {
        ok: true,
        message: "A troca de plano agendada foi cancelada com sucesso. Seu plano atual permanecerá inalterado.",
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 3: CANCELAMENTO DE ASSINATURA (COM REGRA CDC DE 7 DIAS E RESPEITO AO TRIAL)
    // -------------------------------------------------------------------------
    if (action === "cancel") {
      // 1. Caso TRIAL AGENDADO (F-09): Usuário em teste gratuito cadastrou cartão para renovação futura,
      // mas ainda não ocorreu cobrança efetiva
      const hasNeverBeenCharged = !userSub.billing_start_at && (userSub.tier === "trial" || Boolean(userSub.scheduled_first_charge_at));

      if (hasNeverBeenCharged) {
        if (userSub.asaas_subscription_id) {
          try {
            await cancelAsaasSubscription(userSub.asaas_subscription_id);
          } catch (err: unknown) {
            console.warn("[asaas-manage] Aviso ao cancelar agendamento futuro no Asaas:", err);
          }
        }

        await supabase
          .from("user_subscriptions")
          .update({
            asaas_subscription_id: null,
            card_last4: null,
            scheduled_plan_id: null,
            scheduled_first_charge_at: null,
            cancel_at_period_end: false,
            tier: "trial",
            status: "active",
          })
          .eq("user_id", user.id);

        await supabase.from("audit_events").insert({
          user_id: user.id,
          entity_type: "user_subscription",
          entity_id: userSub.id,
          action: "trial_schedule_cancelled",
          payload: { gateway: "asaas" },
        });

        const trialEndsFormatted = userSub.trial_ends_at
          ? new Date(userSub.trial_ends_at).toLocaleDateString("pt-BR")
          : "o encerramento do seu teste";

        return jsonResponse(req, {
          ok: true,
          refunded: false,
          is_trial_scheduled: true,
          message: `O agendamento de renovação foi cancelado. Seu cartão não será cobrado e você continua aproveitando seu período de testes do Plano Pro até ${trialEndsFormatted}.`,
        });
      }

      // 2. Usuário que já foi cobrado: calcula o prazo de 7 dias do CDC estritamente a partir de billing_start_at
      const billingStartTime = userSub.billing_start_at
        ? new Date(userSub.billing_start_at).getTime()
        : userSub.starts_at
          ? new Date(userSub.starts_at).getTime()
          : 0;
      const isWithin7Days = billingStartTime > 0 && Date.now() - billingStartTime <= SEVEN_DAYS_MS;

      if (isWithin7Days) {
        let refundRequested = false;
        let paymentToRefundId = userSub.asaas_payment_id;

        // Se o paymentId não estiver no banco, busca os pagamentos confirmados recentes do cliente no Asaas
        if (!paymentToRefundId && userSub.asaas_customer_id) {
          try {
            const customerPayments = await listAsaasCustomerPayments(userSub.asaas_customer_id, 5);
            const confirmedPayment = customerPayments.find(
              (p) => p.status === "CONFIRMED" || p.status === "RECEIVED"
            );
            if (confirmedPayment) {
              paymentToRefundId = confirmedPayment.id;
              await supabase
                .from("user_subscriptions")
                .update({ asaas_payment_id: confirmedPayment.id })
                .eq("user_id", user.id);
            }
          } catch (err: unknown) {
            console.warn("[asaas-manage] Falha ao consultar pagamentos recentes do cliente para estorno:", err);
          }
        }

        if (paymentToRefundId) {
          try {
            await refundAsaasPayment(
              paymentToRefundId,
              "Cancelamento e estorno nos primeiros 7 dias (CDC)",
            );
            refundRequested = true;
          } catch (err: unknown) {
            console.warn("[asaas-manage] Aviso ao estornar cobrança no Asaas:", err);
          }
        }

        if (userSub.asaas_subscription_id) {
          try {
            await cancelAsaasSubscription(userSub.asaas_subscription_id);
          } catch (err: unknown) {
            console.warn("[asaas-manage] Aviso ao cancelar assinatura no Asaas:", err);
          }
        }

        await supabase
          .from("user_subscriptions")
          .update({
            tier: "read_only",
            status: "canceled",
            cancel_at_period_end: false,
            trial_consumed_at: userSub.trial_consumed_at || new Date().toISOString(),
            scheduled_plan_id: null,
            scheduled_first_charge_at: null,
            current_period_end: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        await supabase.from("audit_events").insert({
          user_id: user.id,
          entity_type: "user_subscription",
          entity_id: userSub.id,
          action: "cancelled_cdc_refund",
          payload: { gateway: "asaas", refunded: refundRequested },
        });

        // Disparo de e-mail transacional via Resend: Cancelamento CDC 7 dias
        try {
          const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br";
          const emailData = renderSubscriptionCanceledEmail({
            name: user.email?.split("@")[0] || "Cliente",
            isCdcRefund: true,
            reactivateUrl: `${appUrl}/assinatura`,
          });
          await sendTransactionalEmail(supabase, {
            to: user.email || "",
            subject: emailData.subject,
            template: "subscription_canceled_cdc",
            html: emailData.html,
            text: emailData.text,
            userId: user.id,
            idempotencyKey: `cancel_cdc_${userSub.id}_${new Date().toISOString().slice(0, 10)}`,
          });
        } catch (emailErr) {
          console.warn("[asaas-manage] Aviso ao enviar e-mail de cancelamento CDC:", emailErr);
        }

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
          console.warn("[asaas-manage] Aviso ao cancelar renovação no Asaas:", err);
        }
      }

      await supabase
        .from("user_subscriptions")
        .update({
          cancel_at_period_end: true,
          trial_consumed_at: userSub.trial_consumed_at || new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await supabase.from("audit_events").insert({
        user_id: user.id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "cancelled_at_period_end",
        payload: { gateway: "asaas", subscription_id: userSub.asaas_subscription_id },
      });

      // Disparo de e-mail transacional via Resend: Cancelamento com vigência até period_end
      try {
        const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br";
        const formattedEnd = userSub.current_period_end
          ? new Date(userSub.current_period_end).toLocaleDateString("pt-BR")
          : "o encerramento do ciclo";
        const emailData = renderSubscriptionCanceledEmail({
          name: user.email?.split("@")[0] || "Cliente",
          isCdcRefund: false,
          effectiveUntilFormatted: formattedEnd,
          reactivateUrl: `${appUrl}/assinatura`,
        });
        await sendTransactionalEmail(supabase, {
          to: user.email || "",
          subject: emailData.subject,
          template: "subscription_canceled_period_end",
          html: emailData.html,
          text: emailData.text,
          userId: user.id,
          idempotencyKey: `cancel_period_end_${userSub.id}_${new Date().toISOString().slice(0, 10)}`,
        });
      } catch (emailErr) {
        console.warn("[asaas-manage] Aviso ao enviar e-mail de cancelamento ao fim do período:", emailErr);
      }

      return jsonResponse(req, {
        ok: true,
        refunded: false,
        message: "Assinatura cancelada com sucesso. Seu acesso Pro continuará ativo até o final do período vigente.",
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 4: ATUALIZAR CARTÃO
    // -------------------------------------------------------------------------
    if (action === "update-card") {
      if (!userSub.asaas_subscription_id) {
        return jsonResponse(req, { error: "Usuário não possui assinatura com cartão recorrente ativa." }, 400);
      }

      if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
        return jsonResponse(req, { error: "Dados do cartão incompletos." }, 400);
      }

      if (!isValidLuhn(card.number)) {
        return jsonResponse(req, { error: "Número do cartão de crédito inválido." }, 400);
      }

      if (!isValidCardExpiry(card.expiryMonth, card.expiryYear)) {
        return jsonResponse(req, { error: "Cartão de crédito com data de validade vencida ou incorreta." }, 400);
      }

      const cleanCcv = (card.ccv || "").replace(/\D/g, "");
      if (cleanCcv.length < 3 || cleanCcv.length > 4) {
        return jsonResponse(req, { error: "Código de segurança (CVV) inválido." }, 400);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, cpf, phone, postal_code, address_number")
        .eq("id", user.id)
        .single();

      const customerName = card.holderName || profile?.name || user.email?.split("@")[0] || "Cliente";
      const customerEmail = profile?.email || user.email || "";
      const customerCpf = (profile?.cpf || "").replace(/\D/g, "");
      const customerPostalCode = (card.postalCode || profile?.postal_code || "").replace(/\D/g, "");
      const customerAddressNumber = (card.addressNumber || profile?.address_number || "S/N").trim();
      const customerPhone = (card.phone || profile?.phone || "").replace(/\D/g, "");
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
          postalCode: customerPostalCode,
          addressNumber: customerAddressNumber,
          phone: customerPhone,
        },
        remoteIp: clientIp,
      });

      const rawCardNum = String(card.number).replace(/\D/g, "");
      const cardLast4 = rawCardNum.length >= 4 ? rawCardNum.slice(-4) : "••••";

      await supabase
        .from("user_subscriptions")
        .update({ card_last4: cardLast4 })
        .eq("user_id", user.id);

      // Sincroniza campos de contato e endereço no perfil se fornecidos no cartão
      if (card.phone || card.postalCode || card.addressNumber) {
        await supabase
          .from("profiles")
          .update({
            phone: customerPhone || profile?.phone,
            postal_code: customerPostalCode || profile?.postal_code,
            address_number: customerAddressNumber || profile?.address_number,
          })
          .eq("id", user.id);
      }

      await supabase.from("audit_events").insert({
        user_id: user.id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "card_updated",
        payload: {
          gateway: "asaas",
          subscription_id: userSub.asaas_subscription_id,
          card_last4: cardLast4,
        },
      });

      return jsonResponse(req, { ok: true, message: "Cartão atualizado com sucesso." });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 5: LISTAR FATURAS
    // -------------------------------------------------------------------------
    if (action === "list-invoices") {
      if (!userSub.asaas_customer_id) {
        return jsonResponse(req, { invoices: [] });
      }

      try {
        const invoices = await listAsaasCustomerPayments(userSub.asaas_customer_id, 20);
        return jsonResponse(req, { invoices });
      } catch (err: unknown) {
        console.warn("[asaas-manage] Falha ao listar faturas no Asaas:", err);
        return jsonResponse(req, { invoices: [] });
      }
    }

    return jsonResponse(req, { error: "Ação não suportada" }, 400);
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error("[asaas-manage] Falha ao gerenciar assinatura:", sanitizePaymentLog(rawMsg));
    return safeErrorResponse(req, 500, "Falha ao gerenciar assinatura. Tente novamente.", err);
  }
});
