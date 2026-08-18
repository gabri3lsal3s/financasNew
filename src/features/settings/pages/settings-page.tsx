
import {
  Palette,
  Sparkles,
  Volume2,
  LayoutDashboard,
  User as UserIcon,
  Database,
  Check,
  Moon,
  Sun,
  Smartphone,
  Layers,
  VolumeX,
  EyeOff,
  Eye,
  LogOut,
  RotateCcw,
  Zap,
  Sliders,
  Bell,
  Monitor,
  PanelTop,
  Image as ImageIcon,
  Calculator,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Tabs,
  Badge,
  LivePulseBeacon,
  Checkbox,
  Select,
  NumberStepperInput,
} from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { useTheme } from "@/app/theme-provider";
import type { ThemePreference } from "@/app/theme-provider";
import { useDensity, setDensity } from "@/hooks/use-density";
import { usePrivacyMask, togglePrivacyMask } from "@/hooks/use-privacy-mask";
import {
  useVisualCustomization,
  type AccentTheme,
  type SurfaceStyle,
  type MotionLevel,
  type HeaderButtonsConfig,
  type DashboardWidgetsConfig,
} from "@/hooks/use-visual-customization";
import { playSound } from "@/services/audio-fx";
import { triggerHaptic } from "@/services/haptics";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/data/client";
import { cn } from "@/lib/utils";
import { ExportDataHub } from "@/components/modules";
import type { ExportCsvKind, ExportRange } from "@/components/modules";
import { fetchAllUserData, restoreBackup } from "@/data/repositories/export";
import { listAllCardPayments } from "@/data/repositories/card-payments";
import { listCreditCards } from "@/data/repositories/credit-cards";
import { listCategories } from "@/data/repositories/categories";
import { listExpensesByRange } from "@/data/repositories/expenses";
import { listIncomesByRange } from "@/data/repositories/incomes";
import { downloadCsv, downloadJson } from "@/services/export-actions";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { numberToCents } from "@/domain/money";
import { BACKUP_TABLE_KEYS, parseBackupPayload } from "@/domain/export";
import type { ExportExpenseRow, ExportIncomeRow, ExportInvoiceRow, ExportPositionRow, RestoreSummary } from "@/domain/export";
import { serializeExpensesCsv, serializeIncomesCsv, serializeInvoicesCsv, serializePositionsCsv } from "@/domain/export";
import { usePortfolioPosition, useUserPreferences, useUpdateReminderPreferences } from "@/state";
import { useSearchParams } from "react-router";
import { pushToast } from "@/services/toast";

const ACCENT_OPTIONS: { id: AccentTheme; label: string; bgClass: string; hex: string }[] = [
  { id: "teal", label: "Teal Vital (Oficial)", bgClass: "bg-[#2A9D8F]", hex: "#2A9D8F" },
  { id: "emerald", label: "Esmeralda Fintech", bgClass: "bg-[#10B981]", hex: "#10B981" },
  { id: "gold", label: "Ouro Âmbar", bgClass: "bg-[#DDA726]", hex: "#DDA726" },
  { id: "sapphire", label: "Safira Petróleo", bgClass: "bg-[#0284C7]", hex: "#0284C7" },
  { id: "violet", label: "Violeta Íris", bgClass: "bg-[#7C3AED]", hex: "#7C3AED" },
  { id: "rose", label: "Coral Rosé", bgClass: "bg-[#E11D48]", hex: "#E11D48" },
  { id: "mono", label: "Monocromático (P&B)", bgClass: "bg-foreground", hex: "#000000" },
];

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun; desc: string }[] = [
  { id: "light", label: "Claro", icon: Sun, desc: "Vital Petróleo & Ouro" },
  { id: "dark", label: "Escuro", icon: Moon, desc: "Abissal Teal" },
  { id: "oled", label: "OLED", icon: Smartphone, desc: "True Black + Alto Contraste P&B" },
  { id: "system", label: "Automático", icon: Sliders, desc: "Sincronizado ao sistema" },
];

const SURFACE_OPTIONS: { id: SurfaceStyle; label: string; desc: string }[] = [
  { id: "glass", label: "Glassmorphism", desc: "Translúcido com desfoque e reflexo de borda" },
  { id: "flat", label: "Minimalista Flat", desc: "Bordas nítidas sem sombras ou gradientes" },
  { id: "elevated", label: "Elevado 3D", desc: "Sombras em camadas com relevo sutil" },
];

const MOTION_OPTIONS: { id: MotionLevel; label: string; desc: string }[] = [
  { id: "fluid", label: "Cinemática / Fluida", desc: "Física spring, tickers animados e ripple tátil" },
  { id: "eco", label: "Econômica", desc: "Transições suaves em fade com menor consumo" },
  { id: "reduced", label: "Reduzida / A11y", desc: "Movimento mínimo para conforto visual e acessibilidade" },
];

const REMINDER_DAYS_OPTIONS: SelectOption[] = [
  { value: "0", label: "No vencimento" },
  { value: "1", label: "1 dia antes" },
  { value: "2", label: "2 dias antes" },
  { value: "3", label: "3 dias antes (padrão)" },
  { value: "5", label: "5 dias antes" },
  { value: "7", label: "7 dias antes" },
  { value: "10", label: "10 dias antes" },
  { value: "15", label: "15 dias antes" },
  { value: "30", label: "30 dias antes" },
];

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "aparencia";
  const handleTabChange = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };
  const { preference: themePref, setPreference: setThemePref } = useTheme();
  const density = useDensity();
  const privacyMasked = usePrivacyMask();
  const visual = useVisualCustomization();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const portfolioPosition = usePortfolioPosition();
  const preferencesQuery = useUserPreferences();
  const updatePreferencesMutation = useUpdateReminderPreferences();

  const remindersEnabled = preferencesQuery.data?.reminders_enabled ?? true;
  const billDaysBefore = preferencesQuery.data?.reminder_days_before_bill ?? 3;
  const debtDaysBefore = preferencesQuery.data?.reminder_days_before_debt ?? 3;

  const handleToggleReminders = (enabled: boolean) => {
    triggerHaptic("medium");
    updatePreferencesMutation.mutate({ remindersEnabled: enabled });
  };

  const handleUpdateBillDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updatePreferencesMutation.mutate({ reminderDaysBeforeBill: num });
    }
  };

  const handleUpdateDebtDays = (valStr: string) => {
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 0 && num <= 30) {
      updatePreferencesMutation.mutate({ reminderDaysBeforeDebt: num });
    }
  };

  const handleSelectTheme = (id: ThemePreference, label: string) => {
    triggerHaptic("light");
    setThemePref(id);
    pushToast({
      title: "Preferências salvas",
      description: `Tema alterado para ${label}.`,
      duration: 2200,
    });
  };

  const handleSelectAccent = (id: AccentTheme, label: string) => {
    triggerHaptic("light");
    visual.setAccent(id);
    pushToast({
      title: "Preferências salvas",
      description: `Cor de destaque alterada para ${label}.`,
      duration: 2200,
    });
  };

  const handleSelectSurfaceStyle = (id: SurfaceStyle, label: string) => {
    triggerHaptic("light");
    visual.setSurfaceStyle(id);
    pushToast({
      title: "Preferências salvas",
      description: `Estilo de superfícies alterado para ${label}.`,
      duration: 2200,
    });
  };

  const handleSelectDensity = (densityVal: "comfortable" | "compact", label: string) => {
    triggerHaptic("light");
    setDensity(densityVal);
    pushToast({
      title: "Preferências salvas",
      description: `Densidade da interface alterada para ${label}.`,
      duration: 2200,
    });
  };

  const handleToggleHeaderButton = (key: keyof HeaderButtonsConfig, label: string, nextChecked: boolean) => {
    triggerHaptic("light");
    visual.setHeaderButton(key, nextChecked);
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? `Atalho "${label}" adicionado ao cabeçalho.`
        : `Atalho "${label}" removido do cabeçalho.`,
      duration: 2200,
    });
  };

  const handleSelectMotionLevel = (id: MotionLevel, label: string) => {
    triggerHaptic("light");
    visual.setMotionLevel(id);
    pushToast({
      title: "Preferências salvas",
      description: `Animações alteradas para ${label}.`,
      duration: 2200,
    });
  };

  const handleToggleNumberTicker = (nextChecked: boolean) => {
    triggerHaptic("light");
    visual.setNumberTickerEnabled(nextChecked);
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? "Contagem numérica animada ativada."
        : "Contagem numérica animada desativada.",
      duration: 2200,
    });
  };

  const handleToggleSound = (nextChecked: boolean) => {
    triggerHaptic("light");
    visual.setSoundEnabled(nextChecked);
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? "Feedback sonoro ativado."
        : "Feedback sonoro desativado.",
      duration: 2200,
    });
  };

  const handleTogglePrivacy = () => {
    triggerHaptic("light");
    togglePrivacyMask();
    const nextMasked = !privacyMasked;
    pushToast({
      title: "Preferências salvas",
      description: nextMasked
        ? "Valores monetários ocultados (modo privacidade)."
        : "Valores monetários visíveis.",
      duration: 2200,
    });
  };

  const handleToggleDashboardWidget = (key: keyof DashboardWidgetsConfig, label: string, nextChecked: boolean) => {
    triggerHaptic("light");
    visual.setDashboardWidget(key, nextChecked);
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? `Widget "${label}" exibido no início.`
        : `Widget "${label}" ocultado do início.`,
      duration: 2200,
    });
  };

  const handleResetVisuals = () => {
    visual.resetToDefaults();
    setThemePref("system");
    setDensity("comfortable");
    triggerHaptic("light");
    pushToast({
      title: "Preferências redefinidas",
      description: "Todas as preferências visuais foram restauradas para os padrões.",
      duration: 2500,
    });
  };

  const handleTestSound = (type: "click" | "success" | "pop") => {
    triggerHaptic("medium");
    playSound(type, true);
  };

  // ---------------------------------------------------------------------
  // F22 — Hub de Exportação e Dados (JSON completo + CSVs + restauração)
  // ---------------------------------------------------------------------

  const handleExportJson = async (): Promise<void> => {
    const payload = await fetchAllUserData();
    downloadJson(`financas_backup_${new Date().toISOString().slice(0, 10)}.json`, payload);
  };

  const rangeStamp = (range: ExportRange): string =>
    `${range.start.slice(0, 10)}_a_${range.end.slice(0, 10)}`;

  const handleExportCsv = async (kind: ExportCsvKind, range: ExportRange): Promise<void> => {
    const stamp = rangeStamp(range);
    if (kind === "expenses") {
      const [rows, categories, cards] = await Promise.all([
        listExpensesByRange(range.start, range.end),
        listCategories(),
        listCreditCards(),
      ]);
      const categoryName = new Map(categories.map((c) => [c.id, c.name]));
      const cardName = new Map(cards.map((c) => [c.id, c.name]));
      const csvRows: ExportExpenseRow[] = rows.map((e) => ({
        date: e.date,
        description: e.description ?? "",
        categoryName: categoryName.get(e.category_id) ?? "Sem categoria",
        valueCents: numberToCents(e.value),
        reportValueCents: numberToCents(e.value * e.report_weight),
        paymentMethodLabel: PAYMENT_METHOD_LABELS[e.payment_method] ?? e.payment_method,
        cardName: e.card_id ? (cardName.get(e.card_id) ?? null) : null,
        installments: e.installments_total > 1 ? `${e.installment_number}/${e.installments_total}` : "—",
      }));
      downloadCsv(`despesas_${stamp}.csv`, serializeExpensesCsv(csvRows));
      return;
    }
    if (kind === "incomes") {
      const [rows, categories] = await Promise.all([
        listIncomesByRange(range.start, range.end),
        listCategories(),
      ]);
      const categoryName = new Map(categories.map((c) => [c.id, c.name]));
      const csvRows: ExportIncomeRow[] = rows.map((i) => ({
        date: i.date,
        description: i.description ?? "",
        categoryName: categoryName.get(i.category_id) ?? "Sem categoria",
        valueCents: numberToCents(i.value),
        reportValueCents: numberToCents(i.value * i.report_weight),
        receiveTypeLabel: RECEIVE_TYPE_LABELS[i.receive_type] ?? i.receive_type,
      }));
      downloadCsv(`receitas_${stamp}.csv`, serializeIncomesCsv(csvRows));
      return;
    }
    if (kind === "invoices") {
      const [payments, cards] = await Promise.all([listAllCardPayments(), listCreditCards()]);
      const cardName = new Map(cards.map((c) => [c.id, c.name]));
      const csvRows: ExportInvoiceRow[] = payments
        .filter((p) => p.date >= range.start && p.date < range.end)
        .map((p) => ({
          competenceMonth: p.competence_month,
          cardName: cardName.get(p.card_id) ?? "Cartão removido",
          amountCents: numberToCents(p.amount),
          date: p.date,
          note: p.note,
          isRefund: p.is_refund,
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
    await restoreBackup(validation.payload);
    await queryClient.invalidateQueries();
    triggerHaptic("medium");
    pushToast({
      title: "Dados restaurados com sucesso",
      description: "Seus dados foram importados e sincronizados.",
    });
  };

  const handleLogout = async () => {
    try {
      triggerHaptic("medium");
      void queryClient.cancelQueries();
      queryClient.clear();
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      queryClient.clear();
    }
  };

  const tabItems = [
    {
      value: "aparencia",
      label: "Aparência",
      icon: <Palette className="size-4" />,
      content: (
        <div className="space-y-6">
          {/* Seletor de Temas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Tema Visual</span>
                <Badge variant="muted" className="text-xs font-normal">
                  4 Modos
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEME_OPTIONS.map((t) => {
                  const Icon = t.icon;
                  const isSelected = themePref === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTheme(t.id, t.label)}
                      className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all select-none cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-hover hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <Icon className={`size-5 ${isSelected ? "text-primary-strong" : "text-muted-foreground"}`} />
                        {isSelected && <Check className="size-4 text-primary-strong" />}
                      </div>
                      <span className="font-semibold text-sm text-foreground">{t.label}</span>
                      <span className="text-xs text-muted-foreground mt-0.5">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Paleta de Acento / Accent Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Cor de Destaque (Accent)</span>
                <div className="flex items-center gap-1.5">
                  <LivePulseBeacon variant="primary" size="sm" />
                  <span className="text-xs text-muted-foreground">Tempo Real</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ACCENT_OPTIONS.map((a, idx) => {
                  const isSelected = visual.accent === a.id;
                  const isLastOdd = idx === ACCENT_OPTIONS.length - 1 && ACCENT_OPTIONS.length % 2 !== 0;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelectAccent(a.id, a.label)}
                      className={cn(
                        "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all select-none cursor-pointer min-w-0",
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                        isLastOdd && "col-span-2 sm:col-span-1",
                      )}
                    >
                      <span
                        className={`size-6 rounded-full shrink-0 shadow-sm ${a.bgClass} flex items-center justify-center border border-border/60`}
                      >
                        {isSelected && (
                          <Check
                            className={`size-3.5 ${a.id === "mono" ? "text-background" : "text-white"}`}
                          />
                        )}
                      </span>
                      <span className="font-medium text-sm text-foreground leading-tight truncate">
                        {a.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Estilo de Superfície */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span>Estilo de Superfícies & Cards</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SURFACE_OPTIONS.map((s) => {
                  const isSelected = visual.surfaceStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectSurfaceStyle(s.id, s.label)}
                      className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all select-none cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-hover hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-semibold text-sm text-foreground">{s.label}</span>
                        {isSelected && <Check className="size-4 text-primary-strong" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{s.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Densidade Visual */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Densidade da Interface</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleSelectDensity("comfortable", "Confortável")}
                className={`flex-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  density === "comfortable"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                    : "border-border bg-surface hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">Confortável (Padrão)</span>
                  {density === "comfortable" && <Check className="size-4 text-primary-strong" />}
                </div>
                <span className="text-xs text-muted-foreground">
                  Espaçamento relaxado, botões mais amplos e excelente legibilidade.
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectDensity("compact", "Compacta")}
                className={`flex-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  density === "compact"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                    : "border-border bg-surface hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">Compacta</span>
                  {density === "compact" && <Check className="size-4 text-primary-strong" />}
                </div>
                <span className="text-xs text-muted-foreground">
                  Maior quantidade de informações e lançamentos visíveis por tela.
                </span>
              </button>
            </CardContent>
          </Card>

          {/* Atalhos do Header */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PanelTop className="size-4 text-primary" />
                <span>Atalhos do Header</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* --- Logo (sem limite de slot) --- */}
              {(() => {
                const isChecked = visual.headerButtons.logo;
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleHeaderButton("logo", "Logo no Header", !isChecked)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleHeaderButton("logo", "Logo no Header", !isChecked);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                      isChecked
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <div className="flex items-center gap-3 pr-4 min-w-0">
                      <ImageIcon
                        className={cn("size-4 shrink-0", isChecked ? "text-primary" : "text-muted-foreground")}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground">Logo no Header</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Exibe a marca do aplicativo no cabeçalho em telas menores (mobile e tablet).
                        </div>
                      </div>
                    </div>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => handleToggleHeaderButton("logo", "Logo no Header", Boolean(checked))}
                      aria-label="Logo no Header"
                    />
                  </div>
                );
              })()}

              {/* --- Botões de ação com limite de 2 slots --- */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Botões de Ação
                  </span>
                  {(() => {
                    const activeSlots = [
                      visual.headerButtons.calculatorButton,
                      visual.headerButtons.themeToggle,
                      visual.headerButtons.privacyToggle,
                    ].filter(Boolean).length;
                    return (
                      <span className={cn(
                        "text-xs font-medium tabular-nums",
                        activeSlots >= 2 ? "text-warning-text" : "text-muted-foreground",
                      )}>
                        {activeSlots}/2 slots
                      </span>
                    );
                  })()}
                </div>

                {(
                  [
                    {
                      key: "calculatorButton" as const,
                      label: "Calculadora",
                      desc: "Exibe o botão de calculadora flutuante no cabeçalho.",
                      icon: Calculator,
                    },
                    {
                      key: "themeToggle" as const,
                      label: "Alternar Tema Rápido",
                      desc: "Adiciona o botão de troca de tema (Claro / Escuro / OLED / Sistema) direto no cabeçalho.",
                      icon: Monitor,
                    },
                    {
                      key: "privacyToggle" as const,
                      label: "Ocultar Valores (Privacidade)",
                      desc: "Adiciona o botão de ofuscamento de saldos e lançamentos ao cabeçalho. Atalho: tecla P.",
                      icon: Eye,
                    },
                  ] satisfies {
                    key: keyof HeaderButtonsConfig;
                    label: string;
                    desc: string;
                    icon: typeof Monitor;
                  }[]
                ).map((item) => {
                  const isChecked = visual.headerButtons[item.key];
                  const activeSlots = [
                    visual.headerButtons.calculatorButton,
                    visual.headerButtons.themeToggle,
                    visual.headerButtons.privacyToggle,
                  ].filter(Boolean).length;
                  const isDisabled = !isChecked && activeSlots >= 2;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      role="button"
                      tabIndex={isDisabled ? -1 : 0}
                      aria-disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        handleToggleHeaderButton(item.key, item.label, !isChecked);
                      }}
                      onKeyDown={(e) => {
                        if (isDisabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleToggleHeaderButton(item.key, item.label, !isChecked);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border transition-colors select-none",
                        isDisabled
                          ? "border-border bg-surface opacity-50 cursor-not-allowed"
                          : isChecked
                            ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                            : "border-border bg-surface hover:bg-surface-hover cursor-pointer",
                      )}
                    >
                      <div className="flex items-center gap-3 pr-4 min-w-0">
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            isChecked ? "text-primary" : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-foreground">{item.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {isDisabled ? "Limite de 2 atalhos de ação atingido." : item.desc}
                          </div>
                        </div>
                      </div>
                      <Checkbox
                        checked={isChecked}
                        disabled={isDisabled}
                        onCheckedChange={(checked) => {
                          if (!isDisabled) handleToggleHeaderButton(item.key, item.label, Boolean(checked));
                        }}
                        aria-label={item.label}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Nota sobre o comportamento das notificações */}
              <p className="text-xs text-muted-foreground px-0.5 leading-relaxed">
                O sino de notificações aparece automaticamente quando há lembretes pendentes e ocupa
                1 slot, deslocando temporariamente o botão de menor prioridade.
              </p>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "movimento",
      label: "Movimento",
      icon: <Sparkles className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="size-4 text-primary" />
                <span>Nível de Fluidez & Animações</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {MOTION_OPTIONS.map((m) => {
                  const isSelected = visual.motionLevel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectMotionLevel(m.id, m.label)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm"
                          : "border-border bg-surface hover:bg-surface-hover"
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm text-foreground">{m.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
                      </div>
                      {isSelected && <Check className="size-4 text-primary-strong shrink-0 ml-3" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Efeitos Individuais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleToggleNumberTicker(!visual.numberTickerEnabled)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleNumberTicker(!visual.numberTickerEnabled);
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                  visual.numberTickerEnabled
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="pr-4">
                  <div className="font-semibold text-sm text-foreground">
                    Contagem Numérica Animada (Number Ticker)
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Anima números e saldos ao carregar ou atualizar valores
                  </div>
                </div>
                <Checkbox
                  checked={visual.numberTickerEnabled}
                  onCheckedChange={(checked) => handleToggleNumberTicker(Boolean(checked))}
                  aria-label="Contagem Numérica Animada (Number Ticker)"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "sensorial",
      label: "Sensorial",
      icon: <Volume2 className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {visual.soundEnabled ? (
                    <Volume2 className="size-4 text-primary" />
                  ) : (
                    <VolumeX className="size-4 text-muted-foreground" />
                  )}
                  <span>Feedback Sonoro Sintetizado</span>
                </div>
                <Badge variant={visual.soundEnabled ? "positive" : "muted"}>
                  {visual.soundEnabled ? "Ativado" : "Desativado"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleToggleSound(!visual.soundEnabled)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleSound(!visual.soundEnabled);
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                  visual.soundEnabled
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="pr-4">
                  <div className="font-semibold text-sm text-foreground">
                    Sons de Interface Sutis
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Síntese ultraleve de áudio (Web Audio API) em cliques e confirmações.
                  </div>
                </div>
                <Checkbox
                  checked={visual.soundEnabled}
                  onCheckedChange={(checked) => handleToggleSound(Boolean(checked))}
                  aria-label="Sons de Interface Sutis"
                />
              </div>

              {/* Botões de Teste */}
              <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Testar Efeitos Sonoros
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => handleTestSound("click")}>
                    Micro-Clique
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleTestSound("pop")}>
                    Spring Pop
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleTestSound("success")}>
                    Sucesso
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <EyeOff className="size-4 text-primary" />
                <span>Modo de Privacidade</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                role="button"
                tabIndex={0}
                onClick={handleTogglePrivacy}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTogglePrivacy();
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                  privacyMasked
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="pr-4">
                  <div className="font-semibold text-sm text-foreground">
                    Ocultar Valores Monetários (Blur)
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Ofusca valores de saldos e lançamentos na tela para proteção em público.
                  </div>
                </div>
                <Checkbox
                  checked={privacyMasked}
                  onCheckedChange={handleTogglePrivacy}
                  aria-label="Ocultar Valores Monetários (Blur)"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Widgets Visíveis na Visão Geral</span>
                <span className="text-xs text-muted-foreground font-normal">Personalize seu Início</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "kpis" as const, label: "Resumo de Saldo & KPIs (com Sparklines)", desc: "Entradas, Saídas, Investimentos e Saldo Geral" },
                { key: "summary" as const, label: "Saldo Líquido de Contas & Poupança", desc: "A receber, a pagar, faturas abertas e taxa de poupança" },
                { key: "flow" as const, label: "Gráfico de Fluxo Diário", desc: "Curva acumulada de receitas versus despesas no mês" },
                { key: "donut" as const, label: "Distribuição por Categorias", desc: "Gráfico donut com os maiores destinos do seu dinheiro" },
                { key: "budgets" as const, label: "Acompanhamento de Orçamentos", desc: "Barras de consumo e limites por categoria" },
              ].map((w) => {
                const isChecked = visual.dashboardWidgets[w.key];
                return (
                  <div
                    key={w.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleDashboardWidget(w.key, w.label, !isChecked)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleDashboardWidget(w.key, w.label, !isChecked);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                      isChecked
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border bg-surface hover:bg-surface-hover",
                    )}
                  >
                    <div className="pr-4">
                      <div className="font-semibold text-sm text-foreground">{w.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{w.desc}</div>
                    </div>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => handleToggleDashboardWidget(w.key, w.label, Boolean(checked))}
                      aria-label={w.label}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "notificacoes",
      label: "Lembretes",
      icon: <Bell className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                <span className="min-w-0">Lembretes & Notificações Automáticas</span>
                <Badge variant={remindersEnabled ? "positive" : "muted"} className="shrink-0">
                  {remindersEnabled ? "Ativado" : "Desativado"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleToggleReminders(!remindersEnabled)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleReminders(!remindersEnabled);
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
                  remindersEnabled
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="pr-4">
                  <div className="font-semibold text-sm text-foreground">
                    Habilitar Lembretes no Aplicativo
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Calcula e exibe alertas de faturas de cartão e dívidas no sininho do header e na central de lembretes.
                  </div>
                </div>
                <Checkbox
                  checked={remindersEnabled}
                  onCheckedChange={handleToggleReminders}
                  aria-label="Habilitar Lembretes no Aplicativo"
                />
              </div>

              {remindersEnabled && (
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  {/* Card: Antecedência para Faturas */}
                  <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
                    <div>
                      <div className="font-semibold text-sm text-foreground">
                        Antecedência para Faturas de Cartão
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Momento em que a fatura em aberto entra no radar de atenção antes do vencimento.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Select
                        value={
                          REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                            ? String(billDaysBefore)
                            : "custom"
                        }
                        onValueChange={(val) => {
                          if (val !== "custom") {
                            handleUpdateBillDays(val);
                          }
                        }}
                        options={
                          REMINDER_DAYS_OPTIONS.some((o) => o.value === String(billDaysBefore))
                            ? REMINDER_DAYS_OPTIONS
                            : [...REMINDER_DAYS_OPTIONS, { value: "custom", label: `${billDaysBefore} dias (Personalizado)` }]
                        }
                        ariaLabel="Seletor de dias de antecedência para faturas"
                      />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs text-muted-foreground shrink-0">Ajuste fino (dias):</span>
                        <div className="w-full sm:w-40">
                          <NumberStepperInput
                            value={billDaysBefore}
                            onValueChange={handleUpdateBillDays}
                            min={0}
                            max={30}
                            step={1}
                            ariaLabel="Dias de antecedência para faturas"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card: Antecedência para Dívidas */}
                  <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
                    <div>
                      <div className="font-semibold text-sm text-foreground">
                        Antecedência para Dívidas
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prazo de antecedência para alertar sobre parcelas e empréstimos pendentes.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Select
                        value={
                          REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                            ? String(debtDaysBefore)
                            : "custom"
                        }
                        onValueChange={(val) => {
                          if (val !== "custom") {
                            handleUpdateDebtDays(val);
                          }
                        }}
                        options={
                          REMINDER_DAYS_OPTIONS.some((o) => o.value === String(debtDaysBefore))
                            ? REMINDER_DAYS_OPTIONS
                            : [...REMINDER_DAYS_OPTIONS, { value: "custom", label: `${debtDaysBefore} dias (Personalizado)` }]
                        }
                        ariaLabel="Seletor de dias de antecedência para dívidas"
                      />
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs text-muted-foreground shrink-0">Ajuste fino (dias):</span>
                        <div className="w-full sm:w-40">
                          <NumberStepperInput
                            value={debtDaysBefore}
                            onValueChange={handleUpdateDebtDays}
                            min={0}
                            max={30}
                            step={1}
                            ariaLabel="Dias de antecedência para dívidas"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "perfil",
      label: "Perfil",
      icon: <UserIcon className="size-4" />,
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conta do Usuário</CardTitle>
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
                    <LivePulseBeacon variant="positive" size="sm" />
                    <span className="text-xs font-medium text-positive-strong">Sessão Segura Ativa</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button variant="destructive" onClick={handleLogout} className="gap-2">
                  <LogOut className="size-4" />
                  <span>Sair da Conta</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      value: "dados",
      label: "Dados",
      icon: <Database className="size-4" />,
      content: (
        <div className="space-y-6">
          <ExportDataHub
            onExportJson={handleExportJson}
            onExportCsv={handleExportCsv}
            onRestore={handleRestoreFile}
            onConfirmRestore={handleConfirmRestore}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Restaurar Padrões Visuais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border bg-surface gap-3">
                <div>
                  <div className="font-semibold text-sm text-foreground">Redefinir personalização</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Volta temas, acentos, sons e animações para as configurações padrão de fábrica.
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetVisuals}
                  className="gap-2 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-4" />
                  <span>Redefinir</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl text-foreground">Configurações & Personalização</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie temas, paletas de acento, micro-interações e preferências do seu Guia Financeiro.
        </p>
      </header>

      <div className="pb-12">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          items={tabItems}
          variant="pills"
          className="w-full"
        />
      </div>
    </div>
  );
}
