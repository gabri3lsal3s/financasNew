import { useEffect, useState } from "react";
import { CheckCircle2, Download, RefreshCw, Smartphone, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { ApkInstallGuideDialog } from "@/components/modules";
import { forceAppUpdate, getPWAUpdateAvailable, subscribePWAUpdate } from "@/app/pwa";
import { useAppUpdate } from "@/hooks/use-app-update";
import { cn } from "@/lib/utils";
import {
  AXIR_APK_DOWNLOAD_URL,
  AXIR_APK_FILENAME,
  AXIR_APP_VERSION,
  shouldOfferAndroidApk,
} from "@/services/native/app-links";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

export interface AppAboutCardProps {
  isNative: boolean;
}

export function AppAboutCard({ isNative }: AppAboutCardProps) {
  const { isChecking, hasUpdate, updateInfo, checkForUpdates, installUpdate } = useAppUpdate({
    autoCheck: false,
  });
  const [showApkGuide, setShowApkGuide] = useState(false);
  const [pwaUpdateReady, setPwaUpdateReady] = useState(() => getPWAUpdateAvailable());
  const [isUpdatingPwa, setIsUpdatingPwa] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

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
  const displayVersion = updateInfo?.manifest?.version || AXIR_APP_VERSION;
  const displayBuild = updateInfo?.manifest?.versionCode;

  // No nativo, depende do manifesto APK; no PWA/Web, depende do SW ou manifesto web
  const hasEffectiveUpdate = isNative ? hasUpdate : hasUpdate || pwaUpdateReady;

  const handleManualCheckUpdate = async () => {
    triggerSensory("action");
    if (!isNative && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update();
        }
      } catch {
        // Fallback gracioso
      }
    }

    const res = await checkForUpdates(false);
    setLastCheckedAt(new Date());

    if (res.hasUpdate || pwaUpdateReady) {
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
        await forceAppUpdate();
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
          <div className="p-4 rounded-xl bg-surface-raised space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  Versão {displayVersion}
                </span>
                {displayBuild ? (
                  <Badge variant="muted" size="xs">
                    Build {displayBuild}
                  </Badge>
                ) : null}
                <Badge
                  variant={isNative ? "portfolio" : isPWA ? "default" : "muted"}
                  size="xs"
                >
                  {platformLabel}
                </Badge>
              </div>

              <div className="shrink-0">
                {hasEffectiveUpdate ? (
                  <div className="flex items-center gap-1.5 text-xs text-warning-strong font-medium">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    <span>
                      {updateInfo?.latestVersion
                        ? `v${updateInfo.latestVersion} pronta`
                        : "Nova versão pronta"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-positive-strong font-medium">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    <span>Versão mais recente</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground border-t border-border/80 pt-2.5">
              <span>
                {hasEffectiveUpdate
                  ? isNative
                    ? "Uma nova versão do instalador Android está pronta para instalação."
                    : "Uma nova versão do sistema Web/PWA está pronta para recarregamento."
                  : "Você está utilizando a versão estável mais recente do Axir."}
              </span>
              <span className="tabular-nums shrink-0">
                {lastCheckedAt
                  ? `Verificado às ${lastCheckedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                  : "Checagem automática ativa"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isChecking || isUpdatingPwa}
                onClick={() => {
                  void handleManualCheckUpdate();
                }}
                className="gap-1.5 w-full sm:w-auto"
                aria-label="Verificar atualizações"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5 text-muted-foreground",
                    (isChecking || isUpdatingPwa) && "animate-spin text-primary",
                  )}
                  aria-hidden="true"
                />
                <span>{isChecking || isUpdatingPwa ? "Verificando..." : "Verificar atualizações"}</span>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {hasEffectiveUpdate ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isUpdatingPwa}
                  onClick={() => {
                    void handleInstallUpdate();
                  }}
                  className="gap-1.5 shadow-xs"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>
                    {isUpdatingPwa
                      ? "Atualizando..."
                      : isNative
                        ? "Atualizar APK"
                        : "Atualizar PWA"}
                  </span>
                </Button>
              ) : null}

              {showAndroidApkActions ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadApk}
                    className="gap-1.5"
                    title="Baixar arquivo APK para instalação manual"
                  >
                    <Download className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>Baixar APK</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApkGuide(true)}
                    className="gap-1.5"
                  >
                    <span>Como instalar</span>
                  </Button>
                </>
              ) : null}
            </div>
          </div>
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
