import { describe, it, expect } from "vitest";
import { toPlainPreview } from "../plain-preview";
describe("toPlainPreview", () => {
  it("strips markdown", () => {
    expect(toPlainPreview("## Why\n> **Start** with a _purpose_.\n- one\n1. [two](http://x)")).toBe("Why Start with a purpose. one two");
  });
  it("truncates", () => {
    expect(toPlainPreview("abcdef", 3)).toBe("abc…");
  });
  it("handles unclosed bold", () => {
    expect(toPlainPreview("**Start with a purpose")).toBe("Start with a purpose");
  });
});
