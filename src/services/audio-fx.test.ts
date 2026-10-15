import { beforeEach, describe, expect, it } from "vitest";
import { playSound, soundManager, SoundManager } from "./audio-fx";

describe("audio-fx (F11)", () => {
  beforeEach(() => {
    soundManager.reset();
    soundManager.unmute();
    soundManager.setVolume(0.3);
  });

  it("não falha quando o áudio está desativado", () => {
    expect(() => playSound("click", false)).not.toThrow();
  });

  it("aceita os diferentes tipos de efeito sonoro sem lançar erro", () => {
    expect(() => playSound("click", true)).not.toThrow();
    expect(() => playSound("pop", true)).not.toThrow();
    expect(() => playSound("success", true)).not.toThrow();
    expect(() => playSound("delete", true)).not.toThrow();
    expect(() => playSound("warning", true)).not.toThrow();
    expect(() => playSound("error", true)).not.toThrow();
  });

  describe("SoundManager", () => {
    it("controla mudo global corretamente (mute, unmute, toggleMute)", () => {
      const manager = new SoundManager();
      expect(manager.isMuted()).toBe(false);

      manager.mute();
      expect(manager.isMuted()).toBe(true);
      expect(manager.play("click", true)).toBe(false);

      manager.unmute();
      expect(manager.isMuted()).toBe(false);

      const toggled = manager.toggleMute();
      expect(toggled).toBe(true);
      expect(manager.isMuted()).toBe(true);

      const toggledBack = manager.toggleMute();
      expect(toggledBack).toBe(false);
      expect(manager.isMuted()).toBe(false);
    });

    it("respeita o volume configurado", () => {
      const manager = new SoundManager();
      expect(manager.getVolume()).toBe(0.08);

      manager.setVolume(0.8);
      expect(manager.getVolume()).toBe(0.8);

      // Clamp entre 0 e 1
      manager.setVolume(1.5);
      expect(manager.getVolume()).toBe(1);

      manager.setVolume(-0.5);
      expect(manager.getVolume()).toBe(0);
    });

    it("aplica throttle anti-concorrência para cliques rápidos consecutivos do mesmo efeito", () => {
      const manager = new SoundManager();
      // Primeiro disparo passa
      const first = manager.play("click", true);
      expect(first).toBe(true);

      // Segundo disparo imediato do mesmo efeito é barrado pelo throttle
      const second = manager.play("click", true);
      expect(second).toBe(false);

      // Efeitos urgentes (warning, error, delete) furam throttle se necessário
      const urgent = manager.play("warning", true, { force: true });
      expect(urgent).toBe(true);
    });

    it("reset limpa o histórico de timestamps", () => {
      const manager = new SoundManager();
      manager.play("click", true);
      expect(manager.play("click", true)).toBe(false);

      manager.reset();
      // Após reset, pode tocar novamente sem esperar intervalo
      expect(manager.play("click", true)).toBe(true);
    });
  });
});

