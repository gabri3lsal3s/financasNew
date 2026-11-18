import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCentsAsCurrency } from "@/services/masks";
import type { AssetCurrency } from "@/types";
import { NumberTicker } from "./number-ticker";

/**
 * MoneyText — primitivo de valor monetário (F12, hierarquia tipográfica).
 *
 * Padroniza o escaneamento rápido de dados financeiros: `.num` (mono +
 * tabular-nums — a máscara de privacidade global via CSS também o cobre),
 * escala por contexto e cor semântica automática com sinal explícito.
 */
export interface MoneyTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Valor em centavos (pode ser negativo — o sinal é derivado). */
  cents: number;
  /** Moeda da exibição (padrão BRL). */
  currency?: AssetCurrency;
  /** Escala: hero (KPI) · value (lista/linha) · caption (resumo/legenda). */
  variant?: "hero" | "value" | "caption";
  /**
   * Cor semântica: `auto` deriva do sinal (positivo → positive, negativo →
   * negative, zero → default); `positive`/`negative`/`default`/`portfolio`
   * forçam o tom.
   */
  tone?: "auto" | "positive" | "negative" | "default" | "portfolio";
  /**
   * Sinal exibido: `explicit` sempre `+`/`−` · `auto` apenas `−` quando
   * negativo · `none` nunca.
   */
  sign?: "auto" | "explicit" | "none";
  /** Quando true, anima a contagem numérica suavemente via NumberTicker. */
  animated?: boolean;
  /** Se true, oculta a fração de centavos (ex: "R$ 1.250"). Padrão false. */
  hideCents?: boolean;
  /** Suaviza visualmente a fração decimal `,XX` (padrão true quando `variant === "hero"`). */
  deemphasizeCents?: boolean;
}

const variantClass: Record<NonNullable<MoneyTextProps["variant"]>, string> = {
  hero: "text-lg font-semibold tracking-tight sm:text-xl lg:text-2xl",
  value: "text-sm font-semibold",
  caption: "text-xs font-medium",
};

type ExplicitTone = Exclude<NonNullable<MoneyTextProps["tone"]>, "auto">;

const toneClass: Record<ExplicitTone, string> = {
  positive: "text-positive-strong",
  negative: "text-negative-strong",
  default: "text-foreground",
  portfolio: "text-portfolio",
};

function resolveTone(tone: NonNullable<MoneyTextProps["tone"]>, cents: number): ExplicitTone {
  if (tone !== "auto") return tone;
  if (cents > 0) return "positive";
  if (cents < 0) return "negative";
  return "default";
}

function signPrefix(sign: NonNullable<MoneyTextProps["sign"]>, cents: number): string {
  if (cents === 0) return "";
  if (sign === "explicit") return cents > 0 ? "+" : "−";
  if (sign === "auto") return cents < 0 ? "−" : "";
  return "";
}

function formatMoneyNode(formatted: string, deemphasize: boolean): ReactNode {
  if (!deemphasize) return formatted;
  const match = formatted.match(/^(.*?)([,.]\d{2})$/);
  if (!match) return formatted;
  return (
    <>
      {match[1]}
      <span className="inline-block text-[0.82em] font-semibold opacity-80 tracking-normal align-baseline tabular-nums">
        {match[2]}
      </span>
    </>
  );
}

export function MoneyText({
  cents,
  currency = "BRL",
  variant = "value",
  tone = "auto",
  sign = "auto",
  animated = false,
  hideCents = false,
  deemphasizeCents,
  className,
  ...props
}: MoneyTextProps) {
  const shouldHideCents = hideCents;
  const shouldDeemphasizeCents =
    !shouldHideCents && (deemphasizeCents ?? variant === "hero");

  const resolvedTone = resolveTone(tone, cents);
  const prefix = signPrefix(sign, cents);

  if (animated) {
    return (
      <span
        className={cn("num whitespace-nowrap", variantClass[variant], toneClass[resolvedTone], className)}
        {...props}
      >
        {prefix}
        <NumberTicker
          value={Math.abs(cents)}
          format={(absVal) =>
            formatCentsAsCurrency(Math.round(absVal), currency, { hideCents: shouldHideCents })
          }
          renderValue={(absVal) =>
            formatMoneyNode(
              formatCentsAsCurrency(Math.round(absVal), currency, { hideCents: shouldHideCents }),
              shouldDeemphasizeCents,
            )
          }
        />
      </span>
    );
  }

  const formatted = `${prefix}${formatCentsAsCurrency(Math.abs(cents), currency, { hideCents: shouldHideCents })}`;

  return (
    <span
      className={cn("num whitespace-nowrap", variantClass[variant], toneClass[resolvedTone], className)}
      {...props}
    >
      {formatMoneyNode(formatted, shouldDeemphasizeCents)}
    </span>
  );
}
