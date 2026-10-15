import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Gift, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function WishlistNotifications() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const q = useQuery({
    queryKey: ["wishlist-notifications", userId],
    enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("guild_notifications")
        .select("id,recipient_id,actor_id,kind,wishlist_id,item_name,created_at,read_at")
        .eq("recipient_id", userId!).order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      const people = [...new Set((data ?? []).map((entry) => entry.actor_id))];
      const profiles = people.length ? await supabase.from("profiles").select("id,display_name,char_name").in("id",people) : null;
      const names = new Map((profiles?.data ?? []).map((p) => [p.id,p.char_name || p.display_name]));
      return (data ?? []).map((entry) => ({...entry, actor: names.get(entry.actor_id) || "A guildmate"}));
    },
  });
  const unread = (q.data ?? []).filter((n) => !n.read_at);
  useEffect(() => {
    if (!userId) return;
    setSeen([]);
  }, [userId]);
  useEffect(() => {
    if (!q.data || !seen.length) return;
    const arrivals = unread.filter((n) => !seen.includes(n.id));
    if (arrivals.length && seen.length > 0) toast.info("New wishlist activity", { description: `${arrivals.length} new wishlist notification(s)` });
    setSeen(q.data.map((n) => n.id));
    // Only initialize the list when new data arrives, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.dataUpdatedAt]);
  async function markRead(id?: string) {
    if (!userId) return;
    const query = supabase.from("guild_notifications").update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId).is("read_at", null);
    const { error } = await (id ? query.eq("id",id) : query);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["wishlist-notifications", userId] });
  }
  if (!userId) return null;
  return <div className="relative">
    <Button size="sm" variant="ghost" aria-label={`Wishlist notifications: ${unread.length} unread`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative">
      <Bell className="h-4 w-4"/>
      {unread.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-5 text-white">{unread.length > 9 ? "9+" : unread.length}</span>}
    </Button>
    {open && <div className="absolute right-0 top-full z-50 mt-2 w-[min(90vw,370px)] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border p-3">
        <span className="text-sm font-semibold">Wishlist notifications</span>
        <Button variant="ghost" size="sm" disabled={!unread.length} onClick={() => markRead()}><CheckCheck className="mr-1 h-4 w-4"/>Mark all read</Button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {q.isError && <p className="p-4 text-xs text-destructive">Notifications unavailable. Run SQL migration 0015 in Lovable Cloud.</p>}
        {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!q.isLoading && !q.isError && !q.data?.length && <p className="p-5 text-sm text-muted-foreground">No notifications yet. Offers on your wishlist will appear here.</p>}
        {q.data?.map((entry) => <Link key={entry.id} to="/members/$id" params={{ id: userId }} onClick={() => { void markRead(entry.id); setOpen(false); }} className={`flex gap-3 border-b border-border/60 p-3 transition hover:bg-secondary ${entry.read_at ? "" : "bg-primary/5"}`}>
          {entry.kind === "wishlist_have" ? <Gift className="mt-1 h-4 w-4 shrink-0 text-emerald-500" /> : <Swords className="mt-1 h-4 w-4 shrink-0 text-primary" />}
          <span className="min-w-0"><span className="block text-sm"><strong>{entry.actor}</strong> {entry.kind === "wishlist_have" ? "has an item for you" : "will help hunt"}: <strong>{entry.item_name}</strong></span><span className="mt-1 block text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span></span>
          {!entry.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"/>}
        </Link>)}
      </div>
    </div>}
  </div>;
}
