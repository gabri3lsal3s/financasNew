import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { updateVisualCustomization } from "@/hooks/use-visual-customization";
import * as sensoryModule from "@/services/sensory";
import { DataList, type DataListColumn } from "./data-list";

interface SampleRow {
  id: string;
  name: string;
  a: string;
  b: string;
  c: string;
}

const columns4: DataListColumn<SampleRow>[] = [
  { key: "name", header: "Nome", cell: (r) => r.name },
  { key: "a", header: "Col A", cell: (r) => r.a },
  { key: "b", header: "Col B", cell: (r) => r.b },
  { key: "c", header: "Col C", cell: (r) => r.c },
];

afterEach(() => {
  updateVisualCustomization({ density: "comfortable" });
  vi.restoreAllMocks();
});

describe("DataList", () => {
  it("conecta useVisualCustomization().density, ativa w-max para 4+ colunas e dispara sensory selection no clique", async () => {
    updateVisualCustomization({ density: "compact" });
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory");
    sensorySpy.mockClear();
    const onRowClick = vi.fn();
    const user = userEvent.setup();

    render(
      <DataList
        columns={columns4}
        rows={[{ id: "1", name: "Item 1", a: "10", b: "20", c: "30" }]}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
      />,
    );

    const table = screen.getByRole("table");
    expect(table).toHaveClass("w-max", "min-w-full");

    const rows = screen.getAllByRole("row");
    const dataRow = rows[1]!;
    expect(dataRow).toHaveClass("py-1.5", "border-border/80");

    await user.click(dataRow);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(sensorySpy).toHaveBeenCalledWith("selection");
  });
});
