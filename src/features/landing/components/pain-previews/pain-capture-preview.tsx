import { useState } from "react";
import { Check, CheckCircle2, FileSpreadsheet, FileText, Share2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { pushToast } from "@/services/toast";

export function PainCapturePreview() {
  const [approved, setApproved] = useState(false);

  const handleApprove = () => {
    setApproved(true);
    pushToast({
      title: "Despesa aprovada",
      description: "Padaria Bella · R$ 42,90 · Alimentação · Pix",
      variant: "success",
      duration: 5000,
      action: { label: "Desfazer", onClick: () => setApproved(false) },
    });
  };

  return (
    <Card
      data-testid="pain-preview-capture"
      className="border-border/80 bg-surface shadow-xs p-4 sm:p-6 md:p-7 space-y-5 rounded-2xl sm:rounded-3xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3.5">
        <div>
          <span className="text-xs sm:text-sm font-bold text-foreground block">
            Prévia de Lançamento Sem Fricção
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground">
            Dados extraídos localmente de um comprovante compartilhado
          </span>
        </div>
        <Badge variant="default" size="xs">
          Sugestão pronta
        </Badge>
      </div>

      <div className="rounded-xl border border-primary/25 bg-surface-raised/60 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-semibold text-foreground">
            Padaria Bella · Pix
          </span>
          <MoneyText cents={-4290} tone="negative" className="text-sm sm:text-base font-bold" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="muted" size="xs">
            Alimentação (sugerida)
          </Badge>
          <span>Hoje · Comprovante compartilhado</span>
        </div>

        <div className="pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <span className="sr-only" role="status" aria-live="polite">
            {approved ? "Despesa aprovada e lançada em Alimentação." : ""}
          </span>
          {approved ? (
            <Badge variant="positive" size="sm" className="self-start sm:self-auto">
              <Check className="size-3" aria-hidden="true" />
              Lançamento confirmado
            </Badge>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={approved ? "outline" : "default"}
            onClick={approved ? () => setApproved(false) : handleApprove}
            className="self-start sm:self-auto gap-1.5 text-xs rounded-lg shadow-xs cursor-pointer"
          >
            {approved ? (
              <>
                <Check className="size-3.5" aria-hidden="true" />
                <span>Aprovada (desfazer)</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                <span>Aprovar Despesa</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Share2 className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
            <span>Pix &amp; Compartilhar</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Copiou o Pix ou compartilhou o recibo do banco? Valor e nome chegam preenchidos.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <FileText className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
            <span>OCR de Cupons</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Leitura local de notas fiscais e boletos com aprendizado dos seus estabelecimentos.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <FileSpreadsheet className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
            <span>Importar Faturas</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Traga faturas do cartão em arquivo e concilie tudo sem digitar linha por linha.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
        <span>Zero conexão frágil e zero senhas do seu banco: você mantém o controle total.</span>
      </div>
    </Card>
  );
}
