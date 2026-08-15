/** Presets de peso no relatório (frações 0–1) — separados do componente p/ react-refresh. */
export const REPORT_WEIGHT_PRESETS = [1, 0.75, 0.5, 0.25, 0];

export const REPORT_WEIGHT_OPTIONS = [
  { value: "1", label: "100% (conta integralmente)" },
  { value: "0.75", label: "75%" },
  { value: "0.5", label: "50%" },
  { value: "0.25", label: "25%" },
  { value: "0", label: "Não contar nos relatórios (0%)" },
  { value: "custom", label: "Personalizado (definir valor em R$)…" },
];
