/* Browser-only loader for the uploaded rAthena pre-renewal engine + game data. Call from effects/handlers only. */
export type RoItem = {
  id: number; key: string; name: string; type: string; sub?: string; loc?: string; slots?: number;
  jobs?: string[]; atk?: number; def?: number; mdef?: number; wlv?: number; eqlv?: number; drops?: [string, number][];
};
export type SktData = {
  skills: Record<string, { name: string; quest: boolean; max: number; type: string | null }>;
  jobs: Record<string, { inherit: string[]; tree: [string, number, [string, number][]][] }>;
};
export type Engine = {
  CalcBattle: { compute: (status: any, target: any, skill: any, data: any, settings: any) => any; targetFromMob: (mob: any, data: any) => any; attackSkills: (status: any, data: any) => { id: string; name: string; lv: number }[] };
  mobs: { key: string; name: string; lv: number; hp: number; race: string; size: string; element: string; elv: number; def: number; mdef: number }[];
  CalcStatus: {
    compute: (b: any, D: any) => any; validate: (b: any, D: any) => string[];
    BUFFS: { id: string; name: string; maxLv: number; group: string; kind: string; values?: string[] }[];
    SONG_CASTER: Record<string, number>; MANUAL_NUM: string[];
  };
  D: any;
  items: RoItem[];
  itemsByKey: Record<string, RoItem>;
  mobNames: Record<string, string>;
};

let enginePromise: Promise<Engine> | null = null;
let sktPromise: Promise<SktData> | null = null;

export function loadSkt() {
  sktPromise ??= import("./data/skt.json").then((m) => m.default as unknown as SktData);
  return sktPromise;
}

function run(src: string, req: (p: string) => unknown = () => ({})) {
  const module = { exports: {} as any };
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", "self", src)(module, module.exports, req, {});
  return module.exports;
}

export function loadEngine(): Promise<Engine> {
  enginePromise ??= (async () => {
    const [cd, sc, st, items, pets, mobs, SKT, battle, targets] = await Promise.all([
      import("./engine/calcdata.js.txt?raw"),
      import("./engine/calc-script.js.txt?raw"),
      import("./engine/calc-status.js.txt?raw"),
      import("./data/items.json"),
      import("./data/pets.json"),
      import("./data/mobnames.json"),
      loadSkt(),
      import("./engine/calc-battle.js.txt?raw"),
      import("./data/mobs.json"),
    ]);
    const CALCDATA = run(cd.default);
    const CalcScript = run(sc.default);
    const CalcStatus = run(st.default, () => CalcScript);
    const list = items.default as unknown as RoItem[];
    const itemsByKey = Object.fromEntries(list.map((i) => [i.key, i]));
    return {
      CalcStatus, CalcBattle: run(battle.default), mobs: targets.default as Engine["mobs"], items: list, itemsByKey, mobNames: mobs.default as Record<string, string>,
      D: { CALCDATA, items: itemsByKey, SKT, pets: pets.default },
    };
  })();
  return enginePromise;
}

export const SLOTS = [
  ["weapon", "Weapon"], ["left", "Shield"], ["headTop", "Upper headgear"], ["headMid", "Middle headgear"],
  ["headLow", "Lower headgear"], ["armor", "Armor"], ["garment", "Garment"], ["shoes", "Footgear"],
  ["acc1", "Accessory 1"], ["acc2", "Accessory 2"], ["ammo", "Ammo"],
] as const;

const CARD_SUB: Record<string, string> = {
  weapon: "Weapon", left: "Shield", headTop: "Headgear", headMid: "Headgear", headLow: "Headgear",
  armor: "Armor", garment: "Garment", shoes: "Footgear", acc1: "Accessory", acc2: "Accessory",
};

export function fitsSlot(i: RoItem, slot: string): boolean {
  const loc = i.loc ?? "";
  switch (slot) {
    case "weapon": return i.type === "Weapon";
    case "left": return loc === "Shield";
    case "headTop": return loc.startsWith("Upper");
    case "headMid": return loc.startsWith("Middle");
    case "headLow": return loc === "Lower Headgear";
    case "armor": return loc === "Armor";
    case "garment": return loc === "Garment";
    case "shoes": return loc === "Footgear";
    case "acc1": case "acc2": return loc === "Accessory";
    case "ammo": return i.type === "Ammunition";
  }
  return false;
}
export const cardFits = (c: RoItem, slot: string) => c.type === "Card" && c.sub === CARD_SUB[slot];
