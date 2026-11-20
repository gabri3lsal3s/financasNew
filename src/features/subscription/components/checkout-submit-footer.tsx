import { Link } from "react-router";
import { ChevronRight, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui";
import type { CheckoutPaymentMethod } from "../utils/checkout-validation";

export interface CheckoutSubmitFooterProps {
  showSubmitButton: boolean;
  activeMethod: CheckoutPaymentMethod;
  isPending: boolean;
  onConfirm: () => void;
}

export function CheckoutSubmitFooter({
  showSubmitButton,
  activeMethod,
  isPending,
  onConfirm,
}: CheckoutSubmitFooterProps) {
  return (
    <>
      {showSubmitButton ? (
        <Button
          type="button"
          variant="solid"
          size="lg"
          sensoryIntent={false}
          className="w-full gap-2 rounded-xl text-base font-semibold shadow-sm"
          disabled={isPending}
          onClick={onConfirm}
        >
          {isPending ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              Processando com gateway seguro...
            </>
          ) : activeMethod === "pix" ? (
            <>
              <QrCode className="size-5" aria-hidden="true" />
              Gerar QR Code PIX
            </>
          ) : (
            <>
              <ChevronRight className="size-5" aria-hidden="true" />
              Confirmar Assinatura Pro
            </>
          )}
        </Button>
      ) : null}

      <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
        Ao confirmar, você concorda com os{" "}
        <Link
          to="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-strong font-medium hover:text-primary hover:underline transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link
          to="/privacidade"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-strong font-medium hover:text-primary hover:underline transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Política de Privacidade
        </Link>
        . Garantia incondicional de 7 dias com estorno integral (CDC Art. 49) e cancelamento a
        qualquer momento em 1 clique.
      </p>
    </>
  );
}
