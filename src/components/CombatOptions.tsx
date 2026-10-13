import { useMemo, useState } from "react";
import type { Engine } from "@/lib/ro/engine";
import { fieldClass } from "@/components/JobSelect";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

export type CombatSelection = { mob: string; skill: string; lv: number; debuffs: Record<string, boolean> };
export const defaultCombat: CombatSelection = { mob: "PORING", skill: "", lv: 1, debuffs: {} };
export function CombatOptions({ engine, status, selection, onChange }: { engine: Engine; status: any; selection: CombatSelection; onChange: (v: CombatSelection) => void }) {
  const [search, setSearch] = useState("");
  const mob = engine.mobs.find((m) => m.key === selection.mob);
  const skills = status ? engine.CalcBattle.attackSkills(status, engine.D) : [];
  const result = useMemo(() => {
    if (!status || !mob) return null;
    try {
      const target = engine.CalcBattle.targetFromMob(mob, engine.D);
      target.debuffs = selection.debuffs;
      return { data: engine.CalcBattle.compute(status, target, selection.skill ? { id: selection.skill, lv: selection.lv } : null, engine.D, {}) };
    } catch (e) { return { error: e instanceof Error ? e.message : "Could not calculate damage" }; }
  }, [status, mob, engine, selection]);
  const r = result?.data;
  return <section className="border-t border-border pt-5">
    <h2 className="mb-4 text-xl font-bold">Combat target</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <Input aria-label="Search monsters" placeholder="Search monsters" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Target monster" className={fieldClass} value={selection.mob} onChange={(e) => onChange({ ...selection, mob: e.target.value })}>{engine.mobs.filter((m) => m.key === selection.mob || m.name.toLowerCase().includes(search.toLowerCase())).map((m) => <option value={m.key} key={m.key}>{m.name} · Lv {m.lv}</option>)}</select>
      <select aria-label="Attack skill" className={fieldClass} value={selection.skill} onChange={(e) => { const skill = skills.find((s) => s.id === e.target.value); onChange({ ...selection, skill: e.target.value, lv: skill?.lv || 1 }); }}><option value="">Basic attack</option>{skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      {selection.skill && <Input aria-label="Attack skill level" type="number" min={1} max={skills.find((s) => s.id === selection.skill)?.lv || 1} value={selection.lv} onChange={(e) => onChange({ ...selection, lv: Math.max(1, Math.min(skills.find((s) => s.id === selection.skill)?.lv || 1, +e.target.value)) })} />}
    </div>
    {mob && <p className="mt-3 text-sm text-muted-foreground">HP {mob.hp.toLocaleString()} · {mob.race} · {mob.size} · {mob.element} {mob.elv} · DEF {mob.def} · MDEF {mob.mdef}</p>}
    <div className="mt-4 flex flex-wrap gap-4">{[["frozen", "Frozen"], ["stone", "Stone Curse"], ["lex", "Lex Aeterna"]].map(([key, label]) => key && <label key={key} className="flex items-center gap-2 text-sm"><Switch aria-label={label} checked={!!selection.debuffs[key]} onCheckedChange={(v) => onChange({ ...selection, debuffs: { ...selection.debuffs, [key]: v } })} />{label}</label>)}</div>
    {result?.error && <p className="mt-3 text-sm text-destructive">{result.error}</p>}
    {r && <><dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{Object.entries({ "Damage": `${r.total.min} – ${r.total.max}`, "Average damage": Math.round(r.total.avg), "Hit chance": `${(r.hitChance * 100).toFixed(1)}%`, "DPS": Math.round(r.dps), "Attacks to kill": Number.isFinite(r.hitsToKill) ? r.hitsToKill : "—", "Cast / delay": `${r.castTime} / ${r.afterCast} ms` }).map(([key, value]) => <div key={key} className="border-b border-border py-2"><dt className="text-xs text-muted-foreground">{key}</dt><dd className="text-lg font-semibold text-primary">{value}</dd></div>)}</dl>
      {!!r.notes.length && <details className="mt-3 text-xs text-muted-foreground"><summary>Calculation notes</summary><ul className="mt-2 space-y-1">{r.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul></details>}</>}
  </section>;
}