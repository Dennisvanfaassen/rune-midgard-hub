import { GuildBadge, useGuildBadges } from "@/components/GuildBadge";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { partySpecializationsFor } from "@/lib/ro/party-specializations";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  const badges = useGuildBadges();
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
  const [subRole, setSubRole] = useState("Any");
  const [signupChoice, setSignupChoice] = useState<{ slotId: string | null; role: string } | null>(null);
  const [specialization, setSpecialization] = useState("");
  const specs = useQuery({ queryKey: ["party-specializations", id], queryFn: async () => { const { data, error } = await supabase.from("party_specializations").select("party_id,user_id,role,specialization").eq("party_id", id); if(error) throw error; return data ?? []; }, enabled: !!userId });
  const mySpec = specs.data?.find((spec) => spec.user_id === userId);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState("confirmed");
  const [lateMinutes, setLateMinutes] = useState("15");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const attendance = useQuery({
    queryKey: ["party-attendance", id], enabled: !!userId, refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("party_attendance").select("*").eq("party_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });
  const myAttendance = attendance.data?.find((item) => item.user_id === userId);
  function openAvailability() {
    setAvailabilityStatus(myAttendance?.status ?? "confirmed");
    setLateMinutes(String(myAttendance?.late_minutes ?? 15));
    setAvailabilityMessage(myAttendance?.message ?? "");
    setAvailabilityOpen(true);
  }
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
  const attendeeIds = slots.map((slot) => slot.user_id).filter((value): value is string => !!value);
  const attendanceOf = (memberId: string) => attendance.data?.find((item) => item.user_id === memberId);
  const availabilityText = (item: { status: string; late_minutes: number | null } | undefined) => {
    if (!item) return "Unconfirmed";
    if (item.status === "early") return "Online & ready";
    if (item.status === "late") return `${item.late_minutes ?? "?"}m late`;
    if (item.status === "maybe_late") return `Might be ${item.late_minutes ?? "?"}m late`;
    if (item.status === "uncertain") return "Might not make it";
    if (item.status === "cancelled") return "Can't make it";
    return "Confirmed";
  };
  const attendanceCounts = {
    confirmed: attendeeIds.filter((uid) => ["confirmed", "early"].includes(attendanceOf(uid)?.status ?? "")).length,
    late: attendeeIds.filter((uid) => ["late", "maybe_late"].includes(attendanceOf(uid)?.status ?? "")).length,
    uncertain: attendeeIds.filter((uid) => attendanceOf(uid)?.status === "uncertain").length,
    unconfirmed: attendeeIds.filter((uid) => !attendanceOf(uid)).length,
  };

  function requestJoin(slotId: string | null, role: string) {
    const options = partySpecializationsFor(role);
    if (!options.length) { void join(slotId, role, ""); return; }
    setSignupChoice({ slotId, role });
    setSpecialization(options.length === 1 ? options[0] : "");
  }
  async function join(slotId: string | null, desiredRole = "Any", chosenSpecialization = "") {
    if (!userId || joining) return;
    setJoining(true);
    const { data, error } = await supabase.rpc("party_signup_role", {
      _party: id, _waitlist_role: desiredRole,
      _char_name: me.data?.char_name || me.data?.display_name || "",
      ...(slotId !== null ? { _slot: slotId } : {})
    });
    if (error) toast.error(error.message);
    else {
      // A returning member must not keep an old cancelled attendance status.
      const prior = attendance.data?.find((item) => item.user_id === userId);
      if (prior?.status === "cancelled") {
        const reset = await supabase.from("party_attendance").update({ status: "confirmed", late_minutes: null, message: "", updated_at: new Date().toISOString() }).eq("party_id", id).eq("user_id", userId);
        if (reset.error) toast.error("Joined, but could not reset previous attendance: " + reset.error.message);
        qc.invalidateQueries({ queryKey: ["party-attendance", id] });
      }
      if (chosenSpecialization) {
        const saved = await supabase.from("party_specializations").upsert({
          party_id: id, user_id: userId, role: desiredRole,
          specialization: chosenSpecialization, updated_at: new Date().toISOString(),
        }, { onConflict: "party_id,user_id" });
        if (saved.error) toast.error(`Signup succeeded but specialization could not be saved: ${saved.error.message}`);
        else qc.invalidateQueries({ queryKey: ["party-specializations", id] });
      }
      toast.success(data === "joined" ? "You're confirmed for that spot!" : "You've joined the substitute list. You will be considered when a spot opens.");
      setSignupChoice(null);
    }
    setJoining(false);
    await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["party-waitlist", id] })]);
  }
  async function leave(memberId?: string) {
    const {error}=await supabase.rpc("party_leave",{_party:id, ...(memberId ? { _member: memberId } : {})});
    if(error) toast.error(error.message); else toast.success(memberId && memberId!==userId ? "Member removed" : "You left the party");
    await Promise.all([refresh(),qc.invalidateQueries({queryKey:["party-waitlist",id]})]);
  }
  async function saveAvailability() {
    if (!userId || availabilityBusy || (!mine && !reserve)) return;
    const isLate = availabilityStatus === "late" || availabilityStatus === "maybe_late";
    const minutes = Number(lateMinutes);
    if (isLate && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) { toast.error("Enter a number of minutes between 1 and 1440"); return; }
    if (availabilityStatus === "cancelled" && !window.confirm("Can't make it? This releases your slot and may promote a substitute. Continue?")) return;
    setAvailabilityBusy(true);
    const { error } = await supabase.from("party_attendance").upsert({
      party_id: id, user_id: userId, status: availabilityStatus,
      late_minutes: isLate ? minutes : null,
      message: availabilityMessage.trim().slice(0, 300),
      updated_at: new Date().toISOString(),
    }, { onConflict: "party_id,user_id" });
    if (error) { toast.error(error.message); setAvailabilityBusy(false); return; }
    if (availabilityStatus === "cancelled") {
      const result = await supabase.rpc("party_leave", { _party: id });
      if (result.error) {
        toast.error("Cancellation saved but your slot could not be released: " + result.error.message);
      } else {
        toast.success("Cancelled your attendance; substitutes can take your place.");
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["party-waitlist", id] }),
          qc.invalidateQueries({ queryKey: ["party-specializations", id] }),
        ]);
      }
      refresh();
    } else toast.success("Availability updated");
    await qc.invalidateQueries({ queryKey: ["party-attendance", id] });
    setAvailabilityOpen(false);
    setAvailabilityBusy(false);
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
      <p className="mt-2 text-muted-foreground">{formatPartyTime(party.starts_at)} · {party.place} · organised by {party.profiles?.display_name} <GuildBadge role={badges.data?.[party.creator_id]} /></p>
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
          : <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground" htmlFor="substitute-role">Can cover</label>
              <select id="substitute-role" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={subRole} onChange={(e) => setSubRole(e.target.value)}>
                {["Any", ...new Set(slots.map((s) => s.role).filter((r) => r !== "Any"))].map((role) => <option value={role} key={role}>{role === "Any" ? "Any role" : jobName(role)}</option>)}
              </select>
              <Button variant="outline" disabled={joining} onClick={() => requestJoin(null, subRole)}>Join substitutes</Button>
            </div>}
      </div> : <Button asChild size="sm" variant="outline" className="mt-4"><Link to="/auth">Sign in to join</Link></Button>}
      {(mine || reserve) && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div><div className="text-sm font-semibold">My attendance: <span className="text-primary">{availabilityText(myAttendance)}</span></div><p className="text-xs text-muted-foreground">Let your organizer know if you're late or unable to attend.</p></div>
        <Button variant="outline" size="sm" onClick={openAvailability}>Update availability</Button>
      </div>}
      {mySpec && (mine || reserve) && <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">Your specialization: <strong>{mySpec.specialization}</strong></p>}
      {mine && <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">My party readiness</h2>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={readiness.data?.find((r) => r.user_id === userId)?.ready ?? false} onChange={(e) => markReady("ready", e.target.checked)} />Ready to join</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={readiness.data?.find((r) => r.user_id === userId)?.supplies_ready ?? false} onChange={(e) => markReady("supplies_ready", e.target.checked)} />Supplies prepared</label>
        </div>
        {readiness.isError && <p className="mt-2 text-xs text-destructive">Readiness requires the latest Supabase SQL migration.</p>}
      </section>}
      <section className="mt-5 rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold">Attendance overview</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-600">{attendanceCounts.confirmed} confirmed / ready</span>
          <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-600">{attendanceCounts.late} late or possibly late</span>
          <span className="rounded-full bg-orange-500/10 px-3 py-1.5 text-orange-600">{attendanceCounts.uncertain} uncertain</span>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-muted-foreground">{attendanceCounts.unconfirmed} unconfirmed</span>
        </div>
        {attendance.isError && <p className="mt-2 text-sm text-destructive">Attendance data requires migration 0013 in Lovable Cloud.</p>}
        {isCreator && (attendance.data ?? []).filter((item) => item.status !== "confirmed" && item.status !== "early").length > 0 && <div className="mt-4 space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground">Recent attendance changes</p>
          {(attendance.data ?? []).filter((item) => item.status !== "confirmed" && item.status !== "early").sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8).map((item) => <p key={item.user_id} className="text-xs"><span className="font-medium">{slots.find((slot) => slot.user_id === item.user_id)?.profiles?.display_name ?? (waitlist.data ?? []).find((w) => w.user_id === item.user_id)?.profiles?.display_name ?? "Former member"}</span> · {availabilityText(item)} {item.message && <span className="text-muted-foreground">— {item.message}</span>}</p>)}
        </div>}
      </section>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {slots.map((s) => (
          <div key={s.id} className={"flex items-center gap-3 rounded-lg border p-3 " + (s.user_id ? "border-primary/40 bg-card" : "border-dashed border-border")}>
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.role === "Any" ? "Any class" : jobName(s.role)}</div>
              {s.user_id ? (
                <Link to="/members/$id" params={{ id: s.user_id }} className="font-semibold hover:text-primary">
                  {s.char_name || s.profiles?.display_name} <GuildBadge role={badges.data?.[s.user_id ?? ""]} /> {readiness.data?.find((r) => r.user_id === s.user_id)?.ready && <span title="Member ready" className="text-xs text-emerald-500">✓ Ready</span>} {readiness.data?.find((r) => r.user_id === s.user_id)?.supplies_ready && <span title="Supplies ready" className="text-xs text-emerald-500">✓ Supplies</span>} <span className="text-sm text-primary">{s.job && jobName(s.job)}</span>
                </Link>
              ) : <div className="text-sm text-muted-foreground">Open slot</div>}
              {s.user_id && <div className="mt-1 text-xs text-muted-foreground">{availabilityText(attendanceOf(s.user_id))}{attendanceOf(s.user_id)?.message ? ` · ${attendanceOf(s.user_id)?.message}` : ""}</div>}
              {s.user_id && specs.data?.find((spec) => spec.user_id === s.user_id)?.specialization && <div className="mt-1 text-xs font-medium text-primary">{specs.data?.find((spec) => spec.user_id === s.user_id)?.specialization}</div>}
            </div>

            {!s.user_id && !!userId && !mine && !reserve && <Button size="sm" disabled={joining} onClick={() => requestJoin(s.id, s.role)}>Join this role</Button>}
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
            <span className="text-muted-foreground">{i+1}.</span><span className="flex-1 font-medium">{w.char_name || w.profiles?.display_name} <GuildBadge role={badges.data?.[w.user_id]} /> <span className="font-normal text-muted-foreground">· Preferred: {jobName(w.job)}{specs.data?.find((spec) => spec.user_id === w.user_id)?.specialization ? ` · ${specs.data?.find((spec) => spec.user_id === w.user_id)?.specialization}` : ""}</span></span>
            {(isCreator || w.user_id===userId) && <Button size="sm" variant="ghost" onClick={()=>leave(w.user_id)}>Remove</Button>}
          </li>)}</ol>}
      </section>
      <Dialog open={availabilityOpen} onOpenChange={(open) => { if (!availabilityBusy) setAvailabilityOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Update availability</DialogTitle><DialogDescription>Keep your party organizer informed before the run.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {([
              ["confirmed", "I'll be there on time"],
              ["early", "I'm online and ready"],
              ["late", "I'll be late"],
              ["maybe_late", "I might be late"],
              ["uncertain", "I might not make it"],
              ["cancelled", "I can't make it"],
            ] as const).map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${availabilityStatus === value ? "border-primary bg-primary/10" : "border-border"}`}>
              <input type="radio" name="party-availability" checked={availabilityStatus === value} onChange={() => setAvailabilityStatus(value)} />
              {label}
            </label>)}
            {(availabilityStatus === "late" || availabilityStatus === "maybe_late") && <div>
              <label htmlFor="attendance-late-minutes" className="text-xs font-semibold">Minutes late</label>
              <div className="mt-2 flex flex-wrap gap-2">{[5, 10, 15, 30, 60].map((v) => <Button size="sm" key={v} type="button" variant={lateMinutes === String(v) ? "default" : "outline"} onClick={() => setLateMinutes(String(v))}>{v}m</Button>)}</div>
              <Input id="attendance-late-minutes" className="mt-2" type="number" min={1} max={1440} value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} />
            </div>}
            <label className="block text-xs font-semibold">Message to organizer (optional)
              <textarea className="mt-2 min-h-20 w-full rounded-md border border-input bg-background p-3 text-sm" maxLength={300} value={availabilityMessage} onChange={(e) => setAvailabilityMessage(e.target.value)} placeholder="e.g. Running late from work" />
            </label>
            {availabilityStatus === "cancelled" && <p className="text-xs text-destructive">Your slot will be released and a substitute may automatically be promoted.</p>}
            <Button className="w-full" disabled={availabilityBusy} onClick={() => void saveAvailability()}>{availabilityBusy ? "Saving…" : "Save availability"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!signupChoice} onOpenChange={(open) => { if (!open && !joining) setSignupChoice(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Join as {signupChoice?.role}</DialogTitle><DialogDescription>Choose the specialization you can bring to this party.</DialogDescription></DialogHeader>
          <div className="grid gap-2 py-2">
            {partySpecializationsFor(signupChoice?.role ?? "").map((option) => <button type="button" key={option} onClick={() => setSpecialization(option)} aria-pressed={specialization === option} className={`rounded-lg border px-4 py-3 text-left text-sm transition ${specialization === option ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border hover:bg-secondary"}`}>{option}</button>)}
            <button type="button" onClick={() => setSpecialization("")} className={`rounded-lg border px-4 py-2 text-left text-sm ${!specialization ? "border-primary bg-primary/10" : "border-border text-muted-foreground"}`}>Not specified</button>
          </div>
          <Button disabled={joining || !signupChoice} onClick={() => signupChoice && void join(signupChoice.slotId, signupChoice.role, specialization)}>{joining ? "Joining…" : "Confirm signup"}</Button>
        </DialogContent>
      </Dialog>
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
