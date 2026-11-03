import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  User,
  Palette,
  Bell,
  ShieldCheck,
  Zap,
  RefreshCw,
  Smartphone,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { Button, Tabs } from "@/components/ui";
import {
  AccountTab,
  AppearanceTab,
  NotificationsTab,
  SecurityTab,
  SubscriptionTab,
  AppInstallationTab,
} from "../components/tabs";
import { HelpModal, SupportChatDialog } from "@/components/modules";
import { forceAppUpdate } from "@/app/pwa";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";

/**
 * Resolve o identificador canônico da aba de configurações a partir do parâmetro
 * de rota (tab, subtab ou aliases comuns de deep-link).
 */
function resolveSettingsTab(param: string | null): string {
  if (!param) return "appearance";
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
      "senha",
      "dados",
      "exportar",
      "backup",
      "importar",
    ].includes(p)
  ) {
    return "security";
  }
  if (["subscription", "plano", "assinatura", "upgrade"].includes(p)) {
    return "subscription";
  }
  if (
    [
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
    return "devices";
  }
  if (
    [
      "support",
      "suporte",
      "ajuda",
      "help",
      "faq",
      "atendimento",
    ].includes(p)
  ) {
    return "appearance";
  }
  return "appearance";
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isUpdating, setIsUpdating] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [supportChatOpen, setSupportChatOpen] = useState(false);

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
        label: "Segurança",
        shortLabel: "Segurança",
        icon: <ShieldCheck className="size-4" />,
        content: <SecurityTab />,
      },
      {
        value: "devices",
        label: "Dispositivos & App",
        shortLabel: "App",
        icon: <Smartphone className="size-4" />,
        content: <AppInstallationTab />,
      },
      {
        value: "subscription",
        label: "Plano",
        shortLabel: "Plano",
        icon: <Zap className="size-4" />,
        content: <SubscriptionTab />,
      },
      {
        value: "account",
        label: "Minha Conta",
        shortLabel: "Conta",
        icon: <User className="size-4" />,
        content: <AccountTab />,
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
          <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
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

      <div className="pb-8">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          items={tabItems}
          variant="underline"
          className="w-full"
        />
      </div>

      {/* --- SEÇÃO CANÔNICA DE SUPORTE E AJUDA (Fase 8 — Tarefa 8.4) --- */}
      <section
        data-tour="settings-support-card"
        aria-label="Central de Ajuda e Suporte"
        className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-hover border border-border/60 text-muted-foreground">
            <HelpCircle className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Central de Ajuda &amp; Suporte Técnico
            </h2>
            <p className="text-xs text-muted-foreground">
              Tire dúvidas frequentes, assista a tutoriais guiados ou fale diretamente com a nossa equipe de suporte.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHelpModalOpen(true)}
            className="gap-1.5 text-xs h-9 px-3.5 rounded-xl border-border/80 cursor-pointer flex-1 sm:flex-none justify-center"
          >
            <HelpCircle className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Ver Ajuda &amp; FAQ</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setSupportChatOpen(true)}
            className="gap-1.5 text-xs h-9 px-3.5 rounded-xl cursor-pointer shadow-xs flex-1 sm:flex-none justify-center"
          >
            <MessageSquare className="size-3.5" aria-hidden="true" />
            <span>Falar com Suporte</span>
          </Button>
        </div>
      </section>

      {/* Diálogos modais de Ajuda e Suporte */}
      {helpModalOpen && (
        <HelpModal
          open={helpModalOpen}
          onOpenChange={setHelpModalOpen}
          onOpenSupport={() => {
            setHelpModalOpen(false);
            setSupportChatOpen(true);
          }}
        />
      )}
      {supportChatOpen && (
        <SupportChatDialog
          open={supportChatOpen}
          onOpenChange={setSupportChatOpen}
        />
      )}
    </div>
  );
}
