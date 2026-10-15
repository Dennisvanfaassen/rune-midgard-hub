import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Crown, Skull, Trophy, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CharacterPortrait } from "@/components/CharacterPortrait";

type Profile = { id: string; display_name: string; char_name: string | null; avatar_path: string | null };
type Winner = Profile & { points: number };
function Winners({ winners, unit }: { winners: Winner[]; unit: string }) {
  if (!winners.length) return <p className="rounded-lg bg-secondary/30 px-4 py-5 text-sm text-muted-foreground">No achievements earned yet. Be the first!</p>;
  return <div className="divide-y divide-border">
    {winners.slice(0, 5).map((p, idx) => <Link key={p.id} to="/members/$id" params={{ id: p.id }} className="flex items-center gap-3 py-3 hover:text-primary">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold ${idx === 0 ? "bg-amber-400/20 text-amber-600" : "bg-secondary text-muted-foreground"}`}>{idx === 0 ? <Crown className="h-4 w-4" /> : idx + 1}</span>
      <CharacterPortrait path={p.avatar_path} name={p.char_name || p.display_name} className="h-11 w-9 shrink-0"/>
      <span className="min-w-0 flex-1 truncate font-semibold">{p.char_name || p.display_name}</span>
      <span className="shrink-0 text-right font-mono text-sm font-bold tabular-nums">{p.points} <span className="text-xs font-normal text-muted-foreground">{unit}</span></span>
    </Link>)}
  </div>;
}
export function GuildAchievements() {
  const ranking = useQuery({
    queryKey: ["guild-achievements"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [kills, guides, profiles] = await Promise.all([
        supabase.from("mvp_kills").select("id,killer_id").not("killer_id", "is", null).limit(5000),
        supabase.from("forum_threads").select("id,author_id").eq("category", "guides").limit(5000),
        supabase.from("profiles").select("id,display_name,char_name,avatar_path"),
      ]);
      if (kills.error) throw kills.error;
      if (guides.error) throw guides.error;
      if (profiles.error) throw profiles.error;
      const members = (profiles.data ?? []) as Profile[];
      const compile = (ids: string[]) => {
        const counts = new Map<string,number>();
        ids.forEach((id) => counts.set(id,(counts.get(id) ?? 0) + 1));
        return members.filter((p) => counts.has(p.id))
          .map((p) => ({ ...p, points: counts.get(p.id) ?? 0 }))
          .sort((a,b) => b.points - a.points || (a.char_name || a.display_name).localeCompare(b.char_name || b.display_name));
      };
      return {
        killers: compile((kills.data ?? []).flatMap((kill) => kill.killer_id ? [kill.killer_id] : [])),
        scholars: compile((guides.data ?? []).map((thread) => thread.author_id)),
      };
    },
  });
  return <section className="mx-auto mt-10 max-w-6xl px-4">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-[.2em] text-primary"><Trophy className="mr-1 inline h-4 w-4" /> Guild hall of fame</p><h2 className="font-display text-2xl font-bold md:text-3xl">Rune Midgard Achievements</h2><p className="mt-1 text-sm text-muted-foreground">Guild legends are made together. Earn a place at the top!</p></div>
      <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"><Medal className="h-4 w-4" /> Live leaderboards</span>
    </div>
    {ranking.isError && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Rankings unavailable. Apply the MVP achievement migration in Lovable Cloud.</p>}
    <div className="grid gap-4 md:grid-cols-2">
      <div className="overflow-hidden rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4"><div className="rounded-xl bg-rose-500/10 p-3 text-rose-500"><Skull className="h-6 w-6"/></div><div><h3 className="font-display text-xl font-bold">#1 MVP Killer</h3><p className="text-xs text-muted-foreground">Most self-reported MVP kills</p></div></div>
        {ranking.isLoading ? <p className="text-sm text-muted-foreground">Loading champions…</p> : <Winners winners={ranking.data?.killers ?? []} unit="kills"/>}
        <p className="mt-4 text-xs text-muted-foreground">Only kills where a reporter claims participation count. Historical timer reports do not count automatically; claims are not independently verified.</p>
        <Link to="/mvp-tracker" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Track an MVP →</Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4"><div className="rounded-xl bg-sky-500/10 p-3 text-sky-500"><BookOpen className="h-6 w-6"/></div><div><h3 className="font-display text-xl font-bold">Rune Midgard Wikipedia</h3><p className="text-xs text-muted-foreground">Most guides contributed</p></div></div>
        {ranking.isLoading ? <p className="text-sm text-muted-foreground">Loading scholars…</p> : <Winners winners={ranking.data?.scholars ?? []} unit="guides"/>}
        <p className="mt-4 text-xs text-muted-foreground">Counts published topics in the Guides forum category, not replies or other topics.</p>
        <Link to="/forum" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Share a guide →</Link>
      </div>
    </div>
  </section>;
}
