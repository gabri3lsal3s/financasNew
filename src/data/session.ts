import { getSupabase } from "@/data/client";
import { AppError } from "@/services/errors";

let inFlightUserIdPromise: Promise<string> | null = null;

/** Id do usuário autenticado (para inserts com RLS `auth.uid() = user_id`), coalescendo chamadas concorrentes. */
export async function currentUserId(): Promise<string> {
  if (!inFlightUserIdPromise) {
    inFlightUserIdPromise = getSupabase()
      .auth.getUser()
      .then(({ data, error }) => {
        if (error || !data.user) {
          throw new AppError("session-expired", "Sua sessão expirou. Entre novamente para continuar.", error);
        }
        return data.user.id;
      })
      .finally(() => {
        inFlightUserIdPromise = null;
      });
  }
  return inFlightUserIdPromise;
}
