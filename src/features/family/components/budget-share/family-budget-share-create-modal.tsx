import { useId, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { Button, FormField, Modal, ModalFooter, MoneyInput, MoneyText } from "@/components/ui";

export interface FamilyBudgetShareCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasGroupFamily: boolean;
  groupMonthlyBudgetCents: number;
  isPending: boolean;
  onCreateShare: (ceilingCents: number | null) => Promise<void>;
}

export function FamilyBudgetShareCreateModal({
  open,
  onOpenChange,
  hasGroupFamily,
  groupMonthlyBudgetCents,
  isPending,
  onCreateShare,
}: FamilyBudgetShareCreateModalProps) {
  const formId = useId();
  const [ceilingCents, setCeilingCents] = useState<number | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) setCeilingCents(null);
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateShare(ceilingCents);
    setCeilingCents(null);
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Gerar Link do Modo Família"
      description="Configure o link de leitura para compartilhar com seu cônjuge ou membros da casa."
      size="md"
      showCalculator={!hasGroupFamily}
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            sensoryIntent={false}
            disabled={isPending}
            loading={isPending}
          >
            Gerar Link
          </Button>
        </ModalFooter>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="rounded-xl bg-muted/20 border border-border/80 p-3.5 space-y-1.5">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-positive-strong" aria-hidden="true" />
            <span>Privacidade Garantida</span>
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            O cônjuge verá apenas o teto do mês, o total gasto com despesas marcadas como familiares e o saldo restante disponível. Contas bancárias e transações pessoais não são exibidas.
          </p>
        </div>

        {hasGroupFamily ? (
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-1.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Teto Vinculado ao Grupo Familiar</span>
            </span>
            {groupMonthlyBudgetCents > 0 ? (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                O link herdará automaticamente o teto estabelecido para o seu lar (
                <MoneyText cents={groupMonthlyBudgetCents} tone="default" variant="caption" className="font-semibold" />
                ). Qualquer alteração no teto da família será refletida em tempo real neste link.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Sua família ainda não possui um teto cadastrado nos parâmetros. O link calculará o orçamento automaticamente a partir dos limites mensais de categorias do mês.
              </p>
            )}
          </div>
        ) : (
          <FormField
            label="Teto mensal personalizado"
            optional
            htmlFor="family-ceiling-input"
            helperText="Se deixar em branco, o teto será calculado automaticamente a partir dos seus orçamentos ativos do mês."
          >
            <MoneyInput
              id="family-ceiling-input"
              cents={ceilingCents ?? 0}
              onCentsChange={(cents) => setCeilingCents(cents > 0 ? cents : null)}
              placeholder="Ex: R$ 5.000,00"
            />
          </FormField>
        )}
      </form>
    </Modal>
  );
}
