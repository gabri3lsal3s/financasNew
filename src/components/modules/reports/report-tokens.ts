/**
 * Escala Canônica de Espaçamento e Ritmo Visual para Relatórios A4 / PDF (Design System Axir).
 * Fonte Única da Verdade (SSOT) para manter o Selo 10/10.
 */
export const REPORT_SPACING = {
  /** Distância da barra do cabeçalho da Capa (ReportHeader/ReportCoverHeader) até o 1º bloco (14px). */
  afterCoverHeader: "mb-3.5 print:mb-3.5",
  /** Distância da barra do Running Header até o conteúdo em páginas 2+ (12px). */
  afterRunningHeader: "mb-3 print:mb-3",
  /** Espaço vertical entre seções principais (H2 distintos) (16px / 12px print). */
  sectionGap: "gap-4 print:gap-3",
  /** Espaço vertical entre sub-blocos irmãos (KPIs -> gráfico -> tabela) (10px–12px). */
  blockGap: "gap-2.5 print:gap-2",
  /** Espaço entre um título de seção (H2/H3) e sua tabela/gráfico (6px). */
  titleToContent: "pb-1.5 mb-1.5",
  /** Padding interno das células em tabelas densas e normais. */
  tableCellDensity: {
    normal: "py-1.5 px-2.5",
    dense: "py-1 px-2",
    ultraDense: "py-0.5 px-1.5",
  },
} as const;

export type ReportSpacing = typeof REPORT_SPACING;
