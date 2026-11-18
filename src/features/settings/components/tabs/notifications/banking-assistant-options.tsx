import { useId } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Checkbox, FormField, Select } from "@/components/ui";
import type { BankAssistantPreferences, UnknownCategoryStrategy } from "@/domain/notifications";
import { PROMINENT_DISCLOSURE_INFO } from "@/lib/institutional";
import { cn } from "@/lib/utils";

export interface BankingAssistantOptionsProps {
  bankPrefs: BankAssistantPreferences;
  listenerGranted: boolean;
  onOpenDisclosure: () => void;
  onTogglePassiveCapture: (enabled: boolean) => void;
  onToggleInteractiveNotifications: (enabled: boolean) => void;
  onToggleAutoInstallments: (enabled: boolean) => void;
  onToggleAutoCategoryInference: (enabled: boolean) => void;
  onSelectUnknownCategoryStrategy: (strategy: UnknownCategoryStrategy) => void;
}

export function BankingAssistantOptions({
  bankPrefs,
  listenerGranted,
  onOpenDisclosure,
  onTogglePassiveCapture,
  onToggleInteractiveNotifications,
  onToggleAutoInstallments,
  onToggleAutoCategoryInference,
  onSelectUnknownCategoryStrategy,
}: BankingAssistantOptionsProps) {
  const baseId = useId();
  const passiveId = `${baseId}-passive`;
  const interactiveId = `${baseId}-interactive`;
  const installmentsId = `${baseId}-installments`;
  const inferenceId = `${baseId}-inference`;
  const unknownStrategyId = `${baseId}-unknown-strategy`;

  return (
    <>
      <label
        htmlFor={passiveId}
        className={cn(
          "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer select-none",
          bankPrefs.passiveCaptureEnabled
            ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
            : "border-border/80 bg-surface hover:bg-surface-hover",
        )}
      >
        <div className="min-w-0 pr-2">
          <div className="font-semibold text-sm text-foreground">
            Captura Passiva de Notificações Bancárias
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Detecta compras no cartão, transferências e Pix recebidos/enviados e gera sugestões inteligentes no aplicativo.
          </div>
        </div>
        <Checkbox
          id={passiveId}
          checked={bankPrefs.passiveCaptureEnabled}
          onCheckedChange={onTogglePassiveCapture}
          aria-label="Habilitar Captura Passiva de Notificações"
        />
      </label>

      {bankPrefs.passiveCaptureEnabled && !listenerGranted ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-warning/40 bg-warning/5 gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-xs text-foreground">
              Acesso a Notificações Pendente no Android
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Para detectar compras em segundo plano, conceda acesso ao leitor de notificações nas configurações do dispositivo.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenDisclosure}
              className="border-warning/40 hover:bg-warning/10 text-foreground"
            >
              Habilitar no Android
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onTogglePassiveCapture(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Desativar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 rounded-xl bg-surface-raised/60 p-3.5 text-xs">
        <ShieldCheck className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-semibold text-foreground text-xs">
            {PROMINENT_DISCLOSURE_INFO.onDeviceBadge}
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {PROMINENT_DISCLOSURE_INFO.onDeviceDescription}{" "}
            {PROMINENT_DISCLOSURE_INFO.dataDiscardDescription}
          </p>
        </div>
      </div>

      {bankPrefs.passiveCaptureEnabled ? (
        <div className="space-y-3 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              htmlFor={interactiveId}
              className={cn(
                "flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none",
                bankPrefs.interactiveNotificationsEnabled
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border/80 bg-surface hover:bg-surface-hover",
              )}
            >
              <div className="min-w-0 pr-1">
                <div className="font-semibold text-xs text-foreground">
                  Notificações com Ação Rápida
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Exibe push rico no celular com botões Adicionar Rápido e Editar.
                </div>
              </div>
              <Checkbox
                id={interactiveId}
                checked={bankPrefs.interactiveNotificationsEnabled}
                onCheckedChange={onToggleInteractiveNotifications}
                aria-label="Habilitar Notificações com Ação Rápida"
              />
            </label>

            <label
              htmlFor={installmentsId}
              className={cn(
                "flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none",
                bankPrefs.autoInstallmentsEnabled
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border/80 bg-surface hover:bg-surface-hover",
              )}
            >
              <div className="min-w-0 pr-1">
                <div className="font-semibold text-xs text-foreground">
                  Cálculo Automático de Parcelas
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Identifica compras parceladas e divide os valores mensalmente.
                </div>
              </div>
              <Checkbox
                id={installmentsId}
                checked={bankPrefs.autoInstallmentsEnabled}
                onCheckedChange={onToggleAutoInstallments}
                aria-label="Habilitar Cálculo Automático de Parcelas"
              />
            </label>
          </div>

          <label
            htmlFor={inferenceId}
            className={cn(
              "flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors cursor-pointer select-none",
              bankPrefs.autoCategoryInferenceEnabled
                ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                : "border-border/80 bg-surface hover:bg-surface-hover",
            )}
          >
            <div className="min-w-0 pr-2">
              <div className="font-semibold text-xs text-foreground">
                Inferência Automática de Categorias
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Sugere categorias pelo estabelecimento (alimentação, mercado, transporte, farmácia).
              </div>
            </div>
            <Checkbox
              id={inferenceId}
              checked={bankPrefs.autoCategoryInferenceEnabled}
              onCheckedChange={onToggleAutoCategoryInference}
              aria-label="Habilitar Inferência Automática de Categorias"
            />
          </label>

          <div className="p-3.5 rounded-xl bg-surface-raised/60">
            <FormField
              label="Quando o estabelecimento for novo (categoria desconhecida)"
              htmlFor={unknownStrategyId}
              helperText="Define o comportamento ao confirmar pela notificação bancária no celular quando o app ainda não aprendeu o estabelecimento."
            >
              <Select
                id={unknownStrategyId}
                value={bankPrefs.unknownCategoryHandling}
                onValueChange={(val) =>
                  onSelectUnknownCategoryStrategy(val as UnknownCategoryStrategy)
                }
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
            </FormField>
          </div>
        </div>
      ) : null}
    </>
  );
}
