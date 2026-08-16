import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { Toaster } from "./toast";
import { ToastHost } from "./toast-host";
import { clearToasts, dismissToast, pushToast } from "@/services/toast";

function renderHost() {
  return render(
    <Toaster>
      <ToastHost />
    </Toaster>,
  );
}

describe("ToastHost (bus de toasts imperativos)", () => {
  beforeEach(() => {
    act(() => clearToasts());
  });

  it("renderiza um toast disparado via pushToast (rollback de mutação otimista)", () => {
    renderHost();

    act(() => {
      pushToast({
        title: "Não foi possível salvar a despesa",
        description: "Algo deu errado. Os dados foram restaurados.",
        variant: "destructive",
      });
    });

    expect(screen.getByText("Não foi possível salvar a despesa")).toBeInTheDocument();
    expect(screen.getByText(/os dados foram restaurados/i)).toBeInTheDocument();
  });

  it("remove o toast ao clicar em fechar (com animação de saída)", async () => {
    const user = userEvent.setup();
    renderHost();

    act(() => {
      pushToast({ title: "Toast temporário", variant: "info" });
    });

    const closeButton = screen.getByRole("button", { name: "Fechar" });
    await user.click(closeButton);

    // Animação de saída (300ms) antes da remoção do bus.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(screen.queryByText("Toast temporário")).not.toBeInTheDocument();
  });

  it("dismissToast remove o toast do host", () => {
    renderHost();

    let id = 0;
    act(() => {
      id = pushToast({ title: "Via dismissToast" });
    });
    expect(screen.getByText("Via dismissToast")).toBeInTheDocument();

    act(() => {
      dismissToast(id);
    });

    expect(screen.queryByText("Via dismissToast")).not.toBeInTheDocument();
  });

  it("remove o toast ao clicar diretamente no cartão do toast", async () => {
    const user = userEvent.setup();
    renderHost();

    act(() => {
      pushToast({ title: "Clique para fechar", variant: "success" });
    });

    const toastCard = screen.getByText("Clique para fechar");
    await user.click(toastCard);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(screen.queryByText("Clique para fechar")).not.toBeInTheDocument();
  });
});

