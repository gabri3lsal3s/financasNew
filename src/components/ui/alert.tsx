import { CheckCircle2, Info, TriangleAlert, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}

const variantIcon: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
};

const variantClass: Record<AlertVariant, string> = {
  info: "border-primary/30 bg-primary/5 text-foreground",
  success: "border-negative-strong/30 bg-negative-strong/5 text-foreground",
  warning: "border-attention/40 bg-attention/10 text-foreground",
  error: "border-critical/40 bg-critical/10 text-foreground",
};

const iconClass: Record<AlertVariant, string> = {
  info: "text-primary-strong",
  success: "text-negative-strong",
  warning: "text-attention",
  error: "text-critical",
};

/** Alerta do app — feedback explícito de erro/sucesso nas bordas de formulário. */
export function Alert({ variant = "info", children, className }: AlertProps) {
  const Icon = variantIcon[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm", variantClass[variant], className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass[variant])} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
