import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "info" | "warning" | "destructive";

export interface ToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

const variantIcon: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  destructive: XCircle,
};

const variantClass: Record<ToastVariant, string> = {
  default: "border-border",
  success: "border-negative-strong/40",
  info: "border-primary/40",
  warning: "border-attention/40",
  destructive: "border-critical/40",
};

const variantIconClass: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-negative-strong",
  info: "text-primary-strong",
  warning: "text-attention",
  destructive: "text-critical",
};

/** Toast próprio do app (Radix) — feedback de ações; substitui alert() nativo (DESIGN_SYSTEM §13). */
export function Toast({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  duration = 4000,
}: ToastProps) {
  const Icon = variantIcon[variant];
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-surface p-4 shadow-lg data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out",
        variantClass[variant],
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", variantIconClass[variant])} aria-hidden="true" />
      <div className="flex-1">
        <ToastPrimitive.Title className="text-sm font-semibold text-foreground">{title}</ToastPrimitive.Title>
        {description ? (
          <ToastPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">{description}</ToastPrimitive.Description>
        ) : null}
      </div>
      <ToastPrimitive.Close
        aria-label="Fechar"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden="true" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/** Provedor + viewport de toasts do app — montar uma vez no shell. */
export function Toaster(props: ComponentProps<typeof ToastPrimitive.Provider>) {
  return (
    <ToastPrimitive.Provider swipeDirection="right" {...props}>
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[60] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  );
}
