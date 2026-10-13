import { describe, expect, it } from "vitest";
import { MAX_PARTY_SIZE, PARTY_TEMPLATES, canAddSlot, canTakeSlot, isPartyVisible, partyCountdown, itemLabel } from "./jobs";

describe("party rules", () => {
  it("hides a party exactly 4 hours after its scheduled time", () => {
    const start = "2026-10-13T20:00:00Z";
    expect(isPartyVisible(start, Date.parse("2026-10-13T23:59:59Z"))).toBe(true);
    expect(isPartyVisible(start, Date.parse("2026-10-14T00:00:00Z"))).toBe(false);
  });
  it("shows a countdown to the party start", () => {
    expect(partyCountdown("2026-10-13T20:00:00Z", Date.parse("2026-10-13T18:48:00Z"))).toBe("Party starts in 1 hour and 12 minutes");
  });
  it("adds the slot count to slotted item names", () => {
    expect(itemLabel({ name: "Sword", slots: 3 })).toBe("Sword [3]");
    expect(itemLabel({ name: "Cap", slots: 0 })).toBe("Cap");
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
