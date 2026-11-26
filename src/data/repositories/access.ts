import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { callRpc, getMyFeatures as getMyFeaturesRpc, unwrapRpc } from "@/data/rpc";
import { AppError, classifyError } from "@/services/errors";
import type { Profile } from "@/types";

/**
 * Consulta o perfil de segurança e acesso do usuário autenticado.
 */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await resolveQuery<Profile>(
    supabase
      .from("profiles")
      .select("id, name, email, role, status, approved_at, approved_by, suspended_reason, created_at")
      .eq("id", user.id)
      .maybeSingle(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data;
}

/**
 * Retorna o mapa de funcionalidades ativas/resolvidas para o usuário.
 */
export async function getMyFeatures(): Promise<Record<string, boolean>> {
  return await getMyFeaturesRpc();
}

/**
 * Valida se um código de convite é elegível para cadastro.
 */
export async function checkInviteEligibility(
  code: string,
  userEmail?: string,
): Promise<{ valid: boolean; reason?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, reason: "Código de convite não informado." };
  }

  return await unwrapRpc(
    callRpc("validate_access_invite", {
      p_code: cleanCode,
      p_email: userEmail?.trim().toLowerCase() ?? null,
    }),
  );
}
