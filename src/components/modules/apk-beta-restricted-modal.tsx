import { Globe, LogOut, Smartphone } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { useUserAccess, useUserSubscription } from "@/state";
import { isNativePlatform } from "@/services/native/platform";
import { getPublicAppUrl } from "@/services/app-url";
import { triggerSensory } from "@/services/sensory";

export function ApkBetaRestrictedModal() {
  const { session } = useAuth();
  const { signOut } = useSignOut();
  const { hasFeature, isAdmin, isLoading } = useUserAccess(session?.user?.id);
  const { isPro } = useUserSubscription();

  // Apenas relevante se rodando em ambiente de APK nativo
  if (!isNativePlatform() || isLoading) {
    return null;
  }

  // Administradores sempre têm passe livre
  if (isAdmin) {
    return null;
  }

  const isApkAllowed = isPro
    ? hasFeature("apk_access_pro")
    : hasFeature("apk_access_free");

  // Se o APK está permitido para o perfil do usuário, não exibe o modal
  if (isApkAllowed) {
    return null;
  }

  const handleOpenBrowser = () => {
    triggerSensory("action");
    const webUrl = getPublicAppUrl("/");
    window.open(webUrl, "_system");
  };

  const handleSignOut = async () => {
    triggerSensory("action");
    await signOut();
  };

  return (
    <Modal
      open={true}
      onOpenChange={() => {}}
      size="sm"
      title="Acesso Beta ao Aplicativo Nativo"
      description="Homologação restrita de versão prévia para smartphones"
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

        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="default"
            onClick={handleOpenBrowser}
            className="w-full flex items-center justify-center gap-2"
          >
            <Globe className="size-4" aria-hidden="true" />
            <span>Acessar via Web / Navegador</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span>Sair da conta</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
