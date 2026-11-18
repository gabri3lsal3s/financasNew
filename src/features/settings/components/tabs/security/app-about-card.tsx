import { useState } from "react";
import { Download, RefreshCw, Smartphone } from "lucide-react";
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
import { useAppUpdate } from "@/hooks/use-app-update";
import { cn } from "@/lib/utils";
import {
  AXIR_APK_DOWNLOAD_URL,
  AXIR_APK_FILENAME,
  AXIR_APP_VERSION,
  shouldOfferAndroidApk,
} from "@/services/native/app-links";
import { pushToast } from "@/services/toast";

export interface AppAboutCardProps {
  isNative: boolean;
}

export function AppAboutCard({ isNative }: AppAboutCardProps) {
  const { isChecking, hasUpdate, updateInfo, checkForUpdates, installUpdate } = useAppUpdate({
    autoCheck: false,
  });
  const [showApkGuide, setShowApkGuide] = useState(false);

  const showAndroidApkActions = isNative || shouldOfferAndroidApk();
  const activeApkUrl = updateInfo?.manifest?.apkUrl || AXIR_APK_DOWNLOAD_URL;
  const displayVersion = updateInfo?.manifest?.version || AXIR_APP_VERSION;
  const displayBuild = updateInfo?.manifest?.versionCode;

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

  const handleDownloadApk = () => {
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

  return (
    <>
      <Card data-tour="settings-platform-status">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Sobre o Aplicativo</span>
            </CardTitle>
            <Badge
              variant={isNative ? "positive" : "muted"}
              size="xs"
              className="self-start sm:self-auto"
            >
              {isNative ? "Android Nativo" : "Web / PWA"}
            </Badge>
          </div>
          <CardDescription>
            {showAndroidApkActions
              ? "Informações sobre a versão do sistema, download de instaladores e verificação de atualizações."
              : "Informações sobre a versão do sistema e verificação de atualizações."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-surface-raised/60">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground block">
                  Versão {displayVersion}
                </span>
                {displayBuild ? (
                  <Badge variant="default" size="xs">
                    Build {displayBuild}
                  </Badge>
                ) : null}
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
                onClick={() => {
                  void handleManualCheckUpdate();
                }}
                className="gap-1.5"
              >
                <RefreshCw
                  className={cn("size-3.5 text-muted-foreground", isChecking && "animate-spin text-primary")}
                  aria-hidden="true"
                />
                <span>{isChecking ? "Verificando..." : "Verificar atualizações"}</span>
              </Button>
              {hasUpdate ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => {
                    void handleInstallUpdate();
                  }}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>Atualizar agora</span>
                </Button>
              ) : null}
              {showAndroidApkActions ? (
                <>
                  <Button
                    type="button"
                    variant={hasUpdate ? "outline" : "default"}
                    size="sm"
                    onClick={handleDownloadApk}
                    className="gap-1.5"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
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
