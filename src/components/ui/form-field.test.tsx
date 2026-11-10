import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./form-field";
import { Input } from "./input";

describe("FormField — Anatomia Canônica de Formulários (§4 Regra 15)", () => {
  it("renderiza label e input associados por htmlFor", () => {
    render(
      <FormField label="Nome da Categoria" htmlFor="cat-name">
        <Input id="cat-name" defaultValue="Alimentação" />
      </FormField>,
    );

    expect(screen.getByLabelText("Nome da Categoria")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alimentação")).toBeInTheDocument();
  });

  it("renderiza indicador de opcional quando prop optional é true", () => {
    render(
      <FormField label="Descrição" htmlFor="cat-desc" optional>
        <Input id="cat-desc" />
      </FormField>,
    );

    expect(screen.getByText("(opcional)")).toBeInTheDocument();
  });

  it("renderiza helper text", () => {
    render(
      <FormField label="E-mail" htmlFor="user-email" helperText="Nunca compartilharemos seu e-mail.">
        <Input id="user-email" />
      </FormField>,
    );

    expect(screen.getByText("Nunca compartilharemos seu e-mail.")).toBeInTheDocument();
  });

  it("renderiza mensagem de erro com role alert", () => {
    render(
      <FormField label="Valor" htmlFor="amount" error="O valor deve ser maior que zero.">
        <Input id="amount" />
      </FormField>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("O valor deve ser maior que zero.");
  });

  it("renderiza indicador de campo obrigatório (*)", () => {
    render(
      <FormField label="Senha" htmlFor="pass" required>
        <Input id="pass" />
      </FormField>,
    );

    expect(screen.getByText("*")).toBeInTheDocument();
  });
});
