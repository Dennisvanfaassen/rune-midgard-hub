import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Bell, BellOff, Clock3, Crosshair, MapPin, Search, Skull, Trash2, Volume2, Zap } from "lucide-react";
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

/** Read original GAT cell classifications from the extracted Ragnarokmap repository. */
async function fetchGat(mapKey: string, signal: AbortSignal) {
  const base = "https://raw.githubusercontent.com/Dennisvanfaassen/Ragnarokmap/main/Ragnarok%20World";
  for (const folder of ["0_hat", "1_soulbound", "2_main"]) {
    const response = await fetch(`${base}/${folder}/${encodeURIComponent(mapKey)}.gat`, { signal });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Map request failed (${response.status})`);
    const bytes = await response.arrayBuffer();
    const view = new DataView(bytes);
    if (view.byteLength < 14 || String.fromCharCode(...new Uint8Array(bytes, 0, 4)) !== "GRAT") throw new Error("Invalid GAT map header");
    const width = view.getUint32(6, true), height = view.getUint32(10, true);
    if (width < 1 || height < 1 || width * height > 300000 || 14 + width * height * 20 > bytes.byteLength) throw new Error("Invalid GAT map dimensions");
    return { width, height, view, source: folder };
  }
  throw new Error("GAT file not found in your extracted Ragnarok World database");
}
function GridMap({ spawn, pin, onPlace }: { spawn: MvpSpawn; pin: Tomb | undefined; onPlace: (x: number, y: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{ width: number; height: number; source: string } | null>(null);
  const [message, setMessage] = useState("Loading extracted GAT map…");
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null);
    setMessage("Loading extracted GAT map…");
    fetchGat(spawn.mapKey, controller.signal).then(({ width, height, view, source }) => {
      if (controller.signal.aborted) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) throw new Error("Canvas is unavailable");
      canvas.width = width;
      canvas.height = height;
      const image = context.createImageData(width, height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const cell = 14 + (y * width + x) * 20;
        const type = view.getUint32(cell + 16, true);
        const output = ((height - y - 1) * width + x) * 4;
        const walkable = type === 0 || type === 3;
        const rgb = walkable ? [109, 143, 148] : type === 1 ? [30, 53, 65] : [48, 83, 100];
        image.data[output] = rgb[0]; image.data[output + 1] = rgb[1];
        image.data[output + 2] = rgb[2]; image.data[output + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      setLoaded({ width, height, source });
    }).catch((error: unknown) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Unable to load GAT map"); });
    return () => controller.abort();
  }, [spawn.mapKey]);
  function click(event: MouseEvent<HTMLDivElement>) {
    if (!loaded) return;
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
    <div onClick={click} className={`relative aspect-square w-full overflow-hidden bg-[#1e3541] ${loaded ? "cursor-crosshair" : ""}`}>
      <canvas ref={canvasRef} className={`h-full w-full object-fill [image-rendering:pixelated] ${loaded ? "" : "opacity-0"}`} />
      {!loaded && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-300">{message}</div>}
      {loaded && pin && <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{ left: `${pin.tomb_x * 100}%`, top: `${pin.tomb_y * 100}%` }}>
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-rose-400/90 shadow-lg shadow-rose-500/40"><MapPin className="h-5 w-5 text-white"/></div>
      </div>}
    </div>
    <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-slate-300">
      <MapPin className="h-4 w-4 text-rose-300"/>
      {loaded ? pin ? `Tomb pinned · ${Math.round(pin.tomb_x * 100)}% / ${Math.round(pin.tomb_y * 100)}%` : "Click the map to mark the MVP tomb location" : "Tomb placement is unavailable until the GAT map loads"}
    </div>
    {loaded && <p className="px-4 pb-3 text-[11px] text-slate-400">GAT navigation grid · {loaded.width} × {loaded.height} · source: {loaded.source}. North is up.</p>}
  </div>;
}

function MvpTracker() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(mvpSpawnId(MVP_SPAWNS[0]));
  const [minutesAgo, setMinutesAgo] = useState("35");
  const [alerts, setAlerts] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const audioRef = useRef<AudioContext | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!userId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`mvp-alerts:${userId}`) ?? "[]");
      setAlerts(Array.isArray(stored) ? stored.filter((x): x is string => typeof x === "string") : []);
      setSoundOn(localStorage.getItem(`mvp-sound:${userId}`) !== "off");
    } catch { setAlerts([]); }
    alertedRef.current = new Set();
    initializedRef.current = false;
  }, [userId]);
  function chime() {
    try {
      const context = audioRef.current;
      if (!context || context.state !== "running") return;
      for (const [index, pitch] of [784, 1047, 1318].entries()) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = "sine"; oscillator.frequency.value = pitch;
        oscillator.connect(gain); gain.connect(context.destination);
        const start = context.currentTime + index * 0.17;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.27);
        oscillator.start(start); oscillator.stop(start + 0.28);
      }
    } catch { /* Browser blocks audio until interaction. */ }
  }
  async function toggleAlert(id: string) {
    if (!userId) return;
    if (alerts.includes(id)) {
      const next = alerts.filter((a) => a !== id);
      setAlerts(next); localStorage.setItem(`mvp-alerts:${userId}`, JSON.stringify(next));
      return;
    }
    // Request browser permission only after this user interaction.
    if ("Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* In-page alerts still work. */ }
    }
    if (soundOn) {
      try {
        audioRef.current ??= new AudioContext();
        await audioRef.current.resume();
      } catch { /* Browser doesn't support sound. */ }
    }
    const next = [...alerts, id];
    setAlerts(next); localStorage.setItem(`mvp-alerts:${userId}`, JSON.stringify(next));
    toast.success("Respawn alert enabled while the tracker is open");
  }
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
  useEffect(() => {
    if (!userId || !data || !alerts.length) return;
    const current = Date.now();
    if (!initializedRef.current) {
      // Do not surprise users with alerts for long-expired timers on first load.
      initializedRef.current = true;
      return;
    }
    for (const spawn of MVP_SPAWNS) {
      const id = mvpSpawnId(spawn);
      if (!alerts.includes(id)) continue;
      const kill = data.kills.find((k) => k.boss_key === spawn.bossKey && k.map_key === spawn.mapKey);
      if (!kill) continue;
      const earliest = new Date(kill.killed_at).getTime() + spawn.minMinutes * 60_000;
      const key = `${userId}:${kill.id}`;
      if (earliest > current || current - earliest > 120_000 || alertedRef.current.has(key)) continue;
      const persisted = `mvp-alerted:${key}`;
      if (localStorage.getItem(persisted)) { alertedRef.current.add(key); continue; }
      alertedRef.current.add(key);
      localStorage.setItem(persisted, "1");
      const message = `${spawn.name} is respawning · ${spawn.mapName}`;
      toast.info(message, { duration: 12000 });
      if (soundOn) chime();
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification(`${spawn.name} is respawning`, { body: spawn.mapName, tag: `mvp-${id}` }); } catch { /* in-page alert remains */ }
      }
    }
  }, [userId, data, alerts, soundOn, now]);
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
    else { toast.success(`${spawn.name} kill recorded`); refresh(); }
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
            return <button key={id} type="button" onClick={() => { setSelected(id); setPendingPin(null); }} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-3 text-left transition hover:bg-secondary ${selected === id ? "bg-secondary ring-1 ring-primary/30" : ""}`}>
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
                <div className="mt-4 border-t border-border pt-4">
                  <Button variant={alerts.includes(selected) ? "default" : "outline"} size="sm" onClick={() => toggleAlert(selected)}>{alerts.includes(selected) ? <Bell className="mr-2 h-4 w-4"/> : <BellOff className="mr-2 h-4 w-4"/>}{alerts.includes(selected) ? "Notifications on" : "Notify me at earliest respawn"}</Button>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={soundOn} onChange={async (e) => { setSoundOn(e.target.checked); if (userId) localStorage.setItem(`mvp-sound:${userId}`, e.target.checked ? "on" : "off"); if (e.target.checked) { try { audioRef.current ??= new AudioContext(); await audioRef.current.resume(); chime(); } catch {} } }}/> <Volume2 className="h-3.5 w-3.5"/> Play alert sound</label>
                  <p className="mt-2 text-[11px] text-muted-foreground">Alerts are saved on this browser and only fire while this tracker page remains open. Allow browser notifications to receive desktop popups. No background or closed-browser push notifications.</p>
                </div>
              </div>
              <div className="rounded-xl border border-border p-5">
                <h3 className="font-semibold">Report an MVP kill</h3>
                <p className="mt-1 text-xs text-muted-foreground">Your report immediately updates the guild-wide timer.</p>
                <Button className="mt-4 w-full" disabled={busy || !!error} onClick={() => report(new Date())}><Zap className="mr-2 h-4 w-4"/>Killed now</Button>
                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/><span>or report a past kill</span><span className="h-px flex-1 bg-border"/></div>
                <label htmlFor="mvp-minutes-ago" className="text-xs font-medium">How many minutes ago was the kill?</label>
                <div className="mt-2 flex items-center gap-2">
                  <Input id="mvp-minutes-ago" aria-label="Minutes ago" type="number" inputMode="numeric" min={0} max={10080} step={1} className="min-w-0 flex-1" value={minutesAgo} onChange={(e) => setMinutesAgo(e.target.value)}/>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">minutes ago</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">{[5,15,30,45,60].map((minutes) => <Button type="button" key={minutes} variant="secondary" size="sm" onClick={() => setMinutesAgo(String(minutes))}>{minutes}m</Button>)}</div>
                <Button className="mt-3 w-full" variant="outline" disabled={!minutesAgo.trim() || !Number.isInteger(Number(minutesAgo)) || Number(minutesAgo) < 0 || Number(minutesAgo) > 10080 || busy || !!error} onClick={() => report(new Date(Date.now() - Number(minutesAgo) * 60_000))}>Save kill · {minutesAgo || "—"} minutes ago</Button>
              </div>
            </div>
          </div>
        </div>
        <section className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2"><div><h3 className="text-lg font-bold">Kill history</h3><p className="text-xs text-muted-foreground">Last reports for this MVP and map</p></div><Crosshair className="h-5 w-5 text-muted-foreground"/></div>
          {!recent.length ? <p className="rounded-lg bg-secondary/30 p-4 text-sm text-muted-foreground">No kills reported yet. Be the first to track this MVP.</p> :
          <div className="divide-y divide-border">{recent.slice(0, 15).map((entry, index) => <div key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div><span className="font-semibold">{dateTime(entry.killed_at)}</span>{index === 0 && <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Current timer</span>}<p className="text-xs text-muted-foreground">Recorded {dateTime(entry.created_at)}</p></div>{entry.reporter_id === userId && <Button size="sm" variant="ghost" disabled={busy} aria-label="Undo this kill report" title="Undo your report" onClick={() => undo(entry.id)}><Trash2 className="h-4 w-4"/></Button>}</div>)}</div>}
        </section>
        <p className="text-xs leading-relaxed text-muted-foreground">MVP spawn locations and reference timers are historical Episode 8.2 estimates, not yet validated against SoulBound's server configuration. GAT maps load directly from your extracted Ragnarokmap repository; unavailable maps cannot be pinned.</p>
      </div>
    </div>}
  </main>;
}
