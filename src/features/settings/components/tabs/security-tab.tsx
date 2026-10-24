import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Database,
  Fingerprint,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Checkbox,
  Input,
  Modal,
  ModalFooter,
  Select,
} from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { ExportDataHub } from "@/components/modules";
import type { ExportCsvKind, ExportRange } from "@/components/modules";
const RestoreWizardDialog = lazy(() =>
  import("../restore-wizard").then((m) => ({ default: m.RestoreWizardDialog }))
);
import { downloadCsv, downloadJson } from "@/services/export-actions";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";
import { resetAppState } from "@/services/auth-cleanup";
import { useSignOut } from "@/hooks/use-sign-out";
import { deleteCurrentUserAccount } from "@/data/rpc";
import { cancelSubscription } from "@/data/repositories/billing";
import {
  checkBiometricsAvailability,
  authenticateWithBiometrics,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  resetAppLockBackgroundTimer,
  getAppLockGraceMinutes,
  setAppLockGraceMinutes,
  isPrivacyShieldEnabled,
  setPrivacyShieldEnabled,
  isNativePlatform,
} from "@/services/native";
import { todayLocalIso } from "@/lib/date";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { numberToCents } from "@/domain/money";
import { BACKUP_TABLE_KEYS, parseBackupPayload } from "@/domain/export";
import type {
  ExportExpenseRow,
  ExportIncomeRow,
  ExportInvoiceRow,
  ExportPositionRow,
  RestoreSummary,
} from "@/domain/export";
import {
  serializeExpensesCsv,
  serializeIncomesCsv,
  serializeInvoicesCsv,
  serializePositionsCsv,
} from "@/domain/export";
import {
  useExportData,
  useRestoreBackup,
  usePortfolioPosition,
  useUserAccess,
  useCategories,
  useCreditCards,
  useUserPreferences,
  useUpdateCustomSettings,
} from "@/state";

interface BackupExpenseItem {
  date: string;
  description?: string | null;
  category_id: string;
  value: number;
  report_weight?: number | null;
  payment_method: "cash" | "debit" | "credit_card" | "pix" | "transfer" | "other";
  card_id?: string | null;
  installment_number?: number | null;
  installments_total?: number | null;
}

interface BackupIncomeItem {
  date: string;
  description?: string | null;
  category_id: string;
  value: number;
  report_weight?: number | null;
  receive_type: "cash" | "pix" | "transfer" | "other";
}

interface BackupCardPaymentItem {
  competence_month: string;
  card_id: string;
  amount: number;
  date: string;
  note?: string | null;
  is_refund?: boolean;
}

const APP_LOCK_GRACE_OPTIONS: SelectOption[] = [
  { value: "0", label: "Imediato (ao sair do app)" },
  { value: "1", label: "Após 1 minuto em segundo plano" },
  { value: "5", label: "Após 5 minutos em segundo plano" },
  { value: "15", label: "Após 15 minutos em segundo plano" },
  { value: "30", label: "Após 30 minutos em segundo plano" },
];

export function SecurityTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useSignOut();
  const userAccess = useUserAccess();
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  // Estados de segurança nativa / app lock
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);
  const [biometryType, setBiometryType] = useState<string>("none");
  const [bioLockEnabled, setBioLockEnabled] = useState(() => isBiometricLockEnabled());
  const [graceMinutes, setGraceMinutes] = useState(() => String(getAppLockGraceMinutes()));
  const isNative = isNativePlatform();
  const showBiometrics = isNative || Boolean(biometricsAvailable);
  const showPrivacyShield = isNative;
  const showAppLockCard = showBiometrics || showPrivacyShield;

  // Estados de Exclusão de Conta (LGPD)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const CONFIRM_DELETE_WORD = "EXCLUIR";
  const isConfirmationValid = deleteConfirmationInput.trim().toUpperCase() === CONFIRM_DELETE_WORD;

  const handleDeleteAccount = async () => {
    if (!isConfirmationValid || isDeletingAccount) return;

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      // 1. Cancelamento preventivo no gateway Asaas/Stripe
      try {
        await cancelSubscription();
      } catch {
        // Ignora caso não possua assinatura ativa ou gateway offline
      }

      // 2. Expurgo em cascata das 34 tabelas e auth.users (LGPD Art. 18, VI)
      await deleteCurrentUserAccount();

      triggerSensory("destructive");
      pushToast({
        title: "Conta excluída",
        description: "Sua conta e todos os dados foram definitivamente expurgados conforme a LGPD.",
        variant: "default",
      });

      // 3. Limpeza profunda de cache, expurgo de storage e logout seguro
      try {
        resetAppState(queryClient, null);
      } catch {
        // noop
      }

      if (typeof window !== "undefined") {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch {
          // noop
        }
      }

      try {
        await signOut();
      } catch {
        // noop
      }

      navigate("/entrar", { replace: true });
    } catch (err) {
      triggerSensory("destructive");
      setDeleteError(getErrorMessage(err));
      setIsDeletingAccount(false);
    }
  };

  const [localPrivacyOverride, setLocalPrivacyOverride] = useState<boolean | null>(null);
  const cloudPrivacyShield = userPreferencesQuery.data?.custom_settings?.privacyShieldEnabled;
  const privacyEnabled =
    localPrivacyOverride !== null
      ? localPrivacyOverride
      : cloudPrivacyShield !== undefined
        ? cloudPrivacyShield
        : isPrivacyShieldEnabled();

  useEffect(() => {
    checkBiometricsAvailability().then((res) => {
      setBiometricsAvailable(res.isAvailable);
      setBiometryType(res.biometryType);
    });
  }, []);

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (enabled) {
      const result = await authenticateWithBiometrics({
        reason: "Confirme sua biometria para habilitar o bloqueio do aplicativo",
      });
      if (!result.success) {
        pushToast({
          title: "Autenticação não concluída",
          description: result.error ?? "Não foi possível validar sua biometria.",
          variant: "destructive",
        });
        return;
      }
      setBiometricLockEnabled(true);
      resetAppLockBackgroundTimer();
      setBioLockEnabled(true);
      pushToast({
        title: "Bloqueio biométrico ativado",
        description: "O aplicativo exigirá biometria ao retornar do segundo plano.",
        variant: "success",
      });
    } else {
      setBiometricLockEnabled(false);
      setBioLockEnabled(false);
      pushToast({
        title: "Bloqueio biométrico desativado",
        variant: "default",
      });
    }
  };

  const handleGraceMinutesChange = (val: string) => {
    setGraceMinutes(val);
    setAppLockGraceMinutes(Number(val));
  };

  const handleTogglePrivacyShield = (enabled: boolean) => {
    setLocalPrivacyOverride(enabled);
    setPrivacyShieldEnabled(enabled);
    updateCustomSettingsMutation.mutate({ privacyShieldEnabled: enabled });
    pushToast({
      title: enabled ? "Escudo de privacidade ativado" : "Escudo de privacidade desativado",
      description: enabled
        ? "Capturas de tela e miniaturas no alternador de tarefas foram bloqueadas."
        : "Capturas de tela foram liberadas com sucesso.",
      variant: "default",
    });
  };


  const portfolioPosition = usePortfolioPosition();
  const exportDataQuery = useExportData({ enabled: false });
  const restoreBackupMutation = useRestoreBackup();
  const [restoreWizardOpen, setRestoreWizardOpen] = useState(false);
  const categoriesQuery = useCategories();
  const creditCardsQuery = useCreditCards();

  const handleExportJson = async (): Promise<void> => {
    const { data: payload } = await exportDataQuery.refetch();
    if (payload) {
      downloadJson(`financas_backup_${todayLocalIso()}.json`, payload);
    }
  };

  const rangeStamp = (range: ExportRange): string =>
    `${range.start.slice(0, 10)}_a_${range.end.slice(0, 10)}`;

  const handleExportCsv = async (kind: ExportCsvKind, range: ExportRange): Promise<void> => {
    const stamp = rangeStamp(range);
    const categories = categoriesQuery.data ?? [];
    const cards = creditCardsQuery.data ?? [];
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const cardName = new Map(cards.map((c) => [c.id, c.name]));

    const { data: payload } = await exportDataQuery.refetch();

    if (kind === "expenses") {
      const expenses = ((payload?.data.expenses ?? []) as unknown as BackupExpenseItem[]).filter(
        (e) => e.date >= range.start && e.date < range.end,
      );
      const csvRows: ExportExpenseRow[] = expenses.map((e) => ({
        date: e.date,
        description: e.description ?? "",
        categoryName: categoryName.get(e.category_id) ?? "Sem categoria",
        valueCents: numberToCents(e.value),
        reportValueCents: numberToCents(e.value * (e.report_weight ?? 1)),
        paymentMethodLabel: PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method,
        cardName: e.card_id ? (cardName.get(e.card_id) ?? null) : null,
        installments: (e.installments_total ?? 1) > 1 ? `${e.installment_number}/${e.installments_total}` : "—",
      }));
      downloadCsv(`despesas_${stamp}.csv`, serializeExpensesCsv(csvRows));
      return;
    }

    if (kind === "incomes") {
      const incomes = ((payload?.data.incomes ?? []) as unknown as BackupIncomeItem[]).filter(
        (i) => i.date >= range.start && i.date < range.end,
      );
      const csvRows: ExportIncomeRow[] = incomes.map((i) => ({
        date: i.date,
        description: i.description ?? "",
        categoryName: categoryName.get(i.category_id) ?? "Sem categoria",
        valueCents: numberToCents(i.value),
        reportValueCents: numberToCents(i.value * (i.report_weight ?? 1)),
        receiveTypeLabel: RECEIVE_TYPE_LABELS[i.receive_type] ?? i.receive_type,
      }));
      downloadCsv(`receitas_${stamp}.csv`, serializeIncomesCsv(csvRows));
      return;
    }

    if (kind === "invoices") {
      const payments = ((payload?.data.card_payments ?? []) as unknown as BackupCardPaymentItem[]).filter(
        (p) => p.date >= range.start && p.date < range.end,
      );
      const csvRows: ExportInvoiceRow[] = payments.map((p) => ({
        competenceMonth: p.competence_month,
        cardName: cardName.get(p.card_id) ?? "Cartão removido",
        amountCents: numberToCents(p.amount),
        date: p.date,
        note: p.note ?? null,
        isRefund: Boolean(p.is_refund),
      }));
      downloadCsv(`faturas_${stamp}.csv`, serializeInvoicesCsv(csvRows));
      return;
    }

    const csvRows: ExportPositionRow[] = portfolioPosition.rows.map((r) => ({
      ticker: r.ticker,
      assetClass: r.assetClass,
      currency: r.currency,
      quantity: r.quantity,
      averageCost: r.averageCost,
      priceBRL: r.priceBRL,
      valueBRL: r.valueBRL,
      unrealizedPnl: r.unrealizedPnl,
      unrealizedPct: r.unrealizedPct,
      pct: r.pct,
    }));
    downloadCsv(`posicoes_${stamp}.csv`, serializePositionsCsv(csvRows));
  };

  const handleRestoreFile = async (file: File): Promise<RestoreSummary> => {
    const text = await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error("Arquivo inválido: não é um JSON válido.");
    }
    const validation = parseBackupPayload(raw);
    if (!validation.ok) {
      throw new Error(validation.errors.join("\n"));
    }
    const summary: RestoreSummary = {};
    for (const key of BACKUP_TABLE_KEYS) {
      summary[key] = validation.payload.data[key].length;
    }
    return summary;
  };

  const handleConfirmRestore = async (file: File): Promise<void> => {
    const text = await file.text();
    const raw: unknown = JSON.parse(text);
    const validation = parseBackupPayload(raw);
    if (!validation.ok) {
      throw new Error(validation.errors.join("\n"));
    }
    await restoreBackupMutation.mutateAsync(validation.payload);
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Bloqueio do Aplicativo & Privacidade */}
      {showAppLockCard && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Fingerprint className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Bloqueio do Aplicativo &amp; Privacidade</span>
              </span>
              {showBiometrics ? (
                biometricsAvailable ? (
                  <Badge variant="positive" size="xs">
                    {biometryType === "face"
                      ? "Reconhecimento Facial"
                      : biometryType === "iris"
                        ? "Leitor de Íris"
                        : "Sensor Biométrico Ativo"}
                  </Badge>
                ) : biometricsAvailable === false ? (
                  <Badge variant="muted" size="xs">
                    Biometria Indisponível
                  </Badge>
                ) : null
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showBiometrics && (
              <div className="space-y-4 rounded-xl border border-border/80 bg-surface shadow-xs p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      Exigir biometria ao retornar
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Bloqueia o acesso às suas informações financeiras quando você alternar de aplicativo ou minimizar a tela.
                    </p>
                  </div>
                  <Checkbox
                    id="toggle-biometrics"
                    aria-label="Exigir biometria ao retornar ao aplicativo"
                    checked={bioLockEnabled}
                    onCheckedChange={handleToggleBiometrics}
                  />
                </div>

                {bioLockEnabled ? (
                  <div className="pt-3 border-t border-border/60 space-y-2">
                    <span className="text-xs font-semibold text-foreground">
                      Tolerância para bloqueio
                    </span>
                    <Select
                      value={graceMinutes}
                      onValueChange={handleGraceMinutesChange}
                      options={APP_LOCK_GRACE_OPTIONS}
                      ariaLabel="Selecione o tempo de tolerância para bloqueio"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Define quanto tempo o app pode permanecer em segundo plano antes de exigir nova validação biométrica.
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {showPrivacyShield && (
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/80 bg-surface shadow-xs p-4">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    Escudo de Privacidade (Privacy Shield)
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Oculta saldos e dados na tela de aplicativos recentes do sistema e bloqueia capturas de tela.
                  </p>
                </div>
                <Checkbox
                  id="toggle-privacy-shield"
                  aria-label="Ativar escudo de privacidade contra capturas e visualização recente"
                  checked={privacyEnabled}
                  onCheckedChange={handleTogglePrivacyShield}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card 3: Gestão de Dados & Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Gestão de Dados &amp; Backup</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <ExportDataHub
            onExportJson={handleExportJson}
            onExportCsv={handleExportCsv}
            onRestore={handleRestoreFile}
            onConfirmRestore={handleConfirmRestore}
            onOpenRestoreWizard={() => setRestoreWizardOpen(true)}
            availableCsvKinds={[
              ...(userAccess.hasFeature("transactions") ? (["expenses", "incomes"] as const) : []),
              ...(userAccess.hasFeature("cards") ? (["invoices"] as const) : []),
              ...(userAccess.hasFeature("investments") ? (["positions"] as const) : []),
            ]}
          />
        </CardContent>
      </Card>

      {/* Card 4: Zona de Perigo / Exclusão de Conta (LGPD) */}
      <Card className="border-critical/30 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-critical-strong">
            <AlertTriangle className="size-4 text-critical-strong" aria-hidden="true" />
            <span>Zona de Perigo / Exclusão de Conta (LGPD)</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Direito ao Esquecimento garantido pelo Art. 18, VI da Lei Geral de Proteção de Dados (LGPD).
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-critical/20 bg-critical/5">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground block">
                Excluir conta e dados definitivamente
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Expurga todas as transações, cartões, dívidas, orçamentos, investimentos e remove permanentemente seu cadastro.
              </span>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setDeleteConfirmationInput("");
                setDeleteError(null);
                setIsDeleteModalOpen(true);
              }}
              className="h-9 px-4 text-xs font-semibold rounded-xl shrink-0 cursor-pointer"
            >
              <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
              <span>Excluir Minha Conta</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmação Rigorosa de Exclusão (LGPD) */}
      <Modal
        open={isDeleteModalOpen}
        onOpenChange={(open) => {
          if (isDeletingAccount) return;
          setIsDeleteModalOpen(open);
          if (!open) {
            setDeleteConfirmationInput("");
            setDeleteError(null);
          }
        }}
        title="Excluir Conta Definitivamente (LGPD)"
        description="Esta ação é irreversível e aciona o expurgo definitivo de todos os seus dados pessoais e financeiros (Art. 18, VI da LGPD)."
        size="sm"
      >
        <div className="space-y-4 pt-2">
          {deleteError ? <Alert variant="error">{deleteError}</Alert> : null}

          <div className="rounded-xl border border-critical/20 bg-critical/5 p-3.5 space-y-2">
            <span className="text-xs font-medium text-critical-strong flex items-center gap-1.5">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <span>Atenção: Ação Irreversível</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Em conformidade com a LGPD, todo o seu histórico financeiro, lançamentos,
              cartões, categorias, investimentos e preferências serão definitivamente
              destruídos. Qualquer assinatura ativa no gateway de pagamento será cancelada
              preventivamente.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="delete-account-security-confirm"
              className="text-xs font-semibold text-foreground block"
            >
              Para confirmar a exclusão, digite a palavra{" "}
              <span className="font-mono text-critical-strong font-bold select-all">
                {CONFIRM_DELETE_WORD}
              </span>{" "}
              abaixo:
            </label>
            <Input
              id="delete-account-security-confirm"
              type="text"
              value={deleteConfirmationInput}
              onChange={(e) => {
                setDeleteConfirmationInput(e.target.value);
                if (deleteError) setDeleteError(null);
              }}
              placeholder={CONFIRM_DELETE_WORD}
              disabled={isDeletingAccount}
              autoComplete="off"
              className="h-10 text-sm rounded-xl font-mono"
            />
            <span className="text-[11px] text-muted-foreground block">
              O botão de exclusão só será ativado quando a palavra for digitada exatamente igual.
            </span>
          </div>

          <ModalFooter className="mt-4 pt-3 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeletingAccount}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => { void handleDeleteAccount(); }}
              disabled={!isConfirmationValid || isDeletingAccount}
              className="h-9 px-4 text-xs font-semibold rounded-xl cursor-pointer"
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5 mr-1.5" aria-hidden="true" />
                  <span>Confirmar Exclusão</span>
                </>
              )}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {restoreWizardOpen && (
        <Suspense fallback={null}>
          <RestoreWizardDialog
            open={restoreWizardOpen}
            onOpenChange={setRestoreWizardOpen}
          />
        </Suspense>
      )}
    </div>
  );
}

