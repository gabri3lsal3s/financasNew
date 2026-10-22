import { describe, expect, it } from "vitest";
import {
  applyFeedback,
  getDismissReason,
  isOccurrenceIgnored,
  partitionFeedback,
  QUALIFIED_DISMISS_OPTIONS,
  type FeedbackMap,
} from "./feedback";

describe("feedback domain", () => {
  describe("isOccurrenceIgnored", () => {
    it("retorna true para decisões de descarte", () => {
      expect(isOccurrenceIgnored("ignore")).toBe(true);
      expect(isOccurrenceIgnored("already_cancelled")).toBe(true);
      expect(isOccurrenceIgnored("one_off")).toBe(true);
      expect(isOccurrenceIgnored("not_subscription")).toBe(true);
    });

    it("retorna false para confirm ou valores vazios", () => {
      expect(isOccurrenceIgnored("confirm")).toBe(false);
      expect(isOccurrenceIgnored(null)).toBe(false);
      expect(isOccurrenceIgnored(undefined)).toBe(false);
    });
  });

  describe("getDismissReason", () => {
    it("extrai o motivo qualificado se for um deles", () => {
      expect(getDismissReason("already_cancelled")).toBe("already_cancelled");
      expect(getDismissReason("one_off")).toBe("one_off");
      expect(getDismissReason("not_subscription")).toBe("not_subscription");
      expect(getDismissReason("ignore")).toBeUndefined();
      expect(getDismissReason("confirm")).toBeUndefined();
      expect(getDismissReason(null)).toBeUndefined();
    });
  });

  describe("QUALIFIED_DISMISS_OPTIONS", () => {
    it("contém exatamente as 3 opções qualificadas canônicas", () => {
      const reasons = QUALIFIED_DISMISS_OPTIONS.map((o) => o.reason);
      expect(reasons).toEqual(["already_cancelled", "one_off", "not_subscription"]);
      expect(QUALIFIED_DISMISS_OPTIONS.every((o) => o.label && o.description && o.badgeLabel)).toBe(true);
    });
  });

  describe("applyFeedback", () => {
    it("filtra itens ignorados por qualquer motivo e marca confirmados", () => {
      const items = [
        { key: "item-1", name: "Netflix" },
        { key: "item-2", name: "Spotify" },
        { key: "item-3", name: "Almoço" },
        { key: "item-4", name: "Uber" },
      ];

      const feedback: FeedbackMap = {
        "item-1": "confirm",
        "item-2": "already_cancelled",
        "item-3": "one_off",
      };

      const result = applyFeedback(items, feedback);

      expect(result).toHaveLength(2);
      expect(result.find((i) => i.key === "item-1")?.confirmed).toBe(true);
      expect(result.find((i) => i.key === "item-4")?.confirmed).toBe(false);
      expect(result.find((i) => i.key === "item-2")).toBeUndefined();
      expect(result.find((i) => i.key === "item-3")).toBeUndefined();
    });
  });

  describe("partitionFeedback", () => {
    it("separa ocorrências em ativas e ignoradas com dismissReason correto", () => {
      const items = [
        { key: "item-1", name: "Netflix" },
        { key: "item-2", name: "Spotify" },
        { key: "item-3", name: "Almoço" },
        { key: "item-4", name: "Academia" },
      ];

      const feedback: FeedbackMap = {
        "item-1": "confirm",
        "item-2": "already_cancelled",
        "item-3": "not_subscription",
        "item-4": "ignore",
      };

      const { active, ignored } = partitionFeedback(items, feedback);

      expect(active).toHaveLength(1);
      expect(active[0]?.key).toBe("item-1");
      expect(active[0]?.confirmed).toBe(true);

      expect(ignored).toHaveLength(3);
      expect(ignored.find((i) => i.key === "item-2")?.dismissReason).toBe("already_cancelled");
      expect(ignored.find((i) => i.key === "item-3")?.dismissReason).toBe("not_subscription");
      expect(ignored.find((i) => i.key === "item-4")?.dismissReason).toBeUndefined();
    });
  });
});
