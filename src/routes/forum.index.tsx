import { GuildBadge, useGuildBadges } from "@/components/GuildBadge";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichEditor } from "@/components/RichText";
import { fieldClass } from "@/components/JobSelect";
import { FORUM_CATEGORIES, categoryName } from "@/lib/forum";

export const Route = createFileRoute("/forum/")({
  head: () => ({ meta: [
    { title: "Guild Forum · Rune Midgard" },
    { name: "description", content: "Guides, builds and discussion from Rune Midgard guild members." },
    { property: "og:title", content: "Guild Forum · Rune Midgard" },
    { property: "og:description", content: "Guides, builds and discussion from Rune Midgard guild members." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Forum,
});

function Forum() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [cat, setCat] = useState("all");
  const badges = useGuildBadges();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", body: "", category: "guides" });
  const [busy, setBusy] = useState(false);
  const threads = useQuery({
    queryKey: ["forum", "threads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("forum_threads").select("id,title,category,pinned,created_at,last_post_at,author_id,profiles(display_name,char_name),forum_posts(count)").order("pinned", { ascending: false }).order("last_post_at", { ascending: false });
      if (error) throw error; return data;
    },
  });
  const list = (threads.data ?? []).filter((t) => (cat === "all" || t.category === cat) && t.title.toLowerCase().includes(q.toLowerCase()));
  async function create() {
    if (!userId) return;
    if (!f.title.trim() || !f.body.trim()) { toast.error("Add a title and a message"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("forum_threads").insert({ author_id: userId, title: f.title.trim(), body: f.body.trim(), category: f.category }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/forum/$id", params: { id: data.id } });
  }
  return <main className="mx-auto max-w-5xl px-4 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-4xl font-bold">Guild Forum</h1>
      {userId ? <Button onClick={() => setOpen(!open)}>{open ? "Cancel" : "New topic"}</Button> : <Button asChild variant="outline"><Link to="/auth">Sign in to post</Link></Button>}
    </div>
    {open && <div className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Category" className={fieldClass} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{FORUM_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Input className="flex-1" placeholder="Topic title" maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>
      <RichEditor placeholder="Write your guide, build or question… add headings, colours and images" minHeight={320} onChange={(body) => setF((prev) => ({ ...prev, body }))} />
      <div><Button disabled={busy} onClick={create}>Post topic</Button></div>
    </div>}
    <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <button onClick={() => setCat("all")} className={"rounded-lg border p-3 text-left " + (cat === "all" ? "border-primary bg-secondary" : "border-border bg-card")}><div className="font-semibold">All topics</div><div className="text-xs text-muted-foreground">{threads.data?.length ?? 0} topics</div></button>
      {FORUM_CATEGORIES.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={"rounded-lg border p-3 text-left " + (cat === c.id ? "border-primary bg-secondary" : "border-border bg-card")}>
        <div className="font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.description}</div></button>)}
    </div>
    <Input aria-label="Search topics" className="mt-4 max-w-sm" placeholder="Search topics" value={q} onChange={(e) => setQ(e.target.value)} />
    {threads.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
    {threads.isError && <p className="mt-6 text-destructive">Could not load the forum.</p>}
    <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
      {list.map((t) => <Link key={t.id} to="/forum/$id" params={{ id: t.id }} className="flex flex-wrap items-center gap-3 p-4 hover:bg-secondary">
        {t.pinned && <Pin className="h-4 w-4 text-primary" />}
        <div className="min-w-0 flex-1"><div className="font-semibold">{t.title}</div>
          <div className="text-xs text-muted-foreground">{categoryName(t.category)} · by {t.profiles?.char_name || t.profiles?.display_name} <GuildBadge role={badges.data?.[t.author_id]} /> · {new Date(t.created_at).toLocaleDateString()}</div></div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground"><MessageSquare className="h-4 w-4" />{t.forum_posts[0]?.count ?? 0}</div>
        <div className="w-32 text-right text-xs text-muted-foreground">Last activity<br />{new Date(t.last_post_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</div>
      </Link>)}
      {!threads.isLoading && list.length === 0 && <p className="p-4 text-muted-foreground">No topics yet. Start the first one!</p>}
    </div>
  </main>;
}
