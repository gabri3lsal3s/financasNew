import { useCallback } from "react";
import { useNavigate } from "react-router";
import { Compass } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Modal,
  ModalFooter,
} from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { isNativePlatform } from "@/services/native/platform";
import { getTourTrackMeta, type TourTrackId } from "@/domain/demo-simulation";
import { startDemo } from "@/state/demo-mode";
import {
  DEMO_TRACK_CATEGORIES,
  NATIVE_APK_TRACK,
  PRIMARY_DEMO_TRACKS,
  type TrackOptionMeta,
} from "./demo-tracks-metadata";
import { TrackOptionCard } from "./track-option-card";

export interface DemoTrackSelectModalProps {
  /** Se o diálogo seletor de trilha está visível. */
  open: boolean;
  /** Callback acionado ao alterar a visibilidade do modal. */
  onOpenChange: (open: boolean) => void;
  /** Mantido por compatibilidade de assinatura. */
  defaultTab?: string;
  /** Callback opcional acionado quando o usuário seleciona e inicia uma trilha. */
  onSelectTrack?: (track: TourTrackId) => void;
  /** Callback opcional acionado quando o usuário decide pular a simulação e ir para a conta real. */
  onSkipToReal?: () => void;
}

const SPECIFIC_MICRO_TRACKS: readonly TrackOptionMeta[] = [
  ...DEMO_TRACK_CATEGORIES.flatMap((category) => category.microTracks),
  DEMO_TRACK_CATEGORIES.find((c) => c.value === "settings")?.primaryTrack,
].filter((item): item is TrackOptionMeta => Boolean(item));

/**
 * Hub Simplificado de Tours Guiados e Demonstração Interativa (DemoTrackSelectModal).
 * Destaca 3 jornadas principais e recolhe os micro-tours específicos em Accordion.
 */
export function DemoTrackSelectModal({
  open,
  onOpenChange,
  onSelectTrack,
  onSkipToReal,
}: DemoTrackSelectModalProps) {
  const navigate = useNavigate();
  const isNative = isNativePlatform();

  const handleSelectTrack = useCallback(
    (track: TourTrackId) => {
      triggerSensory("action");
      startDemo(track);

      if (track === "investments") {
        navigate("/investments");
      } else {
        const meta = getTourTrackMeta(track);
        navigate(meta?.startRoute ?? "/");
      }

      onSelectTrack?.(track);
      onOpenChange(false);
    },
    [navigate, onOpenChange, onSelectTrack],
  );

  const handleSkip = useCallback(() => {
    onOpenChange(false);
    if (onSkipToReal) {
      onSkipToReal();
    }
  }, [onOpenChange, onSkipToReal]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Escolha sua Trilha de Demonstração"
      description="Explore os recursos do aplicativo com dados simulados em memória, sem alterar sua conta real."
      size="lg"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            Pular tour e ir para conta real
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4 py-1">
        {isNative ? (
          <TrackOptionCard track={NATIVE_APK_TRACK} onSelect={handleSelectTrack} />
        ) : null}

        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <Compass className="size-4 text-muted-foreground" aria-hidden="true" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Jornadas Guiadas Principais
            </h4>
          </div>
          <div className="space-y-2.5">
            {PRIMARY_DEMO_TRACKS.map((track) => (
              <TrackOptionCard key={track.id} track={track} onSelect={handleSelectTrack} />
            ))}
          </div>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="micro-tours" className="border-border/80 rounded-xl bg-surface-raised/40">
            <AccordionTrigger className="px-3.5 py-2.5 text-xs font-semibold text-foreground">
              Explorar por recurso específico ({SPECIFIC_MICRO_TRACKS.length} micro-tours)
            </AccordionTrigger>
            <AccordionContent className="px-3.5 pb-3.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SPECIFIC_MICRO_TRACKS.map((track) => (
                  <TrackOptionCard key={track.id} track={track} onSelect={handleSelectTrack} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Modal>
  );
}
