import { useSearchParams } from "react-router";
import { History, KeyRound, Layers, ShieldCheck, Users } from "lucide-react";
import { Tabs, type TabItem } from "@/components/ui";
import { OverviewTab } from "./overview-tab";
import { UsersTab } from "./users-tab";
import { FeaturesTab } from "./features-tab";
import { InvitesTab } from "./invites-tab";
import { AuditTab } from "./audit-tab";

type AdminTab = "visao-geral" | "usuarios" | "funcionalidades" | "convites" | "auditoria";

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("aba") || searchParams.get("tab") || "visao-geral";

  const activeTab: AdminTab = [
    "visao-geral",
    "usuarios",
    "funcionalidades",
    "convites",
    "auditoria",
  ].includes(rawTab)
    ? (rawTab as AdminTab)
    : "visao-geral";

  const handleTabChange = (val: string) => {
    const nextTab = val as AdminTab;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("aba", nextTab);
        next.delete("tab");
        return next;
      },
      { replace: true },
    );
  };

  const tabItems: TabItem[] = [
    {
      value: "visao-geral",
      label: "Visão Geral",
      shortLabel: "Geral",
      icon: <ShieldCheck className="size-4" aria-hidden="true" />,
      content: <OverviewTab />,
    },
    {
      value: "usuarios",
      label: "Gestão de Usuários",
      shortLabel: "Usuários",
      icon: <Users className="size-4" aria-hidden="true" />,
      content: <UsersTab />,
    },
    {
      value: "funcionalidades",
      label: "Funcionalidades & Flags",
      shortLabel: "Módulos",
      icon: <Layers className="size-4" aria-hidden="true" />,
      content: <FeaturesTab />,
    },
    {
      value: "convites",
      label: "Convites & Allowlist",
      shortLabel: "Convites",
      icon: <KeyRound className="size-4" aria-hidden="true" />,
      content: <InvitesTab />,
    },
    {
      value: "auditoria",
      label: "Auditoria",
      shortLabel: "Auditoria",
      icon: <History className="size-4" aria-hidden="true" />,
      content: <AuditTab />,
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      {/* Cabeçalho da Página Padronizado */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Painel Administrativo
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Gestão de usuários, aprovação de contas, convites de acesso e feature flags da plataforma
          </p>
        </div>
      </header>

      {/* Navegação de Abas Nativa com Suporte a Swipe */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        swipeable
        items={tabItems}
      />
    </div>
  );
}
