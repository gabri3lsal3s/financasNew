/**
 * Contratos de Validadores de Invariantes Matemáticos e Contábeis.
 */

import type { AuditModule, InvariantResult } from "../types";

export interface InvariantAssertion<in TContext = never> {
  id: string;
  name: string;
  module: AuditModule;
  description: string;
  execute: (context: TContext) => InvariantResult;
}

export interface InvariantSuite {
  name: string;
  module: AuditModule;
  assertions: readonly InvariantAssertion<never>[];
}
