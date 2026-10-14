import { useState } from "react";
import { useSearchParams } from "react-router";

export interface UseCreateDeepLinkOptions {
  /** Se ativo (modo somente-leitura), bloqueia a abertura do diálogo e limpa o deep-link. */
  isReadOnly?: boolean;
}

/**
 * Abre um diálogo de criação a partir do FAB contextual (?novo=<key>).
 *
 * Estado DERIVADO da URL (padrão de deep-link do app — sem setState em
 * effect): enquanto o parâmetro estiver presente, o diálogo fica aberto;
 * fechar limpa o parâmetro (replace, sem sujar o histórico) e o estado
 * local volta a mandar. `fromUrl` permite abrir SEMPRE em modo criação
 * (ignorando qualquer item em edição pendente no estado da página).
 *
 * BLINDAGEM READ-ONLY: se o usuário estiver em modo somente-leitura,
 * o diálogo nunca abre e `setOpen(true)` é ignorado.
 */
export function useCreateDeepLink(
  key: string,
  paramOrOptions?: string | UseCreateDeepLinkOptions,
  maybeOptions?: UseCreateDeepLinkOptions,
): {
  open: boolean;
  setOpen: (open: boolean) => void;
  fromUrl: boolean;
  isReadOnly: boolean;
} {
  const param = typeof paramOrOptions === "string" ? paramOrOptions : "novo";
  const options = typeof paramOrOptions === "object" ? paramOrOptions : maybeOptions;
  const isReadOnly = Boolean(options?.isReadOnly);

  const [searchParams, setSearchParams] = useSearchParams();
  const [localOpen, setLocalOpen] = useState(false);
  const urlKey = searchParams.get(param);
  const fromUrl = !isReadOnly && urlKey === key;
  const open = !isReadOnly && (fromUrl || localOpen);

  const setOpen = (next: boolean) => {
    if (isReadOnly && next) {
      return;
    }
    setLocalOpen(next);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        if (next && !isReadOnly) {
          updated.set(param, key);
        } else if (updated.get(param) === key) {
          updated.delete(param);
        }
        return updated;
      },
      { replace: true },
    );
  };

  return { open, setOpen, fromUrl, isReadOnly };
}
