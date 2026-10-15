import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  LogOut,
  Database,
  Sparkles,
  Trash2,
  Fingerprint,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  ConfirmDialog,
  Checkbox,
  Select,
} from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { ExportDataHub } from "@/components/modules";
import type { ExportCsvKind, ExportRange } from "@/components/modules";
import { RestoreWizardDialog } from "../restore-wizard";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { downloadCsv, downloadJson } from "@/services/export-actions";
import { pushToast } from "@/services/toast";
import {
  checkBiometricsAvailability,
  authenticateWithBiometrics,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  getAppLockGraceMinutes,
  setAppLockGraceMinutes,
  isPrivacyShieldEnabled,
  setPrivacyShieldEnabled,
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
  useLoadDemoData,
  useClearDemoData,
  usePortfolioPosition,
  useUserAccess,
  useCategories,
  useCreditCards,
} from "@/state";
import { triggerSensory } from "@/services/sensory";

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
  const { user } = useAuth();
  const userAccess = useUserAccess();
  const { signOut } = useSignOut();

  // Estados de segurança nativa / app lock
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);
  const [biometryType, setBiometryType] = useState<string>("none");
  const [bioLockEnabled, setBioLockEnabled] = useState(() => isBiometricLockEnabled());
  const [graceMinutes, setGraceMinutes] = useState(() => String(getAppLockGraceMinutes()));
  const [privacyEnabled, setPrivacyEnabled] = useState(() => isPrivacyShieldEnabled());

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

  const handleTogglePrivacyShield = async (enabled: boolean) => {
    await setPrivacyShieldEnabled(enabled);
    setPrivacyEnabled(enabled);
    pushToast({
      title: enabled ? "Escudo de privacidade ativado" : "Escudo de privacidade desativado",
      description: enabled
        ? "Capturas de tela e miniaturas no alternador de tarefas foram bloqueadas."
        : "Capturas de tela foram reabilitadas.",
      variant: "default",
    });
  };

  const portfolioPosition = usePortfolioPosition();
  const exportDataQuery = useExportData({ enabled: false });
  const restoreBackupMutation = useRestoreBackup();
  const loadDemoMutation = useLoadDemoData();
  const clearDemoMutation = useClearDemoData();
  const [confirmClearDemoOpen, setConfirmClearDemoOpen] = useState(false);
  const [restoreWizardOpen, setRestoreWizardOpen] = useState(false);
  const categoriesQuery = useCategories();
  const creditCardsQuery = useCreditCards();

  const handleLogout = async () => {
    triggerSensory("action");
    await signOut();
  };

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
      {/* Card 1: Conta do Usuário & Sessão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Conta &amp; Sessão</span>
            </span>
            <Badge variant="muted" size="xs" className="font-mono uppercase">
              {userAccess.role}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30">
            <div className="size-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl shadow-md">
              {(user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground truncate text-base">
                {user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuário"}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant="positive" size="xs">
                  Sessão Ativa
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between gap-1">
              <span className="text-xs text-muted-foreground">Status da Conta</span>
              <span className="font-semibold text-sm text-positive-strong flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-positive inline-block" />
                Conta Ativa
              </span>
            </div>
            <div className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col justify-between gap-1">
              <span className="text-xs text-muted-foreground">E-mail Autenticado</span>
              <span className="font-semibold text-sm text-foreground truncate">
                {user?.email || "usuario@financas.app"}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/80 bg-surface text-xs text-muted-foreground leading-relaxed flex items-center gap-2.5">
            <Lock className="size-4 text-positive-strong shrink-0" />
            <span>
              Sua conta está protegida por isolamento Row-Level Security (RLS) e criptografia de ponta a ponta.
            </span>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="size-4" />
              <span>Sair da Conta</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Bloqueio do Aplicativo & Privacidade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Fingerprint className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Bloqueio do Aplicativo &amp; Privacidade</span>
            </span>
            {biometricsAvailable ? (
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
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

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

          <div className="pt-4 border-t border-border/80">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-surface">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong shrink-0">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <span>Ambiente de Demonstração</span>
                    <Badge variant="muted" size="xs">Dados de Teste</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Carregue um conjunto realista de transações, cartão e investimentos para explorar a plataforma, ou limpe os dados demonstrativos a qualquer momento.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadDemoMutation.mutate()}
                  disabled={loadDemoMutation.isPending}
                  className="gap-1.5 border-primary/40 hover:bg-primary/10 text-xs font-medium cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                  <span>{loadDemoMutation.isPending ? "Carregando…" : "Carregar dados de exemplo"}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClearDemoOpen(true)}
                  disabled={clearDemoMutation.isPending}
                  className="gap-1.5 border-warning/40 hover:bg-warning/10 text-xs font-medium cursor-pointer"
                >
                  <Trash2 className="size-3.5 text-warning-strong" aria-hidden="true" />
                  <span>{clearDemoMutation.isPending ? "Limpando…" : "Limpar dados de exemplo"}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmClearDemoOpen}
        onOpenChange={setConfirmClearDemoOpen}
        title="Limpar dados de exemplo?"
        description="Esta ação removerá cirurgicamente apenas os lançamentos, cartões e ativos de demonstração com a marca [Exemplo]. Qualquer dado real cadastrado por você permanecerá intacto."
        confirmLabel="Limpar dados"
        variant="destructive"
        onConfirm={async () => {
          await clearDemoMutation.mutateAsync();
          setConfirmClearDemoOpen(false);
        }}
      />

      <RestoreWizardDialog
        open={restoreWizardOpen}
        onOpenChange={setRestoreWizardOpen}
      />
    </div>
  );
}

