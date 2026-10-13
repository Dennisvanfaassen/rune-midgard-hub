import { describe, expect, it } from "vitest";
import { MAX_PARTY_SIZE, PARTY_TEMPLATES, canAddSlot, canTakeSlot } from "./jobs";

describe("party rules", () => {
  it("caps a party at 12 members", () => {
    expect(MAX_PARTY_SIZE).toBe(12);
    expect(canAddSlot(11)).toBe(true);
    expect(canAddSlot(12)).toBe(false);
  });
  it("no template exceeds 12 slots", () => {
    for (const t of PARTY_TEMPLATES) expect(t.roles.length).toBeLessThanOrEqual(12);
  });
  it("class slots only accept that class, Any accepts all", () => {
    expect(canTakeSlot("Priest", "Wizard")).toBe(false);
    expect(canTakeSlot("Priest", "Priest")).toBe(true);
    expect(canTakeSlot("Any", "Wizard")).toBe(true);
  });
});
