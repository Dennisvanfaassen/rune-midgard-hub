import { z } from "zod";

const preferencesSchema = z.object({
  allJoins: z.boolean(),
  sound: z.boolean(),
  desktop: z.boolean(),
  volume: z.number().min(0).max(1),
});
export type QueuePreferences = z.infer<typeof preferencesSchema>;
export const DEFAULT_QUEUE_PREFERENCES: QueuePreferences = {
  allJoins: false,
  sound: false,
  desktop: false,
  volume: 0.35,
};
export const preferencesKey = (userId: string) => `rune-queue-preferences:${userId}`;
export function readQueuePreferences(userId: string): QueuePreferences {
  try {
    const result = preferencesSchema.safeParse(
      JSON.parse(localStorage.getItem(preferencesKey(userId)) || "null"),
    );
    return result.success ? result.data : DEFAULT_QUEUE_PREFERENCES;
  } catch {
    return DEFAULT_QUEUE_PREFERENCES;
  }
}

/** Web Locks makes the read/claim atomic across same-origin tabs. */
export async function claimQueueAlerts(
  userId: string,
  ids: string[],
  show: (freshIds: string[]) => void,
) {
  if (document.visibilityState === "hidden")
    await new Promise((resolve) => setTimeout(resolve, 200));
  const claim = () => {
    let freshIds = ids;
    try {
      const key = `rune-queue-alerts:${userId}`;
      const stored: unknown = JSON.parse(localStorage.getItem(key) || "[]");
      const seen = Array.isArray(stored)
        ? stored.filter((id): id is string => typeof id === "string")
        : [];
      freshIds = ids.filter((id) => !seen.includes(id));
      if (!freshIds.length) return;
      localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...ids])].slice(-100)));
    } catch {
      /* Storage restrictions must not disable in-page alerts. */
    }
    show(freshIds);
  };
  if (navigator.locks) await navigator.locks.request(`rune-queue-alerts:${userId}`, claim);
  else claim(); // Best effort on older browsers without Web Locks.
}

export function playQueueChime(context: AudioContext, volume: number) {
  if (context.state !== "running") return false;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.12;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * 0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + 0.5);
  });
  return true;
}
