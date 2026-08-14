import { getSupabase } from "@/data/client";
import { AppError, classifyError } from "@/services/errors";

/**
 * Auto-cura do perfil (F11): garante que a conta autenticada possui linha em
 * `profiles` (e preferências padrão). A FK `user_id → profiles(id)` rejeita
 * QUALQUER escrita (categorias, cartões, lançamentos, RPCs) quando o perfil
 * está ausente — contas órfãs do trigger de signup (0003) — e o erro cai no
 * rótulo genérico "Dados inválidos" do gateway.
 *
 * Best-effort e idempotente (`on conflict do nothing`): chamado 1x por sessão
 * pelo useAuth; falhas são silenciadas pelo chamador (a migração 0009 cobre o
 * banco; este fluxo cobre bancos ainda não migrados em runtime).
 */
export async function ensureOwnProfile(
  userId: string,
  email?: string | null,
  name?: string | null,
): Promise<void> {
  const supabase = getSupabase();

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, email: email || null, name: name || null },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (profileError) {
    const classified = classifyError(profileError);
    throw new AppError(classified.kind, classified.message, profileError);
  }

  // Preferências padrão (espelham os defaults do schema 0001) — o upsert
  // só insere quando a linha não existe (ignoreDuplicates).
  const { error: preferencesError } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        theme: "system",
        reminders_enabled: true,
        reminder_days_before_debt: 3,
        reminder_days_before_bill: 3,
        report_weights_enabled: true,
        max_sector_acoes: null,
        max_sector_fiis: null,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (preferencesError) {
    const classified = classifyError(preferencesError);
    throw new AppError(classified.kind, classified.message, preferencesError);
  }
}
