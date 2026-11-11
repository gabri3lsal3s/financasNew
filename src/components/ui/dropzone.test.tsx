import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dropzone } from "./dropzone";

const makeFile = (name: string, size = 100, type = "text/plain") => {
  const file = new File(["conteúdo"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("Dropzone", () => {
  it("notifica os arquivos soltos via drag & drop", () => {
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} />);

    const zone = screen.getByRole("button");
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile("nota.txt")] } });

    expect(onFiles).toHaveBeenCalledTimes(1);
    const call = onFiles.mock.calls[0];
    if (!call) throw new Error("onFiles não foi chamado");
    const files = call[0] as File[];
    const [file] = files;
    expect(file?.name).toBe("nota.txt");
  });

  it("respeita o limite de múltiplos arquivos", () => {
    const onFiles = vi.fn();
    render(<Dropzone onFiles={onFiles} multiple={false} />);

    const zone = screen.getByRole("button");
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile("a.txt"), makeFile("b.txt")] } });

    const call = onFiles.mock.calls[0];
    if (!call) throw new Error("onFiles não foi chamado");
    expect(call[0] as File[]).toHaveLength(1);
  });

  it("filtra arquivos maiores que maxSizeBytes e notifica onFileRejected", () => {
    const onFiles = vi.fn();
    const onFileRejected = vi.fn();

    render(
      <Dropzone
        onFiles={onFiles}
        maxSizeBytes={500}
        onFileRejected={onFileRejected}
      />,
    );

    const zone = screen.getByRole("button");
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [makeFile("pequeno.txt", 200), makeFile("grande.txt", 1000)],
      },
    });

    expect(onFileRejected).toHaveBeenCalledWith(expect.objectContaining({ name: "grande.txt" }), "too-large");
    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "pequeno.txt" })]);
  });

  it("renderiza botões integrados e input de câmera quando enableCamera está ativo", () => {
    const onFiles = vi.fn();

    render(
      <Dropzone
        onFiles={onFiles}
        enableCamera={true}
        extraActions={<button type="button">Ação Extra</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Escolher arquivo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tirar foto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ação Extra" })).toBeInTheDocument();

    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(2); // Arquivo principal e Câmera
    expect(inputs[1]).toHaveAttribute("capture", "environment");
  });
});
