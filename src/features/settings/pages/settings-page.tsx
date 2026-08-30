import { useMemo } from "react";
import { useSearchParams } from "react-router";
import {
  Palette,
  Volume2,
  Database,
  Sliders,
  Bell,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Tabs } from "@/components/ui";
import {
  AppearanceTab,
  SensoryTab,
  WidgetsTab,
  RemindersTab,
  BackupTab,
  SecurityTab,
  SubscriptionTab,
} from "../components/tabs";
import { useUserAccess } from "@/state";

/**
 * Resolve o identificador canônico da aba de configurações a partir do parâmetro
 * de rota (tab, subtab ou aliases comuns de deep-link).
 */
function resolveSettingsTab(param: string | null): string {
  if (!param) return "personalizacao";
  const p = param.toLowerCase().trim();
  if (["personalizacao", "aparencia", "aparência", "tema", "visual", "customizacao"].includes(p)) {
    return "personalizacao";
  }
  if (["sensorial", "sons", "som", "audio", "haptic"].includes(p)) {
    return "sensorial";
  }
  if (["interface", "dashboard", "widgets"].includes(p)) {
    return "interface";
  }
  if (["lembretes", "notificacoes", "notificações", "notificacao", "notificação"].includes(p)) {
    return "lembretes";
  }
  if (["dados", "exportar", "backup", "importar"].includes(p)) {
    return "dados";
  }
  if (["plano", "assinatura", "subscription", "upgrade"].includes(p)) {
    return "plano";
  }
  if (["seguranca", "segurança", "perfil", "conta", "usuario", "usuário", "2fa", "mfa", "senha"].includes(p)) {
    return "seguranca";
  }
  return "personalizacao";
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasFeature } = useUserAccess();

  const tabParam = searchParams.get("tab");
  const subTabParam = searchParams.get("subtab") || searchParams.get("subTab") || searchParams.get("aba");

  const activeTab = useMemo(() => {
    // Se informada sub-aba explícita, tem precedência sobre o parâmetro geral
    if (subTabParam) {
      return resolveSettingsTab(subTabParam);
    }
    return resolveSettingsTab(tabParam);
  }, [tabParam, subTabParam]);

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
        value: "plano",
        label: "Plano",
        icon: <Sparkles className="size-4" />,
        content: <SubscriptionTab />,
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
