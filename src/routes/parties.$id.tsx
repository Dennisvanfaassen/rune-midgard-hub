import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { JobSelect } from "@/components/JobSelect";
import { MAX_PARTY_SIZE, canAddSlot, canTakeSlot, jobName } from "@/lib/ro/jobs";

export const Route = createFileRoute("/parties/$id")({
  head: () => ({
    meta: [
      { title: "Party details · Rune Midgard" },
      { name: "description", content: "See who joined this guild party and take an open slot." },
      { property: "og:title", content: "Party details · Rune Midgard" },
      { property: "og:description", content: "See who joined this guild party and take an open slot." },
    ],
  }),
  component: PartyPage,
});

function PartyPage() {
  const { id } = Route.useParams();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const key = ["party", id];
  const { data: party, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => (await supabase.from("parties").select("*,profiles(display_name),party_slots(*,profiles(display_name,char_name))").eq("id", id).maybeSingle()).data,
  });
  const me = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("profiles").select("job,char_name,display_name").eq("id", userId!).maybeSingle()).data,
  });
  const [job, setJob] = useState("Knight");
  useEffect(() => { if (me.data?.job) setJob(me.data.job); }, [me.data?.job]);

  if (isLoading) return <main className="mx-auto max-w-4xl px-4 py-10 text-muted-foreground">Loading…</main>;
  if (!party) return <main className="mx-auto max-w-4xl px-4 py-10">Party not found. <Link to="/parties" className="text-primary">Back</Link></main>;

  const slots = [...party.party_slots].sort((a, b) => a.position - b.position);
  const isCreator = userId === party.creator_id;
  const mine = slots.find((s) => s.user_id === userId);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function take(slotId: string, role: string) {
    if (!canTakeSlot(role, job)) return toast.error(`This slot needs a ${jobName(role)}`);
    if (mine) await supabase.from("party_slots").update({ user_id: null, job: null, char_name: null }).eq("id", mine.id);
    const { error } = await supabase.from("party_slots").update({ user_id: userId, job, char_name: me.data?.char_name || me.data?.display_name })
      .eq("id", slotId).is("user_id", null);
    if (error) toast.error(error.message); else toast.success("You joined the party");
    refresh();
  }
  async function leave(slotId: string) {
    await supabase.from("party_slots").update({ user_id: null, job: null, char_name: null }).eq("id", slotId);
    refresh();
  }
  async function addSlot() {
    if (!canAddSlot(slots.length)) return;
    const { error } = await supabase.from("party_slots").insert({ party_id: id, position: Math.max(-1, ...slots.map((s) => s.position)) + 1, role: "Any" });
    if (error) toast.error(error.message); refresh();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/parties" className="text-sm text-primary">← All parties</Link>
      <h1 className="mt-2 text-4xl font-bold">{party.title}</h1>
      <p className="mt-2 text-muted-foreground">{new Date(party.starts_at).toLocaleString()} · {party.place} · organised by {party.profiles?.display_name}</p>
      {party.notes && <p className="mt-4 whitespace-pre-line rounded-lg border border-border bg-card p-4">{party.notes}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">Members {slots.filter((s) => s.user_id).length}/{slots.length}</h2>
        {userId ? (
          <div className="ml-auto flex items-center gap-2 text-sm"><span className="text-muted-foreground">Join as</span><JobSelect value={job} onChange={setJob} /></div>
        ) : <Button asChild size="sm" variant="outline" className="ml-auto"><Link to="/auth">Sign in to join</Link></Button>}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {slots.map((s) => (
          <div key={s.id} className={"flex items-center gap-3 rounded-lg border p-3 " + (s.user_id ? "border-primary/40 bg-card" : "border-dashed border-border")}>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.role === "Any" ? "Any class" : jobName(s.role)}</div>
              {s.user_id ? (
                <Link to="/members/$id" params={{ id: s.user_id }} className="font-semibold hover:text-primary">
                  {s.char_name || s.profiles?.display_name} <span className="text-sm text-primary">{s.job && jobName(s.job)}</span>
                </Link>
              ) : <div className="text-sm text-muted-foreground">Open slot</div>}
            </div>
            {!s.user_id && userId && <Button size="sm" disabled={!canTakeSlot(s.role, job)} onClick={() => take(s.id, s.role)}>Join</Button>}
            {s.user_id && (s.user_id === userId || isCreator) && <Button size="sm" variant="ghost" onClick={() => leave(s.id)}>{s.user_id === userId ? "Leave" : "Remove"}</Button>}
            {isCreator && !s.user_id && <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("party_slots").delete().eq("id", s.id); refresh(); }}>✕</Button>}
          </div>
        ))}
      </div>
      {isCreator && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" disabled={!canAddSlot(slots.length)} onClick={addSlot}>{canAddSlot(slots.length) ? "Add open slot" : `Full (${MAX_PARTY_SIZE} max)`}</Button>
          <Button variant="destructive" onClick={async () => { if (!confirm("Delete this party?")) return; await supabase.from("parties").delete().eq("id", id); navigate({ to: "/parties" }); }}>Delete party</Button>
        </div>
      )}
    </main>
  );
}
