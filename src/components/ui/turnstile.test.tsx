import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Turnstile } from "./turnstile";

describe("Turnstile (§F47)", () => {
  it("renderiza o componente com indicação de verificação de segurança", () => {
    render(<Turnstile />);
    expect(screen.getByText("Verificação de segurança ativa")).toBeInTheDocument();
  });

  it("chama onVerify no fallback de ambiente de testes", async () => {
    vi.useFakeTimers();
    const onVerifySpy = vi.fn();

    render(<Turnstile onVerify={onVerifySpy} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onVerifySpy).toHaveBeenCalledWith("local-turnstile-token");
    vi.useRealTimers();
  });
});
