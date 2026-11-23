import { useMemo, useState } from "react";
import { PixKeyInputFields } from "@/components/modules";
import { Button, DatePicker, FormField, Input, Modal, ModalFooter } from "@/components/ui";
import { validateAndClassifyPixKey, type PixKeyType } from "@/domain/pix";
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

export function AddTripMemberDialog({
  open,
  onOpenChange,
  tripId,
}: AddTripMemberDialogProps) {
  const [name, setName] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<string>("auto");
  const [participationMode, setParticipationMode] = useState<"all" | "from_date">("all");
  const [joinedDate, setJoinedDate] = useState(() => todayISO());

  const addMemberMutation = useAddTripMemberMutation();

  const pixValidation = useMemo(() => {
    if (!pixKey.trim()) return null;
    return validateAndClassifyPixKey(
      pixKey,
      pixKeyType === "auto" ? undefined : (pixKeyType as PixKeyType),
    );
  }, [pixKey, pixKeyType]);

  const hasInvalidPix = Boolean(pixKey.trim() && pixValidation && !pixValidation.isValid);

  const handleModeChange = (mode: "all" | "from_date") => {
    triggerSensory("selection");
    setParticipationMode(mode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || hasInvalidPix) return;

    const cleanPix = pixKey.trim()
      ? (pixValidation?.normalizedKey ?? pixKey.trim())
      : null;
    const resolvedPixType: TripPixKeyType | null = cleanPix
      ? ((pixValidation?.resolvedType ??
          (pixKeyType === "auto" ? null : pixKeyType)) as TripPixKeyType | null)
      : null;

    try {
      await addMemberMutation.mutateAsync({
        trip_id: tripId,
        name: name.trim(),
        pix_key: cleanPix,
        pix_key_type: cleanPix ? resolvedPixType : null,
        joined_date: participationMode === "from_date" ? joinedDate : null,
      });

      setName("");
      setPixKey("");
      setPixKeyType("auto");
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
            disabled={!name.trim() || hasInvalidPix || addMemberMutation.isPending}
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

        <PixKeyInputFields
          pixKey={pixKey}
          onPixKeyChange={setPixKey}
          selectedKeyType={pixKeyType}
          onSelectedKeyTypeChange={setPixKeyType}
          detectedType={pixValidation?.resolvedType ?? null}
          validationError={pixValidation?.errorMessage ?? null}
          isAmbiguousCpfOrPhone={pixValidation?.isAmbiguousCpfOrPhone ?? false}
          onQuickSelectKeyType={(t) => setPixKeyType(t)}
          pixKeyId="add-member-pix-key"
          keyTypeId="add-member-pix-type"
          pixKeyLabel="Chave Pix (opcional)"
          pixKeyAriaLabel="Chave Pix do participante"
          pixKeyPlaceholder="CPF, celular, e-mail ou aleatória"
          pixKeyHelperText="Para receber transferências no acerto"
          keyTypeLabel="Tipo da Chave Pix"
          keyTypeAriaLabel="Tipo da Chave Pix"
          showBankRegistrationNotice={Boolean(pixKey.trim())}
          showVerificationBadge={true}
        />

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
