import { PrivacyScreen } from "@capacitor-community/privacy-screen";
import { isNativePlatform } from "./platform";

/**
 * Ativa o escudo de privacidade (FLAG_SECURE no Android),
 * bloqueando capturas de tela e ocultando miniaturas confidenciais no alternador de apps recentes.
 */
export async function enablePrivacyShield(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await PrivacyScreen.enable();
  } catch {
    // Falha silenciosa em navegadores de teste ou ambientes restritos
  }
}

/**
 * Desativa o escudo de privacidade.
 */
export async function disablePrivacyShield(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await PrivacyScreen.disable();
  } catch {
    // Falha silenciosa em navegadores de teste ou ambientes restritos
  }
}
