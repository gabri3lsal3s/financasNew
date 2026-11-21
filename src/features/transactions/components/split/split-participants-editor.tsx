import { Plus, Trash2, Users } from "lucide-react";
import { Badge, Button, Input, MoneyInput, NumberStepper } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import type { SplitExpenseSummary, SplitRemainderPolicy } from "@/domain/finance/split-math";
import { QUICK_PEOPLE_COUNTS } from "./split-constants";

export interface SplitParticipantsEditorProps {
  isPreconfigured: boolean;
  totalCents: number;
  onTotalCentsChange: (cents: number) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  peopleCount: number;
  onPeopleCountChange: (count: number) => void;
  isCustomMode: boolean;
  onCustomModeChange: (custom: boolean) => void;
  participants: string[];
  onParticipantNameChange: (index: number, name: string) => void;
  onAddParticipant: () => void;
  onRemoveParticipant: (index: number) => void;
  summary: SplitExpenseSummary;
  remainderPolicy: SplitRemainderPolicy;
}

/** Editor de valor, descrição e divisão entre participantes do racha. */
export function SplitParticipantsEditor({
  isPreconfigured, totalCents, onTotalCentsChange, description, onDescriptionChange,
  peopleCount, onPeopleCountChange, isCustomMode, onCustomModeChange, participants,
  onParticipantNameChange, onAddParticipant, onRemoveParticipant, summary, remainderPolicy,
}: SplitParticipantsEditorProps) {
  if (isPreconfigured) {
    return (
      <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="size-4 text-portfolio shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-foreground truncate block">
                {description.trim() || "Racha de Despesa"}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Rateio já registrado no seu extrato
              </span>
            </div>
          </div>
          <Badge variant="portfolio" size="xs" className="shrink-0 self-start sm:self-center">
            {peopleCount} pessoas ({summary.guestCount} {summary.guestCount === 1 ? "amigo" : "amigos"} + você)
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/80">
          <div className="p-2.5 rounded-lg bg-surface-raised/60">
            <span className="text-[11px] text-muted-foreground block">Valor Total</span>
            <MoneyText cents={totalCents} variant="value" className="font-semibold text-sm" />
          </div>
          <div className="p-2.5 rounded-lg bg-surface-raised/60">
            <span className="text-[11px] text-muted-foreground block">Cada Amigo ({summary.guestCount})</span>
            <MoneyText cents={summary.guestShareCents} tone="portfolio" variant="value" className="font-semibold text-sm" />
          </div>
          <div className="p-2.5 rounded-lg bg-surface-raised/60">
            <span className="text-[11px] text-muted-foreground block">Sua Cota (Anfitrião)</span>
            <MoneyText cents={summary.hostShareCents} variant="value" className="font-semibold text-sm" />
          </div>
        </div>

        {summary.remainderCents > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {remainderPolicy === "host"
              ? `Diferença de ${summary.remainderCents} centavo(s) de resto atribuída ao anfitrião para que todos os amigos paguem o mesmo valor.`
              : `Diferença de ${summary.remainderCents} centavo(s) distribuída proporcionalmente entre os primeiros participantes.`}
          </p>
        ) : null}

        <div className="pt-0.5">
          <Button
            type="button" variant="ghost" size="xs"
            onClick={() => onCustomModeChange(!isCustomMode)}
            className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
          >
            {isCustomMode ? "Ocultar nomes dos participantes" : "Personalizar nomes dos participantes"}
          </Button>
          {isCustomMode ? (
            <div className="space-y-2 pt-2 mt-1 border-t border-border/80">
              {participants.map((name, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <Input
                      value={name}
                      onChange={(e) => onParticipantNameChange(index, e.target.value)}
                      placeholder={index === 0 ? "Você (Anfitrião)" : `Amigo ${index}`}
                      className="text-base sm:text-sm"
                      aria-label={`Nome do participante ${index + 1}`}
                    />
                  </div>
                  <div className="w-24 text-right shrink-0">
                    <MoneyText cents={summary.shares[index] ?? 0} variant="value" className="font-medium text-xs" />
                  </div>
                  {index === 0 ? <Badge size="xs" variant="muted" className="shrink-0">Anfitrião</Badge> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Valor Total da Despesa</label>
          <MoneyInput cents={totalCents} onCentsChange={onTotalCentsChange} size="md" aria-label="Valor total da despesa" />
          <span className="text-[11px] text-muted-foreground block">Valor nominal a ser dividido</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">
            Descrição ou Título <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <Input
            value={description} onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Ex.: Pizza de Sábado, Churrasco, Uber..." maxLength={60} aria-label="Descrição do racha"
          />
          <span className="text-[11px] text-muted-foreground block">Exibida aos amigos na página pública</span>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface p-3.5 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">Divisão entre Participantes</span>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant={!isCustomMode ? "default" : "ghost"} size="xs" onClick={() => onCustomModeChange(false)}>
              Quantidade
            </Button>
            <Button type="button" variant={isCustomMode ? "default" : "ghost"} size="xs" onClick={() => onCustomModeChange(true)}>
              Nomes Customizados
            </Button>
          </div>
        </div>

        {!isCustomMode ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_PEOPLE_COUNTS.map((count) => (
                <Button key={count} type="button" variant={peopleCount === count ? "default" : "outline"} size="xs" onClick={() => onPeopleCountChange(count)}>
                  {count} pessoas
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Outro número:</span>
              <NumberStepper value={peopleCount} onValueChange={onPeopleCountChange} min={2} max={50} editable ariaLabel="Número de pessoas para o racha" className="w-36" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {participants.map((name, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={name} onChange={(e) => onParticipantNameChange(index, e.target.value)}
                    placeholder={index === 0 ? "Você (Anfitrião)" : `Participante ${index + 1}`}
                    className="text-base sm:text-sm" aria-label={`Nome do participante ${index + 1}`}
                  />
                </div>
                <div className="w-24 text-right shrink-0">
                  <MoneyText cents={summary.shares[index] ?? 0} variant="value" className="font-medium" />
                </div>
                {index === 0 ? (
                  <Badge size="xs" variant="muted" className="shrink-0">Anfitrião</Badge>
                ) : (
                  <Button type="button" variant="ghost" size="xs" onClick={() => onRemoveParticipant(index)} className="text-muted-foreground hover:text-critical p-1 shrink-0" aria-label={`Remover participante ${index + 1}`}>
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            {peopleCount < 50 ? (
              <Button type="button" variant="ghost" size="xs" onClick={onAddParticipant} className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Adicionar participante</span>
              </Button>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border/80">
          <div className="p-2 rounded bg-surface-raised/60">
            <span className="text-[11px] text-muted-foreground block">Total</span>
            <MoneyText cents={totalCents} variant="value" className="font-semibold" />
          </div>
          <div className="p-2 rounded bg-surface-raised/60">
            <span className="text-[11px] text-muted-foreground block">Cada Convidado ({summary.guestCount})</span>
            <MoneyText cents={summary.guestShareCents} tone="portfolio" variant="value" className="font-semibold" />
          </div>
          <div className="p-2 rounded bg-surface-raised/60">
            <span className="text-[11px] text-muted-foreground block">Sua Parte (Anfitrião)</span>
            <MoneyText cents={summary.hostShareCents} variant="value" className="font-semibold" />
          </div>
        </div>

        {summary.remainderCents > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {remainderPolicy === "host"
              ? `Diferença de ${summary.remainderCents} centavo(s) de resto atribuída ao anfitrião para que todos os convidados paguem o mesmo valor.`
              : `Diferença de ${summary.remainderCents} centavo(s) distribuída proporcionalmente entre os primeiros participantes.`}
          </p>
        ) : null}
      </div>
    </>
  );
}
