/** Specific capabilities members can declare when signing up for a party role. */
export const PARTY_SPECIALIZATIONS: Record<string, readonly string[]> = {
  Mobber: ["Peco Mobber", "General Mobber", "High dodge mobber"],
  Bragi: ["Bragi", "Bragi & Kim"],
  Bard: ["Bragi", "Bragi & Kim"],
  Tapper: ["Single target", "Multi-target"],
  Trapper: ["Trapper"],
  Greed: ["Greed", "Greed + supply cart"],
  SP: ["SP song", "Potion pitcher", "SP song & Kim"],
  Wizard: ["Storm gust", "Storm gust + Quagmire", "Storm gust + LoV", "Stormgust, LoV + Quagmire"],
  Priest: ["Got warp to destination", "No warp to destination"],
};
export const partySpecializationsFor = (role: string): readonly string[] => PARTY_SPECIALIZATIONS[role] ?? [];
