import { describe, expect, it } from "vitest";
import {
  PLAN_COMPARISON_ROWS,
  PRO_BENEFITS_CATALOG,
  PRO_CHECKOUT_BENEFITS,
  PRO_SUCCESS_HIGHLIGHTS,
  PRO_TRIAL_HIGHLIGHTS,
} from "./benefits";

describe("subscription benefits SSOT", () => {
  it("includes business mode and AI intelligence in the Pro catalog", () => {
    const ids = PRO_BENEFITS_CATALOG.map((item) => item.id);
    expect(ids).toContain("ai-intelligence");
    expect(ids).toContain("business-mode");
  });

  it("exposes non-empty derived lists for checkout, trial, comparison and success", () => {
    expect(PRO_CHECKOUT_BENEFITS).toHaveLength(PRO_BENEFITS_CATALOG.length);
    expect(PRO_TRIAL_HIGHLIGHTS.length).toBeGreaterThanOrEqual(5);
    expect(PRO_SUCCESS_HIGHLIGHTS).toHaveLength(4);
    expect(PLAN_COMPARISON_ROWS.length).toBe(PRO_BENEFITS_CATALOG.length + 3);
  });
});
