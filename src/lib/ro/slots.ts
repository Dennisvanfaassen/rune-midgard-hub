import slots from "./data/slots.json";

const SLOTS = slots as Record<string, number>;

/** Display name for a saved item: adds "[n]" from the item database so slotted and unslotted versions differ. */
export function itemDisplay(key: string | null | undefined, name: string) {
  const base = name.replace(/\s*\[\d\]$/, "");
  const n = key ? SLOTS[key] : 0;
  return n ? `${base} [${n}]` : base;
}
