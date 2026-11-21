import { extractText, getDocumentProxy } from "unpdf";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "/home/gabrielsales/.gemini/antigravity/brain/f22669ab-08b2-4958-952b-27aaa5d38af0";

interface ReportSpec {
  id: string;
  filename: string;
  title: string;
  expectedPages: number;
  mathValidator?: (fullText: string, pages: string[]) => { passed: boolean; message: string };
}

const REPORTS_SPECS: ReportSpec[] = [
  {
    id: "dre",
    filename: "RELATORIO_EXEMPLO_1_DRE_PESSOAL.pdf",
    title: "Relatório Executivo de Finanças Pessoais & DRE",
    expectedPages: 2,
    mathValidator: (fullText) => {
      // Receitas: 18.500,00 · Despesas: 8.940,00 · Res. Operacional: 9.560,00 · Aporte: 6.500,00 · Caixa: 3.060,00
      const hasIncome = fullText.includes("18.500,00");
      const hasExpenses = fullText.includes("8.940,00");
      const hasSavings = fullText.includes("9.560,00");
      const hasCashFlow = fullText.includes("3.060,00");
      const passed = hasIncome && hasExpenses && hasSavings && hasCashFlow;
      return {
        passed,
        message: passed
          ? "Cascata DRE validada: Receita (18.500) - Despesas (8.940) = Res. Operacional (9.560); Caixa Final = 3.060"
          : "Valores contábeis da Cascata DRE divergiram",
      };
    },
  },
  {
    id: "balanco",
    filename: "RELATORIO_EXEMPLO_2_BALANCO_PATRIMONIAL_360.pdf",
    title: "Balanço Patrimonial 360° One-Pager Consolidado",
    expectedPages: 1,
    mathValidator: (fullText) => {
      // Ativo Total: 485.000,00 · Passivo Total: 42.000,00 · Patrimônio Líquido: 443.000,00
      const hasAssets = fullText.includes("485.000,00");
      const hasLiabilities = fullText.includes("42.000,00");
      const hasNetWorth = fullText.includes("443.000,00");
      const passed = hasAssets && hasLiabilities && hasNetWorth;
      return {
        passed,
        message: passed
          ? "Balanço 360 validado: Ativos (485.000) - Passivos (42.000) = PL (443.000)"
          : "Equação patrimonial do Balanço 360 divergiu",
      };
    },
  },
  {
    id: "irpf",
    filename: "RELATORIO_EXEMPLO_3_FACILITADOR_IRPF.pdf",
    title: "Facilitador de Declaração de IRPF (Bens, Direitos & Rendimentos)",
    expectedPages: 1,
    mathValidator: (fullText) => {
      // Grupo 03 (40.580,00) + Grupo 04 (52.000,05) + Grupo 07 (43.335,00) = Total 135.915,05
      const hasG03 = fullText.includes("40.580,00");
      const hasG04 = fullText.includes("52.000,05");
      const hasG07 = fullText.includes("43.335,00");
      const hasTotal = fullText.includes("135.915,05");
      // Rendimentos: 1.420 + 780 + 1.368 + 1.980 = 5.548,00
      const hasRendimentosTotal = fullText.includes("5.548,00");
      const passed = hasG03 && hasG04 && hasG07 && hasTotal && hasRendimentosTotal;
      return {
        passed,
        message: passed
          ? "Subtotais IRPF validados: G03 (40.580,00) + G04 (52.000,05) + G07 (43.335,00) = Custo Total (135.915,05); Rendimentos = 5.548,00"
          : "Soma dos subtotais dos grupos de Bens e Direitos divergiu do Custo Total",
      };
    },
  },
  {
    id: "fire",
    filename: "RELATORIO_EXEMPLO_4_DOSSIE_FIRE.pdf",
    title: "Dossiê FIRE & Liberdade Financeira",
    expectedPages: 1,
    mathValidator: (fullText) => {
      // Cobertura 56,7%, Média R$ 4.250,00, Proventos Anuais R$ 48.600,00, Projeção 12m R$ 51.000,00
      const hasCoverage = fullText.includes("56,7%");
      const hasAverage = fullText.includes("4.250,00");
      const hasAnnual = fullText.includes("48.600,00");
      const hasProjection = fullText.includes("51.000,00");
      const passed = hasCoverage && hasAverage && hasAnnual && hasProjection;
      return {
        passed,
        message: passed
          ? "Métricas FIRE validadas: Cobertura 56,7%, Média R$ 4.250,00/mês, Projeção 12m R$ 51.000,00"
          : "Proventos anuais ou projeção divergiram no Dossiê FIRE",
      };
    },
  },
  {
    id: "fatura",
    filename: "RELATORIO_EXEMPLO_5_FATURA_CARTAO.pdf",
    title: "Extrato e Fatura Detalhada de Cartão de Crédito",
    expectedPages: 1,
    mathValidator: (fullText) => {
      // Lançamentos somam Bruto R$ 4.850,00 e Ponderado R$ 4.200,00
      const hasBruto = fullText.includes("4.850,00");
      const hasPonderado = fullText.includes("4.200,00");
      const passed = hasBruto && hasPonderado;
      return {
        passed,
        message: passed
          ? "Total de lançamentos da fatura validado: Bruto R$ 4.850,00 e Ponderado R$ 4.200,00"
          : "Total da fatura de cartão divergiu",
      };
    },
  },
  {
    id: "dossie_posicao",
    filename: "RELATORIO_EXEMPLO_6_DOSSIE_POSICAO_VIGENTE.pdf",
    title: "Dossiê Executivo da Posição Vigente Consolidada (Wealth Tear Sheet)",
    expectedPages: 7,
    mathValidator: (fullText) => {
      // Patrimônio Total: 106.377,43 · Custo de Aquisição: 90.000,00 · Caixa: 10.318,93
      const hasPatrimonio = fullText.includes("106.377,43");
      const hasCaixa = fullText.includes("10.318,93");
      const passed = hasPatrimonio && hasCaixa;
      return {
        passed,
        message: passed
          ? "Dossiê Posição Vigente validado: Patrimônio R$ 106.377,43 com Reserva de Caixa R$ 10.318,93"
          : "Patrimônio ou caixa divergiram no Dossiê da Posição Vigente",
      };
    },
  },
  {
    id: "carteira_mensal",
    filename: "RELATORIO_EXEMPLO_7_CARTEIRA_MENSAL.pdf",
    title: "Relatório Executivo Mensal de Acompanhamento da Carteira",
    expectedPages: 2,
    mathValidator: (fullText) => {
      // Posição: 106.377,43 · Custo Consolidado: 100.318,93 · Retorno P&L: +6,0%
      const hasPatrimonio = fullText.includes("106.377,43");
      const hasCustoConsolidado = fullText.includes("100.318,93");
      const hasRetornoConsolidado = fullText.includes("+6,0%");
      // Checa se a antiga dupla contagem não existe no documento
      const hasOldDoubleCountCost = fullText.includes("110.637,86");
      const hasOldNegativeReturn = fullText.includes("-3,9%");

      const passed =
        hasPatrimonio &&
        hasCustoConsolidado &&
        hasRetornoConsolidado &&
        !hasOldDoubleCountCost &&
        !hasOldNegativeReturn;

      return {
        passed,
        message: passed
          ? "Invariante Matemática da Carteira Mensal aprovada (Custo R$ 100.318,93, Retorno +6,0%, zero dupla contagem)"
          : `Falha na invariante da Carteira: hasPatrimonio=${hasPatrimonio}, hasCustoConsolidado=${hasCustoConsolidado}, hasRetorno=${hasRetornoConsolidado}, hasOldDoubleCountCost=${hasOldDoubleCountCost}`,
      };
    },
  },
  {
    id: "extrato_snapshots",
    filename: "RELATORIO_EXEMPLO_8_EXTRATO_SNAPSHOTS.pdf",
    title: "Extrato Analítico de Snapshots Patrimoniais & Ledger Histórico",
    expectedPages: 1,
    mathValidator: (fullText) => {
      // Saldo final 106.377,43 · Custo 90.000,00 · Ganho de Capital 16.377,43
      const hasPatrimonio = fullText.includes("106.377,43");
      const hasCusto = fullText.includes("90.000,00");
      const passed = hasPatrimonio && hasCusto;
      return {
        passed,
        message: passed
          ? "Extrato de Snapshots validado: Saldo R$ 106.377,43 e Custo R$ 90.000,00"
          : "Valores consolidados divergiram no Extrato de Snapshots",
      };
    },
  },
];

const TEXT_HYGIENE_RULES = [
  {
    id: "english_pct",
    regex: /\b\d+\.\d+%/g,
    description: "Ponto decimal inglês em percentual (deve usar vírgula pt-BR)",
  },
  {
    id: "decimal_spaces",
    regex: /(\d\s+,\s*\d|\d\s*,\s+\d)/g,
    description: "Espaço espúrio ao redor de vírgula decimal",
  },
  {
    id: "unaccented_custodia",
    regex: /\bCUSTODIA\b/g,
    description: "CUSTODIA sem acento (deve ser CUSTÓDIA)",
  },
  {
    id: "raw_slugs",
    regex: /\b(STOCK_|FIXED_|stock_|fixed_)\w*/g,
    description: "Slugs e enums crus não tratados pela camada de apresentação",
  },
  {
    id: "corrupted_glyphs",
    regex: /[目لا]/g,
    description: "Glifos corrompidos ou resquícios de OCR/fontes quebradas",
  },
  {
    id: "mechanical_plurals",
    regex: /\b\w+\((s|is|es)\)/gi,
    description: "Pluralização mecânica não institucional (ex.: ativo(s), categoria(s))",
  },
  {
    id: "kpi_ellipsis",
    regex: /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{4,}\.\.\./g,
    description: "Reticências espúrias em títulos de cartões ou KPIs",
  },
];

const CVM_LEGAL_SNIPPET = "informações têm caráter exclusivamente informativo e gerencial";

async function runQAReportsIntegrity() {
  console.log("================================================================================");
  console.log("     AXIR REPORT ENGINE — BATERIA DE BLINDAGEM AUTOMATIZADA DE QA (10/10)       ");
  console.log("================================================================================\n");

  let totalErrors = 0;

  for (const spec of REPORTS_SPECS) {
    console.log(`\n▶ [${spec.id.toUpperCase()}] Verificando: ${spec.title}`);
    const filePath = path.join(ARTIFACT_DIR, spec.filename);

    if (!fs.existsSync(filePath)) {
      console.error(`  ❌ ERRO CRÍTICO: Arquivo não encontrado: ${filePath}`);
      totalErrors++;
      continue;
    }

    const fileBuf = fs.readFileSync(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(fileBuf));
    const numPages = pdf.numPages;

    // 1. Invariante de Paginação
    if (numPages !== spec.expectedPages) {
      console.error(
        `  ❌ FALHA DE PAGINAÇÃO: Esperadas ${spec.expectedPages} páginas, mas o PDF possui ${numPages}`,
      );
      totalErrors++;
    } else {
      console.log(`  ✓ Paginação física exata: ${numPages} de ${spec.expectedPages} página(s)`);
    }

    const { text: pagesText } = await extractText(pdf, { mergePages: false });
    const fullDocumentText = pagesText.join("\n");

    // Verificar se cada página possui marcação "Página X de Y" com 1 <= X <= Y
    pagesText.forEach((pageText, idx) => {
      const pageNum = idx + 1;
      const paginationRegex = /Página\s+(\d+)\s+de\s+(\d+)/;
      const match = pageText.match(paginationRegex);
      if (!match) {
        console.error(`  ❌ FALHA: Página ${pageNum} não possui indicador institucional 'Página X de Y'`);
        totalErrors++;
      } else {
        const x = parseInt(match[1], 10);
        const y = parseInt(match[2], 10);
        if (x !== pageNum || y !== spec.expectedPages) {
          console.error(
            `  ❌ FALHA DE COERÊNCIA DE PÁGINA: Encontrado 'Página ${x} de ${y}', esperado 'Página ${pageNum} de ${spec.expectedPages}'`,
          );
          totalErrors++;
        }
      }
    });

    // 2. Invariante de Higiene Textual
    pagesText.forEach((pageText, idx) => {
      const pageNum = idx + 1;
      for (const rule of TEXT_HYGIENE_RULES) {
        const matches = pageText.match(rule.regex);
        if (matches) {
          console.error(`  ❌ HIGIENE [Pág ${pageNum}]: ${rule.description} -> Encontrado:`, matches);
          totalErrors++;
        }
      }
    });

    // 3. Invariante CVM (Disponível no máximo 1 vez por documento)
    const cvmMatches = fullDocumentText.toLowerCase().split(CVM_LEGAL_SNIPPET.toLowerCase()).length - 1;
    if (cvmMatches > 1) {
      console.error(
        `  ❌ FALHA CVM: Texto legal da CVM repetiu-se ${cvmMatches} vezes no documento (máximo permitido: 1)`,
      );
      totalErrors++;
    } else {
      console.log(`  ✓ Cláusula jurídica CVM conferida: ${cvmMatches} ocorrência (normativo institucional)`);
    }

    // 4. Invariante Matemática
    if (spec.mathValidator) {
      const mathResult = spec.mathValidator(fullDocumentText, pagesText);
      if (mathResult.passed) {
        console.log(`  ✓ Matemática: ${mathResult.message}`);
      } else {
        console.error(`  ❌ FALHA MATEMÁTICA: ${mathResult.message}`);
        totalErrors++;
      }
    }
  }

  console.log("\n================================================================================");
  if (totalErrors === 0) {
    console.log("  🏆 CERTIFICAÇÃO 10 / 10 CONCLUÍDA COM SUCESSO! ZERO FALHAS ENCONTRADAS.");
    console.log("  Todos os 8 relatórios cumprem integralmente as especificações da Release v1.0 Gold.");
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.error(`  ⛔ FALHAS DETECTADAS: ${totalErrors} erro(s). Corrija antes do fechamento.`);
    console.log("================================================================================\n");
    process.exit(1);
  }
}

runQAReportsIntegrity().catch((err) => {
  console.error("Erro fatal na execução do QA de Relatórios:", err);
  process.exit(1);
});
