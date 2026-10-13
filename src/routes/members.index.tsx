import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { JobSelect } from "@/components/JobSelect";
import { Input } from "@/components/ui/input";
import { jobName } from "@/lib/ro/jobs";

export const Route = createFileRoute("/members/")({
  head: () => ({
    meta: [
      { title: "Members · Rune Midgard" },
      { name: "description", content: "All Rune Midgard guild members with their builds and gear goals." },
      { property: "og:title", content: "Members · Rune Midgard" },
      { property: "og:description", content: "All Rune Midgard guild members with their builds and gear goals." },
    ],
  }),
  component: Members,
});

function Members() {
  const [q, setQ] = useState("");
  const [job, setJob] = useState("Any");
  const { data = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("profiles").select("id,display_name,char_name,job,base_lv,job_lv,avatar_path,gear_wishlist(status)").order("display_name")).data ?? [],
  });
  const list = data.filter((m) => (job === "Any" || m.job === job) &&
    `${m.display_name} ${m.char_name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-bold">Guild members</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        <Input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <JobSelect value={job} onChange={setJob} includeAny />
      </div>
      {isLoading && <p className="mt-6 text-muted-foreground">Loading members…</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => {
          const need = m.gear_wishlist.filter((g) => g.status === "need").length;
          return (
            <Link key={m.id} to="/members/$id" params={{ id: m.id }} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition hover:border-primary">
              <CharacterPortrait path={m.avatar_path} name={m.char_name || m.display_name} />
              <div className="min-w-0">
              <div className="font-display text-lg font-bold">{m.char_name || m.display_name}</div>
              {m.char_name && <div className="text-xs text-muted-foreground">{m.display_name}</div>}
              <div className="mt-2 text-sm text-primary">{jobName(m.job)} · Base {m.base_lv} / Job {m.job_lv}</div>
              <div className="mt-1 text-xs text-muted-foreground">{need} item{need === 1 ? "" : "s"} still needed</div>
              </div>
            </Link>
          );
        })}
      </div>
      {!isLoading && list.length === 0 && <p className="mt-6 text-muted-foreground">No members found.</p>}
    </main>
  );
}
