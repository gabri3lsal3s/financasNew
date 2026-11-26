import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      collectSourceFiles(fullPath, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

describe("Regra 20 — Zero autoFocus declarativo em produção", () => {
  it("não utiliza prop JSX autoFocus em nenhum componente ou página", () => {
    const srcDir = join(process.cwd(), "src");
    const files = collectSourceFiles(srcDir);
    const offenders: string[] = [];

    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const withoutComments = raw
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      if (/\bautoFocus(?:\s*=|\s|>|\n)/.test(withoutComments)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("command.tsx protege .focus() com matchMedia (pointer: fine)", () => {
    const commandPath = join(process.cwd(), "src/components/ui/command.tsx");
    const content = readFileSync(commandPath, "utf8");
    expect(content).toContain("(pointer: fine)");
  });
});
