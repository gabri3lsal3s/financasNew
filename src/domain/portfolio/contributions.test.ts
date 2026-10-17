import { describe, expect, it } from "vitest";
import {
  contributionsInMonthCents,
  contributionsMonthlySeries,
  sumContributionsCents,
} from "./contributions";

describe("domain/portfolio/contributions", () => {
  const contributions = [
    { amount: 500, date: "2026-08-05" },
    { amount: 1500.5, date: "2026-08-20" },
    { amount: 1000, date: "2026-07-10" },
  ];

  describe("sumContributionsCents", () => {
    it("returns 0 for empty array", () => {
      expect(sumContributionsCents([])).toBe(0);
    });

    it("sums all contributions in integer cents", () => {
      expect(sumContributionsCents(contributions)).toBe(300050); // R$ 3.000,50
    });
  });

  describe("contributionsInMonthCents", () => {
    it("filters and sums contributions for specific month", () => {
      expect(contributionsInMonthCents(contributions, "2026-08")).toBe(200050);
      expect(contributionsInMonthCents(contributions, "2026-07")).toBe(100000);
      expect(contributionsInMonthCents(contributions, "2026-09")).toBe(0);
    });
  });

  describe("contributionsMonthlySeries", () => {
    it("generates monthly series for given list of months", () => {
      const months = ["2026-06", "2026-07", "2026-08", "2026-09"];
      expect(contributionsMonthlySeries(contributions, months)).toEqual([0, 100000, 200050, 0]);
    });
  });
});
