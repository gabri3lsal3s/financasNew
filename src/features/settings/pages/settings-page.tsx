import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Bell,
  LifeBuoy,
  Palette,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import { Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { SupportChatDialog } from "@/components/modules";
import {
  AccountTab,
  AppearanceTab,
  NotificationsTab,
  SecurityTab,
  SubscriptionTab,
  SupportTab,
} from "../components/tabs";
import { resolveSettingsTab } from "../utils/settings-routes";

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [supportChatOpen, setSupportChatOpen] = useState(false);

  const tabParam = searchParams.get("tab");
  const subTabParam =
    searchParams.get("subtab") || searchParams.get("subTab") || searchParams.get("aba");

  // Abertura automática do modal de criação de chamado via query params (?modal=suporte ou ?chat=open)
  const isDirectSupportModal =
    searchParams.get("modal") === "suporte" || searchParams.get("chat") === "open";
  const isSupportDialogOpen = supportChatOpen || Boolean(isDirectSupportModal);

  const handleSupportOpenChange = (open: boolean) => {
    setSupportChatOpen(open);
    if (!open && isDirectSupportModal) {
      setSearchParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          updated.delete("modal");
          updated.delete("chat");
          return updated;
        },
        { replace: true },
      );
    }
  };

  const activeTab = useMemo(() => {
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
        value: "account",
        label: "Minha Conta",
        shortLabel: "Conta",
        icon: <User className="size-4" aria-hidden="true" />,
        content: <AccountTab />,
      },
      {
        value: "appearance",
        label: "Aparência",
        shortLabel: "Aparência",
        icon: <Palette className="size-4" aria-hidden="true" />,
        content: <AppearanceTab />,
      },
      {
        value: "notifications",
        label: "Notificações",
        shortLabel: "Alertas",
        icon: <Bell className="size-4" aria-hidden="true" />,
        content: <NotificationsTab />,
      },
      {
        value: "security",
        label: "Dados & Privacidade",
        shortLabel: "Privacidade",
        icon: <ShieldCheck className="size-4" aria-hidden="true" />,
        content: <SecurityTab />,
      },
      {
        value: "subscription",
        label: "Plano",
        shortLabel: "Plano",
        icon: <Zap className="size-4" aria-hidden="true" />,
        content: <SubscriptionTab />,
      },
      {
        value: "support",
        label: "Suporte & Ajuda",
        shortLabel: "Suporte",
        icon: <LifeBuoy className="size-4" aria-hidden="true" />,
        content: <SupportTab />,
      },
    ],
    [],
  );

  return (
    <div className="flex w-full flex-col gap-5 sm:gap-6 min-w-0">
      <PageHeader
        title="Configurações"
        description="Gestão de conta, personalização visual, notificações, privacidade e plano"
      />

      <div className="pb-28 sm:pb-10">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          items={tabItems}
          variant="underline"
          className="w-full"
        />
      </div>

      {isSupportDialogOpen ? (
        <SupportChatDialog
          open={isSupportDialogOpen}
          onOpenChange={handleSupportOpenChange}
        />
      ) : null}
    </div>
  );
}
