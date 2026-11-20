import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface AppUpdateActionsProps {
  isNative: boolean;
  isChecking: boolean;
  isUpdatingPwa: boolean;
  hasEffectiveUpdate: boolean;
  showAndroidApkActions: boolean;
  onManualCheckUpdate: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  onDownloadApk: () => void;
  onOpenApkGuide: () => void;
}

export function AppUpdateActions({
  isNative,
  isChecking,
  isUpdatingPwa,
  hasEffectiveUpdate,
  showAndroidApkActions,
  onManualCheckUpdate,
  onInstallUpdate,
  onDownloadApk,
  onOpenApkGuide,
}: AppUpdateActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isChecking || isUpdatingPwa}
          onClick={() => {
            void onManualCheckUpdate();
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
              void onInstallUpdate();
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
              onClick={onDownloadApk}
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
              onClick={onOpenApkGuide}
              className="gap-1.5"
            >
              <span>Como instalar</span>
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
