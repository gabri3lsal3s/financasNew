import { chromium } from "playwright";
import { createServer } from "vite";
import path from "path";

const ARTIFACT_DIR = "/home/gabrielsales/.gemini/antigravity/brain/f22669ab-08b2-4958-952b-27aaa5d38af0";

const REPORTS = [
  {
    id: "dre",
    name: "RELATORIO_EXEMPLO_1_DRE_PESSOAL",
    previewName: "preview_1_dre_pessoal",
    title: "Relatório Executivo de Finanças Pessoais & DRE",
  },
  {
    id: "balanco",
    name: "RELATORIO_EXEMPLO_2_BALANCO_PATRIMONIAL_360",
    previewName: "preview_2_balanco_patrimonial_360",
    title: "Balanço Patrimonial 360° One-Pager Consolidado",
  },
  {
    id: "irpf",
    name: "RELATORIO_EXEMPLO_3_FACILITADOR_IRPF",
    previewName: "preview_3_facilitador_irpf",
    title: "Facilitador de Declaração de IRPF (Bens, Direitos & Rendimentos)",
  },
  {
    id: "fire",
    name: "RELATORIO_EXEMPLO_4_DOSSIE_FIRE",
    previewName: "preview_4_dossie_fire",
    title: "Dossiê FIRE & Liberdade Financeira",
  },
  {
    id: "fatura",
    name: "RELATORIO_EXEMPLO_5_FATURA_CARTAO",
    previewName: "preview_5_fatura_cartao",
    title: "Extrato e Fatura Detalhada de Cartão de Crédito",
  },
  {
    id: "dossie_posicao",
    name: "RELATORIO_EXEMPLO_6_DOSSIE_POSICAO_VIGENTE",
    previewName: "preview_6_dossie_posicao_vigente",
    title: "Dossiê Executivo da Posição Vigente Consolidada (Wealth Tear Sheet)",
  },
  {
    id: "carteira_mensal",
    name: "RELATORIO_EXEMPLO_7_CARTEIRA_MENSAL",
    previewName: "preview_7_carteira_mensal",
    title: "Relatório Executivo Mensal de Acompanhamento da Carteira",
  },
  {
    id: "extrato_snapshots",
    name: "RELATORIO_EXEMPLO_8_EXTRATO_SNAPSHOTS",
    previewName: "preview_8_extrato_snapshots",
    title: "Extrato Analítico de Snapshots Patrimoniais & Ledger Histórico",
  },
];

async function main() {
  console.log("Iniciando servidor Vite para renderização de relatórios...");
  const vite = await createServer({
    server: { port: 5188 },
  });
  await vite.listen();
  console.log("Vite rodando na porta 5188.");

  console.log("Iniciando Chromium em modo headless...");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 1800 },
    deviceScaleFactor: 2, // Retina 2x para previews cristalinos
  });

  for (const report of REPORTS) {
    console.log(`Gerando: ${report.title} (${report.id})...`);
    const page = await context.newPage();
    page.on("console", (msg) => {
      const text = msg.text();
      if (!text.includes("Download the React DevTools") && !text.includes("[vite]")) {
        console.log("PAGE LOG:", text);
      }
    });
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

    const url = `http://localhost:5188/sample-reports.html?report=${report.id}`;
    await page.goto(url, { waitUntil: "networkidle" });

    // Aguardar montagem do DOM
    await page.waitForSelector(".print-document", { timeout: 15000 });
    await page.waitForTimeout(1500); // Aguardar renderização das fontes e SVGs

    // 1. Screenshot em alta resolução do documento
    await page.emulateMedia({ media: "screen" });
    const element = await page.$(".print-document");
    if (element) {
      const imgPath = path.join(ARTIFACT_DIR, `${report.previewName}.png`);
      await element.screenshot({ path: imgPath });
      console.log(`✓ Screenshot salvo: ${imgPath}`);
    }

    // 2. Exportação PDF no formato A4 oficial
    await page.emulateMedia({ media: "print" });
    const pdfPath = path.join(ARTIFACT_DIR, `${report.name}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "14mm",
        right: "16mm",
        bottom: "16mm",
        left: "16mm",
      },
    });
    console.log(`✓ PDF salvo: ${pdfPath}`);

    await page.close();
  }

  await browser.close();
  await vite.close();
  console.log("Exportação de todos os 8 relatórios concluída com sucesso!\n");

  console.log("Executando bateria de QA de integridade e blindagem permanente...");
  const { execSync } = await import("child_process");
  execSync("npx tsx scripts/qa-reports-integrity.ts", { stdio: "inherit" });
}

main().catch((err) => {
  console.error("Erro fatal ao exportar relatórios:", err);
  process.exit(1);
});
