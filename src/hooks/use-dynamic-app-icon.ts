import { useEffect } from "react";
import { setNativeAppIcon } from "@/services/native/app-icon";

/**
 * Sincroniza dinamicamente o ícone de abertura do app na gaveta de aplicativos
 * do Android com o status de assinatura Pro do usuário.
 *
 * - Usuários Pro (`isPro === true`): exibe a logo Âmbar/Dourada no Launcher.
 * - Usuários Gratuitos (`isPro === false`): exibe a logo Teal oficial no Launcher.
 */
export function useDynamicAppIcon(isPro: boolean): void {
  useEffect(() => {
    void setNativeAppIcon(isPro);
  }, [isPro]);
}
