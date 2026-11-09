/**
 * Modal para adicionar participantes a uma viagem existente.
 * Permite definir se o amigo participa desde o início ou a partir de uma data específica.
 */

import { useState } from "react";
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  Select,
  DatePicker,
} from "@/components/ui";
import { useAddTripMemberMutation } from "@/state/queries/use-trips";
import { todayISO } from "@/lib/date";
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
      // O erro já é tratado e exibido via toast destrutivo no onError do useAddTripMemberMutation
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
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addMemberMutation.isPending}
          >
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
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Nome do Amigo *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Mariana, Lucas, Rafael"
            maxLength={60}
            className="text-base sm:text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Tipo da Chave Pix
            </label>
            <Select
              value={pixKeyType}
              onValueChange={(val) => setPixKeyType(val as TripPixKeyType)}
              options={PIX_TYPE_OPTIONS}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Chave Pix <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Input
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Para receber transferências"
              className="text-base sm:text-sm font-mono"
            />
          </div>
        </div>

        {/* Participação nas despesas */}
        <div className="space-y-2 pt-2 border-t border-border/80">
          <label className="text-xs font-semibold text-foreground block">
            Participação nos gastos da viagem
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setParticipationMode("all")}
              className={`p-2.5 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer ${
                participationMode === "all"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-surface-raised border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Desde o início (todos os gastos)
            </button>
            <button
              type="button"
              onClick={() => setParticipationMode("from_date")}
              className={`p-2.5 rounded-xl text-xs font-medium text-center border transition-all cursor-pointer ${
                participationMode === "from_date"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-surface-raised border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              A partir da chegada
            </button>
          </div>

          {participationMode === "from_date" && (
            <div className="space-y-1.5 p-3 rounded-xl bg-surface-raised border border-border/80 mt-2">
              <label className="text-xs font-semibold text-foreground">
                Data de chegada do amigo
              </label>
              <DatePicker
                value={joinedDate}
                onChange={(val) => setJoinedDate(val ?? todayISO())}
              />
              <p className="text-[11px] text-muted-foreground">
                Despesas gerais realizadas antes desta data não serão cobradas deste amigo.
              </p>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
