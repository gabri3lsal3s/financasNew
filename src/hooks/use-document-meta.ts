import { useEffect } from "react";

const SITE_URL = "https://axir.com.br";

const DEFAULT_META = {
  title: "Axir — Gestão Financeira Pessoal, Cartões de Crédito e Aportes",
  description:
    "Gestão financeira pessoal, controle de cartões de crédito e motor determinístico de rebalanceamento de carteira. 100% Online First e seguro.",
  canonical: `${SITE_URL}/`,
  robots: "index, follow, max-image-preview:large",
} as const;

export interface DocumentMetaOptions {
  /** Título exibido na aba e nos resultados de busca. */
  title: string;
  /** Descrição curta (ideal entre 120 e 160 caracteres). */
  description?: string;
  /** Caminho canônico relativo, iniciado por "/". */
  canonicalPath?: string;
  /** Diretiva de indexação. Padrão: index, follow. */
  robots?: string;
}

function setMetaByName(name: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function buildCanonical(pathname: string): string {
  if (!pathname || pathname === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function applyMeta({ title, description, canonicalPath, robots }: DocumentMetaOptions): void {
  const descriptionText = description ?? DEFAULT_META.description;
  const canonical = buildCanonical(canonicalPath ?? "/");
  const robotsDirective = robots ?? DEFAULT_META.robots;

  document.title = title;
  setMetaByName("description", descriptionText);
  setMetaByName("robots", robotsDirective);
  setMetaByProperty("og:title", title);
  setMetaByProperty("og:description", descriptionText);
  setMetaByProperty("og:url", canonical);
  setMetaByName("twitter:title", title);
  setMetaByName("twitter:description", descriptionText);
  setCanonical(canonical);
}

/**
 * Atualiza metadados SEO por rota em uma SPA: título, descrição, canonical,
 * OpenGraph e Twitter Card. Ao desmontar, restaura o estado anterior somente
 * se nenhuma outra página já tiver assumido os metadados.
 */
export function useDocumentMeta(options: DocumentMetaOptions): void {
  const { title, description, canonicalPath, robots } = options;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const previousTitle = document.title;
    const previousDescription =
      document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
      DEFAULT_META.description;
    const previousCanonical =
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
      DEFAULT_META.canonical;

    applyMeta({ title, description, canonicalPath, robots });

    return () => {
      if (document.title !== title) return;
      applyMeta({
        title: previousTitle || DEFAULT_META.title,
        description: previousDescription,
        canonicalPath: previousCanonical.replace(SITE_URL, "") || "/",
      });
    };
  }, [title, description, canonicalPath, robots]);
}
