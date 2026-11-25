import { describe, expect, it } from "vitest";
import {
  SectionStateMachine,
  evaluateBimodalPrecondition,
  evaluateChecksumGate,
  extractTransactionsFromSpatialLines,
  findBimodalGutterX,
  groupTokensIntoLines,
  isDominantGeometry,
  isSimulationOrContractualNoise,
  type SpatialPdfLine,
  type SpatialPdfToken,
} from "./spatial-pdf-extractor";
import type { StatementTransaction } from "../contracts";

describe("spatial-pdf-parser — Motor Espacial (X, Y) com 4 Barreiras Anti-Ruído", () => {
  describe("Gutter Relativo e Pré-Condição Bimodal", () => {
    const pageWidth = 600;

    it("identifica 1 coluna com vazio central (não ativa bimodal se apenas um lado tiver pares data+valor)", () => {
      // Tokens de fatura de 1 coluna: Data à esquerda, descrição no centro, valor à direita
      const tokens: SpatialPdfToken[] = [
        { str: "10/04", x: 40, y: 700, width: 30, height: 10, fontSize: 9 },
        { str: "Supermercado Pão de Açúcar", x: 100, y: 700, width: 120, height: 10, fontSize: 9 },
        { str: "R$ 350,00", x: 500, y: 700, width: 50, height: 10, fontSize: 9 },

        { str: "12/04", x: 40, y: 680, width: 30, height: 10, fontSize: 9 },
        { str: "Farmácia Drogasil", x: 100, y: 680, width: 80, height: 10, fontSize: 9 },
        { str: "R$ 85,20", x: 500, y: 680, width: 45, height: 10, fontSize: 9 },
      ];

      const isBimodal = evaluateBimodalPrecondition(tokens, pageWidth);
      expect(isBimodal).toBe(false);

      const lines = groupTokensIntoLines(tokens, pageWidth, false);
      expect(lines).toHaveLength(2);
      expect(lines[0]?.text).toBe("10/04 Supermercado Pão de Açúcar R$ 350,00");
      expect(lines[1]?.text).toBe("12/04 Farmácia Drogasil R$ 85,20");
    });

    it("identifica 2 colunas com gutter quando ambos os lados contêm independentemente pares Data + Valor", () => {
      const tokens: SpatialPdfToken[] = [
        // Coluna 1 (X < 300)
        { str: "05/03", x: 30, y: 700, width: 25, height: 10, fontSize: 9 },
        { str: "Uber Trip", x: 60, y: 700, width: 50, height: 10, fontSize: 9 },
        { str: "R$ 25,00", x: 220, y: 700, width: 40, height: 10, fontSize: 9 },

        { str: "06/03", x: 30, y: 680, width: 25, height: 10, fontSize: 9 },
        { str: "iFood", x: 60, y: 680, width: 40, height: 10, fontSize: 9 },
        { str: "R$ 48,00", x: 220, y: 680, width: 40, height: 10, fontSize: 9 },

        // Coluna 2 (X >= 300)
        { str: "15/03", x: 330, y: 700, width: 25, height: 10, fontSize: 9 },
        { str: "Amazon.com.br", x: 360, y: 700, width: 70, height: 10, fontSize: 9 },
        { str: "R$ 120,00", x: 520, y: 700, width: 45, height: 10, fontSize: 9 },

        { str: "18/03", x: 330, y: 680, width: 25, height: 10, fontSize: 9 },
        { str: "Netflix", x: 360, y: 680, width: 40, height: 10, fontSize: 9 },
        { str: "R$ 55,90", x: 520, y: 680, width: 40, height: 10, fontSize: 9 },
      ];

      const isBimodal = evaluateBimodalPrecondition(tokens, pageWidth);
      expect(isBimodal).toBe(true);

      const lines = groupTokensIntoLines(tokens, pageWidth, true);
      expect(lines).toHaveLength(4);
      // Lê primeiro a coluna 1 de cima para baixo
      expect(lines[0]?.text).toBe("05/03 Uber Trip R$ 25,00");
      expect(lines[0]?.column).toBe(1);
      expect(lines[1]?.text).toBe("06/03 iFood R$ 48,00");
      expect(lines[1]?.column).toBe(1);
      // Depois lê a coluna 2 de cima para baixo
      expect(lines[2]?.text).toBe("15/03 Amazon.com.br R$ 120,00");
      expect(lines[2]?.column).toBe(2);
      expect(lines[3]?.text).toBe("18/03 Netflix R$ 55,90");
      expect(lines[3]?.column).toBe(2);
    });
  });

  describe("Barreira 1 — Máquina de Estados de Seção", () => {
    it("inicia em start_zone, entra em pause_zone e pausa em paused_boleto até virada de página ou nova seção", () => {
      const sm = new SectionStateMachine();

      // Cabeçalho institucional antes das compras
      expect(sm.processLine("FATURA DO CARTÃO DE CRÉDITO", 1)).toEqual({
        state: "outside",
        shouldDrop: true,
      });

      // Título de início
      expect(sm.processLine("LANÇAMENTOS DA FATURA", 1)).toEqual({
        state: "start_zone",
        shouldDrop: true, // Título é descartado
      });

      // Linha de compra aceita
      expect(sm.processLine("10/05 Posto Shell R$ 180,00", 1)).toEqual({
        state: "start_zone",
        shouldDrop: false,
      });

      // Entra em zona de simulação de parcelamento
      expect(sm.processLine("OPÇÕES DE PARCELAMENTO DA FATURA", 1)).toEqual({
        state: "pause_zone",
        shouldDrop: true,
      });

      // Conteúdo dentro de pause_zone é descartado
      expect(sm.processLine("Plano em até 12x de R$ 45,00", 1)).toEqual({
        state: "pause_zone",
        shouldDrop: true,
      });

      // Pausa de boleto ao encontrar linha digitável de boleto bancário (47 dígitos) na página 1
      expect(sm.processLine("23793.38128 60000.123456 01000.678901 3 98760000018000", 1)).toEqual({
        state: "paused_boleto",
        shouldDrop: true,
      });

      // Campos do boleto na mesma página 1 são descartados sem vazar
      expect(sm.processLine("Vencimento 15/05/2026 Valor do Documento R$ 1.800,00", 1)).toEqual({
        state: "paused_boleto",
        shouldDrop: true,
      });
      expect(sm.processLine("Autenticação Mecânica", 1)).toEqual({
        state: "paused_boleto",
        shouldDrop: true,
      });

      // Ao virar para a página 2, a máquina retoma a leitura normalmente
      expect(sm.processLine("11/05 Compra Qualquer R$ 50,00", 2)).toEqual({
        state: "start_zone",
        shouldDrop: false,
      });
    });
  });

  describe("Barreira 2 — Geometria Dominante", () => {
    it("descarta notas de rodapé com fonte miúda (< 6.8pt)", () => {
      const finePrintLine: SpatialPdfLine = {
        y: 100,
        xStart: 50,
        xEnd: 550,
        fontSize: 5.5,
        column: 1,
        text: "*Taxas sujeitas a alteração sem aviso prévio. Consulte o SAC.",
        tokens: [],
      };
      expect(isDominantGeometry(finePrintLine)).toBe(false);

      const regularLine: SpatialPdfLine = {
        y: 500,
        xStart: 50,
        xEnd: 500,
        fontSize: 9.0,
        column: 1,
        text: "15/05 Padaria Estrela R$ 22,50",
        tokens: [],
      };
      expect(isDominantGeometry(regularLine)).toBe(true);
    });
  });

  describe("Barreira 3 — Encargos Informativos vs. Cobrados", () => {
    it("descarta simulações com %, a.m., CET, Nx de R$ e pagamento mínimo", () => {
      expect(isSimulationOrContractualNoise("Juros do Rotativo: 14,8% a.m.")).toBe(true);
      expect(isSimulationOrContractualNoise("Custo Efetivo Total (CET) 412,5% a.a.")).toBe(true);
      expect(isSimulationOrContractualNoise("Parcelamento em até 24x de R$ 98,50")).toBe(true);
      expect(isSimulationOrContractualNoise("Pagamento Mínimo R$ 150,00")).toBe(true);
    });

    it("preserva encargos reais faturados com data e valor como fee_or_tax", () => {
      const lines: SpatialPdfLine[] = [
        {
          y: 700,
          xStart: 40,
          xEnd: 500,
          fontSize: 9,
          column: 1,
          text: "02/05 IOF TRANSACOES EXTERIOR R$ 18,45",
          tokens: [],
        },
        {
          y: 680,
          xStart: 40,
          xEnd: 500,
          fontSize: 9,
          column: 1,
          text: "05/05 ANUIDADE DIFERENCIADA 02/12 R$ 35,00",
          tokens: [],
        },
      ];

      const { transactions } = extractTransactionsFromSpatialLines(lines, {
        cardId: "card-1",
        competenceMonth: "2026-05",
      });

      expect(transactions).toHaveLength(2);
      expect(transactions[0]?.nature).toBe("fee_or_tax");
      expect(transactions[0]?.amountCents).toBe(1845);
      expect(transactions[1]?.nature).toBe("fee_or_tax");
      expect(transactions[1]?.amountCents).toBe(3500);
      expect(transactions[1]?.installment).toEqual({ current: 2, total: 12 });
    });
  });

  describe("Continuação Internacional (fx_detail)", () => {
    it("anexa linha de cotação cambial sem data/valor como fx_detail à compra anterior", () => {
      const lines: SpatialPdfLine[] = [
        {
          y: 700,
          xStart: 40,
          xEnd: 500,
          fontSize: 9,
          column: 1,
          text: "10/05 STEAM GAMES USD 19.99 R$ 108,50",
          tokens: [],
        },
        {
          y: 688,
          xStart: 60,
          xEnd: 300,
          fontSize: 8,
          column: 1,
          text: "COTACAO USD: 5.4277 TAXA DE CONVERSAO",
          tokens: [],
        },
      ];

      const { transactions, reconstructedText } = extractTransactionsFromSpatialLines(lines, {
        cardId: "card-1",
        competenceMonth: "2026-05",
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.rawDescription).toContain("COTACAO USD: 5.4277");
      expect(reconstructedText).toContain("[fx_detail]");
    });
  });

  describe("Barreira 4 — Checksum Gate", () => {
    const candidateTxs: StatementTransaction[] = [
      {
        id: "tx-1",
        index: 0,
        occurrenceIndex: 0,
        date: "2026-05-10",
        rawDescription: "Supermercado",
        cleanDescription: "Supermercado",
        amountCents: 15000,
        isRefund: false,
        isPayment: false,
        statementHash: "h1",
        nature: "purchase",
      },
      {
        id: "tx-2",
        index: 1,
        occurrenceIndex: 0,
        date: "2026-05-12",
        rawDescription: "Estorno Parcial",
        cleanDescription: "Estorno Parcial",
        amountCents: 2000, // R$ 20,00 estorno
        isRefund: true,
        isPayment: false,
        statementHash: "h2",
        nature: "refund",
      },
      {
        id: "tx-3",
        index: 2,
        occurrenceIndex: 0,
        date: "2026-05-15",
        rawDescription: "IOF",
        cleanDescription: "IOF",
        amountCents: 500, // R$ 5,00 encargo
        isRefund: false,
        isPayment: false,
        statementHash: "h3",
        nature: "fee_or_tax",
      },
    ];

    it("aprova Checksum Gate quando a soma líquida coincide com o total oficial (tolerância +- R$ 0,05)", () => {
      // Líquido esperado: 150,00 - 20,00 + 5,00 = 135,00 (13500 centavos)
      const exactResult = evaluateChecksumGate(candidateTxs, 13500);
      expect(exactResult.passed).toBe(true);
      expect(exactResult.diffCents).toBe(0);

      // Com discrepância de 3 centavos (tolerância de até 5 centavos)
      const tolerantResult = evaluateChecksumGate(candidateTxs, 13503);
      expect(tolerantResult.passed).toBe(true);
      expect(tolerantResult.diffCents).toBe(3);
    });

    it("reprova Checksum Gate quando a divergência excede R$ 0,05", () => {
      // Divergência de R$ 10,00 (1000 centavos)
      const failedResult = evaluateChecksumGate(candidateTxs, 14500);
      expect(failedResult.passed).toBe(false);
      expect(failedResult.diffCents).toBe(1000);
    });

    it("aprova automaticamente quando officialTotalCents não está impresso na fatura", () => {
      const noOfficialTotal = evaluateChecksumGate(candidateTxs, null);
      expect(noOfficialTotal.passed).toBe(true);
      expect(noOfficialTotal.officialTotalCents).toBeNull();
    });
  });

  describe("Cenários Reais Rico/XP, Moeda Estrangeira e Virada de Ano", () => {
    it("descarta boleto na capa (pág 1) e cabeçalho de cartão, extraindo compras reais na pág 2", () => {
      const lines: SpatialPdfLine[] = [
        { y: 780, xStart: 40, xEnd: 300, fontSize: 10, column: 1, pageNumber: 1, text: "Cartão: **** **** **** 2107 VISA 15/11/2026 R$ 1.528,54", tokens: [] },
        { y: 700, xStart: 40, xEnd: 400, fontSize: 9, column: 1, pageNumber: 1, text: "23793.38128 60000.123456 01000.678901 3 98760000152854", tokens: [] },
        { y: 680, xStart: 40, xEnd: 300, fontSize: 9, column: 1, pageNumber: 1, text: "Vencimento 15/11/2026 Valor do Documento R$ 1.528,54", tokens: [] },
        { y: 750, xStart: 40, xEnd: 300, fontSize: 10, column: 1, pageNumber: 2, text: "10/11/2026 MERCADO CENTRAL R$ 528,54", tokens: [] },
        { y: 730, xStart: 40, xEnd: 300, fontSize: 10, column: 1, pageNumber: 2, text: "12/11/2026 FARMACIA SAUDE R$ 1.000,00", tokens: [] },
      ];

      const { transactions, detectedCardLast4s } = extractTransactionsFromSpatialLines(lines, {
        cardId: "card-rico",
        competenceMonth: "2026-11",
      });

      expect(detectedCardLast4s).toContain("2107");
      expect(transactions).toHaveLength(2);
      expect(transactions[0]?.cleanDescription).toBe("MERCADO CENTRAL");
      expect(transactions[0]?.amountCents).toBe(52854);
      expect(transactions[1]?.cleanDescription).toBe("FARMACIA SAUDE");
      expect(transactions[1]?.amountCents).toBe(100000);
    });

    it("ancora no último valor BRL à direita em compras internacionais com USD + BRL", () => {
      const lines: SpatialPdfLine[] = [
        { y: 750, xStart: 40, xEnd: 400, fontSize: 10, column: 1, pageNumber: 1, text: "10/11/2026 OPENAI *CHATGPT USD 20,00 116,40", tokens: [] },
      ];

      const { transactions } = extractTransactionsFromSpatialLines(lines, {
        cardId: "card-1",
        competenceMonth: "2026-11",
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.amountCents).toBe(11640);
    });

    it("resolve virada de ano e meses abreviados em faturas de Janeiro (28 DEZ -> ano anterior)", () => {
      const lines: SpatialPdfLine[] = [
        { y: 750, xStart: 40, xEnd: 300, fontSize: 10, column: 1, pageNumber: 1, text: "28 DEZ RESTAURANTE ANO NOVO R$ 120,00", tokens: [] },
      ];

      const { transactions } = extractTransactionsFromSpatialLines(lines, {
        cardId: "card-1",
        competenceMonth: "2027-01",
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.date).toBe("2026-12-28");
    });

    it("agrupa tokens com ΔY adaptativo proporcional à fonte (~0.35 * fontSize) e detecta vale bimodal real", () => {
      const largeFontTokens: SpatialPdfToken[] = [
        { str: "10/11/2026", x: 30, y: 700, width: 45, height: 15, fontSize: 16 },
        { str: "MERCADO FONTE GRANDE", x: 95, y: 695.5, width: 140, height: 15, fontSize: 16 },
        { str: "R$ 240,00", x: 260, y: 696, width: 55, height: 15, fontSize: 16 },
      ];
      // Com fontSize=16, ΔY adaptativo = min(6, 16 * 0.35) = 5.6pt -> 4.5pt de desalinhamento continua na mesma linha!
      const grouped = groupTokensIntoLines(largeFontTokens, 600, false);
      expect(grouped).toHaveLength(1);
      expect(grouped[0]?.text).toContain("MERCADO FONTE GRANDE");

      const bimodalTokens: SpatialPdfToken[] = [];
      for (let i = 0; i < 6; i++) {
        const y = 700 - i * 16;
        bimodalTokens.push(
          { str: "10/11", x: 35, y, width: 25, height: 9, fontSize: 9 },
          { str: `LOJA ESQ ${i}`, x: 80, y, width: 70, height: 9, fontSize: 9 },
          { str: "50,00", x: 210, y, width: 30, height: 9, fontSize: 9 },
          { str: "12/11", x: 340, y, width: 25, height: 9, fontSize: 9 },
          { str: `LOJA DIR ${i}`, x: 390, y, width: 70, height: 9, fontSize: 9 },
          { str: "70,00", x: 520, y, width: 30, height: 9, fontSize: 9 },
        );
      }
      const gutter = findBimodalGutterX(bimodalTokens, 600);
      expect(gutter).not.toBeNull();
      expect(gutter!).toBeGreaterThan(240);
      expect(gutter!).toBeLessThan(340);
    });

    it("remove apenas o token de valor à direita via lastIndexOf sem apagar letras C/D do nome (G5)", () => {
      const lines: SpatialPdfLine[] = [
        {
          y: 740,
          xStart: 40,
          xEnd: 380,
          fontSize: 10,
          column: 1,
          pageNumber: 1,
          text: "14/11/2026 CLINICA C & D ODONTO R$ 199,90",
          tokens: [],
        },
        {
          y: 720,
          xStart: 40,
          xEnd: 380,
          fontSize: 10,
          column: 1,
          pageNumber: 1,
          text: "15/11/2026 CAFE D CASA R$ 45,00-",
          tokens: [],
        },
      ];

      const { transactions } = extractTransactionsFromSpatialLines(lines, {
        cardId: "card-1",
        competenceMonth: "2026-11",
      });

      expect(transactions).toHaveLength(2);
      expect(transactions[0]?.cleanDescription).toContain("CLINICA C & D ODONTO");
      expect(transactions[0]?.amountCents).toBe(19990);
      expect(transactions[1]?.cleanDescription).toContain("CAFE D CASA");
      expect(transactions[1]?.isRefund).toBe(true);
    });

    it("BTG Pactual: detecta vale bimodal mesmo com cabeçalhos/rodapés largos, separa linhas fundidas e reconhece '- R$ 942,40'", () => {
      const pageWidth = 600;
      const btgTokens: SpatialPdfToken[] = [
        // Cabeçalho largo bloqueando X = 40..560
        { str: "Olá, Titular! Esta é a fatura do seu cartão BTG Pactual de Novembro no valor de R$ 830,38", x: 40, y: 780, width: 500, height: 12, fontSize: 12 },
        { str: "Lançamentos do cartão físico | Titular Exemplo | Final 1234 Total do cartão: R$ 736,48", x: 40, y: 740, width: 510, height: 10, fontSize: 10 },
        // Tabela 2 colunas
        { str: "02 Set", x: 40, y: 710, width: 30, height: 9, fontSize: 9 },
        { str: "Mulvi (2/2)", x: 85, y: 710, width: 60, height: 9, fontSize: 9 },
        { str: "R$ 112,39", x: 230, y: 710, width: 45, height: 9, fontSize: 9 },
        { str: "29 Out", x: 315, y: 710, width: 30, height: 9, fontSize: 9 },
        { str: "Filialshopping", x: 360, y: 710, width: 70, height: 9, fontSize: 9 },
        { str: "R$ 156,50", x: 505, y: 710, width: 45, height: 9, fontSize: 9 },
        { str: "🌐", x: 554, y: 710, width: 8, height: 9, fontSize: 9 },

        { str: "18 Out", x: 40, y: 694, width: 30, height: 9, fontSize: 9 },
        { str: "Cactus Burguer", x: 85, y: 694, width: 75, height: 9, fontSize: 9 },
        { str: "R$ 80,50", x: 235, y: 694, width: 40, height: 9, fontSize: 9 },
        { str: "29 Out", x: 315, y: 694, width: 30, height: 9, fontSize: 9 },
        { str: "Riomar Aracaju Parking", x: 360, y: 694, width: 100, height: 9, fontSize: 9 },
        { str: "R$ 11,00", x: 510, y: 694, width: 40, height: 9, fontSize: 9 },

        { str: "29 Out", x: 40, y: 678, width: 30, height: 9, fontSize: 9 },
        { str: "Flor Da Pavão", x: 85, y: 678, width: 65, height: 9, fontSize: 9 },
        { str: "R$ 68,26", x: 235, y: 678, width: 40, height: 9, fontSize: 9 },
        { str: "31 Out", x: 315, y: 678, width: 30, height: 9, fontSize: 9 },
        { str: "Posto Dynamus Iii", x: 360, y: 678, width: 85, height: 9, fontSize: 9 },
        { str: "R$ 307,83", x: 505, y: 678, width: 45, height: 9, fontSize: 9 },

        // Cartão virtual
        { str: "Lançamentos do cartão virtual | Titular Exemplo | Final 5678 Total do cartão: R$ 93,90", x: 40, y: 640, width: 510, height: 10, fontSize: 10 },
        { str: "21 Out", x: 40, y: 620, width: 30, height: 9, fontSize: 9 },
        { str: "Vivo", x: 85, y: 620, width: 25, height: 9, fontSize: 9 },
        { str: "R$ 49,00", x: 235, y: 620, width: 40, height: 9, fontSize: 9 },
        { str: "23 Out", x: 315, y: 620, width: 30, height: 9, fontSize: 9 },
        { str: "Netflix", x: 360, y: 620, width: 35, height: 9, fontSize: 9 },
        { str: "R$ 44,90", x: 510, y: 620, width: 40, height: 9, fontSize: 9 },

        // Pagamento com sinal "- R$" + rodapé largo bloqueando o centro
        { str: "05 Out", x: 40, y: 760, width: 30, height: 9, fontSize: 9 },
        { str: "Pagamento de fatura", x: 85, y: 760, width: 95, height: 9, fontSize: 9 },
        { str: "- R$ 942,40", x: 220, y: 760, width: 55, height: 9, fontSize: 9 },
        { str: "Taxas e encargos: Crédito Rotativo 6,19% a.m / 105,59% a.a / CET 108,59% a.a", x: 40, y: 400, width: 480, height: 9, fontSize: 9 },
      ];

      const gutter = findBimodalGutterX(btgTokens, pageWidth);
      expect(gutter).not.toBeNull();
      const grouped = groupTokensIntoLines(btgTokens, pageWidth, true, gutter ?? undefined);
      const { transactions } = extractTransactionsFromSpatialLines(grouped, {
        cardId: "card-btg",
        competenceMonth: "2026-11",
        closingDay: 1,
      });

      const purchases = transactions.filter((t) => !t.isPayment);
      const payments = transactions.filter((t) => t.isPayment);
      expect(purchases).toHaveLength(8);
      expect(payments).toHaveLength(1);
      expect(payments[0]?.amountCents).toBe(94240);
      expect(purchases.reduce((acc, t) => acc + t.amountCents, 0)).toBe(83038);

      // Segunda barreira: mesmo sem gutter bimodal, split intra-linha separa os pares Data+Valor
      const mergedFallback: SpatialPdfLine[] = [
        { y: 710, xStart: 40, xEnd: 550, fontSize: 9, column: 1, pageNumber: 2, text: "02 Set Mulvi (2/2) R$ 112,39 29 Out Filialshopping R$ 156,50", tokens: [] },
        { y: 620, xStart: 40, xEnd: 550, fontSize: 9, column: 1, pageNumber: 2, text: "21 Out Vivo R$ 49,00 23 Out Netflix R$ 44,90", tokens: [] },
      ];
      const splitRes = extractTransactionsFromSpatialLines(mergedFallback, {
        cardId: "card-btg",
        competenceMonth: "2026-11",
        closingDay: 1,
      });
      expect(splitRes.transactions).toHaveLength(4);
      expect(splitRes.transactions.reduce((acc, t) => acc + t.amountCents, 0)).toBe(
        11239 + 15650 + 4900 + 4490,
      );
    });
  });
});
