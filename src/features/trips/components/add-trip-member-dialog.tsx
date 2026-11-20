import { useState } from "react";
import { Button, DatePicker, FormField, Input, Modal, ModalFooter, Select } from "@/components/ui";
import { useAddTripMemberMutation } from "@/state/queries/use-trips";
import { triggerSensory } from "@/services/sensory";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { TripPixKeyType } from "@/types/trips";

export interface AddTripMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
}

const PIX_TYPE_OPTIONS = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Aleatória" },
];

export function AddTripMemberDialog({
  open,
  onOpenChange,
  tripId,
}: AddTripMemberDialogProps) {
  const [name, setName] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<TripPixKeyType>("cpf");
  const [participationMode, setParticipationMode] = useState<"all" | "from_date">("all");
  const [joinedDate, setJoinedDate] = useState(() => todayISO());

  const addMemberMutation = useAddTripMemberMutation();

  const handleModeChange = (mode: "all" | "from_date") => {
    triggerSensory("selection");
    setParticipationMode(mode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await addMemberMutation.mutateAsync({
        trip_id: tripId,
        name: name.trim(),
        pix_key: pixKey.trim() || null,
        pix_key_type: pixKey.trim() ? pixKeyType : null,
        joined_date: participationMode === "from_date" ? joinedDate : null,
      });

      setName("");
      setPixKey("");
      setParticipationMode("all");
      onOpenChange(false);
    } catch {
      // O erro já é tratado via toast destrutivo no useAddTripMemberMutation
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Adicionar Participante"
      description="Insira o nome do amigo, chave Pix e quando ele ingressa nas despesas da viagem."
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={addMemberMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="add-trip-member-form"
            disabled={!name.trim() || addMemberMutation.isPending}
            loading={addMemberMutation.isPending}
          >
            Adicionar
          </Button>
        </ModalFooter>
      }
    >
      <form id="add-trip-member-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nome do Amigo" required htmlFor="add-member-name">
          <Input
            id="add-member-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Mariana, Lucas, Rafael"
            maxLength={60}
            className="text-base sm:text-sm"
            required
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Tipo da Chave Pix" htmlFor="add-member-pix-type">
            <Select
              id="add-member-pix-type"
              value={pixKeyType}
              onValueChange={(val) => setPixKeyType(val as TripPixKeyType)}
              options={PIX_TYPE_OPTIONS}
            />
          </FormField>

          <FormField label="Chave Pix" optional htmlFor="add-member-pix-key">
            <Input
              id="add-member-pix-key"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Para receber transferências"
              className="text-base sm:text-sm font-mono"
            />
          </FormField>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/80">
          <span className="text-xs font-semibold text-foreground block">
            Participação nos gastos da viagem
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange("all")}
              aria-pressed={participationMode === "all"}
              className={cn(
                "min-h-11 sm:min-h-10 p-2.5 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                participationMode === "all"
                  ? "bg-primary/10 border-primary text-primary-strong"
                  : "bg-surface-raised border-border/80 text-muted-foreground hover:text-foreground",
              )}
            >
              Desde o início (todos os gastos)
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("from_date")}
              aria-pressed={participationMode === "from_date"}
              className={cn(
                "min-h-11 sm:min-h-10 p-2.5 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                participationMode === "from_date"
                  ? "bg-primary/10 border-primary text-primary-strong"
                  : "bg-surface-raised border-border/80 text-muted-foreground hover:text-foreground",
              )}
            >
              A partir da chegada
            </button>
          </div>

          {participationMode === "from_date" && (
            <div className="space-y-1.5 p-3 rounded-xl bg-surface-raised border border-border/80 mt-2">
              <FormField
                label="Data de chegada do amigo"
                htmlFor="add-member-joined-date"
                helperText="Despesas gerais realizadas antes desta data não serão cobradas deste amigo."
              >
                <DatePicker
                  id="add-member-joined-date"
                  value={joinedDate}
                  onChange={(val) => setJoinedDate(val ?? todayISO())}
                />
              </FormField>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
