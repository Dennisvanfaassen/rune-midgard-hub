import { describe, expect, it } from "vitest";
import { EPISODE_6_JOBS, isEpisode6Job } from "@/lib/ro/jobs";
import { queueArrivals, queueSnapshotSchema, type QueueEntry } from "@/lib/party-queue";

const now = Date.parse("2026-10-25T12:00:00Z");
const entry: QueueEntry = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  char_name: "Lute",
  job: "Bard",
  base_lv: 70,
  role: "Bragi",
  activity: "Leveling",
  location: "",
  note: "",
  joined_at: new Date(now - 1000).toISOString(),
  expires_at: new Date(now + 3600000).toISOString(),
};
describe("Episode 6 Party Queue", () => {
  it("includes all 2-2 jobs and excludes later and expanded classes", () => {
    expect(EPISODE_6_JOBS).toEqual(
      expect.arrayContaining(["Crusader", "Monk", "Sage", "Rogue", "Alchemist", "Bard", "Dancer"]),
    );
    for (const job of ["Supernovice", "Lord Knight", "Arcane Knight", "Ninja"])
      expect(isEpisode6Job(job)).toBe(false);
  });
  it("rejects malformed data and invalid class/level coming from the backend", () => {
    const snapshot = { server_time: new Date(now).toISOString(), entries: [entry] };
    expect(queueSnapshotSchema.safeParse(snapshot).success).toBe(true);
    for (const changes of [
      { base_lv: 100 },
      { job: "Paladin" },
      { role: "admin" },
      { joined_at: "yesterday" },
      { activity: "invalid" },
    ]) {
      expect(
        queueSnapshotSchema.safeParse({ ...snapshot, entries: [{ ...entry, ...changes }] }).success,
      ).toBe(false);
    }
  });
  it("does not replay existing players at initial load or reload", () => {
    expect(queueArrivals(null, [entry], "me", now)).toEqual([]);
  });
  it("announces a first arrival even when the initial queue was empty", () => {
    expect(queueArrivals(new Set(), [entry], "me", now)).toEqual([entry]);
  });
  it("does not alert for yourself, duplicate events or extensions", () => {
    expect(queueArrivals(new Set(), [entry], entry.user_id, now)).toEqual([]);
    expect(
      queueArrivals(
        new Set([entry.id]),
        [{ ...entry, expires_at: new Date(now + 7200000).toISOString() }],
        "me",
        now,
      ),
    ).toEqual([]);
  });
  it("discards expired and old arrivals after a connection outage", () => {
    expect(
      queueArrivals(new Set(), [{ ...entry, expires_at: new Date(now).toISOString() }], "me", now),
    ).toEqual([]);
    expect(
      queueArrivals(
        new Set(),
        [{ ...entry, joined_at: new Date(now - 180000).toISOString() }],
        "me",
        now,
      ),
    ).toEqual([]);
  });
  it("announces a fresh rejoin once with its new entry identity", () => {
    const rejoined = { ...entry, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
    expect(queueArrivals(new Set([entry.id]), [rejoined], "me", now)).toEqual([rejoined]);
  });
});
