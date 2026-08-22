import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { formatCentsAsCurrency } from "@/services/masks";
import type { AssetCurrency } from "@/types";

/**
 * MoneyText — primitivo de valor monetário (F12, hierarquia tipográfica).
 *
 * Padroniza o escaneamento rápido de dados financeiros: `.num` (mono +
 * tabular-nums — a máscara de privacidade global via CSS também o cobre),
 * escala por contexto e cor semântica automática com sinal explícito.
 * Substitui a formatação ad-hoc (`formatCentsAsBRL` + classes soltas).
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
   * forçam o tom (ex.: despesa sempre negative mesmo com valor positivo).
   */
  tone?: "auto" | "positive" | "negative" | "default" | "portfolio";
  /**
   * Sinal exibido: `explicit` sempre `+`/`−` · `auto` apenas `−` quando
   * negativo · `none` nunca (sinal já comunicado pelo contexto).
   */
  sign?: "auto" | "explicit" | "none";
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

/** Zero nunca recebe sinal; `explicit` marca ambos os sinais; `auto` só o negativo. */
function signPrefix(sign: NonNullable<MoneyTextProps["sign"]>, cents: number): string {
  if (cents === 0) return "";
  if (sign === "explicit") return cents > 0 ? "+" : "−";
  if (sign === "auto") return cents < 0 ? "−" : "";
  return "";
}

export function MoneyText({
  cents,
  currency = "BRL",
  variant = "value",
  tone = "auto",
  sign = "auto",
  className,
  ...props
}: MoneyTextProps) {
  const resolvedTone = resolveTone(tone, cents);
  const prefix = signPrefix(sign, cents);
  return (
    <span className={cn("num", variantClass[variant], toneClass[resolvedTone], className)} {...props}>
      {`${prefix}${formatCentsAsCurrency(Math.abs(cents), currency)}`}
    </span>
  );
}

