import { GuildBadge, useGuildBadges } from "@/components/GuildBadge";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { partyCutoff, formatPartyTime, partyCountdown } from "@/lib/ro/jobs";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/parties/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Party Planner · Rune Midgard" },
      { name: "description", content: "Plan and join guild parties: MVP hunts, WoE squads, dungeon runs and leveling." },
      { property: "og:title", content: "Party Planner · Rune Midgard" },
      { property: "og:description", content: "Plan and join guild parties: MVP hunts, WoE squads, dungeon runs and leveling." },
    ],
  }),
  component: Parties,
});

function Parties() {
  const { userId } = useAuth();
  const badges = useGuildBadges();
  const { data = [], isLoading, isError, error } = useQuery({
    refetchInterval: 30_000,
    queryKey: ["parties"],
    queryFn: async () => {
      // Avoid PostgREST embedded joins: a missing/ambiguous FK must not hide parties.
      const { data: parties, error } = await supabase.from("parties")
        .select("id,title,place,starts_at,template,creator_id")
        .gt("starts_at", partyCutoff()).order("starts_at");
      if (error) throw new Error(`Parties: ${error.message} (${error.code})`);
      if (!parties?.length) return [];
      const [slotResult, profileResult] = await Promise.all([
        supabase.from("party_slots").select("party_id,user_id").in("party_id", parties.map((p) => p.id)),
        supabase.from("profiles").select("id,display_name").in("id", [...new Set(parties.map((p) => p.creator_id))]),
      ]);
      // Missing metadata should not prevent the actual parties from displaying.
      if (slotResult.error) console.warn("Could not load party slot counts:", slotResult.error);
      if (profileResult.error) console.warn("Could not load organiser names:", profileResult.error);
      return parties.map((p) => ({
        ...p,
        party_slots: (slotResult.data ?? []).filter((slot) => slot.party_id === p.id),
        profiles: (profileResult.data ?? []).find((person) => person.id === p.creator_id) ?? null,
      }));
    },
  });
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-bold">Party Planner</h1>
        {userId ? <Button asChild><Link to="/parties/new">Plan a party</Link></Button>
          : <Button asChild variant="outline"><Link to="/auth">Sign in to plan a party</Link></Button>}
      </div>
      <Link to="/queue" className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm hover:border-primary/60"><span><strong>Ready to play right now?</strong> Find a duo or party in the live queue.</span><span className="font-semibold text-primary">Open Party Queue →</span></Link>
      {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {isError && <p className="mt-6 rounded-lg border border-destructive p-4 text-destructive">Could not load parties: {error instanceof Error ? error.message : String((error as {message?:string})?.message ?? error)}</p>}
      <div className="mt-6 grid gap-3">
        {data.map((p) => {
          const filled = p.party_slots.filter((s) => s.user_id).length;
          return (
            <Link key={p.id} to="/parties/$id" params={{ id: p.id }} className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-primary">
              <div>
                <div className="font-display text-lg font-bold">{p.title}</div>
                <div className="text-sm text-muted-foreground">{formatPartyTime(p.starts_at)} · {p.place} · by {p.profiles?.display_name} <GuildBadge role={badges.data?.[p.creator_id]} /></div>
                <div className="text-sm font-semibold text-primary">{partyCountdown(p.starts_at)}</div>
              </div>
              <div className="ml-auto rounded-md bg-secondary px-3 py-1 text-sm"><span className="text-primary">{filled}</span>/{p.party_slots.length} members</div>
            </Link>
          );
        })}
        {!isLoading && !isError && data.length === 0 && <p className="text-muted-foreground">No upcoming parties. Plan the first one!</p>}
      </div>
    </main>
  );
}

