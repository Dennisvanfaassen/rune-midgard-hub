import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Crosshair, Gift, Swords } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { itemDisplay } from "@/lib/ro/slots";

export type HelpOffer = { id: string; kind: string; helper_id: string; message: string | null; profiles: { display_name: string; char_name: string | null } | null };

export const HELP_LABEL: Record<string, string> = { have: "I got this for you", help: "I'll help you hunt this" };

/** Offers from guildmates on one wished item, plus buttons for others to offer help. */
export function HelpOffers({ wishlistId, owner, offers, onChange }: { wishlistId: string; owner: string; offers: HelpOffer[]; onChange: () => void }) {
  const { userId } = useAuth();
  const [busy, setBusy] = useState(false);
  const mine = offers.find((o) => o.helper_id === userId);
  async function offer(kind: "have" | "help") {
    if (!userId) return;
    setBusy(true);
    const { error } = mine?.kind === kind
      ? await supabase.from("wishlist_help").delete().eq("id", mine.id)
      : await supabase.from("wishlist_help").upsert({ wishlist_id: wishlistId, helper_id: userId, kind }, { onConflict: "wishlist_id,helper_id" });
    setBusy(false);
    if (error) toast.error(error.message); else { if (mine?.kind !== kind) toast.success(kind === "have" ? "They'll see you have it!" : "They'll see you want to help hunt!"); onChange(); }
  }
  async function dismiss(id: string) { const { error } = await supabase.from("wishlist_help").delete().eq("id", id); if (error) toast.error(error.message); else onChange(); }
  return <div className="mt-2 space-y-1">
    {offers.map((o) => <div key={o.id} className="flex items-center gap-1 text-xs">
      {o.kind === "have" ? <Gift className="h-3 w-3 text-success" /> : <Swords className="h-3 w-3 text-accent" />}
      <Link to="/members/$id" params={{ id: o.helper_id }} className="font-semibold text-primary">{o.profiles?.char_name || o.profiles?.display_name}</Link>
      <span className="text-muted-foreground">{o.kind === "have" ? "has this for you" : "will help you hunt"}</span>
      {owner === userId && <button className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Dismiss offer" onClick={() => dismiss(o.id)}>✕</button>}
    </div>)}
    {userId && userId !== owner && <div className="flex flex-wrap gap-1 pt-1">
      <Button size="sm" variant={mine?.kind === "have" ? "default" : "outline"} className="h-7 text-xs" disabled={busy} onClick={() => offer("have")}><Gift /> I got this</Button>
      <Button size="sm" variant={mine?.kind === "help" ? "default" : "outline"} className="h-7 text-xs" disabled={busy} onClick={() => offer("help")}><Swords /> I'll help hunt</Button>
    </div>}
  </div>;
}

export function WishlistBoard({ newest = false }: { newest?: boolean }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [pending, setPending] = useState<string | null>(null);
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["wishlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gear_wishlist").select("*,profiles(id,display_name,char_name,avatar_path),wishlist_help(id,kind,helper_id,message,profiles(display_name,char_name))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["wishlists"] }); qc.invalidateQueries({ queryKey: ["gear"] }); };
  const groups = new Map<string, typeof data>();
  for (const item of data) {
    const p = item.profiles;
    if (!p || (filter !== "all" && item.status !== filter)) continue;
    if (!`${p.display_name} ${p.char_name ?? ""} ${itemDisplay(item.item_key, item.item_name)}`.toLowerCase().includes(search.toLowerCase())) continue;
    groups.set(item.user_id, [...(groups.get(item.user_id) ?? []), item]);
  }
  const entries = [...groups.entries()].slice(0, newest ? 3 : undefined);
  async function toggle(id: string, status: string, owner: string) {
    if (pending) return;
    setPending(id);
    const { error } = await supabase.from("gear_wishlist").update({ status: status === "have" ? "need" : "have" }).eq("id", id);
    setPending(null);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["wishlists"] });
    qc.invalidateQueries({ queryKey: ["gear", owner] });
    qc.invalidateQueries({ queryKey: ["members"] });
  }
  return <div>
    {!newest && <div className="mb-6 flex flex-wrap gap-3">
      <Input aria-label="Search wishlists" placeholder="Search members or gear" className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="flex gap-1">{[["all", "All gear"], ["need", "Still needed"], ["have", "Owned"]].map(([key, label]) => <Button key={key} variant={filter === key ? "default" : "outline"} size="sm" onClick={() => { if (key) setFilter(key); }}>{label}</Button>)}</div>
    </div>}
    {isLoading && <p className="text-muted-foreground">Loading wishlists…</p>}
    {isError && <p className="text-destructive">Could not load wishlists.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {entries.map(([owner, items]) => {
        const p = items[0]?.profiles;
        if (!p) return null;
        return <article key={owner} className="rounded-lg border border-border bg-card p-4">
          <Link to="/members/$id" params={{ id: owner }} className="flex items-center gap-3 border-b border-border pb-3">
            <CharacterPortrait path={p.avatar_path} name={p.char_name || p.display_name} className="h-14 w-12" />
            <div><h3 className="font-bold text-primary">{p.char_name || p.display_name}</h3><p className="text-xs text-muted-foreground">{items.filter((g) => g.status === "need").length} still needed · {items.filter((g) => g.status === "have").length} owned</p></div>
          </Link>
          <ul className="divide-y divide-border">{(newest ? items.slice(0, 4) : items).map((g) => {
            const name = itemDisplay(g.item_key, g.item_name);
            return <li key={g.id} className="flex items-start gap-2 py-3">
              {g.status === "have" ? <Check className="mt-1 h-4 w-4 shrink-0 text-success" /> : <Crosshair className="mt-1 h-4 w-4 shrink-0 text-accent" />}
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{name}</p><p className="text-xs text-muted-foreground">{g.status === "have" ? "I have this gear" : "I still need this gear"}</p>
                {g.status === "need" && <HelpOffers wishlistId={g.id} owner={owner} offers={g.wishlist_help as HelpOffer[]} onChange={refresh} />}
              </div>
              {owner === userId && <Button aria-label={`Change ownership of ${name}`} title={g.status === "have" ? "I still need this gear" : "I have this gear"} size="icon" variant="ghost" disabled={!!pending} className="h-8 w-8 shrink-0" onClick={() => toggle(g.id, g.status, owner)}>{g.status === "have" ? <Crosshair /> : <Check />}</Button>}
            </li>;
          })}</ul>
          {newest && items.length > 4 && <Link to="/members/$id" params={{ id: owner }} className="text-xs text-primary">View all {items.length} items →</Link>}
        </article>;
      })}
    </div>
    {!isLoading && !isError && !entries.length && <p className="text-muted-foreground">No wishlists found.</p>}
  </div>;
}
