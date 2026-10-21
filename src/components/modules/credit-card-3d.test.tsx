import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreditCard3D } from "./credit-card-3d";
import type { CreditCard } from "@/types";

const mockCard: CreditCard = {
  id: "c1",
  user_id: "u1",
  name: "Nubank Ultravioleta",
  brand: "Mastercard",
  credit_limit: 10000,
  color: "#820AD1",
  closing_day: 10,
  due_day: 15,
  is_active: true,
};

describe("CreditCard3D — Apresentação da Fatura (ESPECIFICAÇÃO §3.3.3)", () => {
  it("exibe o valor bruto nominal (100%) como métrica principal de fatura", () => {
    render(
      <CreditCard3D
        card={mockCard}
        usedLimitCents={150000} // R$ 1.500,00 bruto
        usedLimitPonderadoCents={150000}
      />,
    );

    expect(screen.getByText("Fatura Total (Bruto)")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
    // Quando ponderado é idêntico ao bruto, não polui com chip redundante
    expect(screen.queryByText("Ponderada:")).not.toBeInTheDocument();
  });

  it("exibe a métrica ponderada como consulta analítica secundária quando há rateio", () => {
    render(
      <CreditCard3D
        card={mockCard}
        usedLimitCents={200000} // R$ 2.000,00 bruto nominal
        usedLimitPonderadoCents={100000} // R$ 1.000,00 pessoal ponderado
      />,
    );

    // Métrica principal com destaque: R$ 2.000,00
    expect(screen.getByText("Fatura Total (Bruto)")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.000,00")).toBeInTheDocument();

    // Métrica analítica secundária: "Ponderada: R$ 1.000,00"
    expect(screen.getByText("Ponderada:")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
  });

  it("exibe informações essenciais de ciclo de datas e limite de crédito", () => {
    render(
      <CreditCard3D
        card={mockCard}
        usedLimitCents={300000} // R$ 3.000,00
      />,
    );

    expect(screen.getByText("Nubank Ultravioleta")).toBeInTheDocument();
    // Melhor dia = closing_day + 1 = 11
    expect(screen.getByText(/Melhor dia: 11/)).toBeInTheDocument();
    expect(screen.getByText(/Fech\.: 10/)).toBeInTheDocument();
    expect(screen.getByText(/Venc\.: 15/)).toBeInTheDocument();
    // Limite total: R$ 10.000,00 · Disponível: R$ 7.000,00
    expect(screen.getByText("R$ 7.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 10.000,00")).toBeInTheDocument();
  });
});
