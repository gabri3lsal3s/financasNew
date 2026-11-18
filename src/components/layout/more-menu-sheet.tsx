import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Compass, Download, HelpCircle } from "lucide-react";
import { navGroups, filterNavItems, navItems } from "@/components/layout/nav-items";
import { resolveBottomNavSlots } from "@/domain/navigation";
import { AppDownloadModal } from "@/components/modules/app-download-modal";
import { DemoTrackSelectModal } from "@/components/modules/demo-track-select-modal";
import { HelpModal } from "@/components/modules/help-modal";
import { isNativePlatform, isStandaloneDisplay } from "@/services/native/platform";
import { shouldOfferAndroidApk } from "@/services/native/app-links";
import { triggerSensory } from "@/services/sensory";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useFamilyMode, useTripMode, useReminders, useUserAccess } from "@/state";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

export interface MoreMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoreMenuSheet({ open, onOpenChange }: MoreMenuSheetProps) {
  const [demoSelectOpen, setDemoSelectOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const { isInstalled } = usePWAInstall();
  const isNative = isNativePlatform();
  const isPwaActive = isInstalled || isStandaloneDisplay();
  const canOfferAndroidApk = shouldOfferAndroidApk();

  // No app nativo, ou quando já estiver usando PWA em plataforma sem APK (iOS/Desktop), oculta a opção.
  const showDownloadAppOption = !isNative && (canOfferAndroidApk || !isPwaActive);

  const { totalCount, urgentCount } = useReminders();
  const { isAdmin, hasFeature } = useUserAccess();
  const { isFamilyModeEnabled } = useFamilyMode();
  const { isTripModeEnabled } = useTripMode();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
  const isTripActive = Boolean(isTripModeEnabled);

  const groups = useMemo(() => {
    const allowedItems = filterNavItems(navItems, isAdmin, hasFeature, isFamilyActive, isTripActive);
    const { primarySlots } = resolveBottomNavSlots(allowedItems);
    const bottomNavPaths = new Set(primarySlots.map((s) => s.path));

    return navGroups
      .map((group) => ({
        title: group.title,
        items: filterNavItems(
          group.items.filter((item) => !bottomNavPaths.has(item.path)),
          isAdmin,
          hasFeature,
          isFamilyActive,
          isTripActive,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [isAdmin, hasFeature, isFamilyActive, isTripActive]);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Mais opções"
        description="Navegue pelas demais áreas e configurações da aplicação"
        size="md"
      >
        <div className="space-y-6 pt-2 pb-4 pb-safe">
          {groups.map((group) => (
            <section key={group.title} aria-label={group.title} className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h2>
              <nav className="grid gap-2" aria-label={group.title}>
                {group.items.map((item) => {
                  const isReminders = item.path === "/lembretes";
                  const showBadge = isReminders && totalCount > 0;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => {
                        triggerSensory("selection");
                        onOpenChange(false);
                      }}
                      className="flex min-h-11 items-center justify-between rounded-xl border border-border/80 bg-surface shadow-xs px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.99] cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                        <span>{item.label}</span>
                      </div>
                      {showBadge && (
                        <Badge
                          size="xs"
                          variant={urgentCount > 0 ? "critical" : "default"}
                          className="h-5 min-w-5 px-1.5 font-bold"
                        >
                          {totalCount > 9 ? "9+" : totalCount}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </section>
          ))}

          <section aria-label="Aplicativo & Ajuda" className="space-y-2 pt-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aplicativo &amp; Ajuda
            </h2>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  onOpenChange(false);
                  setDemoSelectOpen(true);
                }}
                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border/80 bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <Compass className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span>Rever Tour Guiado</span>
                      <Badge variant="muted" size="xs">
                        Simulação
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Explore recursos com dados ilustrativos em memória
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  onOpenChange(false);
                  setHelpModalOpen(true);
                }}
                className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border/80 bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <HelpCircle className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Central de Ajuda &amp; Suporte
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Dúvidas frequentes, orientações e contato
                    </p>
                  </div>
                </div>
              </button>

              {showDownloadAppOption && (
                <button
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onOpenChange(false);
                    setDownloadModalOpen(true);
                  }}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border/80 bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                      <Download className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        Baixar aplicativo
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {canOfferAndroidApk
                          ? isPwaActive
                            ? "Baixe o APK Android Pro com leitura de notificações"
                            : "Instale o App Web (PWA) ou baixe o APK Android Pro"
                          : "Instale o App Web (PWA) no seu dispositivo sem ocupar espaço"}
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </section>
        </div>
      </Modal>

      <HelpModal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
        onOpenDemoSelect={() => setDemoSelectOpen(true)}
      />

      <DemoTrackSelectModal open={demoSelectOpen} onOpenChange={setDemoSelectOpen} />

      <AppDownloadModal open={downloadModalOpen} onOpenChange={setDownloadModalOpen} />
    </>
  );
}
