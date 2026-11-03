import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApkInstallGuideDialog } from "./apk-install-guide-dialog";

describe("ApkInstallGuideDialog — Guia Visual Interativo de Instalação do APK & Fuga PWA", () => {
  it("renderiza todos os passos de instalação do APK quando aberto", () => {
    const handleOpenChange = vi.fn();
    render(<ApkInstallGuideDialog open={true} onOpenChange={handleOpenChange} />);

    expect(screen.getByRole("heading", { name: "Instalação do Aplicativo Android (Beta)" })).toBeInTheDocument();

    // Valida os 3 passos orientativos
    expect(screen.getByText("Aviso 'Arquivo pode ser nocivo'")).toBeInTheDocument();
    expect(screen.getByText("Permitir desta fonte")).toBeInTheDocument();
    expect(screen.getByText("Verificação e Conclusão")).toBeInTheDocument();

    // Botões de ação no footer
    expect(screen.getByRole("button", { name: /Baixar APK \(Beta\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prefiro usar no navegador \(PWA\)/i })).toBeInTheDocument();
  });

  it("dispara callback onDownloadApk e fecha o diálogo ao clicar em 'Baixar APK'", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleDownloadApk = vi.fn();

    render(
      <ApkInstallGuideDialog
        open={true}
        onOpenChange={handleOpenChange}
        onDownloadApk={handleDownloadApk}
      />
    );

    const downloadButton = screen.getByRole("button", { name: /Baixar APK \(Beta\)/i });
    await user.click(downloadButton);

    expect(handleDownloadApk).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("alterna para as orientações do PWA ao clicar em 'Prefiro usar no navegador (PWA)'", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleSelectPwa = vi.fn();

    render(
      <ApkInstallGuideDialog
        open={true}
        onOpenChange={handleOpenChange}
        onSelectPwa={handleSelectPwa}
      />
    );

    const pwaEscapeButton = screen.getByRole("button", { name: /Prefiro usar no navegador \(PWA\)/i });
    await user.click(pwaEscapeButton);

    expect(handleSelectPwa).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Usar no Navegador (PWA)" })).toBeInTheDocument();
    expect(screen.getByText("Experiência 100% Funcional no PWA")).toBeInTheDocument();
    expect(screen.getByText("Abra o menu do navegador")).toBeInTheDocument();

    // Botão de voltar ao APK
    const backButton = screen.getByRole("button", { name: "Voltar ao guia do APK" });
    await user.click(backButton);

    expect(screen.getByRole("heading", { name: "Instalação do Aplicativo Android (Beta)" })).toBeInTheDocument();
  });

  it("fecha o diálogo ao confirmar uso no navegador", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(<ApkInstallGuideDialog open={true} onOpenChange={handleOpenChange} />);

    await user.click(screen.getByRole("button", { name: /Prefiro usar no navegador \(PWA\)/i }));
    const dismissButton = screen.getByRole("button", { name: "Entendi, vou usar no navegador" });
    await user.click(dismissButton);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
