import { describe, expect, it } from "vitest";
import { itemDisplay } from "./slots";
import { formatZeny } from "@/lib/forum";

describe("item names and prices", () => {
  it("tells slotted and unslotted Manteau apart", () => {
    expect(itemDisplay("Manteau_", "Manteau")).toBe("Manteau [1]");
    expect(itemDisplay("Manteau", "Manteau")).toBe("Manteau");
  });
  it("does not double the slot suffix", () => {
    expect(itemDisplay("Manteau_", "Manteau [1]")).toBe("Manteau [1]");
  });
  it("formats zeny prices", () => {
    expect(formatZeny(1500000)).toBe("1,500,000 z");
  });
});
