import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
  const [signupMode, setSignupMode] = useState<"core" | "open">("core");
  const [checklist, setChecklist] = useState<{ quantity: number; name: string }[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const qc = useQueryClient();
  const announce = useServerFn(announceParty);
  const templates = useQuery({ queryKey: ["party-templates"], queryFn: async () => { const { data, error } = await supabase.from("party_templates").select("*").order("created_at"); if (error) throw error; return data; } });
  const allTemplates = [...PARTY_TEMPLATES, ...(templates.data ?? [])];
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  async function saveTemplate() {
    if (!userId || !templateName.trim()) return;
    setSavingTemplate(true);
    const { data, error } = await supabase.from("party_templates").insert({ creator_id: userId, name: templateName.trim(), roles, signup_mode: signupMode, checklist }).select().single();
    setSavingTemplate(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["party-templates"] });
    setTemplate(data.id); setTemplateName(""); toast.success("Template shared with the guild");
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
    navigate({ to: "/parties/$id", params: { id: data.id } });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold">Plan a party</h1>
      <div className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>Title</Label><Input value={f.title} maxLength={80} placeholder="Baphomet hunt" onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="space-y-1"><Label>Time (your local time)</Label><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Place</Label><Input value={f.place} maxLength={80} placeholder="Prontera south gate / Glast Heim" onChange={(e) => setF({ ...f, place: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Notes</Label><Textarea value={f.notes} maxLength={1000} placeholder="Bring Yggdrasil Berries…" onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>

      <h2 className="mt-8 text-2xl font-bold">Template</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select aria-label="Party template" className={fieldClass + " min-w-60"} value={template} onChange={(e) => { const t = allTemplates.find((t) => t.id === e.target.value); if (t) { setTemplate(t.id); setRoles([...t.roles]); setSignupMode(("signup_mode" in t && t.signup_mode === "open") ? "open" : "core"); setChecklist(("checklist" in t && Array.isArray(t.checklist) ? t.checklist : []) as {quantity:number;name:string}[]); } }}>
          <optgroup label="Guild defaults">{PARTY_TEMPLATES.map((t) => <option value={t.id} key={t.id}>{t.name} ({t.roles.length} slots)</option>)}</optgroup>
          <optgroup label="Member templates">{(templates.data ?? []).map((t) => <option value={t.id} key={t.id}>{t.name} ({t.roles.length} slots)</option>)}</optgroup>
        </select>
        <span className="text-sm text-muted-foreground">{allTemplates.find((t) => t.id === template)?.description}</span>
      </div>
      {templates.isError && <p className="mt-2 text-sm text-destructive">Could not load member templates.</p>}

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
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {roles.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
            <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
            <PartyRoleSelect value={r} onChange={(v) => setRoles(roles.map((x, j) => (j === i ? v : x)))} className="flex-1" />
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
        <Button variant="outline" disabled={!templateName.trim() || savingTemplate || !userId} onClick={saveTemplate}>Save setup as template</Button>
      </div>
      <div className="mt-8"><Button size="lg" disabled={busy} onClick={create}>Create party</Button></div>
    </main>
  );
}
