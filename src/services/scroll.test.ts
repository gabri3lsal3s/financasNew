import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triggerSensory } from "./sensory";
import { scrollToTop } from "./scroll";

vi.mock("./sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("scrollToTop service", () => {
  beforeEach(() => {
    vi.mocked(triggerSensory).mockReset();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retorna false e não rola quando já está no topo", () => {
    const main = document.createElement("main");
    main.id = "main-content";
    main.scrollTop = 0;
    main.scrollTo = vi.fn();
    document.body.appendChild(main);

    const result = scrollToTop();
    expect(result).toBe(false);
    expect(main.scrollTo).not.toHaveBeenCalled();
    expect(triggerSensory).not.toHaveBeenCalled();
  });

  it("rola o contêiner main quando scrollTop > 0", () => {
    const main = document.createElement("main");
    main.id = "main-content";
    main.scrollTop = 150;
    main.scrollTo = vi.fn();
    document.body.appendChild(main);

    const result = scrollToTop({ sensoryFeedback: true });
    expect(result).toBe(true);
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(triggerSensory).toHaveBeenCalledWith("selection", { skipSound: true });
  });

  it("respeita prefers-reduced-motion usando behavior auto", () => {
    const main = document.createElement("main");
    main.id = "main-content";
    main.scrollTop = 200;
    main.scrollTo = vi.fn();
    document.body.appendChild(main);

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    scrollToTop();
    expect(main.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
