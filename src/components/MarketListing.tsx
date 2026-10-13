import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CharacterPortrait } from "@/components/CharacterPortrait";
import { itemDisplay } from "@/lib/ro/slots";
import { formatZeny } from "@/lib/forum";

export function useListings(limit?: number) {
  return useQuery({
    queryKey: ["market", limit ?? "all"],
    queryFn: async () => {
      let q = supabase.from("market_listings").select("*,profiles(id,display_name,char_name,avatar_path)").order("created_at", { ascending: false });
      if (limit) q = q.eq("status", "open").limit(limit);
      const { data, error } = await q; if (error) throw error; return data;
    },
  });
}

type Listing = NonNullable<ReturnType<typeof useListings>["data"]>[number];

export function ListingCard({ l, mine, onChange }: { l: Listing; mine?: boolean; onChange?: () => void }) {
  const p = l.profiles;
  async function setStatus(status: string) { const { error } = await supabase.from("market_listings").update({ status }).eq("id", l.id); if (error) toast.error(error.message); else onChange?.(); }
  async function remove() { if (!confirm("Remove this listing?")) return; const { error } = await supabase.from("market_listings").delete().eq("id", l.id); if (error) toast.error(error.message); else onChange?.(); }
  return <article className={"flex flex-col rounded-lg border bg-card p-4 " + (l.status === "open" ? "border-border" : "border-border opacity-60")}>
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1"><h3 className="font-semibold">{itemDisplay(l.item_key, l.item_name)}{l.quantity > 1 && <span className="text-muted-foreground"> ×{l.quantity}</span>}</h3>
        {l.status !== "open" && <span className="text-xs font-semibold uppercase text-accent">{l.status}</span>}</div>
      <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 font-bold text-primary"><Coins className="h-4 w-4" />{formatZeny(l.price)}</div>
    </div>
    {l.quantity > 1 && <p className="text-xs text-muted-foreground">{formatZeny(l.price / l.quantity)} each</p>}
    {l.note && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{l.note}</p>}
    {p && <Link to="/members/$id" params={{ id: p.id }} className="mt-auto flex items-center gap-2 pt-3 text-sm">
      <CharacterPortrait path={p.avatar_path} name={p.char_name || p.display_name} className="h-8 w-7" /><span>Sold by <span className="font-semibold text-primary">{p.char_name || p.display_name}</span></span>
    </Link>}
    {mine && <div className="mt-3 flex flex-wrap gap-1">
      {(["open", "reserved", "sold"] as const).map((s) => <Button key={s} size="sm" variant={l.status === s ? "default" : "outline"} className="h-7 text-xs capitalize" onClick={() => setStatus(s)}>{s}</Button>)}
      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={remove}>Remove</Button>
    </div>}
  </article>;
}

