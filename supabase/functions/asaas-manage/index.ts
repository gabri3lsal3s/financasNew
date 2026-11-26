import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  cancelAsaasSubscription,
  formatBrtDisplayDate,
  isAsaasAlreadyCanceledError,
  isValidCardExpiry,
  isValidLuhn,
  listAsaasCustomerPayments,
  mapAsaasCardErrorMessage,
  refundAsaasPayment,
  sanitizePaymentLog,
  updateAsaasSubscriptionCreditCard,
  updateAsaasSubscriptionCycle,
} from "../_shared/asaas.ts";
import { ASAAS_PLAN_CATALOG } from "../_shared/asaas-plans.ts";
import {
  buildCorsHeaders,
  extractClientIp,
  isProductionEnvironment,
  jsonResponse,
  safeErrorResponse,
} from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";
import {
  renderProPlanChangeScheduledEmail,
  renderSubscriptionCanceledEmail,
} from "../_shared/email-templates.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function enforceUpdateCardRateLimit(
  req: Request,
  supabase: SupabaseClient,
  userId: string,
  clientIp: string,
): Promise<Response | null> {
  const checks = [
    { action: "update_card_15m", max: 5, window: 900 },
    { action: "update_card_24h", max: 10, window: 86400 },
  ];

  for (const check of checks) {
    const { data, error } = await supabase.rpc("check_billing_rate_limit", {
      p_user_id: userId,
      p_ip: clientIp || null,
      p_action: check.action,
      p_max_attempts: check.max,
      p_window_seconds: check.window,
    });

    if (error) {
      console.error("[asaas-manage] Erro ao validar check_billing_rate_limit:", error);
      return jsonResponse(
        req,
        { error: "Serviço de proteção contra abuso indisponível. Tente novamente em instantes." },
        503,
      );
    }

    if (!data?.allowed) {
      return jsonResponse(
        req,
        {
          error:
            "Muitas tentativas de atualização de cartão em um curto intervalo. Aguarde alguns minutos.",
        },
        429,
        { "Retry-After": String(data?.retry_after_seconds ?? 60) },
      );
    }
  }

  return null;
}

function isAlreadyRefundedError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("já estornad") ||
    msg.includes("ja estornad") ||
    msg.includes("already refunded") ||
    msg.includes("já foi estornad")
  );
}

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

    if (!user.email_confirmed_at) {
      return jsonResponse(
        req,
        { error: "Por favor, confirme seu endereço de e-mail antes de gerenciar sua assinatura." },
        403,
      );
    }

    const payload = await req.json();
    const { action, card, targetPlan } = payload;

    const { data: userSub, error: subErr } = await supabase
      .from("user_subscriptions")
      .select(
        "id, user_id, asaas_subscription_id, asaas_payment_id, asaas_customer_id, starts_at, billing_start_at, created_at, status, tier, current_period_end, trial_ends_at, trial_consumed_at, scheduled_plan_id, scheduled_first_charge_at, pending_plan_id",
      )
      .eq("user_id", user.id)
      .single();

    if (subErr || !userSub) {
      return jsonResponse(req, { error: "Assinatura não localizada" }, 404);
    }

    const nowIso = new Date().toISOString();

    // -------------------------------------------------------------------------
    // AÇÃO 1: AGENDAR TROCA DE PLANO (MENSAL <-> ANUAL NA PRÓXIMA RENOVAÇÃO)
    // -------------------------------------------------------------------------
    if (action === "schedule-plan-change") {
      if (!targetPlan || !["monthly", "annual"].includes(targetPlan)) {
        return jsonResponse(req, { error: "Plano de destino inválido." }, 400);
      }

      if (!userSub.asaas_subscription_id) {
        return jsonResponse(
          req,
          { error: "Esta operação está disponível apenas para assinaturas recorrentes no cartão de crédito." },
          400,
        );
      }

      const targetMeta = targetPlan === "annual" ? ASAAS_PLAN_CATALOG.annual : ASAAS_PLAN_CATALOG.monthly;
      if (userSub.tier === targetMeta.planId) {
        return jsonResponse(req, { error: "Você já está no plano solicitado." }, 400);
      }

      if (!userSub.current_period_end) {
        return jsonResponse(req, { error: "Não foi possível identificar a data de renovação atual." }, 400);
      }

      try {
        await updateAsaasSubscriptionCycle(userSub.asaas_subscription_id, {
          value: targetMeta.value,
          cycle: targetMeta.cycle,
        });
      } catch (err: unknown) {
        console.error("[asaas-manage] Falha ao atualizar ciclo de cobrança no Asaas:", sanitizePaymentLog(err));
        return safeErrorResponse(
          req,
          502,
          "Não foi possível sincronizar a alteração de plano com o gateway. Tente novamente.",
        );
      }

      const { error: updateErr } = await supabase
        .from("user_subscriptions")
        .update({
          pending_plan_id: targetMeta.planId,
          pending_plan_effective_at: userSub.current_period_end,
          updated_at: nowIso,
        })
        .eq("user_id", user.id);

      if (updateErr) {
        console.error("[asaas-manage] Erro ao persistir troca de plano agendada:", updateErr);
        return safeErrorResponse(req, 500, "Falha ao salvar agendamento de troca de plano.");
      }

      await supabase.from("audit_events").insert({
        user_id: user.id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "plan_change_scheduled",
        payload: {
          from_plan: userSub.tier,
          to_plan: targetMeta.planId,
          effective_at: userSub.current_period_end,
        },
      });

      const formattedDate = formatBrtDisplayDate(userSub.current_period_end);

      try {
        const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br";
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", user.id)
          .maybeSingle();

        const recipientEmail = profile?.email || user.email || "";
        if (recipientEmail) {
          const formattedPrice = targetMeta.value.toFixed(2).replace(".", ",");
          const emailData = renderProPlanChangeScheduledEmail({
            name: profile?.name || user.email?.split("@")[0] || "Cliente",
            currentPlanName: userSub.tier === "pro_annual" ? "Plano Pro Anual" : "Plano Pro Mensal",
            targetPlanName: targetMeta.name,
            targetPlanValueFormatted: `R$ ${formattedPrice}/${targetPlan === "annual" ? "ano" : "mês"}`,
            effectiveDateFormatted: formattedDate,
            appUrl,
          });
          await sendTransactionalEmail(supabase, {
            to: recipientEmail,
            subject: emailData.subject,
            template: "pro_plan_change_scheduled",
            html: emailData.html,
            text: emailData.text,
            userId: user.id,
            idempotencyKey: `plan_change_${userSub.id}_${targetMeta.planId}_${nowIso.slice(0, 10)}`,
          });
        }
      } catch (emailErr) {
        console.warn("[asaas-manage] Aviso ao enviar e-mail de troca de ciclo agendada:", sanitizePaymentLog(emailErr));
      }

      return jsonResponse(req, {
        ok: true,
        message: `Sua mudança para o ${targetMeta.name} foi agendada para ${formattedDate}. Até lá, seu plano atual continuará ativo.`,
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 2: CANCELAR TROCA DE PLANO AGENDADA
    // -------------------------------------------------------------------------
    if (action === "cancel-scheduled-plan-change") {
      if (!userSub.pending_plan_id) {
        return jsonResponse(req, { error: "Não há nenhuma troca de plano agendada." }, 400);
      }

      if (!userSub.asaas_subscription_id) {
        return jsonResponse(
          req,
          { error: "Assinatura recorrente não localizada no gateway para reverter ciclo." },
          400,
        );
      }

      const currentMeta =
        userSub.tier === "pro_annual" ? ASAAS_PLAN_CATALOG.annual : ASAAS_PLAN_CATALOG.monthly;

      try {
        await updateAsaasSubscriptionCycle(userSub.asaas_subscription_id, {
          value: currentMeta.value,
          cycle: currentMeta.cycle,
        });
      } catch (err: unknown) {
        console.error("[asaas-manage] Falha ao reverter ciclo de cobrança no Asaas:", sanitizePaymentLog(err));
        return safeErrorResponse(
          req,
          502,
          "Não foi possível reverter o ciclo de cobrança no gateway. Tente novamente.",
        );
      }

      const { error: cancelChangeErr } = await supabase
        .from("user_subscriptions")
        .update({
          pending_plan_id: null,
          pending_plan_effective_at: null,
          updated_at: nowIso,
        })
        .eq("user_id", user.id);

      if (cancelChangeErr) {
        console.error("[asaas-manage] Erro ao limpar pending_plan_id:", cancelChangeErr);
        return safeErrorResponse(req, 500, "Falha ao cancelar agendamento de troca de plano.");
      }

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
    // AÇÃO 3: CANCELAMENTO DE ASSINATURA (FAIL-CLOSED + CDC 7 DIAS + TRIAL)
    // -------------------------------------------------------------------------
    if (action === "cancel") {
      // 1. Caso TRIAL AGENDADO (A-01 + D-01)
      const hasNeverBeenCharged =
        !userSub.billing_start_at &&
        (userSub.tier === "trial" || Boolean(userSub.scheduled_first_charge_at));

      if (hasNeverBeenCharged) {
        if (userSub.asaas_subscription_id) {
          try {
            await cancelAsaasSubscription(userSub.asaas_subscription_id);
          } catch (err: unknown) {
            if (!isAsaasAlreadyCanceledError(err)) {
              console.error(
                "[asaas-manage] Falha ao cancelar agendamento futuro no Asaas:",
                sanitizePaymentLog(err),
              );
              return safeErrorResponse(
                req,
                502,
                "Não foi possível cancelar o agendamento no gateway de pagamentos. Tente novamente.",
              );
            }
          }
        }

        const { error: trialUpdateErr } = await supabase
          .from("user_subscriptions")
          .update({
            asaas_subscription_id: null,
            card_last4: null,
            scheduled_plan_id: null,
            scheduled_first_charge_at: null,
            cancel_at_period_end: false,
            tier: "trial",
            plan_id: "trial",
            status: "trialing",
            updated_at: nowIso,
          })
          .eq("user_id", user.id);

        if (trialUpdateErr) {
          console.error("[asaas-manage] Erro ao reverter trial agendado para trialing:", trialUpdateErr);
          return safeErrorResponse(req, 500, "Falha ao atualizar status da assinatura.");
        }

        await supabase.from("audit_events").insert({
          user_id: user.id,
          entity_type: "user_subscription",
          entity_id: userSub.id,
          action: "trial_schedule_cancelled",
          payload: { gateway: "asaas" },
        });

        const trialEndsFormatted = userSub.trial_ends_at
          ? formatBrtDisplayDate(userSub.trial_ends_at)
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

        if (!paymentToRefundId && userSub.asaas_customer_id) {
          try {
            const customerPayments = await listAsaasCustomerPayments(userSub.asaas_customer_id, 5);
            const confirmedPayment = customerPayments.find(
              (p) => p.status === "CONFIRMED" || p.status === "RECEIVED",
            );
            if (confirmedPayment) {
              paymentToRefundId = confirmedPayment.id;
            }
          } catch (err: unknown) {
            console.warn(
              "[asaas-manage] Falha ao consultar pagamentos recentes do cliente para estorno:",
              sanitizePaymentLog(err),
            );
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
            if (isAlreadyRefundedError(err)) {
              refundRequested = true;
            } else {
              console.error("[asaas-manage] Falha ao estornar cobrança no Asaas (CDC):", sanitizePaymentLog(err));
              return safeErrorResponse(
                req,
                502,
                "Não foi possível solicitar o estorno junto ao gateway de pagamento. Sua assinatura não foi alterada; tente novamente.",
              );
            }
          }
        }

        if (userSub.asaas_subscription_id) {
          try {
            await cancelAsaasSubscription(userSub.asaas_subscription_id);
          } catch (err: unknown) {
            if (!isAsaasAlreadyCanceledError(err)) {
              console.error("[asaas-manage] Falha ao cancelar assinatura no Asaas (CDC):", sanitizePaymentLog(err));
              return safeErrorResponse(
                req,
                502,
                "Não foi possível cancelar a assinatura recorrente no gateway. Tente novamente.",
              );
            }
          }
        }

        const { error: cdcUpdateErr } = await supabase
          .from("user_subscriptions")
          .update({
            tier: "read_only",
            plan_id: "trial",
            status: "canceled",
            cancel_at_period_end: false,
            asaas_subscription_id: null,
            trial_consumed_at: userSub.trial_consumed_at || nowIso,
            scheduled_plan_id: null,
            scheduled_first_charge_at: null,
            current_period_end: nowIso,
            updated_at: nowIso,
            ...(paymentToRefundId ? { asaas_payment_id: paymentToRefundId } : {}),
          })
          .eq("user_id", user.id);

        if (cdcUpdateErr) {
          console.error("[asaas-manage] Erro ao persistir cancelamento CDC:", cdcUpdateErr);
          return safeErrorResponse(req, 500, "Falha ao atualizar assinatura após solicitação de estorno.");
        }

        await supabase.from("audit_events").insert({
          user_id: user.id,
          entity_type: "user_subscription",
          entity_id: userSub.id,
          action: "cancelled_cdc_refund",
          payload: { gateway: "asaas", refunded: refundRequested, payment_id: paymentToRefundId ?? null },
        });

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
            idempotencyKey: `cancel_cdc_${userSub.id}_${nowIso.slice(0, 10)}`,
          });
        } catch (emailErr) {
          console.warn("[asaas-manage] Aviso ao enviar e-mail de cancelamento CDC:", sanitizePaymentLog(emailErr));
        }

        return jsonResponse(req, {
          ok: true,
          refunded: refundRequested,
          message: refundRequested
            ? "Assinatura cancelada com sucesso. O estorno integral de 7 dias foi solicitado ao Asaas e seu acesso Pro foi encerrado."
            : "Assinatura cancelada com sucesso e acesso Pro encerrado dentro dos 7 dias.",
        });
      }

      // 3. Mais de 7 dias: sem reembolso, cancela renovação futura fail-closed e mantém Pro até o fim do período vigente
      if (userSub.asaas_subscription_id) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
        } catch (err: unknown) {
          if (!isAsaasAlreadyCanceledError(err)) {
            console.error("[asaas-manage] Falha ao cancelar renovação no Asaas:", sanitizePaymentLog(err));
            return safeErrorResponse(
              req,
              502,
              "Não foi possível cancelar a renovação automática no gateway. Tente novamente.",
            );
          }
        }
      }

      const { error: cancelEndErr } = await supabase
        .from("user_subscriptions")
        .update({
          cancel_at_period_end: true,
          trial_consumed_at: userSub.trial_consumed_at || nowIso,
          updated_at: nowIso,
        })
        .eq("user_id", user.id);

      if (cancelEndErr) {
        console.error("[asaas-manage] Erro ao gravar cancel_at_period_end:", cancelEndErr);
        return safeErrorResponse(req, 500, "Falha ao registrar cancelamento da assinatura.");
      }

      await supabase.from("audit_events").insert({
        user_id: user.id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "cancelled_at_period_end",
        payload: { gateway: "asaas", subscription_id: userSub.asaas_subscription_id },
      });

      try {
        const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br";
        const formattedEnd = userSub.current_period_end
          ? formatBrtDisplayDate(userSub.current_period_end)
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
          idempotencyKey: `cancel_period_end_${userSub.id}_${nowIso.slice(0, 10)}`,
        });
      } catch (emailErr) {
        console.warn("[asaas-manage] Aviso ao enviar e-mail de cancelamento ao fim do período:", sanitizePaymentLog(emailErr));
      }

      return jsonResponse(req, {
        ok: true,
        refunded: false,
        message: "Assinatura cancelada com sucesso. Seu acesso Pro continuará ativo até o final do período vigente.",
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 4: ATUALIZAR CARTÃO (RATE LIMIT + IP REAL + VALIDAÇÃO PRODUÇÃO)
    // -------------------------------------------------------------------------
    if (action === "update-card") {
      if (!userSub.asaas_subscription_id) {
        return jsonResponse(req, { error: "Usuário não possui assinatura com cartão recorrente ativa." }, 400);
      }

      const realClientIp = extractClientIp(req);
      const asaasRemoteIp = realClientIp || "127.0.0.1";

      const rateLimitRes = await enforceUpdateCardRateLimit(
        req,
        supabase,
        user.id,
        realClientIp,
      );
      if (rateLimitRes) return rateLimitRes;

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

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("name, email, cpf, phone, postal_code, address_number")
        .eq("id", user.id)
        .single();

      if (profileErr || !profile) {
        return safeErrorResponse(req, 500, "Perfil não localizado para atualização do cartão.");
      }

      const customerName = card.holderName || profile.name || user.email?.split("@")[0] || "Cliente";
      const customerEmail = profile.email || user.email || "";
      const customerCpf = (profile.cpf || "").replace(/\D/g, "");
      const customerPostalCode = (card.postalCode || profile.postal_code || "").replace(/\D/g, "");
      const customerAddressNumber = (card.addressNumber || profile.address_number || "").trim();
      const customerPhone = (card.phone || profile.phone || "").replace(/\D/g, "");

      if (isProductionEnvironment()) {
        if (customerPhone.length < 10 || customerPhone.length > 13) {
          return jsonResponse(
            req,
            { error: "Informe um telefone celular válido com DDD para validar o novo cartão." },
            400,
          );
        }
        if (customerPostalCode.length !== 8) {
          return jsonResponse(
            req,
            { error: "Informe um CEP válido com 8 dígitos do titular do cartão." },
            400,
          );
        }
        if (!customerAddressNumber) {
          return jsonResponse(
            req,
            { error: "Informe o número do endereço do titular do cartão." },
            400,
          );
        }
      }

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
          addressNumber: customerAddressNumber || "S/N",
          phone: customerPhone,
        },
        remoteIp: asaasRemoteIp,
      });

      const rawCardNum = String(card.number).replace(/\D/g, "");
      const cardLast4 = rawCardNum.length >= 4 ? rawCardNum.slice(-4) : "••••";

      const { error: cardUpdateErr } = await supabase
        .from("user_subscriptions")
        .update({ card_last4: cardLast4, updated_at: nowIso })
        .eq("user_id", user.id);

      if (cardUpdateErr) {
        console.error("[asaas-manage] Erro ao salvar últimos 4 dígitos do cartão:", cardUpdateErr);
        return safeErrorResponse(req, 500, "Cartão atualizado no gateway, mas falhou ao salvar no perfil.");
      }

      if (card.phone || card.postalCode || card.addressNumber) {
        const { error: profUpdateErr } = await supabase
          .from("profiles")
          .update({
            phone: customerPhone || profile.phone,
            postal_code: customerPostalCode || profile.postal_code,
            address_number: customerAddressNumber || profile.address_number,
          })
          .eq("id", user.id);
        if (profUpdateErr) {
          console.warn("[asaas-manage] Aviso ao sincronizar contato do titular em profiles:", profUpdateErr);
        }
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
        console.warn("[asaas-manage] Falha ao listar faturas no Asaas:", sanitizePaymentLog(err));
        return safeErrorResponse(
          req,
          502,
          "Não foi possível consultar faturas no gateway de pagamento. Tente novamente.",
        );
      }
    }

    return jsonResponse(req, { error: "Ação não suportada" }, 400);
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error("[asaas-manage] Falha ao gerenciar assinatura:", sanitizePaymentLog(rawMsg));

    const friendlyError = mapAsaasCardErrorMessage(rawMsg);
    if (friendlyError) {
      return jsonResponse(req, { error: friendlyError }, 400);
    }

    return safeErrorResponse(req, 500, "Falha ao gerenciar assinatura. Tente novamente.");
  }
});
