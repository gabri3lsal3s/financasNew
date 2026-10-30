import * as ToastPrimitive from "@radix-ui/react-toast";
import { Check, Info, TriangleAlert, X, XCircle } from "lucide-react";
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
  success: Check,
  info: Info,
  warning: TriangleAlert,
  destructive: XCircle,
};

const variantClass: Record<ToastVariant, string> = {
  default: "border-border/90",
  success: "border-primary/40",
  info: "border-primary/40",
  warning: "border-warning/40",
  destructive: "border-critical/40",
};

const variantIconBadgeClass: Record<ToastVariant, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-primary/15 text-primary-strong",
  info: "bg-primary/15 text-primary-strong",
  warning: "bg-warning/15 text-warning-strong",
  destructive: "bg-critical/15 text-critical-strong",
};

/** Toast próprio do app (Radix) — feedback de ações; substitui alert() nativo (DESIGN_SYSTEM §13). */
export function Toast({
  open,
  onOpenChange,
  title,
  description,
  variant = "default",
  duration = 3000,
  action,
}: ToastProps) {
  const Icon = variantIcon[variant];
  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      data-toast="true"
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest("button")) {
          onOpenChange(false);
        }
      }}
      className={cn(
        "pointer-events-auto flex w-full cursor-pointer select-none items-start gap-3 rounded-xl border bg-surface p-4 shadow-xl backdrop-blur-md transition-transform active:scale-[0.99] data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out data-[state=closed]:pointer-events-none",
        variantClass[variant],
      )}
    >
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          variantIconBadgeClass[variant],
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
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
        className="size-7 shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
    <ToastPrimitive.Provider duration={3000} swipeDirection="down" {...props}>
      {children}
      <ToastPrimitive.Viewport className="fixed z-toast flex flex-col gap-2 outline-none pointer-events-none bottom-[calc(4.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-sm px-0 sm:left-auto sm:translate-x-0 sm:right-6 sm:bottom-6 sm:w-full sm:max-w-sm" />
    </ToastPrimitive.Provider>
  );
}
