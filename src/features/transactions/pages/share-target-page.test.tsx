import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as nativeModule from "@/services/native";
import * as toastModule from "@/services/toast";
import * as sensoryModule from "@/services/sensory";
import { ShareTargetPage } from "./share-target-page";

const mockNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("ShareTargetPage — Web Share Target PWA (§4.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona para / quando não há parâmetros de compartilhamento", () => {
    render(
      <MemoryRouter initialEntries={["/share-target"]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("extrai texto de comprovante Pix compartilhado, processa, emite Toast de sucesso e redireciona para /", () => {
    const processPixShareSpy = vi.spyOn(nativeModule, "processPixShare").mockReturnValue({
      id: "pix_123",
      bankName: "Nubank",
      nature: "expense",
      type: "expense",
      amountCents: 12050,
      currency: "BRL",
      description: "Pix: Mercado Central",
      merchant: "Mercado Central",
      timestamp: Date.now(),
      date: "2026-08-16",
      paymentMethod: "pix",
      rawText: "Comprovante Pix Nubank: Valor R$ 120,50 Beneficiário: Mercado Central",
    });

    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});

    render(
      <MemoryRouter
        initialEntries={[
          `/share-target?text=${encodeURIComponent(
            "Comprovante Pix Nubank: Valor R$ 120,50 Beneficiário: Mercado Central",
          )}`,
        ]}
      >
        <ShareTargetPage />
      </MemoryRouter>,
    );

    expect(processPixShareSpy).toHaveBeenCalledWith(
      "Comprovante Pix Nubank: Valor R$ 120,50 Beneficiário: Mercado Central",
    );
    expect(sensorySpy).toHaveBeenCalledWith("success");
    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Comprovante Pix detectado",
        description: expect.stringMatching(/120,50/),
        variant: "success",
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("quando o texto compartilhado não é reconhecido, emite Toast de aviso e redireciona para /", () => {
    vi.spyOn(nativeModule, "processPixShare").mockReturnValue(null);
    const pushToastSpy = vi.spyOn(toastModule, "pushToast").mockReturnValue(1);
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/share-target?text=Texto%20aleatorio%20sem%20valor"]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    expect(sensorySpy).toHaveBeenCalledWith("warning");
    expect(pushToastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Comprovante não identificado",
        variant: "destructive",
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("concatena title, text e url se múltiplos campos forem enviados pelo Web Share Target", () => {
    const processPixShareSpy = vi.spyOn(nativeModule, "processPixShare").mockReturnValue(null);

    render(
      <MemoryRouter
        initialEntries={[
          "/share-target?title=Comprovante&text=Pix%20Enviado%20R$%2010&url=https://nu.com",
        ]}
      >
        <ShareTargetPage />
      </MemoryRouter>,
    );

    expect(processPixShareSpy).toHaveBeenCalledWith(
      "Pix Enviado R$ 10\nComprovante\nhttps://nu.com",
    );
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("renderiza skeleton acessível de carregamento", () => {
    render(
      <MemoryRouter initialEntries={["/share-target"]}>
        <ShareTargetPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("region", { name: "Processamento de comprovante compartilhado" })).toBeInTheDocument();
    expect(screen.getByText("Processando comprovante compartilhado...")).toBeInTheDocument();
  });
});
