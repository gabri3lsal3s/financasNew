import { Camera, CreditCard, Layers, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui";

/**
 * Passo 1 do WelcomeModal: período de teste Pro, 3 pilares e categorias iniciais.
 */
export function WelcomeIntroStep() {
  return (
    <div className="space-y-3.5 py-1">
      <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
        <Sparkles className="size-5 shrink-0 text-primary-strong mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">30 Dias de Acesso Pro Total</span>
            <Badge variant="positive" size="xs">
              Sem Cartão
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            Você tem acesso irrestrito a Caixa Real e Saldo Livre diário, leitura de comprovantes via
            OCR e Pix, cartões em até 60x, Modo Família, Viagens, Carteira de Investimentos com
            Preço Teto e 7 Relatórios Executivos A4/Excel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
          <CreditCard className="size-4 text-muted-foreground mb-1.5" aria-hidden="true" />
          <h4 className="text-xs font-semibold text-foreground">Fluxo &amp; Cartões</h4>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
            Faturas automáticas, melhor dia de compra e saldo Safe-to-Spend diário.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
          <Camera className="size-4 text-muted-foreground mb-1.5" aria-hidden="true" />
          <h4 className="text-xs font-semibold text-foreground">Captura Inteligente</h4>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
            Leitura de cupons e comprovantes sem digitação com privacidade total.
          </p>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-3 shadow-xs">
          <TrendingUp className="size-4 text-portfolio mb-1.5" aria-hidden="true" />
          <h4 className="text-xs font-semibold text-foreground">Patrimônio &amp; Metas</h4>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
            Rebalanceamento matemático de carteira e planejamento de aposentadoria.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/50 p-2.5 text-xs text-muted-foreground">
        <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="leading-relaxed">
          Sua conta já inclui as 11 categorias essenciais organizadas (Alimentação, Moradia,
          Transporte, etc.) para você começar imediatamente.
        </p>
      </div>
    </div>
  );
}
