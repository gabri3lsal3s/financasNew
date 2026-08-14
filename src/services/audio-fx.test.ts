import { describe, expect, it } from "vitest";
import { playSound } from "./audio-fx";

describe("audio-fx (F11)", () => {
  it("não falha quando o áudio está desativado", () => {
    expect(() => playSound("click", false)).not.toThrow();
  });

  it("aceita os diferentes tipos de efeito sonoro sem lançar erro", () => {
    expect(() => playSound("click", true)).not.toThrow();
    expect(() => playSound("pop", true)).not.toThrow();
    expect(() => playSound("success", true)).not.toThrow();
    expect(() => playSound("delete", true)).not.toThrow();
  });
});
