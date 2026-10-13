import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { JobSelect, fieldClass } from "@/components/JobSelect";
import { jobName } from "@/lib/ro/jobs";
import { loadSkt, type SktData } from "@/lib/ro/engine";
import { SkillIcon } from "@/components/SkillIcon";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skill Simulator · Rune Midgard" },
      { name: "description", content: "Plan your Ragnarok Online skill tree with prerequisites and skill point limits." },
      { property: "og:title", content: "Skill Simulator · Rune Midgard" },
      { property: "og:description", content: "Plan your Ragnarok Online skill tree with prerequisites and skill point limits." },
    ],
  }),
  component: Skills,
});

const LINKONLY = new Set(["KN_ONEHAND", "BS_ADRENALINE2", "HT_POWER", "AM_TWILIGHT1", "AM_TWILIGHT2", "AM_TWILIGHT3"]);
type Info = Record<string, { tier: "t1" | "t2"; max: number; req: [string, number][]; quest: boolean }>;

function tiersOf(skt: SktData, job: string) {
  const J = skt.jobs[job];
  if (!J) return [];
  const first = J.inherit.find((x) => x !== "Novice");
  const t: { key: "t1" | "t2"; job: string; list: SktData["jobs"][string]["tree"] }[] = [];
  if (first && skt.jobs[first]) t.push({ key: "t1", job: first, list: skt.jobs[first].tree.filter((s) => !LINKONLY.has(s[0])) });
  t.push({ key: first ? "t2" : "t1", job, list: J.tree.filter((s) => !LINKONLY.has(s[0])) });
  return t;
}
function pools(skt: SktData, job: string, jl: number) {
  if (job === "Supernovice") return { t1: 98 } as { t1: number; t2?: number };
  const first = skt.jobs[job]?.inherit.find((x) => x !== "Novice");
  return first ? { t1: jl - 1, t2: 49 } : { t1: 49 };
}

function Skills() {
  const { userId } = useAuth();
  const [skt, setSkt] = useState<SktData | null>(null);
  const [job, setJob] = useState("Knight");
  const [jl, setJl] = useState(50);
  const [lv, setLv] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");
  useEffect(() => { loadSkt().then(setSkt); }, []);
  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("skill_build,job").eq("id", userId).maybeSingle().then(({ data }) => {
      const kb = data?.skill_build as any;
      if (kb?.job) { setJob(kb.job); setJl(kb.jl ?? 50); setLv(kb.lv ?? {}); } else if (data?.job && data.job !== "Novice") setJob(data.job);
    });
  }, [userId]);

  const tiers = useMemo(() => (skt && skt.jobs[job] ? tiersOf(skt, job) : []), [skt, job]);
  const info = useMemo(() => {
    const i: Info = {};
    for (const t of tiers) for (const [n, mx, req] of t.list) i[n] = { tier: t.key, max: mx, req, quest: !!skt?.skills[n]?.quest };
    return i;
  }, [tiers, skt]);

  const used = { t1: 0, t2: 0 };
  for (const [n, l] of Object.entries(lv)) { const i = info[n]; if (i && !i.quest) used[i.tier] += l; }
  const pool = skt && skt.jobs[job] ? pools(skt, job, jl) : { t1: 0 };

  function validate(next: Record<string, number>) {
    const u = { t1: 0, t2: 0 };
    for (const [n, l] of Object.entries(next)) { const i = info[n]; if (i && !i.quest) u[i.tier] += l; }
    if (pool.t2 != null) {
      if (u.t2 > pool.t2) return `Not enough ${jobName(job)} skill points`;
      if (u.t1 > pool.t1 + (pool.t2 - u.t2)) return "Not enough skill points";
    } else if (u.t1 > pool.t1) return "Not enough skill points";
    return null;
  }
  function set(name: string, target: number) {
    const i = info[name]; if (!i || i.quest) return;
    target = Math.max(0, Math.min(i.max, target));
    const next = { ...lv };
    const raise = (n: string, l: number) => { const ii = info[n]; if (!ii) return; if ((next[n] || 0) < l) { next[n] = Math.min(l, ii.max); for (const [rn, rl] of ii.req) raise(rn, rl); } };
    if (target > (next[name] || 0)) raise(name, target);
    else {
      next[name] = target;
      let changed = true;
      while (changed) {
        changed = false;
        for (const [n, l] of Object.entries(next)) { const ii = info[n]; if (l && ii && !ii.quest && ii.req.some(([rn, rl]) => (next[rn] || 0) < rl)) { next[n] = 0; changed = true; } }
      }
    }
    for (const k of Object.keys(next)) if (!next[k]) delete next[k];
    const err = validate(next);
    if (err) { setMsg(err); setTimeout(() => setMsg(""), 2500); return; }
    setMsg(""); setLv(next);
  }
  async function save() {
    if (!userId) return;
    const { error } = await supabase.from("profiles").update({ skill_build: { job, jl, lv } as any }).eq("id", userId);
    if (error) toast.error(error.message); else toast.success("Skill build saved to your profile");
  }

  const hasFirst = pool.t2 != null;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-4xl font-bold">Skill Simulator</h1>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <label className="text-sm">Class<br /><JobSelect value={job} onChange={(j) => { if (j !== "Novice") { setJob(j); setLv({}); } }} /></label>
          {hasFirst && (
            <label className="text-sm">1st class job level<br />
              <select className={fieldClass} value={jl} onChange={(e) => { setJl(+e.target.value); setLv({}); }}>
                {Array.from({ length: 11 }, (_, i) => 40 + i).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <Button variant="outline" onClick={() => setLv({})}><RotateCcw />Reset</Button>
          {userId && <Button onClick={save}>Save to my profile</Button>}
        </div>
      </div>
      <p className="mt-2 h-5 text-sm text-destructive">{msg}</p>
      {!skt && <p className="text-muted-foreground">Loading skills…</p>}
      <Tabs defaultValue="t1" className="mt-2">
        <TabsList>{tiers.map((t) => <TabsTrigger key={t.key} value={t.key}>{jobName(t.job)}</TabsTrigger>)}</TabsList>
        {tiers.map((t) => {
          const left = t.key === "t1" ? pool.t1 - used.t1 : (pool.t2 ?? 0) - used.t2;
          return (
            <TabsContent key={t.key} value={t.key} className="border-t border-border py-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-bold">{jobName(t.job)}</h2>
                <span className={"text-sm " + (left < 0 ? "text-destructive" : "text-primary")}>{left} points left</span>
              </div>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {t.list.map(([n, mx, req]) => {
                  const sk = skt?.skills[n];
                  const quest = sk?.quest;
                  const cur = lv[n] || 0;
                  return (
                    <li key={n} className={"flex min-w-0 flex-col items-center rounded-md border p-3 text-center " + (cur ? "border-primary/60 bg-secondary" : "border-border bg-card")}>
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-md border border-border bg-background"><SkillIcon id={n} name={sk?.name ?? n} /></div>
                      <div className="min-h-10 text-sm font-semibold">{sk?.name ?? n}</div>
                      <div className="mt-1 min-h-10 text-xs text-muted-foreground">{quest ? "Quest skill" : req.length ? req.map(([r, l]) => `${skt?.skills[r]?.name ?? r} ${l}`).join(" · ") : "No prerequisite"}</div>
                      {!quest && (
                        <div className="mt-auto flex items-center justify-center pt-2">
                          <Button aria-label={`Decrease ${sk?.name ?? n}`} title="Decrease level" size="icon" variant="ghost" className="h-7 w-7" onClick={() => set(n, cur - 1)} disabled={!cur}><Minus /></Button>
                          <select aria-label={`${sk?.name ?? n} level`} className="h-7 w-14 rounded border border-input bg-background text-center text-sm text-primary" value={cur} onChange={(e) => set(n, +e.target.value)}>{Array.from({ length: mx + 1 }, (_, v) => <option value={v} key={v}>{v}/{mx}</option>)}</select>
                          <Button aria-label={`Increase ${sk?.name ?? n}`} title="Increase level" size="icon" variant="ghost" className="h-7 w-7" onClick={() => set(n, cur + 1)} disabled={cur >= mx}><Plus /></Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          );
        })}
      </Tabs>
    </main>
  );
}
