import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";
import { Modal, ModalFooter } from "./modal";

describe("Modal", () => {
  it("exibe título, descrição e conteúdo quando aberto", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Nova despesa" description="Preencha os dados">
        <p>Formulário</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Nova despesa")).toBeInTheDocument();
    expect(screen.getByText("Formulário")).toBeInTheDocument();
  });

  it("não renderiza o botão de calculadora por padrão", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    expect(screen.queryByRole("button", { name: "Abrir calculadora" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("renderiza o botão de calculadora ao lado do botão de fechar quando showCalculator=true", async () => {
    const user = userEvent.setup();
    render(
      <Modal open onOpenChange={vi.fn()} title="Nova despesa" showCalculator>
        <p>Formulário</p>
      </Modal>,
    );
    const calcButton = screen.getByRole("button", { name: "Abrir calculadora" });
    expect(calcButton).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();

    await user.click(calcButton);
  });

  it("oculta o botão de calculadora quando elevated=true, mesmo com showCalculator=true", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Calculadora" elevated showCalculator>
        <p>Conteúdo</p>
      </Modal>,
    );
    expect(screen.queryByRole("button", { name: "Abrir calculadora" })).not.toBeInTheDocument();
  });

  it("F25: exibe a alça do bottom sheet no mobile (md:hidden)", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    // Base mobile + override md: o conteúdo é ancorado na base da tela (bottom-0) com slide-up.
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("animate-sheet-in");
    expect(dialog.className).toContain("md:data-[state=open]:animate-dialog-in");
    expect(dialog.className).toContain("md:data-[state=closed]:animate-dialog-out");
    expect(dialog.className).toContain("border-primary/25");
    // Alça visível apenas no mobile.
    const handle = dialog.querySelector("[aria-hidden='true']");
    expect(handle).not.toBeNull();
    expect(handle?.className).toContain("md:hidden");
  });

  it("F25: arrastar para baixo na alça além do threshold fecha o modal (drag-to-close)", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const handle = screen.getByTestId("modal-sheet-handle");

    fireEvent.pointerDown(handle, {
      pointerId: 1,
      pointerType: "touch",
      clientY: 100,
      clientX: 50,
      isPrimary: true,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, pointerType: "touch", clientY: 240, clientX: 50 });
    fireEvent.pointerUp(handle, { pointerId: 1, pointerType: "touch", clientY: 240, clientX: 50 });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("F25: arrasto curto na alça (abaixo do threshold) não fecha o modal", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const handle = screen.getByTestId("modal-sheet-handle");

    fireEvent.pointerDown(handle, {
      pointerId: 1,
      pointerType: "touch",
      clientY: 100,
      clientX: 50,
      isPrimary: true,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, pointerType: "touch", clientY: 130, clientX: 50 });
    fireEvent.pointerUp(handle, { pointerId: 1, pointerType: "touch", clientY: 130, clientX: 50 });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("F25: toque com mouse (desktop) na alça não inicia o drag-to-close", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Nova despesa">
        <p>Formulário</p>
      </Modal>,
    );
    const handle = screen.getByTestId("modal-sheet-handle");

    fireEvent.pointerDown(handle, {
      pointerId: 1,
      pointerType: "mouse",
      clientY: 100,
      clientX: 50,
      button: 0,
      isPrimary: true,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, pointerType: "mouse", clientY: 300, clientX: 50 });
    fireEvent.pointerUp(handle, { pointerId: 1, pointerType: "mouse", clientY: 300, clientX: 50 });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("arrastar ou puxar dentro do corpo do modal (conteúdo) não ativa drag-to-close nem move o modal", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Nova despesa">
        <p>Formulário com elementos internos</p>
      </Modal>,
    );
    const content = screen.getByText("Formulário com elementos internos");
    const dialog = screen.getByRole("dialog");

    fireEvent.pointerDown(content, {
      pointerId: 1,
      pointerType: "touch",
      clientY: 100,
      clientX: 50,
      isPrimary: true,
    });
    fireEvent.pointerMove(content, { pointerId: 1, pointerType: "touch", clientY: 260, clientX: 50 });
    fireEvent.pointerUp(content, { pointerId: 1, pointerType: "touch", clientY: 260, clientX: 50 });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("");
  });
  it("adota ancoragem na base com safe areas inferiores e centralização com margens adequadas no desktop", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Responsivo">
        <p>Conteúdo</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("border-primary/25");
    expect(dialog.className).toContain("md:max-h-[calc(100dvh-3rem)]");
    expect(dialog.className).toContain("md:left-1/2");
    expect(dialog.className).toContain("md:top-1/2");
    expect(dialog.className).toContain("md:-translate-x-1/2");
    expect(dialog.className).toContain("md:-translate-y-1/2");
  });
});

describe("ConfirmDialog", () => {
  it("chama onConfirm ao confirmar", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Excluir transação?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("notifica fechamento ao cancelar", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="Excluir?" onConfirm={vi.fn()} />);

    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ModalFooter e Slot de Footer", () => {
  it("renderiza o rodapé responsivo com layout horizontal compacto em pares de botões (grid-cols-2) no mobile e alinhado à direita no desktop", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Teste">
        <ModalFooter>
          <button type="button">Cancelar</button>
          <button type="button">Salvar</button>
        </ModalFooter>
      </Modal>,
    );
    const footer = screen.getByText("Salvar").parentElement;
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass("grid-cols-2", "sm:flex", "sm:flex-row", "sm:justify-end", "border-border/80", "w-full");
    expect(footer?.className).toContain("[&>button]:w-full");
    expect(footer?.className).toContain("[&>button]:sm:min-w-[110px]");
  });

  it("renderiza layout empilhado seguro (flex-col-reverse) quando houver 3 ou mais botões no rodapé", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Teste 3 botões">
        <ModalFooter>
          <button type="button">Excluir</button>
          <button type="button">Cancelar</button>
          <button type="button">Salvar</button>
        </ModalFooter>
      </Modal>,
    );
    const footer = screen.getByText("Salvar").parentElement;
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass("flex-col-reverse", "sm:flex-row", "sm:justify-end", "border-border/80", "w-full");
  });

  it("renderiza destructiveAction isolada à esquerda no desktop e abaixo no mobile com par de botões simétricos", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Teste Destructive">
        <ModalFooter
          destructiveAction={<button type="button">Excluir Item</button>}
        >
          <button type="button">Cancelar</button>
          <button type="button">Confirmar</button>
        </ModalFooter>
      </Modal>,
    );
    const deleteBtn = screen.getByText("Excluir Item");
    const confirmBtn = screen.getByText("Confirmar");
    expect(deleteBtn).toBeInTheDocument();
    expect(confirmBtn).toBeInTheDocument();

    const deleteContainer = deleteBtn.parentElement;
    expect(deleteContainer).toHaveClass("order-last", "sm:order-first");

    const pairContainer = confirmBtn.parentElement;
    expect(pairContainer).toHaveClass("grid-cols-2", "sm:flex");
  });

  it("renderiza o slot footer canônico no Modal fora do corpo rolável com safe area compacta", () => {
    render(
      <Modal
        open
        onOpenChange={vi.fn()}
        title="Teste com Pinned Footer"
        footer={<button type="button">Ação Fixa</button>}
      >
        <p>Conteúdo do corpo</p>
      </Modal>,
    );
    const actionBtn = screen.getByRole("button", { name: "Ação Fixa" });
    expect(actionBtn).toBeInTheDocument();
    const footerSlot = actionBtn.parentElement;
    expect(footerSlot?.className).toContain("shrink-0");
    expect(footerSlot?.className).toContain("border-t");
    expect(footerSlot?.className).toContain("pb-[max(0.5rem,calc(max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px))+0.25rem))]");
  });
});

describe("Plano 08: Micro-título reativo e rolagem fluida", () => {
  it("exibe micro-título reativo no topo ao rolar além do threshold (32px)", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Gerenciar Racha" description="Descrição longa">
        <div style={{ height: "1000px" }}>Conteúdo longo</div>
      </Modal>,
    );

    // Inicialmente o micro-título não está montado no topo
    expect(screen.getByRole("heading", { name: "Gerenciar Racha" })).toBeInTheDocument();

    const scrollContainer = screen.getByText("Conteúdo longo").parentElement;
    expect(scrollContainer).toBeInTheDocument();

    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 50 } });
      // Agora o micro-título reativo no topo deve estar presente com aria-hidden
      const microTitles = screen.getAllByText("Gerenciar Racha");
      expect(microTitles.length).toBe(2);
      expect(microTitles[0]).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("renderiza título como sr-only e barra de topo dedicada apenas com ações quando hideTitle=true", () => {
    render(
      <Modal
        open
        onOpenChange={vi.fn()}
        title="Relatório Executivo"
        hideTitle
        headerActions={<button type="button">Ação</button>}
      >
        <p>Conteúdo do relatório</p>
      </Modal>,
    );

    const heading = screen.getByRole("heading", { name: "Relatório Executivo" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "Ação" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("aplica classe adaptativa de padding-right no desktop de acordo com headerActions e wideHeaderActions", () => {
    const { rerender } = render(
      <Modal open onOpenChange={vi.fn()} title="Título Normal">
        <p>Conteúdo</p>
      </Modal>,
    );
    let titleContainer = screen.getByRole("heading", { name: "Título Normal" }).parentElement;
    expect(titleContainer).toHaveClass("md:pr-16");

    rerender(
      <Modal open onOpenChange={vi.fn()} title="Título Normal" showCalculator>
        <p>Conteúdo</p>
      </Modal>,
    );
    titleContainer = screen.getByRole("heading", { name: "Título Normal" }).parentElement;
    expect(titleContainer).toHaveClass("md:pr-24");

    rerender(
      <Modal
        open
        onOpenChange={vi.fn()}
        title="Título Compacto"
        headerActions={<span>Badge</span>}
      >
        <p>Conteúdo</p>
      </Modal>,
    );
    titleContainer = screen.getByRole("heading", { name: "Título Compacto" }).parentElement;
    expect(titleContainer).toHaveClass("md:pr-40");

    rerender(
      <Modal
        open
        onOpenChange={vi.fn()}
        title="Título Largo"
        wideHeaderActions
        headerActions={<span>Vários botões</span>}
      >
        <p>Conteúdo</p>
      </Modal>,
    );
    titleContainer = screen.getByRole("heading", { name: "Título Largo" }).parentElement;
    expect(titleContainer).toHaveClass("md:pr-[360px]");
  });

  it("mantém o cabeçalho transparente no estado inicial e aplica fundo translúcido borda-a-borda apenas ao rolar", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Operação em Investimentos">
        <div style={{ height: "1000px" }}>Conteúdo longo</div>
      </Modal>,
    );

    const heading = screen.getByRole("heading", { name: "Operação em Investimentos" });
    const headerContainer = heading.parentElement;
    expect(headerContainer).toHaveClass("bg-transparent", "md:-mx-6", "md:pl-6");
    expect(headerContainer?.className).not.toContain("md:bg-surface ");
    expect(headerContainer?.className).not.toContain("md:bg-surface/95");

    const scrollContainer = screen.getByText("Conteúdo longo").parentElement;
    const mobileTopBar = scrollContainer?.previousElementSibling;
    expect(mobileTopBar).toHaveClass("bg-transparent");
    expect(mobileTopBar?.className).not.toMatch(/\bbg-surface\b/);

    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 50 } });
      expect(headerContainer).toHaveClass("md:bg-surface/95", "md:border-border/80");
      expect(mobileTopBar).toHaveClass("bg-transparent", "border-border/80");
      expect(mobileTopBar?.className).not.toMatch(/\bbg-surface/);
    }
  });

  it("mantém barra superior estilizada em hideTitle=true com alívio adaptativo de borda", () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Relatório" hideTitle>
        <div style={{ height: "1000px" }}>Folha A4</div>
      </Modal>,
    );

    const scrollContainer = screen.getByText("Folha A4").parentElement;
    const hideTitleBar = scrollContainer?.previousElementSibling;
    expect(hideTitleBar).toHaveClass("bg-surface");

    if (scrollContainer) {
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 12 } });
      expect(hideTitleBar).toHaveClass("bg-surface", "border-border/80");
    }
  });

  it("suprime margem e borda superior duplicadas de ModalFooter filho dentro do slot footer", () => {
    render(
      <Modal
        open
        onOpenChange={vi.fn()}
        title="Com ModalFooter"
        footer={
          <ModalFooter>
            <button type="button">Cancelar</button>
            <button type="button">Salvar</button>
          </ModalFooter>
        }
      >
        <p>Corpo</p>
      </Modal>,
    );

    const footerEl = screen.getByText("Salvar").parentElement;
    const slotWrapper = footerEl?.parentElement;
    expect(slotWrapper?.className).toContain("[&>*]:mt-0");
    expect(slotWrapper?.className).toContain("[&>*]:pt-0");
    expect(slotWrapper?.className).toContain("[&>*]:border-t-0");
  });

  it("suprime rubber-band visual quando motionLevel !== fluid mas preserva drag-to-close na alça", async () => {
    const { updateVisualCustomization } = await import("@/hooks/use-visual-customization");
    updateVisualCustomization({ motionLevel: "eco" });

    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Eco Motion">
        <p>Conteúdo</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    const handle = screen.getByTestId("modal-sheet-handle");
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      pointerType: "touch",
      clientY: 100,
      clientX: 50,
      isPrimary: true,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, pointerType: "touch", clientY: 160, clientX: 50 });
    expect(dialog.style.transform).toBe("");

    fireEvent.pointerMove(handle, { pointerId: 1, pointerType: "touch", clientY: 250, clientX: 50 });
    fireEvent.pointerUp(handle, { pointerId: 1, pointerType: "touch", clientY: 250, clientX: 50 });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    updateVisualCustomization({ motionLevel: "fluid" });
  });

  describe("Guarda de descarte (confirmDiscard & isDirty)", () => {
    it("intercepta tentativa de fechamento quando isDirty=true e exibe confirm de descarte", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Modal
          open
          onOpenChange={onOpenChange}
          title="Formulário"
          confirmDiscard
          isDirty
        >
          <p>Conteúdo com rascunho</p>
        </Modal>,
      );

      // Clica no botão X para fechar
      const closeBtn = screen.getByRole("button", { name: "Fechar" });
      await user.click(closeBtn);

      // Não fecha diretamente
      expect(onOpenChange).not.toHaveBeenCalled();

      // Exibe diálogo de confirmação de descarte
      expect(screen.getByText("Descartar alterações?")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Você possui alterações não salvas. Se sair agora, todas as informações modificadas serão descartadas.",
        ),
      ).toBeInTheDocument();
    });

    it("chama onDiscard e fecha quando o usuário confirma o descarte", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onDiscard = vi.fn();
      render(
        <Modal
          open
          onOpenChange={onOpenChange}
          title="Formulário"
          confirmDiscard
          isDirty
          onDiscard={onDiscard}
        >
          <p>Conteúdo</p>
        </Modal>,
      );

      const closeBtn = screen.getByRole("button", { name: "Fechar" });
      await user.click(closeBtn);

      const confirmBtn = screen.getByRole("button", { name: "Descartar" });
      await user.click(confirmBtn);

      expect(onDiscard).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("mantém o modal aberto quando o usuário escolhe continuar editando", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Modal
          open
          onOpenChange={onOpenChange}
          title="Formulário"
          confirmDiscard
          isDirty
        >
          <p>Conteúdo</p>
        </Modal>,
      );

      const closeBtn = screen.getByRole("button", { name: "Fechar" });
      await user.click(closeBtn);

      const cancelBtn = screen.getByRole("button", { name: "Continuar editando" });
      await user.click(cancelBtn);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByText("Descartar alterações?")).not.toBeInTheDocument();
    });

    it("fecha diretamente sem confirmação quando isDirty=false", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Modal
          open
          onOpenChange={onOpenChange}
          title="Formulário"
          confirmDiscard
          isDirty={false}
        >
          <p>Conteúdo</p>
        </Modal>,
      );

      const closeBtn = screen.getByRole("button", { name: "Fechar" });
      await user.click(closeBtn);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByText("Descartar alterações?")).not.toBeInTheDocument();
    });
  });

  describe("Ergonomia tátil, rolagem interna e física suave do Bottom Sheet mobile", () => {
    it("inclui classes de animação de entrada e saída mobile e suporte a touch-pan-y no corpo rolável", () => {
      render(
        <Modal open onOpenChange={vi.fn()} title="Visualização de Detalhes">
          <p>Conteúdo extenso para rolagem</p>
        </Modal>,
      );
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("data-[state=open]:animate-sheet-in");
      expect(dialog.className).toContain("data-[state=closed]:animate-sheet-out");

      const scrollBody = screen.getByText("Conteúdo extenso para rolagem").parentElement;
      expect(scrollBody?.className).toContain("touch-pan-y");
      expect(scrollBody?.className).toContain("overflow-y-auto");
    });

    it("aplica efeito de mola (spring-back) com transição suave ao soltar a alça abaixo do threshold", () => {
      render(
        <Modal open onOpenChange={vi.fn()} title="Visualização de Detalhes">
          <p>Conteúdo</p>
        </Modal>,
      );
      const dialog = screen.getByRole("dialog");
      const handle = screen.getByTestId("modal-sheet-handle");

      fireEvent.pointerDown(handle, {
        pointerId: 1,
        pointerType: "touch",
        clientY: 100,
        clientX: 50,
        isPrimary: true,
      });
      // Arrastar 40px para baixo (abaixo de 72px)
      fireEvent.pointerMove(handle, { pointerId: 1, pointerType: "touch", clientY: 140, clientX: 50 });
      expect(dialog.style.transform).toBe("translateY(40px)");
      expect(dialog.style.transition).toBe("none");

      // Ao soltar, deve animar de volta para 0px com cubic-bezier
      fireEvent.pointerUp(handle, { pointerId: 1, pointerType: "touch", clientY: 140, clientX: 50 });
      expect(dialog.style.transform).toBe("translateY(0px)");
      expect(dialog.style.transition).toContain("cubic-bezier");
    });

    it("aplica animações reais de entrada/saída no overlay sem classes fantasma", () => {
      render(
        <Modal open onOpenChange={vi.fn()} title="Visualização de Detalhes">
          <p>Conteúdo</p>
        </Modal>,
      );
      const dialog = screen.getByRole("dialog");
      const overlay = dialog.previousElementSibling as HTMLElement | null;
      expect(overlay).not.toBeNull();
      expect(overlay?.className).toContain("data-[state=open]:animate-overlay-in");
      expect(overlay?.className).toContain("data-[state=closed]:animate-overlay-out");
      expect(overlay?.className).not.toContain("animate-in");
      expect(overlay?.className).not.toContain("animate-out");
      expect(dialog.className).not.toContain("animate-in");
      expect(dialog.className).not.toContain("animate-out");
    });

    it("mantém a posição de arrasto em --sheet-drag-y para continuidade da animação ao fechar", () => {
      const onOpenChange = vi.fn();
      render(
        <Modal open onOpenChange={onOpenChange} title="Visualização de Detalhes">
          <p>Conteúdo</p>
        </Modal>,
      );
      const dialog = screen.getByRole("dialog");
      const handle = screen.getByTestId("modal-sheet-handle");

      fireEvent.pointerDown(handle, {
        pointerId: 1,
        pointerType: "touch",
        clientY: 100,
        clientX: 50,
        isPrimary: true,
      });
      // Arrastar 80px para baixo (acima do threshold de 72px)
      fireEvent.pointerMove(handle, { pointerId: 1, pointerType: "touch", clientY: 180, clientX: 50 });
      expect(dialog.style.getPropertyValue("--sheet-drag-y")).toBe("80px");

      fireEvent.pointerUp(handle, { pointerId: 1, pointerType: "touch", clientY: 180, clientX: 50 });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      // Mantém --sheet-drag-y para que @keyframes sheet-out comece exatamente na posição atual
      expect(dialog.style.getPropertyValue("--sheet-drag-y")).toBe("80px");
    });

    it("preserva --sheet-drag-y durante o fechamento (open=false) e só reseta para 0px ao reabrir", () => {
      const originalGetComputedStyle = window.getComputedStyle.bind(window);
      const getComputedStyleSpy = vi
        .spyOn(window, "getComputedStyle")
        .mockImplementation((elt: Element, pseudoElt?: string | null) => {
          const base = originalGetComputedStyle(elt, pseudoElt);
          if (elt.getAttribute("role") === "dialog") {
            return new Proxy(base, {
              get(target, prop) {
                if (prop === "animationName") {
                  return elt.getAttribute("data-state") === "closed" ? "sheet-out" : "sheet-in";
                }
                if (prop === "display") return "flex";
                const value = Reflect.get(target, prop);
                return typeof value === "function" ? value.bind(target) : value;
              },
            });
          }
          return base;
        });

      try {
        const onOpenChange = vi.fn();
        const { rerender } = render(
          <Modal open={true} onOpenChange={onOpenChange} title="Visualização de Detalhes">
            <p>Conteúdo</p>
          </Modal>,
        );
        const dialog = screen.getByRole("dialog");
        const handle = screen.getByTestId("modal-sheet-handle");

        fireEvent.pointerDown(handle, {
          pointerId: 1,
          pointerType: "touch",
          clientY: 100,
          clientX: 50,
          isPrimary: true,
        });
        fireEvent.pointerMove(handle, {
          pointerId: 1,
          pointerType: "touch",
          clientY: 190,
          clientX: 50,
        });
        fireEvent.pointerUp(handle, {
          pointerId: 1,
          pointerType: "touch",
          clientY: 190,
          clientX: 50,
        });

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(dialog.style.getPropertyValue("--sheet-drag-y")).toBe("90px");

        // Pai re-renderiza com open=false: o modal em unmountSuspended deve permanecer no DOM e preservar 90px
        rerender(
          <Modal open={false} onOpenChange={onOpenChange} title="Visualização de Detalhes">
            <p>Conteúdo</p>
          </Modal>,
        );
        expect(dialog.isConnected).toBe(true);
        expect(dialog.getAttribute("data-state")).toBe("closed");
        expect(dialog.style.getPropertyValue("--sheet-drag-y")).toBe("90px");

        // Ao reabrir com open=true, --sheet-drag-y volta para 0px
        rerender(
          <Modal open={true} onOpenChange={onOpenChange} title="Visualização de Detalhes">
            <p>Conteúdo</p>
          </Modal>,
        );
        expect(dialog.isConnected).toBe(true);
        expect(dialog.getAttribute("data-state")).toBe("open");
        expect(dialog.style.getPropertyValue("--sheet-drag-y")).toBe("0px");
      } finally {
        getComputedStyleSpy.mockRestore();
      }
    });
  });
});



