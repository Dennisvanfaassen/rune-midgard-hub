import { describe, expect, it } from "vitest";
import { MAX_PARTY_SIZE, PARTY_TEMPLATES, canAddSlot, canTakeSlot, isPartyVisible } from "./jobs";

describe("party rules", () => {
  it("hides a party exactly one day after its scheduled time", () => {
    const start = "2026-10-13T20:00:00Z";
    expect(isPartyVisible(start, Date.parse("2026-10-14T19:59:59Z"))).toBe(true);
    expect(isPartyVisible(start, Date.parse("2026-10-14T20:00:00Z"))).toBe(false);
  });
  it("allows different classes to volunteer for mobber and tank roles", () => {
    expect(canTakeSlot("Mobber", "Knight")).toBe(true);
    expect(canTakeSlot("Mobber", "Crusader")).toBe(true);
    expect(canTakeSlot("Tank", "Monk")).toBe(true);
    expect(canTakeSlot("Priest", "Wizard")).toBe(false);
  });
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
