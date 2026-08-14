import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dropzone } from "./dropzone";

const makeFile = (name: string, type = "text/plain") => new File(["conteúdo"], name, { type });

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
});
