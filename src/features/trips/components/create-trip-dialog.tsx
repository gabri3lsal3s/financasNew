/**
 * Modal para criação de nova viagem.
 * Respeita a Regra 7 (Zero controles nativos) e Regra 18 (Governança de Modais).
 */

import { useState } from "react";
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  Select,
} from "@/components/ui";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, Trash2, Users } from "lucide-react";
import { useCreateTripMutation } from "@/state/queries/use-trips";
import { useAuth } from "@/hooks/use-auth";
import { useUserAccess } from "@/state/queries/use-user-access";
import { todayISO, toLocalIsoDate } from "@/lib/date";
import type { TripPixKeyType } from "@/types/trips";

export interface CreateTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (tripId: string) => void;
}

const PIX_TYPE_OPTIONS = [
  { value: "cpf", label: "CPF" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Aleatória" },
];

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
  const [endDate, setEndDate] = useState(() =>
    toLocalIsoDate(new Date(Date.now() + 5 * 86400000))
  );

  if (defaultHostName !== prevDefaultHostName) {
    setPrevDefaultHostName(defaultHostName);
    if (!hostName) {
      setHostName(defaultHostName);
    }
  }

  const [members, setMembers] = useState<
    { name: string; pix_key?: string; pix_key_type?: TripPixKeyType }[]
  >([]);

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPix, setNewMemberPix] = useState("");
  const [newMemberPixType, setNewMemberPixType] = useState<TripPixKeyType>("cpf");

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

      // Reset
      setTitle("");
      setDestination("");
      setMembers([]);
      onOpenChange(false);
      onSuccess?.(created.id);
    } catch {
      // O erro já é tratado e exibido via toast destrutivo no onError do useCreateTripMutation
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
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createTripMutation.isPending}
          >
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
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-foreground">
              Nome da Viagem *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Carnaval Salvador 2027, Praia de Pipa"
              maxLength={80}
              className="text-base sm:text-sm"
              required
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-foreground">
              Seu Nome de Exibição no Grupo *
            </label>
            <Input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Como seus amigos te conhecem (ex.: Gabriel)"
              maxLength={50}
              className="text-base sm:text-sm"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Este nome será exibido para todos os participantes nas divisões e extratos da viagem.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-foreground">
              Destino <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex.: Salvador, BA"
              maxLength={80}
              className="text-base sm:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Data de Início *
            </label>
            <DatePicker
              value={startDate ?? ""}
              onValueChange={(val) => setStartDate(val || "")}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Data de Término *
            </label>
            <DatePicker
              value={endDate ?? ""}
              onValueChange={(val) => setEndDate(val || "")}
            />
          </div>
        </div>

          {/* Participantes Iniciais */}
          <div className="space-y-3 pt-2 border-t border-border/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                Participantes do Grupo
              </label>
              <span className="text-[11px] text-muted-foreground">
                {hostName.trim() ? `${hostName.trim()} (Organizador)` : "Organizador já incluído"}
              </span>
            </div>

            {/* Lista de membros já adicionados */}
            {members.length > 0 && (
              <div className="space-y-1.5">
                {members.map((m, idx) => (
                  <div
                    key={`${m.name}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-raised border border-border/80 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{m.name}</span>
                      {m.pix_key && (
                        <span className="text-[11px] text-muted-foreground ml-2 font-mono">
                          Pix: {m.pix_key}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="text-muted-foreground hover:text-critical transition-colors p-1"
                      title="Remover participante"
                      aria-label={`Remover ${m.name}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input para adicionar participante */}
            <div className="p-3 rounded-xl bg-surface border border-border/80 space-y-2.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                Adicionar amigos que vão viajar com você:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-5">
                  <Input
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nome do amigo"
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMember();
                      }
                    }}
                  />
                </div>
                <div className="sm:col-span-4">
                  <Input
                    value={newMemberPix}
                    onChange={(e) => setNewMemberPix(e.target.value)}
                    placeholder="Chave Pix (opcional)"
                    className="text-xs"
                  />
                </div>
                <div className="sm:col-span-3 flex gap-1.5">
                  <Select
                    value={newMemberPixType}
                    onValueChange={(val) => setNewMemberPixType(val as TripPixKeyType)}
                    options={PIX_TYPE_OPTIONS}
                    className="text-xs flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddMember}
                    disabled={!newMemberName.trim()}
                    className="shrink-0 h-9 px-2.5"
                    title="Adicionar à lista"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
    </Modal>
  );
}
