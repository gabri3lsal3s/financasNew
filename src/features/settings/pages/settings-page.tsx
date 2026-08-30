import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Palette,
  ShieldCheck,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Button, Tabs } from "@/components/ui";
import {
  AppearanceTab,
  SecurityTab,
  SubscriptionTab,
} from "../components/tabs";
import { forceAppUpdate } from "@/app/pwa";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";

/**
 * Resolve o identificador canônico da aba de configurações a partir do parâmetro
 * de rota (tab, subtab ou aliases comuns de deep-link).
 */
function resolveSettingsTab(param: string | null): string {
  if (!param) return "personalizacao";
  const p = param.toLowerCase().trim();
  if (
    [
      "personalizacao",
      "personalização",
      "aparencia",
      "aparência",
      "tema",
      "visual",
      "customizacao",
      "customização",
      "experiencia",
      "experiência",
      "sensorial",
      "modos",
      "modo",
      "sons",
      "som",
      "audio",
      "haptic",
      "widgets",
      "interface",
      "dashboard",
      "lembretes",
      "notificacoes",
      "notificações",
      "notificacao",
      "notificação",
    ].includes(p)
  ) {
    return "personalizacao";
  }
  if (["plano", "assinatura", "subscription", "upgrade"].includes(p)) {
    return "plano";
  }
  if (
    [
      "seguranca",
      "segurança",
      "perfil",
      "conta",
      "usuario",
      "usuário",
      "2fa",
      "mfa",
      "senha",
      "dados",
      "exportar",
      "backup",
      "importar",
    ].includes(p)
  ) {
    return "seguranca";
  }
  return "personalizacao";
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isUpdating, setIsUpdating] = useState(false);

  const tabParam = searchParams.get("tab");
  const subTabParam = searchParams.get("subtab") || searchParams.get("subTab") || searchParams.get("aba");

  const activeTab = useMemo(() => {
    if (subTabParam) {
      return resolveSettingsTab(subTabParam);
    }
    return resolveSettingsTab(tabParam);
  }, [tabParam, subTabParam]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  const handleForceUpdate = async () => {
    triggerSensory("action");
    setIsUpdating(true);
    pushToast({
      title: "Atualizando aplicativo...",
      description: "Buscando a versão mais recente e recarregando os dados.",
      variant: "info",
    });
    try {
      await forceAppUpdate();
    } catch {
      setIsUpdating(false);
    }
  };

  const tabItems = useMemo(
    () => [
      {
        value: "personalizacao",
        label: "Personalização",
        icon: <Palette className="size-4" />,
        content: <AppearanceTab />,
      },
      {
        value: "plano",
        label: "Plano",
        icon: <Zap className="size-4" />,
        content: <SubscriptionTab />,
      },
      {
        value: "seguranca",
        label: "Segurança",
        icon: <ShieldCheck className="size-4" />,
        content: <SecurityTab />,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Configurações
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Personalização visual, preferências de interface e gestão de conta
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUpdating}
          onClick={handleForceUpdate}
          aria-label="Atualizar aplicativo para a versão mais recente"
          className="gap-2 shrink-0 self-start sm:self-auto border-border/80 bg-surface hover:bg-surface-hover cursor-pointer"
        >
          <RefreshCw
            className={cn("size-4 text-muted-foreground", isUpdating && "animate-spin text-primary")}
            aria-hidden="true"
          />
          <span>{isUpdating ? "Atualizando..." : "Atualizar o app"}</span>
        </Button>
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
