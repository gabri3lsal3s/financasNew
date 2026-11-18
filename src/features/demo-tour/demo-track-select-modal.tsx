import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Button, Modal, ModalFooter, Tabs, type TabItem } from "@/components/ui";
import { triggerSensory } from "@/services/sensory";
import { isNativePlatform } from "@/services/native/platform";
import { getTourTrackMeta, type TourTrackId } from "@/domain/demo-simulation";
import { startDemo } from "@/state/demo-mode";
import {
  DEMO_TRACK_CATEGORIES,
  NATIVE_APK_TRACK,
} from "./demo-tracks-metadata";
import { TrackOptionCard } from "./track-option-card";

export interface DemoTrackSelectModalProps {
  /** Se o diálogo seletor de trilha está visível. */
  open: boolean;
  /** Callback acionado ao alterar a visibilidade do modal. */
  onOpenChange: (open: boolean) => void;
  /** Aba inicialmente ativa no hub de demonstração (padrão: "finances"). */
  defaultTab?: string;
  /** Callback opcional acionado quando o usuário seleciona e inicia uma trilha. */
  onSelectTrack?: (track: TourTrackId) => void;
  /** Callback opcional acionado quando o usuário decide pular a simulação e ir para a conta real. */
  onSkipToReal?: () => void;
}

/**
 * Hub de Tours Guiados e Demonstração Interativa (DemoTrackSelectModal).
 */
export function DemoTrackSelectModal({
  open,
  onOpenChange,
  defaultTab,
  onSelectTrack,
  onSkipToReal,
}: DemoTrackSelectModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? "finances");
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
    } else {
      navigate("/?novo=despesa");
    }
  }, [navigate, onOpenChange, onSkipToReal]);

  const tabItems: TabItem[] = useMemo(
    () =>
      DEMO_TRACK_CATEGORIES.map((category) => {
        const CategoryIcon = category.icon;
        return {
          value: category.value,
          label: category.label,
          shortLabel: category.shortLabel,
          icon: <CategoryIcon className={`size-4 ${category.iconClass}`} aria-hidden="true" />,
          content: (
            <div className="space-y-4 pt-3 pb-1">
              <TrackOptionCard track={category.primaryTrack} onSelect={handleSelectTrack} />

              {category.microTracks.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5 px-0.5">
                    <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Micro-Tours Específicos
                    </h5>
                    {category.microHeaderBadge ? (
                      <Badge variant="default" size="xs">
                        {category.microHeaderBadge}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {category.microTracks.map((track) => (
                      <TrackOptionCard key={track.id} track={track} onSelect={handleSelectTrack} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ),
        };
      }),
    [handleSelectTrack],
  );

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
      <div className="py-1">
        {isNative ? (
          <div className="mb-4">
            <TrackOptionCard track={NATIVE_APK_TRACK} onSelect={handleSelectTrack} />
          </div>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          variant="pills"
          forceMount={true}
          items={tabItems}
        />
      </div>
    </Modal>
  );
}
