import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ExperiencePresetsCard } from "./experience-presets-card";
import { VisualIdentityCard } from "./visual-identity-card";
import { InterfaceShortcutsCard } from "./interface-shortcuts-card";

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("Appearance Subcomponents (Fase 1 — Tarefa 1.3)", () => {
  describe("ExperiencePresetsCard", () => {
    it("renderiza opções de preset e permite selecionar um modo", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <ExperiencePresetsCard
          activePreset="dynamic"
          onSelectPreset={onSelect}
        />,
      );

      expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
      expect(screen.getByText("Preset Ativo")).toBeInTheDocument();

      const minimalBtn = screen.getByText("Foco").closest("button");
      expect(minimalBtn).not.toBeNull();
      await user.click(minimalBtn!);

      expect(onSelect).toHaveBeenCalledWith("minimal");
    });

    it("exibe aviso e botão de restauração quando preset é customizado", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <ExperiencePresetsCard
          activePreset="custom"
          onSelectPreset={onSelect}
        />,
      );

      expect(screen.getByText("Modo: Personalizado")).toBeInTheDocument();
      expect(
        screen.getByText("Você possui ajustes finos personalizados ativos."),
      ).toBeInTheDocument();

      const restoreBtn = screen.getByRole("button", { name: /Restaurar Modo Padrão/i });
      await user.click(restoreBtn);

      expect(onSelect).toHaveBeenCalledWith("dynamic");
    });
  });

  describe("VisualIdentityCard", () => {
    it("permite selecionar tema e cor de destaque para usuário Pro", async () => {
      const user = userEvent.setup();
      const onSelectTheme = vi.fn();
      const onSelectAccent = vi.fn();

      renderWithProviders(
        <VisualIdentityCard
          themePref="dark"
          onSelectTheme={onSelectTheme}
          accent="teal"
          onSelectAccent={onSelectAccent}
          isPro={true}
        />,
      );

      expect(screen.getByText("Tema da Interface")).toBeInTheDocument();
      expect(screen.getByText("Cor de Destaque (Accent)")).toBeInTheDocument();
      expect(screen.queryByText(/Estilo de Superfícies/i)).not.toBeInTheDocument();

      const lightOption = screen.getByRole("button", { name: /^Claro/i });
      await user.click(lightOption);
      expect(onSelectTheme).toHaveBeenCalledWith("light", "Claro");

      const goldOption = screen.getByRole("button", { name: /^Ouro Âmbar/i });
      await user.click(goldOption);
      expect(onSelectAccent).toHaveBeenCalledWith("gold", "Ouro Âmbar");

      const monoOption = screen.getByRole("button", { name: /^Monocromático/i });
      expect(monoOption).toBeInTheDocument();
      await user.click(monoOption);
      expect(onSelectAccent).toHaveBeenCalledWith("mono", "Monocromático");
    });

    it("ao ser usuário Free, clicar em Ouro Âmbar intercepta com o diálogo de Upgrade Pro", async () => {
      const user = userEvent.setup();
      const onSelectTheme = vi.fn();
      const onSelectAccent = vi.fn();

      renderWithProviders(
        <VisualIdentityCard
          themePref="light"
          onSelectTheme={onSelectTheme}
          accent="teal"
          onSelectAccent={onSelectAccent}
          isPro={false}
        />,
      );

      const goldOption = screen.getByRole("button", { name: /^Ouro Âmbar/i });
      await user.click(goldOption);

      // Não seleciona a cor diretamente
      expect(onSelectAccent).not.toHaveBeenCalled();

      // Dispara o diálogo de upgrade do Axir Pro
      expect(screen.getByText(/Ouro Âmbar \(Exclusivo Pro\)/i)).toBeInTheDocument();
    });
  });

  describe("InterfaceShortcutsCard", () => {
    it("omite o logotipo fixo da grade e respeita limite de 2 atalhos de ação", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();

      renderWithProviders(
        <InterfaceShortcutsCard
          headerButtons={{
            logo: true,
            calculatorButton: true,
            themeToggle: true,
            privacyToggle: false,
          }}
          onToggleHeaderButton={onToggle}
        />,
      );

      expect(screen.queryByRole("checkbox", { name: "Logotipo Oficial" })).not.toBeInTheDocument();

      // Com calculadora e tema ativados (2 slots), o atalho de privacidade deve estar desabilitado
      const privacyCheckbox = screen.getByRole("checkbox", { name: /Ocultar Valores/i });
      expect(privacyCheckbox).toBeDisabled();

      const calcCheckbox = screen.getByRole("checkbox", { name: /Calculadora/i });
      await user.click(calcCheckbox);
      expect(onToggle).toHaveBeenCalledWith("calculatorButton", "Calculadora", false);
    });

    it("renderiza a opção de Memória de Cálculo e Explicabilidade", async () => {
      renderWithProviders(
        <InterfaceShortcutsCard
          headerButtons={{
            logo: true,
            calculatorButton: false,
            themeToggle: false,
            privacyToggle: false,
          }}
          onToggleHeaderButton={vi.fn()}
        />,
      );

      expect(screen.getByText("Memória de Cálculo e Explicabilidade")).toBeInTheDocument();
      const calcMemorySwitch = screen.getByRole("switch", {
        name: "Memória de Cálculo e Explicabilidade",
      });
      expect(calcMemorySwitch).toBeInTheDocument();
      expect(calcMemorySwitch).toBeChecked();
    });

    it("renderiza a opção de Playbooks e Guias Metodológicos", async () => {
      renderWithProviders(
        <InterfaceShortcutsCard
          headerButtons={{
            logo: true,
            calculatorButton: false,
            themeToggle: false,
            privacyToggle: false,
          }}
          onToggleHeaderButton={vi.fn()}
        />,
      );

      expect(screen.getByText("Playbooks e Guias Metodológicos")).toBeInTheDocument();
      const playbooksSwitch = screen.getByRole("switch", {
        name: "Playbooks e Guias Metodológicos",
      });
      expect(playbooksSwitch).toBeInTheDocument();
      expect(playbooksSwitch).toBeChecked();
    });
  });
});
