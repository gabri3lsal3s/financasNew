import { useNavigate } from "react-router";
import { CreditCard, Download, Info, Zap } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { HOMOLOGATED_INSTITUTIONS } from "@/domain/notifications";
import { shouldOfferAndroidApk } from "@/services/native/app-links";
import { BankingAssistantOptions } from "./banking-assistant-options";
import { BankingCatalogAccordion } from "./banking-catalog-accordion";
import { InstalledBankingAppsSection } from "./installed-banking-apps-section";
import { ProminentDisclosureModal } from "./prominent-disclosure-modal";
import { useBankingAssistant } from "./use-banking-assistant";

export function BankingAssistantCard() {
  const navigate = useNavigate();
  const {
    isNative,
    isBankListenerAllowed,
    bankPrefs,
    listenerGranted,
    isDisclosureModalOpen,
    setIsDisclosureModalOpen,
    installedBanks,
    installedApps,
    isScanning,
    handleRescanBankingApps,
    handleTogglePassiveCapture,
    handleConfirmDisclosure,
    handleToggleInteractiveNotifications,
    handleToggleAutoInstallments,
    handleToggleAutoCategoryInference,
    handleSelectUnknownCategoryStrategy,
    handleToggleBank,
    handleSelectAllBanks,
    handleDeselectAllBanks,
    handleSelectOnlyInstalledBanks,
  } = useBankingAssistant();

  if (!isBankListenerAllowed) {
    return null;
  }

  // M10: em Web Desktop / iOS não exibimos propaganda de APK Android
  if (!isNative) {
    if (!shouldOfferAndroidApk()) {
      return null;
    }

    return (
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2 min-w-0">
              <CreditCard className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Assistente Passivo de Compras &amp; Bancos</span>
            </CardTitle>
            <Badge variant="default" size="xs" className="self-start sm:self-auto">
              Exclusivo no App Android
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-surface to-surface p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
                  <Zap className="size-3.5" aria-hidden="true" />
                  <span>Automação em Segundo Plano</span>
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  Leitura Automática de Comprovantes Pix e Notificações de Cartão
                </h4>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  Disponível através do Aplicativo Android Pro. Ele escuta notificações de {HOMOLOGATED_INSTITUTIONS.length} instituições financeiras e sugere o lançamento imediatamente com um único toque, com 100% de privacidade local no celular.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/configuracoes?tab=security")}
                  className="gap-2"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>Baixar App Pro</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2 min-w-0">
              <CreditCard className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Assistente Passivo de Compras &amp; Bancos</span>
            </CardTitle>
            <Badge
              variant={
                !bankPrefs.passiveCaptureEnabled
                  ? "muted"
                  : listenerGranted
                    ? "default"
                    : "warning"
              }
              size="xs"
              className="self-start sm:self-auto"
            >
              {!bankPrefs.passiveCaptureEnabled
                ? "Desativado"
                : listenerGranted
                  ? "Ativado"
                  : "Permissão Pendente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <BankingAssistantOptions
            bankPrefs={bankPrefs}
            listenerGranted={listenerGranted}
            onOpenDisclosure={() => setIsDisclosureModalOpen(true)}
            onTogglePassiveCapture={handleTogglePassiveCapture}
            onToggleInteractiveNotifications={handleToggleInteractiveNotifications}
            onToggleAutoInstallments={handleToggleAutoInstallments}
            onToggleAutoCategoryInference={handleToggleAutoCategoryInference}
            onSelectUnknownCategoryStrategy={handleSelectUnknownCategoryStrategy}
          />

          {bankPrefs.passiveCaptureEnabled ? (
            <>
              {listenerGranted && bankPrefs.monitoredBanks.length === 0 ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                  <Info
                    className="size-4 text-warning-strong shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground block">
                      Nenhuma instituição selecionada no momento
                    </span>
                    <span className="text-[11px] leading-relaxed">
                      Marque pelo menos um banco ou carteira abaixo para iniciar a captura automática no Android.
                    </span>
                  </div>
                </div>
              ) : null}

              <InstalledBankingAppsSection
                installedBanks={installedBanks}
                installedApps={installedApps}
                monitoredBanks={bankPrefs.monitoredBanks}
                isScanning={isScanning}
                onRescan={() => {
                  void handleRescanBankingApps();
                }}
                onSelectAllInstalled={handleSelectOnlyInstalledBanks}
                onToggleBank={handleToggleBank}
              />

              <BankingCatalogAccordion
                monitoredBanks={bankPrefs.monitoredBanks}
                installedBanks={installedBanks}
                installedApps={installedApps}
                onToggleBank={handleToggleBank}
                onSelectAll={handleSelectAllBanks}
                onDeselectAll={handleDeselectAllBanks}
              />
            </>
          ) : null}
        </CardContent>
      </Card>

      <ProminentDisclosureModal
        open={isDisclosureModalOpen}
        onOpenChange={setIsDisclosureModalOpen}
        onConfirm={() => {
          void handleConfirmDisclosure();
        }}
      />
    </>
  );
}
