import { useState, useEffect } from "react";
import { Fingerprint, RefreshCw, Smartphone, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Checkbox,
  Select,
} from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { ExportDataHub, ApkInstallGuideDialog, PlatformsTriptychCard } from "@/components/modules";
import type { ExportCsvKind, ExportRange } from "@/components/modules";
import { downloadCsv } from "@/services/export-actions";
import { pushToast } from "@/services/toast";
import { DeleteAccountCard } from "./delete-account-card";
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
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { numberToCents } from "@/domain/money";
import type {
  ExportExpenseRow,
  ExportIncomeRow,
  ExportInvoiceRow,
  ExportPositionRow,
} from "@/domain/export";
import {
  serializeExpensesCsv,
  serializeIncomesCsv,
  serializeInvoicesCsv,
  serializePositionsCsv,
} from "@/domain/export";
import {
  useExportData,
  usePortfolioPosition,
  useUserAccess,
  useCategories,
  useCreditCards,
  useUserPreferences,
  useUpdateCustomSettings,
} from "@/state";
import { useDemoSession } from "@/state/demo-mode";
import { useAppUpdate } from "@/hooks/use-app-update";
import { cn } from "@/lib/utils";

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
  const userAccess = useUserAccess();
  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  // Estados de segurança nativa / app lock
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean | null>(null);
  const [biometryType, setBiometryType] = useState<string>("none");
  const [bioLockEnabled, setBioLockEnabled] = useState(() => isBiometricLockEnabled());
  const [graceMinutes, setGraceMinutes] = useState(() => String(getAppLockGraceMinutes()));
  const { isDemoActive } = useDemoSession();
  const isNative = isNativePlatform() || isDemoActive;
  const showBiometrics = isNative || Boolean(biometricsAvailable);
  const showPrivacyShield = isNative;
  const showAppLockCard = showBiometrics || showPrivacyShield;

  const [localPrivacyOverride, setLocalPrivacyOverride] = useState<boolean | null>(null);
  const cloudPrivacyShield = userPreferencesQuery.data?.custom_settings?.privacyShieldEnabled;
  const privacyEnabled =
    localPrivacyOverride !== null
      ? localPrivacyOverride
      : cloudPrivacyShield !== undefined
        ? cloudPrivacyShield
        : isPrivacyShieldEnabled();

  // Verificação de versão e atualizações do app
  const {
    isChecking,
    hasUpdate,
    updateInfo,
    checkForUpdates,
    installUpdate,
  } = useAppUpdate({ autoCheck: false });

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

  const handleManualCheckUpdate = async () => {
    const res = await checkForUpdates(false);
    if (res.hasUpdate) {
      pushToast({
        title: "Nova versão encontrada!",
        description: `A versão ${res.latestVersion} está disponível para atualização.`,
        variant: "info",
      });
    } else if (res.error) {
      pushToast({
        title: "Falha na verificação",
        description: res.error,
        variant: "destructive",
      });
    } else {
      pushToast({
        title: "Aplicativo atualizado",
        description: "Você já está na versão mais recente disponível.",
        variant: "success",
      });
    }
  };

  const [showApkGuide, setShowApkGuide] = useState(false);
  const defaultApkUrl = "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk";
  const activeApkUrl = updateInfo?.manifest?.apkUrl || defaultApkUrl;

  const handleDownloadApk = () => {
    try {
      const link = document.createElement("a");
      link.href = activeApkUrl;
      link.download = "axis-pro.apk";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      pushToast({
        title: "Download iniciado",
        description: "O download do instalador Android foi iniciado.",
        variant: "info",
      });
    } catch {
      pushToast({
        title: "Falha ao baixar",
        description: "Não foi possível iniciar o download do APK.",
        variant: "destructive",
      });
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await installUpdate();
      pushToast({
        title: "Atualização iniciada",
        description: "O instalador in-app foi acionado no dispositivo.",
        variant: "info",
      });
    } catch (err) {
      pushToast({
        title: "Falha na atualização",
        description: err instanceof Error ? err.message : "Não foi possível atualizar automaticamente.",
        variant: "destructive",
      });
    }
  };

  const portfolioPosition = usePortfolioPosition();
  const exportDataQuery = useExportData({ enabled: false });
  const categoriesQuery = useCategories();
  const creditCardsQuery = useCreditCards();

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

  return (
    <div className="space-y-6">
      {/* Card 1: Bloqueio do Aplicativo & Privacidade (Contextual para Nativo/Biometria) */}
      {showAppLockCard ? (
        <Card data-tour="settings-app-lock">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Fingerprint className="size-4 text-muted-foreground" aria-hidden="true" />
                <span>Bloqueio do Aplicativo &amp; Privacidade</span>
              </span>
              {showBiometrics ? (
                biometricsAvailable || isDemoActive ? (
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
      ) : null}

      {/* Card 2: Exportação de Dados Financeiros (Extratos CSV) */}
      <ExportDataHub
        csvOnly
        onExportCsv={handleExportCsv}
        availableCsvKinds={[
          ...(userAccess.hasFeature("transactions") ? (["expenses", "incomes"] as const) : []),
          ...(userAccess.hasFeature("cards") ? (["invoices"] as const) : []),
          ...(userAccess.hasFeature("investments") ? (["positions"] as const) : []),
        ]}
      />

      {/* Card 2.5: Comparativo do Tripé de Plataformas */}
      <PlatformsTriptychCard />


      {/* Card 3: Sobre o Aplicativo & Atualizações */}
      <Card data-tour="settings-platform-status" className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Smartphone className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Sobre o Aplicativo</span>
            </span>
            <Badge variant={isNative ? "positive" : "muted"} size="xs">
              {isNative ? "Android Nativo" : "Web / PWA"}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Informações sobre a versão do sistema, download de instaladores e verificação de atualizações.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground block">
                  {updateInfo?.manifest?.version ? `Versão ${updateInfo.manifest.version}` : "Versão 3.0.7"}
                </span>
                <Badge variant="default" size="xs">
                  Build {updateInfo?.manifest?.versionCode || 31}
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground block">
                {hasUpdate
                  ? `Nova versão ${updateInfo?.latestVersion} disponível para atualização imediata.`
                  : "Você está utilizando a versão estável mais recente do sistema."}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isChecking}
                onClick={handleManualCheckUpdate}
                className="h-8 px-3 text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
              >
                <RefreshCw
                  className={cn("size-3 text-muted-foreground", isChecking && "animate-spin text-primary")}
                  aria-hidden="true"
                />
                <span>{isChecking ? "Verificando..." : "Verificar atualizações"}</span>
              </Button>
              {hasUpdate && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleInstallUpdate}
                  className="h-8 px-3 text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
                >
                  <Download className="size-3 text-primary-foreground" aria-hidden="true" />
                  <span>Atualizar agora</span>
                </Button>
              )}
              <Button
                type="button"
                variant={hasUpdate ? "outline" : "default"}
                size="sm"
                onClick={handleDownloadApk}
                className="h-8 px-3 text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
              >
                <Download className="size-3" aria-hidden="true" />
                <span>Baixar APK</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowApkGuide(true)}
                className="h-8 px-3 text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
              >
                <span>Como instalar</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Zona de Perigo / Exclusão de Conta (LGPD) */}
      <DeleteAccountCard />

      {/* Modal interativo com guia de 3 passos e QR Code */}
      <ApkInstallGuideDialog
        open={showApkGuide}
        onOpenChange={setShowApkGuide}
        onDownloadApk={handleDownloadApk}
        apkUrl={activeApkUrl}
      />
    </div>
  );
}
