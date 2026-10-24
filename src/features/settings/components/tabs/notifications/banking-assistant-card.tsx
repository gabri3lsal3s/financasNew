import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  CreditCard,
  Download,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Select,
} from "@/components/ui";
import { PROMINENT_DISCLOSURE_INFO } from "@/lib/institutional";
import { triggerSensory } from "@/services/sensory";
import { useUpdateCustomSettings } from "@/state";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import {
  useBankAssistantPreferences,
  isNotificationListenerGranted,
  requestNotificationListenerPermission,
  getInstalledBankingApps,
  isNativePlatform,
  type InstalledBankApp,
} from "@/services/native";
import {
  HOMOLOGATED_BANKS,
  HOMOLOGATED_INSTITUTIONS,
  type InstitutionCategory,
  type UnknownCategoryStrategy,
} from "@/domain/notifications";
import { BankingCatalogAccordion } from "./banking-catalog-accordion";
import { ProminentDisclosureModal } from "./prominent-disclosure-modal";

function getCategoryLabel(category: InstitutionCategory): string {
  switch (category) {
    case "traditional_digital":
      return "Banco";
    case "payment_wallets":
      return "Carteira";
    case "investments_crypto":
      return "Investimentos";
  }
}

export function BankingAssistantCard() {
  const navigate = useNavigate();
  const updateCustomSettingsMutation = useUpdateCustomSettings();
  const { preferences: bankPrefs, updatePreferences: updateBankPrefs } = useBankAssistantPreferences();

  const [listenerPermissionGranted, setListenerPermissionGranted] = useState(true);
  const [isDisclosureModalOpen, setIsDisclosureModalOpen] = useState(false);
  const [installedBanks, setInstalledBanks] = useState<string[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledBankApp[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const isNative = isNativePlatform();

  useEffect(() => {
    if (isNative) {
      void isNotificationListenerGranted().then((granted) => {
        setListenerPermissionGranted(granted);
      });
      void getInstalledBankingApps().then((res) => {
        setInstalledBanks(res.installedBankNames || []);
        setInstalledApps(res.apps || []);
      });
    }
  }, [isNative]);

  const handleRescanBankingApps = async () => {
    triggerSensory("action");
    setIsScanning(true);
    try {
      const res = await getInstalledBankingApps();
      const detectedNames = res?.installedBankNames || [];
      const detectedApps = res?.apps || [];
      setInstalledBanks(detectedNames);
      setInstalledApps(detectedApps);

      if (detectedNames.length === 0) {
        pushToast({
          title: "Nenhum aplicativo detectado",
          description: "Nenhum aplicativo bancário suportado foi encontrado no dispositivo.",
          variant: "default",
        });
      } else {
        const count = detectedNames.length;
        pushToast({
          title: "Lista de aplicativos atualizada",
          description:
            count === 1
              ? "1 aplicativo bancário detectado no dispositivo."
              : `${count} aplicativos bancários detectados no dispositivo.`,
          variant: "success",
        });
      }
    } catch {
      pushToast({
        title: "Erro ao escanear aplicativos",
        description: "Não foi possível verificar os aplicativos bancários instalados.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleTogglePassiveCapture = async (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ passiveCaptureEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { passiveCaptureEnabled: enabled },
    });

    if (enabled) {
      const granted = await isNotificationListenerGranted();
      setListenerPermissionGranted(granted);
      if (!granted) {
        setIsDisclosureModalOpen(true);
      } else {
        pushToast({
          title: "Captura de compras ativada",
          description: "Notificações bancárias serão detectadas e convertidas em sugestões.",
        });
      }
    } else {
      pushToast({
        title: "Captura de compras desativada",
        description: "Nenhuma notificação bancária será processada.",
      });
    }
  };

  const handleConfirmDisclosure = async () => {
    setIsDisclosureModalOpen(false);
    triggerSensory("action");
    await requestNotificationListenerPermission();
    const granted = await isNotificationListenerGranted();
    setListenerPermissionGranted(granted);
    if (!granted) {
      pushToast({
        title: "Permissão pendente no Android",
        description: "Habilite o Áxis Finance nas configurações de Acesso a Notificações do seu aparelho.",
        variant: "warning",
      });
    } else {
      pushToast({
        title: "Permissão concedida",
        description: "Captura passiva de notificações bancárias autorizada.",
        variant: "success",
      });
    }
  };

  const handleToggleInteractiveNotifications = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ interactiveNotificationsEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { interactiveNotificationsEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Notificações com botões de ação rápida ativadas."
        : "Notificações silenciosas ativadas (apenas card discreto na tela inicial).",
    });
  };

  const handleToggleAutoInstallments = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ autoInstallmentsEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { autoInstallmentsEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Detecção e desmembramento automático de parcelas ativado."
        : "Cálculo de parcelas desativado (compras tratadas como parcela única).",
    });
  };

  const handleToggleAutoCategoryInference = (enabled: boolean) => {
    triggerSensory("toggle");
    updateBankPrefs({ autoCategoryInferenceEnabled: enabled });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { autoCategoryInferenceEnabled: enabled },
    });
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? "Inferência automática de categorias ativada."
        : "Inferência desativada (seleção manual exigida).",
    });
  };

  const handleToggleBank = (bankName: string, nextChecked: boolean) => {
    triggerSensory("toggle");
    const currentList = bankPrefs.monitoredBanks;
    const nextList = nextChecked
      ? [...new Set([...currentList, bankName])]
      : currentList.filter((b) => b !== bankName);

    updateBankPrefs({ monitoredBanks: nextList });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: nextList },
    });
  };

  const handleSelectAllBanks = () => {
    const all = [...HOMOLOGATED_BANKS];
    updateBankPrefs({ monitoredBanks: all });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: all },
    });
    pushToast({
      title: "Todos os bancos selecionados",
      description: `Todos os ${HOMOLOGATED_BANKS.length} bancos homologados estão sendo monitorados.`,
    });
  };

  const handleDeselectAllBanks = () => {
    updateBankPrefs({ monitoredBanks: [] });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: [] },
    });
    pushToast({
      title: "Todos os bancos desmarcados",
      description: "Nenhum banco está selecionado para captura.",
    });
  };

  const handleSelectOnlyInstalledBanks = () => {
    if (installedBanks.length === 0) return;
    const nextList = [...new Set([...bankPrefs.monitoredBanks, ...installedBanks])];
    updateBankPrefs({ monitoredBanks: nextList });
    updateCustomSettingsMutation.mutate({
      bankAssistant: { monitoredBanks: nextList },
    });
    pushToast({
      title: "Bancos instalados selecionados",
      description: `${installedBanks.length} aplicativo(s) bancário(s) detectado(s) no dispositivo estão sendo monitorados.`,
      variant: "success",
    });
  };

  if (!isNative) {
    return (
      <Card className="border-border/80 bg-surface shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2 min-w-0">
              <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Assistente Passivo de Compras &amp; Bancos</span>
            </span>
            <Badge variant="default" size="xs">
              Exclusivo no App Android
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-surface to-surface p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Zap className="size-3.5" aria-hidden="true" />
                  <span>Automação em Segundo Plano</span>
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  Leitura Automática de Comprovantes Pix e Notificações de Cartão
                </h4>
                <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                  Disponível através do Aplicativo Android Pro. Ele escuta notificações de mais de 20 bancos (Nubank, Itaú, Inter, etc.) e sugere o lançamento imediatamente com um único toque, com 100% de privacidade local no celular.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/configuracoes?tab=devices")}
                  className="gap-2 text-xs"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  <span>Baixar App Pro</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2 min-w-0">
              <CreditCard className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>Assistente Passivo de Compras &amp; Bancos</span>
            </span>
            <Badge variant={bankPrefs.passiveCaptureEnabled ? "positive" : "muted"} size="xs">
              {bankPrefs.passiveCaptureEnabled ? "Ativado" : "Desativado"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle Mestre */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleTogglePassiveCapture(!bankPrefs.passiveCaptureEnabled)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleTogglePassiveCapture(!bankPrefs.passiveCaptureEnabled);
              }
            }}
            className={cn(
              "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
              bankPrefs.passiveCaptureEnabled
                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                : "border-border/80 bg-surface hover:bg-surface-hover",
            )}
          >
            <div className="pr-4">
              <div className="font-semibold text-sm text-foreground">
                Captura Passiva de Notificações Bancárias
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Detecta compras no cartão, transferências e Pix recebidos/enviados e gera sugestões inteligentes no aplicativo.
              </div>
            </div>
            <Checkbox
              checked={bankPrefs.passiveCaptureEnabled}
              onCheckedChange={handleTogglePassiveCapture}
              aria-label="Habilitar Captura Passiva de Notificações"
            />
          </div>

          {/* Alerta de permissão do Android se pendente */}
          {bankPrefs.passiveCaptureEnabled && !listenerPermissionGranted && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-warning/40 bg-warning/5 gap-3">
              <div>
                <div className="font-semibold text-xs text-foreground">
                  Acesso a Notificações Pendente no Android
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Para detectar compras em segundo plano, conceda acesso ao leitor de notificações nas configurações do dispositivo.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDisclosureModalOpen(true)}
                className="shrink-0 text-xs gap-1.5"
              >
                <span>Habilitar no Android</span>
              </Button>
            </div>
          )}

          {/* Divulgação Destacada de Privacidade */}
          <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface-hover/30 p-3.5 text-xs">
            <ShieldCheck className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-semibold text-foreground text-xs">
                {PROMINENT_DISCLOSURE_INFO.onDeviceBadge}
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {PROMINENT_DISCLOSURE_INFO.onDeviceDescription} {PROMINENT_DISCLOSURE_INFO.dataDiscardDescription}
              </p>
            </div>
          </div>

          {/* Opções Detalhadas se o Toggle Mestre estiver ativo */}
          {bankPrefs.passiveCaptureEnabled && (
            <div className="space-y-3 pt-1">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Notificações Interativas */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleInteractiveNotifications(!bankPrefs.interactiveNotificationsEnabled)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleInteractiveNotifications(!bankPrefs.interactiveNotificationsEnabled);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                    bankPrefs.interactiveNotificationsEnabled
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      : "border-border/80 bg-surface hover:bg-surface-hover",
                  )}
                >
                  <div className="pr-3">
                    <div className="font-semibold text-xs text-foreground">
                      Notificações com Ação Rápida
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Exibe push rico no celular com botões Adicionar Rápido e Editar.
                    </div>
                  </div>
                  <Checkbox
                    checked={bankPrefs.interactiveNotificationsEnabled}
                    onCheckedChange={handleToggleInteractiveNotifications}
                    aria-label="Habilitar Notificações com Ação Rápida"
                  />
                </div>

                {/* Parcelamento Automático */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggleAutoInstallments(!bankPrefs.autoInstallmentsEnabled)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleToggleAutoInstallments(!bankPrefs.autoInstallmentsEnabled);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                    bankPrefs.autoInstallmentsEnabled
                      ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                      : "border-border/80 bg-surface hover:bg-surface-hover",
                  )}
                >
                  <div className="pr-3">
                    <div className="font-semibold text-xs text-foreground">
                      Cálculo Automático de Parcelas
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Identifica compras parceladas e divide os valores mensalmente.
                    </div>
                  </div>
                  <Checkbox
                    checked={bankPrefs.autoInstallmentsEnabled}
                    onCheckedChange={handleToggleAutoInstallments}
                    aria-label="Habilitar Cálculo Automático de Parcelas"
                  />
                </div>
              </div>

              {/* Inferência de Categorias */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleToggleAutoCategoryInference(!bankPrefs.autoCategoryInferenceEnabled)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleAutoCategoryInference(!bankPrefs.autoCategoryInferenceEnabled);
                  }
                }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer select-none",
                  bankPrefs.autoCategoryInferenceEnabled
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border/80 bg-surface hover:bg-surface-hover",
                )}
              >
                <div className="pr-3">
                  <div className="font-semibold text-xs text-foreground">
                    Inferência Automática de Categorias
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Sugere categorias pelo estabelecimento (alimentação, mercado, transporte, farmácia).
                  </div>
                </div>
                <Checkbox
                  checked={bankPrefs.autoCategoryInferenceEnabled}
                  onCheckedChange={handleToggleAutoCategoryInference}
                  aria-label="Habilitar Inferência Automática de Categorias"
                />
              </div>

              {/* Ação para Categoria Desconhecida */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs space-y-2">
                <div>
                  <span className="text-xs font-semibold text-foreground">
                    Quando o estabelecimento for novo (categoria desconhecida)
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Define o comportamento ao confirmar pela notificação bancária no celular quando o app ainda não aprendeu o estabelecimento.
                  </p>
                </div>
                <Select
                  value={bankPrefs.unknownCategoryHandling}
                  onValueChange={(val) => {
                    const next = val as UnknownCategoryStrategy;
                    updateBankPrefs({ unknownCategoryHandling: next });
                  }}
                  options={[
                    {
                      value: "assign_generic_and_prompt",
                      label: "Atribuir à categoria genérica e pedir confirmação na Home",
                    },
                    {
                      value: "open_quick_wizard",
                      label: "Sempre abrir o Wizard Rápido para escolher a categoria",
                    },
                  ]}
                  ariaLabel="Ação para categoria desconhecida"
                />
              </div>

              {/* Aplicativos no seu Dispositivo */}
              <div className="pt-2 border-t border-border/80 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="font-semibold text-xs text-foreground">
                      Aplicativos no seu Dispositivo
                    </span>
                    {installedBanks.length > 0 && (
                      <Badge variant="positive" size="xs">
                        {installedBanks.length} detectado{installedBanks.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleRescanBankingApps}
                      disabled={isScanning}
                      className="text-[11px] h-7 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground"
                      aria-label="Re-escanear aplicativos instalados"
                    >
                      <RefreshCw
                        className={cn("size-3", isScanning && "animate-spin")}
                        aria-hidden="true"
                      />
                      <span>{isScanning ? "Escaneando..." : "Re-escanear"}</span>
                    </Button>
                    {installedBanks.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={handleSelectOnlyInstalledBanks}
                        className="text-[11px] h-7 px-2 text-primary hover:text-primary-hover font-medium"
                      >
                        Monitorar todos os instalados
                      </Button>
                    )}
                  </div>
                </div>

                {installedBanks.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-border/80 bg-surface/50 text-center space-y-2.5">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        Nenhum aplicativo bancário suportado detectado automaticamente no dispositivo
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Explore o catálogo completo abaixo para ativar manualmente as instituições que você utiliza.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleRescanBankingApps}
                      disabled={isScanning}
                      className="text-[11px] h-7 px-3 gap-1.5 mx-auto"
                    >
                      <RefreshCw
                        className={cn("size-3", isScanning && "animate-spin")}
                        aria-hidden="true"
                      />
                      <span>{isScanning ? "Escaneando..." : "Re-escanear aplicativos"}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {installedBanks.map((bankName) => {
                      const institution = HOMOLOGATED_INSTITUTIONS.find(
                        (inst) =>
                          inst.name.toLowerCase() === bankName.toLowerCase() ||
                          inst.packages.some((pkg) =>
                            installedApps.some(
                              (app) =>
                                app.packageName === pkg &&
                                app.bankName.toLowerCase() === bankName.toLowerCase(),
                            ),
                          ),
                      );
                      const isChecked = bankPrefs.monitoredBanks.includes(bankName);
                      const categoryLabel = institution
                        ? getCategoryLabel(institution.category)
                        : "Banco";

                      return (
                        <div
                          key={bankName}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleToggleBank(bankName, !isChecked)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleToggleBank(bankName, !isChecked);
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border text-xs transition-colors cursor-pointer select-none shadow-xs",
                            isChecked
                              ? "border-primary/40 bg-primary/5 hover:bg-primary/10 font-medium text-foreground"
                              : "border-border/80 bg-surface hover:bg-surface-hover text-muted-foreground",
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {bankName}
                            </span>
                            <Badge variant={isChecked ? "positive" : "muted"} size="xs">
                              {categoryLabel}
                            </Badge>
                          </div>
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => handleToggleBank(bankName, Boolean(checked))}
                            aria-label={`Monitorar ${bankName}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Catálogo Geral em Accordion */}
              <BankingCatalogAccordion
                monitoredBanks={bankPrefs.monitoredBanks}
                installedBanks={installedBanks}
                installedApps={installedApps}
                onToggleBank={handleToggleBank}
                onSelectAll={handleSelectAllBanks}
                onDeselectAll={handleDeselectAllBanks}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ProminentDisclosureModal
        open={isDisclosureModalOpen}
        onOpenChange={setIsDisclosureModalOpen}
        onConfirm={handleConfirmDisclosure}
      />
    </>
  );
}
