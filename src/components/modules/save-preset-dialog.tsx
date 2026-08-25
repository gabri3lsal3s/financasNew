import { useState } from "react";
import { BookmarkPlus, Layers, PieChart } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export interface SavePresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description?: string | null) => Promise<void>;
  initialName?: string;
  initialDescription?: string | null;
  assetCount: number;
  classCount: number;
  saving?: boolean;
}

function SavePresetForm({
  onOpenChange,
  onSave,
  initialName = "",
  initialDescription = "",
  assetCount,
  classCount,
  saving = false,
}: Omit<SavePresetDialogProps, "open">) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Informe um nome para o cenário.");
      return;
    }
    if (trimmedName.length > 60) {
      setError("O nome deve ter no máximo 60 caracteres.");
      return;
    }

    setError(null);
    try {
      await onSave(trimmedName, description.trim() || null);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro ao salvar cenário. Tente novamente.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="preset-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Nome do Cenário
        </label>
        <Input
          id="preset-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Foco em Dividendos, Defensiva 2026..."
          maxLength={60}
          disabled={saving}
        />

      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="preset-desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Descrição / Tese (Opcional)
        </label>
        <Input
          id="preset-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex.: Carteira focada em renda passiva e FIIs"
          maxLength={120}
          disabled={saving}
        />
      </div>

      {/* Resumo do Snapshot */}
      <div className="flex items-center gap-4 rounded-xl border border-border/80 bg-surface/50 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <PieChart className="size-4 text-primary" aria-hidden="true" />
          <span>{assetCount} {assetCount === 1 ? "ativo com meta" : "ativos com meta"}</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Layers className="size-4 text-accent" aria-hidden="true" />
          <span>{classCount} {classCount === 1 ? "classe definida" : "classes definidas"}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={saving || !name.trim()}
        >
          <BookmarkPlus className="size-4" aria-hidden="true" />
          {saving ? "Salvando..." : "Salvar Cenário"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Diálogo para salvar o estado atual das metas como um novo cenário (preset).
 */
export function SavePresetDialog(props: SavePresetDialogProps) {
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Salvar Cenário de Alocação"
      description="Salve a configuração atual de metas para simular e alternar estratégias."
      size="sm"
    >
      {props.open ? <SavePresetForm {...props} /> : null}
    </Modal>
  );
}
