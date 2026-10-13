export const FORUM_CATEGORIES = [
  { id: "guides", name: "Guides", description: "Leveling routes, quests, MVP strategies" },
  { id: "builds", name: "Builds", description: "Stat and skill builds, gear setups" },
  { id: "general", name: "General", description: "Guild news and discussion" },
  { id: "trading", name: "Trading", description: "Price checks and trade talk" },
  { id: "off-topic", name: "Off-topic", description: "Anything else" },
] as const;
export const categoryName = (id: string) => FORUM_CATEGORIES.find((c) => c.id === id)?.name ?? id;

/** Formats a zeny amount, e.g. 1500000 -> "1,500,000 z". */
export const formatZeny = (n: number) => `${Math.round(n).toLocaleString("en-US")} z`;
