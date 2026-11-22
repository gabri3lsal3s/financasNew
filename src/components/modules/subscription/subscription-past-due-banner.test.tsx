import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionPastDueBanner } from "./subscription-past-due-banner";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("SubscriptionPastDueBanner", () => {
  it("renderiza alerta crítico com CTA para regularizar assinatura e sem botão de dispensa", () => {
    render(
      <BrowserRouter>
        <SubscriptionPastDueBanner />
      </BrowserRouter>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Pagamento da assinatura pendente"),
    ).toBeInTheDocument();
    expect(screen.getByText("Crítico")).toBeInTheDocument();

    const cta = screen.getByRole("button", { name: /Regularizar assinatura/i });
    fireEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/configuracoes?tab=subscription",
    );
  });

  it("chama callback customizado onRegularize quando fornecido", () => {
    const onRegularize = vi.fn();
    render(
      <BrowserRouter>
        <SubscriptionPastDueBanner onRegularize={onRegularize} />
      </BrowserRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Regularizar assinatura/i }),
    );
    expect(onRegularize).toHaveBeenCalledTimes(1);
  });
});
