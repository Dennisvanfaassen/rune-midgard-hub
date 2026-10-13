export const JOBS = [
  "Novice", "Swordman", "Mage", "Archer", "Acolyte", "Merchant", "Thief",
  "Knight", "Priest", "Wizard", "Blacksmith", "Hunter", "Assassin",
  "Crusader", "Monk", "Sage", "Rogue", "Alchemist", "Bard", "Dancer", "Supernovice",
] as const;
export type Job = (typeof JOBS)[number];

export const jobName = (j: string) => (j === "Supernovice" ? "Super Novice" : j);

export const MAX_PARTY_SIZE = 12;

export type PartyTemplate = { id: string; name: string; description: string; roles: string[] };

export const PARTY_TEMPLATES: PartyTemplate[] = [
  { id: "mvp", name: "MVP Hunt", description: "Full party for boss hunting.",
    roles: ["Knight", "Crusader", "Priest", "Priest", "Wizard", "Wizard", "Hunter", "Bard", "Dancer", "Blacksmith", "Sage", "Any"] },
  { id: "woe", name: "WoE Squad", description: "War of Emperium team.",
    roles: ["Priest", "Priest", "Priest", "Wizard", "Wizard", "Wizard", "Knight", "Knight", "Crusader", "Bard", "Dancer", "Sage"] },
  { id: "dungeon", name: "Dungeon Run", description: "Small core group for dungeons.",
    roles: ["Knight", "Priest", "Wizard", "Assassin", "Blacksmith"] },
  { id: "leveling", name: "Leveling Party", description: "Tank, healer, damage and open spots.",
    roles: ["Knight", "Priest", "Wizard", "Hunter", "Any", "Any"] },
  { id: "custom", name: "Custom", description: "Start empty and add your own slots.", roles: ["Any"] },
];

/** Can one more slot be added to a party that already has `count` slots? */
export const canAddSlot = (count: number) => count < MAX_PARTY_SIZE;

/** Can a player of `job` take a slot that asks for `role`? */
export const canTakeSlot = (role: string, job: string) => role === "Any" || role === job;
