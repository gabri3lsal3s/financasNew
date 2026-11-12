import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDocumentMeta } from "./use-document-meta";

const SITE_URL = "https://axir.com.br";

function getMeta(selector: string): string | null {
  return document.head.querySelector(selector)?.getAttribute("content") ?? null;
}

describe("useDocumentMeta", () => {
  afterEach(() => {
    document.title = "";
    document.head
      .querySelectorAll('meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]')
      .forEach((element) => element.remove());
  });

  it("aplica título, descrição, canonical, OpenGraph e diretiva de robôs", () => {
    renderHook(() =>
      useDocumentMeta({
        title: "Ferramentas — Axir",
        description: "Simuladores gratuitos.",
        canonicalPath: "/ferramentas",
      }),
    );

    expect(document.title).toBe("Ferramentas — Axir");
    expect(getMeta('meta[name="description"]')).toBe("Simuladores gratuitos.");
    expect(getMeta('meta[property="og:title"]')).toBe("Ferramentas — Axir");
    expect(getMeta('meta[property="og:url"]')).toBe(`${SITE_URL}/ferramentas`);
    expect(getMeta('meta[name="twitter:title"]')).toBe("Ferramentas — Axir");
    expect(getMeta('meta[name="robots"]')).toBe("index, follow, max-image-preview:large");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `${SITE_URL}/ferramentas`,
    );
  });

  it("normaliza a raiz e respeita diretiva noindex", () => {
    renderHook(() =>
      useDocumentMeta({
        title: "Área restrita — Axir",
        canonicalPath: "/",
        robots: "noindex, nofollow",
      }),
    );

    expect(getMeta('meta[name="robots"]')).toBe("noindex, nofollow");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `${SITE_URL}/`,
    );
  });

  it("restaura os metadados anteriores ao desmontar", () => {
    document.title = "Axir";
    const { unmount } = renderHook(() =>
      useDocumentMeta({ title: "Planos — Axir", canonicalPath: "/planos" }),
    );

    expect(document.title).toBe("Planos — Axir");
    unmount();
    expect(document.title).toBe("Axir");
  });
});
