import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AndroidProBanner } from "./android-pro-banner";

const mockNavigate = vi.fn();
const shouldOfferMock = vi.fn(() => true);

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/services/native/app-links", () => ({
  shouldOfferAndroidApk: () => shouldOfferMock(),
}));

describe("AndroidProBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldOfferMock.mockReturnValue(true);
  });

  it("não renderiza fora de dispositivos elegíveis via shouldOfferAndroidApk()", () => {
    shouldOfferMock.mockReturnValue(false);
    const { container } = render(
      <MemoryRouter>
        <AndroidProBanner onDismiss={vi.fn()} />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza título, badge e texto informativo", () => {
    const handleDismiss = vi.fn();
    render(
      <MemoryRouter>
        <AndroidProBanner onDismiss={handleDismiss} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Instale o Aplicativo Android Pro")).toBeInTheDocument();
    expect(screen.getByText("App Android Pro")).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName.toLowerCase() === "p" &&
          Boolean(element?.textContent?.includes("Biometria física de hardware, escudo de privacidade"))
        );
      }),
    ).toBeInTheDocument();
  });

  it("chama onDismiss ao clicar no botão de fechar", () => {
    const handleDismiss = vi.fn();
    render(
      <MemoryRouter>
        <AndroidProBanner onDismiss={handleDismiss} />
      </MemoryRouter>,
    );

    const closeBtn = screen.getByLabelText("Dispensar sugestão");
    fireEvent.click(closeBtn);
    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it("redireciona para /configuracoes?tab=devices ao clicar em Baixar App Pro", () => {
    const handleDismiss = vi.fn();
    render(
      <MemoryRouter>
        <AndroidProBanner onDismiss={handleDismiss} />
      </MemoryRouter>,
    );

    const actionBtn = screen.getByRole("button", { name: /Baixar App Pro/i });
    fireEvent.click(actionBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=devices");
  });
});
