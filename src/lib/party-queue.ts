import { z } from "zod";
import { isEpisode6Job, PARTY_ROLES } from "@/lib/ro/jobs";

export const QUEUE_ACTIVITIES = ["Any", "Leveling", "Farming", "MVP"] as const;
export const queueEntrySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  char_name: z.string().min(1).max(40),
  job: z.string().refine(isEpisode6Job),
  base_lv: z.number().int().min(1).max(99),
  activity: z.enum(QUEUE_ACTIVITIES),
  role: z.string().refine((role) => PARTY_ROLES.includes(role)),
  location: z.string().max(80),
  note: z.string().max(240),
  joined_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
});
export const queueSnapshotSchema = z.object({
  server_time: z.string().datetime({ offset: true }),
  entries: z.array(queueEntrySchema),
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;
export type QueueDraft = {
  activity: (typeof QUEUE_ACTIVITIES)[number];
  role: string;
  location: string;
  note: string;
};

/** Baseline the first snapshot; only announce new, still-available arrivals. */
export function queueArrivals(
  previous: Set<string> | null,
  entries: QueueEntry[],
  userId: string,
  now: number,
) {
  if (!previous) return [];
  return entries.filter(
    (entry) =>
      entry.user_id !== userId &&
      !previous.has(entry.id) &&
      Date.parse(entry.expires_at) > now &&
      now - Date.parse(entry.joined_at) < 120_000,
  );
}

export function queueError(error: unknown) {
  const detail =
    typeof error === "object" && error !== null
      ? (error as { code?: string; message?: string })
      : {};
  if (["PGRST202", "42P01", "42883"].includes(detail.code ?? "")) {
    return "Party Queue is not available yet. Please ask a guild administrator to finish activation.";
  }
  return detail.message || "Could not reach the queue. Check your connection and try again.";
}
