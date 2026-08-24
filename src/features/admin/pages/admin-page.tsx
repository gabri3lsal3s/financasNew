import { useState } from "react";
import { useSearchParams } from "react-router";
import { History, KeyRound, Layers, ShieldCheck, Users } from "lucide-react";
import { Tabs } from "@/components/ui";
import { OverviewTab } from "./overview-tab";
import { UsersTab } from "./users-tab";
import { FeaturesTab } from "./features-tab";
import { InvitesTab } from "./invites-tab";
import { AuditTab } from "./audit-tab";

type AdminTab = "visao-geral" | "usuarios" | "funcionalidades" | "convites" | "auditoria";

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get("aba") as AdminTab) || "visao-geral";

  const [activeTab, setActiveTab] = useState<AdminTab>(
    ["visao-geral", "usuarios", "funcionalidades", "convites", "auditoria"].includes(tabParam)
      ? tabParam
      : "visao-geral",
  );

  const handleTabChange = (val: string) => {
    const nextTab = val as AdminTab;
    setActiveTab(nextTab);
    setSearchParams((prev) => {
      prev.set("aba", nextTab);
      return prev;
    });
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-24 sm:pb-8">
      {/* Cabeçalho da Página */}
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Painel Administrativo
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Gestão de usuários, aprovação de contas, convites de acesso e feature flags da plataforma.
        </p>
      </header>

      {/* Navegação de Abas */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        variant="pills"
        items={[
          { value: "visao-geral", label: "Visão Geral", shortLabel: "Geral", icon: <ShieldCheck className="size-4" aria-hidden="true" /> },
          { value: "usuarios", label: "Gestão de Usuários", shortLabel: "Usuários", icon: <Users className="size-4" aria-hidden="true" /> },
          { value: "funcionalidades", label: "Funcionalidades & Flags", shortLabel: "Módulos", icon: <Layers className="size-4" aria-hidden="true" /> },
          { value: "convites", label: "Convites & Allowlist", shortLabel: "Convites", icon: <KeyRound className="size-4" aria-hidden="true" /> },
          { value: "auditoria", label: "Auditoria", shortLabel: "Auditoria", icon: <History className="size-4" aria-hidden="true" /> },
        ]}
      />



      {/* Conteúdo da Aba Ativa */}
      {activeTab === "visao-geral" && <OverviewTab />}
      {activeTab === "usuarios" && <UsersTab />}
      {activeTab === "funcionalidades" && <FeaturesTab />}
      {activeTab === "convites" && <InvitesTab />}
      {activeTab === "auditoria" && <AuditTab />}
    </div>
  );
}
