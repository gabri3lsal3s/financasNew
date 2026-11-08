import { SplitChargeCard, type SplitParticipantView } from "./split-charge-card";

export interface SplitPreviewMockupCardProps {
  className?: string;
  totalCents?: number;
  peopleCount?: number;
  description?: string;
  pixKey?: string;
  pixKeyType?: string;
  pixBrCode?: string;
  merchantName?: string;
  date?: string;
  participants?: SplitParticipantView[];
  defaultShowQrCode?: boolean;
  onCopyClick?: () => void;
  onShareClick?: () => void;
}

const DEFAULT_DEMO_PARTICIPANTS: SplitParticipantView[] = [
  { name: "Gabriel (Demonstração)", is_host: true, share_cents: 12000 },
  { name: "Lucas", is_host: false, share_cents: 12000 },
  { name: "Mateus", is_host: false, share_cents: 12000 },
  { name: "Ana", is_host: false, share_cents: 12000 },
];

/**
 * SplitPreviewMockupCard — Componente ilustrado de apresentação didática de Racha Pix (§Plano 11).
 *
 * Utiliza o componente canônico SplitChargeCard com valores demonstrativos pré-configurados,
 * garantindo 100% de paridade visual com o link real compartilhado (/r/:token).
 */
export function SplitPreviewMockupCard({
  className,
  totalCents = 48000,
  peopleCount = 4,
  description = "Churrasco de Confraternização",
  pixKey = "pix.demo@exemplo.com",
  pixKeyType = "E-mail",
  pixBrCode = "00020126580014BR.GOV.BCB.PIX0120pix.demo@exemplo.com5204000053039865406120.005802BR5922Gabriel Demonstrativo6009SAO PAULO62070503***6304D1A2",
  merchantName = "Gabriel (Demonstração)",
  date,
  participants,
  defaultShowQrCode = true,
  onCopyClick,
  onShareClick,
}: SplitPreviewMockupCardProps) {
  const shareCents = Math.round(totalCents / Math.max(1, peopleCount));

  const resolvedParticipants =
    participants ??
    (peopleCount === 4 && totalCents === 48000
      ? DEFAULT_DEMO_PARTICIPANTS
      : Array.from({ length: peopleCount }, (_, idx) => ({
          name: idx === 0 ? merchantName : `Participante ${idx + 1}`,
          is_host: idx === 0,
          share_cents: shareCents,
        })));

  return (
    <SplitChargeCard
      className={className}
      cardTourId="split-mockup-card"
      pixBoxTourId="split-mockup-pix-box"
      title={description}
      date={date}
      hostName={merchantName}
      peopleCount={peopleCount}
      totalCents={totalCents}
      guestShareCents={shareCents}
      pixBrCode={pixBrCode}
      pixKey={pixKey}
      pixKeyType={pixKeyType}
      participants={resolvedParticipants}
      isDemo={true}
      defaultShowQrCode={defaultShowQrCode}
      onCopyPix={onCopyClick}
      onShareClick={onShareClick}
    />
  );
}
