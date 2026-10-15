/**
 * Serviço de áudio sintetizado puro via Web Audio API (F11).
 * Zero arquivos de mídia externos / Zero overhead de rede.
 * Sons discretos e elegantes para cliques, confirmações e alertas.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      // @ts-expect-error fallback para navegadores legados
      window.webkitAudioContext;
    if (AudioContextClass) {
      try {
        audioCtx = new AudioContextClass();
      } catch {
        audioCtx = null;
      }
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export type SoundEffect = "click" | "success" | "pop" | "delete" | "warning" | "error";

export interface SoundOptions {
  volume?: number;
  force?: boolean;
}

function synthesizeEffect(effect: SoundEffect, volume: number): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    if (effect === "click") {
      // Micro-clique tátil suave (40ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.045);
    } else if (effect === "pop") {
      // Pequeno pop elástico (60ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.065);
    } else if (effect === "success") {
      // Acorde ascendente suave de confirmação (120ms)
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.035;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.13);
      });
    } else if (effect === "delete") {
      // Tom sutil descendente (80ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.085);
    } else if (effect === "warning") {
      // Bitom sutil de atenção/limite (90ms)
      [600, 480].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.045;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.045);
      });
    } else if (effect === "error") {
      // Tom sutil de erro/impedimento (100ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.105);
    }
  } catch {
    // Silencioso em caso de restrição de autoplay do navegador
  }
}

/**
 * Utilitário centralizado de controle de áudio (soundManager) com anti-concorrência e mute global.
 */
export class SoundManager {
  private muted = false;
  private defaultVolume = 0.08;
  private lastPlayedTime = 0;
  private lastEffectTime: Partial<Record<SoundEffect, number>> = {};

  private readonly minIntervalMs = 40;
  private readonly minSameEffectIntervalMs = 60;

  public mute(): void {
    this.muted = true;
  }

  public unmute(): void {
    this.muted = false;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public setVolume(vol: number): void {
    this.defaultVolume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.defaultVolume;
  }

  public reset(): void {
    this.muted = false;
    this.defaultVolume = 0.08;
    this.lastPlayedTime = 0;
    this.lastEffectTime = {};
  }

  public play(effect: SoundEffect, enabled = true, options?: SoundOptions | number): boolean {
    if (this.muted || !enabled || typeof window === "undefined") return false;

    const volume = typeof options === "number" ? options : options?.volume ?? this.defaultVolume;
    const force = typeof options === "object" ? options?.force ?? false : false;

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const isHighPriority =
      effect === "warning" || effect === "error" || effect === "delete" || effect === "success";

    // Anti-concorrência: evita sobreposição caótica de micro-sons repetitivos em cliques rápidos
    if (!force && !isHighPriority) {
      if (now - this.lastPlayedTime < this.minIntervalMs) {
        return false;
      }
      const lastSame = this.lastEffectTime[effect] ?? 0;
      if (now - lastSame < this.minSameEffectIntervalMs) {
        return false;
      }
    }

    this.lastPlayedTime = now;
    this.lastEffectTime[effect] = now;

    synthesizeEffect(effect, volume);
    return true;
  }
}

export const soundManager = new SoundManager();

export function playSound(effect: SoundEffect, enabled = true, volume = 0.08): void {
  soundManager.play(effect, enabled, { volume });
}
