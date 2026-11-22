package com.guiafinanceiro.app;

import static org.junit.Assert.*;

import org.junit.Test;

public class NativeExportPluginTest {

    @Test
    public void testSanitizeFilename() {
        assertEquals("transacoes_2026.csv", NativeExportPlugin.sanitizeFilename("transacoes_2026.csv", "export"));
        assertEquals("etc_passwd.csv", NativeExportPlugin.sanitizeFilename("../../etc/passwd.csv", "export"));
        assertEquals("relatorio_2026_ok_.xls", NativeExportPlugin.sanitizeFilename("relatorio:2026?ok*.xls", "export"));
        assertEquals("export", NativeExportPlugin.sanitizeFilename("   ", "export"));
        assertEquals("fallback.bin", NativeExportPlugin.sanitizeFilename(null, "fallback.bin"));
    }

    @Test
    public void testSanitizeJobName() {
        assertEquals("AXIR_DRE_Agosto", NativeExportPlugin.sanitizeJobName("AXIR_DRE_Agosto.pdf"));
        assertEquals("Fatura_Nubank", NativeExportPlugin.sanitizeJobName("Fatura_Nubank.PDF"));
        assertEquals("Relatorio_Axir", NativeExportPlugin.sanitizeJobName("   "));
        assertEquals("Relatorio_Axir", NativeExportPlugin.sanitizeJobName(null));
    }

    @Test
    public void testNormalizeMimeType() {
        assertEquals("text/csv", NativeExportPlugin.normalizeMimeType("text/csv;charset=utf-8"));
        assertEquals("application/vnd.ms-excel", NativeExportPlugin.normalizeMimeType("application/vnd.ms-excel;charset=utf-8"));
        assertEquals("application/json", NativeExportPlugin.normalizeMimeType(" APPLICATION/JSON ; charset=utf-8 "));
        assertEquals("application/octet-stream", NativeExportPlugin.normalizeMimeType(""));
        assertEquals("application/octet-stream", NativeExportPlugin.normalizeMimeType(null));
    }
}
