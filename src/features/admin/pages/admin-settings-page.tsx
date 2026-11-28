import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { AlertCircle, Bot, FileSpreadsheet, Layers, Smartphone } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Skeleton, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { AdminHelpTip, AdminPageGuide } from "../components/admin-help-tip";
import { useAdminFeatures, useAdminStatementBlueprints } from "@/state";
import { FeatureToggleCard, StatementBlueprintsCard, TelegramSettingsCard } from "../components";

const SETTINGS_TABS = ["modulos", "apk", "telegram", "blueprints"] as const;

export function AdminSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = rawTab === "modules" ? "modulos" : rawTab;
  const activeTab = SETTINGS_TABS.find((value) => value === tab) ?? "modulos";

  const featuresQuery = useAdminFeatures();
  const blueprintsQuery = useAdminStatementBlueprints();
  const features = featuresQuery.data ?? [];

  const pendingBlueprintsCount = useMemo(
    () => (blueprintsQuery.data ?? []).filter((b) => b.status === "pending_review").length,
    [blueprintsQuery.data],
  );

  const apkFreeFeature = features.find((f) => f.key === "apk_access_free");
  const apkProFeature = features.find((f) => f.key === "apk_access_pro");
  const bankNotificationFeature = features.find((f) => f.key === "bank_notification_listener");
  const coreFeatures = features.filter(
    (f) =>
      f.key !== "apk_access_free" &&
      f.key !== "apk_access_pro" &&
      f.key !== "bank_notification_listener",
  );

  const handleTabChange = (nextTab: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", nextTab);
        return next;
      },
      { replace: true },
    );
  };

  const modulesContent = (
    <section aria-label="Módulos e Feature Flags" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Layers className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <div className="flex items-center gap-1">
              <h2 className="text-base font-bold text-foreground">
                Módulos e controles globais
              </h2>
              <AdminHelpTip
                title="Kill-switch global"
                what="Controle que permite desligar um módulo para toda a plataforma."
                when="Use quando uma falha exigir a interrupção do módulo até a correção."
                impact="O módulo fica indisponível enquanto o controle estiver desligado."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Desativação emergencial instantânea de módulos para toda a plataforma
            </p>
          </div>
        </div>
        <Badge variant="muted" size="xs">
          {coreFeatures.length} módulos cadastrados
        </Badge>
      </div>

      {featuresQuery.isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-surface shadow-xs"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-36 sm:w-48" />
                  <Skeleton className="h-3 w-48 sm:w-64" />
                </div>
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </div>
      ) : featuresQuery.isError ? (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar os módulos"
          description="Ocorreu um erro ao buscar as feature flags globais. Tente novamente."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void featuresQuery.refetch()}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : coreFeatures.length === 0 ? (
        <EmptyState
          title="Nenhum módulo encontrado"
          description="O catálogo de módulos do sistema ainda não foi inicializado."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {coreFeatures.map((feature) => (
            <FeatureToggleCard key={feature.key} feature={feature} />
          ))}
        </div>
      )}
    </section>
  );

  const apkContent = (
    <section aria-label="Controle de Acesso ao APK" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Smartphone className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-foreground">
              Controle de Acesso ao Aplicativo Nativo (APK Android)
            </h2>
            <p className="text-xs text-muted-foreground">
              Habilite ou desabilite o acesso ao APK móvel durante o beta fechado para cada categoria
            </p>
          </div>
        </div>
        <Badge variant="warning" size="xs">
          Fase Beta
        </Badge>
      </div>

      <Alert variant="info">
        Se o acesso ao APK estiver desativado para o plano do usuário, o aplicativo exibirá automaticamente uma tela amigável convidando o cliente a utilizar o Axir pelo navegador móvel (PWA/Web).
      </Alert>

      {featuresQuery.isError ? (
        <EmptyState
          icon={<AlertCircle className="size-10 text-critical-strong" aria-hidden="true" />}
          tone="negative"
          title="Não foi possível carregar as flags do APK"
          description="Tente recarregar as configurações da plataforma."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void featuresQuery.refetch()}
            >
              Tentar novamente
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {apkProFeature && <FeatureToggleCard feature={apkProFeature} />}
            {apkFreeFeature && <FeatureToggleCard feature={apkFreeFeature} />}
          </div>

          {bankNotificationFeature && (
            <div className="flex flex-col gap-2 pt-2 border-t border-border/80">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Assistente de Notificações Bancárias (Captura em Segundo Plano)
                </span>
                <Badge variant="muted" size="xs">
                  Restrição Granular
                </Badge>
              </div>
              <FeatureToggleCard feature={bankNotificationFeature} />
            </div>
          )}
        </>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-6 w-full min-w-0">
      <PageHeader
        utilityActions={<AdminPageGuide page="settings" />}
        title="Configurações"
        description="Módulos, Android, Telegram e layouts de fatura"
      />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        ariaLabel="Seções de configuração da plataforma"
        items={[
          {
            value: "modulos",
            label: "Módulos",
            icon: <Layers aria-hidden="true" />,
            content: modulesContent,
          },
          {
            value: "apk",
            label: "APK Beta",
            icon: <Smartphone aria-hidden="true" />,
            content: apkContent,
          },
          {
            value: "telegram",
            label: "Bot Telegram",
            shortLabel: "Telegram",
            icon: <Bot aria-hidden="true" />,
            content: <TelegramSettingsCard />,
          },
          {
            value: "blueprints",
            label: "Layouts de Fatura",
            shortLabel: "Layouts",
            icon: <FileSpreadsheet aria-hidden="true" />,
            badge:
              pendingBlueprintsCount > 0 ? (
                <Badge variant="warning" size="xs">
                  {pendingBlueprintsCount}
                </Badge>
              ) : undefined,
            content: (
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                  Como funcionam os layouts
                  <AdminHelpTip
                    title="Blueprints"
                    what="Modelos que ajudam a reconhecer a estrutura de faturas na importação."
                    when="Revise um layout pendente antes de aprová-lo para uso global."
                    impact="Layouts aprovados podem ser reutilizados nas próximas importações compatíveis."
                  />
                </div>
                <StatementBlueprintsCard />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
