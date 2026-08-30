import { useSearchParams } from "react-router";
import { KeyRound, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { Tabs, type TabItem } from "@/components/ui";
import { OverviewTab } from "./overview-tab";
import { UsersTab } from "./users-tab";
import { InvitesTab } from "./invites-tab";
import { SystemTab } from "./system-tab";

type AdminTab = "visao-geral" | "usuarios" | "convites" | "sistema";

function resolveAdminTab(param: string | null): AdminTab {
  if (!param) return "visao-geral";
  const normalized = param.trim().toLowerCase();

  if (["usuarios", "users", "acessos", "clientes", "membros"].includes(normalized)) {
    return "usuarios";
  }
  if (["convites", "invites", "allowlist", "codigos", "codigo"].includes(normalized)) {
    return "convites";
  }
  if (
    [
      "sistema",
      "system",
      "funcionalidades",
      "flags",
      "modulos",
      "auditoria",
      "logs",
      "seguranca",
    ].includes(normalized)
  ) {
    return "sistema";
  }
  return "visao-geral";
}

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawParam = searchParams.get("aba") || searchParams.get("tab");
  const activeTab = resolveAdminTab(rawParam);

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
      value: "convites",
      label: "Convites & Allowlist",
      shortLabel: "Convites",
      icon: <KeyRound className="size-4" aria-hidden="true" />,
      content: <InvitesTab />,
    },
    {
      value: "sistema",
      label: "Sistema & Auditoria",
      shortLabel: "Sistema",
      icon: <SlidersHorizontal className="size-4" aria-hidden="true" />,
      content: <SystemTab />,
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
            Gestão de usuários, aprovação de contas, convites de acesso e governança da plataforma
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
