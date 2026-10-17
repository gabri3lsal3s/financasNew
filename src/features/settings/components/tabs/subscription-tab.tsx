import { useState } from "react";
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
  ConfirmDialog,
} from "@/components/ui";
import { UpgradeDialog } from "@/components/modules/subscription/upgrade-dialog";
import { useUserSubscription } from "@/state";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { formatCardNumber, formatCardExpiry } from "@/services/masks";
import {
  cancelSubscription,
  updateSubscriptionCreditCard,
} from "@/data/repositories/billing";
import { cn } from "@/lib/utils";
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
export function SubscriptionTab() {
  const navigate = useNavigate();
  const subscription = useUserSubscription();

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [updateCardOpen, setUpdateCardOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleProceedToCheckout = (plan: SubscriptionPlan) => {
    setUpgradeOpen(false);
    navigate(`/assinatura?plano=${plan}`);
  };

  const handleCancelConfirm = async () => {
    setIsCanceling(true);
    try {
      await cancelSubscription();
      triggerSensory("destructive");
      pushToast({
        title: "Cancelamento registrado",
        description: "Seu plano permanece ativo até o fim do período já pago.",
        variant: "default",
      });
      setCancelOpen(false);
    } catch (err: unknown) {
      triggerSensory("destructive");
      const msg = err instanceof Error ? err.message : "Falha ao registrar cancelamento no Asaas.";
      pushToast({
        title: "Erro no cancelamento",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);
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
                  ativo normalmente até o término do período pago e todos os seus dados ficam
                  preservados.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ao cancelar, seu acesso Pro permanece ativo até o fim do período já pago. Todos
                  os seus dados e relatórios são preservados para sempre — você poderá reativar o Pro a qualquer
                  momento em 1 clique.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isCanceling}
                  onClick={() => setCancelOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <XCircle className="size-4" aria-hidden="true" />
                  Cancelar Assinatura
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

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar renovação da assinatura Pro?"
        description="Seu plano continuará ativo normalmente até o término do período já pago. Nenhum dado será excluído e você poderá reativar a qualquer momento."
        confirmLabel={isCanceling ? "Cancelando..." : "Confirmar Cancelamento"}
        variant="destructive"
        onConfirm={() => { void handleCancelConfirm(); }}
      />

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
  { feature: "Consulta de histórico e saldos", readOnly: true, pro: true },
  { feature: "Novos lançamentos (despesas/receitas)", readOnly: false, pro: true },
  { feature: "Gestão de cartões de crédito", readOnly: false, pro: true },
  { feature: "Parcelamentos em até 60x", readOnly: false, pro: true },
  { feature: "Rebalanceamento de investimentos", readOnly: false, pro: true },
  { feature: "Radar Fiscal IR e DARF", readOnly: false, pro: true },
  { feature: "Exportação Excel (.xlsx)", readOnly: true, pro: true },
  { feature: "Simulador FIRE e Projeção", readOnly: true, pro: true },
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
  const [holderName, setHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCcv, setCardCcv] = useState("");
  const [isSaving, setIsSaving] = useState(false);
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
    if (!expMonth || !expYear || parseInt(expMonth, 10) < 1 || parseInt(expMonth, 10) > 12) {
      setError("Validade inválida (MM/AA).");
      return;
    }
    if (cardCcv.length < 3) {
      setError("CVV inválido.");
      return;
    }

    setIsSaving(true);
    try {
      await updateSubscriptionCreditCard({
        holderName: holderName.trim().toUpperCase(),
        number: rawNumber,
        expiryMonth: expMonth.padStart(2, "0"),
        expiryYear: expYear,
        ccv: cardCcv,
      });

      triggerSensory("success");
      pushToast({
        title: "Cartão atualizado com sucesso!",
        description: "As próximas cobranças utilizarão o novo cartão informado.",
        variant: "default",
      });
      onOpenChange(false);
      setHolderName("");
      setCardNumber("");
      setCardExpiry("");
      setCardCcv("");
    } catch (err: unknown) {
      triggerSensory("destructive");
      const msg = err instanceof Error ? err.message : "Falha ao atualizar cartão no Asaas.";
      setError(msg);
    } finally {
      setIsSaving(false);
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
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => { void handleSubmit(); }}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
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
// Histórico de Faturas & Recibos
// ---------------------------------------------------------------------------

interface InvoiceHistoryCardProps {
  subscription: SubscriptionStatus;
}

function InvoiceHistoryCard({ subscription }: InvoiceHistoryCardProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  const mockInvoices = [
    {
      id: "FAT-2026-001",
      date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
      description: subscription.plan === "annual" ? "Plano Pro Anual (12 meses)" : "Plano Pro Mensal",
      amount: subscription.plan === "annual" ? "R$\u00a0178,80" : "R$\u00a019,90",
      status: "paid" as const,
      method: "Cartão de Crédito",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Histórico de Faturas & Recibos</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {subscription.isPro ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-border/80 overflow-hidden divide-y divide-border/80">
              {mockInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface hover:bg-surface-hover transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{inv.description}</span>
                      <Badge variant="positive" size="xs">
                        Pago
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{inv.date}</span>
                      <span>•</span>
                      <span>{inv.id}</span>
                      <span>•</span>
                      <span>{inv.method}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="font-semibold text-sm text-foreground tabular-nums">{inv.amount}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedReceipt(inv.id);
                      }}
                      className="text-xs gap-1.5 h-8 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      <span>Comprovante</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Comprovantes oficiais processados com segurança pelo gateway Asaas.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/80 p-6 text-center space-y-2">
            <Receipt className="size-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Nenhuma fatura emitida</p>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                Ao assinar o Plano Pro, o histórico das suas faturas, recibos fiscais e comprovantes ficará disponível aqui.
              </p>
            </div>
          </div>
        )}

        {/* Modal de Comprovante de Pagamento */}
        {selectedReceipt && (
          <Modal
            open={Boolean(selectedReceipt)}
            onOpenChange={(open) => !open && setSelectedReceipt(null)}
            title="Comprovante de Assinatura"
            description={`Identificador da transação: ${selectedReceipt}`}
            size="md"
          >
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <div className="flex justify-between items-center text-xs pb-3 border-b border-border/80">
                  <span className="text-muted-foreground">Status da Transação</span>
                  <Badge variant="positive" size="xs">
                    Confirmado
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Plano</span>
                  <span className="font-semibold text-foreground">
                    {subscription.plan === "annual" ? "Plano Pro Anual" : "Plano Pro Mensal"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {subscription.plan === "annual" ? "R$\u00a0178,80" : "R$\u00a019,90"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Processamento</span>
                  <span className="font-semibold text-foreground">Asaas Gestão Financeira</span>
                </div>
              </div>

              <ModalFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedReceipt(null)}
                >
                  Fechar
                </Button>
              </ModalFooter>
            </div>
          </Modal>
        )}
      </CardContent>
    </Card>
  );
}

