# Party Queue

Party Queue at `/queue` complements the existing Party Planner. Members use their existing profile character to announce they are ready now, choose an activity and functional role, and optionally add a destination and note. Character names can be copied for an in-game whisper. It does not create or invite an in-game party, assume an EXP-sharing range, or impose a WoW tank/healer composition.

## Activation in the existing Lovable Cloud project

1. Let the connected `main` branch sync into the existing Rune Midgard project.
2. Apply `drizzle/migrations/0019_party_queue.sql` **once** in that project's database SQL editor. It uses the existing `profiles` table and authentication. The repository's later SQL migrations are manually applied; adding the file to GitHub does not apply it to Cloud. Do not use `drizzle push` against the intentionally blank generated schema.
3. Confirm `public.party_queue` is in the `supabase_realtime` publication. The migration adds it when that publication exists. If Realtime is unavailable, the UI falls back to a 15-second refresh and explicitly shows that state.
4. Preview `/queue` with two signed-in guild accounts using the acceptance checks below. Publish through the project's normal Lovable workflow after validating the live database.

No additional credentials, service-role key, second database, or new auth provider are required. Missing migration errors show a friendly activation notice; the rest of the hub remains usable.

## Behavior and boundaries

- Episode 6 includes Novice, the six first jobs, all six 2-1 jobs, and Crusader, Monk, Sage, Rogue, Alchemist, Bard and Dancer. Shared `EPISODE_6_JOBS` derives from `JOBS`; existing Supernovice profiles and the calculation engine remain intact, but cannot join this queue.
- Membership follows the current hub's model: an authenticated account with a profile. The existing role function defaults to Guildmember; the project does not currently have a separate approved-member flag. A future approval workflow must also update the queue authorization.
- One entry per account, for one hour. An explicit extension renews availability to one hour from the database's current time. Leave, sign-out (best effort), or expiry removes the player from the active snapshot. Closing a tab does not immediately remove an entry; it expires after the displayed deadline.
- The database derives character identity/class/level from the authenticated user's profile. Clients cannot write queue rows directly. Profile row locks serialize account transitions; unique keys prevent duplicate membership. Retry joins preserve the entry ID and joining time. Stale leave/extend requests cannot alter a new entry.
- Leaving and rejoining within 15 seconds is throttled. Expired entries cannot be renewed; members must join again.
- Visual arrival popups are enabled while queued, on every page. A preference also enables arrival popups when not queued. Initial snapshots, old arrivals after an outage, one's own arrival, and renewals do not trigger a popup. Arrivals still available within the last two minutes are eligible.
- Sound requires a deliberate Enable / test sound click for the current browser visit. Volume and mute are available. Desktop notifications require permission; the in-page popup remains available when permission is refused. Desktop notification text omits character details.
- Keep a hub tab open for alerts. This implementation does **not** include closed-browser Web Push or Discord messages. Browser suspension, network loss and OS settings may delay alerts. The database remains authoritative.
- Preferences are scoped to the account in local storage. Web Locks plus a bounded local-storage receipt list deduplicate cross-tab alerts; older browsers without Web Locks use best-effort deduplication. Storage restrictions may permit duplicates. This is not a guarantee of exactly-once delivery.
- The queue resynchronizes after Realtime subscription/reconnection, network recovery and focus. It also polls every 15 seconds. Subscriptions, timers, popups and audio are cleaned up when the account changes or logs out.

## Verification

Use the existing lockfile: `bun install --frozen-lockfile`, then `bun run test` and `bun run build`.

The isolated database suite uses PGlite 0.5.11 (PostgreSQL) and never connects to a live database. On a development machine with Node:

```sh
npm install --prefix /tmp/rune-queue-db --no-save @electric-sql/pglite@0.5.11
PGLITE_MODULE=/tmp/rune-queue-db/node_modules/@electric-sql/pglite/dist/index.js node --test scripts/party-queue-db.test.mjs
```

Database checks cover anonymous/nonmember denial, two member identities, profile-derived values, retry idempotency, forbidden direct writes, cross-user leave/extend, expiry, stale entry IDs, malformed input and all 2-2 classes. PGlite uses a single connection: these tests do not prove concurrent transactions on hosted PostgreSQL or actual Supabase Realtime delivery.

## Live acceptance checks

1. Open two separate authenticated browser profiles with valid Episode 6 characters. A joins; B sees A. B joins; A gets one arrival popup with B's class and level.
2. Navigate A to another hub page before B rejoins (after 15 seconds). Verify the popup there and its View available guildmates action.
3. Open a second tab for A. Confirm only one popup/sound for a new arrival, refresh without replay, and leave/rejoin without duplicate membership.
4. Enable and test audio; try muted audio, denied browser permission, a hidden tab and a closed tab. Closed tabs should not be expected to notify.
5. Leave and extend availability. Check the other account updates, and an expired entry cannot be extended. Disconnect/reconnect and confirm resynchronization without old popups.
6. Try a signed-out account, an account without a profile, unsupported classes, missing character names and forged row writes. Confirm rejection on the database, not only the form.
7. Check keyboard controls and 390px/768px/desktop widths. Confirm the existing Party Planner, templates, signups and 12-slot limit are unchanged.

## Initial implementation validation (2026-10-25)

- Vitest: 27 tests passed, including the existing tests, queue eligibility, notification baselines/deduplication, overlapping cross-tab batches, popup controls and route regression tests.
- Isolated PostgreSQL: all 11 database tests passed.
- Production build: passed using the repository's frozen Bun lockfile dependencies.
- Local Chromium: 14 checks passed: signed-out gate, two isolated accounts joining, arrival popup, refetch/reload deduplication, filters, extension and leave flows, user-activated audio, site-wide alerts on the existing Party Planner, and deduplication between tabs sharing an account. Tests use an isolated PGlite database with a simulated auth/PostgREST interface. Desktop and 390px mobile screenshots were inspected; 390px and 768px layouts have no horizontal overflow. These are local browser tests, not verification of hosted Supabase Realtime or actual OS notification delivery.
- New queue files: ESLint passed with one standard Fast Refresh warning for the exported context hook, matching the existing AuthProvider pattern.
- Whole-project TypeScript check: one **pre-existing** `exactOptionalPropertyTypes` error in `src/components/MvpKillDialog.tsx:48`. Reproduced against an untouched baseline with the same locked dependencies; no new queue type errors.
- Live migration, hosted multi-account Realtime/notification delivery and publication: not verified without access to the existing Lovable Cloud database and authenticated guild sessions.

Official references checked during implementation: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [MDN Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API), [MDN autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [TanStack Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), and [PGlite](https://pglite.dev/docs/).
