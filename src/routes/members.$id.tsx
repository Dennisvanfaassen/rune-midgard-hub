import { GuildBadge, useGuildBadges } from "@/components/GuildBadge";
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
import { itemDisplay } from "@/lib/ro/slots";
import { HelpOffers, type HelpOffer } from "@/components/WishlistBoard";
import { loadEngine, type Engine } from "@/lib/ro/engine";
import { XynklonBuild, type ExternalBuild } from "@/components/XynklonBuild";
import { ThemePreference } from "@/components/WebsiteTheme";

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


function Profile() {
  const { id } = Route.useParams();
  const { userId } = useAuth();
  const isOwner = userId === id;
  const qc = useQueryClient();
  const { data: p, isLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", id).maybeSingle()).data,
  });
  const guildRole = useQuery({ queryKey: ["guild-member-roles", id], queryFn: async () => { const { data, error } = await supabase.from("guild_member_roles").select("role").eq("user_id", id).maybeSingle(); if (error) return "Guildmember"; return data?.role ?? "Guildmember"; } });
  const gear = useQuery({
    queryKey: ["gear", id],
    queryFn: async () => (await supabase.from("gear_wishlist").select("*,wishlist_help(id,kind,helper_id,message,profiles(display_name,char_name))").eq("user_id", id).order("created_at")).data ?? [],
  });
  const [engine, setEngine] = useState<Engine | null>(null);
  useEffect(() => { loadEngine().then(setEngine); }, []);

  if (isLoading) return <main className="mx-auto max-w-5xl px-4 py-10 text-muted-foreground">Loading…</main>;
  if (!p) return <main className="mx-auto max-w-5xl px-4 py-10">Member not found. <Link to="/members" className="text-primary">Back to members</Link></main>;

  const linkedBuild = p.stat_build as ExternalBuild | null;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["gear", id] }); qc.invalidateQueries({ queryKey: ["wishlists"] }); qc.invalidateQueries({ queryKey: ["members"] }); };

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <section>
        <div className="flex items-center gap-6">
        <CharacterPortrait path={p.avatar_path} name={p.char_name || p.display_name} className="h-36 w-28" />
        <div className="min-w-0"><h1 className="flex flex-wrap items-center gap-2 text-4xl font-bold">{p.char_name || p.display_name}<GuildBadge role={guildRole.data} /></h1>
        <p className="mt-1 text-primary">{jobName(p.job)} · Base {p.base_lv} / Job {p.job_lv} · {guildRole.data ?? "Guildmember"}</p>
        {p.birthday_month && p.birthday_day && <p className="mt-2 text-sm text-muted-foreground">🎂 Birthday: {new Date(2024,p.birthday_month-1,p.birthday_day).toLocaleDateString(undefined,{month:"long",day:"numeric"})}</p>}
        {p.bio && <p className="mt-3 whitespace-pre-line text-muted-foreground">{p.bio}</p>}
        </div></div>
        {isOwner && <QuickLevels p={p} onSaved={() => { qc.invalidateQueries({ queryKey: ["profile", id] }); qc.invalidateQueries({ queryKey: ["members"] }); }} />}
        {isOwner && <ThemePreference />}
        {isOwner && <EditProfile p={p} onSaved={() => { qc.invalidateQueries({ queryKey: ["profile", id] }); qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["wishlists"] }); }} />}
      </section>

      <XynklonBuild ownerId={id} isOwner={isOwner} saved={linkedBuild?.external_url ?? null} job={jobName(p.job)} wishlist={gear.data ?? []} onGearChanged={refresh} onSaved={() => qc.invalidateQueries({ queryKey: ["profile", id] })} />

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
                <span className="font-semibold">{itemDisplay(g.item_key, g.item_name)} <span className="text-primary">×{g.quantity ?? 1}</span></span>
                {g.status === "need" && item?.drops?.length ? (
                  <span className="text-xs text-muted-foreground">Drops from: {item.drops.map(([m, r]) => `${engine?.mobNames[m] ?? m} (${(r / 100).toFixed(2)}%)`).join(", ")}</span>
                ) : null}
                {g.status === "need" && <div className="basis-full"><HelpOffers wishlistId={g.id} owner={id} offers={g.wishlist_help as HelpOffer[]} onChange={refresh} /></div>}
                {isOwner && (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">Qty
                      <Input aria-label={`Quantity for ${g.item_name}`} type="number" min={1} max={9999} defaultValue={g.quantity ?? 1} key={`${g.id}-${g.quantity ?? 1}`} className="h-8 w-20" onBlur={async (e) => { const count = Number(e.currentTarget.value); if (!Number.isInteger(count) || count < 1 || count > 9999) { toast.error("Quantity must be between 1 and 9999"); e.currentTarget.value = String(g.quantity ?? 1); return; } if (count === (g.quantity ?? 1)) return; const { error } = await supabase.from("gear_wishlist").update({ quantity: count }).eq("id", g.id).eq("user_id", id); if (error) toast.error(error.message); else refresh(); }} />
                    </label>
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

function QuickLevels({ p, onSaved }: { p: { id: string; base_lv: number; job_lv: number }; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [base, setBase] = useState(p.base_lv);
  const [job, setJob] = useState(p.job_lv);
  useEffect(() => { setBase(p.base_lv); setJob(p.job_lv); }, [p.base_lv, p.job_lv]);
  async function save(baseLevel: number, jobLevel: number) {
    if (saving) return;
    if (!Number.isInteger(baseLevel) || baseLevel < 1 || baseLevel > 99 || !Number.isInteger(jobLevel) || jobLevel < 1 || jobLevel > 70) {
      toast.error("Base must be 1–99 and Job must be 1–70"); return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ base_lv: baseLevel, job_lv: jobLevel }).eq("id", p.id);
    setSaving(false);
    if (error) { toast.error(error.message); setBase(p.base_lv); setJob(p.job_lv); }
    else { toast.success("Levels updated for party rosters"); onSaved(); }
  }
  return <section className="mt-5 max-w-xl rounded-xl border border-primary/30 bg-card p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-bold">Quick level update</h2>
      <span className="text-xs text-muted-foreground">Updates your guild profile</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {([{ label: "Base level", value: base, set: setBase, max: 99 }, { label: "Job level", value: job, set: setJob, max: 70 }] as const).map((v) =>
        <div key={v.label} className="rounded-lg border border-border bg-secondary/20 p-3">
          <label className="mb-2 block text-xs font-medium text-muted-foreground">{v.label}</label>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={saving || v.value <= 1} onClick={() => { const n = v.value - 1; v.set(n); save(v.label === "Base level" ? n : base, v.label === "Job level" ? n : job); }} aria-label={`Decrease ${v.label}`}>−</Button>
            <Input aria-label={v.label} className="min-w-0 text-center font-bold" type="number" min={1} max={v.max} value={v.value} onChange={(e) => v.set(Number(e.target.value))} onBlur={() => { if (base !== p.base_lv || job !== p.job_lv) save(base, job); }} />
            <Button type="button" size="sm" variant="outline" disabled={saving || v.value >= v.max} onClick={() => { const n = v.value + 1; v.set(n); save(v.label === "Base level" ? n : base, v.label === "Job level" ? n : job); }} aria-label={`Increase ${v.label}`}>+</Button>
          </div>
        </div>)}
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Your latest levels will be displayed next to your name in party rosters.</p>
  </section>;
}

function EditProfile({ p, onSaved }: { p: { id: string; display_name: string; char_name: string | null; job: string; base_lv: number; job_lv: number; bio: string | null; avatar_path: string | null; birthday_month: number | null; birthday_day: number | null }; onSaved: () => void }) {
  const [f, setF] = useState({ display_name: p.display_name, char_name: p.char_name ?? "", job: p.job, base_lv: p.base_lv, job_lv: p.job_lv, bio: p.bio ?? "", birthday_month: p.birthday_month ? String(p.birthday_month) : "", birthday_day: p.birthday_day ? String(p.birthday_day) : "" });
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="edit-base-level" className="block text-sm font-medium">Base Level</label>
          <Input id="edit-base-level" aria-label="Base Level" type="number" min={1} max={99} value={f.base_lv} onChange={(e) => setF({ ...f, base_lv: +e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="edit-job-level" className="block text-sm font-medium">Job Level</label>
          <Input id="edit-job-level" aria-label="Job Level" type="number" min={1} max={70} value={f.job_lv} onChange={(e) => setF({ ...f, job_lv: +e.target.value })} />
        </div>
      </div>
      <div className="sm:col-span-2 rounded-lg border border-border p-3"><p className="mb-2 text-sm font-semibold">Birthday (optional)</p><p className="mb-3 text-xs text-muted-foreground">Only your month and day appear on the guild calendar. Your birth year is not collected.</p><div className="flex gap-3"><select aria-label="Birthday month" className="flex-1 rounded-md border border-input bg-background p-2 text-sm" value={f.birthday_month} onChange={(e) => setF({...f,birthday_month:e.target.value})}><option value="">Month (hidden)</option>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2024,i,1).toLocaleString(undefined,{month:"long"})}</option>)}</select><select aria-label="Birthday day" className="w-28 rounded-md border border-input bg-background p-2 text-sm" value={f.birthday_day} onChange={(e) => setF({...f,birthday_day:e.target.value})}><option value="">Day</option>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></div></div>
      <Textarea className="sm:col-span-2" placeholder="About you" maxLength={500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      <div className="flex gap-2">
        <Button onClick={async () => {
          const month = Number(f.birthday_month), day = Number(f.birthday_day);
          if ((!!f.birthday_month !== !!f.birthday_day) || (month && day && (day > new Date(2024, month, 0).getDate()))) { toast.error("Choose a valid birthday month and day, or leave both blank."); return; }
          const { error } = await supabase.from("profiles").update({
            ...f, birthday_month: month || null, birthday_day: day || null, display_name: f.display_name.trim() || "Adventurer", char_name: f.char_name.trim() || null,
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
  const [quantity, setQuantity] = useState(1);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const normalized = (value: string) => value.trim().toLowerCase();
    const score = (item: (typeof engine.items)[number]) => {
      const name = normalized(item.name);
      const display = normalized(itemLabel(item));
      // Exact display names win (Ring [1]), followed by exact base names
      // (Ring and Ring [1]), then prefix and substring matches.
      if (display === needle) return 0;
      if (name === needle) return 1;
      if (display.startsWith(needle)) return 2;
      if (name.startsWith(needle)) return 3;
      return 4;
    };
    return engine.items.filter((i) =>
      normalized(i.name).includes(needle) || normalized(itemLabel(i)).includes(needle)
    ).sort((a, b) => score(a) - score(b) ||
      (a.name === b.name ? (b.slots ?? 0) - (a.slots ?? 0) : a.name.localeCompare(b.name))
    ).slice(0, 20);
  }, [q, engine]);
  async function add(key: string, name: string, type: string, status: "have" | "need") {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) { toast.error("Quantity must be between 1 and 9999"); return; }
    const { error } = await supabase.from("gear_wishlist").upsert({ user_id: userId, item_key: key, item_name: name, item_type: type, status, quantity }, { onConflict: "user_id,item_key" });
    if (error) toast.error(error.message); else { setQ(""); setQuantity(1); onAdded(); }
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1"><label className="mb-1 block text-xs text-muted-foreground">Item</label><Input placeholder="Search gear or cards (e.g. Ring [1], Marc Card)" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="text-xs text-muted-foreground">Quantity needed
          <Input type="number" aria-label="Quantity of wishlist items" min={1} max={9999} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mt-1 w-24" />
        </label>
      </div>
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
