import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { announceParty, DISCORD_REASON } from "@/lib/discord.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fieldClass } from "@/components/JobSelect";
import { PartyRoleSelect } from "@/components/PartyRoleSelect";
import { MAX_PARTY_SIZE, PARTY_TEMPLATES, canAddSlot } from "@/lib/ro/jobs";

export const Route = createFileRoute("/parties/new")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Plan a party · Rune Midgard" },
      { name: "description", content: "Create a new guild party with date, time, place and class slots." },
      { property: "og:title", content: "Plan a party · Rune Midgard" },
      { property: "og:description", content: "Create a new guild party with date, time, place and class slots." },
    ],
  }),
  component: NewParty,
});

const schema = z.object({
  title: z.string().trim().min(1, "Give the party a name").max(80),
  place: z.string().trim().min(1, "Where do you meet?").max(80),
  notes: z.string().max(1000),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a time"),
});

function NewParty() {
  const { userId, ready } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ title: "", place: "", notes: "", date: "", time: "20:00" });
  const [template, setTemplate] = useState("");
  const [step, setStep] = useState(0);
  const [activity, setActivity] = useState("leveling");
  const [templateFilter, setTemplateFilter] = useState("");
  const [templateScope, setTemplateScope] = useState("all");
  const [showLibrary, setShowLibrary] = useState(false);
  const [quick, setQuick] = useState(false);
  function repeatLast() {
    try {
      const last = JSON.parse(localStorage.getItem("last-created-guild-party") || "null") as { title: string; place: string; notes: string; roles: string[]; signupMode: "core"|"open"; checklist: {quantity:number;name:string}[]; template: string } | null;
      if (!last) { toast.error("No previous party saved in this browser"); return; }
      setF((v) => ({ ...v, title: last.title, place: last.place, notes: last.notes }));
      setRoles(last.roles.slice(0, MAX_PARTY_SIZE)); setSignupMode(last.signupMode); setChecklist(last.checklist); setTemplate(last.template); setQuick(true);
      toast.success("Previous party copied. Set a new date and time.");
    } catch { toast.error("Could not restore previous party"); }
  }
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      setFavoriteIds(JSON.parse(localStorage.getItem("party-template-favorites") || "[]"));
      setRecentIds(JSON.parse(localStorage.getItem("party-template-recent") || "[]"));
    } catch { /* ignore outdated browser settings */ }
  }, []);
  function toggleFavorite(id: string) {
    const next = favoriteIds.includes(id) ? favoriteIds.filter((x) => x !== id) : [...favoriteIds, id];
    setFavoriteIds(next);
    localStorage.setItem("party-template-favorites", JSON.stringify(next));
  }
  function remember(id: string) {
    const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, 5);
    setRecentIds(next);
    localStorage.setItem("party-template-recent", JSON.stringify(next));
  }
  const activities = [
    { id: "leveling", label: "Leveling", place: "" },
    { id: "mvp", label: "MvP Hunting", place: "" },
    { id: "tower", label: "Endless Tower", place: "Endless Tower entrance" },
  ];
  function applyActivity(id: string) {
    setActivity(id);
    // Do not impose a template when choosing an activity.
    setTemplate("");
    setRoles(Array(MAX_PARTY_SIZE).fill("Any"));
    setChecklist(id === "tower" ? [
      { quantity: 50, name: "Green Potion" },
      { quantity: 5, name: "Blue Gemstone" },
      { quantity: 5, name: "Yggdrasil Leaf" },
    ] : []);
    setF((v) => ({ ...v, place: id === "tower" && !v.place ? "Endless Tower entrance" : v.place }));
  }
  function clearTemplate() {
    setTemplate("");
    setRoles(Array(MAX_PARTY_SIZE).fill("Any"));
    setSignupMode("open");
    setChecklist([]);
    setShowLibrary(false);
  }
  function applyTemplate(id: string) {
    const t = [...PARTY_TEMPLATES, ...(templates.data ?? [])].find((x) => x.id === id);
    if (!t) return;
    setTemplate(t.id); setRoles([...t.roles]);
    setSignupMode("signup_mode" in t && t.signup_mode === "open" ? "open" : "core");
    setChecklist("checklist" in t && Array.isArray(t.checklist) ? t.checklist as { quantity: number; name: string }[] : []);
    remember(id);
  }
  function templateCategory(t: { name: string; description?: string }) {
    const text = (t.name + " " + (t.description || "")).toLowerCase();
    if (/endless|tower/.test(text)) return "Endless Tower";
    if (/mvp|boss|baphomet|stormy|orc hero/.test(text)) return "MVP";
    if (/level|stala|exp/.test(text)) return "Leveling";
    if (/farm|loot|zeny/.test(text)) return "Farming";
    return "Custom";
  }
  const [signupMode, setSignupMode] = useState<"core" | "open">("core");
  const [checklist, setChecklist] = useState<{ quantity: number; name: string }[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const qc = useQueryClient();
  const announce = useServerFn(announceParty);
  const templates = useQuery({ queryKey: ["party-templates"], queryFn: async () => { const { data, error } = await supabase.from("party_templates").select("*").order("created_at"); if (error) throw error; return data; } });
  const allTemplates = [...PARTY_TEMPLATES, ...(templates.data ?? [])];
  const [archiveIds, setArchiveIds] = useState<string[]>([]);
  useEffect(() => { try { setArchiveIds(JSON.parse(localStorage.getItem("party-archived-templates") || "[]")); } catch {} }, []);
  function toggleArchive(id: string) {
    const next = archiveIds.includes(id) ? archiveIds.filter((x) => x !== id) : [...archiveIds, id];
    setArchiveIds(next);
    localStorage.setItem("party-archived-templates", JSON.stringify(next));
  }
  const filteredTemplates = allTemplates.filter((t) =>
    (templateScope === "archived" ? archiveIds.includes(t.id) : !archiveIds.includes(t.id))
    && (templateScope !== "mine" || ("creator_id" in t && t.creator_id === userId))
    && (!["MVP", "Endless Tower", "Leveling", "Farming", "Custom"].includes(templateScope) || templateCategory(t) === templateScope)
    && ((t.name + " " + (t.description || "")).toLowerCase().includes(templateFilter.toLowerCase()) || templateCategory(t).toLowerCase().includes(templateFilter.toLowerCase()))
  );
  const [templateName, setTemplateName] = useState("");
  async function updateTemplate() {
    if (!userId || !templateName.trim()) { toast.error("Enter a template name"); return; }
    const own = (templates.data ?? []).find((t) => t.id === template && t.creator_id === userId);
    if (!own) { toast.error("Choose one of your saved templates to update"); return; }
    setSavingTemplate(true);
    const { error } = await supabase.from("party_templates").update({ name: templateName.trim(), roles, signup_mode: signupMode, checklist }).eq("id", own.id).eq("creator_id", userId);
    setSavingTemplate(false);
    if (error) toast.error(error.message);
    else { await qc.invalidateQueries({ queryKey: ["party-templates"] }); toast.success("Template updated. Existing parties unchanged."); }
  }
  const [savingTemplate, setSavingTemplate] = useState(false);
  async function deleteTemplate(id: string) {
    if (!userId || !confirm("Delete this saved template? Existing parties will not change.")) return;
    const { error } = await supabase.from("party_templates").delete().eq("id", id).eq("creator_id", userId);
    if (error) toast.error(error.message); else { await qc.invalidateQueries({ queryKey: ["party-templates"] }); toast.success("Template deleted"); }
  }
  async function saveTemplate() {
    if (!userId || !templateName.trim()) return;
    setSavingTemplate(true);
    const { data, error } = await supabase.from("party_templates").insert({ creator_id: userId, name: templateName.trim(), roles, signup_mode: signupMode, checklist }).select().single();
    setSavingTemplate(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["party-templates"] });
    setTemplate(data.id); remember(data.id); setTemplateName(""); toast.success("Template shared with the guild");
  }
  const [roles, setRoles] = useState<string[]>(Array(MAX_PARTY_SIZE).fill("Any"));
  const usage = useQuery({ queryKey: ["party-template-usage"], queryFn: async () => { const { data, error } = await supabase.from("parties").select("template"); if (error) throw error; return data ?? []; } });
  const usageCount = (id: string) => (usage.data ?? []).filter((p) => p.template === id).length;
  const popularTemplates = [...allTemplates].sort((a, b) => usageCount(b.id) - usageCount(a.id)).slice(0, 4);
  const coreRoles = (r: string[]) => { const entries = r.filter((x) => x !== "Any"); return entries.length ? [...new Set(entries)].map((name) => `${name}${entries.filter((x) => x === name).length > 1 ? ` ×${entries.filter((x) => x === name).length}` : ""}`).join(", ") : "No required classes"; };
  const [busy, setBusy] = useState(false);

  if (ready && !userId) return <main className="mx-auto max-w-xl px-4 py-16">Please <Link to="/auth" className="text-primary">sign in</Link> to plan a party.</main>;

  async function create() {
    if (!userId) { toast.error("Sign in to create a party"); return; }
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Invalid input"); return; }
    if (roles.length < 1 || roles.length > MAX_PARTY_SIZE) { toast.error("A party has 1 to 12 slots"); return; }
    const startsAt = new Date(`${f.date}T${f.time}`);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) { toast.error("Choose a valid future party date and time"); setStep(1); setQuick(false); return; }
    setBusy(true);
    const { data, error } = await supabase.from("parties").insert({
      creator_id: userId, title: p.data.title, place: p.data.place, notes: p.data.notes || null, template, signup_mode: signupMode, checklist,
      starts_at: startsAt.toISOString(),
    }).select("id").single();
    if (error || !data) { setBusy(false); toast.error(error?.message ?? "Could not create party"); return; }
    const { error: e2 } = await supabase.from("party_slots").insert(roles.map((role, position) => ({ party_id: data.id, position, role })));
    if (e2) {
      const { error: cleanupError } = await supabase.from("parties").delete().eq("id", data.id).eq("creator_id", userId);
      setBusy(false);
      toast.error(cleanupError ? `Could not save party slots: ${e2.message}. A partial party may remain; check My Parties.` : `Could not save party slots: ${e2.message}. No party was published.`);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["parties"] });
    setBusy(false);
    toast.success("Party published on the website!");
    // Discord delivery is optional and cannot block a saved party.
    announce({ data: { partyId: data.id, origin: window.location.origin } }).then((r) => {
      if (r.sent) toast.success("Party announced on Discord");
      else toast.warning(`Party saved, but Discord was not notified: ${DISCORD_REASON[r.reason ?? ""] ?? "Unknown reason"}`);
    }).catch((e) => toast.warning(`Party saved, but Discord was not notified: ${e instanceof Error ? e.message : "network error"}`));
    remember(template);
    localStorage.setItem("last-created-guild-party", JSON.stringify({ title: p.data.title, place: p.data.place, notes: p.data.notes, roles, signupMode, checklist, template }));
    navigate({ to: "/parties/$id", params: { id: data.id } });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-4xl font-bold">Plan a party</h1><p className="mt-1 text-sm text-muted-foreground">Create a party from an activity and a reusable setup.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={repeatLast}>Repeat last party</Button>
          <Button variant="outline" onClick={() => { setQuick((v) => !v); setStep(0); }}>{quick ? "Guided setup" : "Quick create"}</Button>
        </div>
      </div>
      {!quick && <div className="my-6 flex flex-wrap gap-2">{["Activity & template", "Time & place", "Roster & supplies"].map((name,i) =>
        <Button key={name} size="sm" variant={step === i ? "default" : "outline"} onClick={() => setStep(i)}>{i+1}. {name}</Button>)}</div>}
      {(quick || step === 0) && <section className="mt-6 space-y-6 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="text-xl font-bold">Choose an activity</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {activities.map((a) => <button type="button" key={a.id} onClick={() => applyActivity(a.id)}
              aria-pressed={activity === a.id}
              className={`rounded-xl border px-4 py-5 text-left font-semibold transition hover:border-primary ${activity === a.id ? "border-primary bg-primary/10" : "border-border bg-secondary/20"}`}>{a.label}</button>)}
          </div>
        </div>
        <div className="border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">Party template</h2>
              <p className="mt-1 text-sm text-muted-foreground">{template ? `Selected: ${allTemplates.find((t) => t.id === template)?.name || "Custom"}` : "No template selected — all 12 slots are Any role."}</p></div>
            <div className="flex gap-2"><Button variant="outline" onClick={clearTemplate}>Use any roles</Button><Button onClick={() => setShowLibrary(true)}>Load templates</Button></div>
          </div>
        </div>
        <div className="border-t border-border pt-5">
          <h2 className="text-xl font-bold">Most used templates</h2>
          <p className="mt-1 text-sm text-muted-foreground">The four most-used setups, based on parties created by the guild.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {popularTemplates.map((t) => <button key={t.id} type="button" onClick={() => applyTemplate(t.id)}
              className={`rounded-xl border p-5 text-left transition hover:border-primary ${template === t.id ? "border-primary bg-primary/10" : "border-border bg-secondary/20"}`}>
              <div className="flex items-center justify-between gap-2"><strong className="text-lg">{t.name}</strong><span className="text-xs text-muted-foreground">{t.roles.length} players</span></div>
              <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Core roles:</strong> {coreRoles(t.roles)}</p>
              <p className="mt-2 text-sm text-primary">{t.roles.filter((r) => r === "Any").length} Any role spots · {usageCount(t.id)} previous parties</p>
            </button>)}
          </div>
        </div>
      </section>}
      {showLibrary && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowLibrary(false); }}>
        <div role="dialog" aria-modal="true" aria-label="Party template library" className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-2xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">Load a party template</h2><p className="text-sm text-muted-foreground">Select a template to fill the party slots, or start with 12 Any role slots.</p></div><Button variant="outline" onClick={() => setShowLibrary(false)}>Close</Button></div>
          <div className="mt-5 flex flex-wrap gap-2">{["all","mine","MVP","Endless Tower","Leveling","Custom","archived"].map((scope) =>
            <Button key={scope} size="sm" variant={templateScope === scope ? "default" : "outline"} onClick={() => setTemplateScope(scope)}>{scope === "mine" ? "My templates" : scope === "all" ? "All" : scope === "archived" ? "Archived" : scope}</Button>)}</div>
          <Input className="mt-4" placeholder="Search templates" value={templateFilter} onChange={(e) => setTemplateFilter(e.target.value)} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{filteredTemplates.map((t) => <div key={t.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex justify-between gap-2"><h3 className="text-lg font-bold">{t.name}</h3><span className="whitespace-nowrap text-sm text-primary">{t.roles.length} players</span></div>
            <p className="mt-2 text-sm"><strong>Core roles:</strong> {coreRoles(t.roles)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.roles.filter((r) => r === "Any").length} Any role spots</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => { applyTemplate(t.id); setShowLibrary(false); }}>Use template</Button>
              <Button size="sm" variant="outline" onClick={() => toggleFavorite(t.id)}>{favoriteIds.includes(t.id) ? "★ Favorite" : "☆ Favorite"}</Button>
              <Button size="sm" variant="ghost" onClick={() => toggleArchive(t.id)}>{archiveIds.includes(t.id) ? "Restore" : "Archive"}</Button>
              {"creator_id" in t && t.creator_id === userId && <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}>Delete</Button>}
            </div>
          </div>)}</div>
          {filteredTemplates.length === 0 && <p className="mt-5 text-sm text-muted-foreground">No templates match this filter.</p>}
          <Button className="mt-5" variant="outline" onClick={clearTemplate}>Continue without template (12 Any roles)</Button>
        </div>
      </div>}
      {(quick || step === 1) && <>
      <div className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>Title</Label><Input value={f.title} maxLength={80} placeholder="Baphomet hunt" onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="space-y-1"><Label>Time (your local time)</Label><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Place</Label><Input value={f.place} maxLength={80} placeholder="Prontera south gate / Glast Heim" onChange={(e) => setF({ ...f, place: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Notes</Label><Textarea value={f.notes} maxLength={1000} placeholder="Bring Yggdrasil Berries…" onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>

      </>}
      {(quick || step === 2) && <>
      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Who can join?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose whether class requirements matter. Everyone can always join the substitute list.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([["core","Core classes have priority","Only matching classes fill reserved slots. Others join the substitute list."],["open","Anyone can join","First come, first served, regardless of required class."]] as const).map(([value,title,description]) => (
            <button type="button" key={value} onClick={() => setSignupMode(value)} aria-pressed={signupMode === value} className={`rounded-lg border p-4 text-left transition-colors ${signupMode === value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              <span className="font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
            </button>
          ))}
        </div>
      </section>
      <h2 className="mt-8 text-2xl font-bold">Slots <span className="text-base text-muted-foreground">{roles.length}/{MAX_PARTY_SIZE}</span></h2>
      <div className="mt-3 flex flex-wrap gap-2">{[...new Set(roles)].map((r) => <span key={r} className="rounded-full bg-secondary px-3 py-1 text-sm">{r} ×{roles.filter((x) => x === r).length}</span>)}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {roles.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
            <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
            <PartyRoleSelect value={r} onChange={(v) => setRoles(roles.map((x, j) => (j === i ? v : x)))} className="flex-1" />
            <Button title="Add another of this role" size="sm" variant="outline" disabled={!canAddSlot(roles.length)} onClick={() => setRoles([...roles, r])}>+</Button>
            <Button size="sm" variant="ghost" disabled={roles.length <= 1} onClick={() => setRoles(roles.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
      </div>
      <Button className="mt-3" variant="outline" disabled={!canAddSlot(roles.length)} onClick={() => setRoles([...roles, "Any"])}>
        {canAddSlot(roles.length) ? "Add slot" : "Party is full (12)"}
      </Button>
      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Preparation checklist <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
        <p className="mt-1 text-sm text-muted-foreground">What should everyone bring? Save the list with a template for future runs.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input aria-label="Item quantity" type="number" min={1} max={99999} className="w-24" value={itemQty} onChange={e => setItemQty(Math.max(1,Number(e.target.value)||1))} />
          <Input aria-label="Item name" className="min-w-40 flex-1" maxLength={80} placeholder="Green Potion" value={itemName} onChange={e => setItemName(e.target.value)} onKeyDown={e => { if(e.key === "Enter") {e.preventDefault(); if(itemName.trim() && checklist.length<30) {setChecklist([...checklist,{quantity:itemQty,name:itemName.trim()}]);setItemName("");setItemQty(1);} } }} />
          <Button type="button" variant="outline" disabled={!itemName.trim() || checklist.length>=30} onClick={() => {setChecklist([...checklist,{quantity:itemQty,name:itemName.trim()}]);setItemName("");setItemQty(1);}}>Add item</Button>
        </div>
        {checklist.length > 0 && <ul className="mt-4 space-y-2">{checklist.map((item,i) => <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-secondary/50 px-3 py-2"><span>{item.quantity}× {item.name}</span><Button type="button" size="sm" variant="ghost" onClick={() => setChecklist(checklist.filter((_,j)=>j!==i))}>Remove</Button></li>)}</ul>}
      </section>
      <div className="mt-6 flex flex-wrap gap-2">
        <Input aria-label="New template name" placeholder="New template name" maxLength={80} className="max-w-xs" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        <Button variant="outline" disabled={!templateName.trim() || savingTemplate || !userId} onClick={saveTemplate}>Save new template</Button>
        {(templates.data ?? []).some((t) => t.id === template && t.creator_id === userId) && <Button variant="outline" disabled={!templateName.trim() || savingTemplate} onClick={updateTemplate}>Update selected template</Button>}
      </div>
      </>}
      {!quick && <div className="mt-6 flex gap-2">{step > 0 && <Button variant="outline" onClick={() => setStep((v) => v-1)}>Back</Button>}{step < 2 && <Button onClick={() => setStep((v) => v+1)}>Continue</Button>}</div>}
      {(quick || step === 2) && <div className="mt-8 rounded-xl border border-primary/40 bg-card p-5">
        <h2 className="text-lg font-bold">Ready to publish?</h2>
        <p className="mt-1 text-sm text-muted-foreground">{f.title || "Untitled party"} · {roles.length}/12 roles · {signupMode === "core" ? "Core classes prioritized" : "Anyone can join"} · {checklist.length} required supplies</p>
        <Button className="mt-4" size="lg" disabled={busy} onClick={create}>Publish party</Button>
      </div>}

    </main>
  );
}
