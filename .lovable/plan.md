# Rune Midgard Guild Website

## Look and feel
Dark fantasy style that suits Ragnarok Online: deep navy background, gold highlights, a display serif for headings (Cinzel) and a clean body font. Guild crest and a header image get generated.

## Pages
- **Home**: guild intro, upcoming parties, newest members.
- **Sign in / Sign up**: email and password, plus Google. Members need an account to create parties, join, and save builds.
- **Members**: grid of all members (name, class, level). Click a member to open their profile.
- **Member profile**: their saved stat build, skill build, and gear wishlist. Each gear item shows "I have this" or "I still need this", so others can see what to help hunt. Only the owner can change their own list.
- **Party Planner**:
  - Create a party: title, date, time, place (map or dungeon), notes, and up to 12 slots.
  - Templates fill in the core roles automatically, e.g. "MVP Party" (Priest, Wizard, Knight, Hunter...), "Leveling Party", "WoE Squad". The creator can then edit slots.
  - Members join a free slot by choosing their class. Full slots and the 12-member cap are enforced.
  - List of upcoming parties, and a detail page per party.
- **Stat Calculator**: pick class, base and job level, set STR/AGI/VIT/INT/DEX/LUK, and equip gear. It shows HP, SP, ATK, MATK, DEF, Hit, Flee, Crit and ASPD. It uses your uploaded calculator engine and game data (pre-renewal rAthena formulas). You can save the result to your profile.
- **Skill Simulator**: pick a class and spend skill points in a skill tree that follows prerequisites and point limits. Uses the skill data from your files. You can save it to your profile.

## Technical details
- Lovable Cloud for accounts, profiles, parties, party slots, gear wishlists, and saved builds, with access rules so users can only edit their own data.
- The uploaded engine files (data, script, status, battle) are copied into the project as plain modules and loaded only in the browser on the calculator pages. The big game data file (about 3 MB) is loaded lazily, only on the calculator and skill pages.
- Party size is capped at 12 in the app and in the database, with a test for it.
- Each page gets its own address and page title.

## Not included in the first version
- Damage calculator against monsters (the engine supports it, so it can be added later).
- Discord integration and guild ranks/admin roles (can be added later).
