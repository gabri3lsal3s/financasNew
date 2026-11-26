import { useState } from "react";
import { CalendarClock, HandCoins, ShieldAlert } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  ErrorState,
  FormField,
  RadioGroup,
  Skeleton,
  Switch,
} from "@/components/ui";
import {
  isAssetPendingDividendCalibration,
  isValidDividendTrackingDate,
  todaySaoPauloISO,
} from "@/domain/portfolio";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  usePortfolioAssets,
  useSetDividendTracking,
  useUpdateCustomSettings,
  useUserAccess,
  useUserPreferences,
} from "@/state";
import type {
  DividendAutomationPreferences,
} from "@/types";


/**
 * Configurações da Automação de Proventos da Carteira (§3.10 / Motor Bloco C).
 */
export function DividendAutomationCard() {
  const { hasFeature } = useUserAccess();
  const hasInvestmentsAccess = hasFeature("investments");
  const preferencesQuery = useUserPreferences();
  const updateCustomSettings = useUpdateCustomSettings();
  const setDividendTracking = useSetDividendTracking();
  const assetsQuery = usePortfolioAssets({ enabled: hasInvestmentsAccess });
  const [trackingDraftOverride, setTrackingDraftOverride] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  if (!hasInvestmentsAccess) {
    return null;
  }

  if (preferencesQuery.isLoading) {
    return (
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="pb-3.5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-52 rounded-md" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (preferencesQuery.isError) {
    return (
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <ErrorState
            message="Não foi possível carregar as preferências de automação de proventos."
            onRetry={() => void preferencesQuery.refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const current: DividendAutomationPreferences =
    preferencesQuery.data?.custom_settings?.dividendAutomation ?? {};
  const settlementMode = current.settlementMode ?? "manual_confirm";
  const autoCreditCash = current.autoCreditCash !== false;
  const notifyOnProvisioned = current.notifyOnProvisioned !== false;
  const notifyOnPayment = current.notifyOnPayment !== false;
  const savedTrackingStart =
    typeof current.trackingStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(current.trackingStartDate.trim())
      ? current.trackingStartDate.trim()
      : null;
  const trackingDraft = trackingDraftOverride ?? savedTrackingStart ?? "";
  const uncalibratedCount = (assetsQuery.data ?? []).filter(isAssetPendingDividendCalibration).length;
  const todayBr = todaySaoPauloISO();

  const updateField = (patch: Partial<DividendAutomationPreferences>) => {
    const today = todaySaoPauloISO();
    const nextSettlementMode = patch.settlementMode ?? settlementMode;
    const shouldStampActivation =
      (patch.settlementMode === "auto" && settlementMode !== "auto") ||
      (nextSettlementMode === "auto" && !current.activatedAt);

    updateCustomSettings.mutate({
      dividendAutomation: {
        settlementMode,
        autoCreditCash,
        notifyOnProvisioned,
        notifyOnPayment,
        activatedAt: shouldStampActivation ? today : current.activatedAt,
        trackingStartDate: savedTrackingStart,
        ...patch,
      },
    });
  };

  const handleSaveTrackingStart = async () => {
    setTrackingError(null);
    if (!trackingDraft || !isValidDividendTrackingDate(trackingDraft, todayBr)) {
      setTrackingError("Informe uma data válida entre 01/01/2000 e amanhã.");
      return;
    }
    try {
      await setDividendTracking.mutateAsync({
        trackingStartDate: trackingDraft,
        assets: [],
        expectedTrackingStartDate: savedTrackingStart,
        silent: false,
      });
      setTrackingDraftOverride(null);
    } catch {
      // O hook já dispara toast de erro; preserva o rascunho para nova tentativa
    }
  };

  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="pb-3.5">
        <CardTitle className="text-base font-semibold flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <HandCoins
              className="size-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <span>Proventos Automatizados (Carteira)</span>
          </span>
          <Badge
            variant={settlementMode === "auto" ? "portfolio" : "muted"}
            size="xs"
          >
            {settlementMode === "auto" ? "Liquidação Automática" : "Confirmar antes"}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-foreground">
            Modo de liquidação na Data de Pagamento
          </span>
          <RadioGroup
            variant="cards"
            value={settlementMode}
            disabled={updateCustomSettings.isPending}
            onValueChange={(next) =>
              updateField({
                settlementMode: next === "auto" ? "auto" : "manual_confirm",
              })
            }
            options={[
              {
                value: "manual_confirm",
                label: "Confirmar antes de lançar (Recomendado)",
                description:
                  "Provisiona na Data COM e coloca na fila para sua conferência no modal antes de lançar no extrato.",
              },
              {
                value: "auto",
                label: "Liquidar automaticamente na Data de Pagamento",
                description:
                  "Na manhã do pagamento, eventos verificados dentro da janela anti-flood são lançados no extrato e no Caixa sem cliques.",
              },
            ]}
          />
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3">
          <div className="flex items-start gap-2.5">
            <CalendarClock className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                Início do acompanhamento (Marco Zero)
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Define o primeiro dia (Data COM inclusiva) coberto pela automação de proventos. Independe da data de ativação da liquidação automática.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex-1 min-w-0">
              <FormField
                label="Início do acompanhamento (Data COM)"
                htmlFor="dividend-tracking-start-date"
                error={trackingError ?? undefined}
              >
                <DatePicker
                  id="dividend-tracking-start-date"
                  value={trackingDraft}
                  onValueChange={(next) => {
                    setTrackingDraftOverride(next);
                    if (trackingError) setTrackingError(null);
                  }}
                  placeholder="Selecionar Marco Zero"
                  ariaLabel="Início do acompanhamento (Marco Zero)"
                />
              </FormField>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={setDividendTracking.isPending}
              disabled={
                setDividendTracking.isPending ||
                !trackingDraft ||
                trackingDraft === (savedTrackingStart ?? "")
              }
              onClick={() => void handleSaveTrackingStart()}
            >
              Aplicar data de corte
            </Button>
          </div>

          {uncalibratedCount > 0 ? (
            <Alert variant="warning">
              {uncalibratedCount}{" "}
              {uncalibratedCount === 1
                ? "ativo com provento acumulado ainda precisa de data individual na Conferência de Proventos."
                : "ativos com proventos acumulados ainda precisam de data individual na Conferência de Proventos."}
            </Alert>
          ) : savedTrackingStart ? (
            <p className="text-[11px] text-muted-foreground">
              Piso global vigente: {formatDateBR(savedTrackingStart)}. Eventos automáticos abertos com Data COM anterior são zerados ao salvar.
            </p>
          ) : null}
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-surface-raised/50 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            Por segurança, eventos antigos anteriores à ativação (guarda Anti-Flood) e proventos do fallback Yahoo sem distinção entre Dividendo e JCP sempre exigem conferência manual.
          </p>
        </div>

        <div className="space-y-2.5">
          <div
            className={cn(
              "flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-colors",
              autoCreditCash ? "border-primary/40 bg-primary/5" : "border-border/80 bg-surface",
            )}
          >
            <div className="min-w-0">
              <span className="font-semibold text-xs sm:text-sm text-foreground">
                Creditar automaticamente no Caixa (CAIXA)
              </span>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Ativos em USD convertem o crédito de Caixa para BRL pela cotação oficial vigente no pagamento.
              </p>
            </div>
            <Switch
              checked={autoCreditCash}
              disabled={updateCustomSettings.isPending}
              onCheckedChange={(checked) => updateField({ autoCreditCash: Boolean(checked) })}
              aria-label="Creditar proventos no Caixa automaticamente"
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border/80 bg-surface">
            <div className="min-w-0">
              <span className="font-semibold text-xs sm:text-sm text-foreground">
                Avisar quando um provento for provisionado
              </span>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Notifica na Central e por push remoto quando um dividendo entrar na Data COM.
              </p>
            </div>
            <Switch
              checked={notifyOnProvisioned}
              disabled={updateCustomSettings.isPending}
              onCheckedChange={(checked) =>
                updateField({ notifyOnProvisioned: Boolean(checked) })
              }
              aria-label="Avisar quando um provento for provisionado"
            />
          </div>

          <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border/80 bg-surface">
            <div className="min-w-0">
              <span className="font-semibold text-xs sm:text-sm text-foreground">
                Avisar na confirmação ou liquidação de pagamento
              </span>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Notifica quando houver proventos disponíveis para conferência ou creditados automaticamente.
              </p>
            </div>
            <Switch
              checked={notifyOnPayment}
              disabled={updateCustomSettings.isPending}
              onCheckedChange={(checked) =>
                updateField({ notifyOnPayment: Boolean(checked) })
              }
              aria-label="Avisar na confirmação ou liquidação de pagamento"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
