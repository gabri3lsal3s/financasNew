import { useParams } from "react-router";
import { sanitizeShareToken } from "@/domain/share/token";
import {
  FamilyInviteAcceptForm,
  FamilyInviteCreatorView,
  FamilyInviteGuestLanding,
  FamilyInviteLoadingView,
  FamilyInviteStatusCardView,
  FamilyInviteSwitchFamilyView,
  useFamilyInviteFlow,
} from "../components/invite";

export function FamilyInvitePage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = sanitizeShareToken(rawToken);
  const flow = useFamilyInviteFlow(token);

  if (flow.inviteLoading || (flow.authLoading && !flow.invite)) {
    return <FamilyInviteLoadingView />;
  }

  if (flow.inviteError || !flow.invite) {
    return (
      <FamilyInviteStatusCardView
        token={token}
        kind="not_found"
        hasSession={Boolean(flow.session?.user)}
        onNavigate={(path) => flow.navigate(path)}
      />
    );
  }

  if (flow.invite.status === "revoked") {
    return (
      <FamilyInviteStatusCardView
        token={token}
        kind="revoked"
        hasSession={Boolean(flow.session?.user)}
        onNavigate={(path) => flow.navigate(path)}
      />
    );
  }

  const isExpired =
    flow.invite.status === "expired" ||
    new Date(flow.invite.expires_at).getTime() <= flow.now;

  if (isExpired && flow.invite.status !== "accepted") {
    return (
      <FamilyInviteStatusCardView
        token={token}
        kind="expired"
        hasSession={Boolean(flow.session?.user)}
        onNavigate={(path) => flow.navigate(path)}
      />
    );
  }

  if (flow.invite.status === "accepted") {
    return (
      <FamilyInviteStatusCardView
        token={token}
        kind="accepted"
        hasSession={Boolean(flow.session?.user)}
        onNavigate={(path) => flow.navigate(path)}
      />
    );
  }

  if (flow.session?.user && flow.invite.invited_by === flow.session.user.id) {
    return (
      <FamilyInviteCreatorView
        token={token}
        familyName={flow.invite.family_name}
        canonicalInviteUrl={flow.canonicalInviteUrl}
        copiedLink={flow.copiedLink}
        onCopyLink={() => void flow.handleCopyLink()}
        onGoToFamily={() => flow.navigate("/familia")}
      />
    );
  }

  if (
    flow.myFamilyData?.family &&
    flow.myFamilyData.family.id === flow.invite.family_id
  ) {
    return (
      <FamilyInviteStatusCardView
        token={token}
        kind="same_family"
        familyName={flow.invite.family_name}
        hasSession={Boolean(flow.session?.user)}
        onNavigate={(path) => flow.navigate(path)}
      />
    );
  }

  if (
    flow.myFamilyData?.family &&
    flow.myFamilyData.family.id !== flow.invite.family_id
  ) {
    return (
      <FamilyInviteSwitchFamilyView
        token={token}
        currentFamilyName={flow.myFamilyData.family.name}
        invitedFamilyName={flow.invite.family_name}
        isSwitchModalOpen={flow.isSwitchModalOpen}
        onSwitchModalOpenChange={flow.setIsSwitchModalOpen}
        isSwitching={flow.switchPending}
        onConfirmSwitch={() => void flow.handleConfirmSwitchFamily()}
        onStayInCurrentFamily={() => flow.navigate("/familia")}
      />
    );
  }

  if (!flow.session?.user) {
    return (
      <FamilyInviteGuestLanding
        token={token ?? ""}
        inviterName={flow.invite.inviter_name}
        familyName={flow.invite.family_name}
      />
    );
  }

  return (
    <FamilyInviteAcceptForm
      token={token}
      inviterName={flow.invite.inviter_name}
      familyName={flow.invite.family_name}
      displayName={flow.displayName}
      onDisplayNameChange={flow.setDisplayName}
      pixKey={flow.pixKey}
      onPixKeyChange={flow.setPixKey}
      pixKeyType={flow.pixKeyType}
      onPixKeyTypeChange={flow.setPixKeyType}
      detectedPixType={flow.detectedPixType}
      pixValidationError={flow.pixValidationError}
      isAmbiguousCpfOrPhone={flow.isAmbiguousCpfOrPhone}
      hasInvalidPix={flow.hasInvalidPix}
      onQuickSelectKeyType={(t) => flow.setPixKeyType(t)}
      isPending={flow.acceptPending}
      onSubmit={() => void flow.handleAcceptInvite()}
    />
  );
}
