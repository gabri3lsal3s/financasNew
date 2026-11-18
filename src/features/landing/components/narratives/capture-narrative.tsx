import { useState } from "react";
import { Check, CheckCircle2, FileText, Share2, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Badge, Button, Card, MoneyText } from "@/components/ui";
import { ScrollReveal } from "@/features/landing/components/scroll-reveal";
import { pushToast } from "@/services/toast";

function ApproveExpenseButton() {
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
    <div className="pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
      <span className="sr-only" role="status" aria-live="polite">
        {approved ? "Despesa aprovada e lançada em Alimentação." : ""}
      </span>
      {approved ? (
        <Badge variant="positive" size="sm" className="self-start sm:self-auto">
          <Check className="size-3" aria-hidden="true" />
          Despesa aprovada · Alimentação
        </Badge>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant={approved ? "outline" : "default"}
        onClick={approved ? () => setApproved(false) : handleApprove}
        className="self-start sm:self-auto gap-1.5 text-xs rounded-lg shadow-xs"
      >
        {approved ? (
          <>
            <Check className="size-3.5" aria-hidden="true" />
            <span>Aprovada</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            <span>Aprovar Despesa</span>
          </>
        )}
      </Button>
    </div>
  );
}

export function CaptureNarrative() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 xl:gap-20 items-center">
      <ScrollReveal delay={50} className="lg:col-span-6 space-y-4 sm:space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs sm:text-sm font-semibold text-primary-strong dark:text-primary">
          <Zap className="size-3.5 sm:size-4" aria-hidden="true" />
          <span>Eixo 5 · Captura Invisível &amp; OCR Local</span>
        </div>

        <h3 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-snug">
          Registro sem esforço com a segurança que seu banco exige
        </h3>

        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
          O principal motivo para alguém desistir de controlar as finanças é a fricção de ter que
          lembrar e anotar manualmente cada gasto do dia.
        </p>

        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed">
          Em vez de conexões bancárias frágeis que exigem suas senhas ou quebram a cada atualização,
          o Axir opera com duas vias integradas de captura local e um motor semântico adaptativo:
        </p>

        <div className="space-y-3.5 pt-1 text-xs sm:text-sm text-muted-foreground">
          <div className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface-raised/60 space-y-1">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Share2 className="size-4 text-primary shrink-0" aria-hidden="true" />
              <span>Caminho 1 (Rápido): Leitura Instantânea de Pix & Compartilhamento</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
              Copie o código Pix ou compartilhe comprovantes diretamente do aplicativo do seu banco
              pelo menu de compartilhamento. O Axir extrai favorecido, valor e data
              automaticamente do texto recebido.
            </p>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface-raised/60 space-y-1">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <FileText className="size-4 text-portfolio shrink-0" aria-hidden="true" />
              <span>Caminho 2 (Garantia): Leitura Universal de Comprovantes & Cupons</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
              Anexe cupons fiscais (NFC-e/SAT com múltiplos itens), boletos, carnês e slips de
              cartão parcelado. Nosso OCR local processa na hora no seu dispositivo, sem enviar
              fotos para a nuvem.
            </p>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface-raised/60 space-y-1">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Sparkles className="size-4 text-warning-strong dark:text-warning shrink-0" aria-hidden="true" />
              <span>Aprendizado de Comerciantes: memória ativa de CNPJs</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-6">
              O motor aprende onde você consome (ex.: &quot;Mc&quot; vira &quot;McDonald&apos;s&quot;
              em Alimentação com pagamento no Crédito). Quanto mais você usa, mais inteligente e
              invisível fica o registro.
            </p>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={150} className="lg:col-span-6">
        <Card className="border-border/80 bg-surface shadow-xl p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-6 rounded-2xl sm:rounded-3xl">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border/60 pb-3 sm:pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-positive-strong dark:text-positive" aria-hidden="true" />
              <span className="text-xs sm:text-sm font-bold text-foreground">
                Captura Local &amp; Privada
              </span>
            </div>
            <Badge variant="positive" size="xs" className="font-mono">
              Sem senhas bancárias
            </Badge>
          </div>

          <div className="p-3.5 sm:p-4 rounded-xl bg-surface-raised/60 border border-border/70 space-y-1.5">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-primary" aria-hidden="true" />
                Comprovante Pix ou Cupom Compartilhado
              </span>
              <span>Agora mesmo</span>
            </div>
            <p className="text-xs sm:text-sm font-mono text-foreground font-medium">
              Transferência Pix de R$ 42,90 para Padaria e Confeitaria Bella LTDA
            </p>
          </div>

          <div className="p-4 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/30 space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs">
              <span className="font-semibold text-primary-strong">
                Identificação Semântica Automática:
              </span>
              <Badge variant="default" size="xs">
                OCR no dispositivo
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-surface border border-border/60 min-w-0">
                <span className="text-muted-foreground block text-[11px] font-sans">Favorecido</span>
                <span className="font-bold text-foreground block break-words">Padaria Bella</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border/60 min-w-0">
                <span className="text-muted-foreground block text-[11px] font-sans">Valor</span>
                <MoneyText cents={4290} tone="negative" className="font-bold text-xs" />
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border/60 min-w-0">
                <span className="text-muted-foreground block text-[11px] font-sans">Categoria</span>
                <span className="font-bold text-foreground block break-words">Alimentação</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border/60 min-w-0">
                <span className="text-muted-foreground block text-[11px] font-sans">Pagamento</span>
                <span className="font-bold text-foreground block">Pix</span>
              </div>
            </div>

            <ApproveExpenseButton />
          </div>
        </Card>
      </ScrollReveal>
    </div>
  );
}
