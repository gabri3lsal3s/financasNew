import { useState, useCallback, useEffect } from "react";
import { checkAppUpdate, triggerAppUpdate } from "@/services/native/update-checker";
import type { AppUpdateCheckResult, AppUpdateState } from "@/types/app-update";

export interface UseAppUpdateOptions {
  autoCheck?: boolean;
}

export interface UseAppUpdateReturn {
  status: AppUpdateState;
  isChecking: boolean;
  hasUpdate: boolean;
  updateInfo: AppUpdateCheckResult | null;
  error: string | null;
  checkForUpdates: (silent?: boolean) => Promise<AppUpdateCheckResult>;
  installUpdate: () => Promise<void>;
}

export function useAppUpdate(options?: UseAppUpdateOptions): UseAppUpdateReturn {
  const [status, setStatus] = useState<AppUpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<AppUpdateCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async (silent = false): Promise<AppUpdateCheckResult> => {
    if (!silent) {
      setStatus("checking");
    }
    setError(null);

    const result = await checkAppUpdate();
    setUpdateInfo(result);

    if (result.error) {
      setError(result.error);
      setStatus("error");
    } else if (result.hasUpdate) {
      setStatus("available");
    } else {
      setStatus("up-to-date");
    }

    return result;
  }, []);

  const installUpdate = useCallback(async (): Promise<void> => {
    if (!updateInfo?.manifest) {
      return;
    }

    try {
      setStatus("downloading");
      setError(null);
      await triggerAppUpdate(updateInfo.manifest);
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao iniciar atualização.";
      setError(message);
      setStatus("error");
    }
  }, [updateInfo]);

  useEffect(() => {
    let isCancelled = false;

    if (options?.autoCheck) {
      void checkAppUpdate().then((result) => {
        if (isCancelled) return;
        setUpdateInfo(result);
        if (result.error) {
          setError(result.error);
          setStatus("error");
        } else if (result.hasUpdate) {
          setStatus("available");
        } else {
          setStatus("up-to-date");
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [options?.autoCheck]);

  return {
    status,
    isChecking: status === "checking",
    hasUpdate: Boolean(updateInfo?.hasUpdate),
    updateInfo,
    error,
    checkForUpdates,
    installUpdate,
  };
}
