import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import * as sensoryModule from "@/services/sensory";

describe("Accordion (M9 — Progressive Disclosure WAI-ARIA)", () => {
  it("inicia recolhido por padrão e expande/recolhe ao clicar no gatilho", async () => {
    const user = userEvent.setup();
    const sensorySpy = vi.spyOn(sensoryModule, "triggerSensory");
    sensorySpy.mockClear();

    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger>Mais detalhes</AccordionTrigger>
          <AccordionContent>Notas e anexos fiscais</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole("button", { name: "Mais detalhes" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Notas e anexos fiscais")).not.toBeVisible();

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Notas e anexos fiscais")).toBeVisible();
    expect(sensorySpy).toHaveBeenCalledWith("selection");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Notas e anexos fiscais")).not.toBeVisible();
  });

  it("no modo single fecha o item anterior ao abrir outro", async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="single" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger>Item 1</AccordionTrigger>
          <AccordionContent>Conteúdo 1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Item 2</AccordionTrigger>
          <AccordionContent>Conteúdo 2</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByText("Conteúdo 1")).toBeVisible();
    expect(screen.getByText("Conteúdo 2")).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Item 2" }));
    expect(screen.getByText("Conteúdo 1")).not.toBeVisible();
    expect(screen.getByText("Conteúdo 2")).toBeVisible();
  });

  it("suporta modo multiple e controle externo", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Accordion type="multiple" value={["a"]} onValueChange={onValueChange}>
        <AccordionItem value="a">
          <AccordionTrigger>Seção A</AccordionTrigger>
          <AccordionContent>Corpo A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Seção B</AccordionTrigger>
          <AccordionContent>Corpo B</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(screen.getByText("Corpo A")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Seção B" }));
    expect(onValueChange).toHaveBeenCalledWith(["a", "b"]);
  });

  it("navega entre triggers via teclado (ArrowDown, ArrowUp, Home, End)", async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="single">
        <AccordionItem value="1">
          <AccordionTrigger>Primeiro</AccordionTrigger>
          <AccordionContent>C1</AccordionContent>
        </AccordionItem>
        <AccordionItem value="2">
          <AccordionTrigger>Segundo</AccordionTrigger>
          <AccordionContent>C2</AccordionContent>
        </AccordionItem>
        <AccordionItem value="3">
          <AccordionTrigger>Terceiro</AccordionTrigger>
          <AccordionContent>C3</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const first = screen.getByRole("button", { name: "Primeiro" });
    const second = screen.getByRole("button", { name: "Segundo" });
    const third = screen.getByRole("button", { name: "Terceiro" });

    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();

    await user.keyboard("{End}");
    expect(third).toHaveFocus();

    await user.keyboard("{Home}");
    expect(first).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(third).toHaveFocus();
  });

  it("não possui violações de acessibilidade (axe)", async () => {
    const { container } = render(
      <Accordion type="single" defaultValue="open-item">
        <AccordionItem value="open-item">
          <AccordionTrigger>Detalhes abertos</AccordionTrigger>
          <AccordionContent>Conteúdo acessível</AccordionContent>
        </AccordionItem>
        <AccordionItem value="closed-item">
          <AccordionTrigger>Detalhes fechados</AccordionTrigger>
          <AccordionContent>Conteúdo oculto</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
