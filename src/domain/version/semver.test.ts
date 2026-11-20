import { describe, expect, it } from "vitest";
import { compareSemVer, isNewerVersion } from "./semver";

describe("domain/version/semver — Comparação determinística de versões", () => {
  it("compara versões idênticas retornando 0", () => {
    expect(compareSemVer("3.13.0", "3.13.0")).toBe(0);
    expect(compareSemVer("v3.13.0", "3.13.0")).toBe(0);
    expect(compareSemVer("1.0.0-beta.1", "1.0.0")).toBe(0);
  });

  it("identifica versão candidata superior corretamente", () => {
    expect(compareSemVer("3.14.0", "3.13.0")).toBe(1);
    expect(compareSemVer("3.13.1", "3.13.0")).toBe(1);
    expect(compareSemVer("4.0.0", "3.99.99")).toBe(1);
    expect(isNewerVersion("3.13.1", "3.13.0")).toBe(true);
    expect(isNewerVersion("3.14.0", "3.13.0")).toBe(true);
  });

  it("identifica versão candidata inferior corretamente", () => {
    expect(compareSemVer("3.10.0", "3.13.0")).toBe(-1);
    expect(compareSemVer("3.12.9", "3.13.0")).toBe(-1);
    expect(compareSemVer("2.99.0", "3.0.0")).toBe(-1);
    expect(isNewerVersion("3.10.0", "3.13.0")).toBe(false);
  });

  it("lida graciosamente com formatos incompletos ou nulos", () => {
    expect(compareSemVer("3.13", "3.13.0")).toBe(0);
    expect(compareSemVer("", "1.0.0")).toBe(-1);
    expect(compareSemVer("1.0.0", "")).toBe(1);
    expect(compareSemVer("", "")).toBe(0);
  });
});
