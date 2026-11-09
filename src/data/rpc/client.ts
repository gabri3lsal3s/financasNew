import { getSupabase } from "@/data/client";
import { AppError, classifyError } from "@/services/errors";
import type { Database } from "@/types/database";

export type Functions = Database["public"]["Functions"];
export type FnArgs<K extends keyof Functions> = Functions[K]["Args"];
export type FnReturn<K extends keyof Functions> = Functions[K]["Returns"];

export type RpcResult<T> = { data: T | null; error: unknown };

/**
 * Chama um RPC com tipagem controlada pelo `Database` (fonte única).
 * O cast é necessário porque o overload genérico do supabase-js é frágil
 * com schemas grandes — os tipos reais vêm daqui, não da inferência dele.
 */
export function callRpc<K extends keyof Functions>(
  fn: K,
  args: FnArgs<K>,
): PromiseLike<RpcResult<FnReturn<K>>> {
  return getSupabase().rpc(fn, args as never) as unknown as PromiseLike<RpcResult<FnReturn<K>>>;
}

export async function unwrapRpc<T>(promise: PromiseLike<RpcResult<T>>, allowNull = false): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (data === null && !allowNull) {
    throw new AppError("unknown", "Resposta vazia do servidor.", null);
  }
  return data as T;
}
