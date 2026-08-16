import { useEffect, useState } from "react";
import { Toast } from "@/components/ui/toast";
import { dismissToast, subscribeToasts, type ToastItem } from "@/services/toast";

/** Item local do host: estado de abertura controla a animação de saída. */
interface HostToast extends ToastItem {
  open: boolean;
}

/**
 * Assinante único do bus de toasts (`services/toast.ts`) — montar dentro do
 * `Toaster` (providers). Renderiza cada toast com animação de saída: ao
 * fechar, `open` vai a false e o item é removido após a animação (toast-out).
 */
export function ToastHost() {
  const [items, setItems] = useState<HostToast[]>([]);

  useEffect(
    () =>
      subscribeToasts((toasts) =>
        setItems(toasts.map((toast) => ({ ...toast, open: true }))),
      ),
    [],
  );

  const handleDismiss = (id: number) => {
    // Mantém o item montado com open=false para a animação de saída, depois remove.
    setItems((current) => current.map((item) => (item.id === id ? { ...item, open: false } : item)));
    window.setTimeout(() => dismissToast(id), 300);
  };

  return (
    <>
      {items.map((item) => (
        <Toast
          key={item.id}
          open={item.open}
          onOpenChange={(next) => {
            if (!next) handleDismiss(item.id);
          }}
          title={item.title}
          description={item.description}
          variant={item.variant}
          duration={item.duration}
        />
      ))}
    </>
  );
}
