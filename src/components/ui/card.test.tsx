import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

describe("Card (M2 — superfície calma sem hover falso)", () => {
  it("variante default não aplica sombra/borda de hover", () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
          <CardDescription>Detalhes</CardDescription>
        </CardHeader>
        <CardContent>Corpo</CardContent>
        <CardFooter>Rodapé</CardFooter>
      </Card>,
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass("border-border/80", "bg-surface", "shadow-xs");
    expect(card.className).not.toContain("hover:shadow-sm");
    expect(card.className).not.toContain("hover:border-border");

    expect(screen.getByText("Resumo").parentElement).toHaveClass("p-4", "sm:p-5");
    expect(screen.getByText("Corpo")).toHaveClass("p-4", "pt-0", "sm:p-5", "sm:pt-0");
  });
});
