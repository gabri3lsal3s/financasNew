/**
 * Adaptadores de Módulos do Sistema — Conectores Isomórficos.
 */

export interface ModuleAdapter<TInput, TOutput> {
  name: string;
  adapt: (input: TInput) => TOutput;
}
