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
  const [template, setTemplate] = useState("stala");
  const [step, setStep] = useState(0);
  const [activity, setActivity] = useState("leveling");
  const [templateFilter, setTemplateFilter] = useState("");
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
    { id: "mvp", label: "MVP Hunting", category: "MVP", defaultTemplate: "mvp", place: "MVP spawn location" },
    { id: "tower", label: "Endless Tower", category: "Endless Tower", defaultTemplate: "mvp", place: "Endless Tower entrance" },
    { id: "leveling", label: "Leveling", category: "Leveling", defaultTemplate: "leveling", place: "Party meeting point" },
    { id: "farming", label: "Farming", category: "Farming", defaultTemplate: "dungeon", place: "Farming location" },
    { id: "custom", label: "Custom", category: "Custom", defaultTemplate: "custom", place: "" },
  ];
  function applyActivity(id: string) {
    const a = activities.find((x) => x.id === id)!;
    setActivity(id);
    setF((v) => ({ ...v, title: v.title || a.label, place: v.place || a.place }));
    applyTemplate(a.defaultTemplate);
    if (id === "tower") setChecklist([{ quantity: 50, name: "Green Potion" }, { quantity: 5, name: "Blue Gemstone" }, { quantity: 5, name: "Yggdrasil Leaf" }]);
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
  const filteredTemplates = allTemplates.filter((t) => !archiveIds.includes(t.id) && ((t.name + " " + (t.description || "")).toLowerCase().includes(templateFilter.toLowerCase()) || templateCategory(t).toLowerCase().includes(templateFilter.toLowerCase())));
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
  const [roles, setRoles] = useState<string[]>(PARTY_TEMPLATES[0]?.roles ?? ["Any"]);
  const [busy, setBusy] = useState(false);

  if (ready && !userId) return <main className="mx-auto max-w-xl px-4 py-16">Please <Link to="/auth" className="text-primary">sign in</Link> to plan a party.</main>;

  async function create() {
    if (!userId) { toast.error("Sign in to create a party"); return; }
    const p = schema.safeParse(f);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Invalid input"); return; }
    if (roles.length < 1 || roles.length > MAX_PARTY_SIZE) { toast.error("A party has 1 to 12 slots"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("parties").insert({
      creator_id: userId, title: p.data.title, place: p.data.place, notes: p.data.notes || null, template, signup_mode: signupMode, checklist,
      starts_at: new Date(`${f.date}T${f.time}`).toISOString(),
    }).select("id").single();
    if (error || !data) { setBusy(false); toast.error(error?.message ?? "Could not create party"); return; }
    const { error: e2 } = await supabase.from("party_slots").insert(roles.map((role, position) => ({ party_id: data.id, position, role })));
    setBusy(false);
    if (e2) { toast.error(e2.message); return; }
    announce({ data: { partyId: data.id, origin: window.location.origin } }).then((r) => { if (r.sent) toast.success("Posted to Discord #party-planner"); else toast.error(`Not posted to Discord: ${DISCORD_REASON[r.reason ?? ""] ?? "unknown problem"}`); }).catch((e) => toast.error(`Not posted to Discord: ${e instanceof Error ? e.message : "network error"}`));
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
      {(quick || step === 0) && <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Choose an activity</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{activities.map((a) =>
          <button key={a.id} type="button" onClick={() => applyActivity(a.id)} className={`rounded-lg border p-3 text-left text-sm font-semibold ${activity === a.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>{a.label}</button>)}</div>
        <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold">Template library</h2><Button size="sm" variant="outline" onClick={() => setShowLibrary((v) => !v)}>{showLibrary ? "Collapse library" : "Browse all templates"}</Button></div>
        <div className="flex flex-wrap gap-2">{[...new Set([...favoriteIds, ...recentIds])].slice(0,5).map((id) => {
          const t = allTemplates.find((x) => x.id === id); return t ? <Button key={id} variant="outline" size="sm" onClick={() => applyTemplate(id)}>{favoriteIds.includes(id) ? "★ " : "Recent: "}{t.name}</Button> : null;
        })}</div>
        <Input placeholder="Search activity or template" value={templateFilter} onChange={(e) => { setTemplateFilter(e.target.value); setShowLibrary(true); }} />
        <div className={showLibrary || templateFilter ? "grid max-h-80 gap-2 overflow-auto sm:grid-cols-2" : "grid gap-2 sm:grid-cols-2"}>
          {(showLibrary || templateFilter ? filteredTemplates : filteredTemplates.filter((t) => t.id === template || favoriteIds.includes(t.id)).slice(0,4)).map((t) =>
            <div key={t.id} className={`flex gap-2 rounded-lg border p-3 ${template === t.id ? "border-primary bg-primary/5" : "border-border"}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => applyTemplate(t.id)}><div className="font-semibold">{t.name} · {t.roles.length}/12</div><p className="text-xs text-muted-foreground">{templateCategory(t)} · {t.description || "Member-created setup"}</p></button>
              <Button title="Favorite" variant="ghost" size="sm" onClick={() => toggleFavorite(t.id)}>{favoriteIds.includes(t.id) ? "★" : "☆"}</Button>
              {"creator_id" in t && t.creator_id === userId && <Button title="Duplicate template" variant="ghost" size="sm" onClick={() => { applyTemplate(t.id); setTemplateName(t.name + " copy"); setStep(2); }}>Copy</Button>}
              <Button title="Archive locally" variant="ghost" size="sm" onClick={() => toggleArchive(t.id)}>Archive</Button>
              {"creator_id" in t && t.creator_id === userId && <Button title="Delete my template" variant="ghost" size="sm" onClick={() => deleteTemplate(t.id)}>Delete</Button>}
            </div>)}
        </div>
        <p className="text-xs text-muted-foreground">Templates copy their roles and supplies into a new party. Editing this party won't change the template.</p>
      </section>}
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
