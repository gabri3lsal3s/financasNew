import { callRpc, unwrapRpc } from "./client";
import type { DeviceRegistrationInput, UserDevice } from "@/types";

/**
 * Registra ou atualiza o dispositivo da sessão ativa via RPC seguro.
 */
export async function registerDeviceSessionRpc(
  input: DeviceRegistrationInput,
): Promise<UserDevice> {
  const promise = callRpc("register_device_session", {
    p_device_id: input.deviceId,
    p_device_name: input.deviceName,
    p_browser: input.browser,
    p_os: input.os,
    p_ip_address: input.ipAddress ?? null,
  });
  return unwrapRpc(promise);
}

/**
 * Consulta se a sessão do dispositivo informado foi revogada remotamente.
 */
export async function checkDeviceSessionRevokedRpc(
  deviceId: string,
): Promise<boolean> {
  const promise = callRpc("check_device_session_revoked", {
    p_device_id: deviceId,
  });
  return unwrapRpc(promise);
}

/**
 * Revoga a sessão de um dispositivo específico do usuário autenticado.
 */
export async function revokeDeviceSessionRpc(
  deviceRecordId: string,
): Promise<boolean> {
  const promise = callRpc("revoke_device_session", {
    p_device_record_id: deviceRecordId,
  });
  return unwrapRpc(promise);
}
