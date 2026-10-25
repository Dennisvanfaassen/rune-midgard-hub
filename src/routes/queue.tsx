import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  Clock3,
  Copy,
  LogOut,
  Radio,
  RefreshCw,
  Search,
  Shield,
  Swords,
  Users,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePartyQueue } from "@/components/PartyQueueProvider";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { EPISODE_6_JOBS, isEpisode6Job, PARTY_ROLES } from "@/lib/ro/jobs";
import { QUEUE_ACTIVITIES, queueError, type QueueDraft, type QueueEntry } from "@/lib/party-queue";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Party Queue · Rune Midgard" },
      {
        name: "description",
        content:
          "Ready to play? Find guildmates for a duo, leveling, farming or an MVP hunt. Ragnarok Episode 6, through 2-2 classes.",
      },
    ],
  }),
  component: PartyQueuePage,
});
const fieldClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50";

function PlayerCard({ entry, now }: { entry: QueueEntry; now: number }) {
  async function copyName() {
    try {
      await navigator.clipboard.writeText(entry.char_name);
      toast.success("Character name copied. Whisper them in Ragnarok to team up.");
    } catch {
      toast.info(`Whisper ${entry.char_name} in Ragnarok to team up.`);
    }
  }
  return (
    <article className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-3 text-primary">
          <Shield className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to="/members/$id"
            params={{ id: entry.user_id }}
            className="break-words font-bold hover:text-primary"
          >
            {entry.char_name}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            Lv. {entry.base_lv} · {entry.job}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Ready
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md bg-primary/10 px-2.5 py-1 text-primary">
          {entry.activity === "Any" ? "Any adventure" : entry.activity}
        </span>
        <span className="rounded-md bg-secondary px-2.5 py-1">
          {entry.role === "Any" ? "Flexible role" : entry.role}
        </span>
      </div>
      <p className="mt-3 break-words text-sm font-semibold">
        {entry.location || "Let's pick a destination together"}
      </p>
      {entry.note && (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {entry.note}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          Queued {Math.max(0, Math.floor((now - Date.parse(entry.joined_at)) / 60_000))}m
        </span>
        <Button size="sm" variant="outline" onClick={copyName}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy name
        </Button>
      </div>
    </article>
  );
}

function QueueContent({ userId }: { userId: string }) {
  const queue = usePartyQueue()!;
  const [draft, setDraft] = useState<QueueDraft>({
    activity: "Any",
    role: "Any",
    location: "",
    note: "",
  });
  const [activity, setActivity] = useState("All");
  const [job, setJob] = useState("All");
  const profile = useQuery({
    queryKey: ["queue-profile", userId],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("char_name,job,base_lv")
        .eq("id", userId)
        .abortSignal(signal)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const person = profile.data;
  const eligible =
    !!person?.char_name?.trim() &&
    person.char_name.trim().length <= 40 &&
    isEpisode6Job(person.job) &&
    person.base_lv >= 1 &&
    person.base_lv <= 99;
  const others = queue.entries.filter((entry) => entry.user_id !== userId);
  const shown = others.filter(
    (entry) =>
      (activity === "All" || entry.activity === activity) && (job === "All" || entry.job === job),
  );
  const busy = queue.mutation.isPending || !queue.online;
  const unavailable = queue.query.isError || queue.query.isPending;

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-3 text-xs">
        <span
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${queue.connected && queue.online ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground"}`}
        >
          <Radio className="h-3.5 w-3.5" />
          {!queue.online ? "Offline" : queue.connected ? "Live queue" : "Checking every 15 seconds"}
        </span>
        <span className="text-muted-foreground">
          Episode 6 · Classes through 2-2 · No fixed party composition
        </span>
      </div>
      {!queue.online && (
        <p role="status" className="mt-4 rounded-lg border border-border bg-secondary p-4 text-sm">
          You're offline. This is the last known queue; reconnect before teaming up.
        </p>
      )}
      {queue.query.isError && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/50 p-4 text-sm"
        >
          <p>{queueError(queue.query.error)}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void queue.query.refetch()}
            disabled={!queue.online}
          >
            Try again
          </Button>
        </div>
      )}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section
            className={`overflow-hidden rounded-2xl border bg-card ${queue.own ? "border-primary/60 shadow-lg shadow-primary/5" : "border-border"}`}
          >
            <div className="border-b border-border bg-primary/5 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Your adventure
              </p>
              <h2 className="mt-2 font-display text-xl font-bold">
                {queue.own ? "You're in the queue" : "Ready when you are"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {queue.own
                  ? "Keep the hub open. We'll alert you when a guildmate joins."
                  : "Pick what you're up for and let your guildmates know."}
              </p>
            </div>
            <div className="p-5">
              {queue.own ? (
                <div className="space-y-4">
                  <div>
                    <p className="font-bold">{queue.own.char_name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Lv. {queue.own.base_lv} {queue.own.job}
                    </p>
                    <p className="mt-2 text-sm">
                      {queue.own.activity === "Any" ? "Any adventure" : queue.own.activity} ·{" "}
                      {queue.own.role === "Any" ? "Flexible role" : queue.own.role}
                    </p>
                    {queue.own.location && (
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {queue.own.location}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="flex items-center gap-2 text-sm">
                      <Clock3 className="h-4 w-4 text-primary" />
                      {Math.max(
                        1,
                        Math.ceil((Date.parse(queue.own.expires_at) - queue.now) / 60_000),
                      )}{" "}
                      minutes remaining
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Leave when you've found a party or stopped playing.
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={busy || unavailable}
                    onClick={() =>
                      queue.own && queue.mutation.mutate({ kind: "extend", id: queue.own.id })
                    }
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Stay queued for another hour
                  </Button>
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      queue.own && queue.mutation.mutate({ kind: "leave", id: queue.own.id })
                    }
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave queue
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Want to change your activity? Leave, then rejoin with your new preferences.
                  </p>
                </div>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (eligible && !busy && !unavailable)
                      queue.mutation.mutate({ kind: "join", draft });
                  }}
                >
                  {profile.isPending ? (
                    <p className="text-sm text-muted-foreground">Loading your character…</p>
                  ) : profile.isError ? (
                    <div role="alert" className="text-sm">
                      <p>Couldn't load your character.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void profile.refetch()}
                      >
                        Retry profile
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-secondary p-3">
                      <p className="font-bold">{person?.char_name || "Set your character name"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {person
                          ? `Lv. ${person.base_lv} ${person.job}`
                          : "Complete your guild profile first"}
                      </p>
                      <Link
                        to="/members/$id"
                        params={{ id: userId }}
                        className="mt-2 inline-block text-xs text-primary underline underline-offset-4"
                      >
                        Edit character profile
                      </Link>
                    </div>
                  )}
                  {!eligible && !profile.isPending && !profile.isError && (
                    <p className="text-xs text-muted-foreground">
                      You'll need a character name, level 1–99, and an Episode 6 class through 2-2
                      to join.
                    </p>
                  )}
                  <label className="block text-sm font-semibold" htmlFor="queue-activity">
                    Activity
                    <select
                      id="queue-activity"
                      aria-label="Activity"
                      className={fieldClass}
                      value={draft.activity}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          activity: event.target.value as QueueDraft["activity"],
                        })
                      }
                    >
                      {QUEUE_ACTIVITIES.map((value) => (
                        <option key={value} value={value}>
                          {value === "Any" ? "Up for anything" : value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold" htmlFor="queue-role">
                    I can help with
                    <select
                      id="queue-role"
                      aria-label="I can help with"
                      className={fieldClass}
                      value={draft.role}
                      onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                    >
                      {PARTY_ROLES.map((value) => (
                        <option key={value} value={value}>
                          {value === "Any" ? "Flexible / any role" : value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold" htmlFor="queue-location">
                    Destination{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                    <input
                      id="queue-location"
                      className={fieldClass}
                      maxLength={80}
                      value={draft.location}
                      onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                      placeholder="Where would you like to go?"
                    />
                  </label>
                  <label className="block text-sm font-semibold" htmlFor="queue-note">
                    Party note <span className="font-normal text-muted-foreground">(optional)</span>
                    <textarea
                      id="queue-note"
                      className={`${fieldClass} min-h-20 resize-y`}
                      maxLength={240}
                      value={draft.note}
                      onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                      placeholder="Looking for a duo? Need a specific class?"
                    />
                  </label>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!eligible || busy || unavailable}
                  >
                    <Swords className="mr-2 h-4 w-4" />
                    {queue.mutation.isPending ? "Joining…" : "Join Party Queue"}
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Available for 1 hour. Extend whenever you're still playing. One character per
                    account.
                  </p>
                </form>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Bell className="h-4 w-4 text-primary" />
              Queue alerts
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Popups are on while you queue, across the whole hub.
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={queue.preferences.allJoins}
                onChange={(event) => queue.updatePreferences({ allJoins: event.target.checked })}
              />
              <span>Also notify me when I'm not queued</span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  queue.preferences.sound && queue.audioReady
                    ? queue.updatePreferences({ sound: false })
                    : void queue.enableSound()
                }
              >
                <Volume2 className="mr-2 h-4 w-4" />
                {queue.preferences.sound && queue.audioReady ? "Mute sound" : "Enable / test sound"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  queue.preferences.desktop
                    ? queue.updatePreferences({ desktop: false })
                    : void queue.enableDesktop()
                }
              >
                <Bell className="mr-2 h-4 w-4" />
                {queue.preferences.desktop ? "Turn off browser alerts" : "Enable browser alerts"}
              </Button>
            </div>
            {queue.preferences.sound && (
              <label className="mt-4 block text-xs" htmlFor="queue-volume">
                Volume · {Math.round(queue.preferences.volume * 100)}%
                <input
                  id="queue-volume"
                  className="mt-2 w-full accent-primary"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={queue.preferences.volume}
                  onChange={(event) =>
                    queue.updatePreferences({ volume: Number(event.target.value) })
                  }
                />
              </label>
            )}
            {queue.preferences.sound && !queue.audioReady && (
              <p className="mt-2 text-xs text-muted-foreground">
                Click Enable / test sound to activate audio for this visit.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Keep a hub tab open for alerts. Browser notifications depend on permission and browser
              support.
            </p>
          </section>
        </aside>
        <section>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Guildmates ready to play</h2>
              <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                {others.length} {others.length === 1 ? "guildmate is" : "guildmates are"} looking
                for company
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Refresh available guildmates"
              disabled={queue.query.isFetching || !queue.online}
              onClick={() => void queue.query.refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground" htmlFor="filter-activity">
              Activity
              <select
                id="filter-activity"
                aria-label="Filter activity"
                className={fieldClass}
                value={activity}
                onChange={(event) => setActivity(event.target.value)}
              >
                <option value="All">All activities</option>
                {QUEUE_ACTIVITIES.map((value) => (
                  <option key={value} value={value}>
                    {value === "Any" ? "Any adventure" : value}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground" htmlFor="filter-class">
              Class
              <select
                id="filter-class"
                aria-label="Class"
                className={fieldClass}
                value={job}
                onChange={(event) => setJob(event.target.value)}
              >
                <option value="All">All classes</option>
                {EPISODE_6_JOBS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          {queue.query.isPending && (
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              Finding available guildmates…
            </p>
          )}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {shown.map((entry) => (
              <PlayerCard key={entry.id} entry={entry} now={queue.now} />
            ))}
          </div>
          {!unavailable && !shown.length && (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
              <Users className="mx-auto h-10 w-10 text-primary/60" aria-hidden="true" />
              <h3 className="mt-4 font-display text-lg font-bold">
                {others.length
                  ? "No guildmates match these filters"
                  : queue.own
                    ? "Your next adventure starts here"
                    : "Be the first to rally the guild"}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {others.length
                  ? "Try a different class or activity to see more players."
                  : queue.own
                    ? "You're ready. We'll give you a heads-up when someone joins the queue."
                    : "Join the queue and give your guildmates a reason to team up."}
              </p>
              {others.length > 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setJob("All");
                    setActivity("All");
                  }}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Clear filters
                </Button>
              )}
            </div>
          )}
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Copy a character name and whisper them in Ragnarok to arrange your party. Check level
            sharing together. The queue does not send in-game invitations.
          </p>
        </section>
      </div>
    </>
  );
}

function PartyQueuePage() {
  const { userId, ready } = useAuth();
  const queue = usePartyQueue();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
            Rune Midgard · Looking for group
          </p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Party Queue</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            A quick duo. A farming partner. Your next guild adventure.
            <br />
            Let everyone know you're ready to play.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/parties">
            <Clock3 className="mr-2 h-4 w-4" />
            Plan a party for later
          </Link>
        </Button>
      </div>
      {!ready ? (
        <p role="status" className="mt-8 text-muted-foreground">
          Loading your session…
        </p>
      ) : userId && queue ? (
        <QueueContent userId={userId} />
      ) : (
        <section className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
          <Swords className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 font-display text-xl font-bold">
            Your guildmates are one queue away
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your guild account to join and see who's ready.
          </p>
          <Button asChild className="mt-5">
            <Link to="/auth">Sign in to queue</Link>
          </Button>
        </section>
      )}
    </main>
  );
}
