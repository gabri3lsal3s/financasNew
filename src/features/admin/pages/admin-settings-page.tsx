import { Layers, Smartphone } from "lucide-react";
import { Alert, Badge, EmptyState, Skeleton } from "@/components/ui";
import { useAdminFeatures } from "@/state";
import { FeatureToggleCard, TelegramSettingsCard } from "../components";

export function AdminSettingsPage() {
  const featuresQuery = useAdminFeatures();
  const features = featuresQuery.data ?? [];

  const apkFreeFeature = features.find((f) => f.key === "apk_access_free");
  const apkProFeature = features.find((f) => f.key === "apk_access_pro");
  const bankNotificationFeature = features.find((f) => f.key === "bank_notification_listener");
  const coreFeatures = features.filter(
    (f) =>
      f.key !== "apk_access_free" &&
      f.key !== "apk_access_pro" &&
      f.key !== "bank_notification_listener",
  );

  return (
    <div className="flex flex-col gap-8 w-full min-w-0">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Sistema &amp; Configurações da Plataforma
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Controle de liberação do APK Android Beta, Kill-Switches globais e bot do Telegram
        </p>
      </div>

      {/* --- SEÇÃO 1: CONTROLE DO APK NATIVO ANDROID (BETA FECHADO) --- */}
      <section aria-label="Controle de Acesso ao APK" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Smartphone className="size-4 text-primary-strong" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-foreground">
                Controle de Acesso ao Aplicativo Nativo (APK Android)
              </h2>
              <p className="text-xs text-muted-foreground">
                Habilite ou desabilite o acesso ao APK móvel durante o beta fechado para cada categoria de usuário
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {apkProFeature && <FeatureToggleCard feature={apkProFeature} />}
          {apkFreeFeature && <FeatureToggleCard feature={apkFreeFeature} />}
        </div>

        {bankNotificationFeature && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
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
      </section>

      {/* --- SEÇÃO 2: CENTRAL DE ALERTAS & BOT TELEGRAM --- */}
      <section aria-label="Central de Alertas e Bot Telegram">
        <TelegramSettingsCard />
      </section>

      {/* --- SEÇÃO 3: FEATURE FLAGS & KILL-SWITCHES GLOBAIS --- */}
      <section aria-label="Módulos e Feature Flags" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Layers className="size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-foreground">
                Módulos &amp; Kill-Switches Globais
              </h2>
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
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
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
    </div>
  );
}
