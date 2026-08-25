import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

describe("DatePicker", () => {
  it("exibe o placeholder quando não há valor", () => {
    render(<DatePicker value="" onValueChange={vi.fn()} placeholder="Data do lançamento" />);
    expect(screen.getByRole("button", { name: "Data do lançamento" })).toBeInTheDocument();
  });

  it("abre o calendário e notifica a seleção de um dia", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker value="" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Selecione a data" }));

    // MonthGrid renderiza um role="grid"; os dias são gridcells com um botão.
    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");

    await user.click(within(day15).getByRole("button"));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const call = onValueChange.mock.calls[0];
    if (!call) throw new Error("onValueChange não foi chamado");
    expect(call[0]).toMatch(/^\d{4}-\d{2}-15$/);
  });

  it("limpa o valor ao clicar no botão de limpar", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker value="2026-08-15" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Limpar data" }));
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("F25: header com setas Lucide nas extremidades e navegação de mês", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Selecione a data" }));

    // navLayout="around": botões de navegação acessíveis com ícones Lucide.
    const previous = await screen.findByRole("button", { name: /mês anterior/i });
    const next = screen.getByRole("button", { name: /próximo mês/i });
    expect(previous).toBeInTheDocument();
    expect(next).toBeInTheDocument();
    // O caption (Mês/Ano) muda ao navegar (header centralizado funcional).
    const captionBefore = screen.getByRole("button", { name: "Selecionar mês e ano" }).textContent ?? "";
    await user.click(next);
    const captionAfter = screen.getByRole("button", { name: "Selecionar mês e ano" }).textContent ?? "";
    expect(captionAfter).not.toBe(captionBefore);
  });

  it("hotfix: header compacto no topo (seta esquerda · mês centralizado · seta direita)", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Selecione a data" }));

    const previous = await screen.findByRole("button", { name: /mês anterior/i });
    const next = screen.getByRole("button", { name: /próximo mês/i });

    // `.month` é uma coluna relativa: header no topo e grade abaixo, sem
    // overflow horizontal (as setas não são mais itens de linha do grid).
    const month = previous.parentElement;
    if (!month) throw new Error("Mês (contêiner do calendário) não encontrado");
    expect(month).toHaveClass("relative", "flex", "flex-col");
    // Seta esquerda na extremidade esquerda e seta direita na extremidade
    // direita da linha do header (posicionamento absoluto no topo).
    expect(previous).toHaveClass("absolute", "left-1", "top-1");
    expect(next).toHaveClass("absolute", "right-1", "top-1");
    // Mês/Ano centralizados entre as setas (caption com flex centrado).
    const captionContainer = screen.getByRole("button", { name: "Selecionar mês e ano" }).closest(".rdp-month_caption");
    if (!captionContainer) throw new Error("Caption do mês não encontrado");
    expect(captionContainer).toHaveClass("flex", "items-center", "justify-center", "px-12");
  });

  it("F75: alterna para a grade de 12 meses ao clicar no caption do cabeçalho", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-08-15" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "15/08/2026" }));

    // Clica no botão do caption para abrir a grade de meses
    const captionButton = await screen.findByRole("button", { name: "Selecionar mês e ano" });
    await user.click(captionButton);

    // Deve exibir os 12 meses em pt-BR
    expect(screen.getByRole("button", { name: "Janeiro de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agosto de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dezembro de 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar aos dias" })).toBeInTheDocument();

    // Clica em Outubro de 2026
    await user.click(screen.getByRole("button", { name: "Outubro de 2026" }));

    // Volta para o modo dias exibindo Outubro
    const newCaption = await screen.findByRole("button", { name: "Selecionar mês e ano" });
    expect(newCaption.textContent?.toLowerCase()).toContain("outubro");
  });

  it("F75: navega para a grade de anos e seleciona ano e mês diretamente", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker value="2026-08-15" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "15/08/2026" }));

    // Abre modo meses
    await user.click(await screen.findByRole("button", { name: "Selecionar mês e ano" }));

    // Clica no ano no cabeçalho da grade de meses para abrir modo anos
    const yearButton = screen.getByRole("button", { name: /Mudar bloco de anos/i });
    await user.click(yearButton);

    // Deve exibir bloco de 12 anos
    expect(screen.getByRole("button", { name: "Ano 2028" })).toBeInTheDocument();

    // Clica no ano 2028
    await user.click(screen.getByRole("button", { name: "Ano 2028" }));

    // Agora está no modo meses do ano 2028; escolhe Março
    await user.click(screen.getByRole("button", { name: "Março de 2028" }));

    // Agora está no modo dias de Março de 2028; seleciona o dia 20
    const calendar = await screen.findByRole("grid");
    const day20 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "20");
    if (!day20) throw new Error("Dia 20 não encontrado");
    await user.click(within(day20).getByRole("button"));

    expect(onValueChange).toHaveBeenCalledWith("2028-03-20");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("F75: botão 'Voltar aos dias' retorna do modo meses sem alterar a data", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-08-15" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "15/08/2026" }));

    await user.click(await screen.findByRole("button", { name: "Selecionar mês e ano" }));
    expect(screen.getByRole("button", { name: "Janeiro de 2026" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Voltar aos dias" }));
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("hotfix: grade de dias 100% responsiva (7 colunas sem overflow)", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Selecione a data" }));

    const calendar = await screen.findByRole("grid");
    // table-fixed + w-full: as 7 colunas (Dom a Sáb) dividem a largura
    // disponível igualmente — nunca estouram o viewport no mobile.
    expect(calendar).toHaveClass("table-fixed", "w-full");
    // Células de dia quadradas e flexíveis (aspect-square, até 36px).
    const dayButtons = within(calendar).getAllByRole("button");
    expect(dayButtons.length).toBeGreaterThan(0);
    for (const day of dayButtons.slice(0, 3)) {
      expect(day).toHaveClass("aspect-square", "w-full", "max-w-9");
    }
    // 7 dias por semana: todos os dias do grid estão na mesma linha de colunas.
    // (o thead de dias da semana é aria-hidden, então a primeira `row` exposta
    // já é a primeira semana do mês).
    const firstWeek = within(calendar).getAllByRole("row")[0];
    if (!firstWeek) throw new Error("Primeira semana não encontrada");
    expect(within(firstWeek).getAllByRole("gridcell")).toHaveLength(7);
  });

  it("hotfix: popover com largura responsiva e limite de altura em modais", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Selecione a data" }));

    const popover = await screen.findByRole("dialog");
    expect(popover).toHaveClass("w-[calc(100vw-1.5rem)]", "max-w-sm", "max-h-[85dvh]", "overflow-y-auto");
  });

  it("hotfix: dia selecionado com estado acessível (data-selected) e foco visível", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="2026-08-15" onValueChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "15/08/2026" }));

    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");
    const button = within(day15).getByRole("button");
    // Estado de seleção via atributo de dados na célula (fonte para o CSS).
    expect(day15).toHaveAttribute("data-selected", "true");
    // O botão do dia selecionado recebe o gradiente primário de alto contraste.
    expect(button).toHaveClass("bg-gradient-to-b", "from-primary", "text-primary-foreground");
    // Foco visível padronizado no dia (teclado/touch).
    expect(button).toHaveClass("focus-visible:ring-2", "focus-visible:ring-ring");
  });

  it("fecha o popover automaticamente após selecionar um dia", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker value="" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Selecione a data" }));
    const calendar = await screen.findByRole("grid");
    const day10 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "10");
    if (!day10) throw new Error("Dia 10 não encontrado no calendário");

    await user.click(within(day10).getByRole("button"));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("seleciona Hoje e fecha o popover ao clicar no atalho", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker value="" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Selecione a data" }));
    const todayButton = await screen.findByRole("button", { name: "Hoje" });
    await user.click(todayButton);

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("seleciona Ontem e fecha o popover ao clicar no atalho", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<DatePicker value="" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("button", { name: "Selecione a data" }));
    const yesterdayButton = await screen.findByRole("button", { name: "Ontem" });
    await user.click(yesterdayButton);

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

