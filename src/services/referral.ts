/**
 * Serviço de captura, armazenamento e persistência de indicações de afiliados B2B2C.
 *
 * Armazena a indicação em localStorage com validade de 30 dias (padrão de mercado para SaaS).
 */

const REFERRAL_STORAGE_KEY = "axis_referral_data_v1";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredReferralData {
  code: string;
  savedAt: number;
}

/**
 * Sanitiza o código de indicação permitindo apenas letras, números e hífens.
 */
export function sanitizeReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

/**
 * Captura parâmetro de indicação da URL atual (ex.: ?ref=AXIS-1234) e salva localmente.
 */
export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined" || !window.location) return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const candidate =
      params.get("ref") ||
      params.get("parceiro") ||
      params.get("afiliado") ||
      params.get("cupom");

    if (candidate) {
      const sanitized = sanitizeReferralCode(candidate);
      if (sanitized.length >= 3) {
        storeReferralCode(sanitized);
        return sanitized;
      }
    }
  } catch {
    // Falha silenciosa em ambientes restritos
  }

  return null;
}

/**
 * Armazena o código de indicação no localStorage.
 */
export function storeReferralCode(code: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    const data: StoredReferralData = {
      code: sanitizeReferralCode(code),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Local storage indisponível
  }
}

/**
 * Retorna o código de indicação salvo se ainda estiver dentro da janela de 30 dias.
 */
export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;

    const data: StoredReferralData = JSON.parse(raw);
    if (!data.code || !data.savedAt) return null;

    const elapsed = Date.now() - data.savedAt;
    if (elapsed > THIRTY_DAYS_MS) {
      clearStoredReferralCode();
      return null;
    }

    return data.code;
  } catch {
    return null;
  }
}

/**
 * Limpa o código de indicação após a atribuição ser concluída com sucesso.
 */
export function clearStoredReferralCode(): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Ignora erro
  }
}

/**
 * Monta o link canônico de indicação do parceiro.
 */
export function buildReferralLink(referralCode: string): string {
  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://app.axisfinance.com.br";

  return `${origin}/cadastrar?ref=${encodeURIComponent(referralCode)}`;
}
