import { Sparkles, Zap, VolumeX, Check, RotateCcw } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
} from "@/components/ui";
import {
  PRESET_METADATA_LIST,
  type ExperiencePreset,
} from "@/domain/preferences";
import { cn } from "@/lib/utils";

export interface ExperiencePresetsCardProps {
  activePreset: ExperiencePreset;
  onSelectPreset: (preset: ExperiencePreset) => void;
}

export function ExperiencePresetsCard({
  activePreset,
  onSelectPreset,
}: ExperiencePresetsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Modo de Experiência do Aplicativo</span>
          </span>
          <Badge
            variant={activePreset === "custom" ? "warning" : "positive"}
            size="sm"
          >
            {activePreset === "custom" ? "Modo: Personalizado" : "Preset Ativo"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground sm:text-sm">
          Escolha como o aplicativo se comporta em animações, sons, vibrações e densidade em um único toque.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {PRESET_METADATA_LIST.map((preset) => {
            const isSelected = activePreset === preset.id;
            const Icon =
              preset.id === "dynamic" ? Sparkles : preset.id === "minimal" ? Zap : VolumeX;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset.id)}
                className={cn(
                  "flex flex-col items-start p-4 rounded-xl border text-left transition-all select-none cursor-pointer relative",
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                    : "border-border bg-surface hover:bg-surface-hover hover:border-border/80",
                )}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("size-4.5", isSelected ? "text-primary-strong" : "text-muted-foreground")} />
                    <span className="font-semibold text-sm text-foreground">{preset.title}</span>
                  </div>
                  {isSelected ? (
                    <Badge variant="positive" size="xs">
                      <Check className="size-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="muted" size="xs">
                      {preset.badgeLabel}
                    </Badge>
                  )}
                </div>

                <span className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  {preset.description}
                </span>

                <div className="mt-auto space-y-1.5 pt-2 border-t border-border/50 w-full">
                  {preset.highlights.map((h, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-primary/60 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {activePreset === "custom" && (
          <div className="flex items-center justify-between p-3 rounded-xl border border-warning-strong/30 bg-warning/5 text-xs text-foreground flex-wrap gap-2">
            <span>
              Você possui ajustes finos personalizados ativos.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectPreset("dynamic")}
              className="h-7 text-xs gap-1.5"
            >
              <RotateCcw className="size-3" />
              Restaurar Modo Padrão
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
