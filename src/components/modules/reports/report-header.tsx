import type { ReactNode } from "react";
import { Landmark, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReportHeaderProps {
  /** Título principal do relatório (ex.: "Dossiê Executivo de Investimentos & Custódia"). */
  title: string;
  /** Subtítulo descritivo ou categoria do documento. */
  subtitle?: string;
  /** Período ou competência de referência (ex.: "Agosto de 2026", "Ano Base 2026"). */
  periodLabel?: string;
  /** Data e hora de geração formatada (padrão: data atual DD/MM/AAAA). */
  generatedAt?: string;
  /** Nome institucional da aplicação (padrão: "Guia Financeiro"). */
  appName?: string;
  /** Ícone temático da seção (padrão: Landmark). */
  icon?: LucideIcon;
  /** Titular ou identificação do investidor/usuário. */
  accountHolder?: string;
  className?: string;
  /** Ações ou badges adicionais no cabeçalho. */
  actions?: ReactNode;
}

/**
 * Cabeçalho Institucional de Relatório A4 / PDF.
 *
 * Padroniza a identidade oficial em 100% dos documentos impressos:
 * - Monograma oficial em Teal Petróleo (#1B6B62) e Ouro Âmbar (#DDA726);
 * - Tipografia Sora (font-display) para títulos editoriais de alto contraste;
 * - Metadados de emissão (competência, data/hora e titular) alinhados à direita.
 */
export function ReportHeader({
  title,
  subtitle,
  periodLabel,
  generatedAt,
  appName = "Guia Financeiro",
  icon: Icon = Landmark,
  accountHolder,
  className,
  actions,
}: ReportHeaderProps) {
  const emitDate = generatedAt ?? new Date().toLocaleDateString("pt-BR");

  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/80 pb-4 print:flex-row print:items-start print:pb-3.5 print:border-border/80",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {/* Monograma de Identidade Oficial */}
        <div className="relative flex size-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong shadow-xs shrink-0 print:border-primary/40">
          <Icon className="size-5" aria-hidden="true" />
          <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-accent border-2 border-surface shadow-xs print:border-white" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary-strong">
              {appName}
            </span>
            {actions}
          </div>
          <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-foreground print:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground print:text-[11px]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end text-left sm:text-right text-xs text-muted-foreground shrink-0 print:items-end print:text-right print:text-[11px]">
        {periodLabel && (
          <span className="font-semibold text-sm text-foreground print:text-xs">
            {periodLabel}
          </span>
        )}
        <span>Emitido em {emitDate}</span>
        {accountHolder && (
          <span className="text-[11px] text-muted-foreground/90 print:text-[10px]">
            Titular: <strong className="font-medium text-foreground">{accountHolder}</strong>
          </span>
        )}
      </div>
    </header>
  );
}
