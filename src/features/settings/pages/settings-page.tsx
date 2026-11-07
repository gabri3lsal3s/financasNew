import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  User,
  Palette,
  Bell,
  ShieldCheck,
  Zap,
  LifeBuoy,
} from "lucide-react";
import { Tabs } from "@/components/ui";
import {
  AccountTab,
  AppearanceTab,
  NotificationsTab,
  SecurityTab,
  SubscriptionTab,
  SupportTab,
} from "../components/tabs";
import { DemoTrackSelectModal, HelpModal, SupportChatDialog } from "@/components/modules";

/**
 * Resolve o identificador canônico da aba de configurações a partir do parâmetro
 * de rota (tab, subtab ou aliases comuns de deep-link).
 * Por padrão, abre em "account" (Minha Conta / Perfil).
 */
function resolveSettingsTab(param: string | null): string {
  if (!param) return "account";
  const p = param.toLowerCase().trim();

  if (
    [
      "account",
      "conta",
      "perfil",
      "usuario",
      "usuário",
      "profile",
      "minha-conta",
      "dados-pessoais",
    ].includes(p)
  ) {
    return "account";
  }

  if (
    [
      "appearance",
      "aparencia",
      "aparência",
      "personalizacao",
      "personalização",
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
      "family",
      "familia",
      "família",
    ].includes(p)
  ) {
    return "appearance";
  }

  if (
    [
      "notifications",
      "notificacoes",
      "notificações",
      "notificacao",
      "notificação",
      "lembretes",
      "lembrete",
      "bancos",
      "assistente",
    ].includes(p)
  ) {
    return "notifications";
  }

  if (
    [
      "security",
      "seguranca",
      "segurança",
      "dados",
      "exportar",
      "backup",
      "importar",
      "privacidade",
      "devices",
      "dispositivos",
      "app",
      "aplicativo",
      "instalacao",
      "instalação",
      "apk",
      "download",
      "versao",
      "versão",
    ].includes(p)
  ) {
    return "security";
  }

  if (["subscription", "plano", "assinatura", "upgrade"].includes(p)) {
    return "subscription";
  }

  if (
    [
      "support",
      "suporte",
      "ajuda",
      "help",
      "faq",
      "atendimento",
      "chamados",
    ].includes(p)
  ) {
    return "support";
  }

  return "account";
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [demoSelectOpen, setDemoSelectOpen] = useState(false);
  const [supportChatOpen, setSupportChatOpen] = useState(false);

  const tabParam = searchParams.get("tab");
  const subTabParam = searchParams.get("subtab") || searchParams.get("subTab") || searchParams.get("aba");

  // Abertura automática do modal de criação de chamado via query params dedicados (?modal=suporte ou ?chat=open)
  const isDirectSupportModal = searchParams.get("modal") === "suporte" || searchParams.get("chat") === "open";
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
        icon: <User className="size-4" />,
        content: <AccountTab />,
      },
      {
        value: "appearance",
        label: "Aparência",
        shortLabel: "Aparência",
        icon: <Palette className="size-4" />,
        content: <AppearanceTab />,
      },
      {
        value: "notifications",
        label: "Notificações",
        shortLabel: "Alertas",
        icon: <Bell className="size-4" />,
        content: <NotificationsTab />,
      },
      {
        value: "security",
        label: "Dados & Privacidade",
        shortLabel: "Privacidade",
        icon: <ShieldCheck className="size-4" />,
        content: <SecurityTab />,
      },
      {
        value: "subscription",
        label: "Plano",
        shortLabel: "Plano",
        icon: <Zap className="size-4" />,
        content: <SubscriptionTab />,
      },
      {
        value: "support",
        label: "Suporte & Ajuda",
        shortLabel: "Suporte",
        icon: <LifeBuoy className="size-4" />,
        content: <SupportTab />,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Configurações
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Gestão de conta, personalização visual, notificações, privacidade e plano
        </p>
      </header>

      <div className="pb-8">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          items={tabItems}
          variant="underline"
          className="w-full"
        />
      </div>

      {/* Diálogos modais globais de Ajuda e Suporte */}
      {helpModalOpen && (
        <HelpModal
          open={helpModalOpen}
          onOpenChange={setHelpModalOpen}
          onOpenDemoSelect={() => {
            setHelpModalOpen(false);
            setDemoSelectOpen(true);
          }}
          onOpenSupport={() => {
            setHelpModalOpen(false);
            setSupportChatOpen(true);
          }}
        />
      )}
      {demoSelectOpen && (
        <DemoTrackSelectModal
          open={demoSelectOpen}
          onOpenChange={setDemoSelectOpen}
        />
      )}
      {isSupportDialogOpen && (
        <SupportChatDialog
          open={isSupportDialogOpen}
          onOpenChange={handleSupportOpenChange}
        />
      )}
    </div>
  );
}
