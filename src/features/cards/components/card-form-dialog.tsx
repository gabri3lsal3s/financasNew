import { useState } from "react";
import { Radio, Sparkles, Trash2 } from "lucide-react";
import { Alert, Button, Checkbox, ColorPicker, ConfirmDialog, Input, Modal, ModalFooter, MoneyInput, MoneyText, NumberStepper } from "@/components/ui";
import { CardBrandBadge, getCardGradient } from "@/components/modules";
import { bestPurchaseDay, creditCardFormSchema } from "@/domain/cards";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useCreateCard, useDeleteCard, useUpdateCard } from "@/state";
import type { CreditCard, CreditCardForm } from "@/types";

const QUICK_BRANDS = ["Visa", "Mastercard", "Elo", "Amex"] as const;

const CARD_COLOR_PRESETS = [
  { name: "Petróleo", hex: "#162432" },
  { name: "Grafite", hex: "#242424" },
  { name: "Bronze Nomad", hex: "#2B1410" },
  { name: "Roxo Nubank", hex: "#820AD9" },
  { name: "Laranja Inter", hex: "#FF7A00" },
  { name: "Azul Itaú", hex: "#003399" },
  { name: "Vermelho Santander", hex: "#CC092F" },
  { name: "Verde Esmeralda", hex: "#0F766E" },
] as const;


export interface CardFormDialogProps {
  /** Cartão em edição; `null` = criação. */
  card: CreditCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback executado após a exclusão bem-sucedida do cartão. */
  onDeleted?: (deletedCardId: string) => void;
}

interface CardFormContentProps {
  card: CreditCard | null;
  onClose: () => void;
  onDeleted?: (deletedCardId: string) => void;
}

function CardFormContent({ card, onClose, onDeleted }: CardFormContentProps) {
  const [name, setName] = useState(card?.name ?? "");
  const [brand, setBrand] = useState(card?.brand ?? "");
  const [limitCents, setLimitCents] = useState(
    card?.credit_limit === null || card?.credit_limit === undefined ? 0 : Math.round(card.credit_limit * 100),
  );
  const [closingDay, setClosingDay] = useState(card?.closing_day ?? 10);
  const [dueDay, setDueDay] = useState(card?.due_day ?? 15);
  const [color, setColor] = useState(card?.color ?? "");
  const [isActive, setIsActive] = useState(card?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();
  const pending = createCard.isPending || updateCard.isPending || deleteCard.isPending;

  const handleSubmit = async () => {
    setError(null);
    const rawForm = {
      name,
      brand: brand.trim() || null,
      credit_limit: limitCents > 0 ? limitCents / 100 : null,
      closing_day: closingDay,
      due_day: dueDay,
      color: color.trim() || null,
      is_active: isActive,
    };
    const parsed = creditCardFormSchema.safeParse(rawForm);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados do cartão inválidos");
      return;
    }
    const form: CreditCardForm = parsed.data;
    try {
      if (card) {
        await updateCard.mutateAsync({ id: card.id, input: form });
      } else {
        await createCard.mutateAsync(form);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDeactivateNow = async () => {
    if (!card) return;
    setError(null);
    try {
      await updateCard.mutateAsync({
        id: card.id,
        input: {
          name: name.trim() || card.name,
          brand: brand.trim() || card.brand,
          credit_limit: limitCents > 0 ? limitCents / 100 : null,
          closing_day: closingDay,
          due_day: dueDay,
          color: color.trim() || null,
          is_active: false,
        },
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!card) return;
    setError(null);
    try {
      await deleteCard.mutateAsync(card.id);
      setDeleteConfirmOpen(false);
      onClose();
      onDeleted?.(card.id);
    } catch (err) {
      setDeleteConfirmOpen(false);
      const msg = getErrorMessage(err);
      if (
        msg.toLowerCase().includes("foreign key") ||
        msg.toLowerCase().includes("histórico") ||
        msg.toLowerCase().includes("vinculad") ||
        msg.toLowerCase().includes("desativá-lo")
      ) {
        setError(
          "Não é possível excluir um cartão que possui despesas ou pagamentos registrados. Você pode desativá-lo para mantê-lo no histórico.",
        );
      } else {
        setError(msg);
      }
    }
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() !== "" && !pending) {
            void handleSubmit();
          }
        }}
        className="mt-4 flex flex-col gap-4"
      >
        {error ? (
          <div className="flex flex-col gap-2">
            <Alert variant="error">{error}</Alert>
            {error.includes("desativá-lo") && card && card.is_active ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDeactivateNow()}
                className="self-start text-xs"
              >
                Desativar cartão agora
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Card Preview Coluna Esquerda */}
          <div className="md:col-span-5 flex flex-col gap-2.5 md:sticky md:top-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pré-visualização
            </span>
            <div
              className={cn(
                "relative w-full max-w-[340px] sm:max-w-none mx-auto sm:mx-0 aspect-[1.586] rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-col justify-between overflow-hidden transition-all duration-300 select-none",
                "border border-white/15 ring-1 ring-inset ring-white/10 backdrop-blur-md",
                !isActive && "opacity-75 grayscale-[25%]",
              )}
              style={{ background: getCardGradient(color) }}
            >
              {/* Brilho sutil diagonal */}
              <div
                className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-black/25 pointer-events-none"
                aria-hidden="true"
              />

              {/* Topo do cartão: Contactless + Inativo badge à esquerda, Bandeira à direita */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="size-4 rotate-90 text-white/70" aria-label="Aproximação" />
                  {!isActive && (
                    <span className="text-[10px] uppercase font-semibold text-amber-200/90 px-2 py-0.5 rounded-full bg-black/45 border border-amber-400/30">
                      Inativo
                    </span>
                  )}
                </div>
                <CardBrandBadge brand={brand} name={name} />
              </div>

              {/* Centro: Número virtual pontilhado + Nome do titular + Pílulas de datas */}
              <div className="relative z-10 my-auto flex flex-col gap-1.5 py-1">
                <div className="font-mono text-xs sm:text-sm tracking-[0.22em] text-white/50 select-none drop-shadow-xs font-semibold">
                  •••• •••• •••• {card?.id ? card.id.slice(-4) : "••••"}
                </div>
                <p className="font-display font-bold text-base sm:text-lg tracking-wide text-white drop-shadow-xs truncate">
                  {name.trim() || "Nome do Cartão"}
                </p>
                <div className="flex items-center justify-between text-[11px] font-mono text-white/85">
                  <span className="bg-black/30 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10">
                    Fecha dia {closingDay}
                  </span>
                  <span className="bg-black/30 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10">
                    Vence dia {dueDay}
                  </span>
                </div>
              </div>

              {/* Rodapé: Limite total */}
              <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/15 text-xs">
                <span className="text-[11px] uppercase tracking-wider text-white/70 font-medium">
                  Limite total
                </span>
                <span className="font-bold tabular-nums text-white">
                  {limitCents > 0 ? (
                    <MoneyText cents={limitCents} className="text-white font-bold" />
                  ) : (
                    <span className="text-white/70 font-normal text-xs">Sem limite cadastrado</span>
                  )}
                </span>
              </div>
            </div>

            {/* Dica de inteligência de fechamento / melhor dia de compra */}
            <div className="w-full max-w-[340px] sm:max-w-none mx-auto sm:mx-0 rounded-lg bg-surface border border-border/80 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow-2xs">
              <Sparkles className="size-3.5 text-primary shrink-0" aria-hidden="true" />
              <span>
                Melhor dia para compras: <strong className="text-foreground font-semibold">dia {bestPurchaseDay(closingDay)}</strong>
              </span>
            </div>
          </div>

          {/* Formulário Coluna Direita */}
          <div className="md:col-span-7 flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="card-name" className="text-xs font-semibold text-foreground">
                Nome
              </label>
              <Input
                id="card-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Nomad, Nubank Ultravioleta..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-brand" className="text-xs font-semibold text-foreground">
                  Bandeira
                </label>
                <Input
                  id="card-brand"
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  placeholder="Visa, Mastercard, Elo..."
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {QUICK_BRANDS.map((item) => {
                    const isSelected = brand.trim().toLowerCase() === item.toLowerCase();
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          triggerSensory("action");
                          setBrand(item);
                        }}
                        className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors",
                          isSelected
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">Cor</span>
                <ColorPicker value={color} onValueChange={setColor} ariaLabel="Cor do cartão" />
                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                  {CARD_COLOR_PRESETS.map((preset) => {
                    const isSelected = color.trim().toUpperCase() === preset.hex.toUpperCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        title={preset.name}
                        aria-label={`Cor ${preset.name}`}
                        onClick={() => {
                          triggerSensory("action");
                          setColor(preset.hex);
                        }}
                        className={cn(
                          "size-5 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-2xs border",
                          isSelected
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 border-white/50"
                            : "border-border/60",
                        )}
                        style={{ backgroundColor: preset.hex }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="card-limit" className="text-xs font-semibold text-foreground">
                  Limite total
                </label>
                <span className="text-[11px] text-muted-foreground">(opcional)</span>
              </div>
              <MoneyInput
                id="card-limit"
                cents={limitCents}
                onCentsChange={setLimitCents}
                aria-label="Limite total do cartão"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">Dia de fechamento</span>
                <NumberStepper
                  value={closingDay}
                  onValueChange={setClosingDay}
                  min={1}
                  max={31}
                  decreaseLabel="Diminuir dia de fechamento"
                  increaseLabel="Aumentar dia de fechamento"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">Dia de vencimento</span>
                <NumberStepper
                  value={dueDay}
                  onValueChange={setDueDay}
                  min={1}
                  max={31}
                  decreaseLabel="Diminuir dia de vencimento"
                  increaseLabel="Aumentar dia de vencimento"
                />
              </div>
            </div>

            {card ? (
              <div className="pt-1.5 rounded-lg border border-border/80 bg-surface p-3 flex flex-col gap-1.5 shadow-2xs">
                <Checkbox
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  label="Cartão ativo para novas compras"
                  id="card-active"
                />
                {!isActive && (
                  <p className="text-xs text-muted-foreground pl-6">
                    Cartão desativado: permanece no histórico de faturas e relatórios passados, mas fica oculto para novas despesas.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <ModalFooter className="sm:justify-between">
          {card ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={pending}
              className="text-critical hover:bg-critical/10 gap-1.5 px-2.5"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir
            </Button>
          ) : (
            <div />
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2.5 w-full sm:w-auto">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={name.trim() === "" || pending}
            >
              {pending ? "Salvando…" : card ? "Salvar alterações" : "Criar cartão"}
            </Button>
          </div>
        </ModalFooter>
      </form>

      {card ? (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Excluir cartão"
          description={`Tem certeza que deseja excluir o cartão "${card.name}"? Se houver histórico de despesas ou pagamentos, você deve desativá-lo em vez de excluí-lo.`}
          confirmLabel="Excluir cartão"
          variant="destructive"
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}

/** Formulário de cartão (CRUD §3.3.1) — criação, edição e exclusão no mesmo componente. */
export function CardFormDialog({ card, open, onOpenChange, onDeleted }: CardFormDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={card ? "Editar cartão" : "Novo cartão"}
      description={card ? "Altere as configurações ou desative o cartão." : "Preencha os dados do cartão de crédito."}
      size="xl"
      showCalculator
    >
      {open ? (
        <CardFormContent
          key={card?.id ?? "new-card"}
          card={card}
          onClose={() => onOpenChange(false)}
          onDeleted={onDeleted}
        />
      ) : null}
    </Modal>
  );
}
