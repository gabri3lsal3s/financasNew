import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeftRight,
  BookOpen,
  Boxes,
  Briefcase,
  Plus,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  MoneyText,
  Skeleton,
} from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import {
  CashCheckpointDialog,
  KpiCard,
  KpiGrid,
  MonthPicker,
  ReadOnlyBanner,
} from "@/components/modules";
import {
  calculateBusinessBreakEven,
  calculateBusinessDre,
  calculateMeiAnnualLimit,
  calculateTaxShield,
  DEFAULT_MEI_ANNUAL_CEILING_CENTS,
  DEFAULT_MEI_MONTHLY_DAS_CENTS,
  DEFAULT_TAX_PROVISION_RATE_PCT,
  filterDebtsByViewScope,
  filterExpensesByViewScope,
  filterIncomesByViewScope,
} from "@/domain/business";
import { CATEGORY_KIT_BUSINESS } from "@/domain/budgets";
import { todayISO } from "@/domain/debts";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { currentMonth, monthLabel } from "@/lib/date";
import { BUSINESS_PROFILE_LABELS } from "@/lib/labels";
import { getErrorMessage } from "@/services/errors";
import {
  useBusinessMode,
  useCategories,
  useDebts,
  useExpenses,
  useIncomes,
  useIncomesByRange,
  useInstallCategoryKit,
  useRealCashBalance,
} from "@/state";
import { ExpenseDetailDialog } from "@/features/transactions/components/expense-detail-dialog";
import { IncomeDetailDialog } from "@/features/transactions/components/income-detail-dialog";
import { ExpenseRow, IncomeRow } from "@/features/transactions/components/list/transaction-feed-rows";
import { LaunchWizard } from "@/features/transactions/wizard/launch-wizard";
import type { BusinessProfileKind, BusinessProfileSettings, Expense, Income } from "@/types";
import { BreakEvenCard } from "../components/break-even-card";
import { BusinessDreCard } from "../components/business-dre-card";
import { BusinessOnboardingEmptyView } from "../components/business-onboarding-empty-view";
import { BusinessProfileDialog } from "../components/business-profile-dialog";
import { EducationalGuideModal } from "../components/educational-guide-modal";
import { InternalTransferDialog } from "../components/internal-transfer-dialog";
import { MeiCeilingCard } from "../components/mei-ceiling-card";
import { TaxShieldCard } from "../components/tax-shield-card";

type CashflowFeedItem =
  | { kind: "expense"; date: string; created_at?: string; data: Expense }
  | { kind: "income"; date: string; created_at?: string; data: Income };

/** Página Meu Negócio (MEI / Autônomo) — gestão separada da esfera PJ em `/negocio`. */
export function BusinessPage() {
  const [onboardingGuideOpen, setOnboardingGuideOpen] = useState(false);
  const installCategoryKit = useInstallCategoryKit();
  const {
    isBusinessModeEnabled,
    businessProfile,
    toggleBusinessMode,
    updateBusinessProfile,
    isLoading: isPrefsLoading,
    isPending: isBusinessUpdating,
  } = useBusinessMode();

  const handleActivateBusinessMode = async (
    profileKind: BusinessProfileKind,
    suggestedSettings?: Partial<BusinessProfileSettings>,
  ) => {
    const defaultProfile: BusinessProfileSettings = {
      profileKind,
      monthlyDasCents: DEFAULT_MEI_MONTHLY_DAS_CENTS,
      taxProvisionRatePct: DEFAULT_TAX_PROVISION_RATE_PCT,
      targetProLaboreCents: 0,
      annualCeilingCents: DEFAULT_MEI_ANNUAL_CEILING_CENTS,
      onboardingCompleted: true,
      ...suggestedSettings,
    };
    await toggleBusinessMode(true);
    await updateBusinessProfile(defaultProfile);
    try {
      await installCategoryKit.mutateAsync(CATEGORY_KIT_BUSINESS.items.slice(0, 3));
    } catch {
      // Falha silenciosa de instalação de categorias de negócio não bloqueia ativação
    }
  };

  if (isPrefsLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Meu Negócio" description="Gestão PF vs PJ para MEI, autônomos e liberais" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isBusinessModeEnabled) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Meu Negócio"
          description="Separe faturamento, custos operacionais e pró-labore das finanças pessoais"
        />
        <BusinessOnboardingEmptyView
          isPending={isBusinessUpdating}
          onActivate={handleActivateBusinessMode}
          onOpenGuide={() => setOnboardingGuideOpen(true)}
        />
        <EducationalGuideModal
          open={onboardingGuideOpen}
          onOpenChange={setOnboardingGuideOpen}
          onSelectProfile={async (kind, suggestedSettings) => {
            await handleActivateBusinessMode(kind, suggestedSettings);
          }}
        />
      </div>
    );
  }

  return (
    <BusinessDashboardContent
      businessProfile={businessProfile}
      isUpdatingProfile={isBusinessUpdating}
      onUpdateProfile={updateBusinessProfile}
    />
  );
}

interface BusinessDashboardContentProps {
  businessProfile: BusinessProfileSettings | undefined;
  isUpdatingProfile: boolean;
  onUpdateProfile: (next: BusinessProfileSettings) => Promise<void>;
}

function BusinessDashboardContent({
  businessProfile,
  isUpdatingProfile,
  onUpdateProfile,
}: BusinessDashboardContentProps) {
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const { isPlaybookVisible } = useVisualCustomization();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);

  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({
    moduleKey: "transactions",
  });

  const effectiveProfile: BusinessProfileSettings = businessProfile ?? {
    profileKind: "mei",
    monthlyDasCents: DEFAULT_MEI_MONTHLY_DAS_CENTS,
    taxProvisionRatePct: DEFAULT_TAX_PROVISION_RATE_PCT,
    targetProLaboreCents: 0,
    annualCeilingCents: DEFAULT_MEI_ANNUAL_CEILING_CENTS,
  };

  const selectedYear = Number(month.slice(0, 4)) || new Date().getFullYear();
  const selectedMonthIdx = Number(month.slice(5, 7)) || 1;
  const periodLabel = monthLabel(month);

  const expensesQuery = useExpenses(month);
  const incomesQuery = useIncomes(month);
  const annualIncomesQuery = useIncomesByRange(
    `${selectedYear}-01-01`,
    `${selectedYear + 1}-01-01`,
    { enabled: effectiveProfile.profileKind === "mei" },
  );
  const debtsQuery = useDebts();
  const categoriesQuery = useCategories();
  const businessCash = useRealCashBalance(todayISO(), { scopeOverride: "business" });

  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])),
    [categoriesQuery.data],
  );

  const businessDebts = useMemo(
    () => filterDebtsByViewScope(debtsQuery.data ?? [], "business"),
    [debtsQuery.data],
  );

  const dre = useMemo(
    () =>
      calculateBusinessDre({
        incomes: incomesQuery.data ?? [],
        expenses: expensesQuery.data ?? [],
        debts: businessDebts,
      }),
    [incomesQuery.data, expensesQuery.data, businessDebts],
  );

  const taxShield = useMemo(
    () =>
      calculateTaxShield({
        profileKind: effectiveProfile.profileKind,
        grossRevenueCents: dre.grossRevenueCents,
        expenses: expensesQuery.data ?? [],
        monthlyDasCents: effectiveProfile.monthlyDasCents,
        taxProvisionRatePct: effectiveProfile.taxProvisionRatePct,
      }),
    [
      effectiveProfile.profileKind,
      effectiveProfile.monthlyDasCents,
      effectiveProfile.taxProvisionRatePct,
      dre.grossRevenueCents,
      expensesQuery.data,
    ],
  );

  const breakEven = useMemo(
    () =>
      calculateBusinessBreakEven({
        operationalCostsCents: dre.operationalCostsCents,
        estimatedTaxCents: taxShield.estimatedTaxCents,
        targetProLaboreCents: effectiveProfile.targetProLaboreCents ?? 0,
        grossRevenueCents: dre.grossRevenueCents,
      }),
    [
      dre.operationalCostsCents,
      dre.grossRevenueCents,
      taxShield.estimatedTaxCents,
      effectiveProfile.targetProLaboreCents,
    ],
  );

  const meiLimit = useMemo(() => {
    if (effectiveProfile.profileKind !== "mei") return null;
    return calculateMeiAnnualLimit({
      annualIncomes: annualIncomesQuery.data ?? [],
      annualCeilingCents: effectiveProfile.annualCeilingCents,
      year: selectedYear,
      currentMonthIndex: selectedMonthIdx,
    });
  }, [
    effectiveProfile.profileKind,
    effectiveProfile.annualCeilingCents,
    annualIncomesQuery.data,
    selectedYear,
    selectedMonthIdx,
  ]);

  const cashflowFeed = useMemo<CashflowFeedItem[]>(() => {
    const pjExpenses = filterExpensesByViewScope(expensesQuery.data ?? [], "business", {
      mode: "cashflow",
    });
    const pjIncomes = filterIncomesByViewScope(incomesQuery.data ?? [], "business", {
      mode: "cashflow",
    });
    const combined: CashflowFeedItem[] = [
      ...pjExpenses.map((data) => ({
        kind: "expense" as const,
        date: data.date,
        created_at: data.created_at,
        data,
      })),
      ...pjIncomes.map((data) => ({
        kind: "income" as const,
        date: data.date,
        created_at: data.created_at,
        data,
      })),
    ];
    return combined.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [expensesQuery.data, incomesQuery.data]);

  const isLoading =
    expensesQuery.isLoading || incomesQuery.isLoading || businessCash.isLoading;
  const error =
    expensesQuery.error ?? incomesQuery.error ?? debtsQuery.error ?? businessCash.error;

  const pageTitle = effectiveProfile.businessName?.trim() || "Meu Negócio";
  const profileBadgeLabel = BUSINESS_PROFILE_LABELS[effectiveProfile.profileKind] ?? "PJ";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={pageTitle}
        description="Caixa isolado da operação PJ, DRE mensal e transferências PF/PJ"
        badge={
          <Badge variant="portfolio" size="sm">
            {profileBadgeLabel}
          </Badge>
        }
        actions={
          <>
            {isPlaybookVisible("business") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setGuideOpen(true)}
              >
                <BookOpen className="size-4" aria-hidden="true" />
                <span>Guia do Negócio</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => guardAction(() => setProfileOpen(true), "Configurar Negócio")}
            >
              <Settings2 className="size-4" aria-hidden="true" />
              <span>Configurar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => guardAction(() => setTransferOpen(true), "Transferência PF/PJ")}
            >
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              <span>Transferir PF/PJ</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 shadow-xs"
              onClick={() => guardAction(() => setWizardOpen(true), "Novo Lançamento PJ")}
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>Lançar PJ</span>
            </Button>
          </>
        }
      />

      {isReadOnlyMode ? <ReadOnlyBanner onActivatePro={() => guardAction(() => {}, "Meu Negócio")} /> : null}

      <MonthPicker value={month} onValueChange={setMonth} />

      {error ? (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => {
            void Promise.all([
              expensesQuery.refetch(),
              incomesQuery.refetch(),
              businessCash.refetch(),
            ]);
          }}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <KpiGrid columns={4}>
            <KpiCard
              label="Caixa Real PJ"
              cents={businessCash.cashBalance.currentBalanceCents}
              tone={businessCash.cashBalance.currentBalanceCents >= 0 ? "portfolio" : "negative"}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 px-1.5 text-[11px] gap-1"
                  onClick={() => guardAction(() => setCheckpointOpen(true), "Calibrar Caixa PJ")}
                >
                  <SlidersHorizontal className="size-3" aria-hidden="true" />
                  <span>Calibrar</span>
                </Button>
              }
              hint={
                businessCash.cashBalance.latestCheckpoint
                  ? `Âncora em ${businessCash.cashBalance.latestCheckpoint.date}`
                  : "Sem calibração PJ ainda"
              }
            />
            <KpiCard
              label="Faturamento Bruto (Mês)"
              cents={dre.grossRevenueCents}
              tone="positive"
              hint={
                dre.pendingReceivablesCents > 0
                  ? `${cashflowFeed.filter((i) => i.kind === "income").length} entrada(s) · c/ a receber`
                  : undefined
              }
            />
            <KpiCard
              label="Custos e Impostos PJ"
              cents={dre.operationalCostsCents + dre.fiscalTaxesPaidCents}
              tone="negative"
              hint={
                <span className="inline-flex items-center gap-1">
                  <span>Pró-labore retirado:</span>
                  <MoneyText
                    cents={dre.proLaboreWithdrawnCents}
                    tone="default"
                    variant="caption"
                    className="text-[11px]"
                  />
                </span>
              }
            />
            <KpiCard
              label="Lucro Retido PJ"
              cents={dre.retainedEarningsCents}
              tone={dre.retainedEarningsCents >= 0 ? "positive" : "negative"}
              hint="Após custos, impostos e retiradas"
            />
          </KpiGrid>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BusinessDreCard dre={dre} periodLabel={periodLabel} />
            <TaxShieldCard
              shield={taxShield}
              profileKind={effectiveProfile.profileKind}
              grossRevenueCents={dre.grossRevenueCents}
              periodLabel={periodLabel}
            />
            <BreakEvenCard
              breakEven={breakEven}
              operationalCostsCents={dre.operationalCostsCents}
              estimatedTaxCents={taxShield.estimatedTaxCents}
              targetProLaboreCents={effectiveProfile.targetProLaboreCents ?? 0}
              periodLabel={periodLabel}
            />
            {meiLimit ? (
              <MeiCeilingCard mei={meiLimit} yearLabel={String(selectedYear)} />
            ) : null}
          </div>

          <Card className="border-border/80 bg-surface shadow-xs">
            <CardHeader className="flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between pb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Briefcase className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm sm:text-base font-semibold">
                  Movimentações do Negócio ({periodLabel})
                </CardTitle>
              </div>
              <Badge variant="muted" size="xs">
                {cashflowFeed.length} registro{cashflowFeed.length === 1 ? "" : "s"}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {cashflowFeed.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Briefcase className="size-6" aria-hidden="true" />}
                    title="Sem movimentações PJ neste mês"
                    description="Registre uma venda, serviço, despesa do negócio ou transferência PF/PJ."
                    action={
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => guardAction(() => setWizardOpen(true), "Novo Lançamento PJ")}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                          <span>Novo lançamento PJ</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/orcamentos?tab=categories&kit=business")}
                        >
                          <Boxes className="size-4" aria-hidden="true" />
                          <span>Categorias de negócio</span>
                        </Button>
                      </div>
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-border/80">
                  {cashflowFeed.slice(0, 20).map((item) =>
                    item.kind === "expense" ? (
                      <ExpenseRow
                        key={`exp-${item.data.id}`}
                        expense={item.data}
                        category={categoryById.get(item.data.category_id)}
                        onClick={() => setSelectedExpense(item.data)}
                      />
                    ) : (
                      <IncomeRow
                        key={`inc-${item.data.id}`}
                        income={item.data}
                        category={categoryById.get(item.data.category_id)}
                        onClick={() => setSelectedIncome(item.data)}
                      />
                    ),
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <InternalTransferDialog open={transferOpen} onOpenChange={setTransferOpen} />

      <BusinessProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        profile={effectiveProfile}
        isSaving={isUpdatingProfile}
        onSave={onUpdateProfile}
        onOpenGuide={() => setGuideOpen(true)}
      />

      <EducationalGuideModal
        open={guideOpen}
        onOpenChange={setGuideOpen}
        onSelectProfile={async (kind, suggestedSettings) => {
          await onUpdateProfile({
            ...effectiveProfile,
            profileKind: kind,
            ...suggestedSettings,
          });
        }}
      />

      <CashCheckpointDialog
        open={checkpointOpen}
        onOpenChange={setCheckpointOpen}
        scope="business"
        currentBalanceCents={businessCash.cashBalance.currentBalanceCents}
        title="Calibrar Caixa do Negócio (PJ)"
        description="Informe o saldo real da conta bancária da sua empresa / MEI hoje. Isolado do seu saldo pessoal."
      />

      {wizardOpen ? (
        <LaunchWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          initialMode="quick"
          initialValues={{ scope: "business" }}
        />
      ) : null}

      <ExpenseDetailDialog
        expense={selectedExpense}
        open={selectedExpense !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedExpense(null);
        }}
      />

      <IncomeDetailDialog
        income={selectedIncome}
        open={selectedIncome !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedIncome(null);
        }}
      />

      {upgradeModal}
    </div>
  );
}
