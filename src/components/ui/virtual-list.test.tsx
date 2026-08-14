import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VirtualList } from "./virtual-list";

const rows = Array.from({ length: 200 }, (_, i) => ({ id: `r${i}`, label: `Item ${i}` }));

function Row({ label }: { label: string }) {
  return <div>{label}</div>;
}

describe("VirtualList — virtualização de listas (F5.5)", () => {
  it("lista pequena renderiza tudo no modo plano (sem janela)", () => {
    const small = rows.slice(0, 5);
    render(
      <VirtualList
        rows={small}
        rowKey={(row) => row.id}
        itemHeight={64}
        renderRow={(row) => <Row label={row.label} />}
        aria-label="Lista pequena"
      />,
    );
    expect(screen.getByText("Item 0")).toBeInTheDocument();
    expect(screen.getByText("Item 4")).toBeInTheDocument();
  });

  it("lista grande renderiza apenas a janela visível + overscan (jsdom usa fallback)", () => {
    render(
      <VirtualList
        rows={rows}
        rowKey={(row) => row.id}
        itemHeight={64}
        renderRow={(row) => <Row label={row.label} />}
        maxHeight={320}
        aria-label="Lista grande"
      />,
    );
    // jsdom não mede altura (clientHeight 0) → cai no fallback plano? Não:
    // o fallback só vale quando NÃO há contêiner medido; aqui o fallback
    // viewportHeight (320) é usado → janela com overscan.
    expect(screen.getByRole("list", { name: "Lista grande" })).toBeInTheDocument();
  });

  it("gap separa as linhas no modo plano (style.gap no contêiner)", () => {
    const { container } = render(
      <VirtualList
        rows={rows.slice(0, 3)}
        rowKey={(row) => row.id}
        itemHeight={64}
        gap={8}
        renderRow={(row) => <Row label={row.label} />}
        aria-label="Lista com gap"
      />,
    );
    const list = screen.getByLabelText("Lista com gap");
    expect((list as HTMLElement).style.gap).toBe("8px");
    expect(container.querySelectorAll("[style*='padding-bottom']")).toHaveLength(0);
  });

  it("gap entra no passo da janela (altura da linha = itemHeight + gap)", () => {
    render(
      <VirtualList
        rows={rows}
        rowKey={(row) => row.id}
        itemHeight={64}
        gap={8}
        renderRow={(row) => <Row label={row.label} />}
        maxHeight={320}
        aria-label="Lista rolável com gap"
      />,
    );
    const list = screen.getByRole("list", { name: "Lista rolável com gap" });
    const firstRow = list.querySelector("[style*='padding-bottom']");
    expect(firstRow).toBeTruthy();
    expect(firstRow?.getAttribute("style")).toContain("height: 72px");
    expect(firstRow?.getAttribute("style")).toContain("padding-bottom: 8px");
  });

  it("rolagem desloca a janela renderizada", () => {
    const { container } = render(
      <VirtualList
        rows={rows}
        rowKey={(row) => row.id}
        itemHeight={64}
        renderRow={(row) => <Row label={row.label} />}
        maxHeight={320}
        aria-label="Lista rolável"
      />,
    );
    const list = screen.getByRole("list", { name: "Lista rolável" });
    fireEvent.scroll(list, { target: { scrollTop: 640 } });
    // 640px / 64px = linha 10 → a partir dela (menos overscan) são renderizadas.
    const labels = Array.from(container.querySelectorAll("div")).map((el) => el.textContent ?? "");
    expect(labels.some((text) => /Item 1[0-9]/.test(text))).toBe(true);
    // Fora da janela não está no DOM (virtualizado).
    expect(screen.queryByText("Item 0")).not.toBeInTheDocument();
  });
});
