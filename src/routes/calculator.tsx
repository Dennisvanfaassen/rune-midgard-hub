import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobSelect, fieldClass } from "@/components/JobSelect";
import { jobName } from "@/lib/ro/jobs";
import { SLOTS, cardFits, fitsSlot, loadEngine, type Engine } from "@/lib/ro/engine";
import { CalculatorOptions, emptyOptions, type BuildOptions } from "@/components/CalculatorOptions";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "Stat Calculator · Rune Midgard" },
      { name: "description", content: "Pre-renewal Ragnarok Online stat calculator: HP, SP, ATK, MATK, DEF, Hit, Flee, Crit and ASPD." },
      { property: "og:title", content: "Stat Calculator · Rune Midgard" },
      { property: "og:description", content: "Pre-renewal Ragnarok Online stat calculator with gear and cards." },
    ],
  }),
  component: Calculator,
});

const ST = ["str", "agi", "vit", "int", "dex", "luk"] as const;
type Equip = Record<string, { key: string; refine: number; cards: string[]; forgedEle?: string; starCrumbs?: number }>;

function Calculator() {
  const { userId } = useAuth();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [job, setJob] = useState("Knight");
  const [baseLv, setBaseLv] = useState(99);
  const [jobLv, setJobLv] = useState(50);
  const [stats, setStats] = useState<Record<string, number>>({ str: 90, agi: 60, vit: 60, int: 1, dex: 40, luk: 1 });
  const [equip, setEquip] = useState<Equip>({});
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [options, setOptions] = useState<BuildOptions>(emptyOptions);

  useEffect(() => { loadEngine().then(setEngine).catch(() => toast.error("Could not load game data")); }, []);
  // Load own saved build
  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("stat_build,skill_build,job,base_lv,job_lv").eq("id", userId).maybeSingle().then(({ data }) => {
      const sb = data?.stat_build as any;
      if (sb?.build) {
        setJob(sb.build.job); setBaseLv(sb.build.baseLv); setJobLv(sb.build.jobLv); setStats(sb.build.stats); setEquip(sb.build.equip ?? {});
        setOptions({ buffs: sb.build.buffs ?? {}, manual: sb.build.manual ?? {}, pet: sb.build.pet ?? null, settings: sb.build.settings ?? {} });
      } else if (data) { setJob(data.job); setBaseLv(data.base_lv); setJobLv(data.job_lv); }
      const kb = data?.skill_build as any;
      if (kb?.lv) setSkills(kb.lv);
    });
  }, [userId]);

  const build = useMemo(() => ({ job, baseLv, jobLv, stats, skills, equip, ...options }), [job, baseLv, jobLv, stats, skills, equip, options]);
  const result = useMemo(() => {
    if (!engine) return null;
    try { return { s: engine.CalcStatus.compute(build, engine.D), probs: engine.CalcStatus.validate(build, engine.D) }; }
    catch (e) { return { err: String((e as Error).message ?? e) }; }
  }, [engine, build]);

  const usable = useMemo(() => {
    if (!engine) return {} as Record<string, Engine["items"]>;
    const jn = jobName(job);
    const out: Record<string, Engine["items"]> = {};
    for (const [slot] of SLOTS) out[slot] = engine.items.filter((i) => (fitsSlot(i, slot) || (slot === "left" && job === "Assassin" && i.type === "Weapon" && i.loc === "Weapon")) && (!i.jobs || i.jobs.includes(jn))).sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [engine, job]);
  const cards = useMemo(() => engine?.items.filter((i) => i.type === "Card").sort((a, b) => a.name.localeCompare(b.name)) ?? [], [engine]);

  const s = result && "s" in result ? result.s : null;
  const summary = s ? {
    "Max HP": s.maxhp, "Max SP": s.maxsp, ATK: `${s.batk} + ${(s.right?.watk ?? 0) + (s.right?.refineAtk ?? 0)}`, MATK: `${s.matkMin} – ${s.matkMax}`,
    DEF: `${s.def} + ${s.def2}`, MDEF: `${s.mdef} + ${s.mdef2}`, HIT: s.hit, FLEE: `${s.flee} + ${s.flee2}`, CRIT: s.cri, ASPD: s.aspd,
    "Status points": `${s.statPointsUsed} / ${s.statPointsTotal}`,
    "Weapon element": s.right?.element ?? "Neutral", "Armor element": s.armorEle,
    "Cast time": `${s.castRate}%`, "Skill delay": `${s.delayRate}%`, "SP cost": `${s.spCostRate}%`,
    "HP regen": s.regen?.hp ?? 0, "SP regen": s.regen?.sp ?? 0,
  } : null;

  async function save() {
    if (!userId || !summary) return;
    const { error } = await supabase.from("profiles").update({ stat_build: { build, summary } as any, job, base_lv: baseLv, job_lv: jobLv }).eq("id", userId);
    if (error) toast.error(error.message); else toast.success("Build saved to your profile");
  }
  const setSlot = (slot: string, patch: Partial<Equip[string]>) =>
    setEquip((e) => {
      const cur = e[slot] ?? { key: "", refine: 0, cards: [] };
      const next = { ...cur, ...patch };
      if (!next.key) { const { [slot]: _, ...rest } = e; return rest; }
      return { ...e, [slot]: next };
    });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-bold">Stat Calculator</h1>
        {userId && <Button className="ml-auto" onClick={save} disabled={!summary}>Save to my profile</Button>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Pre-renewal formulas. Learned skills come from your saved skill build.</p>
      {!engine && <p className="mt-6 text-muted-foreground">Loading game data…</p>}
      {engine && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap gap-3">
                <label className="text-sm">Class<br /><JobSelect value={job} onChange={setJob} /></label>
                <label className="text-sm">Base level<br /><Input type="number" min={1} max={99} value={baseLv} className="w-24" onChange={(e) => setBaseLv(Math.min(99, Math.max(1, +e.target.value | 0)))} /></label>
                <label className="text-sm">Job level<br /><Input type="number" min={1} max={70} value={jobLv} className="w-24" onChange={(e) => setJobLv(Math.min(70, Math.max(1, +e.target.value | 0)))} /></label>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ST.map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-10 text-sm font-bold uppercase text-primary">{k}</span>
                    <Input type="number" min={1} max={99} value={stats[k]} className="w-20" onChange={(e) => setStats({ ...stats, [k]: Math.min(99, Math.max(1, +e.target.value | 0)) })} />
                    {s && <span className="text-xs text-muted-foreground">+{s[k].bonus}</span>}
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-xl font-bold">Equipment</h2>
              <div className="mt-3 space-y-3">
                {SLOTS.map(([slot, label]) => {
                  const e = equip[slot];
                  const item = e ? engine.itemsByKey[e.key] : null;
                  return (
                    <div key={slot} className="flex flex-wrap items-center gap-2">
                      <span className="w-32 text-sm text-muted-foreground">{label}</span>
                      <select className={fieldClass + " min-w-48 flex-1"} value={e?.key ?? ""} onChange={(ev) => setSlot(slot, { key: ev.target.value, cards: [] })}>
                        <option value="">— none —</option>
                        {(usable[slot] ?? []).map((i: Engine["items"][number]) => <option key={i.key} value={i.key}>{i.name}{i.slots ? ` [${i.slots}]` : ""}</option>)}
                      </select>
                      {item && slot !== "ammo" && (
                        <select aria-label={`${label} refinement`} className={fieldClass} value={e?.refine ?? 0} onChange={(ev) => setSlot(slot, { refine: +ev.target.value })}>
                          {Array.from({ length: 11 }, (_, r) => <option key={r} value={r}>+{r}</option>)}
                        </select>
                      )}
                      {item && Array.from({ length: item.slots ?? 0 }, (_, ci) => (
                        <select key={ci} className={fieldClass + " max-w-44"} value={e?.cards[ci] ?? ""}
                          onChange={(ev) => { const c = [...(e?.cards ?? [])]; c[ci] = ev.target.value; setSlot(slot, { cards: c }); }}>
                          <option value="">Card slot</option>
                          {cards.filter((c) => cardFits(c, slot)).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                        </select>
                      ))}
                      {item?.type === "Weapon" && <>
                        <select aria-label={`${label} forged element`} className={fieldClass} value={e?.forgedEle ?? ""} onChange={(ev) => setSlot(slot, { forgedEle: ev.target.value, cards: [] })}><option value="">Not forged</option>{["Neutral", "Water", "Earth", "Fire", "Wind", "Poison", "Holy", "Dark", "Ghost", "Undead"].map((ele) => <option key={ele}>{ele}</option>)}</select>
                        <select aria-label={`${label} star crumbs`} className={fieldClass} value={e?.starCrumbs ?? 0} onChange={(ev) => setSlot(slot, { starCrumbs: +ev.target.value, cards: [] })}>{[0, 1, 2, 3].map((v) => <option value={v} key={v}>{v} stars</option>)}</select>
                      </>}
                    </div>
                  );
                })}
              </div>
            </section>
            <CalculatorOptions engine={engine} options={options} onChange={setOptions} />
          </div>
          <aside className="h-fit rounded-lg border border-primary/40 bg-card p-4 lg:sticky lg:top-20">
            <h2 className="text-xl font-bold">Results</h2>
            {result && "err" in result && <p className="text-sm text-destructive">{result.err}</p>}
            {summary && (
              <dl className="mt-3 space-y-1 text-sm">
                {Object.entries(summary).map(([k, v]) => <div key={k} className="flex justify-between border-b border-border py-1"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
              </dl>
            )}
            {result && "probs" in result && result.probs.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-destructive">{result.probs.map((p, i) => <li key={i}>{p}</li>)}</ul>
            )}
            {!!s?.notes?.length && <ul className="mt-3 space-y-2 text-xs text-muted-foreground">{s.notes.map((note: string, i: number) => <li key={i}>{note}</li>)}</ul>}
          </aside>
        </div>
      )}
    </main>
  );
}
