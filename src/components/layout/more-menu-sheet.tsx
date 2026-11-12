import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Compass, Download, HelpCircle } from "lucide-react";
import { navGroups, filterNavItems, navItems } from "@/components/layout/nav-items";
import { resolveBottomNavSlots } from "@/domain/navigation";
import { AppDownloadModal } from "@/components/modules/app-download-modal";
import { DemoTrackSelectModal } from "@/components/modules/demo-track-select-modal";
import { HelpModal } from "@/components/modules/help-modal";
import { isIOSDevice, isNativePlatform, isStandaloneDisplay } from "@/services/native/platform";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useFamilyMode, useTripMode, useReminders, useUserAccess } from "@/state";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

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
  const isIOS = isIOSDevice();

  // No APK nativo, não deve aparecer a opção de download de aplicativo.
  // No iOS, se já estiver no PWA, também não há instaladores disponíveis (iOS não executa APK).
  const showDownloadAppOption = !isNative && !(isIOS && isPwaActive);

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
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Mais opções"
        description="Navegue pelas demais áreas e configurações da aplicação"
        size="md"
      >
      <div className="space-y-6 pt-2 pb-4">
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
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-xl border border-border/80 bg-surface shadow-xs px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-hover active:scale-[0.99]"
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
            Aplicativo & Ajuda
          </h2>
          <div className="grid gap-2">
            {/* Acesso ao Tour Guiado (Modo Simulação) */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setDemoSelectOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted-foreground">
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

            {/* Acesso à Central de Ajuda & Suporte */}
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setHelpModalOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted-foreground">
                  <HelpCircle className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Central de Ajuda & Suporte
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
                  onOpenChange(false);
                  setDownloadModalOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted-foreground">
                    <Download className="size-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Baixar aplicativo
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isPwaActive
                        ? "Baixe o APK Android Pro com leitura de notificações"
                        : "Instale o App Web (PWA) ou baixe o APK Android Pro"}
                    </p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </section>
      </div>
    </ResponsiveDialog>

    <HelpModal
      open={helpModalOpen}
      onOpenChange={setHelpModalOpen}
      onOpenDemoSelect={() => setDemoSelectOpen(true)}
    />

    <DemoTrackSelectModal
      open={demoSelectOpen}
      onOpenChange={setDemoSelectOpen}
    />

    <AppDownloadModal
      open={downloadModalOpen}
      onOpenChange={setDownloadModalOpen}
    />
  </>
  );
}
