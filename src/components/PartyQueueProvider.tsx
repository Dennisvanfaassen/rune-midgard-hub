import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { changeQueue, joinQueue, readQueue } from "@/lib/party-queue-api";
import { queueArrivals, queueError, type QueueDraft } from "@/lib/party-queue";
import {
  claimQueueAlerts,
  DEFAULT_QUEUE_PREFERENCES,
  playQueueChime,
  preferencesKey,
  readQueuePreferences,
  type QueuePreferences,
} from "@/lib/party-queue-alerts";
import { QueueArrival } from "@/components/QueueArrival";

function useQueueSession(userId: string) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const queryKey = ["party-queue", userId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => readQueue(signal),
    retry: 1,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
  });
  const [clock, setClock] = useState(Date.now);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(true);
  const [preferences, setPreferences] = useState(DEFAULT_QUEUE_PREFERENCES);
  const [audioReady, setAudioReady] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const alive = useRef(true);
  const seen = useRef<Set<string> | null>(null);
  const activeAlerts = useRef(new Set<string | number>());
  const browserAlerts = useRef(new Set<Notification>());
  // Keep countdowns independent of a user's clock skew relative to the database.
  const now = query.data
    ? Date.parse(query.data.server_time) + Math.max(0, clock - query.data.receivedAt)
    : clock;
  const entries = (query.data?.entries ?? []).filter((entry) => Date.parse(entry.expires_at) > now);
  const own = entries.find((entry) => entry.user_id === userId);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  useEffect(() => {
    alive.current = true;
    setPreferences(readQueuePreferences(userId));
    setOnline(navigator.onLine);
    const storage = (event: StorageEvent) => {
      if (event.key === preferencesKey(userId)) setPreferences(readQueuePreferences(userId));
    };
    const tick = setInterval(() => setClock(Date.now()), 1000);
    window.addEventListener("storage", storage);
    const alerts = activeAlerts.current;
    const notifications = browserAlerts.current;
    return () => {
      alive.current = false;
      clearInterval(tick);
      window.removeEventListener("storage", storage);
      alerts.forEach((id) => toast.dismiss(id));
      notifications.forEach((notification) => notification.close());
      void audio.current?.close();
      audio.current = null;
    };
  }, [userId]);

  useEffect(() => {
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ["party-queue", userId] });
    };
    const onOnline = () => {
      setOnline(true);
      refresh();
    };
    const onOffline = () => {
      setOnline(false);
      setConnected(false);
    };
    const channel = supabase
      .channel(`party-queue:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_queue" }, refresh)
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") refresh();
      });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [qc, userId]);

  useEffect(() => {
    if (!query.data) return;
    const snapshot = query.data;
    const arrivals = queueArrivals(
      seen.current,
      snapshot.entries,
      userId,
      Date.parse(snapshot.server_time),
    );
    seen.current = new Set(snapshot.entries.map((entry) => entry.id));
    const queued = snapshot.entries.some((entry) => entry.user_id === userId);
    if (!arrivals.length || (!queued && !preferencesRef.current.allJoins)) return;
    void claimQueueAlerts(
      userId,
      arrivals.map((entry) => entry.id),
      (freshIds) => {
        if (!alive.current) return;
        const prefs = preferencesRef.current;
        const freshArrivals = arrivals.filter((entry) => freshIds.includes(entry.id));
        const id = `party-queue:${freshIds.join(":")}`;
        activeAlerts.current.add(id);
        const openQueue = () => {
          toast.dismiss(id);
          void navigate({ to: "/queue" });
        };
        toast.custom(
          () => (
            <QueueArrival
              entries={freshArrivals}
              onView={openQueue}
              onDismiss={() => toast.dismiss(id)}
            />
          ),
          {
            id,
            duration: 20_000,
            position: "bottom-right",
            onDismiss: () => activeAlerts.current.delete(id),
            onAutoClose: () => activeAlerts.current.delete(id),
          },
        );
        if (prefs.sound && audio.current && !playQueueChime(audio.current, prefs.volume))
          setAudioReady(false);
        if (
          prefs.desktop &&
          document.visibilityState === "hidden" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            const notification = new Notification("Rune Midgard · A guildmate is ready!", {
              body: `${freshArrivals.length} guildmate(s) joined Party Queue. Open the hub to meet up.`,
              tag: id,
            });
            browserAlerts.current.add(notification);
            notification.onclose = () => browserAlerts.current.delete(notification);
            notification.onclick = () => {
              window.focus();
              openQueue();
              notification.close();
            };
          } catch {
            /* Mobile browsers may require a service worker; the popup still works. */
          }
        }
      },
    ).catch(() => {
      /* A tab closing while waiting for a lock needs no recovery. */
    });
  }, [query.data, userId, navigate]);

  const mutation = useMutation({
    mutationFn: async (
      operation: { kind: "join"; draft: QueueDraft } | { kind: "leave" | "extend"; id: string },
    ) => {
      if (operation.kind === "join") await joinQueue(operation.draft);
      else await changeQueue(operation.kind, operation.id);
    },
    onSuccess: async (_, operation) => {
      await qc.invalidateQueries({ queryKey: ["party-queue", userId] });
      toast.success(
        operation.kind === "join"
          ? "You're in! We'll let you know when guildmates join."
          : operation.kind === "leave"
            ? "You left the queue."
            : "Ready for another hour.",
      );
    },
    onError: (error) => toast.error(queueError(error)),
  });
  function updatePreferences(patch: Partial<QueuePreferences>) {
    const next = { ...preferencesRef.current, ...patch };
    setPreferences(next);
    try {
      localStorage.setItem(preferencesKey(userId), JSON.stringify(next));
    } catch {
      toast.info("Preferences will only last for this visit.");
    }
  }
  async function enableSound() {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      const ready = playQueueChime(audio.current, preferencesRef.current.volume);
      setAudioReady(ready);
      updatePreferences({ sound: ready });
      if (!ready) toast.info("Your browser blocked sound. Visual alerts remain on.");
    } catch {
      setAudioReady(false);
      toast.info("Sound is unavailable in this browser. Visual alerts remain on.");
    }
  }
  async function enableDesktop() {
    if (!("Notification" in window) || !window.isSecureContext) {
      toast.info("Browser notifications are unavailable here. Visual alerts remain on.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      updatePreferences({ desktop: permission === "granted" });
      if (permission !== "granted")
        toast.info(
          "Browser notifications are off. You can change permission in your browser settings.",
        );
    } catch {
      toast.info("Your browser could not enable notifications. Visual alerts remain on.");
    }
  }
  return {
    entries,
    own,
    now,
    connected,
    online,
    query,
    mutation,
    preferences,
    updatePreferences,
    enableSound,
    audioReady,
    enableDesktop,
  };
}
type QueueSession = ReturnType<typeof useQueueSession>;
const QueueContext = createContext<QueueSession | null>(null);
export const usePartyQueue = () => useContext(QueueContext);

function SignedInQueueProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const queue = useQueueSession(userId);
  return <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>;
}
export function PartyQueueProvider({ children }: { children: ReactNode }) {
  const { userId, ready } = useAuth();
  return ready && userId ? (
    <SignedInQueueProvider key={userId} userId={userId}>
      {children}
    </SignedInQueueProvider>
  ) : (
    <QueueContext.Provider value={null}>{children}</QueueContext.Provider>
  );
}
