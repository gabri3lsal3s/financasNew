import { getSupabase } from "@/data/client";
import { AppError } from "@/services/errors";

/** Id do usuário autenticado (para inserts com RLS `auth.uid() = user_id`). */
export async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) {
    throw new AppError("session-expired", "Sua sessão expirou. Entre novamente para continuar.", error);
  }
  return data.user.id;
}
