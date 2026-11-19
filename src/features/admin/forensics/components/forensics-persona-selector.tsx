/**
 * Seletor e Executor de Personas Teóricas (forensics-persona-selector.tsx).
 *
 * Permite inspecionar as 8 golden seeds e disparar auditorias isoladas por cenário.
 */

import { Play, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ALL_PERSONAS } from "../core/personas";
import type { AuditModule } from "../core/types";
import { AUDIT_MODULE_LABELS } from "../core/types";

interface ForensicsPersonaSelectorProps {
  onRunPersona: (personaId?: string) => void;
  isRunning: boolean;
}

export function ForensicsPersonaSelector({
  onRunPersona,
  isRunning,
}: ForensicsPersonaSelectorProps) {
  return (
    <Card className="border-border/80 bg-surface shadow-xs w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <span>Fábrica de Personas Teóricas (Golden Seeds)</span>
          </CardTitle>
          <Button
            size="sm"
            onClick={() => onRunPersona()}
            disabled={isRunning}
            className="gap-2 cursor-pointer text-xs"
          >
            <Play className="size-3.5" aria-hidden="true" />
            <span>Executar Todas (8 Personas)</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cenários determinísticos em memória cobrindo todos os módulos matemáticos e contábeis do Axir.
        </p>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALL_PERSONAS.map((persona) => (
            <div
              key={persona.id}
              className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {persona.name}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    &lt; 15ms
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {persona.description}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                <div className="flex items-center gap-1 flex-wrap">
                  {persona.targetModules.map((mod) => (
                    <Badge key={mod} variant="muted" size="xs">
                      {AUDIT_MODULE_LABELS[mod as AuditModule] ?? mod}
                    </Badge>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRunPersona(persona.id)}
                  disabled={isRunning}
                  className="gap-1.5 text-[11px] h-7 px-2.5 cursor-pointer shrink-0"
                >
                  <Play className="size-3" aria-hidden="true" />
                  <span>Auditar</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
