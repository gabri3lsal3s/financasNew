import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { LoadingScreen } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useUserAccess } from "@/state";

/**
 * Guarda de rota que garante que o usuário possui conta com status 'active' (§F43).
 * Redireciona usuários em 'pending_approval' para a tela de espera e
 * contas 'suspended' ou 'banned' para a tela de bloqueio.
 */
export function RequireActiveAccount({ children }: { children?: ReactNode } = {}) {
  const { session, loading: authLoading, mfaRequired, mfaVerified } = useAuth();
  const { isPendingApproval, isSuspended, isBanned, isLoading } = useUserAccess(session?.user?.id);

  if (authLoading || isLoading || !session?.user) {
    return <LoadingScreen />;
  }

  // Blindagem 2FA (Etapa 1.2): se a conta exige AAL2 e o desafio TOTP ainda não foi validado,
  // recusa a renderização de qualquer rota interna e retém o usuário na tela de desafio.
  if (mfaRequired && !mfaVerified) {
    return <Navigate to="/entrar?desafio=totp" replace />;
  }

  if (isPendingApproval) {
    return <Navigate to="/aprovacao-pendente" replace />;
  }

  if (isSuspended || isBanned) {
    return <Navigate to="/conta-suspensa" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
