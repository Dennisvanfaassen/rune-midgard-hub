import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Clock3, Crosshair, MapPin, Search, Skull, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { MVP_SPAWNS, mvpSpawnId, type MvpSpawn } from "@/lib/ro/mvp-spawns";

export const Route = createFileRoute("/mvp-tracker")({
  head: () => ({ meta: [
    { title: "MVP Tracker · Rune Midgard" },
    { name: "description", content: "Coordinate Episode 8.2 MVP hunts with shared death timers and tomb pins." },
  ] }),
  component: MvpTracker,
});

type Kill = { id: string; boss_key: string; map_key: string; killed_at: string; reporter_id: string; created_at: string };
type Tomb = { boss_key: string; map_key: string; tomb_x: number; tomb_y: number; updated_by: string };
const dateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const clock = (value: number) => new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
function duration(milliseconds: number) {
  if (milliseconds <= 0) return "Now";
  const minutes = Math.ceil(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
}
function localInputValue(d: Date) {
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}
function status(spawn: MvpSpawn, kill: Kill | undefined, now: number) {
  if (!kill) return { label: "No report", kind: "unknown" };
  const start = new Date(kill.killed_at).getTime() + spawn.minMinutes * 60_000;
  const end = new Date(kill.killed_at).getTime() + spawn.maxMinutes * 60_000;
  if (now < start) return { label: `In ${duration(start - now)}`, kind: "waiting" };
  if (now <= end) return { label: "Spawn window", kind: "window" };
  return { label: "Likely spawned", kind: "due" };
}
const badgeClasses: Record<string, string> = {
  unknown: "bg-muted text-muted-foreground",
  waiting: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  window: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  due: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

// Neutral GAT-style grid placeholder: actual GAT navigation cells can replace this layer.
function GridMap({ spawn, pin, onPlace }: { spawn: MvpSpawn; pin: Tomb | undefined; onPlace: (x: number, y: number) => void }) {
  const seed = [...spawn.mapKey].reduce((sum, ch) => sum * 31 + ch.charCodeAt(0), 7) >>> 0;
  const size = 32;
  const tiles = useMemo(() => Array.from({ length: size * size }, (_, n) => {
    const x = n % size, y = Math.floor(n / size);
    const edge = x < 2 || y < 2 || x >= size - 2 || y >= size - 2;
    const wall = ((Math.sin(x * 0.37 + (seed % 23)) + Math.cos(y * 0.45 + (seed % 17))) > 1.35)
      || ((x * 13 + y * 37 + seed) % 61 < 3);
    return { x, y, passable: !edge && !wall };
  }), [seed]);
  function click(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    onPlace(x, y);
  }
  return <div className="overflow-hidden rounded-xl border border-border bg-[#142630]">
    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 text-slate-200">
      <span className="truncate font-semibold">{spawn.mapName}</span>
      <span className="shrink-0 font-mono text-xs text-slate-400">{spawn.mapKey}</span>
    </div>
    <svg role="img" aria-label="Map grid. Click to set a tomb pin." viewBox="0 0 320 320" className="block aspect-square w-full cursor-crosshair" onClick={click}>
      <rect width="320" height="320" fill="#142630" />
      {tiles.map((tile) => <rect key={`${tile.x}-${tile.y}`} x={tile.x * 10} y={tile.y * 10} width="9.8" height="9.8" fill={tile.passable ? "#557783" : "#213b47"} opacity={tile.passable ? 0.74 : 0.85} />)}
      {pin && <g transform={`translate(${pin.tomb_x * 320} ${pin.tomb_y * 320})`}>
        <circle r="19" fill="#fb7185" opacity=".21" />
        <path d="M0 -19 C-17 -19 -17 1 0 16 C17 1 17 -19 0 -19Z" fill="#fb7185" stroke="white" strokeWidth="1.5"/>
        <circle cy="-8" r="5" fill="white"/>
      </g>}
    </svg>
    <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-slate-300">
      <MapPin className="h-4 w-4 text-rose-300" />
      {pin ? `Tomb pinned · ${Math.round(pin.tomb_x * 100)}% / ${Math.round(pin.tomb_y * 100)}%` : "Click the grid to mark the MVP tomb location"}
    </div>
    <p className="px-4 pb-3 text-[11px] leading-relaxed text-slate-400">Illustrative GAT-style grid, not yet real map geometry. Pins are relative to this grid; confirm locations once the extracted GAT map is connected.</p>
  </div>;
}

function MvpTracker() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(mvpSpawnId(MVP_SPAWNS[0]));
  const [manualTime, setManualTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const { data, isLoading, error } = useQuery({
    queryKey: ["mvp-tracker"],
    enabled: !!userId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const [kills, tombs] = await Promise.all([
        supabase.from("mvp_kills").select("id,boss_key,map_key,killed_at,reporter_id,created_at").order("killed_at", { ascending: false }).limit(500),
        supabase.from("mvp_tombs").select("boss_key,map_key,tomb_x,tomb_y,updated_by"),
      ]);
      if (kills.error) throw kills.error;
      if (tombs.error) throw tombs.error;
      return { kills: (kills.data ?? []) as Kill[], tombs: (tombs.data ?? []) as Tomb[] };
    },
  });
  const spawn = MVP_SPAWNS.find((s) => mvpSpawnId(s) === selected) ?? MVP_SPAWNS[0];
  const recent = data?.kills.filter((k) => k.boss_key === spawn.bossKey && k.map_key === spawn.mapKey) ?? [];
  const kill = recent[0];
  const tomb = data?.tombs.find((p) => p.boss_key === spawn.bossKey && p.map_key === spawn.mapKey);
  const filtered = MVP_SPAWNS.filter((s) => `${s.name} ${s.mapName} ${s.mapKey}`.toLowerCase().includes(search.trim().toLowerCase()));
  const minSpawn = kill ? new Date(kill.killed_at).getTime() + spawn.minMinutes * 60_000 : null;
  const maxSpawn = kill ? new Date(kill.killed_at).getTime() + spawn.maxMinutes * 60_000 : null;
  const current = status(spawn, kill, now);
  const refresh = () => qc.invalidateQueries({ queryKey: ["mvp-tracker"] });

  async function report(when: Date) {
    if (!userId) { toast.error("Sign in to report MVP kills"); return; }
    if (!Number.isFinite(when.getTime()) || when.getTime() > Date.now() + 60_000) { toast.error("Enter a valid time in the past"); return; }
    setBusy(true);
    const { error } = await supabase.from("mvp_kills").insert({
      boss_key: spawn.bossKey, map_key: spawn.mapKey, killed_at: when.toISOString(), reporter_id: userId,
      tomb_x: tomb?.tomb_x ?? null, tomb_y: tomb?.tomb_y ?? null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`${spawn.name} kill recorded`); setManualTime(""); refresh(); }
  }
  async function savePin() {
    if (!userId || !pendingPin) return;
    setBusy(true);
    const { error } = await supabase.from("mvp_tombs").upsert({
      boss_key: spawn.bossKey, map_key: spawn.mapKey,
      tomb_x: Number(pendingPin.x.toFixed(5)), tomb_y: Number(pendingPin.y.toFixed(5)), updated_by: userId, updated_at: new Date().toISOString(),
    }, { onConflict: "boss_key,map_key" });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Tomb pin saved for your guild"); setPendingPin(null); refresh(); }
  }
  async function undo(id: string) {
    if (!userId || busy) return;
    if (!window.confirm("Remove your kill report? The previous report will become active.")) return;
    setBusy(true);
    const { error } = await supabase.from("mvp_kills").delete().eq("id", id).eq("reporter_id", userId);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Kill report removed"); refresh(); }
  }

  return <main className="mx-auto max-w-7xl px-4 py-8 md:py-12">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-primary"><Skull className="h-4 w-4" /> Guild hunting tools</div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">MVP Tracker</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Coordinate hunts with live respawn windows, shared kill reports and tomb markers. Episode 8.2 reference timings.</p>
      </div>
      <span className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">{MVP_SPAWNS.length} map spawns · {new Set(MVP_SPAWNS.map((s) => s.bossKey)).size} MVPs</span>
    </div>
    {!userId ? <div className="rounded-xl border border-border bg-card p-8 text-center"><h2 className="text-xl font-semibold">Guild members only</h2><p className="my-3 text-muted-foreground">Sign in to see shared MVP timers and report kills.</p><Button asChild><Link to="/auth">Sign in</Link></Button></div> :
    <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-xl border border-border bg-card lg:sticky lg:top-24">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Choose an MVP</h2>
          <div className="relative mt-3"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search MVP or map"/></div>
        </div>
        <div className="max-h-[540px] overflow-y-auto p-2">
          {filtered.map((s) => {
            const id = mvpSpawnId(s);
            const latest = data?.kills.find((k) => k.boss_key === s.bossKey && k.map_key === s.mapKey);
            const st = status(s, latest, now);
            return <button key={id} type="button" onClick={() => { setSelected(id); setPendingPin(null); setManualTime(""); }} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-3 text-left transition hover:bg-secondary ${selected === id ? "bg-secondary ring-1 ring-primary/30" : ""}`}>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{s.name}</span><span className="block truncate text-xs text-muted-foreground">{s.mapName}</span></span>
              <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${badgeClasses[st.kind]}`}>{st.kind === "waiting" ? duration((new Date(latest!.killed_at).getTime() + s.minMinutes * 60_000) - now) : st.kind === "window" ? "Window" : st.kind === "due" ? "Due" : "—"}</span>
            </button>;
          })}
          {!filtered.length && <p className="p-4 text-sm text-muted-foreground">No MVPs found.</p>}
        </div>
      </aside>
      <div className="space-y-5">
        {error && <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">Could not load shared tracker data. Run migration 0011 in Lovable Cloud. {error instanceof Error ? error.message : ""}</div>}
        {isLoading && <p className="text-sm text-muted-foreground">Loading shared MVP reports…</p>}
        <div className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs uppercase tracking-widest text-muted-foreground">{spawn.mapName}</p><h2 className="mt-1 font-display text-2xl font-bold">{spawn.name}</h2></div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${badgeClasses[current.kind]}`}>{current.label}</span>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(270px,.85fr)]">
            <div>
              <GridMap spawn={spawn} pin={pendingPin ? { boss_key: spawn.bossKey, map_key: spawn.mapKey, tomb_x: pendingPin.x, tomb_y: pendingPin.y, updated_by: userId } : tomb} onPlace={(x,y) => setPendingPin({x,y})}/>
              {pendingPin && <div className="mt-3 flex items-center gap-2"><Button size="sm" disabled={busy} onClick={savePin}><MapPin className="mr-1 h-4 w-4"/>Save tomb pin</Button><Button size="sm" variant="ghost" onClick={() => setPendingPin(null)}>Cancel</Button></div>}
            </div>
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-secondary/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Next respawn window</p>
                <div className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{minSpawn ? clock(minSpawn) : "Not tracked"}{maxSpawn && maxSpawn !== minSpawn ? ` – ${clock(maxSpawn)}` : ""}</div>
                <p className="mt-2 text-sm text-muted-foreground">{kill ? `Last reported kill: ${dateTime(kill.killed_at)}` : "Record the first kill to start the timer."}</p>
                <div className="mt-4 flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4 text-primary"/><span>Reference respawn: {spawn.minMinutes}–{spawn.maxMinutes} minutes</span></div>
                {kill && <p className="mt-3 text-xs text-muted-foreground">Window status: {status(spawn, kill, now).label}. Respawns are estimates, not confirmed SoulBound settings.</p>}
              </div>
              <div className="rounded-xl border border-border p-5">
                <h3 className="font-semibold">Report an MVP kill</h3>
                <p className="mt-1 text-xs text-muted-foreground">Your report immediately updates the guild-wide timer.</p>
                <Button className="mt-4 w-full" disabled={busy || !!error} onClick={() => report(new Date())}><Zap className="mr-2 h-4 w-4"/>Killed now</Button>
                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/><span>or enter death time</span><span className="h-px flex-1 bg-border"/></div>
                <label htmlFor="mvp-death-time" className="text-xs font-medium">Death time (your local timezone)</label>
                <Input id="mvp-death-time" type="datetime-local" className="mt-2" max={localInputValue(new Date())} value={manualTime} onChange={(e) => setManualTime(e.target.value)}/>
                <Button className="mt-3 w-full" variant="outline" disabled={!manualTime || busy || !!error} onClick={() => report(new Date(manualTime))}>Save death time</Button>
              </div>
            </div>
          </div>
        </div>
        <section className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2"><div><h3 className="text-lg font-bold">Kill history</h3><p className="text-xs text-muted-foreground">Last reports for this MVP and map</p></div><Crosshair className="h-5 w-5 text-muted-foreground"/></div>
          {!recent.length ? <p className="rounded-lg bg-secondary/30 p-4 text-sm text-muted-foreground">No kills reported yet. Be the first to track this MVP.</p> :
          <div className="divide-y divide-border">{recent.slice(0, 15).map((entry, index) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><span className="font-semibold">{dateTime(entry.killed_at)}</span>{index === 0 && <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Current timer</span>}<p className="text-xs text-muted-foreground">Recorded {dateTime(entry.created_at)}</p></div>{entry.reporter_id === userId && <Button size="sm" variant="ghost" disabled={busy} aria-label="Undo this kill report" title="Undo your report" onClick={() => undo(entry.id)}><Trash2 className="h-4 w-4"/></Button>}</div>)}</div>}
        </section>
        <p className="text-xs leading-relaxed text-muted-foreground">MVP spawn locations and reference timers are historical Episode 8.2 estimates, not yet validated against SoulBound's server configuration. Map grids are illustrative until actual GAT walkability conversion is integrated.</p>
      </div>
    </div>}
  </main>;
}
