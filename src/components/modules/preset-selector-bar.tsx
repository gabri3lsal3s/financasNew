import { useState } from "react";
import {
  BookmarkPlus,
  Compass,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { SYSTEM_PRESET_TEMPLATES } from "@/domain/portfolio/presets";
import type { AllocationPreset } from "@/types";

export interface PresetSelectorBarProps {
  userPresets: readonly AllocationPreset[];
  selectedPresetId: string | null;
  onSelectPreset: (presetId: string) => void;
  onSaveNewPreset: () => void;
  onOverwritePreset?: () => void;
  onDeletePreset?: (presetId: string) => void;
  onResetToOfficial: () => void;
  isSimulating: boolean;
  activePresetName?: string | null;
  activePresetDescription?: string | null;
}

/**
 * Barra de controle de Cenários e Pré-definições de Metas (Presets) no topo do editor.
 */
export function PresetSelectorBar({
  userPresets,
  selectedPresetId,
  onSelectPreset,
  onSaveNewPreset,
  onOverwritePreset,
  onDeletePreset,
  onResetToOfficial,
  isSimulating,
  activePresetName,
  activePresetDescription,
}: PresetSelectorBarProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Monta as opções do Select
  const options: SelectOption[] = [
    { value: "official", label: "Metas Oficiais da Carteira (Ativas)" },
  ];

  // Cenários do Usuário
  for (const p of userPresets) {
    options.push({ value: `user_${p.id}`, label: `Cenário: ${p.name}` });
  }

  // Modelos do Sistema
  for (const s of SYSTEM_PRESET_TEMPLATES) {
    options.push({ value: `sys_${s.id}`, label: `Modelo: ${s.name}` });
  }

  const currentValue = selectedPresetId ?? "official";
  const isUserPreset = selectedPresetId?.startsWith("user_") ?? false;
  const rawUserPresetId = isUserPreset ? selectedPresetId!.replace("user_", "") : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/40 p-3 sm:p-4 shadow-xs backdrop-blur-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Seletor de Cenários */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Compass className="size-4 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">Cenário:</span>
          </div>
          <div className="flex-1 min-w-[200px] max-w-md">
            <Select
              value={currentValue}
              onValueChange={onSelectPreset}
              options={options}
              ariaLabel="Selecione um cenário ou modelo de metas"
            />
          </div>
        </div>

        {/* Botão de Salvar Novo Cenário */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveNewPreset}
            className="w-full sm:w-auto"
          >
            <BookmarkPlus className="size-3.5" aria-hidden="true" />
            <span>Salvar como cenário</span>
          </Button>
        </div>
      </div>

      {/* Banner de Modo Simulação / Prévia */}
      {isSimulating ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-primary/25 bg-primary/5 p-2.5 sm:px-3.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="default" className="shrink-0">
              Modo Simulação
            </Badge>
            <span className="truncate text-foreground font-medium">
              {activePresetName ? `Explorando: ${activePresetName}` : "Explorando cenário alternativo"}
            </span>
            {activePresetDescription ? (
              <span className="hidden md:inline text-muted-foreground truncate max-w-sm">
                · {activePresetDescription}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {isUserPreset && onOverwritePreset ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOverwritePreset}
                className="h-7 px-2 text-xs"
                title="Salvar alterações no cenário selecionado"
              >
                <Save className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Sobrescrever cenário</span>
              </Button>
            ) : null}

            {isUserPreset && onDeletePreset && rawUserPresetId ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteOpen(true)}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Excluir este cenário"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Excluir</span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetToOfficial}
              className="h-7 px-2 text-xs"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>Restaurar oficiais</span>
            </Button>
          </div>
        </div>
      ) : null}

      {/* Diálogo de Confirmação de Exclusão */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Excluir Cenário de Alocação"
        description={`Tem certeza que deseja excluir o cenário "${activePresetName}"? Suas metas oficiais não serão afetadas.`}
        confirmLabel="Excluir Cenário"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          if (rawUserPresetId && onDeletePreset) {
            onDeletePreset(rawUserPresetId);
          }
          setConfirmDeleteOpen(false);
        }}
      />
    </div>
  );
}
