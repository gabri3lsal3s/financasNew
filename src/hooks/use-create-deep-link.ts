import { useState } from "react";
import { useSearchParams } from "react-router";

/**
 * Abre um diálogo de criação a partir do FAB contextual (?novo=<key>).
 *
 * Estado DERIVADO da URL (padrão de deep-link do app — sem setState em
 * effect): enquanto o parâmetro estiver presente, o diálogo fica aberto;
 * fechar limpa o parâmetro (replace, sem sujar o histórico) e o estado
 * local volta a mandar. `fromUrl` permite abrir SEMPRE em modo criação
 * (ignorando qualquer item em edição pendente no estado da página).
 */
export function useCreateDeepLink(key: string, param = "novo"): {
  open: boolean;
  setOpen: (open: boolean) => void;
  fromUrl: boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const [localOpen, setLocalOpen] = useState(false);
  const urlKey = searchParams.get(param);
  const fromUrl = urlKey === key;
  const open = fromUrl || localOpen;

  const setOpen = (next: boolean) => {
    setLocalOpen(next);
    if (!next && fromUrl) {
      setSearchParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          updated.delete(param);
          return updated;
        },
        { replace: true },
      );
    }
  };

  return { open, setOpen, fromUrl };
}
