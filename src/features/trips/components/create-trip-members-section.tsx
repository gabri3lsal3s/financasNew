import { Plus, Trash2, Users } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import type { TripPixKeyType } from "@/types/trips";

export interface InitialTripMemberDraft {
  name: string;
  pix_key?: string;
  pix_key_type?: TripPixKeyType;
}

const PIX_TYPE_OPTIONS = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Aleatória" },
];

export interface CreateTripMembersSectionProps {
  hostName: string;
  members: InitialTripMemberDraft[];
  newMemberName: string;
  onNewMemberNameChange: (val: string) => void;
  newMemberPix: string;
  onNewMemberPixChange: (val: string) => void;
  newMemberPixType: TripPixKeyType;
  onNewMemberPixTypeChange: (val: TripPixKeyType) => void;
  onAddMember: () => void;
  onRemoveMember: (index: number) => void;
}

export function CreateTripMembersSection({
  hostName,
  members,
  newMemberName,
  onNewMemberNameChange,
  newMemberPix,
  onNewMemberPixChange,
  newMemberPixType,
  onNewMemberPixTypeChange,
  onAddMember,
  onRemoveMember,
}: CreateTripMembersSectionProps) {
  return (
    <div className="space-y-3 pt-2 border-t border-border/80">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>Participantes do Grupo</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          {hostName.trim() ? `${hostName.trim()} (Organizador)` : "Organizador já incluído"}
        </span>
      </div>

      {members.length > 0 && (
        <div className="space-y-1.5">
          {members.map((m, idx) => (
            <div
              key={`${m.name}-${idx}`}
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-raised border border-border/80 text-xs"
            >
              <div className="min-w-0">
                <span className="font-semibold text-foreground">{m.name}</span>
                {m.pix_key && (
                  <span className="text-[11px] text-muted-foreground ml-2 font-mono">
                    Pix: {m.pix_key}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveMember(idx)}
                className="size-8 shrink-0 text-muted-foreground hover:text-critical-strong"
                title="Remover participante"
                aria-label={`Remover ${m.name}`}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 rounded-xl bg-surface border border-border/80 space-y-2.5">
        <p className="text-[11px] font-medium text-muted-foreground">
          Adicionar amigos que vão viajar com você:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-5">
            <Input
              value={newMemberName}
              onChange={(e) => onNewMemberNameChange(e.target.value)}
              placeholder="Nome do amigo"
              className="text-base sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddMember();
                }
              }}
            />
          </div>
          <div className="sm:col-span-4">
            <Input
              value={newMemberPix}
              onChange={(e) => onNewMemberPixChange(e.target.value)}
              placeholder="Chave Pix (opcional)"
              className="text-base sm:text-sm"
            />
          </div>
          <div className="sm:col-span-3 flex gap-1.5">
            <Select
              value={newMemberPixType}
              onValueChange={(val) => onNewMemberPixTypeChange(val as TripPixKeyType)}
              options={PIX_TYPE_OPTIONS}
              className="flex-1"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onAddMember}
              disabled={!newMemberName.trim()}
              className="shrink-0"
              title="Adicionar à lista"
              aria-label="Adicionar amigo à lista"
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
