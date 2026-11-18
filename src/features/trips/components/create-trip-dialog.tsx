import { useState } from "react";
import { Button, DatePicker, FormField, Input, Modal, ModalFooter } from "@/components/ui";
import { useCreateTripMutation } from "@/state/queries/use-trips";
import { useAuth } from "@/hooks/use-auth";
import { useUserAccess } from "@/state/queries/use-user-access";
import { todayISO, toLocalIsoDate } from "@/lib/date";
import type { TripPixKeyType } from "@/types/trips";
import {
  CreateTripMembersSection,
  type InitialTripMemberDraft,
} from "./create-trip-members-section";

export interface CreateTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (tripId: string) => void;
}

export function CreateTripDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateTripDialogProps) {
  const { user } = useAuth();
  const { profile } = useUserAccess();
  const defaultHostName = profile?.name?.trim() || user?.user_metadata?.name?.trim() || "";

  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [hostName, setHostName] = useState(defaultHostName);
  const [prevDefaultHostName, setPrevDefaultHostName] = useState(defaultHostName);
  const [startDate, setStartDate] = useState(() => todayISO());
  const [endDate, setEndDate] = useState(() => toLocalIsoDate(new Date(Date.now() + 5 * 86400000)));
  const [members, setMembers] = useState<InitialTripMemberDraft[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPix, setNewMemberPix] = useState("");
  const [newMemberPixType, setNewMemberPixType] = useState<TripPixKeyType>("cpf");

  if (defaultHostName !== prevDefaultHostName) {
    setPrevDefaultHostName(defaultHostName);
    if (!hostName) setHostName(defaultHostName);
  }

  const createTripMutation = useCreateTripMutation();

  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    setMembers((prev) => [
      ...prev,
      {
        name: newMemberName.trim(),
        pix_key: newMemberPix.trim() || undefined,
        pix_key_type: newMemberPix.trim() ? newMemberPixType : undefined,
      },
    ]);
    setNewMemberName("");
    setNewMemberPix("");
  };

  const handleRemoveMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !hostName.trim() || !startDate || !endDate) return;

    const finalMembers = [...members];
    if (newMemberName.trim()) {
      finalMembers.push({
        name: newMemberName.trim(),
        pix_key: newMemberPix.trim() || undefined,
        pix_key_type: newMemberPix.trim() ? newMemberPixType : undefined,
      });
    }

    try {
      const created = await createTripMutation.mutateAsync({
        title: title.trim(),
        destination: destination.trim() || null,
        start_date: startDate,
        end_date: endDate,
        host_name: hostName.trim() || undefined,
        initial_members: finalMembers,
      });

      setTitle("");
      setDestination("");
      setMembers([]);
      setNewMemberName("");
      setNewMemberPix("");
      onOpenChange(false);
      onSuccess?.(created.id);
    } catch {
      // O erro já é tratado via toast destrutivo no useCreateTripMutation
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Criar Nova Viagem"
      description="Inicie um grupo de despesas compartilhadas para viajar com amigos ou família."
      footer={
        <ModalFooter borderless>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createTripMutation.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="create-trip-form"
            disabled={!title.trim() || !hostName.trim() || !startDate || !endDate || createTripMutation.isPending}
            loading={createTripMutation.isPending}
          >
            Criar Viagem
          </Button>
        </ModalFooter>
      }
    >
      <form id="create-trip-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <FormField label="Nome da Viagem" required htmlFor="create-trip-title" className="sm:col-span-2">
            <Input
              id="create-trip-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Carnaval Salvador 2027, Praia de Pipa"
              maxLength={80}
              className="text-base sm:text-sm"
              required
            />
          </FormField>

          <FormField
            label="Seu Nome de Exibição no Grupo"
            required
            htmlFor="create-trip-host"
            helperText="Este nome será exibido para todos os participantes nas divisões e extratos da viagem."
            className="sm:col-span-2"
          >
            <Input
              id="create-trip-host"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Como seus amigos te conhecem (ex.: Gabriel)"
              maxLength={50}
              className="text-base sm:text-sm"
              required
            />
          </FormField>

          <FormField label="Destino" optional htmlFor="create-trip-destination" className="sm:col-span-2">
            <Input
              id="create-trip-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex.: Salvador, BA"
              maxLength={80}
              className="text-base sm:text-sm"
            />
          </FormField>

          <FormField label="Data de Início" required htmlFor="create-trip-start">
            <DatePicker
              id="create-trip-start"
              value={startDate ?? ""}
              onValueChange={(val) => setStartDate(val || "")}
            />
          </FormField>

          <FormField label="Data de Término" required htmlFor="create-trip-end">
            <DatePicker
              id="create-trip-end"
              value={endDate ?? ""}
              onValueChange={(val) => setEndDate(val || "")}
            />
          </FormField>
        </div>

        <CreateTripMembersSection
          hostName={hostName}
          members={members}
          newMemberName={newMemberName}
          onNewMemberNameChange={setNewMemberName}
          newMemberPix={newMemberPix}
          onNewMemberPixChange={setNewMemberPix}
          newMemberPixType={newMemberPixType}
          onNewMemberPixTypeChange={setNewMemberPixType}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
        />
      </form>
    </Modal>
  );
}
