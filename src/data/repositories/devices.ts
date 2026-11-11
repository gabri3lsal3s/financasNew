import { getSupabase } from "@/data/client";
import {
  registerDeviceSessionRpc,
  checkDeviceSessionRevokedRpc,
  revokeDeviceSessionRpc,
} from "@/data/rpc/auth-sessions";
import { AppError, classifyError } from "@/services/errors";
import type { DeviceRegistrationInput, UserDevice } from "@/types";

/**
 * Registra ou atualiza o dispositivo da sessão ativa do usuário.
 */
export async function registerDevice(input: DeviceRegistrationInput): Promise<UserDevice> {
  try {
    return await registerDeviceSessionRpc(input);
  } catch {
    const supabase = getSupabase();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new AppError("session-expired", "Sessão expirada ao registrar dispositivo.");
    }

    const { data, error } = await supabase
      .from("user_devices")
      .upsert(
        {
          user_id: user.id,
          device_id: input.deviceId,
          device_name: input.deviceName,
          browser: input.browser,
          os: input.os,
          ip_address: input.ipAddress ?? null,
          last_seen_at: new Date().toISOString(),
          is_revoked: false,
        },
        { onConflict: "user_id,device_id" },
      )
      .select()
      .single();

    if (error) {
      const classified = classifyError(error);
      throw new AppError(classified.kind, classified.message, error);
    }
    return data as unknown as UserDevice;
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
 */
export async function checkDeviceRevoked(deviceId: string): Promise<boolean> {
  try {
    return await checkDeviceSessionRevokedRpc(deviceId);
  } catch {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_devices")
      .select("is_revoked")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (error || !data) return false;
    return Boolean(data.is_revoked);
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
