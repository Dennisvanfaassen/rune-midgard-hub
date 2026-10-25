import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimQueueAlerts,
  DEFAULT_QUEUE_PREFERENCES,
  preferencesKey,
  readQueuePreferences,
} from "@/lib/party-queue-alerts";

beforeEach(() => localStorage.clear());
describe("Queue notification preferences and claims", () => {
  it("starts silent, without desktop permission or outside-queue alerts", () => {
    expect(readQueuePreferences("one")).toEqual(DEFAULT_QUEUE_PREFERENCES);
  });
  it("rejects corrupt preferences and keeps different accounts separate", () => {
    localStorage.setItem(
      preferencesKey("one"),
      JSON.stringify({ ...DEFAULT_QUEUE_PREFERENCES, sound: true }),
    );
    expect(readQueuePreferences("one").sound).toBe(true);
    expect(readQueuePreferences("two").sound).toBe(false);
    localStorage.setItem(preferencesKey("one"), "broken");
    expect(readQueuePreferences("one").sound).toBe(false);
  });
  it("deduplicates an arrival across repeated claims", async () => {
    const show = vi.fn();
    await claimQueueAlerts("one", ["entry-a"], show);
    await claimQueueAlerts("one", ["entry-a"], show);
    expect(show).toHaveBeenCalledTimes(1);
    await claimQueueAlerts("one", ["entry-b"], show);
    expect(show).toHaveBeenCalledTimes(2);
  });
  it("does not let a different account consume an arrival", async () => {
    const show = vi.fn();
    await claimQueueAlerts("one", ["entry-a"], show);
    await claimQueueAlerts("two", ["entry-a"], show);
    expect(show).toHaveBeenCalledTimes(2);
  });
  it("only announces unseen members when tabs receive overlapping batches", async () => {
    const show = vi.fn();
    await claimQueueAlerts("one", ["entry-a"], show);
    await claimQueueAlerts("one", ["entry-a", "entry-b"], show);
    expect(show).toHaveBeenLastCalledWith(["entry-b"]);
  });
});
