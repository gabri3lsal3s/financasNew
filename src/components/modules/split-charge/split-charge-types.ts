import type { ReactNode } from "react";
import type { SplitParticipantInstallment } from "@/types";

export interface SplitParticipantView {
  id?: string;
  name: string;
  is_host?: boolean;
  share_cents: number;
}

export interface SplitChargeCardProps {
  className?: string;
  cardTourId?: string;
  pixBoxTourId?: string;
  title: string;
  date?: string;
  hostName: string;
  peopleCount: number;
  totalCents: number;
  guestShareCents?: number;
  pixBrCode?: string;
  pixKey?: string;
  pixKeyType?: string;
  participants?: SplitParticipantView[];
  isDemo?: boolean;
  defaultShowQrCode?: boolean;
  onCopyPix?: () => void;
  onCopyPixKey?: () => void;
  onShareClick?: () => void;
  installmentsCount?: number;
  installments?: SplitParticipantInstallment[];
  selectedInstallmentId?: string | null;
  onSelectInstallmentId?: (id: string | null) => void;
  isPayAllRemaining?: boolean;
  onTogglePayAllRemaining?: () => void;
  onSignalPayment?: () => void;
  isSignalingPayment?: boolean;
  hasSignaledCurrent?: boolean;
  /** ID do participante ativo identificado no racha */
  activeParticipantId?: string | null;
  /** Banner de identificação exibido acima dos detalhes do racha */
  identityBanner?: ReactNode;
  /** Modo de layout: "single-column" (coluna única) ou "split-desktop" (2 colunas no desktop) */
  layout?: "single-column" | "split-desktop";
  /** Conteúdo extra a ser injetado abaixo das informações no desktop (ex: banner de conversão/onboarding) */
  desktopExtraContent?: ReactNode;
}
