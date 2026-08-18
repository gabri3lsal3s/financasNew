import { useEffect, useState } from "react";
import { Toast } from "@/components/ui/toast";
import { dismissToast, subscribeToasts, type ToastItem } from "@/services/toast";

/** Item local do host: estado de abertura controla a animação de saída. */
interface HostToast extends ToastItem {
  open: boolean;
}

/** Componente item com timer autônomo de auto-dismiss garantido. */
function ToastHostItem({ item, onDismiss }: { item: HostToast; onDismiss: () => void }) {
  useEffect(() => {
    if (!item.open) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, item.duration || 3000);
    return () => clearTimeout(timer);
  }, [item.id, item.open, item.duration, onDismiss]);

  return (
    <Toast
      open={item.open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
      title={item.title}
      description={item.description}
      variant={item.variant}
      duration={item.duration}
    />
  );
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
        <ToastHostItem
          key={item.id}
          item={item}
          onDismiss={() => handleDismiss(item.id)}
        />
      ))}
    </>
  );
}
