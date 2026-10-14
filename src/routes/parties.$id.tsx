import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
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
  const { data: party, isLoading, isError: partyError, error: partyLoadError } = useQuery({
    queryKey: key, refetchInterval: 30_000,
    queryFn: async () => {
      const { data: party, error } = await supabase.from("parties").select("*").eq("id", id).gt("starts_at", partyCutoff()).maybeSingle();
      if (error) throw new Error(`Party: ${error.message} (${error.code})`);
      if (!party) return null;
      const [slotResult, organiserResult] = await Promise.all([
        supabase.from("party_slots").select("*").eq("party_id", id).order("position"),
        supabase.from("profiles").select("id,display_name").eq("id", party.creator_id).maybeSingle(),
      ]);
      if (slotResult.error) throw new Error(`Party slots: ${slotResult.error.message} (${slotResult.error.code})`);
      const slots = slotResult.data ?? [];
      const members = [...new Set(slots.map((slot) => slot.user_id).filter((v): v is string => !!v))];
      const memberResult = members.length ? await supabase.from("profiles").select("id,display_name,char_name").in("id", members) : null;
      if (memberResult?.error) console.warn("Member names unavailable:", memberResult.error);
      return {
        ...party,
        profiles: organiserResult.data ?? null,
        party_slots: slots.map((slot) => ({
          ...slot,
          profiles: memberResult?.data?.find((member) => member.id === slot.user_id) ?? null,
        })),
      };
    },
  });
  const me = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("profiles").select("job,char_name,display_name").eq("id", userId ?? "").maybeSingle()).data,
  });
  const [joining, setJoining] = useState(false);
  const readiness = useQuery({
    queryKey: ["party-readiness", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("party_readiness").select("*").eq("party_id", id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
  async function markReady(field: "ready" | "supplies_ready", checked: boolean) {
    if (!userId) return;
    const current = readiness.data?.find((r) => r.user_id === userId);
    const { error } = await supabase.from("party_readiness").upsert({
      party_id: id, user_id: userId,
      ready: field === "ready" ? checked : current?.ready ?? false,
      supplies_ready: field === "supplies_ready" ? checked : current?.supplies_ready ?? false,
      updated_at: new Date().toISOString(),
    });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["party-readiness", id] });
  }
  const waitlist = useQuery({ queryKey: ["party-waitlist",id], refetchInterval: 30_000,
    queryFn: async () => { const {data,error}=await supabase.from("party_waitlist").select("*,profiles(display_name)").eq("party_id",id).order("created_at"); if(error) throw error; return data ?? []; }
  });

  if (isLoading) return <main className="mx-auto max-w-4xl px-4 py-10 text-muted-foreground">Loading…</main>;
  if (partyError) return <main className="mx-auto max-w-4xl px-4 py-10 text-destructive">Could not load party: {partyLoadError instanceof Error ? partyLoadError.message : String((partyLoadError as {message?:string})?.message ?? partyLoadError)}</main>;
  if (!party) return <main className="mx-auto max-w-4xl px-4 py-10">Party not found. <Link to="/parties" className="text-primary">Back</Link></main>;

  const slots = [...party.party_slots].sort((a, b) => a.position - b.position);
  const isCreator = userId === party.creator_id;
  const mine = slots.find((s) => s.user_id === userId);
  const reserve = (waitlist.data ?? []).find((w) => w.user_id === userId);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function join(slotId: string | null, desiredRole = "Any") {
    if (!userId || joining) return;
    setJoining(true);
    const { data, error } = await supabase.rpc("party_signup_role", {
      _party: id, _slot: slotId, _waitlist_role: desiredRole,
      _char_name: me.data?.char_name || me.data?.display_name || ""
    });
    setJoining(false);
    if (error) toast.error(error.message);
    else toast.success(data === "joined" ? "You're confirmed for that spot!" : "You've joined the substitute list. You will be considered when a spot opens.");
    await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["party-waitlist", id] })]);
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
      <p className="mt-3 text-sm text-muted-foreground">{party.signup_mode === "open" ? "Anyone can join · First come, first served" : "Choose any open role, regardless of profile class · Substitute list available"}</p>
      {Array.isArray(party.checklist) && party.checklist.length > 0 && <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Bring these items</h2>
        <p className="mb-3 text-sm text-muted-foreground">Please prepare your own supplies before the run.</p>
        <ul className="space-y-2">{(party.checklist as {quantity:number;name:string}[]).map((item,i)=><li key={i} className="flex items-center gap-2 text-sm"><span className="text-primary">✓</span>{item.quantity}× {item.name}</li>)}</ul>
      </section>}
      {party.notes && <p className="mt-4 whitespace-pre-line rounded-lg border border-border bg-card p-4">{party.notes}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold">Members {slots.filter((s) => s.user_id).length}/{slots.length}</h2>
        <p className="text-sm text-muted-foreground">Choose the role you will play. Your profile class never restricts your signup.</p>
      </div>
      {userId ? <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex-1 text-sm">{mine ? "You're confirmed for this party." : reserve ? "You're on the substitute list." : "Select Join this role on an open slot, or volunteer as a substitute even when slots are available."}</div>
        {mine || reserve
          ? <Button variant="outline" onClick={() => leave()}>Cancel sign-up</Button>
          : <Button variant="outline" disabled={joining} onClick={() => join(null, "Any")}>Put me on the substitution list</Button>}
      </div> : <Button asChild size="sm" variant="outline" className="mt-4"><Link to="/auth">Sign in to join</Link></Button>}
      {mine && <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">My party readiness</h2>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={readiness.data?.find((r) => r.user_id === userId)?.ready ?? false} onChange={(e) => markReady("ready", e.target.checked)} />Ready to join</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={readiness.data?.find((r) => r.user_id === userId)?.supplies_ready ?? false} onChange={(e) => markReady("supplies_ready", e.target.checked)} />Supplies prepared</label>
        </div>
        {readiness.isError && <p className="mt-2 text-xs text-destructive">Readiness requires the latest Supabase SQL migration.</p>}
      </section>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {slots.map((s) => (
          <div key={s.id} className={"flex items-center gap-3 rounded-lg border p-3 " + (s.user_id ? "border-primary/40 bg-card" : "border-dashed border-border")}>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.role === "Any" ? "Any class" : jobName(s.role)}</div>
              {s.user_id ? (
                <Link to="/members/$id" params={{ id: s.user_id }} className="font-semibold hover:text-primary">
                  {s.char_name || s.profiles?.display_name} {readiness.data?.find((r) => r.user_id === s.user_id)?.ready && <span title="Member ready" className="text-xs text-emerald-500">✓ Ready</span>} {readiness.data?.find((r) => r.user_id === s.user_id)?.supplies_ready && <span title="Supplies ready" className="text-xs text-emerald-500">✓ Supplies</span>} <span className="text-sm text-primary">{s.job && jobName(s.job)}</span>
                </Link>
              ) : <div className="text-sm text-muted-foreground">Open slot</div>}
            </div>

            {!s.user_id && !!userId && !mine && !reserve && <Button size="sm" disabled={joining} onClick={() => join(s.id, s.role)}>Join this role</Button>}
            {s.user_id && (s.user_id === userId || isCreator) && <Button size="sm" variant="ghost" onClick={() => leave(s.user_id!)}>{s.user_id === userId ? "Leave" : "Remove"}</Button>}
            {isCreator && !s.user_id && <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("party_slots").delete().eq("id", s.id); refresh(); }}>✕</Button>}
          </div>
        ))}
      </div>
      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Substitutes <span className="text-muted-foreground">({(waitlist.data ?? []).length})</span></h2>
        <p className="mt-1 text-sm text-muted-foreground">Substitutes who selected a matching role get priority; otherwise the earliest available substitute is promoted. No profile-class restrictions.</p>
        {(waitlist.data ?? []).length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No substitutes yet.</p> :
          <ol className="mt-4 space-y-2">{(waitlist.data ?? []).map((w,i)=><li key={w.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{i+1}.</span><span className="flex-1 font-medium">{w.char_name || w.profiles?.display_name} <span className="font-normal text-muted-foreground">· Preferred: {jobName(w.job)}</span></span>
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
