import { useState } from "react";
import { Badge, Button, Select, Switch } from "@/components/ui";
import type { QuietHoursConfig } from "@/domain/notifications/schedule";
import { QUIET_HOURS_TIME_OPTIONS } from "../constants";

export interface QuietHoursPrefsCardProps {
  quietHours: QuietHoursConfig;
  onUpdateQuietHours: (patch: Partial<QuietHoursConfig>) => void;
}

export function QuietHoursPrefsCard({
  quietHours,
  onUpdateQuietHours,
}: QuietHoursPrefsCardProps) {
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  return (
    <div className="pt-2 border-t border-border/80 space-y-3">
      <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Horário Silencioso
              </span>
              <Badge variant={quietHours.enabled ? "default" : "muted"} size="xs">
                {quietHours.enabled
                  ? `${quietHours.start} – ${quietHours.end}`
                  : "Desativado"}
              </Badge>
              {quietHours.enabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  sensoryIntent="selection"
                  onClick={() => setIsEditingSchedule((prev) => !prev)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isEditingSchedule ? "Ocultar horários" : "Alterar horário"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Reagenda disparos locais e remotos não críticos para depois do intervalo noturno definido.
            </p>
          </div>
          <Switch
            checked={quietHours.enabled}
            onCheckedChange={(enabled) => {
              if (!enabled) setIsEditingSchedule(false);
              onUpdateQuietHours({ enabled });
            }}
            aria-label="Habilitar Horário Silencioso"
          />
        </div>

        {quietHours.enabled && isEditingSchedule && (
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground block">
                Início do silêncio
              </span>
              <Select
                value={quietHours.start}
                onValueChange={(start) => onUpdateQuietHours({ start })}
                options={QUIET_HOURS_TIME_OPTIONS}
                ariaLabel="Início do horário silencioso"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-foreground block">
                Fim do silêncio
              </span>
              <Select
                value={quietHours.end}
                onValueChange={(end) => onUpdateQuietHours({ end })}
                options={QUIET_HOURS_TIME_OPTIONS}
                ariaLabel="Fim do horário silencioso"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
