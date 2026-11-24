import { describe, expect, it } from "vitest";
import { calculateMeiAnnualLimit } from "./mei-limit";

describe("mei-limit (Termômetro Anual MEI)", () => {
  it("calcula utilização e marcos de alerta (70%, 85%, 100%, 120%) ignorando aportes internos", () => {
    const res70 = calculateMeiAnnualLimit({
      annualIncomes: [
        { value: 56700, date: "2026-06-01", scope: "business", is_internal_transfer: false },
        { value: 20000, date: "2026-06-02", scope: "business", is_internal_transfer: true },
      ],
      annualCeilingCents: 8_100_000,
      currentMonthIndex: 6,
      year: 2026,
    });
    expect(res70.usagePct).toBe(70);
    expect(res70.alertLevel).toBe("attention");
    expect(res70.remainingCents).toBe(2_430_000);
    expect(res70.remainingMonths).toBe(7);

    const res100 = calculateMeiAnnualLimit({
      annualIncomes: [{ value: 81000, date: "2026-08-01", scope: "business" }],
    });
    expect(res100.alertLevel).toBe("ceiling_reached");

    const res120 = calculateMeiAnnualLimit({
      annualIncomes: [{ value: 97200, date: "2026-10-01", scope: "business" }],
    });
    expect(res120.alertLevel).toBe("tolerance_exceeded");
  });
});
