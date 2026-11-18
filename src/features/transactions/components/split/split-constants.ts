import type { SelectOption } from "@/components/ui/select";
import type { SplitRemainderPolicy } from "@/domain/finance/split-math";
import type { Profile, SplitParticipantItem, SplitPreferences, SplitSharePayload } from "@/types";

export const PIX_KEY_OPTIONS: SelectOption[] = [
  { value: "auto", label: "Detecção automática" },
  { value: "cpf", label: "CPF" },
  { value: "phone", label: "Celular (+55)" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave Aleatória (EVP)" },
  { value: "cnpj", label: "CNPJ" },
];

export const REMAINDER_OPTIONS: SelectOption[] = [
  { value: "host", label: "Anfitrião absorve centavos (Pix uniforme)" },
  { value: "balanced", label: "Distribuir centavos entre os primeiros" },
];

export const QUICK_PEOPLE_COUNTS = [2, 3, 4, 5];

export interface PixDefaultsResolved {
  pixKey: string;
  keyType: string;
  merchantName: string;
  merchantCity: string;
  remainderPolicy: SplitRemainderPolicy;
}

/**
 * Resolve padrões de Pix e titular blindados contra vazamento de PII no Modo Simulação
 * e sem fallback fictício para contas reais.
 */
export function resolveDefaultPixDefaults(
  isSimulationActive: boolean,
  preferences: SplitPreferences,
  profile: Partial<Profile> | null | undefined,
): PixDefaultsResolved {
  if (isSimulationActive) {
    return {
      pixKey: "pix.demo@exemplo.com",
      keyType: preferences.pixKeyType || "auto",
      merchantName: "Gabriel (Demonstração)",
      merchantCity: "São Paulo",
      remainderPolicy: preferences.remainderPolicy || "host",
    };
  }
  return {
    pixKey: preferences.pixKey || profile?.cpf || profile?.email || "",
    keyType: preferences.pixKeyType || "auto",
    merchantName: preferences.merchantName || profile?.name || "Você",
    merchantCity: preferences.merchantCity || "São Paulo",
    remainderPolicy: preferences.remainderPolicy || "host",
  };
}

/** Reconstrói a lista inicial de participantes normalizada a partir do payload do racha. */
export function buildInitialSplitParticipants(payload: SplitSharePayload): SplitParticipantItem[] {
  const list = payload.participants ?? [];
  if (list.length > 0) {
    return list.map((p, i) => ({
      ...p,
      id: p.id || `p_${i + 1}`,
      is_settled: p.is_host ? true : Boolean(p.is_settled),
      settled_cents: p.is_host ? (p.settled_cents ?? p.share_cents) : (p.settled_cents ?? 0),
    }));
  }

  const count = payload.people_count || 2;
  const guestCents = payload.guest_share_cents || Math.round(payload.total_cents / count);
  const hostCents = payload.host_share_cents || guestCents;
  const result: SplitParticipantItem[] = [
    { id: "p_1", name: "Você (Anfitrião)", share_cents: hostCents, is_host: true, is_settled: true, settled_cents: hostCents },
  ];
  for (let i = 1; i < count; i++) {
    result.push({ id: `p_${i + 1}`, name: `Participante ${i + 1}`, share_cents: guestCents, is_host: false, is_settled: false, settled_cents: 0 });
  }
  return result;
}

