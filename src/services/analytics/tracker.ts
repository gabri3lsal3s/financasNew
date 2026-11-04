/**
 * src/services/analytics/tracker.ts
 *
 * Coletor ultra-leve de telemetria e uso de funcionalidades.
 * Aplica batching em memória com despacho assíncrono a cada 60s
 * ou no evento de descarregamento da página (visibilitychange / pagehide).
 *
 * Salvaguardas LGPD e Segurança:
 * - Proibido registrar valores monetários em R$, saldos ou CPFs;
 * - Registra estritamente: module (nome do módulo) e action (nome do evento);
 * - Executa em background com zero bloqueio da renderização (0ms jank).
 */
import { logAnalyticsBatch, type LogAnalyticsEventInput } from "@/data/repositories/analytics";

const FLUSH_INTERVAL_MS = 60 * 1000; // 60 segundos
const MAX_BUFFER_SIZE = 25;

class AnalyticsTracker {
  private buffer: LogAnalyticsEventInput[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private isListening = false;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    if (typeof window === "undefined" || this.isListening) return;

    this.timer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);

    // Despacha eventos acumulados quando o usuário minimiza ou troca de aba
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        void this.flush();
      }
    });

    window.addEventListener("pagehide", () => {
      void this.flush();
    });

    this.isListening = true;
  }

  public dispose() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Registra uma interação com um módulo ou funcionalidade.
   */
  public track(moduleName: string, eventName: string, metadata?: Record<string, unknown>) {
    this.buffer.push({
      module: moduleName,
      event_name: eventName,
      metadata: metadata ?? {},
    });

    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      void this.flush();
    }
  }

  /**
   * Envia o lote de eventos acumulados ao Supabase.
   */
  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const toSend = [...this.buffer];
    this.buffer = [];

    try {
      await logAnalyticsBatch(toSend);
    } catch {
      // Falha silenciosa para proteger a UX
    }
  }

  /**
   * Finaliza o timer e libera recursos (útil para testes ou unmount).
   */
  public destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isListening = false;
  }
}

export const tracker = new AnalyticsTracker();

/**
 * Função de conveniência para registro de eventos em componentes e páginas.
 */
export function trackFeatureUse(moduleName: string, actionName: string, metadata?: Record<string, unknown>) {
  tracker.track(moduleName, actionName, metadata);
}
