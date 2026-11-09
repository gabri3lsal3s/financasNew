import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  BookOpen,
  FlaskConical,
  ArrowUpRight,
  Calendar,
  RefreshCw,
  CreditCard,
  Loader2,
  AlertCircle,
  Receipt,
  FileText,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Input,
  Modal,
  ModalFooter,
  RadioGroup,
} from "@/components/ui";
import { UpgradeDialog } from "@/components/modules/subscription/upgrade-dialog";
import {
  useUserSubscription,
  useCancelSubscriptionMutation,
  useUpdateSubscriptionCardMutation,
  useUpgradeToAnnualMutation,
} from "@/state";
import { formatCardNumber, formatCardExpiry } from "@/services/masks";
import { useInvoices } from "@/state/queries/use-invoices";
import { cn } from "@/lib/utils";
import { calculateGuaranteeResidual } from "@/domain/subscription";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types";

/**
 * Aba "Plano e Assinatura" em Configurações.
 *
 * Exibe o status atual do plano, datas e ações disponíveis:
 * - Trial: barra de progresso com dias restantes + CTA de upgrade.
 * - Pro: data de renovação, método de pagamento, troca de cartão e cancelamento em 1 clique.
 * - Somente-leitura: CTA para reativar o Pro.
 *
 * Regras: zero emojis, zero controles nativos, cards com trinca canônica (AGENTS.md).
 */

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "Preço alto / fora do orçamento atual" },
  { value: "not_using_enough", label: "Não estou usando com frequência suficiente" },
  { value: "missing_features", label: "Faltam recursos que eu precisava" },
  { value: "found_alternative", label: "Encontrei outro aplicativo/método" },
  { value: "other", label: "Outro motivo particular" },
];

export function SubscriptionTab() {
  const navigate = useNavigate();
  const subscription = useUserSubscription();

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("too_expensive");
  const [cancelStep, setCancelStep] = useState<"reason" | "confirm">("reason");
  const [updateCardOpen, setUpdateCardOpen] = useState(false);

  const { isWithinGuarantee, daysRemaining: guaranteeDaysRemaining } = useMemo(() => {
    return calculateGuaranteeResidual({
      startsAt: subscription.startsAt,
      isPro: subscription.isPro,
    });
  }, [subscription.startsAt, subscription.isPro]);

  const currentPeriodFormatted = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const cancelMutation = useCancelSubscriptionMutation();
  const upgradeMutation = useUpgradeToAnnualMutation();

  const handleUpgradeToAnnual = async () => {
    try {
      await upgradeMutation.mutateAsync();
    } catch {
      // erro tratado no onSuccess/onError da mutation
    }
  };

  const handleProceedToCheckout = (plan: SubscriptionPlan) => {
    setUpgradeOpen(false);
    navigate(`/assinatura?plano=${plan}`);
  };

  const handleCancelConfirm = async () => {
    try {
      await cancelMutation.mutateAsync();
      setCancelOpen(false);
      setCancelStep("reason");
    } catch {
      // erro já notificado pela mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* Card de status atual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Plano Atual</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <StatusBlock subscription={subscription} onUpgrade={() => setUpgradeOpen(true)} />
        </CardContent>
      </Card>

      {/* Forma de Pagamento e Troca de Cartão — apenas para assinantes Pro */}
      {subscription.isPro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Forma de Pagamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                Cartão de Crédito Recorrente
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cobrança processada com segurança pelo gateway Asaas.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUpdateCardOpen(true)}
              className="gap-2 shrink-0 cursor-pointer"
            >
              <CreditCard className="size-3.5" aria-hidden="true" />
              Alterar Cartão
            </Button>
          </CardContent>
        </Card>
      )}
 

      {/* Banner de Renovação Antecipada Anual via Pix (se faltarem 30 dias ou menos) */}
      {subscription.isPro && subscription.plan === "annual" && (
        <Card className="border-portfolio/30 bg-portfolio/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Badge variant="default" size="xs">
                  Renovação Acumulativa Pix
                </Badge>
                <span className="text-xs font-semibold text-foreground">Plano Anual Pro</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você pode antecipar sua renovação anual via Pix a qualquer momento. Os +365 dias são somados ao fim do seu período vigente sem perda de dias.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleProceedToCheckout("annual")}
              className="gap-2 shrink-0 cursor-pointer"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Renovar Anual (+365 dias)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upsell 1-clique Mensal -> Anual (Economia de 40%) */}
      {subscription.isPro && subscription.plan === "monthly" && !subscription.cancelAtPeriodEnd && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Badge variant="default" size="xs">
                  Economize 40%
                </Badge>
                <span className="text-xs font-semibold text-foreground">Migrar para o Plano Anual</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pague o equivalente a apenas R$ 11,99/mês (R$ 143,88/ano) em vez de R$ 19,99/mês. Migração imediata em 1 clique mantendo seu cartão atual.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={upgradeMutation.isPending}
              onClick={() => { void handleUpgradeToAnnual(); }}
              className="gap-2 shrink-0 cursor-pointer"
            >
              {upgradeMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Zap className="size-3.5" aria-hidden="true" />
              )}
              {upgradeMutation.isPending ? "Migrando..." : "Migrar para Anual (-40%)"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Faturas & Recibos */}
      <InvoiceHistoryCard subscription={subscription} />

      {/* Tabela comparativa de planos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Comparativo de Planos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PlanComparisonTable isFullAccess={subscription.isFullAccess} />

          {!subscription.isPro && (
            <div className="mt-5">
              <Button
                type="button"
                className="w-full gap-2 cursor-pointer"
                onClick={() => setUpgradeOpen(true)}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Ativar Plano Pro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancelamento — apenas para assinantes ativos */}
      {subscription.isPro && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Cancelamento</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscription.cancelAtPeriodEnd ? (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3.5 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="warning" size="xs">
                    Cancelamento agendado
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sua assinatura não será renovada ao final do ciclo atual. Seu acesso Pro permanece
                  ativo normalmente até o término do período pago ({currentPeriodFormatted || "fim do ciclo"}) e todos os seus dados ficam
                  preservados.
                </p>
              </div>
            ) : isWithinGuarantee ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-positive/30 bg-positive/5 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="positive" size="xs">
                      Garantia incondicional ativa
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {guaranteeDaysRemaining} {guaranteeDaysRemaining === 1 ? "dia restante" : "dias restantes"} para arrependimento
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Você está no prazo legal de 7 dias (CDC). Ao cancelar agora, o valor pago será
                    estornado integralmente pelo Asaas no seu cartão ou conta Pix e o acesso Pro será
                    encerrado imediatamente.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => setCancelOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  Cancelar Assinatura e Reembolsar
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ao cancelar, seu acesso Pro permanece ativo até {currentPeriodFormatted || "o fim do período já pago"}. Todos
                  os seus dados e relatórios são preservados para sempre — você poderá reativar o Pro a qualquer
                  momento em 1 clique.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => setCancelOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  Cancelar Renovação da Assinatura
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        onProceedToCheckout={handleProceedToCheckout}
      />

      
      {/* Modal de Cancelamento Ético em 2 Etapas */}
      <Modal
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) setCancelStep("reason");
        }}
        size="md"
        title={
          cancelStep === "reason"
            ? "Pesquisa de Cancelamento"
            : isWithinGuarantee
            ? "Confirmar Cancelamento e Estorno Integral"
            : "Confirmar Cancelamento da Renovação"
        }
        description={
          cancelStep === "reason"
            ? "Lamentamos ver você partir. Nos ajude a melhorar contando o principal motivo do cancelamento:"
            : isWithinGuarantee
            ? "Você está dentro do prazo legal de 7 dias de garantia (CDC). Ao confirmar, o valor pago será estornado integralmente pelo Asaas no seu cartão ou conta Pix e seu acesso Pro será encerrado imediatamente."
            : `Sua assinatura não será renovada ao final do ciclo. Você continuará com acesso Pro completo normalmente até ${currentPeriodFormatted || "o fim do período já pago"} e seus dados serão preservados.`
        }
      >
        <div className="space-y-4">
          {cancelStep === "reason" ? (
            <div className="space-y-3">
              <RadioGroup
                value={cancelReason}
                onValueChange={setCancelReason}
                options={CANCELLATION_REASONS}
                variant="cards"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="critical" size="xs">
                    {isWithinGuarantee ? "Estorno Integral Asaas" : "Acesso Mantido"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isWithinGuarantee
                    ? "O estorno é disparado diretamente na API do Asaas e seu acesso Pro volta a ser Somente Leitura."
                    : `Nenhuma nova cobrança será realizada no cartão. Seu acesso Pro segue ativo até ${currentPeriodFormatted || "o término do ciclo"}.`}
                </p>
              </div>
            </div>
          )}

          <ModalFooter>
            {cancelStep === "reason" ? (
              <div className="flex w-full items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelOpen(false)}
                  className="cursor-pointer"
                >
                  Continuar com Pro
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setCancelStep("confirm")}
                  className="cursor-pointer"
                >
                  Avançar
                </Button>
              </div>
            ) : (
              <div className="flex w-full items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => setCancelStep("reason")}
                  className="cursor-pointer"
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => { void handleCancelConfirm(); }}
                  className="gap-2 cursor-pointer"
                >
                  {cancelMutation.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                  {cancelMutation.isPending
                    ? "Processando..."
                    : isWithinGuarantee
                    ? "Confirmar e Estornar"
                    : "Confirmar Cancelamento"}
                </Button>
              </div>
            )}
          </ModalFooter>
        </div>
      </Modal>


      <UpdateCardModal
        open={updateCardOpen}
        onOpenChange={setUpdateCardOpen}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes internos
// ---------------------------------------------------------------------------

interface StatusBlockProps {
  subscription: ReturnType<typeof useUserSubscription>;
  onUpgrade: () => void;
}

function StatusBlock({ subscription, onUpgrade }: StatusBlockProps) {
  const { isTrial, isPro, trialDaysRemaining, trialEndsAt, currentPeriodEnd, plan } =
    subscription;

  if (isTrial && trialDaysRemaining !== null) {
    const progress = Math.round(((30 - trialDaysRemaining) / 30) * 100);
    const endsLabel = trialEndsAt
      ? new Date(trialEndsAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">Teste Pro Ativo</span>
          </div>
          <Badge variant="default" size="sm">
            {trialDaysRemaining}d restantes
          </Badge>
        </div>

        {/* Barra de progresso dos dias de trial */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Dia 1</span>
            {endsLabel && <span>Encerra em {endsLabel}</span>}
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${30 - trialDaysRemaining} de 30 dias utilizados`}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {30 - trialDaysRemaining} de 30 dias utilizados — acesso total a todos os recursos.
          </p>
        </div>

        <Button type="button" className="w-full gap-2 cursor-pointer" onClick={onUpgrade}>
          <Sparkles className="size-4" aria-hidden="true" />
          Assinar Plano Pro e manter tudo ativo
        </Button>
      </div>
    );
  }

  if (isPro) {
    const planLabel = plan === "annual" ? "Pro Anual" : "Pro Mensal";
    const renewLabel = currentPeriodEnd
      ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "–";

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-positive-strong" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Plano {planLabel}</span>
          <Badge variant="positive" size="sm">
            Ativo
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoRow icon={Calendar} label="Próxima renovação" value={renewLabel} />
          <InfoRow icon={ShieldCheck} label="Status" value="Assinatura ativa" />
          <InfoRow
            icon={RefreshCw}
            label="Cancelamento"
            value="A qualquer momento em 1 clique"
          />
        </div>
      </div>
    );
  }

  // Somente-leitura
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="size-5 text-warning-strong" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Modo Somente-Leitura</span>
        <Badge variant="warning" size="sm">
          Trial encerrado
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Seu período de teste encerrou. Todos os seus dados e relatórios estão preservados e você pode
        consultar seu histórico a qualquer momento. Para lançar novos registros e orçamentos, ative o
        Plano Pro.
      </p>

      <Button type="button" className="w-full gap-2 cursor-pointer" onClick={onUpgrade}>
        <Sparkles className="size-4" aria-hidden="true" />
        Ativar Plano Pro
      </Button>
    </div>
  );
}

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border/80 bg-muted/20 p-3",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

const COMPARISON_ROWS = [
  { feature: "Consulta de histórico, saldos e relatórios", readOnly: true, pro: true },
  { feature: "Exportação básica em planilhas (.csv)", readOnly: true, pro: true },
  { feature: "Dossiê Executivo Contábil de 5 abas (.xlsx nativo)", readOnly: false, pro: true },
  { feature: "Novos lançamentos de despesas e receitas ilimitados", readOnly: false, pro: true },
  { feature: "Leitor OCR de cupons fiscais NFC-e/SAT e boletos", readOnly: false, pro: true },
  { feature: "Múltiplos cartões de crédito e parcelamentos em até 60x", readOnly: false, pro: true },
  { feature: "Tetos de gastos e orçamentos com Safe-to-Spend diário", readOnly: false, pro: true },
  { feature: "Gestão completa de dívidas (Snowball / Avalanche)", readOnly: false, pro: true },
  { feature: "Espaço Família compartilhado e racha de contas Pix", readOnly: false, pro: true },
  { feature: "Planejador de viagens e controle de moedas", readOnly: false, pro: true },
  { feature: "Rebalanceamento determinístico de carteira sem DARF", readOnly: false, pro: true },
  { feature: "Radar Fiscal de IR e apuração contínua de tributos", readOnly: false, pro: true },
] as const;

function PlanComparisonTable({ isFullAccess }: { isFullAccess: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/80 bg-muted/30">
            <th className="py-2.5 pl-4 pr-2 text-left font-semibold text-muted-foreground">
              Recurso
            </th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-24">
              Leitura
            </th>
            <th className="px-3 py-2.5 text-center font-semibold text-primary w-24">
              Pro
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row, i) => (
            <tr
              key={row.feature}
              className={cn(
                "border-b border-border/60 last:border-b-0",
                i % 2 === 0 ? "bg-surface" : "bg-muted/10",
              )}
            >
              <td className="py-2.5 pl-4 pr-2 text-foreground">{row.feature}</td>
              <td className="px-3 py-2.5 text-center">
                {row.readOnly ? (
                  <CheckCircle2
                    className="mx-auto size-4 text-positive-strong"
                    aria-label="Disponível"
                  />
                ) : (
                  <XCircle
                    className="mx-auto size-4 text-negative-strong/60"
                    aria-label="Indisponível"
                  />
                )}
              </td>
              <td className="px-3 py-2.5 text-center">
                <CheckCircle2
                  className={cn(
                    "mx-auto size-4",
                    isFullAccess ? "text-positive-strong" : "text-muted-foreground/40",
                  )}
                  aria-label="Disponível no Pro"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface UpdateCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function UpdateCardModal({ open, onOpenChange }: UpdateCardModalProps) {
  const updateCardMutation = useUpdateSubscriptionCardMutation();
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!holderName.trim()) {
      setError("Informe o nome do titular.");
      return;
    }
    const rawNumber = cardNumber.replace(/\D/g, "");
    if (rawNumber.length < 13 || rawNumber.length > 19) {
      setError("Número do cartão inválido.");
      return;
    }
    const [expMonth, expYear] = cardExpiry.split("/");
    const expMonthNum = parseInt(expMonth || "", 10);
    const expYearNum = parseInt(expYear?.length === 2 ? `20${expYear}` : (expYear || ""), 10);
    if (!expMonth || !expYear || expMonthNum < 1 || expMonthNum > 12 || Number.isNaN(expYearNum)) {
      setError("Validade inválida (MM/AA).");
      return;
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (expYearNum < currentYear || (expYearNum === currentYear && expMonthNum < currentMonth)) {
      setError("Cartão expirado. Informe uma validade futura.");
      return;
    }
    if (cardCcv.length < 3) {
      setError("CVV inválido.");
      return;
    }

    try {
      await updateCardMutation.mutateAsync({
        holderName: holderName.trim().toUpperCase(),
        number: rawNumber,
        expiryMonth: expMonth.padStart(2, "0"),
        expiryYear: expYear,
        ccv: cardCcv,
      });

      onOpenChange(false);
      setHolderName("");
      setCardNumber("");
      setCardExpiry("");
      setCardCcv("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar cartão no Asaas.";
      setError(msg);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Alterar Cartão de Crédito"
      description="Informe os dados do novo cartão para cobranças futuras da sua assinatura Pro."
    >
      <div className="space-y-4 pt-2">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-strong"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Nome no Cartão</label>
          <Input
            placeholder="Nome impresso no cartão"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            autoComplete="cc-name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Número do Cartão</label>
          <Input
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            autoComplete="cc-number"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Validade</label>
            <Input
              placeholder="MM/AA"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
              maxLength={5}
              autoComplete="cc-exp"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">CVV</label>
            <Input
              placeholder="123"
              value={cardCcv}
              onChange={(e) => setCardCcv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              autoComplete="cc-csc"
            />
          </div>
        </div>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={updateCardMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => { void handleSubmit(); }}
            disabled={updateCardMutation.isPending}
            className="gap-2"
          >
            {updateCardMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Atualizando no Asaas...
              </>
            ) : (
              "Salvar Novo Cartão"
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Faturamento & Comprovantes Fiscais
// ---------------------------------------------------------------------------

interface InvoiceHistoryCardProps {
  subscription: SubscriptionStatus;
}

function InvoiceHistoryCard({ subscription }: InvoiceHistoryCardProps) {
  const { data: invoices, isLoading } = useInvoices(subscription.isPro);

  const planName =
    subscription.plan === "annual" ? "Plano Pro Anual (12 meses)" : "Plano Pro Mensal";
  const planAmount =
    subscription.plan === "annual" ? "R$ 143,88/ano" : "R$ 19,99/mês";
  const renewDate = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Faturamento &amp; Histórico de Faturas</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subscription.isPro ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground">{planName}</span>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Cobrança ativa</span>
                    <span>•</span>
                    <span>Gateway Asaas</span>
                    {renewDate && (
                      <>
                        <span>•</span>
                        <span>Próxima renovação: {renewDate}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="positive" size="xs">
                    Em dia
                  </Badge>
                  <span className="font-semibold text-xs text-foreground tabular-nums">
                    {planAmount}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                <FileText className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[11px]">
                  Os recibos de pagamento e notas fiscais eletrônicas (NFS-e) são emitidos automaticamente pelo gateway Asaas a cada renovação.
                </p>
              </div>
            </div>

            {/* Lista Real de Faturas / Recibos do Asaas */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground">Faturas Recentes</h4>
              {isLoading ? (
                <div className="flex items-center justify-center p-6 text-muted-foreground text-xs gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Carregando faturas...
                </div>
              ) : invoices && invoices.length > 0 ? (
                <div className="divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden">
                  {invoices.map((inv) => {
                    const receiptUrl = inv.transactionReceiptUrl || inv.invoiceUrl;
                    const dateFormatted = inv.paymentDate || inv.dateCreated
                      ? new Date(inv.paymentDate || inv.dateCreated).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : inv.dueDate;
                    const amountFormatted = new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(inv.value);

                    const isReceived = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(
                      inv.status
                    );
                    const isRefunded = ["REFUNDED"].includes(inv.status);

                    return (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 bg-surface hover:bg-muted/10 transition-colors text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{dateFormatted}</span>
                            <Badge
                              variant={isReceived ? "positive" : isRefunded ? "critical" : "muted"}
                              size="xs"
                            >
                              {isReceived ? "Pago" : isRefunded ? "Estornado" : inv.status}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {inv.billingType === "PIX" ? "Pix" : "Cartão de Crédito"}
                            {inv.description ? ` • ${inv.description}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-foreground tabular-nums">
                            {amountFormatted}
                          </span>
                          {receiptUrl && (
                            <a
                              href={receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir recibo em nova aba"
                              className="inline-flex items-center gap-1 h-7 px-2 text-xs font-medium rounded-md border border-border/80 hover:bg-muted/30 text-foreground transition-colors cursor-pointer"
                            >
                              <ExternalLink className="size-3 text-muted-foreground" aria-hidden="true" />
                              Recibo
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground p-3 rounded-xl border border-border/80 bg-muted/10">
                  Nenhuma fatura anterior registrada no Asaas.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 p-6 text-center space-y-2">
            <Receipt className="size-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Nenhuma fatura emitida</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Ao assinar o Plano Pro, as informações de cobrança, recibos e notas fiscais ficarão registradas para sua conta.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

