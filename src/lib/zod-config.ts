import { z } from "zod";

/**
 * Desativa a compilação JIT via `new Function()` no Zod v4 para respeitar
 * a política CSP estrita sem `'unsafe-eval'` (`public/_headers`).
 */
z.config({ jitless: true });
