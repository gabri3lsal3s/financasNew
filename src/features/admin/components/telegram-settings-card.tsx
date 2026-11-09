import { Bot, Bell, GitBranch, Rocket, Activity, UserPlus, VolumeX } from "lucide-react";
import { Badge, Button, Skeleton } from "@/components/ui";
import {
  useAdminTelegramSettings,
  useUpdateTelegramSettingsMutation,
  type UpdateTelegramSettingsInput,
} from "@/state";

interface TelegramChannelToggle {
  key: keyof UpdateTelegramSettingsInput;
  label: string;
  description: string;
  icon: typeof Bell;
}

const CHANNELS: TelegramChannelToggle[] = [
  {
    key: "notify_support",
    label: "Chamados de Suporte & Dúvidas",
    description: "Notifica instantaneamente novos chamados abertos por usuários com link direto para resposta.",
    icon: Bell,
  },
  {
    key: "notify_git",
    label: "Commits & Push no Git",
    description: "Emite alertas sobre novos commits, pushs e branches sincronizadas no repositório.",
    icon: GitBranch,
  },
  {
    key: "notify_deploys",
    label: "Deploys & Releases de Produção",
    description: "Notifica quando um novo APK for compilado ou Edge Functions forem publicadas.",
    icon: Rocket,
  },
  {
    key: "notify_analytics",
    label: "Resumos de Telemetria & Uso",
    description: "Envia resumos consolidados semanais de módulos mais acessados e abertura do app.",
    icon: Activity,
  },
  {
    key: "notify_new_users",
    label: "Novos Cadastros de Clientes",
    description: "Notifica quando um novo usuário se cadastrar e iniciar o período de teste no SaaS.",
    icon: UserPlus,
  },
  {
    key: "silent_mode",
    label: "Modo Silencioso Global",
    description: "Pausa temporariamente todos os disparos ao Telegram sem desconfigurar os canais.",
    icon: VolumeX,
  },
];

export function TelegramSettingsCard() {
  const { data: settings, isLoading } = useAdminTelegramSettings();
  const updateMutation = useUpdateTelegramSettingsMutation();

  const handleToggle = (key: keyof UpdateTelegramSettingsInput, currentValue: boolean) => {
    updateMutation.mutate({ [key]: !currentValue });
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <Bot className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Central de Alertas & Bot Telegram</h3>
            <p className="text-xs text-muted-foreground">
              Configure quais eventos e relatórios operacionais o bot do fundador deve despachar.
            </p>
          </div>
        </div>
        {settings?.silent_mode && (
          <Badge variant="warning" size="xs">
            Modo Silencioso Ativo
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {CHANNELS.map(({ key, label, description, icon: Icon }) => {
            const isEnabled = Boolean(settings?.[key as keyof typeof settings]);

            return (
              <div
                key={key}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-surface-subtle/40 hover:bg-surface-hover/20 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{label}</div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {description}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant={isEnabled ? "default" : "outline"}
                  size="xs"
                  onClick={() => handleToggle(key, isEnabled)}
                  disabled={updateMutation.isPending}
                  className="shrink-0 font-medium"
                >
                  {isEnabled ? "Ativo" : "Silenciado"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
