// Isolated PostgreSQL tests. Never connects to a real Supabase/production project.
// Install @electric-sql/pglite separately and point PGLITE_MODULE at dist/index.js.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const outsider = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
async function login(id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
async function join(activity = "Leveling", role = "Any", location = "", note = "") {
  return (await db.query("select public.party_queue_join($1,$2,$3,$4) as id", [activity, role, location, note])).rows[0].id;
}
async function snapshot() { return (await db.query("select public.party_queue_snapshot() as data")).rows[0].data; }
async function expire(id) {
  await db.exec("reset role");
  await db.query("update public.party_queue set expires_at=now()-interval '1 minute', joined_at=now()-interval '2 minutes' where user_id=$1", [id]);
  await login(id);
}

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; grant usage on schema auth to anon, authenticated;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
  `);
  await db.exec(await readFile(new URL("../drizzle/migrations/0000_guild_schema.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../drizzle/migrations/0019_party_queue.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id,email) values($1,'one@example.test'),($2,'two@example.test')", [a, b]);
  await db.query("update profiles set char_name='Aster',job='Crusader',base_lv=70 where id=$1", [a]);
  await db.query("update profiles set char_name='Lute',job='Bard',base_lv=69 where id=$1", [b]);
});
after(() => db.close());

test("anonymous users cannot read or join", async () => {
  await login("", "anon");
  await assert.rejects(() => snapshot(), /permission denied/);
  await assert.rejects(() => join(), /permission denied/);
  await assert.rejects(() => db.query("select * from public.party_queue"), /permission denied/);
});
test("authenticated accounts without a guild profile are excluded", async () => {
  await login(outsider);
  await assert.rejects(() => snapshot(), /guild profile/);
  await assert.rejects(() => join(), /guild profile/);
  assert.equal((await db.query("select * from public.party_queue")).rows.length, 0);
});
test("two members see persisted entries derived from their own profiles", async () => {
  await login(a); await join("Farming", "Tank", "Geffen", "Ready for a duo");
  await login(b); await join("Leveling", "Bragi");
  const data = await snapshot();
  assert.equal(data.entries.length, 2);
  assert.equal(data.entries.find((entry) => entry.user_id === a).job, "Crusader");
  assert.equal(data.entries.find((entry) => entry.user_id === b).char_name, "Lute");
  assert.ok(Date.parse(data.server_time));
});
test("join retries preserve one entry and its notification identity", async () => {
  await login(a);
  const first = await join(); const second = await join();
  assert.equal(first, second);
  assert.equal((await snapshot()).entries.filter((entry) => entry.user_id === a).length, 1);
});
test("all direct client writes are forbidden, including own rows and forged identities", async () => {
  await login(a);
  await assert.rejects(() => db.query("update public.party_queue set user_id=$1 where user_id=$2", [a, b]), /permission denied/);
  await assert.rejects(() => db.query("update public.party_queue set job='Wizard' where user_id=$1", [a]), /permission denied/);
  await assert.rejects(() => db.query("delete from public.party_queue where user_id=$1", [a]), /permission denied/);
  await assert.rejects(() => db.query("insert into public.party_queue(user_id) values($1)", [a]), /permission denied/);
});
test("a member cannot leave or extend someone else's entry", async () => {
  await login(a);
  const other = (await snapshot()).entries.find((entry) => entry.user_id === b);
  await db.query("select public.party_queue_leave($1)", [other.id]);
  await assert.rejects(() => db.query("select public.party_queue_extend($1)", [other.id]), /expired/);
  assert.equal((await snapshot()).entries.find((entry) => entry.user_id === b).expires_at, other.expires_at);
});
test("leave is idempotent, hides the entry and cannot be reversed with extend", async () => {
  await login(a); const id = await join();
  await db.query("select public.party_queue_leave($1)", [id]);
  await db.query("select public.party_queue_leave($1)", [id]);
  assert.equal((await snapshot()).entries.some((entry) => entry.user_id === a), false);
  await assert.rejects(() => db.query("select public.party_queue_extend($1)", [id]), /expired/);
  await assert.rejects(() => join(), /15 seconds/);
});
test("expiry is enforced by server time and a stale leave cannot cancel a rejoin", async () => {
  await expire(a);
  assert.equal((await snapshot()).entries.some((entry) => entry.user_id === a), false);
  const old = (await db.query("select id from public.party_queue where user_id=$1", [a])).rows[0].id;
  const fresh = await join(); assert.notEqual(fresh, old);
  await db.query("select public.party_queue_leave($1)", [old]);
  assert.equal((await snapshot()).entries.find((entry) => entry.user_id === a).id, fresh);
  await db.query("select public.party_queue_extend($1)", [fresh]);
  assert.equal((await snapshot()).entries.find((entry) => entry.user_id === a).id, fresh);
});
test("invalid input is rejected at the database boundary", async () => {
  await expire(a);
  for (const args of [["Invalid", "Any", "", ""], ["Any", "Admin", "", ""], ["Any", "Any", "x".repeat(81), ""], ["Any", "Any", "", "x".repeat(241)], [null, "Any", "", ""]]) {
    await assert.rejects(() => join(...args), /Check your/);
  }
});
test("later classes, invalid levels and missing character names cannot join", async () => {
  await expire(a);
  for (const [job, level, name] of [["Supernovice", 70, "Aster"], ["Lord Knight", 70, "Aster"], ["Knight", 100, "Aster"], ["Knight", 70, "   "]]) {
    await db.query("update public.profiles set job=$1,base_lv=$2,char_name=$3 where id=$4", [job, level, name, a]);
    await assert.rejects(() => join(), /Episode 6|base level|character name/);
  }
});
test("every 2-2 class is accepted", async () => {
  for (const job of ["Crusader", "Monk", "Sage", "Rogue", "Alchemist", "Bard", "Dancer"]) {
    await expire(a);
    await db.query("update public.profiles set job=$1,base_lv=70,char_name='Aster' where id=$2", [job, a]);
    await join();
    assert.equal((await snapshot()).entries.find((entry) => entry.user_id === a).job, job);
  }
});
