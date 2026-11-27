import { getSupabase } from "@/data/client";
import {
  registerDeviceSessionRpc,
  checkDeviceSessionRevokedRpc,
  revokeDeviceSessionRpc,
  revokeOtherDeviceSessionsRpc,
} from "@/data/rpc/auth-sessions";
import { AppError, classifyError } from "@/services/errors";
import type { DeviceRegistrationInput, UserDevice } from "@/types";

/**
 * Registra ou atualiza o dispositivo da sessão ativa do usuário.
 */
export async function registerDevice(input: DeviceRegistrationInput): Promise<UserDevice> {
  try {
    return await registerDeviceSessionRpc(input);
  } catch (err) {
    const classified = classifyError(err);
    throw new AppError(classified.kind, classified.message, err);
  }
}

/**
 * Retorna todos os dispositivos registrados do usuário autenticado ordenados por atividade recente.
 */
export async function getUserDevices(): Promise<UserDevice[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_devices")
    .select("*")
    .order("last_seen_at", { ascending: false });

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []) as unknown as UserDevice[];
}

/**
 * Consulta se um dispositivo específico foi revogado.
 * Invariante fail-open: em falhas de rede, offline ou ausência de resposta,
 * retorna `false` para nunca desconectar o usuário por instabilidade temporária.
 */
export async function checkDeviceRevoked(deviceId: string): Promise<boolean> {
  try {
    return await checkDeviceSessionRevokedRpc(deviceId);
  } catch {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("user_devices")
        .select("is_revoked")
        .eq("device_id", deviceId)
        .maybeSingle();

      if (error || !data) return false;
      return Boolean(data.is_revoked);
    } catch {
      return false;
    }
  }
}

/**
 * Marca um dispositivo como revogado.
 */
export async function revokeDevice(deviceRecordId: string): Promise<boolean> {
  try {
    return await revokeDeviceSessionRpc(deviceRecordId);
  } catch {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("user_devices")
      .update({ is_revoked: true, last_seen_at: new Date().toISOString() })
      .eq("id", deviceRecordId);

    if (error) {
      const classified = classifyError(error);
      throw new AppError(classified.kind, classified.message, error);
    }
    return true;
  }
}

/**
 * Marca todos os demais dispositivos do usuário como revogados, preservando o dispositivo atual.
 */
export async function revokeOtherDevices(currentDeviceId: string): Promise<number> {
  try {
    return await revokeOtherDeviceSessionsRpc(currentDeviceId);
  } catch {
    const supabase = getSupabase();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new AppError("session-expired", "Sessão expirada ao revogar outros dispositivos.");
    }

    const { data, error } = await supabase
      .from("user_devices")
      .update({ is_revoked: true, last_seen_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .neq("device_id", currentDeviceId)
      .eq("is_revoked", false)
      .select("id");

    if (error) {
      const classified = classifyError(error);
      throw new AppError(classified.kind, classified.message, error);
    }
    return data?.length ?? 0;
  }
}

/**
 * Exclui fisicamente o registro de um dispositivo desconectado.
 */
export async function deleteDevice(deviceRecordId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("user_devices")
    .delete()
    .eq("id", deviceRecordId);

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
