import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExportDataHub } from "./export-data-hub";
import type { ExportCsvKind } from "./export-data-hub";
import type { RestoreSummary } from "@/domain/export";

type HubProps = Parameters<typeof ExportDataHub>[0];

type MockedHubProps = HubProps & {
  onExportJson: ReturnType<typeof vi.fn>;
  onExportCsv: ReturnType<typeof vi.fn>;
  onRestore: ReturnType<typeof vi.fn>;
  onConfirmRestore: ReturnType<typeof vi.fn>;
};

const makeFile = (name = "backup.json") => new File([JSON.stringify({ version: 1 })], name, { type: "application/json" });

function renderHub(overrides: Partial<HubProps> = {}) {
  const defaults = {
    onExportJson: vi.fn().mockResolvedValue(undefined),
    onExportCsv: vi.fn().mockResolvedValue(undefined),
    onRestore: vi.fn().mockResolvedValue({ expenses: 3, categories: 5 } as RestoreSummary),
    onConfirmRestore: vi.fn().mockResolvedValue(undefined),
  };
  const props = { ...defaults, ...overrides } as MockedHubProps;
  const utils = render(<ExportDataHub {...props} />);
  return { props, ...utils };
}

describe("ExportDataHub (F22)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exporta o backup JSON ao clicar no botão", async () => {
    const { props } = renderHub();
    fireEvent.click(screen.getByRole("button", { name: "Exportar JSON" }));
    await waitFor(() => expect(props.onExportJson).toHaveBeenCalledTimes(1));
  });

  it("exporta CSV de despesas com o range do mês corrente", async () => {
    const { props } = renderHub();
    fireEvent.click(screen.getByRole("button", { name: /csv de despesas/i }));
    await waitFor(() => {
      expect(props.onExportCsv).toHaveBeenCalledTimes(1);
    });
    const [kind, range] = props.onExportCsv.mock.calls[0] as [ExportCsvKind, { start: string; end: string }];
    expect(kind).toBe("expenses");
    expect(range.start).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("usa intervalo customizado quando selecionado", async () => {
    const user = userEvent.setup();
    const { props } = renderHub();
    await user.click(screen.getByLabelText("Intervalo customizado"));

    // Seleciona dia 5 como início (botão de dia do DayPicker).
    await user.click(screen.getByRole("button", { name: "Data inicial" }));
    await user.click(screen.getByRole("button", { name: /, 5 de /i }));

    // Seleciona dia 20 como fim.
    await user.click(screen.getByRole("button", { name: "Data final" }));
    await user.click(screen.getByRole("button", { name: /, 20 de /i }));

    await user.click(screen.getByRole("button", { name: /csv de receitas/i }));
    await waitFor(() => expect(props.onExportCsv).toHaveBeenCalledTimes(1));
    const [kind, range] = props.onExportCsv.mock.calls[0] as [ExportCsvKind, { start: string; end: string }];
    expect(kind).toBe("incomes");
    expect(range.start).toMatch(/^\d{4}-\d{2}-05$/);
    expect(range.end).toMatch(/^\d{4}-\d{2}-21$/);
  });

  it("bloqueia exportação CSV com período inválido", async () => {
    const { props } = renderHub();
    fireEvent.click(screen.getByLabelText("Intervalo customizado"));
    fireEvent.click(screen.getByRole("button", { name: /csv de despesas/i }));
    await waitFor(() => expect(props.onExportCsv).not.toHaveBeenCalled());
  });

  it("valida o arquivo e abre a confirmação de restauração (2 etapas)", async () => {
    const { props } = renderHub();
    const zone = screen.getByRole("button", { name: /arraste o arquivo/i });
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile()] } });

    await waitFor(() => expect(props.onRestore).toHaveBeenCalledTimes(1));
    // Prévia da restauração aparece no dialog de confirmação.
    expect(screen.getByText("Resumo do backup")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /restaurar/i }));
    await waitFor(() => expect(props.onConfirmRestore).toHaveBeenCalledTimes(1));
  });

  it("mostra erro de validação e permite descartar", async () => {
    const { props } = renderHub({
      onRestore: vi.fn().mockRejectedValue(new Error("Backup incompleto: faltam tabelas do formato.")),
    });
    const zone = screen.getByRole("button", { name: /arraste o arquivo/i });
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile()] } });

    await waitFor(() => expect(props.onRestore).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Backup incompleto/)).toBeInTheDocument();
    expect(props.onConfirmRestore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(screen.queryByText(/Backup incompleto/)).not.toBeInTheDocument();
  });
});
