import { describe, expect, it } from "vitest";
import { parseBRLNumber, parseBrokerStatement } from "./statement-parser";

describe("parseBRLNumber", () => {
  it("converte valores no formato brasileiro com vírgula", () => {
    expect(parseBRLNumber("6.187,37")).toBe(6187.37);
    expect(parseBRLNumber("R$ 13.527,62")).toBe(13527.62);
    expect(parseBRLNumber(" 24.823,95 ")).toBe(24823.95);
    expect(parseBRLNumber("-2,31")).toBe(-2.31);
  });

  it("converte valores com ponto decimal simples", () => {
    expect(parseBRLNumber("6187.37")).toBe(6187.37);
  });

  it("retorna null para valores vazios ou inválidos", () => {
    expect(parseBRLNumber("")).toBeNull();
    expect(parseBRLNumber("abc")).toBeNull();
  });
});

describe("parseBrokerStatement", () => {
  const sampleStatement = `
Mês	Ano	Valor aplicado	Saldo bruto	Rentabilidade (%)
Out.	2023	6.187,37	6.147,97	-2,31
Nov.	2023	8.678,16	8.745,74	1,82
Dez.	2023	13.527,62	14.221,47	4,68
Jan.	2024	13.527,62	14.150,33	-0,27
Fev.	2024	13.279,08	13.754,03	0,62
Mar.	2024	15.221,85	15.845,33	1,55
Abr.	2024	17.714,94	18.100,50	-0,81
Mai.	2024	18.633,79	19.196,71	1,99
Jun.	2024	18.020,46	18.571,51	1,51
Jul.	2024	24.823,95	25.553,36	1,19
Ago.	2024	24.327,90	25.276,89	1,31
Set.	2024	22.534,67	23.311,70	-0,27
Out.	2024	19.410,56	20.188,55	0,23
Nov.	2024	17.916,29	19.298,15	3,62
Dez.	2024	16.697,42	17.908,52	-0,33
Jan.	2025	17.430,18	18.840,88	-1,31
Fev.	2025	17.656,30	18.836,72	0,36
Mar.	2025	17.656,30	18.799,02	0,50
Abr.	2025	16.978,32	18.435,66	1,96
Mai.	2025	16.978,32	18.741,75	1,82
Jun.	2025	17.077,86	18.966,64	0,99
Jul.	2025	17.077,86	18.818,40	-0,44
Ago.	2025	17.077,86	18.827,36	0,47
Set.	2025	17.077,86	19.164,32	1,85
Out.	2025	17.124,68	19.417,62	1,26
Nov.	2025	17.124,68	19.511,68	0,71
Dez.	2025	16.573,09	18.559,83	2,43
Jan.	2026	16.833,28	18.898,26	1,71
Fev.	2026	16.715,72	18.779,21	0,32
Mar.	2026	16.802,03	18.192,35	-2,76
Abr.	2026	16.802,03	18.078,78	-0,28
Mai.	2026	16.802,03	18.066,81	0,22
Jun.	2026	16.802,03	17.785,95	-0,91
Jul.	2026	16.802,03	17.739,85	-0,04
Ago.	2026	16.802,03	18.070,97	1,89
Set.	2026	16.802,03	18.192,40	0,77
`;

  it("processa o extrato completo com 36 meses e calcula todos os deltas", () => {
    const res = parseBrokerStatement(sampleStatement);

    expect(res.rows.length).toBe(36);
    expect(res.skippedCount).toBe(0);

    // Primeiro mês (Marco inicial)
    expect(res.rows[0]?.date).toBe("2023-10-31");
    expect(res.rows[0]?.delta).toBe(6187.37);
    expect(res.rows[0]?.type).toBe("aporte");

    // Segundo mês (Aporte delta)
    expect(res.rows[1]?.date).toBe("2023-11-30");
    expect(res.rows[1]?.delta).toBe(2490.79);
    expect(res.rows[1]?.type).toBe("aporte");

    // Mês com delta 0 (Jan/2024)
    expect(res.rows[3]?.date).toBe("2024-01-31");
    expect(res.rows[3]?.delta).toBe(0);
    expect(res.rows[3]?.type).toBe("neutro");

    // Ano bissexto (Fev/2024)
    expect(res.rows[4]?.date).toBe("2024-02-29");
    expect(res.rows[4]?.delta).toBe(-248.54);
    expect(res.rows[4]?.type).toBe("resgate");

    // Ano comum (Fev/2025)
    expect(res.rows[16]?.date).toBe("2025-02-28");

    // Resgate significativo (Out/2024)
    expect(res.rows[12]?.date).toBe("2024-10-31");
    expect(res.rows[12]?.delta).toBe(-3124.11);
    expect(res.rows[12]?.type).toBe("resgate");

    // Totais consolidados
    expect(res.totalAportes).toBe(27137.56);
    expect(res.totalResgates).toBe(10335.53);
    expect(res.netCapital).toBe(16802.03);
    expect(res.finalGrossBalance).toBe(18192.4);

    // Marcos acionáveis não incluem os meses neutros
    expect(res.actionableRows.length).toBeLessThan(res.rows.length);
    for (const act of res.actionableRows) {
      expect(act.type).not.toBe("neutro");
      expect(Math.abs(act.delta)).toBeGreaterThan(0.01);
    }
  });

  it("trata linhas coladas com espaços simples ou barras (ex: 10/2023 6187.37)", () => {
    const text = `
      10/2023 6187.37
      11/2023 8678.16
    `;
    const res = parseBrokerStatement(text);
    expect(res.rows.length).toBe(2);
    expect(res.rows[0]?.date).toBe("2023-10-31");
    expect(res.rows[0]?.appliedValue).toBe(6187.37);
    expect(res.rows[1]?.date).toBe("2023-11-30");
    expect(res.rows[1]?.delta).toBe(2490.79);
  });
});
