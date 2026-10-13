import type { Engine } from "@/lib/ro/engine";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fieldClass } from "@/components/JobSelect";

export type BuildOptions = {
  buffs: Record<string, any>;
  manual: Record<string, number>;
  pet: { mob: string; loyal: boolean; acc: boolean } | null;
  settings: { sex?: string; riding?: boolean; falcon?: boolean; itemSource?: string };
};
export const emptyOptions: BuildOptions = { buffs: {}, manual: {}, pet: null, settings: {} };

export function CalculatorOptions({ engine, options, onChange }: { engine: Engine; options: BuildOptions; onChange: (value: BuildOptions) => void }) {
  const buffs = engine.CalcStatus.BUFFS;
  const setBuff = (id: string, v: any) => onChange({ ...options, buffs: { ...options.buffs, [id]: v } });
  return <section className="border-t border-border pt-5">
    <Tabs defaultValue="buffs">
      <TabsList className="mb-4 flex h-auto flex-wrap justify-start"><TabsTrigger value="buffs">Buffs & foods</TabsTrigger><TabsTrigger value="pets">Pet & character</TabsTrigger><TabsTrigger value="manual">Custom bonuses</TabsTrigger></TabsList>
      <TabsContent value="buffs" className="space-y-5">
        {["party", "self", "song", "endow", "item"].map((group) => <div key={group}>
          <h3 className="mb-3 text-sm font-bold uppercase text-primary">{({ party: "Party support", self: "Self buffs", song: "Songs & dances", endow: "Weapon element", item: "Potions & stat foods" } as Record<string, string>)[group]}</h3>
          <div className="grid gap-3 sm:grid-cols-2">{buffs.filter((b) => b.group === group).map((b) => {
            const value = options.buffs[b.id];
            return <label key={b.id} className="flex min-w-0 items-center justify-between gap-3 text-sm"><span>{b.name}</span>
              {b.kind === "bool" ? <Switch aria-label={b.name} checked={!!value} onCheckedChange={(v) => setBuff(b.id, v)} /> : b.kind === "element" ?
                <select aria-label={b.name} className={fieldClass + " w-28 shrink-0"} value={value || ""} onChange={(e) => setBuff(b.id, e.target.value)}><option value="">None</option>{b.values?.map((v) => <option key={v}>{v}</option>)}</select> : b.kind === "autospell" ?
                <div className="flex gap-1"><Input aria-label={`${b.name} level`} className="w-16" type="number" min={0} max={b.maxLv} value={value?.lv || 0} onChange={(e) => setBuff(b.id, { lv: Math.max(0, Math.min(b.maxLv, +e.target.value)), skill: value?.skill || "MG_COLDBOLT" })} /><select aria-label={`${b.name} spell`} className={fieldClass + " max-w-28"} value={value?.skill || "MG_COLDBOLT"} onChange={(e) => setBuff(b.id, { lv: value?.lv || 0, skill: e.target.value })}>{b.values?.map((v) => <option key={v} value={v}>{engine.D.SKT.skills[v]?.name || v}</option>)}</select></div> :
                <select aria-label={b.name} className={fieldClass + " w-20 shrink-0"} value={value || 0} onChange={(e) => setBuff(b.id, +e.target.value)}>{Array.from({ length: b.maxLv + 1 }, (_, lv) => <option key={lv} value={lv}>{lv ? `Lv ${lv}` : "Off"}</option>)}</select>}
            </label>;
          })}</div>
          {group === "song" && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{["agi", "dex", "int", "vit", "luk", "lessons"].map((key) => <label key={key} className="text-xs text-muted-foreground">Caster {key.toUpperCase()}<Input aria-label={`Song caster ${key}`} type="number" min={0} max={key === "lessons" ? 10 : 999} value={options.buffs.SONG_CASTER?.[key] ?? engine.CalcStatus.SONG_CASTER[key]} onChange={(e) => setBuff("SONG_CASTER", { ...engine.CalcStatus.SONG_CASTER, ...options.buffs.SONG_CASTER, [key]: Math.max(0, Math.min(key === "lessons" ? 10 : 999, +e.target.value)) })} /></label>)}</div>}
        </div>)}
      </TabsContent>
      <TabsContent value="pets" className="space-y-4">
        <label className="block text-sm">Pet<select aria-label="Pet" className={fieldClass + " mt-1 w-full"} value={options.pet?.mob || ""} onChange={(e) => onChange({ ...options, pet: e.target.value ? { mob: e.target.value, loyal: true, acc: true } : null })}><option value="">No pet</option>{engine.D.pets.map((p: { mob: string }) => <option key={p.mob} value={p.mob}>{engine.mobNames[p.mob] || p.mob}</option>)}</select></label>
        {options.pet && <div className="flex flex-wrap gap-5">{["loyal", "acc"].map((key) => <label key={key} className="flex items-center gap-2 text-sm"><Switch aria-label={key === "loyal" ? "Loyal pet" : "Pet accessory"} checked={!!options.pet?.[key as "loyal" | "acc"]} onCheckedChange={(v) => { if (options.pet) onChange({ ...options, pet: { ...options.pet, [key]: v } }); }} />{key === "loyal" ? "Loyal pet" : "Pet accessory"}</label>)}</div>}
        <label className="block text-sm">Gender<select aria-label="Character gender" className={fieldClass + " ml-3"} value={options.settings.sex || "Male"} onChange={(e) => onChange({ ...options, settings: { ...options.settings, sex: e.target.value } })}><option>Male</option><option>Female</option></select></label>
        {["riding", "falcon"].map((key) => <label key={key} className="flex items-center gap-2 text-sm"><Switch aria-label={key === "riding" ? "Peco Peco mounted" : "Falcon active"} checked={!!options.settings[key as "riding" | "falcon"]} onCheckedChange={(v) => onChange({ ...options, settings: { ...options.settings, [key]: v } })} />{key === "riding" ? "Peco Peco mounted" : "Falcon active"}</label>)}
        <label className="block text-sm">Item bonus source<select aria-label="Item bonus source" className={fieldClass + " ml-3"} value={options.settings.itemSource || "database"} onChange={(e) => onChange({ ...options, settings: { ...options.settings, itemSource: e.target.value } })}><option value="database">Uploaded database</option><option value="rathena">rAthena pre-renewal</option></select></label>
      </TabsContent>
      <TabsContent value="manual"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{engine.CalcStatus.MANUAL_NUM.map((key) => <label key={key} className="text-xs text-muted-foreground">{key.replace(/([A-Z])/g, " $1").toUpperCase()}<Input aria-label={`Bonus ${key}`} type="number" value={options.manual[key] || 0} onChange={(e) => onChange({ ...options, manual: { ...options.manual, [key]: +e.target.value || 0 } })} /></label>)}</div></TabsContent>
    </Tabs>
  </section>;
}