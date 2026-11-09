import { Bell } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { useUserPreferences } from "@/state";
import { RemindersPreferencesForm } from "@/features/reminders";

export function RemindersCard() {
  const preferencesQuery = useUserPreferences();
  const remindersEnabled = preferencesQuery.data?.reminders_enabled ?? true;

  return (
    <Card data-tour="settings-notifications-card" className="border-border/80 bg-surface shadow-xs">
      <CardHeader className="pb-3.5">
        <CardTitle className="text-base font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Lembretes &amp; Notificações</span>
          </span>
          <Badge variant={remindersEnabled ? "positive" : "muted"} size="xs">
            {remindersEnabled ? "Ativado" : "Desativado"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RemindersPreferencesForm />
      </CardContent>
    </Card>
  );
}
