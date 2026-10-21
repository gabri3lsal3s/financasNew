import { useState } from "react";
import { Check, Clipboard, ClipboardPaste } from "lucide-react";
import {
  Badge,
  Button,
  MoneyText,
  ResponsiveDialog,
  Textarea,
} from "@/components/ui";
import { CategoryIcon } from "@/components/modules/category-icon";
import {
  lookupMerchantCategory,
  parseBankNotification,
  parsePixShareText,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import {
  addPendingSuggestion,
  processPixShare,
  useMerchantCategoryMapping,
} from "@/services/native";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsCurrency } from "@/services/masks";

export interface PasteReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback opcional acionado quando o comprovante é convertido com sucesso */
  onParsed?: (parsed: ParsedBankTransaction) => void;
}

/**
 * Diálogo ergonômico de "Colar Comprovante / Notificação" (Fallback Web/PWA — §4.2).
 *
 * Permite ao usuário em ambiente Web, PWA ou desktop colar manualmente o texto
 * copiado de um comprovante Pix, SMS bancário ou notificação recebida,
 * convertendo instantaneamente em uma sugestão pronta para conferência ou preenchimento.
 */
export function PasteReceiptDialog({
  open,
  onOpenChange,
  onParsed,
}: PasteReceiptDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const merchantMemory = useMerchantCategoryMapping();

  // Derivação em tempo real de parsing para pré-visualização instantânea
  const trimmed = text.trim();
  const rawPreview: ParsedBankTransaction | null = trimmed
    ? parsePixShareText(trimmed) || parseBankNotification({ title: "", text: trimmed })
    : null;

  // Aplica memorização aprendida de categoria caso disponível
  const parsedPreview: ParsedBankTransaction | null = rawPreview
    ? {
        ...rawPreview,
        categorySlug:
          lookupMerchantCategory(rawPreview.merchant, merchantMemory) ||
          rawPreview.categorySlug,
      }
    : null;


  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText) {
          setText(clipText);
          setError(null);
          triggerSensory("action");
        }
      }
    } catch {
      // Ignora erro de permissão de clipboard e mantém fluxo manual
    }
  };

  const handleClose = () => {
    setText("");
    setError(null);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!trimmed) return;

    const parsed = processPixShare(trimmed);

    if (parsed) {
      triggerSensory("success");
      const formattedAmount = formatCentsAsCurrency(parsed.amountCents);

      if (onParsed) {
        onParsed(parsed);
      } else {
        addPendingSuggestion(parsed);
        pushToast({
          title: "Comprovante reconhecido",
          description: `${parsed.description} no valor de ${formattedAmount} pronto para confirmação.`,
          variant: "success",
        });
      }

      handleClose();
    } else {
      triggerSensory("warning");
      setError(
        "Não foi possível identificar um comprovante ou notificação bancária válida no texto inserido. Verifique se o valor (ex.: R$ 50,00) está legível.",
      );
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
        else onOpenChange(next);
      }}
      title="Colar Comprovante ou Notificação"
      description="Cole o texto de um comprovante Pix, SMS bancário ou notificação copiada para convertê-lo automaticamente em lançamento."
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="w-full sm:w-auto cursor-pointer"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleConfirm}
            disabled={!trimmed}
            className="w-full sm:w-auto font-semibold cursor-pointer shadow-xs gap-1.5"
            aria-label="Confirmar conversão do comprovante colado"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>Converter em Lançamento</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Texto do comprovante ou notificação
            </span>
            {typeof navigator !== "undefined" && Boolean(navigator.clipboard?.readText) && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handlePasteFromClipboard}
                className="text-xs text-muted-foreground hover:text-foreground h-6 px-2 gap-1 cursor-pointer"
                aria-label="Colar da área de transferência"
              >
                <Clipboard className="size-3" aria-hidden="true" />
                <span>Colar da área de transferência</span>
              </Button>
            )}
          </div>

          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            placeholder={`Exemplos:\n• Comprovante Pix: Valor R$ 90,00 Pago para: Supermercado Aliança\n• Compra de R$ 52,90 aprovada no Nubank em Padaria Estrela`}
            rows={5}
            className="text-xs font-mono resize-none"
            aria-label="Campo para colar texto de comprovante"
            error={error ?? undefined}
          />
        </div>

        {/* Pré-visualização determinística instantânea */}
        {parsedPreview && (
          <div
            role="region"
            aria-label="Pré-visualização da transação detectada"
            className="rounded-xl border border-border/80 bg-surface shadow-xs p-3.5 flex flex-col gap-2 transition-all animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {parsedPreview.isRefund ? (
                  <Badge variant="warning" size="xs">
                    Estorno
                  </Badge>
                ) : (
                  <Badge
                    variant={
                      parsedPreview.nature === "investment"
                        ? "portfolio"
                        : parsedPreview.type === "income"
                          ? "positive"
                          : "muted"
                    }
                    size="xs"
                  >
                    {parsedPreview.nature === "investment"
                      ? "Investimento"
                      : parsedPreview.type === "income"
                        ? "Renda"
                        : "Despesa"}
                  </Badge>
                )}


                <Badge variant="muted" size="xs">
                  {parsedPreview.bankName}
                </Badge>

                {parsedPreview.categorySlug && (
                  <Badge variant="muted" size="xs" className="gap-1">
                    <CategoryIcon
                      icon={parsedPreview.categorySlug}
                      className="size-2.5"
                    />
                    <span className="capitalize">{parsedPreview.categorySlug}</span>
                  </Badge>
                )}
              </div>

              <MoneyText
                cents={parsedPreview.amountCents}
                tone={
                  parsedPreview.nature === "investment"
                    ? "portfolio"
                    : parsedPreview.type === "income"
                      ? "positive"
                      : "default"
                }
                variant="value"
                className="shrink-0 font-semibold"
              />
            </div>

            <div className="text-xs font-medium text-foreground">
              {parsedPreview.description}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/40 text-[11px] text-muted-foreground">
          <ClipboardPaste className="size-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Compatível com comprovantes Pix de todos os bancos homologados (Nubank, Itaú, Bradesco, Inter, BB, Mercado Pago, etc.) e notificações de cartão.
          </span>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
