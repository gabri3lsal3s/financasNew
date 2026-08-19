import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

const options = [
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "moradia", label: "Moradia" },
];

describe("Select", () => {
  it("renderiza o placeholder quando não há valor", () => {
    render(<Select value="" onValueChange={vi.fn()} options={options} placeholder="Escolha…" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Escolha…");
  });

  it("exibe o valor selecionado", () => {
    render(<Select value="transporte" onValueChange={vi.fn()} options={options} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Transporte");
  });

  it("abre a lista e notifica a seleção", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Select value="" onValueChange={onValueChange} options={options} />);

    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: "Alimentação" });
    await user.click(option);

    expect(onValueChange).toHaveBeenCalledWith("alimentacao");
  });

  it("permite interagir com múltiplos selects independentemente", async () => {
    const user = userEvent.setup();
    const onMethodChange = vi.fn();
    const onWeightChange = vi.fn();

    render(
      <div className="flex flex-col gap-4">
        <Select
          value=""
          onValueChange={onMethodChange}
          options={[
            { value: "pix", label: "Pix" },
            { value: "transfer", label: "Transferência" },
          ]}
          ariaLabel="Forma de pagamento"
        />
        <Select
          value=""
          onValueChange={onWeightChange}
          options={[
            { value: "1", label: "100%" },
            { value: "0.5", label: "50%" },
          ]}
          ariaLabel="Peso no relatório"
        />
      </div>,
    );

    const firstSelect = screen.getByRole("combobox", { name: "Forma de pagamento" });
    const secondSelect = screen.getByRole("combobox", { name: "Peso no relatório" });

    // Abre o primeiro select e escolhe Transferência
    await user.click(firstSelect);
    const transferOption = await screen.findByRole("option", { name: "Transferência" });
    await user.click(transferOption);

    expect(onMethodChange).toHaveBeenCalledWith("transfer");
    expect(onWeightChange).not.toHaveBeenCalled();

    // Agora abre o segundo select e escolhe 50%
    await user.click(secondSelect);
    const halfOption = await screen.findByRole("option", { name: "50%" });
    await user.click(halfOption);

    expect(onWeightChange).toHaveBeenCalledWith("0.5");
  });
});
