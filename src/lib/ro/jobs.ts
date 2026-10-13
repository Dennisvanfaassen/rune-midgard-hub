export const JOBS = [
  "Novice", "Swordman", "Mage", "Archer", "Acolyte", "Merchant", "Thief",
  "Knight", "Priest", "Wizard", "Blacksmith", "Hunter", "Assassin",
  "Crusader", "Monk", "Sage", "Rogue", "Alchemist", "Bard", "Dancer", "Supernovice",
] as const;
export type Job = (typeof JOBS)[number];

export const jobName = (j: string) => (j === "Supernovice" ? "Super Novice" : j);

export const MAX_PARTY_SIZE = 12;
export const PARTY_ROLES = ["Any", "Tank", "Mobber", "Tapper", "SP", "Bragi", "Other"];
export const PARTY_VISIBLE_FOR_MS = 4 * 60 * 60 * 1000;
export const partyCutoff = (now = Date.now()) => new Date(now - PARTY_VISIBLE_FOR_MS).toISOString();
export const isPartyVisible = (startsAt: string, now = Date.now()) => new Date(startsAt).getTime() + PARTY_VISIBLE_FOR_MS > now;

/** Party time shown in the viewer's own timezone. */
export const formatPartyTime = (startsAt: string) =>
  new Date(startsAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

/** "Party starts in 1 hour and 12 minutes" relative to the viewer's clock. */
export const partyCountdown = (startsAt: string, now = Date.now()) => {
  const mins = Math.round((new Date(startsAt).getTime() - now) / 60000);
  if (mins <= 0) return mins > -PARTY_VISIBLE_FOR_MS / 60000 ? "Party has started" : "Party has ended";
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const part = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const bits = [d && part(d, "day"), h && part(h, "hour"), m && part(m, "minute")].filter(Boolean) as string[];
  return `Party starts in ${bits.length > 1 ? bits.slice(0, -1).join(", ") + " and " + bits.at(-1) : bits[0]}`;
};

/** Item name with card slot count, e.g. "Sword [3]". */
export const itemLabel = (i: { name: string; slots?: number | null }) => (i.slots ? `${i.name} [${i.slots}]` : i.name);

export type PartyTemplate = { id: string; name: string; description: string; roles: string[] };

export const PARTY_TEMPLATES: PartyTemplate[] = [
  { id: "stala", name: "Stala", description: "Priest, Hunter, Wizard and flexible support roles.", roles: ["Priest", "Hunter", "Wizard", "SP", "Bragi", "Tank", "Tapper", "Mobber", "Other"] },
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
export const canTakeSlot = (role: string, job: string) => PARTY_ROLES.includes(role) || role === job;
