import { Globe, LogOut, Smartphone } from "lucide-react";
import { Button, Modal, ModalFooter } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserAccess, useUserSubscription } from "@/state";
import { isNativePlatform } from "@/services/native/platform";
import { getPublicAppUrl } from "@/services/app-url";

/**
 * Modal bloqueador quando o acesso ao APK nativo não está liberado para o perfil atual.
 */
export function ApkBetaRestrictedModal() {
  const { session } = useAuth();
  const { signOut } = useSignOut();
  const { hasFeature, isAdmin, isLoading } = useUserAccess(session?.user?.id);
  const { isPro } = useUserSubscription();

  if (!isNativePlatform() || isLoading || isAdmin) {
    return null;
  }

  const isApkAllowed = isPro
    ? hasFeature("apk_access_pro")
    : hasFeature("apk_access_free");

  if (isApkAllowed) {
    return null;
  }

  const handleOpenBrowser = () => {
    const webUrl = getPublicAppUrl("/");
    window.open(webUrl, "_system");
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Modal
      open={true}
      onOpenChange={() => {}}
      size="sm"
      title="Acesso Beta ao Aplicativo Nativo"
      description="Homologação restrita de versão prévia para smartphones"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Sair da conta</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleOpenBrowser}
            className="gap-1.5"
          >
            <Globe className="size-4 shrink-0" aria-hidden="true" />
            <span>Acessar via Web / Navegador</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4 py-2 text-foreground">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-warning/15 border border-warning/20 text-warning-strong mx-auto">
          <Smartphone className="size-6" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2 text-center">
          <h3 className="text-base font-bold text-foreground">
            Aplicativo Nativo em Testes Fechados
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A versão nativa do Axir para Android está em fase de validação e estabilização de telemetria. Durante este período, o acesso via APK está liberado apenas para contas selecionadas.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Você pode continuar controlando suas finanças com 100% de precisão e segurança acessando o Axir diretamente pelo navegador no seu celular ou computador.
          </p>
        </div>
      </div>
    </Modal>
  );
}
