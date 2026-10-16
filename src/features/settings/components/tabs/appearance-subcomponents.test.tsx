import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExperiencePresetsCard } from "./experience-presets-card";
import { VisualIdentityCard } from "./visual-identity-card";
import { InterfaceShortcutsCard } from "./interface-shortcuts-card";
import { ResetDefaultsCard } from "./reset-defaults-card";

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
    it("permite selecionar tema e cor de destaque", async () => {
      const user = userEvent.setup();
      const onSelectTheme = vi.fn();
      const onSelectAccent = vi.fn();

      render(
        <VisualIdentityCard
          themePref="dark"
          onSelectTheme={onSelectTheme}
          accent="teal"
          onSelectAccent={onSelectAccent}
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
    });
  });

  describe("InterfaceShortcutsCard", () => {
    it("permite alternar logotipo e respeita limite de 2 atalhos de ação", async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();

      render(
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

      const logoCheckbox = screen.getByRole("checkbox", { name: "Logotipo Oficial" });
      await user.click(logoCheckbox);
      expect(onToggle).toHaveBeenCalledWith("logo", "Logo no Header", false);

      // Com calculadora e tema ativados (2 slots), o atalho de privacidade deve estar desabilitado
      const privacyCheckbox = screen.getByRole("checkbox", { name: /Ocultar Valores/i });
      expect(privacyCheckbox).toBeDisabled();
    });
  });

  describe("ResetDefaultsCard", () => {
    it("dispara callback ao clicar em Redefinir", async () => {
      const user = userEvent.setup();
      const onReset = vi.fn();

      render(<ResetDefaultsCard onReset={onReset} />);

      const resetBtn = screen.getByRole("button", { name: /Redefinir/i });
      await user.click(resetBtn);

      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });
});
