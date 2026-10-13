import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { jobName } from "@/lib/ro/jobs";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rune Midgard · Ragnarok Online Guild" },
      { name: "description", content: "Plan parties, compare builds and hunt gear together with the Rune Midgard guild." },
      { property: "og:title", content: "Rune Midgard · Ragnarok Online Guild" },
      { property: "og:description", content: "Plan parties, compare builds and hunt gear together with the Rune Midgard guild." },
    ],
  }),
  component: Home,
});

function Home() {
  const parties = useQuery({
    queryKey: ["parties", "upcoming"],
    queryFn: async () => (await supabase.from("parties").select("id,title,place,starts_at,party_slots(user_id)")
      .gte("starts_at", new Date().toISOString()).order("starts_at").limit(4)).data ?? [],
  });
  const members = useQuery({
    queryKey: ["members", "newest"],
    queryFn: async () => (await supabase.from("profiles").select("id,display_name,char_name,job,base_lv").order("created_at", { ascending: false }).limit(6)).data ?? [],
  });
  return (
    <main>
      <section className="relative overflow-hidden">
        <img src={hero} alt="Prontera at dusk" width={1920} height={832} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-36">
          <p className="text-sm uppercase tracking-[0.3em] text-primary">Ragnarok Online guild</p>
          <h1 className="mt-3 text-5xl font-black md:text-7xl">Rune Midgard</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">Gather your party, perfect your build and help each other farm the gear you dream of.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/parties">Find a party</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/calculator">Plan your build</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl font-bold">Upcoming parties</h2><Link to="/parties" className="text-sm text-primary">All parties</Link></div>
          <div className="space-y-2">
            {(parties.data ?? []).map((p) => (
              <Link key={p.id} to="/parties/$id" params={{ id: p.id }} className="block rounded-lg border border-border bg-card p-4 hover:border-primary">
                <div className="font-semibold">{p.title}</div>
                <div className="text-sm text-muted-foreground">{new Date(p.starts_at).toLocaleString()} · {p.place} · {p.party_slots.filter((s) => s.user_id).length}/{p.party_slots.length} joined</div>
              </Link>
            ))}
            {parties.data?.length === 0 && <p className="text-sm text-muted-foreground">No parties planned yet.</p>}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-2xl font-bold">Newest members</h2><Link to="/members" className="text-sm text-primary">All members</Link></div>
          <div className="grid grid-cols-2 gap-2">
            {(members.data ?? []).map((m) => (
              <Link key={m.id} to="/members/$id" params={{ id: m.id }} className="rounded-lg border border-border bg-card p-3 hover:border-primary">
                <div className="font-semibold">{m.char_name || m.display_name}</div>
                <div className="text-xs text-muted-foreground">{jobName(m.job)} · Lv {m.base_lv}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
