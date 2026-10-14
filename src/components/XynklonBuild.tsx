import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BUILDER = "https://soulbound.xynklon.workers.dev/";
export type ExternalBuild = { external_url?: string; source?: string };

export function validateXynklonUrl(raw: string): { url: string; payload: Record<string, unknown> } | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:" || parsed.hostname !== "soulbound.xynklon.workers.dev" || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/") return null;
    const match = /^#calc=([A-Za-z0-9_-]+)$/.exec(parsed.hash);
    if (!match || match[1].length > 12000) return null;
    const code = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(code.padEnd(Math.ceil(code.length / 4) * 4, "="));
    const bytes = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || Array.isArray(data) || typeof data !== "object") return null;
    const payload = data as Record<string, unknown>;
    if (payload.v !== 1) return null;
    return { url: BUILDER + "#calc=" + match[1], payload };
  } catch { return null; }
}

type SlotItem = { slot: string; key: string; refine: number; cards: string[] };
type GearRecord = { item_key: string; status: string };
const LABELS: Record<string, string> = { weapon: "Weapon", left: "Off-hand / Shield", headTop: "Upper headgear", headMid: "Middle headgear", headLow: "Lower headgear", armor: "Armor", garment: "Garment", shoes: "Shoes", acc1: "Accessory 1", acc2: "Accessory 2" };
const STATS = ["STR", "AGI", "VIT", "INT", "DEX", "LUK"];
function itemName(key: string) { return key.replace(/_+$/, "").replace(/_+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim(); }
function extractEquipment(payload: Record<string, unknown>): SlotItem[] {
  const equipment = payload.e;
  if (!equipment || typeof equipment !== "object" || Array.isArray(equipment)) return [];
  return Object.entries(equipment as Record<string, unknown>).flatMap(([slot, val]) => {
    const raw = Array.isArray(val) ? val[0] : val;
    if (typeof raw !== "string" || !raw || raw.length > 120) return [];
    const refine = Array.isArray(val) && typeof val[1] === "number" ? Math.max(0, Math.min(20, val[1])) : 0;
    const cards = Array.isArray(val) && Array.isArray(val[2]) ? val[2].filter((x): x is string => typeof x === "string" && x.length < 120) : [];
    return [{ slot, key: raw, refine, cards }];
  });
}
export function XynklonBuild({ ownerId, isOwner, saved, onSaved, job, wishlist, onGearChanged }: { ownerId: string; isOwner: boolean; saved: string | null; onSaved: () => void; job: string; wishlist: GearRecord[]; onGearChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(saved ?? "");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const build = saved ? validateXynklonUrl(saved) : null;
  const stats = build && Array.isArray(build.payload.s) && build.payload.s.length === 6 && build.payload.s.every((x) => typeof x === "number" && Number.isFinite(x)) ? build.payload.s as number[] : null;
  const equipment = build ? extractEquipment(build.payload) : [];
  const [gearBusy, setGearBusy] = useState<string | null>(null);
  const statusOf = (key: string) => wishlist.find((g) => g.item_key === key)?.status;
  async function setGear(key: string, status: "have" | "need") {
    if (!isOwner) return;
    setGearBusy(key);
    const { error } = await supabase.from("gear_wishlist").upsert({
      user_id: ownerId, item_key: key, item_name: itemName(key),
      item_type: key.includes("Card") ? "Card" : "Equipment", status
    }, { onConflict: "user_id,item_key" });
    setGearBusy(null);
    if (error) toast.error(error.message);
    else onGearChanged();
  }

  async function save(url: string | null) {
    const parsed = url ? validateXynklonUrl(url) : null;
    if (url && !parsed) { toast.error("Paste a valid Xynklon share link containing #calc=."); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ stat_build: url ? { source: "xynklon", external_url: parsed!.url } : null }).eq("id", ownerId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile", ownerId] });
    onSaved();
    setEditing(false);
    toast.success(url ? "Xynklon build saved to your profile" : "Build link removed");
  }

  return <section className="rounded-lg border border-border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">Character build</h2>
        <p className="mt-1 text-sm text-muted-foreground">Stats and skills planned with the SoulBound Xynklon calculator.</p>
      </div>
      {isOwner && <Button variant="outline" size="sm" onClick={() => { setValue(saved ?? ""); setEditing((v) => !v); }}><Link2 className="mr-2 h-4 w-4" />{saved ? "Change link" : "Add build link"}</Button>}
    </div>
    {build && <div className="mt-4 space-y-3">
      <Button asChild><a href={build.url} target="_blank" rel="noopener noreferrer">Open stats & skills in Xynklon <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
      <div className="rounded-md bg-secondary/40 p-3"><div className="text-xs uppercase text-muted-foreground">Character class (guild profile)</div><strong className="text-lg text-primary">{job}</strong><p className="text-xs text-muted-foreground">This calculator link does not specify a class; change it under Edit profile.</p></div>
      {stats && <div><h3 className="mb-2 font-semibold">Base stats</h3><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{stats.map((n, i) => <div key={STATS[i]} className="rounded-md border border-border bg-secondary/50 p-3 text-center"><div className="text-xs font-bold text-muted-foreground">{STATS[i]}</div><div className="text-xl font-bold text-primary">{n}</div></div>)}</div></div>}
      {equipment.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Planned equipment</h3><p className="text-xs text-muted-foreground">Mark each item or card as owned or still needed. Repeated copies of the same item share one wishlist status.</p>
        {equipment.map((item) => <div key={item.slot} className="rounded-md border border-border p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{LABELS[item.slot] ?? item.slot}</div>
          {[item.key, ...item.cards].map((key, i) => <div key={i} className="flex flex-wrap items-center gap-2 border-t border-border/50 py-2 text-sm">
            <span className="min-w-0 flex-1 font-medium">{i === 0 && item.refine ? `+${item.refine} ` : ""}{itemName(key)}{i > 0 ? " (card)" : ""}</span>
            {statusOf(key) && <span className={statusOf(key) === "have" ? "text-xs text-success" : "text-xs text-destructive"}>{statusOf(key) === "have" ? "I have this" : "Still need"}</span>}
            {isOwner && <div className="flex gap-1"><Button size="sm" variant={statusOf(key) === "have" ? "default" : "outline"} disabled={gearBusy === key} onClick={() => setGear(key, "have")}>I have this</Button><Button size="sm" variant={statusOf(key) === "need" ? "default" : "outline"} disabled={gearBusy === key} onClick={() => setGear(key, "need")}>Still need</Button></div>}
          </div>)}
        </div>)}
      </div>}
      {!stats && equipment.length === 0 && <p className="text-xs text-muted-foreground">This link has no readable stat or equipment values. Open it in Xynklon to view the build.</p>}
      <p className="text-xs text-muted-foreground">Skill allocations are not present in this export and cannot be displayed automatically.</p>
    </div>}
    {!build && <p className="mt-3 text-sm text-muted-foreground">{saved ? "This previously saved link is invalid." : "No Xynklon build linked yet."} {isOwner && "Make a build in Xynklon, copy its share URL and add it here."}</p>}
    {editing && isOwner && <div className="mt-4 space-y-3 rounded-md border border-border bg-secondary/30 p-3">
      <label className="block text-sm font-semibold" htmlFor="xynklon-link">Xynklon share URL</label>
      <Input id="xynklon-link" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://soulbound.xynklon.workers.dev/#calc=..." />
      <p className="text-xs text-muted-foreground">Only valid links from soulbound.xynklon.workers.dev are accepted. A link that contains only &#123;&quot;v&quot;:1&#125; cannot display stats locally.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !value.trim()} onClick={() => save(value)}>Save build link</Button>
        {saved && <Button disabled={busy} variant="outline" onClick={() => save(null)}><Trash2 className="mr-2 h-4 w-4" />Remove link</Button>}
        <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>}
    <p className="mt-4 text-xs text-muted-foreground">External calculator: <a className="text-primary underline" href={BUILDER} target="_blank" rel="noopener noreferrer">SoulBound Xynklon ↗</a></p>
  </section>;
}
