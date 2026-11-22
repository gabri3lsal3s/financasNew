import { Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { RemindersPreferencesForm } from "@/features/reminders";

export function DevicePushCard() {
  return (
    <Card className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="pb-3.5">
        <CardTitle className="text-base font-semibold flex items-center gap-2 min-w-0">
          <Smartphone
            className="size-4 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <span>Notificações no Dispositivo</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RemindersPreferencesForm sections="device" />
      </CardContent>
    </Card>
  );
}
