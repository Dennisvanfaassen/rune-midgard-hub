import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { JobSelect } from "@/components/JobSelect";
import { jobName, itemLabel } from "@/lib/ro/jobs";
import { loadEngine, loadSkt, type Engine, type SktData } from "@/lib/ro/engine";

export const Route = createFileRoute("/members/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Member profile · Rune Midgard" },
      { name: "description", content: "A guild member's stat build, skill build and gear wishlist." },
      { property: "og:title", content: "Member profile · Rune Midgard" },
      { property: "og:description", content: "A guild member's stat build, skill build and gear wishlist." },
    ],
  }),
  component: Profile,
});

type StatBuild = { build: { buffs?: Record<string, any>; pet?: { mob: string; loyal: boolean }; manual?: Record<string, number>; combat?: { mob: string }; stats: Record<string, number>; equip: Record<string, { key: string; refine: number; cards: string[] }> }; summary: Record<string, number | string> };
type SkillBuild = { job: string; jl: number; lv: Record<string, number> };

function Profile() {
  const { id } = Route.useParams();
  const { userId } = useAuth();
  const isOwner = userId === id;
  const qc = useQueryClient();
  const { data: p, isLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", id).maybeSingle()).data,
  });
  const gear = useQuery({
    queryKey: ["gear", id],
    queryFn: async () => (await supabase.from("gear_wishlist").select("*").eq("user_id", id).order("created_at")).data ?? [],
  });
  const [engine, setEngine] = useState<Engine | null>(null);
  const [skt, setSkt] = useState<SktData | null>(null);
  useEffect(() => { loadEngine().then(setEngine); loadSkt().then(setSkt); }, []);

  if (isLoading) return <main className="mx-auto max-w-5xl px-4 py-10 text-muted-foreground">Loading…</main>;
  if (!p) return <main className="mx-auto max-w-5xl px-4 py-10">Member not found. <Link to="/members" className="text-primary">Back to members</Link></main>;

  const sb = p.stat_build as unknown as StatBuild | null;
  const kb = p.skill_build as unknown as SkillBuild | null;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["gear", id] }); qc.invalidateQueries({ queryKey: ["wishlists"] }); qc.invalidateQueries({ queryKey: ["members"] }); };

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <section>
        <div className="flex items-center gap-6">
        <CharacterPortrait path={p.avatar_path} name={p.char_name || p.display_name} className="h-36 w-28" />
        <div className="min-w-0"><h1 className="text-4xl font-bold">{p.char_name || p.display_name}</h1>
        <p className="mt-1 text-primary">{jobName(p.job)} · Base {p.base_lv} / Job {p.job_lv}</p>
        {p.bio && <p className="mt-3 whitespace-pre-line text-muted-foreground">{p.bio}</p>}
        </div></div>
        {isOwner && <EditProfile p={p} onSaved={() => { qc.invalidateQueries({ queryKey: ["profile", id] }); qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["wishlists"] }); }} />}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Stat build</h2>
          {sb ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                {Object.entries(sb.build.stats).map(([k, v]) => <div key={k} className="rounded bg-secondary px-2 py-1"><span className="uppercase text-muted-foreground">{k}</span> {v}</div>)}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
                {Object.entries(sb.summary).map(([k, v]) => <div key={k} className="flex justify-between border-b border-border py-1"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>)}
              </div>
              {engine && <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                {sb.build.pet && <p>Pet: {engine.mobNames[sb.build.pet.mob] || sb.build.pet.mob}{sb.build.pet.loyal ? " · Loyal" : ""}</p>}
                {sb.build.combat && <p>Combat target: {engine.mobNames[sb.build.combat.mob] || sb.build.combat.mob}</p>}
                {!!sb.build.buffs && <p>{engine.CalcStatus.BUFFS.filter((b) => !!sb.build.buffs?.[b.id]).map((b) => `${b.name}${typeof sb.build.buffs?.[b.id] === "number" ? ` ${sb.build.buffs[b.id]}` : ""}`).join(" · ")}</p>}
              </div>}
              {engine && (
                <ul className="mt-3 space-y-1 text-sm">
                  {Object.entries(sb.build.equip).filter(([, e]) => e?.key).map(([slot, e]) => (
                    <li key={slot}><span className="text-muted-foreground">{slot}:</span> {e.refine ? `+${e.refine} ` : ""}{engine.itemsByKey[e.key] ? itemLabel(engine.itemsByKey[e.key]) : e.key}
                      {e.cards.filter(Boolean).length > 0 && <span className="text-muted-foreground"> [{e.cards.filter(Boolean).map((c) => engine.itemsByKey[c]?.name ?? c).join(", ")}]</span>}</li>
                  ))}
                </ul>
              )}
            </>
          ) : <p className="mt-2 text-sm text-muted-foreground">No stat build saved yet.{isOwner && <> Use the <Link to="/calculator" className="text-primary">Stat Calculator</Link>.</>}</p>}
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Skill build</h2>
          {kb && skt ? (
            <>
              <p className="text-sm text-primary">{jobName(kb.job)}</p>
              <ul className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                {Object.entries(kb.lv).filter(([k]) => !skt.skills[k]?.quest).map(([k, v]) => (
                  <li key={k} className="flex justify-between rounded bg-secondary px-2 py-1"><span>{skt.skills[k]?.name ?? k}</span><span className="text-primary">{v}</span></li>
                ))}
              </ul>
            </>
          ) : <p className="mt-2 text-sm text-muted-foreground">No skill build saved yet.{isOwner && <> Use the <Link to="/skills" className="text-primary">Skill Simulator</Link>.</>}</p>}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xl font-bold">Gear wishlist</h2>
        <p className="text-sm text-muted-foreground">Items marked "still need" show where they drop, so guildmates can help hunt.</p>
        {isOwner && engine && <AddGear engine={engine} userId={id} onAdded={refresh} />}
        <div className="mt-4 grid gap-2">
          {(gear.data ?? []).map((g) => {
            const item = engine?.itemsByKey[g.item_key];
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                <span className={"rounded px-2 py-0.5 text-xs font-semibold " + (g.status === "have" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
                  {g.status === "have" ? "I have this" : "Still need"}
                </span>
                <span className="font-semibold">{g.item_name}</span>
                {g.status === "need" && item?.drops?.length ? (
                  <span className="text-xs text-muted-foreground">Drops from: {item.drops.map(([m, r]) => `${engine?.mobNames[m] ?? m} (${(r / 100).toFixed(2)}%)`).join(", ")}</span>
                ) : null}
                {isOwner && (
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={async () => {
                      const { error } = await supabase.from("gear_wishlist").update({ status: g.status === "have" ? "need" : "have" }).eq("id", g.id); if (error) toast.error(error.message); else refresh();
                    }}>{g.status === "have" ? "Mark as needed" : "I have this now"}</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("gear_wishlist").delete().eq("id", g.id); refresh(); }}>Remove</Button>
                  </div>
                )}
              </div>
            );
          })}
          {gear.data?.length === 0 && <p className="text-sm text-muted-foreground">No gear on the list yet.</p>}
        </div>
      </section>
    </main>
  );
}

function EditProfile({ p, onSaved }: { p: { id: string; display_name: string; char_name: string | null; job: string; base_lv: number; job_lv: number; bio: string | null; avatar_path: string | null }; onSaved: () => void }) {
  const [f, setF] = useState({ display_name: p.display_name, char_name: p.char_name ?? "", job: p.job, base_lv: p.base_lv, job_lv: p.job_lv, bio: p.bio ?? "" });
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function uploadPortrait(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error("Choose a PNG, JPEG, WebP or GIF under 5 MB"); return; }
    setUploading(true);
    const path = `${p.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("character-portraits").upload(path, file, { contentType: file.type });
    if (error) { setUploading(false); toast.error(error.message); return; }
    const saved = await supabase.from("profiles").update({ avatar_path: path }).eq("id", p.id);
    if (saved.error) { await supabase.storage.from("character-portraits").remove([path]); toast.error(saved.error.message); }
    else { if (p.avatar_path) await supabase.storage.from("character-portraits").remove([p.avatar_path]); toast.success("Character picture saved"); onSaved(); }
    setUploading(false);
  }
  if (!open) return <Button className="mt-4" variant="outline" size="sm" onClick={() => setOpen(true)}>Edit profile</Button>;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline"><a href="http://charsim.rune-nifelheim.com/en/" target="_blank" rel="noopener noreferrer">Create character picture ↗</a></Button>
        <label className="text-sm">Character picture<Input aria-label="Character picture" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading} onChange={(e) => uploadPortrait(e.target.files?.[0])} /></label>
        {uploading && <span className="text-sm text-muted-foreground">Uploading…</span>}
      </div>
      <Input placeholder="Display name" value={f.display_name} maxLength={40} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
      <Input placeholder="Character name" value={f.char_name} maxLength={24} onChange={(e) => setF({ ...f, char_name: e.target.value })} />
      <JobSelect value={f.job} onChange={(job) => setF({ ...f, job })} />
      <div className="flex gap-2">
        <Input type="number" min={1} max={99} value={f.base_lv} onChange={(e) => setF({ ...f, base_lv: +e.target.value })} />
        <Input type="number" min={1} max={70} value={f.job_lv} onChange={(e) => setF({ ...f, job_lv: +e.target.value })} />
      </div>
      <Textarea className="sm:col-span-2" placeholder="About you" maxLength={500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      <div className="flex gap-2">
        <Button onClick={async () => {
          const { error } = await supabase.from("profiles").update({
            ...f, display_name: f.display_name.trim() || "Adventurer", char_name: f.char_name.trim() || null,
            base_lv: Math.min(99, Math.max(1, f.base_lv | 0)), job_lv: Math.min(70, Math.max(1, f.job_lv | 0)),
          }).eq("id", p.id);
          if (error) toast.error(error.message); else { toast.success("Profile saved"); setOpen(false); onSaved(); }
        }}>Save</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function AddGear({ engine, userId, onAdded }: { engine: Engine; userId: string; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => q.length < 2 ? [] : engine.items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12), [q, engine]);
  async function add(key: string, name: string, type: string, status: "have" | "need") {
    const { error } = await supabase.from("gear_wishlist").upsert({ user_id: userId, item_key: key, item_name: name, item_type: type, status }, { onConflict: "user_id,item_key" });
    if (error) toast.error(error.message); else { setQ(""); onAdded(); }
  }
  return (
    <div className="mt-4">
      <Input placeholder="Search gear or cards to add (e.g. Marc Card)" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <div className="mt-1 divide-y divide-border rounded-md border border-border">
          {results.map((i) => (
            <div key={i.key} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span>{itemLabel(i)}</span><span className="text-xs text-muted-foreground">{i.type}{i.loc ? ` · ${i.loc}` : ""}</span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="outline" onClick={() => add(i.key, itemLabel(i), i.type, "need")}>Still need</Button>
                <Button size="sm" variant="outline" onClick={() => add(i.key, itemLabel(i), i.type, "have")}>I have this</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
