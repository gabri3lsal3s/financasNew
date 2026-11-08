/**
 * Modal para adicionar participantes a uma viagem existente.
 */

import { useState } from "react";
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  Select,
} from "@/components/ui";
import { useAddTripMemberMutation } from "@/state/queries/use-trips";
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
      });

      setName("");
      setPixKey("");
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
      description="Insira o nome do amigo e a chave Pix para os acertos da viagem."
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
              className="text-base sm:text-sm"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
