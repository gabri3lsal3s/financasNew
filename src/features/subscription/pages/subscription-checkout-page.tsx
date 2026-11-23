import { Navigate } from "react-router";
import { ArrowLeft, CheckCircle2, QrCode } from "lucide-react";
import { LoadingScreen } from "@/components/layout";
import { Alert, Badge, Button, FormField, Input, MoneyText } from "@/components/ui";
import { isValidCPF } from "@/domain/validation";
import { cn } from "@/lib/utils";
import { CheckoutEmailConfirmationView } from "../components/checkout-email-confirmation-view";
import { CheckoutHeader } from "../components/checkout-header";
import { CheckoutInlineAuthStep } from "../components/checkout-inline-auth-step";
import { CheckoutOrderSummary } from "../components/checkout-order-summary";
import { CheckoutPaymentMethodSelector } from "../components/checkout-payment-method-selector";
import { CheckoutPlanSummarySidebar } from "../components/checkout-plan-summary-sidebar";
import { CheckoutSubmitFooter } from "../components/checkout-submit-footer";
import { CreditCardCheckoutForm } from "../components/credit-card-checkout-form";
import { PixQrWaitingPanel } from "../components/pix-qr-waiting-panel";
import { useSubscriptionCheckout } from "../hooks/use-subscription-checkout";

export function SubscriptionCheckoutPage() {
  const c = useSubscriptionCheckout();

  if (c.authLoading) {
    return <LoadingScreen statusText="Iniciando ambiente seguro…" />;
  }

  if (c.session && c.subscription.isPro && !c.pixResult && c.subscription.plan === c.plan) {
    return <Navigate to="/configuracoes?tab=subscription" replace />;
  }

  const cpfStatusNode =
    c.cpf.length === 14 ? (
      <span
        className={cn(
          "text-[11px] font-semibold flex items-center gap-1",
          isValidCPF(c.cpf) ? "text-positive-strong" : "text-critical-strong",
        )}
      >
        {isValidCPF(c.cpf) ? (
          <>
            <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
            <span>CPF válido</span>
          </>
        ) : (
          <span>Dígitos inválidos</span>
        )}
      </span>
    ) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <CheckoutHeader
        rightAction={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={c.handleBack}
            aria-label="Voltar para a página anterior"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Voltar</span>
          </Button>
        }
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 xl:px-12 pt-6 sm:pt-8 pb-[calc(2.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] sm:py-12 animate-route-in">
        {c.confirmationSent ? (
          <CheckoutEmailConfirmationView
            planLabel={c.planConfig.title}
            planPriceCents={c.planConfig.priceCents}
            email={c.confirmedEmail || c.authEmail}
            isCreditCard={c.activeMethod === "credit_card"}
            cardLast4={c.confirmedCardLast4 || c.cardNumber.slice(-4)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 items-start">
            <CheckoutPlanSummarySidebar
              plan={c.plan}
              billingSchedule={c.billingSchedule}
              onSelectPlan={c.handleSelectPlan}
            />

            <section className="lg:col-span-7 rounded-2xl border border-border/80 bg-surface shadow-xs p-5 sm:p-8 lg:p-9 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-foreground">Forma de Pagamento</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ambiente seguro com criptografia e processamento direto via Asaas.
                </p>
              </div>

              <CheckoutInlineAuthStep
                sessionEmail={c.session?.user?.email ?? undefined}
                authMode={c.authMode}
                authName={c.authName}
                authEmail={c.authEmail}
                authPassword={c.authPassword}
                onToggleAuthMode={() => {
                  c.setAuthMode((prev) => (prev === "register" ? "login" : "register"));
                  c.setErrorMessage(null);
                }}
                onNameChange={c.setAuthName}
                onEmailChange={c.setAuthEmail}
                onPasswordChange={c.setAuthPassword}
              />

              <CheckoutPaymentMethodSelector
                plan={c.plan}
                activeMethod={c.activeMethod}
                onSelectCreditCard={() => {
                  c.setMethod("credit_card");
                  c.setPixResult(null);
                  c.setErrorMessage(null);
                }}
                onSelectPix={() => {
                  c.setMethod("pix");
                  c.setErrorMessage(null);
                }}
              />

              {c.errorMessage ? (
                <Alert variant="error" className="text-xs">
                  {c.errorMessage}
                </Alert>
              ) : null}

              <FormField
                labelClassName="flex w-full items-center justify-between gap-2"
                label={
                  <>
                    <span>
                      CPF do Titular{" "}
                      <span className="text-muted-foreground font-normal">
                        (exigido pelo Banco Central)
                      </span>
                    </span>
                    {cpfStatusNode}
                  </>
                }
                htmlFor="checkout-cpf"
              >
                <Input
                  id="checkout-cpf"
                  placeholder="000.000.000-00"
                  value={c.cpf}
                  onChange={(e) => c.handleCpfChange(e.target.value)}
                  maxLength={14}
                  inputMode="numeric"
                  autoComplete="off"
                  className="text-base sm:text-sm"
                />
              </FormField>

              {c.activeMethod === "credit_card" ? (
                <CreditCardCheckoutForm
                  holderName={c.holderName}
                  cardNumber={c.cardNumber}
                  cardExpiry={c.cardExpiry}
                  cardCcv={c.cardCcv}
                  detectedBrand={c.detectedBrand}
                  onHolderNameChange={c.setHolderName}
                  onCardNumberChange={c.handleCardNumberChange}
                  onCardExpiryChange={c.handleCardExpiryChange}
                  onCardCcvChange={c.handleCardCcvChange}
                />
              ) : c.pixResult ? (
                <PixQrWaitingPanel
                  pixResult={c.pixResult}
                  priceCents={c.planConfig.priceCents}
                  copiedPix={c.copiedPix}
                  isVerifyingManual={c.isVerifyingManual}
                  onCopyPix={() => {
                    void c.handleCopyPix();
                  }}
                  onManualVerify={c.handleManualVerify}
                  onSimulateConfirmation={c.handleSimulatePixConfirmation}
                  onSwitchToCard={() => {
                    c.setPixResult(null);
                    c.setMethod("credit_card");
                  }}
                  onBackToPlans={() => {
                    c.setPixResult(null);
                    c.navigate("/planos");
                  }}
                  onGoToDashboard={() => c.navigate("/")}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-border/80 bg-surface-raised/60 p-5 text-center">
                  <div className="size-14 rounded-2xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary-strong">
                    <QrCode className="size-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">PIX Anual com 40% OFF</p>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
                      Ao confirmar, geramos o QR Code dinâmico oficial do Banco Central.
                      {c.subscription?.isTrial && (c.subscription?.trialDaysRemaining ?? 0) > 0
                        ? ` Seus ${c.subscription.trialDaysRemaining} dias restantes de teste gratuito serão integralmente somados aos seus 12 meses de anuidade.`
                        : " A liberação é instantânea após o pagamento."}
                    </p>
                  </div>
                  <Badge variant="positive" size="sm">
                    <MoneyText
                      cents={c.planConfig.priceCents}
                      variant="caption"
                      tone="default"
                      deemphasizeCents={false}
                    />{" "}
                    à vista
                  </Badge>
                </div>
              )}

              <CheckoutOrderSummary
                planTitle={c.planConfig.title}
                priceCents={c.planConfig.priceCents}
                billingSchedule={c.billingSchedule}
              />

              <CheckoutSubmitFooter
                showSubmitButton={!c.pixResult || c.activeMethod === "credit_card"}
                activeMethod={c.activeMethod}
                isPending={c.isPending}
                onConfirm={() => {
                  void c.handleConfirm();
                }}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
