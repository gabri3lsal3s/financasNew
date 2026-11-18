import { useState } from "react";
import type { FormEvent } from "react";
import { ConfirmDialog } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useUpdateProfile, useUserAccess, useUserSubscription } from "@/state";
import { MfaModal } from "../mfa-modal";
import { AccountDetailsCard } from "./account/account-details-card";
import { AccountSessionsCard } from "./account/account-sessions-card";
import { ChangeEmailModal } from "./account/change-email-modal";
import { ProfileCredentialsCard } from "./account/profile-credentials-card";
import { ChangePasswordModal } from "./change-password-modal";

function formatAccountDate(dateString?: string | null): string {
  if (!dateString) return "Data indisponível";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getRoleLabel(role?: string): string {
  switch (role) {
    case "superadmin":
      return "Super Administrador";
    case "admin":
      return "Administrador";
    case "user":
    default:
      return "Membro";
  }
}

export function AccountTab() {
  const { user } = useAuth();
  const userAccess = useUserAccess();
  const subscription = useUserSubscription();
  const updateProfileMutation = useUpdateProfile();
  const { signOut } = useSignOut();

  const profile = userAccess.profile;
  const currentName = profile?.name ?? user?.user_metadata?.name ?? "";
  const [name, setName] = useState(currentName);
  const [isNameDirty, setIsNameDirty] = useState(false);
  const [prevInitialName, setPrevInitialName] = useState(currentName);

  if (currentName !== prevInitialName) {
    setPrevInitialName(currentName);
    if (!isNameDirty) {
      setName(currentName);
    }
  }

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);

  const isNameChanged = name.trim().length > 0 && name.trim() !== currentName.trim();

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id || !isNameChanged) return;

    try {
      await updateProfileMutation.mutateAsync({
        userId: user.id,
        name: name.trim(),
      });
      setIsNameDirty(false);
    } catch {
      // Erro e toast geridos pela mutation
    }
  };

  const handleCopyAccountId = async () => {
    if (!user?.id) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(user.id);
        setCopiedId(true);
        triggerSensory("selection");
        pushToast({
          title: "ID copiado",
          description: "Identificador da conta copiado para a área de transferência.",
          variant: "default",
        });
        setTimeout(() => setCopiedId(false), 2000);
      }
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível copiar",
        description: "Copie o identificador manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      pushToast({
        title: "Sessão encerrada",
        description: "Você foi desconectado com sucesso deste dispositivo.",
        variant: "default",
      });
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível sair",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  };

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    try {
      await signOut({ scope: "others" });
      triggerSensory("success");
      pushToast({
        title: "Outros acessos encerrados",
        description:
          "Todas as sessões ativas em outros navegadores ou aparelhos foram desconectadas com sucesso.",
        variant: "success",
      });
    } catch (err) {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível encerrar outras sessões",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSigningOutOthers(false);
    }
  };

  const accountCreatedAt = profile?.created_at ?? user?.created_at;

  return (
    <div className="space-y-6">
      <ProfileCredentialsCard
        roleLabel={getRoleLabel(userAccess.role)}
        name={name}
        email={user?.email || ""}
        isNameChanged={isNameChanged}
        isSavingProfile={updateProfileMutation.isPending}
        onNameChange={(val) => {
          setName(val);
          setIsNameDirty(true);
        }}
        onSaveProfile={(e) => {
          void handleSaveProfile(e);
        }}
        onOpenEmailModal={() => setIsEmailModalOpen(true)}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
      />

      <AccountDetailsCard
        userId={user?.id}
        copiedId={copiedId}
        accountCreatedLabel={formatAccountDate(accountCreatedAt)}
        isPro={subscription.isPro}
        isTrial={subscription.isTrial}
        trialDaysRemaining={subscription.trialDaysRemaining}
        onCopyAccountId={() => {
          void handleCopyAccountId();
        }}
      />

      <AccountSessionsCard
        isSigningOutOthers={isSigningOutOthers}
        onOpenSignOutModal={() => setIsSignOutModalOpen(true)}
        onSignOutOthers={() => {
          void handleSignOutOthers();
        }}
        onOpenMfaModal={() => setIsMfaModalOpen(true)}
      />

      <ChangeEmailModal
        open={isEmailModalOpen}
        currentEmail={user?.email}
        onOpenChange={setIsEmailModalOpen}
      />

      <ChangePasswordModal
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
      />

      <ConfirmDialog
        open={isSignOutModalOpen}
        onOpenChange={(open) => {
          if (!isSigningOut) setIsSignOutModalOpen(open);
        }}
        title="Encerrar Sessão"
        description="Tem certeza de que deseja sair da sua conta neste dispositivo?"
        confirmLabel="Confirmar Saída"
        cancelLabel="Cancelar"
        confirmPending={isSigningOut}
        onConfirm={() => {
          void handleSignOut();
        }}
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Ao sair, suas informações e lançamentos continuam seguros na sua conta da nuvem. Você poderá se autenticar novamente a qualquer momento com seu e-mail e senha.
        </p>
      </ConfirmDialog>

      <MfaModal open={isMfaModalOpen} onOpenChange={setIsMfaModalOpen} />
    </div>
  );
}
