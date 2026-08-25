import {
  Volume2,
  VolumeX,
  Vibrate,
  VibrateOff,
  MousePointerClick,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Checkbox,
} from "@/components/ui";
import { useVisualCustomization } from "@/hooks/use-visual-customization";
import { triggerSensory, type SensoryIntent } from "@/services/sensory";
import { useUpdateCustomSettings } from "@/state";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";

interface SensoryCategoryDefinition {
  id: SensoryIntent;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const SENSORY_CATEGORIES: SensoryCategoryDefinition[] = [
  {
    id: "selection",
    title: "Navegação & Seleção",
    description: "Abas, seletores de data, dropdowns e steppers de números.",
    icon: <MousePointerClick className="size-4 text-primary" aria-hidden="true" />,
  },
  {
    id: "action",
    title: "Ações & Comandos",
    description: "Cliques em botões primários/secundários e botão central (+ Novo).",
    icon: <Zap className="size-4 text-primary" aria-hidden="true" />,
  },
  {
    id: "toggle",
    title: "Alternâncias & Switches",
    description: "Modo privacidade, switches de configuração e atalhos rápidos.",
    icon: <Sliders className="size-4 text-primary" aria-hidden="true" />,
  },
  {
    id: "success",
    title: "Sucesso & Confirmações",
    description: "Conclusão de lançamentos, metas, pagamentos e importações.",
    icon: <CheckCircle2 className="size-4 text-positive-strong" aria-hidden="true" />,
  },
  {
    id: "warning",
    title: "Alertas & Atenções",
    description: "Avisos de confirmação e alertas de atenção.",
    icon: <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />,
  },
  {
    id: "destructive",
    title: "Exclusões & Ações Destrutivas",
    description: "Remoção de lançamentos, contas e ativos da carteira.",
    icon: <Trash2 className="size-4 text-critical-strong" aria-hidden="true" />,
  },
  {
    id: "error",
    title: "Erros & Impedimentos",
    description: "Falhas de validação de formulários e bloqueios.",
    icon: <AlertCircle className="size-4 text-critical-strong" aria-hidden="true" />,
  },
];

export function SensoryTab() {
  const visual = useVisualCustomization();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const handleToggleSound = (nextChecked: boolean) => {
    triggerSensory("action");
    visual.setSoundEnabled(nextChecked);
    updateCustomSettingsMutation.mutate({ soundEnabled: nextChecked });
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? "Feedback sonoro ativado."
        : "Feedback sonoro desativado.",
      duration: 2200,
    });
  };

  const handleToggleHaptic = (nextChecked: boolean) => {
    triggerSensory("action");
    visual.setHapticEnabled(nextChecked);
    updateCustomSettingsMutation.mutate({ hapticEnabled: nextChecked });
    pushToast({
      title: "Preferências salvas",
      description: nextChecked
        ? "Feedback háptico (vibração) ativado."
        : "Feedback háptico (vibração) desativado.",
      duration: 2200,
    });
  };

  const handleToggleSensoryCategory = (intent: SensoryIntent, enabled: boolean, title: string) => {
    visual.toggleSensoryIntent(intent, enabled);
    const current = visual.disabledSensoryIntents ?? [];
    const next = enabled
      ? current.filter((i) => i !== intent)
      : current.includes(intent)
        ? current
        : [...current, intent];
    updateCustomSettingsMutation.mutate({ disabledSensoryIntents: next });
    if (enabled) {
      triggerSensory(intent);
    }
    pushToast({
      title: "Preferências salvas",
      description: enabled
        ? `Feedback para "${title}" ativado.`
        : `Feedback para "${title}" desativado.`,
      duration: 2200,
    });
  };

  const handleEnableAllSensoryCategories = () => {
    visual.setDisabledSensoryIntents([]);
    updateCustomSettingsMutation.mutate({ disabledSensoryIntents: [] });
    triggerSensory("success");
    pushToast({
      title: "Preferências salvas",
      description: "Todas as categorias sensoriais foram ativadas.",
      duration: 2200,
    });
  };

  const handleTestSensory = (intent: SensoryIntent) => {
    triggerSensory(intent);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-primary" />
              <span>Feedback Sensorial (Som & Vibração)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant={visual.soundEnabled ? "positive" : "muted"}>
                {visual.soundEnabled ? "Som: On" : "Som: Off"}
              </Badge>
              <Badge variant={visual.hapticEnabled ? "positive" : "muted"}>
                {visual.hapticEnabled ? "Tátil: On" : "Tátil: Off"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle de Som */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleToggleSound(!visual.soundEnabled)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggleSound(!visual.soundEnabled);
              }
            }}
            className={cn(
              "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
              visual.soundEnabled
                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <div className="pr-4">
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                {visual.soundEnabled ? (
                  <Volume2 className="size-4 text-primary" />
                ) : (
                  <VolumeX className="size-4 text-muted-foreground" />
                )}
                <span>Sons de Interface Sutis</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Síntese ultraleve de áudio (Web Audio API) em cliques, confirmações e alertas.
              </div>
            </div>
            <Checkbox
              checked={visual.soundEnabled}
              onCheckedChange={(checked) => handleToggleSound(Boolean(checked))}
              aria-label="Sons de Interface Sutis"
            />
          </div>

          {/* Toggle de Vibração Háptica */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleToggleHaptic(!visual.hapticEnabled)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggleHaptic(!visual.hapticEnabled);
              }
            }}
            className={cn(
              "flex items-center justify-between p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
              visual.hapticEnabled
                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <div className="pr-4">
              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                {visual.hapticEnabled ? (
                  <Vibrate className="size-4 text-primary" />
                ) : (
                  <VibrateOff className="size-4 text-muted-foreground" />
                )}
                <span>Feedback Háptico (Vibração)</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Micro-vibrações táteis calibradas em botões, abas e ações de conclusão no mobile.
              </div>
            </div>
            <Checkbox
              checked={visual.hapticEnabled}
              onCheckedChange={(checked) => handleToggleHaptic(Boolean(checked))}
              aria-label="Feedback Háptico (Vibração)"
            />
          </div>

          {/* Categorias Granulares de Feedback Sensorial */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Categorias de Microinteração
                </h4>
                <p className="text-xs text-muted-foreground">
                  Ative ou desative o feedback para categorias específicas conforme sua preferência.
                </p>
              </div>
              {visual.disabledSensoryIntents.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-primary"
                  onClick={handleEnableAllSensoryCategories}
                >
                  Ativar todas ({SENSORY_CATEGORIES.length})
                </Button>
              )}
            </div>

            <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden">
              {SENSORY_CATEGORIES.map((cat) => {
                const isEnabled = !visual.disabledSensoryIntents.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    className={cn(
                      "flex items-center justify-between p-3.5 transition-colors",
                      isEnabled ? "hover:bg-surface-hover/60" : "bg-muted/20 opacity-75",
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1 pr-3">
                      <div className="mt-0.5 shrink-0">{cat.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground truncate">
                            {cat.title}
                          </span>
                          <Badge variant={isEnabled ? "positive" : "muted"} className="text-[10px] py-0 px-1.5">
                            {isEnabled ? "Ativo" : "Silenciado"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {cat.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-8 px-2.5"
                        onClick={() => handleTestSensory(cat.id)}
                        title={`Testar feedback de ${cat.title}`}
                      >
                        Testar
                      </Button>
                      <Checkbox
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          handleToggleSensoryCategory(cat.id, Boolean(checked), cat.title)
                        }
                        aria-label={`Feedback para ${cat.title}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botões de Teste Sensorial Rápido */}
          <div className="p-4 rounded-xl border border-border bg-muted/40 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Testar Microinterações Sensoriais
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => handleTestSensory("action")}>
                Micro-Clique
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleTestSensory("toggle")}>
                Spring Pop
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleTestSensory("success")}>
                Sucesso
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleTestSensory("warning")}>
                Alerta
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleTestSensory("destructive")}>
                Exclusão
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleTestSensory("error")}>
                Erro
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
