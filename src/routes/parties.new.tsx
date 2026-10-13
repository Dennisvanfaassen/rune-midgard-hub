import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { JobSelect } from "@/components/JobSelect";
import { MAX_PARTY_SIZE, PARTY_TEMPLATES, canAddSlot } from "@/lib/ro/jobs";

export const Route = createFileRoute("/parties/new")({
  head: () => ({
    meta: [
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
  const [template, setTemplate] = useState("mvp");
  const [roles, setRoles] = useState<string[]>(PARTY_TEMPLATES[0].roles);
  const [busy, setBusy] = useState(false);

  if (ready && !userId) return <main className="mx-auto max-w-xl px-4 py-16">Please <Link to="/auth" className="text-primary">sign in</Link> to plan a party.</main>;

  async function create() {
    const p = schema.safeParse(f);
    if (!p.success) return toast.error(p.error.issues[0].message);
    if (roles.length < 1 || roles.length > MAX_PARTY_SIZE) return toast.error("A party has 1 to 12 slots");
    setBusy(true);
    const { data, error } = await supabase.from("parties").insert({
      creator_id: userId!, title: p.data.title, place: p.data.place, notes: p.data.notes || null, template,
      starts_at: new Date(`${f.date}T${f.time}`).toISOString(),
    }).select("id").single();
    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Could not create party"); }
    const { error: e2 } = await supabase.from("party_slots").insert(roles.map((role, position) => ({ party_id: data.id, position, role })));
    setBusy(false);
    if (e2) return toast.error(e2.message);
    navigate({ to: "/parties/$id", params: { id: data.id } });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold">Plan a party</h1>
      <div className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>Title</Label><Input value={f.title} maxLength={80} placeholder="Baphomet hunt" onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="space-y-1"><Label>Date</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="space-y-1"><Label>Time</Label><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Place</Label><Input value={f.place} maxLength={80} placeholder="Prontera south gate / Glast Heim" onChange={(e) => setF({ ...f, place: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Notes</Label><Textarea value={f.notes} maxLength={1000} placeholder="Bring Yggdrasil Berries…" onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>

      <h2 className="mt-8 text-2xl font-bold">Template</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {PARTY_TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => { setTemplate(t.id); setRoles(t.roles); }}
            className={"rounded-lg border p-3 text-left " + (template === t.id ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary")}>
            <div className="font-semibold">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.description} ({t.roles.length} slots)</div>
          </button>
        ))}
      </div>

      <h2 className="mt-8 text-2xl font-bold">Slots <span className="text-base text-muted-foreground">{roles.length}/{MAX_PARTY_SIZE}</span></h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {roles.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
            <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
            <JobSelect includeAny value={r} onChange={(v) => setRoles(roles.map((x, j) => (j === i ? v : x)))} className="flex-1" />
            <Button size="sm" variant="ghost" disabled={roles.length <= 1} onClick={() => setRoles(roles.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
      </div>
      <Button className="mt-3" variant="outline" disabled={!canAddSlot(roles.length)} onClick={() => setRoles([...roles, "Any"])}>
        {canAddSlot(roles.length) ? "Add slot" : "Party is full (12)"}
      </Button>
      <div className="mt-8"><Button size="lg" disabled={busy} onClick={create}>Create party</Button></div>
    </main>
  );
}
