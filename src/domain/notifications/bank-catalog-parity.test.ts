import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BANK_PACKAGE_MAP } from "./bank-patterns";
import { ALL_HOMOLOGATED_PACKAGES, HOMOLOGATED_BANKS } from "./preferences";

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
}

function extractJavaListenerPackages(javaSource: string): string[] {
  const blockMatch =
    /DEFAULT_MONITORED_PACKAGES\s*=\s*new HashSet<>\(Arrays\.asList\(([\s\S]*?)\)\);/.exec(
      javaSource,
    );
  expect(blockMatch).not.toBeNull();
  const block = blockMatch?.[1] ?? "";
  return Array.from(block.matchAll(/"([a-zA-Z0-9_.]+)"/g)).map((m) => m[1]!);
}

function extractPluginPackageEntries(
  javaSource: string,
): Array<{ pkg: string; bankName: string }> {
  return Array.from(
    javaSource.matchAll(
      /BANK_PACKAGES\.put\("([^"]+)",\s*new BankAppInfo\("([^"]+)",\s*"[^"]+"\)\);/g,
    ),
  ).map((m) => ({ pkg: m[1]!, bankName: m[2]! }));
}

function extractManifestQueryPackages(xmlSource: string): string[] {
  const queriesMatch = /<queries>([\s\S]*?)<\/queries>/.exec(xmlSource);
  expect(queriesMatch).not.toBeNull();
  const queriesBlock = queriesMatch?.[1] ?? "";
  return Array.from(
    queriesBlock.matchAll(/<package\s+android:name="([^"]+)"\s*\/>/g),
  ).map((m) => m[1]!);
}

describe("Bank Catalog Parity (TS <-> Java <-> AndroidManifest)", () => {
  it("mantém paridade exata 1-para-1 de pacotes entre TS, BankNotificationListenerService, BankNotificationPlugin e AndroidManifest", () => {
    const canonicalPackages = new Set(ALL_HOMOLOGATED_PACKAGES);
    const parserPackages = new Set(Object.keys(BANK_PACKAGE_MAP));

    const listenerJava = readRepoFile(
      "android/app/src/main/java/com/guiafinanceiro/app/BankNotificationListenerService.java",
    );
    const pluginJava = readRepoFile(
      "android/app/src/main/java/com/guiafinanceiro/app/BankNotificationPlugin.java",
    );
    const manifestXml = readRepoFile("android/app/src/main/AndroidManifest.xml");

    const listenerPackages = extractJavaListenerPackages(listenerJava);
    const pluginEntries = extractPluginPackageEntries(pluginJava);
    const pluginPackages = new Set(pluginEntries.map((e) => e.pkg));
    const manifestPackages = new Set(extractManifestQueryPackages(manifestXml));

    expect(listenerPackages).not.toContain("com.google.android.gms");
    expect(parserPackages).toEqual(canonicalPackages);
    expect(new Set(listenerPackages)).toEqual(canonicalPackages);
    expect(pluginPackages).toEqual(canonicalPackages);
    expect(manifestPackages).toEqual(canonicalPackages);
  });

  it("garante que todos os nomes de banco retornados pelo plugin Android existem em HOMOLOGATED_BANKS", () => {
    const pluginJava = readRepoFile(
      "android/app/src/main/java/com/guiafinanceiro/app/BankNotificationPlugin.java",
    );
    const pluginEntries = extractPluginPackageEntries(pluginJava);
    const validBankNames = new Set(HOMOLOGATED_BANKS);

    for (const entry of pluginEntries) {
      expect(validBankNames.has(entry.bankName)).toBe(true);
    }
  });
});
