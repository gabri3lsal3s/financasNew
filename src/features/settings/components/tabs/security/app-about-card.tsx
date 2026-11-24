import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { ApkInstallGuideDialog } from "@/components/modules";
import {
  checkPWAUpdateManually,
  forceAppUpdate,
  getPWAUpdateAvailable,
  subscribePWAUpdate,
} from "@/app/pwa";
import { useAppUpdate } from "@/hooks/use-app-update";
import {
  AXIR_APK_DOWNLOAD_URL,
  AXIR_APK_FILENAME,
  AXIR_APP_VERSION,
  shouldOfferAndroidApk,
} from "@/services/native/app-links";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { AppUpdateActions } from "./app-update-actions";
import { AppVersionInfoBox } from "./app-version-info-box";

export interface AppAboutCardProps {
  isNative: boolean;
}

export function AppAboutCard({ isNative }: AppAboutCardProps) {
  const { isChecking, hasUpdate, updateInfo, checkForUpdates, installUpdate } = useAppUpdate({
    autoCheck: true,
  });
  const [showApkGuide, setShowApkGuide] = useState(false);
  const [pwaUpdateReady, setPwaUpdateReady] = useState(() => getPWAUpdateAvailable());
  const [isUpdatingPwa, setIsUpdatingPwa] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(() => new Date());

  useEffect(() => {
    return subscribePWAUpdate(() => {
      setPwaUpdateReady(getPWAUpdateAvailable());
    });
  }, []);

  const isPWA =
    !isNative &&
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  const platformLabel = isNative
    ? "Android Nativo"
    : isPWA
      ? "PWA Instalado"
      : "Web Online";

  const showAndroidApkActions = isNative || shouldOfferAndroidApk();
  const activeApkUrl = updateInfo?.manifest?.apkUrl || AXIR_APK_DOWNLOAD_URL;
  // A versão exibida é rigorosamente a versão local atualmente em execução
  const displayVersion = isNative
    ? (updateInfo?.currentVersion || AXIR_APP_VERSION)
    : AXIR_APP_VERSION;
  const displayBuild = isNative ? updateInfo?.currentVersionCode : undefined;

  // No nativo, depende do manifesto APK; no PWA/Web, depende do SW ou manifesto web
  const hasEffectiveUpdate = isNative ? hasUpdate : hasUpdate || pwaUpdateReady;

  const handleManualCheckUpdate = async () => {
    triggerSensory("action");
    let swHasUpdate = false;
    if (!isNative) {
      swHasUpdate = await checkPWAUpdateManually();
      if (swHasUpdate || getPWAUpdateAvailable()) {
        setPwaUpdateReady(true);
      }
    }

    const res = await checkForUpdates(false);
    setLastCheckedAt(new Date());

    const foundUpdate = isNative
      ? res.hasUpdate
      : res.hasUpdate || swHasUpdate || getPWAUpdateAvailable();

    if (foundUpdate) {
      pushToast({
        title: "Nova versão encontrada!",
        description: isNative
          ? `A versão ${res.latestVersion || "recente"} está disponível para atualização.`
          : "Uma nova versão do PWA está disponível para atualização imediata.",
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

  const handleDownloadApk = () => {
    triggerSensory("selection");
    try {
      const link = document.createElement("a");
      link.href = activeApkUrl;
      link.download = AXIR_APK_FILENAME;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      pushToast({
        title: "Download do APK iniciado",
        description: "O instalador do Android foi transferido para o seu aparelho.",
        variant: "info",
      });
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Falha ao baixar",
        description: "Não foi possível iniciar o download do APK.",
        variant: "destructive",
      });
    }
  };

  const handleInstallUpdate = async () => {
    triggerSensory("action");
    try {
      if (isNative) {
        await installUpdate();
        pushToast({
          title: "Atualização iniciada",
          description: "O instalador in-app foi acionado no dispositivo.",
          variant: "info",
        });
      } else {
        setIsUpdatingPwa(true);
        pushToast({
          title: "Atualizando aplicativo...",
          description: "Sincronizando arquivos da versão mais recente e recarregando...",
          variant: "info",
        });
        await forceAppUpdate({
          hardResetIfNoWorker: Boolean(hasUpdate && !getPWAUpdateAvailable()),
        });
      }
    } catch (err) {
      setIsUpdatingPwa(false);
      triggerSensory("error");
      pushToast({
        title: "Falha na atualização",
        description: err instanceof Error ? err.message : "Não foi possível atualizar automaticamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card data-tour="settings-platform-status" className="border-border/80 bg-surface shadow-xs rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Smartphone className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Sobre o Aplicativo</span>
            </CardTitle>
            <Badge
              variant={hasEffectiveUpdate ? "warning" : isNative ? "positive" : "muted"}
              size="sm"
              className="self-start sm:self-auto"
            >
              {hasEffectiveUpdate ? "Atualização disponível" : "Sistema atualizado"}
            </Badge>
          </div>
          <CardDescription>
            {showAndroidApkActions
              ? "Informações da versão instalada, download do APK e verificação de atualizações."
              : "Informações da versão instalada e verificação de atualizações do sistema."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AppVersionInfoBox
            displayVersion={displayVersion}
            displayBuild={displayBuild}
            platformLabel={platformLabel}
            isNative={isNative}
            isPWA={isPWA}
            hasEffectiveUpdate={hasEffectiveUpdate}
            latestVersion={updateInfo?.latestVersion}
            lastCheckedAt={lastCheckedAt}
          />

          <AppUpdateActions
            isNative={isNative}
            isChecking={isChecking}
            isUpdatingPwa={isUpdatingPwa}
            hasEffectiveUpdate={hasEffectiveUpdate}
            showAndroidApkActions={showAndroidApkActions}
            onManualCheckUpdate={handleManualCheckUpdate}
            onInstallUpdate={handleInstallUpdate}
            onDownloadApk={handleDownloadApk}
            onOpenApkGuide={() => setShowApkGuide(true)}
          />
        </CardContent>
      </Card>

      {showAndroidApkActions ? (
        <ApkInstallGuideDialog
          open={showApkGuide}
          onOpenChange={setShowApkGuide}
          onDownloadApk={handleDownloadApk}
          apkUrl={activeApkUrl}
        />
      ) : null}
    </>
  );
}
