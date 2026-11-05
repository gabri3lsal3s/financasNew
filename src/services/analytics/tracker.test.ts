import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tracker, trackFeatureUse } from "./tracker";
import * as analyticsRepo from "@/data/repositories/analytics";

describe("AnalyticsTracker (Telemetria)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(analyticsRepo, "logAnalyticsBatch").mockResolvedValue();
  });

  afterEach(() => {
    tracker.destroy();
  });

  it("registra eventos no buffer e realiza flush com dados sanitizados", async () => {
    tracker.track("expenses", "view_page", { count: 1 });
    await tracker.flush();

    expect(analyticsRepo.logAnalyticsBatch).toHaveBeenCalledWith([
      {
        module: "expenses",
        event_name: "view_page",
        metadata: { count: 1 },
      },
    ]);
  });

  it("trackFeatureUse despacha o evento através do singleton", async () => {
    trackFeatureUse("cards", "view_page");
    await tracker.flush();

    expect(analyticsRepo.logAnalyticsBatch).toHaveBeenCalledWith([
      {
        module: "cards",
        event_name: "view_page",
        metadata: {},
      },
    ]);
  });

  it("não realiza requisição ao efetuar flush com buffer vazio", async () => {
    await tracker.flush();
    expect(analyticsRepo.logAnalyticsBatch).not.toHaveBeenCalled();
  });
});
