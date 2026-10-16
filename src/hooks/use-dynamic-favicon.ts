import { useEffect } from "react";

/**
 * Hook para alternar dinamicamente o favicon da aba do navegador:
 * - Usuário Pro: ativa os favicons em tons âmbar/dourado (/brand/favicon-pro-32.png e favicon-pro.ico)
 * - Usuário padrão/visitante: ativa os favicons em tom teal oficial (/brand/favicon-32.png e favicon.ico)
 */
export function useDynamicFavicon(isPro: boolean): void {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const favicon32 = isPro ? "/brand/favicon-pro-32.png" : "/brand/favicon-32.png";
    const favicon16 = isPro ? "/brand/favicon-pro-16.png" : "/brand/favicon-16.png";
    const faviconIco = isPro ? "/brand/favicon-pro.ico" : "/brand/favicon.ico";

    // Atualiza links de favicon existentes ou cria se não existirem
    const updateOrCreateLink = (rel: string, href: string, type?: string, sizes?: string) => {
      let link = document.querySelector<HTMLLinkElement>(
        sizes ? `link[rel="${rel}"][sizes="${sizes}"]` : `link[rel="${rel}"]:not([sizes])`
      );

      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        if (type) link.type = type;
        if (sizes) link.setAttribute("sizes", sizes);
        document.head.appendChild(link);
      }

      link.href = href;
    };

    updateOrCreateLink("icon", `${favicon32}?v=pro_${isPro ? "1" : "0"}`, "image/png", "32x32");
    updateOrCreateLink("icon", `${favicon16}?v=pro_${isPro ? "1" : "0"}`, "image/png", "16x16");
    updateOrCreateLink("icon", `${faviconIco}?v=pro_${isPro ? "1" : "0"}`, "image/x-icon");
    updateOrCreateLink("shortcut icon", `${faviconIco}?v=pro_${isPro ? "1" : "0"}`);
  }, [isPro]);
}
