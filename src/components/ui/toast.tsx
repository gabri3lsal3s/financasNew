import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "info" | "warning" | "destructive";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  /** Ação primária (Radix Action) — ex.: "Atualizar" no toast de nova versão PWA. */
  action?: ToastAction;
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
  success: "border-positive/40",
  info: "border-primary/40",
  warning: "border-warning/40",
  destructive: "border-critical/40",
};

const variantIconClass: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-positive-strong",
  info: "text-primary-strong",
  warning: "text-warning-strong",
  destructive: "text-critical-strong",
};

/** Toast próprio do app (Radix) — feedback de ações; substitui alert() nativo (DESIGN_SYSTEM §13). */
export function Toast({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  duration = 4000,
  action,
}: ToastProps) {
  const Icon = variantIcon[variant];
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest("button")) {
          onOpenChange(false);
        }
      }}
      className={cn(
        "pointer-events-auto flex w-full cursor-pointer select-none items-start gap-3 rounded-xl border bg-surface p-4 shadow-lg transition-transform active:scale-[0.99] data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out",
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
      {action ? (
        <ToastPrimitive.Action
          altText={action.label}
          onClick={action.onClick}
          className="shrink-0 rounded-md bg-surface-hover px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {action.label}
        </ToastPrimitive.Action>
      ) : null}
      <ToastPrimitive.Close
        aria-label="Fechar"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden="true" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/**
 * Provedor + viewport de toasts do app — montar uma vez no shell.
 * Os children (os toasts) são renderizados DENTRO do Provider (o Radix exige);
 * o Viewport fica como irmão — o conteúdo dos toasts entra nele via portal.
 */
export function Toaster({ children, ...props }: ComponentProps<typeof ToastPrimitive.Provider>) {
  return (
    <ToastPrimitive.Provider {...props}>
      {children}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-toast flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  );
}
