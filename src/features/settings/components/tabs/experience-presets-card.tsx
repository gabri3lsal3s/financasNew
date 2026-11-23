import { Sparkles, Zap, VolumeX, Volume2, Vibrate, Check, RotateCcw } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Switch,
} from "@/components/ui";
import {
  PRESET_METADATA_LIST,
  type ExperiencePreset,
} from "@/domain/preferences";
import { cn } from "@/lib/utils";

export interface ExperiencePresetsCardProps {
  activePreset: ExperiencePreset;
  onSelectPreset: (preset: ExperiencePreset) => void;
  soundEnabled?: boolean;
  onToggleSound?: (enabled: boolean) => void;
  hapticEnabled?: boolean;
  onToggleHaptic?: (enabled: boolean) => void;
}

export function ExperiencePresetsCard({
  activePreset,
  onSelectPreset,
  soundEnabled = false,
  onToggleSound,
  hapticEnabled = true,
  onToggleHaptic,
}: ExperiencePresetsCardProps) {
  return (
    <Card data-tour="settings-experience-presets">
      <CardHeader>
        <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <span className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>Modo de Experiência do Aplicativo</span>
          </span>
          <Badge
            variant={activePreset === "custom" ? "warning" : "default"}
            size="sm"
            className="self-start sm:self-center shrink-0"
          >
            {activePreset === "custom" ? "Modo: Personalizado" : "Preset Ativo"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Escolha como o aplicativo se comporta em animações, sons, vibrações e densidade em um único toque.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {PRESET_METADATA_LIST.map((preset) => {
            const isSelected = activePreset === preset.id;
            const Icon =
              preset.id === "dynamic" ? Sparkles : preset.id === "minimal" ? Zap : VolumeX;

            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectPreset(preset.id)}
                className={cn(
                  "flex flex-col items-start p-4 rounded-xl border text-left transition-colors duration-150 select-none cursor-pointer relative focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-xs"
                    : "border-border/80 bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="flex items-center justify-between w-full mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={cn("size-4.5 shrink-0", isSelected ? "text-primary-strong" : "text-muted-foreground")}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-sm text-foreground">{preset.title}</span>
                  </div>
                  {isSelected ? (
                    <Badge variant="default" size="xs" className="shrink-0">
                      <Check className="size-3 mr-1" aria-hidden="true" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="muted" size="xs" className="shrink-0">
                      {preset.badgeLabel}
                    </Badge>
                  )}
                </div>

                <span className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  {preset.description}
                </span>

                <div className="mt-auto space-y-1.5 pt-2 border-t border-border/80 w-full">
                  {preset.highlights.map((h) => (
                    <div key={h} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-primary/60 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {(onToggleSound || onToggleHaptic) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {onToggleSound && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-raised p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Volume2 className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">Sons de interface</div>
                    <div className="text-[11px] text-muted-foreground">Micro-tons em cliques e confirmações</div>
                  </div>
                </div>
                <Switch
                  checked={soundEnabled}
                  onCheckedChange={onToggleSound}
                  aria-label="Sons de interface"
                />
              </div>
            )}

            {onToggleHaptic && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-raised p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Vibrate className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">Vibração tátil</div>
                    <div className="text-[11px] text-muted-foreground">Retorno háptico sutil em toques móveis</div>
                  </div>
                </div>
                <Switch
                  checked={hapticEnabled}
                  onCheckedChange={onToggleHaptic}
                  aria-label="Vibração tátil"
                />
              </div>
            )}
          </div>
        )}

        {activePreset === "custom" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-warning/30 bg-warning/10 text-xs text-foreground gap-2.5">
            <span>Você possui ajustes finos personalizados ativos.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectPreset("dynamic")}
              className="gap-1.5 self-start sm:self-center shrink-0"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Restaurar Modo Padrão
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
