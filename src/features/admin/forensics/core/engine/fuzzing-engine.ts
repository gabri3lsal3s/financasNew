/**
 * Motor Forense de Fuzzing de Schemas Zod (fuzzing-engine.ts).
 *
 * Gera vetores de teste adversariais, strings corrompidas, ataques de injeção XSS/HTML,
 * overflow de centavos, caracteres de controle e datas anômalas para testar a resiliência
 * dos schemas de validação de formulários da aplicação.
 * Conforme AGENTS.md (Funções puras, TypeScript estrito, sem emojis).
 */

import type { z } from "zod";
import type { FuzzingResult, FuzzingVector } from "./types";

export class FuzzingEngine {
  /**
   * Vetores de estresse exclusivos para campos de texto (XSS, nulos, overflow de tamanho).
   */
  public static getTextFuzzingVectors(): FuzzingVector[] {
    return [
      {
        id: "FUZZ-NULL-BYTE",
        description: "Injeção de caracteres nulos (Null Byte Injection) e controle",
        payload: "Nome\x00Invalido\x08Controle\x1F",
        expectedOutcome: "sanitize",
      },
      {
        id: "FUZZ-STORED-XSS",
        description: "Injeção de scripts e tags HTML (Stored XSS payload)",
        payload: "<script>alert('XSS')</script><img src=x onerror=alert(1)>",
        expectedOutcome: "sanitize",
      },
      {
        id: "FUZZ-STRING-LONG",
        description: "String com mais de 2.000 caracteres (Buffer/Memory Stress)",
        payload: "A".repeat(2500),
        expectedOutcome: "reject",
      },
      {
        id: "FUZZ-UNICODE-HOMOGLYPH",
        description: "Caracteres Unicode decorativos ou homóglifos proibidos",
        payload: ["Conta", String.fromCharCode(0x26a0), "VIP"].join(" "),
        expectedOutcome: "sanitize",
      },
    ];
  }

  /**
   * Vetores de estresse para campos numéricos/monetários (negativos, estouro de centavos).
   */
  public static getNumericFuzzingVectors(): FuzzingVector[] {
    return [
      {
        id: "FUZZ-MONEY-NEGATIVE",
        description: "Valores monetários negativos em campos estritamente positivos",
        payload: -500000,
        expectedOutcome: "reject",
      },
      {
        id: "FUZZ-MONEY-OVERFLOW",
        description: "Estouro de limite de centavos acima de 999 bilhões",
        payload: 999_999_999_999_999,
        expectedOutcome: "reject",
      },
    ];
  }

  /**
   * Coleção de vetores universais de ataque e estresse para campos textuais e numéricos.
   */
  public static getUniversalFuzzingVectors(): FuzzingVector[] {
    return [
      ...this.getTextFuzzingVectors(),
      ...this.getNumericFuzzingVectors(),
      {
        id: "FUZZ-DATE-ANOMALY",
        description: "Datas em formato inválido ou inexistente",
        payload: "2026-02-31",
        expectedOutcome: "reject",
      },
    ];
  }

  /**
   * Bateria de fuzzing especializada para campos textuais (XSS, nulos, overflow).
   */
  public static testTextField<T extends z.ZodTypeAny>(
    schema: T,
    baseValidData: Record<string, unknown>,
    targetFieldName: string,
  ): FuzzingResult[] {
    return this.testSchemaField(schema, baseValidData, targetFieldName, this.getTextFuzzingVectors());
  }

  /**
   * Bateria de fuzzing especializada para campos numéricos/monetários (negativos, estouro).
   */
  public static testNumericField<T extends z.ZodTypeAny>(
    schema: T,
    baseValidData: Record<string, unknown>,
    targetFieldName: string,
  ): FuzzingResult[] {
    return this.testSchemaField(schema, baseValidData, targetFieldName, this.getNumericFuzzingVectors());
  }

  /**
   * Executa a bateria de fuzzing contra um schema Zod específico,
   * aplicando cada vetor ao campo indicado e verificando a reação da validação.
   */
  public static testSchemaField<T extends z.ZodTypeAny>(
    schema: T,
    baseValidData: Record<string, unknown>,
    targetFieldName: string,
    customVectors?: FuzzingVector[],
  ): FuzzingResult[] {
    const vectors = customVectors ?? this.getUniversalFuzzingVectors();
    const results: FuzzingResult[] = [];

    for (const vector of vectors) {
      const testPayload = {
        ...baseValidData,
        [targetFieldName]: vector.payload,
      };

      const parseResult = schema.safeParse(testPayload);

      if (vector.expectedOutcome === "reject") {
        if (!parseResult.success) {
          results.push({
            vectorId: vector.id,
            description: vector.description,
            passed: true,
          });
        } else {
          results.push({
            vectorId: vector.id,
            description: vector.description,
            passed: false,
            errorFound: `Schema aceitou indevidamente o payload inválido: ${String(vector.payload).slice(0, 50)}`,
          });
        }
      } else if (vector.expectedOutcome === "sanitize") {
        if (parseResult.success) {
          const parsedRecord = parseResult.data as Record<string, unknown>;
          const sanitizedVal = parsedRecord[targetFieldName];

          // Verifica se removeu tags perigosas ou caracteres nulos
          const hasNullByte = typeof sanitizedVal === "string" && sanitizedVal.includes("\x00");
          const hasScript = typeof sanitizedVal === "string" && sanitizedVal.includes("<script>");

          if (hasNullByte || hasScript) {
            results.push({
              vectorId: vector.id,
              description: vector.description,
              passed: false,
              sanitizedValue: sanitizedVal,
              errorFound: "Falha de sanitização: caracteres perigosos mantidos após parse.",
            });
          } else {
            results.push({
              vectorId: vector.id,
              description: vector.description,
              passed: true,
              sanitizedValue: sanitizedVal,
            });
          }
        } else {
          // Rejeitar também é aceitável quando não sanitiza
          results.push({
            vectorId: vector.id,
            description: vector.description,
            passed: true,
            errorFound: "Schema optou por rejeitar em vez de sanitizar (comportamento seguro).",
          });
        }
      } else {
        // expect accept
        results.push({
          vectorId: vector.id,
          description: vector.description,
          passed: parseResult.success,
        });
      }
    }

    return results;
  }
}
