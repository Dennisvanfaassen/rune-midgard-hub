import { GuildBadge, useGuildBadges } from "@/components/GuildBadge";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { RichEditor, RichContent } from "@/components/RichText";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { categoryName } from "@/lib/forum";
import { jobName } from "@/lib/ro/jobs";

export const Route = createFileRoute("/forum/$id")({
  head: () => ({ meta: [
    { title: "Forum topic · Rune Midgard" },
    { name: "description", content: "Read and reply to a Rune Midgard guild forum topic." },
    { property: "og:title", content: "Forum topic · Rune Midgard" },
    { property: "og:description", content: "Read and reply to a Rune Midgard guild forum topic." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Thread,
});

type Author = { id: string; display_name: string; char_name: string | null; job: string; avatar_path: string | null } | null;

function PostCard({ author, body, date, actions }: { author: Author; body: string; date: string; actions?: React.ReactNode }) {
  const badges = useGuildBadges();
  return <article className="flex gap-4 rounded-lg border border-border bg-card p-4">
    <Link to="/members/$id" params={{ id: author?.id ?? "" }} className="hidden w-28 shrink-0 flex-col items-center text-center sm:flex">
      <CharacterPortrait path={author?.avatar_path ?? null} name={author?.char_name || author?.display_name || "?"} className="h-20 w-16" />
      <span className="mt-1 text-sm font-semibold text-primary">{author?.char_name || author?.display_name}</span><GuildBadge role={badges.data?.[author?.id ?? ""]} />
      <span className="text-xs text-muted-foreground">{author && jobName(author.job)}</span>
    </Link>
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="font-semibold text-primary sm:hidden">{author?.char_name || author?.display_name}</span>{new Date(date).toLocaleString()}<div className="ml-auto flex gap-1">{actions}</div></div>
      <div className="break-words"><RichContent html={body} /></div>
    </div>
  </article>;
}

function Thread() {
  const { id } = Route.useParams();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reply, setReply] = useState("");
  const [replyKey, setReplyKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string; thread: boolean } | null>(null);
  const author = "id,display_name,char_name,job,avatar_path";
  const q = useQuery({
    queryKey: ["forum", "thread", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("forum_threads").select(`*,profiles(${author}),forum_posts(id,body,created_at,author_id,profiles(${author}))`).eq("id", id).maybeSingle();
      if (error) throw error; return data;
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["forum"] }); };
  if (q.isLoading) return <main className="mx-auto max-w-4xl px-4 py-10 text-muted-foreground">Loading…</main>;
  const t = q.data;
  if (!t) return <main className="mx-auto max-w-4xl px-4 py-10">Topic not found. <Link to="/forum" className="text-primary">Back to forum</Link></main>;
  const posts = [...t.forum_posts].sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function send() {
    if (!userId || !reply.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("forum_posts").insert({ thread_id: id, author_id: userId, body: reply.trim() });
    setBusy(false);
    if (error) toast.error(error.message); else { setReply(""); setReplyKey((k) => k + 1); refresh(); }
  }
  async function saveEdit() {
    if (!editing || !editing.body.trim()) return;
    const { error } = editing.thread
      ? await supabase.from("forum_threads").update({ body: editing.body.trim(), updated_at: new Date().toISOString() }).eq("id", editing.id)
      : await supabase.from("forum_posts").update({ body: editing.body.trim() }).eq("id", editing.id);
    if (error) toast.error(error.message); else { setEditing(null); refresh(); }
  }
  const editor = <div className="grid gap-2"><RichEditor key={editing?.id} initial={editing?.body ?? ""} onChange={(body) => setEditing((e) => (e ? { ...e, body } : e))} /><div className="flex gap-2"><Button size="sm" onClick={saveEdit}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div></div>;

  return <main className="mx-auto max-w-4xl px-4 py-10">
    <Link to="/forum" className="text-sm text-primary">← Forum</Link>
    <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{categoryName(t.category)}</p>
    <h1 className="text-3xl font-bold">{t.title}</h1>
    <div className="mt-6 space-y-3">
      {editing?.thread ? editor : <PostCard author={t.profiles} body={t.body} date={t.created_at} actions={t.author_id === userId && <>
        <Button size="sm" variant="ghost" className="h-6" onClick={() => setEditing({ id: t.id, body: t.body, thread: true })}>Edit</Button>
        <Button size="sm" variant="ghost" className="h-6 text-destructive" onClick={async () => { if (!confirm("Delete this topic and all replies?")) return; const { error } = await supabase.from("forum_threads").delete().eq("id", t.id); if (error) toast.error(error.message); else { refresh(); navigate({ to: "/forum" }); } }}>Delete</Button></>} />}
      {posts.map((p) => editing?.id === p.id ? <div key={p.id}>{editor}</div> : <PostCard key={p.id} author={p.profiles} body={p.body} date={p.created_at} actions={p.author_id === userId && <>
        <Button size="sm" variant="ghost" className="h-6" onClick={() => setEditing({ id: p.id, body: p.body, thread: false })}>Edit</Button>
        <Button size="sm" variant="ghost" className="h-6 text-destructive" onClick={async () => { const { error } = await supabase.from("forum_posts").delete().eq("id", p.id); if (error) toast.error(error.message); else refresh(); }}>Delete</Button></>} />)}
    </div>
    {userId ? <div className="mt-6 grid gap-2"><RichEditor key={replyKey} placeholder="Write a reply…" minHeight={140} onChange={setReply} /><div><Button disabled={busy || !reply.trim()} onClick={send}>Reply</Button></div></div>
      : <Button asChild variant="outline" className="mt-6"><Link to="/auth">Sign in to reply</Link></Button>}
  </main>;
}
