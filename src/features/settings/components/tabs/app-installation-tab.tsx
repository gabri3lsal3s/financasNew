import { useState } from "react";
import {
  Smartphone,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  ChevronDown,
  Info,
  QrCode,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppUpdate } from "@/hooks/use-app-update";
import { isNativePlatform } from "@/services/native/platform";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";

export function AppInstallationTab() {
  const isNative = isNativePlatform();
  const { isInstalled, isIOS } = usePWAInstall();
  const {
    status,
    isChecking,
    hasUpdate,
    updateInfo,
    error,
    checkForUpdates,
    installUpdate,
  } = useAppUpdate({ autoCheck: true });

  const [showGuide, setShowGuide] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  const handleManualCheck = async () => {
    const res = await checkForUpdates(false);
    if (res.hasUpdate) {
      pushToast({
        title: "Nova versão encontrada!",
        description: `A versão ${res.latestVersion} está disponível para atualização.`,
        variant: "info",
      });
    } else if (res.error) {
      pushToast({
        title: "Falha na verificação",
        description: res.error,
        variant: "destructive",
      });
    } else {
      pushToast({
        title: "Aplicativo atualizado",
        description: "Você já está na versão mais recente disponível.",
        variant: "success",
      });
    }
  };

  const handleDownloadApk = async () => {
    try {
      if (updateInfo?.manifest) {
        await installUpdate();
      } else {
        const apkDownloadUrl = "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk";
        const link = document.createElement("a");
        link.href = apkDownloadUrl;
        link.download = "axis-pro.apk";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      pushToast({
        title: "Download iniciado",
        description: "O download do instalador Android foi iniciado.",
        variant: "info",
      });
    } catch {
      pushToast({
        title: "Falha ao baixar",
        description: "Não foi possível iniciar o download do APK.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Status Atual de Plataforma */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Smartphone className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Plataforma em Uso
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isNative
                  ? "Aplicativo Nativo Android Pro com automação em tempo real"
                  : isInstalled
                  ? "Progressive Web App (PWA) instalado na tela de início"
                  : isIOS
                  ? "Acesso Web no ecossistema Apple iOS"
                  : "Acesso via navegador web desktop ou móvel"}
              </p>
            </div>
          </div>
          <Badge
            variant={isNative ? "positive" : "muted"}
            size="sm"
            className="self-start sm:self-auto"
          >
            {isNative
              ? "Android Pro Nativo"
              : isInstalled
              ? "PWA Instalado"
              : isIOS
              ? "iOS Web"
              : "Web Online"}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {/* Bloco exclusivo para Android Nativo */}
          {isNative ? (
            <div className="space-y-4 rounded-xl border border-border/80 bg-background/50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-3">
                <div>
                  <span className="text-xs text-muted-foreground block">Versão Instalada</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    v{updateInfo?.currentVersion || "1.0.0"} (Build {updateInfo?.currentVersionCode || 1})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleManualCheck}
                  disabled={isChecking || status === "downloading"}
                  className="gap-2 cursor-pointer border-border/80 bg-surface"
                >
                  <RefreshCw
                    className={cn("size-3.5 text-muted-foreground", isChecking && "animate-spin text-primary")}
                    aria-hidden="true"
                  />
                  <span>{isChecking ? "Verificando..." : "Verificar atualizações"}</span>
                </Button>
              </div>

              {hasUpdate && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" aria-hidden="true" />
                      <span className="text-sm font-semibold text-foreground">
                        Nova versão disponível: v{updateInfo?.latestVersion}
                      </span>
                    </div>
                    <Badge variant="default" size="xs">
                      Build {updateInfo?.latestVersionCode}
                    </Badge>
                  </div>

                  {updateInfo?.manifest?.changelog && updateInfo.manifest.changelog.length > 0 && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {updateInfo.manifest.changelog.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="size-3 text-positive shrink-0" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={installUpdate}
                    disabled={status === "downloading"}
                    className="w-full sm:w-auto gap-2"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    <span>{status === "downloading" ? "Baixando atualização..." : "Atualizar agora (sem desinstalar)"}</span>
                  </Button>
                </div>
              )}

              {!hasUpdate && !isChecking && !error && (
                <div className="flex items-center gap-2 text-xs text-positive">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                  <span>Seu aplicativo Android está atualizado com a versão mais recente.</span>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-destructive font-medium">
                    <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                    <span>Não foi possível verificar atualizações: {error}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleManualCheck}
                    disabled={isChecking}
                    className="text-xs cursor-pointer gap-1.5 border-border/80 bg-surface"
                  >
                    <RefreshCw className={cn("size-3 text-muted-foreground", isChecking && "animate-spin text-primary")} aria-hidden="true" />
                    <span>Tentar novamente</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Bloco de Apresentação e Download para quem está no Web / PWA */
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-surface to-surface p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Zap className="size-3.5" aria-hidden="true" />
                      <span>Automação Exclusiva em Segundo Plano</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                      Aplicativo Android Pro com Assistente Bancário
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
                      Reconhece compras no cartão e transações Pix no exato momento em que ocorrem,
                      eliminando a necessidade de anotação manual. Tudo local no seu celular, sem
                      Open Banking invasivo.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleDownloadApk}
                      className="gap-2"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      <span>Baixar App Android Pro</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQrCode((prev) => !prev)}
                      className="gap-2 border-border/80 bg-surface"
                      aria-label="Exibir código QR para escanear no celular"
                    >
                      <QrCode className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>QR Code</span>
                    </Button>
                  </div>
                </div>

                {/* Bloco de QR Code condicional */}
                {showQrCode && (
                  <div className="mt-3 p-4 rounded-xl border border-border/80 bg-background/80 flex flex-col items-center justify-center gap-2 text-center">
                    <p className="text-xs text-muted-foreground">
                      Abra a câmera do seu celular Android e aponte para o link direto de download:
                    </p>
                    <div className="p-3 bg-white rounded-lg inline-block shadow-sm">
                      {/* Imagem ou representação com link */}
                      <div className="font-mono text-xs text-neutral-800 break-all max-w-xs">
                        {updateInfo?.manifest?.apkUrl || "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/guia-financeiro-release.apk"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Guia passo a passo de instalação */}
              <div className="rounded-xl border border-border/80 bg-background/40">
                <button
                  type="button"
                  onClick={() => setShowGuide((prev) => !prev)}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-foreground cursor-pointer"
                  aria-expanded={showGuide}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-semibold">
                      Passo a passo: como instalar o APK com segurança no Android
                    </span>
                  </div>
                  <ChevronDown
                    className={cn("size-4 text-muted-foreground transition-transform duration-200", showGuide && "rotate-180")}
                    aria-hidden="true"
                  />
                </button>

                {showGuide && (
                  <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground space-y-2.5 border-t border-border/50">
                    <div className="flex gap-2.5">
                      <span className="font-mono font-bold text-primary shrink-0">1.</span>
                      <span>
                        Clique em <strong>Baixar App Android Pro</strong>. O navegador iniciará o download do arquivo <code>axis-pro.apk</code>.
                      </span>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="font-mono font-bold text-primary shrink-0">2.</span>
                      <span>
                        Ao abrir o arquivo, se o Android exibir o aviso padrão de segurança <em>"Por motivos de segurança, seu telefone não pode instalar apps desconhecidos desta fonte"</em>, toque em <strong>Configurações</strong> e ative <strong>Permitir desta fonte</strong>.
                      </span>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="font-mono font-bold text-primary shrink-0">3.</span>
                      <span>
                        Toque em <strong>Instalar</strong>. Pronto! Todas as atualizações futuras poderão ser feitas diretamente por esta tela com 1 toque, sem precisar reinstalar.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Comparativo do Tripé de Plataformas */}
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>O Tripé de Plataformas do Áxis</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sua assinatura concede acesso simultâneo a todos os formatos sem custo extra.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-border/70 bg-background/50 space-y-1.5">
              <span className="font-bold text-foreground block">Web Desktop</span>
              <p className="text-muted-foreground leading-relaxed">
                Ideal para relatórios em tela ampla, simulações de independência financeira (FIRE),
                conciliação bancária e rebalanceamento de carteira.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-border/70 bg-background/50 space-y-1.5">
              <span className="font-bold text-foreground block">Mobile PWA (Web App)</span>
              <p className="text-muted-foreground leading-relaxed">
                Acesso leve e instantâneo no iPhone ou Android. Não consome espaço na memória, não
                exige downloads pesados e abre em tela cheia.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-1.5">
              <span className="font-bold text-primary-strong block">Android Pro Nativo</span>
              <p className="text-muted-foreground leading-relaxed">
                Leitor passivo inteligente de notificações bancárias (Pix e cartões em tempo real),
                biometria física, atalhos rápidos e atualizações automáticas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
