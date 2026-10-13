import { describe, expect, it } from "vitest";
import { loadEngine } from "./engine";

describe("uploaded calculator engines", () => {
  it("applies Blessing, manual HIT and loyal Poring bonuses", async () => {
    const e = await loadEngine();
    const build = { job: "Knight", baseLv: 99, jobLv: 50, stats: { str: 50, agi: 30, vit: 40, int: 1, dex: 30, luk: 1 }, equip: {}, skills: {} };
    const base = e.CalcStatus.compute(build, e.D);
    const blessed = e.CalcStatus.compute({ ...build, buffs: { AL_BLESSING: 10 } }, e.D);
    expect(blessed.str.total - base.str.total).toBe(10);
    expect(blessed.int.total - base.int.total).toBe(10);
    const bonus = e.CalcStatus.compute({ ...build, manual: { hit: 25 } }, e.D);
    expect(bonus.hit - base.hit).toBe(25);
    const pet = e.CalcStatus.compute({ ...build, pet: { mob: "PORING", loyal: true } }, e.D);
    expect(pet.luk.total - base.luk.total).toBe(2);
  });
  it("calculates damage from the uploaded Poring target", async () => {
    const e = await loadEngine();
    const poring = e.mobs.find((m) => m.key === "PORING");
    expect(poring?.hp).toBe(50);
    const status = e.CalcStatus.compute({ job: "Knight", baseLv: 99, jobLv: 50, stats: { str: 50, agi: 30, vit: 40, int: 1, dex: 30, luk: 1 } }, e.D);
    if (!poring) throw new Error("Missing Poring target");
    const damage = e.CalcBattle.compute(status, e.CalcBattle.targetFromMob(poring, e.D), null, e.D, {});
    expect(damage.total.avg).toBeGreaterThan(0);
    expect(damage.hitChance).toBeGreaterThan(0);
  });
});