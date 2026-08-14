import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";

function Broken() {
  return (
    <div>
      <img src="x.png" />
      <button />
      <div role="button">ok</div>
      <a href="#x">link</a>
    </div>
  );
}

describe("sanity", () => {
  it("detects violations", async () => {
    const { container } = render(<Broken />);
    const results = await axe(container);
    const ids = results.violations.map((v) => v.id);
    expect(ids).toContain("image-alt");
    expect(ids).toContain("button-name");
  });
});
