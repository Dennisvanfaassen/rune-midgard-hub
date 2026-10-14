import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { JobSelect } from "@/components/JobSelect";
import { useServerFn } from "@tanstack/react-start";
import { announceParty, DISCORD_REASON } from "@/lib/discord.functions";
import { MAX_PARTY_SIZE, partyCutoff, canAddSlot, jobName, formatPartyTime, partyCountdown } from "@/lib/ro/jobs";

export const Route = createFileRoute("/parties/$id")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const announce = useServerFn(announceParty);
  const [posting, setPosting] = useState(false);
  const key = ["party", id];
  const { data: party, isLoading } = useQuery({
    queryKey: key, refetchInterval: 30_000,
    queryFn: async () => (await supabase.from("parties").select("*,profiles(display_name),party_slots(*,profiles(display_name,char_name))").eq("id", id).gt("starts_at", partyCutoff()).maybeSingle()).data,
  });
  const me = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("profiles").select("job,char_name,display_name").eq("id", userId ?? "").maybeSingle()).data,
  });
  const [job, setJob] = useState("Knight");
  const [joining, setJoining] = useState(false);
  const waitlist = useQuery({ queryKey: ["party-waitlist",id], refetchInterval: 30_000,
    queryFn: async () => { const {data,error}=await supabase.from("party_waitlist").select("*,profiles(display_name)").eq("party_id",id).order("created_at"); if(error) throw error; return data ?? []; }
  });
  useEffect(() => { if (me.data?.job) setJob(me.data.job); }, [me.data?.job]);

  if (isLoading) return <main className="mx-auto max-w-4xl px-4 py-10 text-muted-foreground">Loading…</main>;
  if (!party) return <main className="mx-auto max-w-4xl px-4 py-10">Party not found. <Link to="/parties" className="text-primary">Back</Link></main>;

  const slots = [...party.party_slots].sort((a, b) => a.position - b.position);
  const isCreator = userId === party.creator_id;
  const mine = slots.find((s) => s.user_id === userId);
  const reserve = (waitlist.data ?? []).find((w) => w.user_id === userId);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function join() {
    if (!userId || joining) return;
    setJoining(true);
    const {data,error}=await supabase.rpc("party_signup",{_party:id,_job:job,_char_name:me.data?.char_name || me.data?.display_name || ""});
    setJoining(false);
    if(error) toast.error(error.message);
    else toast.success(data === "joined" ? "You're in the party!" : "You're on the substitute list. We'll move you into an open spot automatically.");
    await Promise.all([refresh(), qc.invalidateQueries({queryKey:["party-waitlist",id]})]);
  }
  async function leave(memberId?: string) {
    const {error}=await supabase.rpc("party_leave",{_party:id,_member:memberId || null});
    if(error) toast.error(error.message); else toast.success(memberId && memberId!==userId ? "Member removed" : "You left the party");
    await Promise.all([refresh(),qc.invalidateQueries({queryKey:["party-waitlist",id]})]);
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
      <p className="mt-2 text-muted-foreground">{formatPartyTime(party.starts_at)} · {party.place} · organised by {party.profiles?.display_name}</p>
      <p className="mt-2 font-semibold text-primary">{partyCountdown(party.starts_at)}</p>
      <p className="mt-3 text-sm text-muted-foreground">{party.signup_mode === "open" ? "Anyone can join · First come, first served" : "Core classes have priority · Other classes can join the substitute list"}</p>
      {Array.isArray(party.checklist) && party.checklist.length > 0 && <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Bring these items</h2>
        <p className="mb-3 text-sm text-muted-foreground">Please prepare your own supplies before the run.</p>
        <ul className="space-y-2">{(party.checklist as {quantity:number;name:string}[]).map((item,i)=><li key={i} className="flex items-center gap-2 text-sm"><span className="text-primary">✓</span>{item.quantity}× {item.name}</li>)}</ul>
      </section>}
      {party.notes && <p className="mt-4 whitespace-pre-line rounded-lg border border-border bg-card p-4">{party.notes}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">Members {slots.filter((s) => s.user_id).length}/{slots.length}</h2>
        {userId ? (
          <div className="ml-auto flex items-center gap-2 text-sm"><span className="text-muted-foreground">Join as</span><JobSelect value={job} onChange={setJob} /></div>
        ) : <Button asChild size="sm" variant="outline" className="ml-auto"><Link to="/auth">Sign in to join</Link></Button>}
      </div>
      {userId && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex-1 text-sm">{mine ? "You're confirmed for this party." : reserve ? "You're on the substitute list. If a matching place opens, you will be moved in automatically." : "Sign up even if all 12 places are taken or your class isn't needed."}</div>
        {mine || reserve ? <Button variant="outline" onClick={()=>leave()}>Cancel sign-up</Button> : <Button disabled={joining} onClick={join}>{joining ? "Joining…" : "Sign up"}</Button>}
      </div>}
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

            {s.user_id && (s.user_id === userId || isCreator) && <Button size="sm" variant="ghost" onClick={() => leave(s.user_id!)}>{s.user_id === userId ? "Leave" : "Remove"}</Button>}
            {isCreator && !s.user_id && <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("party_slots").delete().eq("id", s.id); refresh(); }}>✕</Button>}
          </div>
        ))}
      </div>
      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Substitutes <span className="text-muted-foreground">({(waitlist.data ?? []).length})</span></h2>
        <p className="mt-1 text-sm text-muted-foreground">Players are automatically promoted in signup order when an eligible place becomes available.</p>
        {(waitlist.data ?? []).length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No substitutes yet.</p> :
          <ol className="mt-4 space-y-2">{(waitlist.data ?? []).map((w,i)=><li key={w.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{i+1}.</span><span className="flex-1 font-medium">{w.char_name || w.profiles?.display_name} <span className="font-normal text-muted-foreground">· {jobName(w.job)}</span></span>
            {(isCreator || w.user_id===userId) && <Button size="sm" variant="ghost" onClick={()=>leave(w.user_id)}>Remove</Button>}
          </li>)}</ol>}
      </section>
      {isCreator && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" disabled={!canAddSlot(slots.length)} onClick={addSlot}>{canAddSlot(slots.length) ? "Add open slot" : `Full (${MAX_PARTY_SIZE} max)`}</Button>
          <Button variant="outline" disabled={posting} onClick={async () => { setPosting(true); try { const r = await announce({ data: { partyId: id, origin: window.location.origin } }); if (r.sent) toast.success("Posted to Discord #party-planner"); else toast.error(`Not posted: ${DISCORD_REASON[r.reason ?? ""] ?? "unknown problem"}`); } catch (e) { toast.error(`Not posted: ${e instanceof Error ? e.message : "network error"}`); } setPosting(false); }}>{posting ? "Posting…" : "Post to Discord"}</Button>
          <Button variant="destructive" onClick={async () => { if (!confirm("Delete this party?")) return; const { error } = await supabase.from("parties").delete().eq("id", id); if (error) { toast.error(error.message); return; } await qc.invalidateQueries({ queryKey: ["parties"] }); navigate({ to: "/parties" }); }}>Delete party</Button>
        </div>
      )}
    </main>
  );
}
