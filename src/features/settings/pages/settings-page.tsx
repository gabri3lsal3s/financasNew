import { useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  Palette,
  Volume2,
  Database,
  Sliders,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { Tabs } from "@/components/ui";
import {
  AppearanceTab,
  SensoryTab,
  WidgetsTab,
  RemindersTab,
  BackupTab,
  SecurityTab,
} from "../components/tabs";
import { useUserAccess } from "@/state";

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasFeature } = useUserAccess();
  const tabParam = searchParams.get("tab");

  const activeTab = useMemo(() => {
    if (tabParam === "sensorial" || tabParam === "sons" || tabParam === "som") return "sensorial";
    if (tabParam === "interface" || tabParam === "dashboard" || tabParam === "widgets") return "interface";
    if (tabParam === "lembretes" || tabParam === "notificacoes") return "lembretes";
    if (tabParam === "dados" || tabParam === "exportar" || tabParam === "backup") return "dados";
    if (tabParam === "seguranca" || tabParam === "2fa" || tabParam === "mfa" || tabParam === "conta") return "seguranca";
    return "personalizacao";
  }, [tabParam]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  const tabItems = useMemo(
    () => [
      {
        value: "personalizacao",
        label: "Aparência",
        icon: <Palette className="size-4" />,
        content: <AppearanceTab />,
      },
      {
        value: "sensorial",
        label: "Sensorial",
        icon: <Volume2 className="size-4" />,
        content: <SensoryTab />,
      },
      {
        value: "interface",
        label: "Widgets",
        icon: <Sliders className="size-4" />,
        content: <WidgetsTab />,
      },
      ...(hasFeature("reminders")
        ? [
            {
              value: "lembretes",
              label: "Lembretes",
              icon: <Bell className="size-4" />,
              content: <RemindersTab />,
            },
          ]
        : []),
      {
        value: "dados",
        label: "Dados",
        icon: <Database className="size-4" />,
        content: <BackupTab />,
      },
      {
        value: "seguranca",
        label: "Segurança",
        icon: <ShieldCheck className="size-4" />,
        content: <SecurityTab />,
      },
    ],
    [hasFeature],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Configurações
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Personalização visual, preferências de interface e gestão de dados
        </p>
      </header>

      <div className="pb-12">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          items={tabItems}
          variant="underline"
          className="w-full"
        />
      </div>
    </div>
  );
}
